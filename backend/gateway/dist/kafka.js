"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.topics = exports.kafka = void 0;
exports.ensureTopics = ensureTopics;
const kafkajs_1 = require("kafkajs");
const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
exports.kafka = new kafkajs_1.Kafka({
    clientId: 'atlas-gateway',
    brokers,
    logLevel: kafkajs_1.logLevel.NOTHING,
});
exports.topics = {
    payments: 'payments.v1',
    ledgerWritten: 'ledger.written.v1',
    fraudAlerts: 'fraud.alerts.v1',
    onboarding: 'onboarding.v1',
};
async function ensureTopics() {
    const admin = exports.kafka.admin();
    try {
        await admin.connect();
        const existing = await admin.listTopics();
        const desired = Object.values(exports.topics);
        const create = desired.filter(t => !existing.includes(t));
        if (create.length) {
            await admin.createTopics({
                topics: create.map(t => ({ topic: t, numPartitions: 1, replicationFactor: 1 })),
                waitForLeaders: true,
            });
        }
    }
    catch {
        // non-fatal: gateway can still run; producers will auto-create depending on broker config
    }
    finally {
        try {
            await admin.disconnect();
        }
        catch { }
    }
}
