import { Router } from 'express';
import { getDb } from '../mongo';

export const accountsRouter = Router();

accountsRouter.get('/', async (_req, res) => {
  try {
    const db = await getDb();
    const docs = await db.collection('accounts').aggregate([
      { $sort: { createdAt: -1 } },
      { $limit: 1000 },
      { $lookup: { from: 'customers', localField: 'customerId', foreignField: 'customerId', as: 'cust' } },
      { $unwind: { path: '$cust', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          accountNumber: 1,
          customerName: 1,
          balance: 1,
          status: 1,
          accountType: 1,
          createdAt: 1,
          email: '$cust.email',
          phone: '$cust.phone',
          firstName: '$cust.firstName',
          lastName: '$cust.lastName',
        }
      }
    ]).toArray();
    return res.json(docs);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
});
