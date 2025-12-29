"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
const mongodb_1 = require("mongodb");
// Prefer Atlas connection string if provided
const uri = process.env.MONGO_URI || process.env.MONGO_URL || 'mongodb://mongo:27017';
const dbName = process.env.MONGO_DB || 'atlas_bank';
let client = null;
let db = null;
async function getDb() {
    if (db)
        return db;
    if (!client) {
        client = new mongodb_1.MongoClient(uri);
        await client.connect();
    }
    db = client.db(dbName);
    return db;
}
