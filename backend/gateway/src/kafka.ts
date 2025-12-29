import { Kafka, logLevel } from 'kafkajs';

const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
export const kafka = new Kafka({
  clientId: 'atlas-gateway',
  brokers,
  logLevel: logLevel.NOTHING,
});

export const topics = {
  payments: 'payments.v1',
  ledgerWritten: 'ledger.written.v1',
  fraudAlerts: 'fraud.alerts.v1',
  onboarding: 'onboarding.v1',
};

export async function ensureTopics() {
  const admin = kafka.admin();
  try {
    await admin.connect();
    const existing = await admin.listTopics();
    const desired = Object.values(topics);
    const create = desired.filter(t => !existing.includes(t));
    if (create.length) {
      await admin.createTopics({
        topics: create.map(t => ({ topic: t, numPartitions: 1, replicationFactor: 1 })),
        waitForLeaders: true,
      });
    }
  } catch {
    // non-fatal: gateway can still run; producers will auto-create depending on broker config
  } finally {
    try { await admin.disconnect(); } catch {}
  }
}
