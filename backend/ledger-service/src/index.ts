import 'dotenv/config';
import { Kafka, logLevel } from 'kafkajs';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { MongoClient, Db } from 'mongodb';

const kafka = new Kafka({ clientId: 'atlas-ledger', brokers: (process.env.KAFKA_BROKERS||'localhost:9092').split(','), logLevel: logLevel.NOTHING });
const consumer = kafka.consumer({ groupId: 'ledger-consumer' });
const producer = kafka.producer();

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  user: process.env.PG_USER || 'atlas',
  password: process.env.PG_PASSWORD || 'atlas',
  database: process.env.PG_DATABASE || 'atlas_ledger',
});

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const topics = { payments: 'payments.v1', ledgerWritten: 'ledger.written.v1' };

// Mongo for accounts read model updates (prefer Atlas URI if provided)
const mongoUri = process.env.MONGO_URI || process.env.MONGO_URL || 'mongodb://localhost:27017';
const mongoDbName = process.env.MONGO_DB || 'atlas_core';
let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;
async function getMongoDb(): Promise<Db> {
  if (mongoDb) return mongoDb;
  if (!mongoClient) {
    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
  }
  mongoDb = mongoClient.db(mongoDbName);
  return mongoDb;
}

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id SERIAL PRIMARY KEY,
      tx_id VARCHAR(64) NOT NULL,
      at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      account_id VARCHAR(64) NOT NULL,
      currency VARCHAR(8) NOT NULL,
      amount NUMERIC(18,2) NOT NULL,
      direction VARCHAR(6) NOT NULL CHECK (direction IN ('debit','credit'))
    );
    CREATE INDEX IF NOT EXISTS idx_ledger_tx ON ledger_entries(tx_id);
    CREATE INDEX IF NOT EXISTS idx_ledger_account ON ledger_entries(account_id);
    -- Ensure idempotency per (tx_id, account_id, direction)
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uniq_ledger_tx_acc_dir'
      ) THEN
        CREATE UNIQUE INDEX uniq_ledger_tx_acc_dir ON ledger_entries(tx_id, account_id, direction);
      END IF;
    END$$;
    CREATE TABLE IF NOT EXISTS payments_meta (
      tx_id VARCHAR(64) PRIMARY KEY,
      remarks TEXT NULL,
      complaints TEXT NULL
    );
  `);
}

async function handlePayment(event: any) {
  const { eventId, at, payload } = event;
  const { fromAccount, toAccount, amount, currency, remarks, complaints } = payload;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO ledger_entries(tx_id, at, account_id, currency, amount, direction) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (tx_id, account_id, direction) DO NOTHING',
      [eventId, at, fromAccount, currency, amount, 'debit']
    );
    await client.query(
      'INSERT INTO ledger_entries(tx_id, at, account_id, currency, amount, direction) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (tx_id, account_id, direction) DO NOTHING',
      [eventId, at, toAccount, currency, amount, 'credit']
    );
    await client.query(
      'INSERT INTO payments_meta(tx_id, remarks, complaints) VALUES ($1,$2,$3) ON CONFLICT (tx_id) DO UPDATE SET remarks = EXCLUDED.remarks, complaints = EXCLUDED.complaints',
      [eventId, remarks ?? null, complaints ?? null]
    );
    await client.query('COMMIT');

    await producer.send({ topic: topics.ledgerWritten, messages: [{ key: eventId, value: JSON.stringify({ eventId, at, payload }) }] });

    // Derive live dashboard payload from authoritative sources (Postgres & Mongo)
    // This prevents duplicate counts across refreshes
    const txResNow = await client.query(`SELECT COUNT(DISTINCT tx_id) AS c FROM ledger_entries`);
    const volResNow = await client.query(`SELECT COALESCE(SUM(amount),0) AS v FROM ledger_entries WHERE direction='credit'`);
    const transactions = Number(txResNow.rows?.[0]?.c || 0);
    const totalVolume = Number(volResNow.rows?.[0]?.v || 0);
    // Compute active accounts from Mongo for correctness (status = 'Active')
    let activeAccounts = 0;
    try {
      const dbmCount = await getMongoDb();
      activeAccounts = await dbmCount.collection('accounts').countDocuments({ status: 'Active' });
    } catch {}

    // Compute last 12 months credited volume from ledger as series (timezone-robust)
    const seriesRows = await client.query(
      `SELECT EXTRACT(YEAR FROM at)::int AS y,
              EXTRACT(MONTH FROM at)::int AS m,
              SUM(amount) AS total
       FROM ledger_entries
       WHERE direction = 'credit' AND at >= (now() - interval '12 months')
       GROUP BY y, m
       ORDER BY y ASC, m ASC`
    );
    // Build 12-month window including months with zero
    const now = new Date();
    const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const totalsMap: Record<string, number> = {};
    for (const r of seriesRows.rows as any[]) {
      const key = `${r.y}-${r.m}`;
      totalsMap[key] = parseFloat(r.total);
    }
    const series: { name: string; total: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()+1}`;
      series.push({ name: labels[d.getMonth()], total: Math.round((totalsMap[key] || 0) * 100) / 100 });
    }

    await redis.publish('dashboard.metrics', JSON.stringify({ transactions, totalVolume, activeAccounts, series }));

    // Recent transaction stream: publish both sides and store rolling history (10)
    try {
      const dbm = await getMongoDb();
      const accColl = dbm.collection('accounts');
      const custColl = dbm.collection('customers');
      const [fromAcc, toAcc] = await Promise.all([
        accColl.findOne({ accountNumber: fromAccount }),
        accColl.findOne({ accountNumber: toAccount }),
      ]);
      const [fromCust, toCust] = await Promise.all([
        fromAcc ? custColl.findOne({ customerId: (fromAcc as any).customerId }) : Promise.resolve(null),
        toAcc ? custColl.findOne({ customerId: (toAcc as any).customerId }) : Promise.resolve(null),
      ]);
      const debitItem = {
        name: (fromAcc as any)?.customerName || `Acct ${fromAccount.slice(-4)}`,
        email: (fromCust as any)?.email || `${fromAccount}@example.com`,
        amount: '-' + `$${amount.toFixed(2)}`,
      };
      const creditItem = {
        name: (toAcc as any)?.customerName || `Acct ${toAccount.slice(-4)}`,
        email: (toCust as any)?.email || `${toAccount}@example.com`,
        amount: '+' + `$${amount.toFixed(2)}`,
      };
      for (const item of [debitItem, creditItem]) {
        await redis.publish('transactions.recent', JSON.stringify(item));
        await redis.lpush('transactions.recent.list', JSON.stringify(item));
      }
      await redis.ltrim('transactions.recent.list', 0, 9);
    } catch {}

    // Update Mongo read model balances in "accounts" collection
    try {
      const dbm = await getMongoDb();
      const coll = dbm.collection('accounts');
      await coll.updateOne({ accountNumber: fromAccount }, { $inc: { balance: -Number(amount) } });
      await coll.updateOne({ accountNumber: toAccount }, { $inc: { balance: Number(amount) } });
    } catch (e) {
      // non-fatal
      console.error('mongo balance update error', e);
    }
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('ledger error', e);
  } finally {
    client.release();
  }
}

async function main() {
  await migrate();
  await producer.connect();
  await consumer.connect();
  // On startup, publish a metrics snapshot so dashboards have data immediately
  try {
    const client = await pool.connect();
    try {
      const txRes = await client.query(`SELECT COUNT(DISTINCT tx_id) AS c FROM ledger_entries`);
      const volRes = await client.query(`SELECT COALESCE(SUM(amount),0) AS v FROM ledger_entries WHERE direction='credit'`);
      const transactions = Number(txRes.rows?.[0]?.c || 0);
      const totalVolume = Number(volRes.rows?.[0]?.v || 0);

      const seriesRows = await client.query(
        `SELECT EXTRACT(YEAR FROM at)::int AS y,
                EXTRACT(MONTH FROM at)::int AS m,
                SUM(amount) AS total
         FROM ledger_entries
         WHERE direction = 'credit' AND at >= (now() - interval '12 months')
         GROUP BY y, m
         ORDER BY y ASC, m ASC`
      );
      const now = new Date();
      const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const totalsMap: Record<string, number> = {};
      for (const r of seriesRows.rows as any[]) {
        const key = `${r.y}-${r.m}`;
        totalsMap[key] = parseFloat(r.total);
      }
      const series: { name: string; total: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${d.getMonth()+1}`;
        series.push({ name: labels[d.getMonth()], total: Math.round((totalsMap[key] || 0) * 100) / 100 });
      }

      let activeAccounts = 0;
      try {
        const dbm = await getMongoDb();
        activeAccounts = await dbm.collection('accounts').countDocuments({ status: 'Active' });
      } catch {}

      await redis.set('metrics:transactions', String(transactions));
      await redis.set('metrics:volume', String(totalVolume));
      // Publish snapshot
      await redis.publish('dashboard.metrics', JSON.stringify({ transactions, totalVolume, activeAccounts, series }));
      console.log('Published initial metrics snapshot');
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('snapshot error', e);
  }
  await consumer.subscribe({ topic: topics.payments, fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const event = JSON.parse(message.value.toString());
      if (event?.type === 'PAYMENT_INITIATED') await handlePayment(event);
    }
  });
  console.log('Ledger service running');
}

main().catch(err => { console.error(err); process.exit(1); });
