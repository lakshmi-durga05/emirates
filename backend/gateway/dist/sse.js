"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sseHandler = sseHandler;
const ioredis_1 = __importDefault(require("ioredis"));
const auth_1 = require("./auth");
const redis = new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379');
const clients = [];
let latestMetrics = null;
function sseHandler(req, res) {
    // Optional auth
    const enabled = (process.env.AUTH_ENABLED || 'false').toLowerCase() === 'true';
    if (enabled) {
        try {
            void (0, auth_1.verifySSEAuth)(req);
        }
        catch {
            res.status(401).end();
            return;
        }
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const id = `${Date.now()}-${Math.random()}`;
    clients.push({ id, res });
    if (latestMetrics) {
        const payload = `event: metrics\ndata: ${JSON.stringify(latestMetrics)}\n\n`;
        res.write(payload);
    }
    // Bootstrap recent transactions list
    (async () => {
        try {
            const recent = await redis.lrange('transactions.recent.list', 0, 9);
            for (const item of recent.reverse()) {
                const payload = `event: transaction\ndata: ${item}\n\n`;
                res.write(payload);
            }
        }
        catch { }
    })();
    req.on('close', () => {
        const idx = clients.findIndex(c => c.id === id);
        if (idx >= 0)
            clients.splice(idx, 1);
    });
}
function broadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of clients) {
        c.res.write(payload);
    }
}
// Forward Redis pub/sub to SSE
const sub = new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379');
sub.subscribe('dashboard.metrics', 'fraud.alerts', 'transactions.recent');
sub.on('message', (channel, message) => {
    const data = JSON.parse(message);
    if (channel === 'dashboard.metrics') {
        console.log('[SSE] metrics received');
        latestMetrics = data;
        broadcast('metrics', data);
    }
    if (channel === 'fraud.alerts') {
        console.log('[SSE] fraud alert received for', data?.eventId);
        broadcast('fraud_alert', data);
    }
    if (channel === 'transactions.recent') {
        console.log('[SSE] recent transaction received');
        broadcast('transaction', data);
    }
});
// Periodic heartbeat
setInterval(() => broadcast('heartbeat', { t: Date.now() }), 30000);
