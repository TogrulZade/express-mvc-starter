import { createClient } from 'redis';

export function createRedisStore({ redisUrl, prefix, timeoutMs }) {
  let client;
  let connecting;
  let closed = false;

  async function connection() {
    if (closed) throw new Error('Cache is closed');
    if (client?.isReady) return client;
    if (!connecting) {
      client = createClient({
        url: redisUrl,
        disableOfflineQueue: true,
        socket: { connectTimeout: timeoutMs, reconnectStrategy: false },
      });
      // Commands below report failures without logging URLs or passwords.
      client.on('error', () => {});
      connecting = client.connect().finally(() => { connecting = undefined; });
    }
    await connecting;
    return client;
  }

  async function command(operation) {
    try {
      const ready = await connection();
      return await operation(ready.withCommandOptions({ timeout: timeoutMs }));
    } catch {
      throw new Error('Redis cache is unavailable. Check REDIS_URL and the Redis server.');
    }
  }

  return {
    async get(key) { return (await command((redis) => redis.get(key))) ?? undefined; },
    async put(key, value, ttl) { await command((redis) => redis.set(key, value, { expiration: { type: 'EX', value: ttl } })); },
    async forget(key) { return (await command((redis) => redis.del(key))) > 0; },
    async flush() {
      // Never FLUSHDB/FLUSHALL: other applications may share this Redis server.
      await command(async (redis) => {
        for await (const keys of redis.scanIterator({ MATCH: `${prefix}*`, COUNT: 100 })) {
          if (keys.length) await redis.unlink(keys);
        }
      });
    },
    async close() {
      closed = true;
      if (client?.isOpen) client.destroy();
      await connecting?.catch(() => {});
    },
  };
}
