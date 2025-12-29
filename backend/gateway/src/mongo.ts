import { MongoClient, Db } from 'mongodb';

// Prefer Atlas connection string if provided
const uri = process.env.MONGO_URI || process.env.MONGO_URL || 'mongodb://mongo:27017';
const dbName = process.env.MONGO_DB || 'atlas_bank';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }
  db = client.db(dbName);
  return db;
}
