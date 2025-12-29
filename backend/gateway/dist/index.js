"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const payments_1 = require("./routes/payments");
const sse_1 = require("./sse");
const reports_1 = require("./routes/reports");
const onboarding_1 = require("./routes/onboarding");
const accounts_1 = require("./routes/accounts");
const auth_1 = require("./auth");
const cards_1 = require("./routes/cards");
const graphql_1 = require("./graphql");
const kafka_1 = require("./kafka");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express_1.default.json());
app.use((0, morgan_1.default)('dev'));
// Health
app.get('/healthz', (_req, res) => res.json({ ok: true }));
// Actions -> events
// Attach auth for all API routes (no-ops if AUTH_ENABLED is false)
app.use('/api', auth_1.requireAuth);
// GraphQL (auth-protected)
app.use('/graphql', auth_1.requireAuth, graphql_1.graphqlHandler);
app.use('/api/payments', payments_1.paymentsRouter);
app.use('/api/cards', cards_1.cardsRouter);
// ADMIN-only areas
app.use('/api/reports', (0, auth_1.requireRole)('ADMIN'), reports_1.reportsRouter);
app.use('/api/onboarding', (0, auth_1.requireRole)('ADMIN'), onboarding_1.onboardingRouter);
// USER-accessible
app.use('/api/accounts', accounts_1.accountsRouter);
// Live updates
app.get('/api/events', sse_1.sseHandler);
// Ensure Kafka topics exist (non-fatal if it fails)
(0, kafka_1.ensureTopics)().catch(() => { });
const port = parseInt(process.env.PORT || '4000', 10);
app.listen(port, () => console.log(`Gateway listening on ${port}`));
