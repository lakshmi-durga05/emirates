"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedis = getRedis;
exports.ensureRedis = ensureRedis;
const ioredis_1 = __importDefault(require("ioredis"));
let client = null;
function getRedis() {
    if (client)
        return client;
    const host = process.env.REDIS_HOST || 'redis';
    const port = Number(process.env.REDIS_PORT || '6379');
    const url = process.env.REDIS_URL || `redis://${host}:${port}`;
    client = new ioredis_1.default(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 2,
        enableOfflineQueue: false,
    });
    return client;
}
async function ensureRedis() {
    try {
        const r = getRedis();
        // Establish connection if not yet ready
        // ioredis will noop if already connected
        // @ts-ignore
        if (!r.connector?.stream?.writable) {
            await r.connect();
        }
        return r;
    }
    catch {
        return null;
    }
}
