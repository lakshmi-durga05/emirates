"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyJWT = verifyJWT;
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
exports.verifySSEAuth = verifySSEAuth;
const jose_1 = require("jose");
let jwks = null;
function getEnv(name, fallback) {
    const v = process.env[name] || fallback;
    if (!v)
        throw new Error(`${name} not set`);
    return v;
}
async function verifyJWT(token) {
    if (!jwks) {
        const issuer = getEnv('OIDC_ISSUER');
        const jwksUri = `${issuer.replace(/\/$/, '')}/protocol/openid-connect/certs`;
        jwks = (0, jose_1.createRemoteJWKSet)(new URL(jwksUri));
    }
    const issuer = getEnv('OIDC_ISSUER');
    const audience = process.env.OIDC_AUDIENCE || undefined;
    const { payload } = await (0, jose_1.jwtVerify)(token, jwks, {
        issuer,
        audience,
    });
    return payload;
}
function requireAuth(req, res, next) {
    const enabled = (process.env.AUTH_ENABLED || 'false').toLowerCase() === 'true';
    if (!enabled)
        return next();
    const auth = req.headers['authorization'] || '';
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m)
        return res.status(401).json({ error: 'missing token' });
    verifyJWT(m[1])
        .then((payload) => { req.user = payload; next(); })
        .catch(() => res.status(401).json({ error: 'invalid token' }));
}
function requireRole(role) {
    return (req, res, next) => {
        const enabled = (process.env.AUTH_ENABLED || 'false').toLowerCase() === 'true';
        if (!enabled)
            return next();
        const user = req.user;
        const roles = user?.realm_access?.roles || [];
        if (roles.includes(role))
            return next();
        return res.status(403).json({ error: 'forbidden' });
    };
}
async function verifySSEAuth(req) {
    const enabled = (process.env.AUTH_ENABLED || 'false').toLowerCase() === 'true';
    if (!enabled)
        return null;
    const auth = req.headers['authorization'] || '';
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m)
        throw new Error('missing token');
    return await verifyJWT(m[1]);
}
