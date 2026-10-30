import config, { validateCacheConfig } from '../config/cache.js';
import { createMemoryStore } from './cache/memory-store.js';
import { createRedisStore } from './cache/redis-store.js';

export function createCache(options = {}, { now = Date.now } = {}) {
  const settings = validateCacheConfig({ ...config, ...options });
  const store = settings.driver === 'redis' ? createRedisStore(settings) : createMemoryStore(settings, now);
  const pending = new Map();
  let closed = false;

  function keyFor(key) {
    if (closed) throw new Error('Cache is closed');
    if (typeof key !== 'string' || !key.length || Buffer.byteLength(key) > 512) throw new TypeError('Cache key must be a non-empty string of at most 512 bytes');
    return settings.prefix + key;
  }

  function checkTtl(ttl) {
    if (!Number.isSafeInteger(ttl) || ttl < 0 || ttl > 31536000) throw new TypeError('Cache TTL must be an integer number of seconds (0–31536000)');
  }

  function serialize(value) {
    let json;
    try { json = JSON.stringify(value); } catch { throw new TypeError('Cache value must be JSON serializable; convert BigInt to string first'); }
    if (json === undefined) throw new TypeError('Cache cannot store undefined, functions or symbols');
    if (Buffer.byteLength(json) > settings.maxValueBytes) throw new RangeError('Cache value exceeds CACHE_MAX_VALUE_BYTES');
    return json;
  }

  function invalidate(key) {
    const entry = pending.get(key);
    if (entry) entry.invalidated = true;
    pending.delete(key);
  }

  const cache = {
    async get(key, fallback = null) {
      const json = await store.get(keyFor(key));
      return json === undefined ? fallback : JSON.parse(json);
    },
    async has(key) { return (await store.get(keyFor(key))) !== undefined; },
    async put(key, value, ttl = settings.ttl) {
      const fullKey = keyFor(key);
      checkTtl(ttl);
      if (ttl === 0) { await cache.forget(key); return value; }
      const json = serialize(value);
      invalidate(fullKey);
      await store.put(fullKey, json, ttl);
      return JSON.parse(json);
    },
    async remember(key, ttl, loader) {
      if (typeof ttl === 'function' && loader === undefined) { loader = ttl; ttl = settings.ttl; }
      const fullKey = keyFor(key);
      checkTtl(ttl);
      if (typeof loader !== 'function') throw new TypeError('cache.remember needs a loader function');
      if (ttl === 0) { await cache.forget(key); return loader(); }
      let entry = pending.get(fullKey);
      if (!entry) {
        entry = { invalidated: false };
        pending.set(fullKey, entry);
        entry.promise = (async () => {
          const cached = await store.get(fullKey);
          if (cached !== undefined) return cached;
          const json = serialize(await loader());
          if (!entry.invalidated && !closed) await store.put(fullKey, json, ttl);
          return json;
        })();
      }
      try {
        // Each caller gets its own JSON copy, just like a later cache hit.
        return JSON.parse(await entry.promise);
      } finally {
        if (pending.get(fullKey) === entry) pending.delete(fullKey);
      }
    },
    async forget(key) {
      const fullKey = keyFor(key);
      invalidate(fullKey);
      return store.forget(fullKey);
    },
    async flush() {
      if (closed) throw new Error('Cache is closed');
      for (const key of pending.keys()) invalidate(key);
      await store.flush();
    },
    async close() {
      if (closed) return;
      closed = true;
      for (const key of pending.keys()) invalidate(key);
      await store.close();
    },
  };

  return cache;
}

const cache = createCache();
export default cache;
