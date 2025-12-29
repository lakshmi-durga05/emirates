"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onboardingRouter = void 0;
const express_1 = require("express");
const mongo_1 = require("../mongo");
const kafka_1 = require("../kafka");
const uuid_1 = require("uuid");
const ioredis_1 = __importDefault(require("ioredis"));
exports.onboardingRouter = (0, express_1.Router)();
const producer = kafka_1.kafka.producer();
let producerReady = false;
const redis = new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379');
exports.onboardingRouter.post('/', async (req, res) => {
    try {
        const { firstName, lastName, email, phone, accountType, initialDeposit } = req.body || {};
        if (!firstName || !lastName || !email) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const db = await (0, mongo_1.getDb)();
        const customers = db.collection('customers');
        const accounts = db.collection('accounts');
        const kycrequests = db.collection('kycrequests');
        const customerId = (0, uuid_1.v4)();
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
            kycId: (0, uuid_1.v4)(),
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
            }
            catch (e) {
                // non-blocking onboarding even if Kafka is down
            }
        }
        const event = {
            eventId: (0, uuid_1.v4)(),
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
            await producer.send({ topic: kafka_1.topics.onboarding, messages: [{ key: event.eventId, value: JSON.stringify(event) }] });
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
            await redis.publish('dashboard.metrics', JSON.stringify({ transactions, totalVolume, activeAccounts }));
        }
        catch { }
        return res.status(201).json({ customerId, accountNumber });
    }
    catch (e) {
        return res.status(500).json({ error: e?.message || 'failed' });
    }
});
