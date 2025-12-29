import { Router } from 'express';
import { getDb } from '../mongo';
import { kafka, topics } from '../kafka';
import { v4 as uuid } from 'uuid';
import { assessCard } from '../grpc';

export const cardsRouter = Router();

const producer = kafka.producer();
let producerReady = false;

cardsRouter.post('/authorize', async (req, res) => {
  try {
    const { cardType, cardNumber, expiry, cvv, amount, currency, merchant, fromAccount, toAccount } = req.body || {};
    if (!cardType || !cardNumber || !expiry || !amount || !merchant) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Basic masking and validation
    const digits = String(cardNumber).replace(/\D/g, '');
    if (digits.length < 12 || digits.length > 19) return res.status(400).json({ error: 'Invalid card number' });
    const last4 = digits.slice(-4);
    const masked = `**** **** **** ${last4}`;
    if (!/^\d{2}\/\d{2}$/.test(String(expiry))) return res.status(400).json({ error: 'Invalid expiry' });
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Invalid amount' });

    // Check card metadata in Mongo
    const db = await getDb();
    const cards = db.collection('cards');
    const cardDoc = await cards.findOne({ last4, cardType });
    if (cardDoc && cardDoc.status === 'blocked') return res.status(403).json({ error: 'Card blocked' });

    // Fraud decision via gRPC
    const decision = await assessCard(amt, merchant, cardType, last4);
    if (!decision.approved) {
      // Upsert masked card metadata (no CVV persisted)
      await cards.updateOne(
        { last4, cardType },
        { $set: { maskedNumber: masked, cardType, expiry, status: 'declined', updatedAt: new Date().toISOString() } },
        { upsert: true }
      );
      return res.status(200).json({ status: 'DECLINED', riskScore: decision.riskScore, reason: decision.reason });
    }

    // Approved: upsert card metadata and emit a payment event to ledger pipeline
    await cards.updateOne(
      { last4, cardType },
      { $set: { maskedNumber: masked, cardType, expiry, status: 'active', updatedAt: new Date().toISOString() } },
      { upsert: true }
    );

    // Ensure producer
    if (!producerReady) {
      await producer.connect();
      producerReady = true;
    }
    const event = {
      eventId: uuid(),
      type: 'PAYMENT_INITIATED',
      at: new Date().toISOString(),
      payload: {
        fromAccount: fromAccount || `CARD-${last4}`,
        toAccount: toAccount || 'MERCHANT-SETTLEMENT',
        amount: amt,
        currency: currency || 'USD',
        remarks: `Card ${cardType} ${masked} @ ${merchant}`,
        complaints: null,
      },
    };
    await producer.send({ topic: topics.payments, messages: [{ key: event.eventId, value: JSON.stringify(event) }] });
    return res.status(201).json({ status: 'APPROVED', eventId: event.eventId, riskScore: decision.riskScore });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
});
