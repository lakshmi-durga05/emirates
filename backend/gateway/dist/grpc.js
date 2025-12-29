"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFraudClient = getFraudClient;
exports.assessPayment = assessPayment;
exports.assessCard = assessCard;
const protoLoader = __importStar(require("@grpc/proto-loader"));
const path_1 = require("path");
let client = null;
async function getFraudClient() {
    if (client)
        return client;
    const protoPath = (0, path_1.join)(__dirname, '..', 'proto', 'fraud.proto');
    const pkgDef = await protoLoader.load(protoPath, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true });
    const grpcObj = require('@grpc/grpc-js').loadPackageDefinition(pkgDef).fraud;
    const addr = process.env.FRAUD_GRPC_ADDR || 'fraud-service:50051';
    client = new grpcObj.FraudService(addr, require('@grpc/grpc-js').credentials.createInsecure());
    return client;
}
function assessPayment(amount, fromAccount, toAccount) {
    return new Promise(async (resolve, reject) => {
        const maxAttempts = 3;
        let lastErr;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const c = await getFraudClient();
                c.AssessPayment({ amount, fromAccount, toAccount }, (err, res) => {
                    if (err) {
                        lastErr = err;
                        if (attempt === maxAttempts)
                            return reject(err);
                    }
                    else {
                        return resolve(res);
                    }
                });
                if (attempt === maxAttempts)
                    break;
                // wait a bit before the next attempt if the callback errored
                await new Promise(r => setTimeout(r, attempt * 200));
            }
            catch (e) {
                lastErr = e;
                if (attempt === maxAttempts)
                    return reject(e);
                await new Promise(r => setTimeout(r, attempt * 200));
            }
        }
        reject(lastErr);
    });
}
function assessCard(amount, merchant, cardType, last4) {
    return new Promise(async (resolve, reject) => {
        const maxAttempts = 3;
        let lastErr;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const c = await getFraudClient();
                c.AssessCard({ amount, merchant, cardType, last4 }, (err, res) => {
                    if (err) {
                        lastErr = err;
                        if (attempt === maxAttempts)
                            return reject(err);
                    }
                    else {
                        return resolve(res);
                    }
                });
                if (attempt === maxAttempts)
                    break;
                await new Promise(r => setTimeout(r, attempt * 200));
            }
            catch (e) {
                lastErr = e;
                if (attempt === maxAttempts)
                    return reject(e);
                await new Promise(r => setTimeout(r, attempt * 200));
            }
        }
        reject(lastErr);
    });
}
