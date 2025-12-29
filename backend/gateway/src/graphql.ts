import { graphqlHTTP } from 'express-graphql';
import { buildSchema } from 'graphql';
import { Pool } from 'pg';
import { getDb } from './mongo';

const schema = buildSchema(`
  type MetricSeries { month: String!, tx_count: Int!, total_credit: Float!, complaints_count: Int! }
  type Metrics { totalVolume: Float!, activeAccounts: Int!, monthly: [MetricSeries!]! }
  type ReconciliationDay { day: String!, credits: Float!, debits: Float!, closing_balance: Float!, difference: Float!, status: String! }
  type Query {
    health: String!
    metrics: Metrics!
    reconciliation: [ReconciliationDay!]!
  }
`);

const pool = new Pool({
  host: process.env.PG_HOST || 'postgres',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  user: process.env.PG_USER || 'atlas',
  password: process.env.PG_PASSWORD || 'atlas',
  database: process.env.PG_DATABASE || 'atlas_ledger',
});

const root = {
  health: async () => {
    // Lightweight health; relies on process being alive. Deeper checks remain on /healthz.
    return 'ok';
  },
  metrics: async () => {
    const vol = await pool.query(`SELECT COALESCE(SUM(amount),0) AS total FROM ledger_entries WHERE direction='credit'`);
    const totalVolume = Number(vol.rows?.[0]?.total || 0);
    const db = await getDb();
    const activeAccounts = await db.collection('accounts').countDocuments({ status: 'active' });
    const { rows } = await pool.query(`
      SELECT to_char(date_trunc('month', le.at), 'YYYY-MM') AS month,
             COUNT(DISTINCT le.tx_id) AS tx_count,
             COALESCE(SUM(le.amount), 0) AS total_credit,
             COALESCE(SUM(CASE WHEN pm.complaints IS NOT NULL AND pm.complaints <> '' THEN 1 ELSE 0 END), 0) AS complaints_count
      FROM ledger_entries le
      LEFT JOIN payments_meta pm ON pm.tx_id = le.tx_id
      WHERE le.direction = 'credit'
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `);
    return { totalVolume, activeAccounts, monthly: rows };
  },
  reconciliation: async () => {
    const { rows } = await pool.query(`
      SELECT to_char(day, 'YYYY-MM-DD') AS day, credits, debits, closing_balance, difference, status
      FROM reconciliation_results
      ORDER BY day DESC
      LIMIT 30
    `);
    return rows;
  }
};

export const graphqlHandler = graphqlHTTP({ schema, rootValue: root, graphiql: true });
