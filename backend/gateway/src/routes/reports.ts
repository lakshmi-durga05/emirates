import { Router } from 'express';
import { Pool } from 'pg';
import { ensureRedis } from '../redis';
import { getDb } from '../mongo';

const pool = new Pool({
  host: process.env.PG_HOST || 'postgres',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  user: process.env.PG_USER || 'atlas',
  password: process.env.PG_PASSWORD || 'atlas',
  database: process.env.PG_DATABASE || 'atlas_ledger',
});

export const reportsRouter = Router();

// Complaints-only report
reportsRouter.get('/complaints.csv', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT to_char(le.at, 'YYYY-MM-DD"T"HH24:MI:SSZ') as at,
              le.tx_id,
              pm.complaints
       FROM payments_meta pm
       JOIN ledger_entries le ON le.tx_id = pm.tx_id
       WHERE pm.complaints IS NOT NULL AND pm.complaints <> ''
         AND le.direction = 'credit'
       ORDER BY le.at DESC
       LIMIT 1000`
    );
    const header = 'at,tx_id,complaints';
    const csv = [header, ...rows.map(r => `${r.at},${r.tx_id},"${String(r.complaints).replace(/"/g,'""')}"`)].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="complaints.csv"');
    return res.send(csv);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
});

// Temporary: list a few account numbers from Mongo for seeding/testing
reportsRouter.get('/accounts.json', async (_req, res) => {
  try {
    const db = await getDb();
    const items = await db
      .collection('accounts')
      .find({}, { projection: { _id: 0, accountNumber: 1 } })
      .limit(10)
      .toArray();
    return res.json({ items });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
});

// JSON for Reconciliation UI
reportsRouter.get('/reconciliation.json', async (req, res) => {
  try {
    const r = await ensureRedis();
    const cacheKey = 'cache:reconciliation.json:v1';
    if (r) {
      const cached = await r.get(cacheKey);
      if (cached) {
        res.setHeader('Content-Type', 'application/json');
        return res.send(cached);
      }
    }

    const { rows } = await pool.query(
      `SELECT to_char(day, 'YYYY-MM-DD') AS day, credits, debits, closing_balance, difference, status
       FROM reconciliation_results
       ORDER BY day DESC
       LIMIT 30`
    );
    const body = JSON.stringify({ items: rows });
    if (r) {
      await r.set(cacheKey, body, 'EX', 20);
    }
    res.setHeader('Content-Type', 'application/json');
    return res.send(body);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
});


reportsRouter.get('/monthly.csv', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT to_char(date_trunc('month', le.at), 'YYYY-MM') AS month,
              COUNT(DISTINCT le.tx_id) AS tx_count,
              COALESCE(SUM(le.amount), 0) AS total_credit,
              COALESCE(SUM(CASE WHEN pm.complaints IS NOT NULL AND pm.complaints <> '' THEN 1 ELSE 0 END), 0) AS complaints_count
       FROM ledger_entries le
       LEFT JOIN payments_meta pm ON pm.tx_id = le.tx_id
       WHERE le.direction = 'credit'
       GROUP BY month
       ORDER BY month DESC
       LIMIT 12`
    );
    const header = 'month,tx_count,total_credit,complaints_count';
    const csv = [header, ...rows.map(r => `${r.month},${r.tx_count},${r.total_credit},${r.complaints_count}`)].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="monthly.csv"');
    return res.send(csv);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
});

reportsRouter.get('/transactions.csv', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT to_char(at, 'YYYY-MM-DD"T"HH24:MI:SSZ') as at, tx_id, account_id, currency, amount, direction
       FROM ledger_entries
       ORDER BY at DESC
       LIMIT 1000`
    );
    const header = 'at,tx_id,account_id,currency,amount,direction';
    const csv = [header, ...rows.map(r => `${r.at},${r.tx_id},${r.account_id},${r.currency},${r.amount},${r.direction}`)].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
    return res.send(csv);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
});

// Reconciliation: compute and persist results, then serve CSV
reportsRouter.post('/reconciliation/run', async (req, res) => {
  try {
    // Simple per-IP rate limit using Redis (max 5 per minute)
    try {
      const r = await ensureRedis();
      if (r) {
        const key = `rl:recon:${req.ip}`;
        const cnt = await r.incr(key);
        if (cnt === 1) await r.expire(key, 60);
        if (cnt > 5) return res.status(429).json({ error: 'rate_limited' });
        await r.del('cache:reconciliation.json:v1');
      }
    } catch {}

    // Ensure table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reconciliation_results (
        id SERIAL PRIMARY KEY,
        day DATE NOT NULL,
        credits NUMERIC(18,2) NOT NULL,
        debits NUMERIC(18,2) NOT NULL,
        closing_balance NUMERIC(18,2) NOT NULL,
        difference NUMERIC(18,2) NOT NULL,
        status VARCHAR(16) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    // Proactively remove any existing duplicates so unique index creation can succeed
    // Keep the latest row (highest id) per day, delete older duplicates
    await pool.query(`
      DELETE FROM reconciliation_results a
      USING reconciliation_results b
      WHERE a.day = b.day AND a.id < b.id;
    `);

    // Ensure one row per day via unique index
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS recon_results_day_idx ON reconciliation_results(day);`);

    // Daily totals from ledger (Postgres)
    const { rows: daily } = await pool.query(`
      SELECT date_trunc('day', at)::date AS day,
             COALESCE(SUM(CASE WHEN direction='credit' THEN amount ELSE 0 END),0) AS credits,
             COALESCE(SUM(CASE WHEN direction='debit' THEN amount ELSE 0 END),0) AS debits
      FROM ledger_entries
      WHERE at >= (now() - interval '30 days')
      GROUP BY day
      ORDER BY day DESC
    `);

    // Closing balance from Mongo accounts
    let closing = 0;
    try {
      const db = await getDb();
      const agg = await db.collection('accounts').aggregate([
        { $group: { _id: null, bal: { $sum: { $toDouble: { $ifNull: [ '$balance', 0 ] } } } } }
      ]).toArray();
      closing = Number(agg?.[0]?.bal || 0);
    } catch {}

    // Upsert rows per day
    for (const r of daily) {
      const credits = Number(r.credits || 0);
      const debits = Number(r.debits || 0);
      const difference = Math.round((credits - debits - closing) * 100) / 100;
      const status = Math.abs(difference) < 0.01 ? 'MATCHED' : 'MISMATCH';
      await pool.query(
        `INSERT INTO reconciliation_results(day, credits, debits, closing_balance, difference, status)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (day) DO UPDATE SET
           credits = EXCLUDED.credits,
           debits = EXCLUDED.debits,
           closing_balance = EXCLUDED.closing_balance,
           difference = EXCLUDED.difference,
           status = EXCLUDED.status`,
        [r.day, credits, debits, closing, difference, status]
      );
    }
    return res.json({ ok: true, rows: daily.length, closing });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
});

reportsRouter.get('/reconciliation.csv', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT to_char(day, 'YYYY-MM-DD') AS day, credits, debits, closing_balance, difference, status
       FROM reconciliation_results
       ORDER BY day DESC
       LIMIT 1000`
    );
    const header = 'day,credits,debits,closing_balance,difference,status';
    const csv = [header, ...rows.map(r => `${r.day},${r.credits},${r.debits},${r.closing_balance},${r.difference},${r.status}`)].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="reconciliation.csv"');
    return res.send(csv);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
});
