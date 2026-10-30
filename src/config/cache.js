import 'dotenv/config';
import { readFileSync } from 'node:fs';

const { name = 'app' } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

export function validateCacheConfig(config) {
  if (!['memory', 'redis'].includes(config.driver)) throw new Error('CACHE_DRIVER must be memory or redis');
  if (!/^[a-zA-Z0-9_:-]+:$/.test(config.prefix)) throw new Error('CACHE_PREFIX must use letters, numbers, _, - or : and end with :');
  for (const [key, min, max] of [['ttl', 0, 31536000], ['maxItems', 1, 100000], ['maxValueBytes', 1, 10485760], ['timeoutMs', 1, 60000]]) {
    if (!Number.isSafeInteger(config[key]) || config[key] < min || config[key] > max) throw new Error(`Invalid cache option: ${key} (${min}–${max})`);
  }
  if (config.driver === 'redis') {
    let url;
    try { url = new URL(config.redisUrl); } catch { /* Report a safe message below. */ }
    if (!url?.hostname || !['redis:', 'rediss:'].includes(url.protocol)) throw new Error('REDIS_URL must be a valid redis:// or rediss:// URL');
  }
  return config;
}

export function readCacheConfig(env = process.env) {
  return validateCacheConfig({
    driver: env.CACHE_DRIVER || 'memory',
    ttl: Number(env.CACHE_TTL || 300),
    prefix: env.CACHE_PREFIX || `${name.replace(/[^a-zA-Z0-9_:-]/g, '_')}:cache:`,
    maxItems: Number(env.CACHE_MAX_ITEMS || 1000),
    maxValueBytes: Number(env.CACHE_MAX_VALUE_BYTES || 262144),
    redisUrl: env.REDIS_URL || 'redis://127.0.0.1:6379',
    timeoutMs: Number(env.CACHE_TIMEOUT_MS || 2000),
  });
}

export default readCacheConfig();
