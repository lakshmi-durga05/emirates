import { Router } from 'express';
import { getDb } from '../mongo';
import { kafka, topics } from '../kafka';
import { v4 as uuid } from 'uuid';
import Redis from 'ioredis';

export const onboardingRouter = Router();

const producer = kafka.producer();
let producerReady = false;
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

onboardingRouter.post('/', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, accountType, initialDeposit } = req.body || {};
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const db = await getDb();
    const customers = db.collection('customers');
    const accounts = db.collection('accounts');
    const kycrequests = db.collection('kycrequests');
    const customerId = uuid();
    const accountNumber = `ACC${Math.floor(Math.random() * 900000 + 100000)}`;
    const now = new Date().toISOString();

    await customers.insertOne({
      customerId,
      firstName,
      lastName,
      email,
      phone: phone || null,
      createdAt: now,
    });

    const balance = Number(initialDeposit) || 0;
    await accounts.insertOne({
      accountNumber,
      customerId,
      customerName: `${firstName} ${lastName}`,
      status: 'Active',
      balance,
      accountType: accountType || 'current',
      createdAt: now,
    });

    // Store a basic KYC request record derived from onboarding inputs
    await kycrequests.insertOne({
      kycId: uuid(),
      customerId,
      name: `${firstName} ${lastName}`,
      email,
      phone: phone || null,
      accountNumber,
      accountType: accountType || 'current',
      status: 'SUBMITTED',
      submittedAt: now,
    });

    if (!producerReady) {
      try {
        await producer.connect();
        producerReady = true;
      } catch (e) {
        // non-blocking onboarding even if Kafka is down
      }
    }
    const event = {
      eventId: uuid(),
      type: 'CUSTOMER_ONBOARDED',
      at: now,
      payload: {
        customerId,
        firstName,
        lastName,
        email,
        phone: phone || null,
        accountNumber,
        accountType: accountType || 'current',
        initialDeposit: balance,
      },
    };
    if (producerReady) {
      await producer.send({ topic: topics.onboarding, messages: [{ key: event.eventId, value: JSON.stringify(event) }] });
    }

    // Update dashboard active accounts and publish snapshot (count from Mongo for accuracy)
    try {
      const activeAccounts = await accounts.countDocuments({});
      const [txStr, volStr] = await Promise.all([
        redis.get('metrics:transactions'),
        redis.get('metrics:volume'),
      ]);
      const transactions = parseInt(txStr || '0', 10);
      const totalVolume = parseFloat(volStr || '0');
      await redis.publish('dashboard.metrics', JSON.stringify({ transactions, totalVolume, activeAccounts } as any));
    } catch {}

    return res.status(201).json({ customerId, accountNumber });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
});
