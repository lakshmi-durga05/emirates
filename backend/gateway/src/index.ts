import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { paymentsRouter } from './routes/payments';
import { sseHandler } from './sse';
import { reportsRouter } from './routes/reports';
import { onboardingRouter } from './routes/onboarding';
import { accountsRouter } from './routes/accounts';
import { requireAuth, requireRole } from './auth';
import { cardsRouter } from './routes/cards';
import { graphqlHandler } from './graphql';
import { ensureTopics } from './kafka';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*'}));
app.use(express.json());
app.use(morgan('dev'));

// Health
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Actions -> events
// Attach auth for all API routes (no-ops if AUTH_ENABLED is false)
app.use('/api', requireAuth);
// GraphQL (auth-protected)
app.use('/graphql', requireAuth, graphqlHandler);
app.use('/api/payments', paymentsRouter);
app.use('/api/cards', cardsRouter);
// ADMIN-only areas
app.use('/api/reports', requireRole('ADMIN'), reportsRouter);
app.use('/api/onboarding', requireRole('ADMIN'), onboardingRouter);
// USER-accessible
app.use('/api/accounts', accountsRouter);

// Live updates
app.get('/api/events', sseHandler);

// Ensure Kafka topics exist (non-fatal if it fails)
ensureTopics().catch(() => {});

const port = parseInt(process.env.PORT || '4000', 10);
app.listen(port, () => console.log(`Gateway listening on ${port}`));
