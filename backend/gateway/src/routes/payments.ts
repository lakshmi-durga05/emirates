import { Router } from 'express';
import { kafka, topics } from '../kafka';
import { v4 as uuid } from 'uuid';
import { getDb } from '../mongo';
import { ensureRedis } from '../redis';
import { assessPayment } from '../grpc';

const producer = kafka.producer();
let producerReady = false;

export const paymentsRouter = Router();

paymentsRouter.post('/', async (req, res) => {
  try {
    // Per-IP rate limit: max 10 payments/minute
    try {
      const r = await ensureRedis();
      if (r) {
        const key = `rl:pay:${req.ip}`;
        const cnt = await r.incr(key);
        if (cnt === 1) await r.expire(key, 60);
        if (cnt > 10) return res.status(429).json({ error: 'rate_limited' });
      }
    } catch {}

    const { fromAccount, toAccount, amount, currency, remarks, complaints } = req.body || {};
    if (!fromAccount || !toAccount || !amount || !currency) {
      return res.status(400).json({ error: 'Invalid payment payload' });
    }
    // Validate accounts exist (only onboarded accounts can transact)
    try {
      const db = await getDb();
      const col = db.collection('accounts');
      const [fromDoc, toDoc] = await Promise.all([
        col.findOne({ accountNumber: fromAccount }),
        col.findOne({ accountNumber: toAccount }),
      ]);
      if (!fromDoc || !toDoc) {
        return res.status(400).json({ error: 'Account not found. Only onboarded accounts can make payments.' });
      }
    } catch (e) {
      return res.status(500).json({ error: 'Account validation failed' });
    }

    // gRPC fraud assessment for bank transfer
    try {
      const decision = await assessPayment(amount, fromAccount, toAccount);
      if (!decision.approved) {
        return res.status(200).json({ status: 'DECLINED', riskScore: decision.riskScore, reason: decision.reason });
      }
    } catch (e) {
      return res.status(503).json({ error: 'Fraud service unavailable' });
    }

    if (!producerReady) {
      try {
        await producer.connect();
        producerReady = true;
      } catch (e) {
        return res.status(503).json({ error: 'Kafka unavailable', details: (e as Error).message });
      }
    }
    const event = {
      eventId: uuid(),
      type: 'PAYMENT_INITIATED',
      at: new Date().toISOString(),
      payload: { fromAccount, toAccount, amount, currency, remarks: remarks || null, complaints: complaints || null },
    };
    await producer.send({ topic: topics.payments, messages: [{ key: event.eventId, value: JSON.stringify(event) }] });
    return res.status(202).json({ status: 'accepted', eventId: event.eventId });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
});

// Temporary: simple seeding endpoint using query params to avoid JSON quoting issues from shells
// Example: GET /api/payments/seed?from=ACC1&to=ACC2&amount=25&currency=USD
paymentsRouter.get('/seed', async (req, res) => {
  try {
    // Per-IP rate limit: max 10 seeds/minute
    try {
      const r = await ensureRedis();
      if (r) {
        const key = `rl:seed:${req.ip}`;
        const cnt = await r.incr(key);
        if (cnt === 1) await r.expire(key, 60);
        if (cnt > 10) return res.status(429).json({ error: 'rate_limited' });
      }
    } catch {}

    const fromAccount = String(req.query.from || '');
    const toAccount = String(req.query.to || '');
    const amount = Number(req.query.amount || 0);
    const currency = String(req.query.currency || 'USD');
    const remarks = String(req.query.remarks || 'seed');
    const complaints = '';
    if (!fromAccount || !toAccount || !amount || !currency) {
      return res.status(400).json({ error: 'Invalid seed params' });
    }
    // Validate accounts exist
    try {
      const db = await getDb();
      const col = db.collection('accounts');
      const [fromDoc, toDoc] = await Promise.all([
        col.findOne({ accountNumber: fromAccount }),
        col.findOne({ accountNumber: toAccount }),
      ]);
      if (!fromDoc || !toDoc) {
        return res.status(400).json({ error: 'Account not found. Only onboarded accounts can make payments.' });
      }
    } catch (e) {
      return res.status(500).json({ error: 'Account validation failed' });
    }

    // gRPC fraud assessment
    try {
      const decision = await assessPayment(amount, fromAccount, toAccount);
      if (!decision.approved) {
        return res.status(200).json({ status: 'DECLINED', riskScore: decision.riskScore, reason: decision.reason });
      }
    } catch (e) {
      return res.status(503).json({ error: 'Fraud service unavailable' });
    }

    if (!producerReady) {
      try {
        await producer.connect();
        producerReady = true;
      } catch (e) {
        return res.status(503).json({ error: 'Kafka unavailable', details: (e as Error).message });
      }
    }
    const event = {
      eventId: uuid(),
      type: 'PAYMENT_INITIATED',
      at: new Date().toISOString(),
      payload: { fromAccount, toAccount, amount, currency, remarks, complaints },
    };
    await producer.send({ topic: topics.payments, messages: [{ key: event.eventId, value: JSON.stringify(event) }] });
    return res.status(202).json({ status: 'accepted', eventId: event.eventId });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
});
