import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';

let client: any | null = null;

export async function getFraudClient() {
  if (client) return client;
  const protoPath = join(__dirname, '..', 'proto', 'fraud.proto');
  const pkgDef = await protoLoader.load(protoPath, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true });
  const grpcObj = (require('@grpc/grpc-js').loadPackageDefinition(pkgDef) as any).fraud;
  const addr = process.env.FRAUD_GRPC_ADDR || 'fraud-service:50051';
  client = new grpcObj.FraudService(addr, require('@grpc/grpc-js').credentials.createInsecure());
  return client;
}

export function assessPayment(amount: number, fromAccount: string, toAccount: string): Promise<{ approved: boolean; riskScore: number; reason: string; }> {
  return new Promise(async (resolve, reject) => {
    const maxAttempts = 3;
    let lastErr: any;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const c = await getFraudClient();
        c.AssessPayment({ amount, fromAccount, toAccount }, (err: any, res: any) => {
          if (err) {
            lastErr = err;
            if (attempt === maxAttempts) return reject(err);
          } else {
            return resolve(res);
          }
        });
        if (attempt === maxAttempts) break;
        // wait a bit before the next attempt if the callback errored
        await new Promise(r => setTimeout(r, attempt * 200));
      } catch (e) {
        lastErr = e;
        if (attempt === maxAttempts) return reject(e);
        await new Promise(r => setTimeout(r, attempt * 200));
      }
    }
    reject(lastErr);
  });
}

export function assessCard(amount: number, merchant: string, cardType: string, last4: string): Promise<{ approved: boolean; riskScore: number; reason: string; }> {
  return new Promise(async (resolve, reject) => {
    const maxAttempts = 3;
    let lastErr: any;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const c = await getFraudClient();
        c.AssessCard({ amount, merchant, cardType, last4 }, (err: any, res: any) => {
          if (err) {
            lastErr = err;
            if (attempt === maxAttempts) return reject(err);
          } else {
            return resolve(res);
          }
        });
        if (attempt === maxAttempts) break;
        await new Promise(r => setTimeout(r, attempt * 200));
      } catch (e) {
        lastErr = e;
        if (attempt === maxAttempts) return reject(e);
        await new Promise(r => setTimeout(r, attempt * 200));
      }
    }
    reject(lastErr);
  });
}
