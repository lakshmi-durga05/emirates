import IORedis from 'ioredis';

let client: IORedis | null = null;

export function getRedis(): IORedis {
  if (client) return client;
  const host = process.env.REDIS_HOST || 'redis';
  const port = Number(process.env.REDIS_PORT || '6379');
  const url = process.env.REDIS_URL || `redis://${host}:${port}`;
  client = new IORedis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
  });
  return client;
}

export async function ensureRedis(): Promise<IORedis | null> {
  try {
    const r = getRedis();
    // Establish connection if not yet ready
    // ioredis will noop if already connected
    // @ts-ignore
    if (!(r as any).connector?.stream?.writable) {
      await r.connect();
    }
    return r;
  } catch {
    return null;
  }
}
