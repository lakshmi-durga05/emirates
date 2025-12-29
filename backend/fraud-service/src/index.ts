import 'dotenv/config';
import { Kafka, logLevel } from 'kafkajs';
import Redis from 'ioredis';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';

const kafka = new Kafka({ clientId: 'atlas-fraud', brokers: (process.env.KAFKA_BROKERS||'localhost:9092').split(','), logLevel: logLevel.NOTHING });
const consumer = kafka.consumer({ groupId: 'fraud-consumer' });
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const topics = { payments: 'payments.v1' };

function score(amount: number) {
  // Very simple heuristic for prototype
  if (amount >= 10000) return 85;
  if (amount >= 5000) return 60;
  return 15 + Math.floor(Math.random()*20);
}

async function main() {
  await consumer.connect();
  await consumer.subscribe({ topic: topics.payments, fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const event = JSON.parse(message.value.toString());
      if (event?.type !== 'PAYMENT_INITIATED') return;
      console.log('[Fraud] payment event received', event.eventId, 'amount=', event?.payload?.amount);
      const amt = Number(event.payload.amount);
      const risk = score(amt);
      const isFraud = risk >= 70;
      const alert = { eventId: event.eventId, at: new Date().toISOString(), riskScore: risk, isFraudulent: isFraud };
      await redis.publish('fraud.alerts', JSON.stringify(alert));
      console.log('[Fraud] alert published', alert.eventId, 'risk=', alert.riskScore);
    }
  });
  console.log('Fraud service running');

  // gRPC server for internal calls
  const protoPath = join(__dirname, '..', 'proto', 'fraud.proto');
  const pkgDef = await protoLoader.load(protoPath, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true });
  const grpcObj = (grpc.loadPackageDefinition(pkgDef) as any).fraud;
  const server = new grpc.Server();
  function decide(amount: number) {
    const r = score(amount);
    const approved = r < 70;
    return { approved, riskScore: r, reason: approved ? 'APPROVE' : 'DECLINE' };
  }
  server.addService(grpcObj.FraudService.service, {
    AssessPayment: (call: any, cb: any) => {
      const amt = Number(call.request?.amount || 0);
      const res = decide(amt);
      cb(null, res);
    },
    AssessCard: (call: any, cb: any) => {
      const amt = Number(call.request?.amount || 0);
      const res = decide(amt);
      cb(null, res);
    }
  });
  const grpcPort = process.env.FRAUD_GRPC_PORT || '50051';
  server.bindAsync(`0.0.0.0:${grpcPort}`, grpc.ServerCredentials.createInsecure(), (err) => {
    if (err) { console.error('gRPC bind error', err); process.exit(1); }
    server.start();
    console.log('Fraud gRPC listening on', grpcPort);
  });
}

main().catch(err => { console.error(err); process.exit(1); });
