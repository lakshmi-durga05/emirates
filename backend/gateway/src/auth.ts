import type { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getEnv(name: string, fallback?: string) {
  const v = process.env[name] || fallback;
  if (!v) throw new Error(`${name} not set`);
  return v;
}

export async function verifyJWT(token: string): Promise<JWTPayload> {
  if (!jwks) {
    const issuer = getEnv('OIDC_ISSUER');
    const jwksUri = `${issuer.replace(/\/$/, '')}/protocol/openid-connect/certs`;
    jwks = createRemoteJWKSet(new URL(jwksUri));
  }
  const issuer = getEnv('OIDC_ISSUER');
  const audience = process.env.OIDC_AUDIENCE || undefined;
  const { payload } = await jwtVerify(token, jwks!, {
    issuer,
    audience,
  });
  return payload;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const enabled = (process.env.AUTH_ENABLED || 'false').toLowerCase() === 'true';
  if (!enabled) return next();

  const auth = req.headers['authorization'] || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: 'missing token' });
  verifyJWT(m[1])
    .then((payload) => { (req as any).user = payload; next(); })
    .catch(() => res.status(401).json({ error: 'invalid token' }));
}

export function requireRole(role: 'USER' | 'ADMIN') {
  return (req: Request, res: Response, next: NextFunction) => {
    const enabled = (process.env.AUTH_ENABLED || 'false').toLowerCase() === 'true';
    if (!enabled) return next();
    const user = (req as any).user as JWTPayload | undefined;
    const roles: string[] = (user as any)?.realm_access?.roles || [];
    if (roles.includes(role)) return next();
    return res.status(403).json({ error: 'forbidden' });
  };
}

export async function verifySSEAuth(req: Request): Promise<JWTPayload | null> {
  const enabled = (process.env.AUTH_ENABLED || 'false').toLowerCase() === 'true';
  if (!enabled) return null;
  const auth = req.headers['authorization'] || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) throw new Error('missing token');
  return await verifyJWT(m[1]);
}
