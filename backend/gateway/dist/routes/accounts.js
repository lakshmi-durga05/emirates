"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountsRouter = void 0;
const express_1 = require("express");
const mongo_1 = require("../mongo");
exports.accountsRouter = (0, express_1.Router)();
exports.accountsRouter.get('/', async (_req, res) => {
    try {
        const db = await (0, mongo_1.getDb)();
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
    }
    catch (e) {
        return res.status(500).json({ error: e?.message || 'failed' });
    }
});
