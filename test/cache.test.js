import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCache } from '../src/services/cache.js';
import { readCacheConfig } from '../src/config/cache.js';

function memoryCache(options = {}) {
  let time = 0;
  const clock = { now: () => time, advance: (seconds) => { time += seconds * 1000; } };
  const cache = createCache({ driver: 'memory', prefix: 'test:', ...options }, { now: clock.now });
  return { cache, clock };
}

test('put, get, has and forget work like Laravel Cache', async () => {
  const { cache } = memoryCache();
  assert.equal(await cache.get('missing'), null);
  assert.equal(await cache.get('missing', 'default'), 'default');
  assert.deepEqual(await cache.put('user', { id: 1 }), { id: 1 });
  assert.deepEqual(await cache.get('user'), { id: 1 });
  assert.equal(await cache.has('user'), true);
  assert.equal(await cache.forget('user'), true);
  assert.equal(await cache.has('user'), false);
});

test('values expire after their TTL', async () => {
  const { cache, clock } = memoryCache();
  await cache.put('short', 'value', 10);
  clock.advance(9);
  assert.equal(await cache.get('short'), 'value');
  clock.advance(1);
  assert.equal(await cache.get('short'), null);
});

test('stored values are copies, so later changes do not leak into the cache', async () => {
  const { cache } = memoryCache();
  const user = { name: 'Ali' };
  await cache.put('user', user);
  user.name = 'Changed';
  const first = await cache.get('user');
  first.name = 'Changed again';
  assert.deepEqual(await cache.get('user'), { name: 'Ali' });
});

test('remember runs the loader once and then serves the cached value', async () => {
  const { cache } = memoryCache();
  let calls = 0;
  const loader = async () => { calls += 1; return [{ id: calls }]; };
  assert.deepEqual(await cache.remember('users', 60, loader), [{ id: 1 }]);
  assert.deepEqual(await cache.remember('users', 60, loader), [{ id: 1 }]);
  assert.deepEqual(await cache.remember('users', loader), [{ id: 1 }]);
  assert.equal(calls, 1);
});

test('concurrent remember calls share one loader call', async () => {
  const { cache } = memoryCache();
  let calls = 0;
  const loader = async () => { calls += 1; await new Promise((resolve) => setTimeout(resolve, 10)); return 'value'; };
  const results = await Promise.all([1, 2, 3].map(() => cache.remember('shared', 60, loader)));
  assert.deepEqual(results, ['value', 'value', 'value']);
  assert.equal(calls, 1);
});

test('a loader error is not cached', async () => {
  const { cache } = memoryCache();
  await assert.rejects(cache.remember('flaky', 60, async () => { throw new Error('DB down'); }), /DB down/);
  assert.equal(await cache.remember('flaky', 60, async () => 'ok'), 'ok');
});

test('forget during a running remember stops the old value from being stored', async () => {
  const { cache } = memoryCache();
  let release;
  const pending = cache.remember('users', 60, () => new Promise((resolve) => { release = resolve; }));
  await new Promise((resolve) => setImmediate(resolve));
  await cache.forget('users');
  release('stale');
  assert.equal(await pending, 'stale');
  assert.equal(await cache.has('users'), false);
});

test('TTL 0 removes the key instead of storing it', async () => {
  const { cache } = memoryCache();
  await cache.put('key', 'value');
  await cache.put('key', 'new', 0);
  assert.equal(await cache.has('key'), false);
  assert.equal(await cache.remember('key', 0, () => 'fresh'), 'fresh');
  assert.equal(await cache.has('key'), false);
});

test('the oldest unused entry is removed when the cache is full', async () => {
  const { cache } = memoryCache({ maxItems: 2 });
  await cache.put('a', 1);
  await cache.put('b', 2);
  await cache.get('a');
  await cache.put('c', 3);
  assert.equal(await cache.get('a'), 1);
  assert.equal(await cache.get('b'), null);
  assert.equal(await cache.get('c'), 3);
});

test('flush removes everything', async () => {
  const { cache } = memoryCache();
  await cache.put('a', 1);
  await cache.put('b', 2);
  await cache.flush();
  assert.equal(await cache.has('a'), false);
  assert.equal(await cache.has('b'), false);
});

test('invalid keys, TTLs and values are rejected with clear errors', async () => {
  const { cache } = memoryCache({ maxValueBytes: 20 });
  await assert.rejects(cache.get(''), TypeError);
  await assert.rejects(cache.put('key', 'value', -1), TypeError);
  await assert.rejects(cache.put('key', 'value', 1.5), TypeError);
  await assert.rejects(cache.put('key', undefined), TypeError);
  await assert.rejects(cache.put('key', 10n), /BigInt/);
  await assert.rejects(cache.put('key', 'x'.repeat(50)), RangeError);
  await assert.rejects(cache.remember('key', 60), /loader/);
});

test('a closed cache refuses new work', async () => {
  const { cache } = memoryCache();
  await cache.close();
  await cache.close();
  await assert.rejects(cache.get('key'), /closed/);
});

test('config uses safe defaults and rejects invalid .env values', () => {
  const config = readCacheConfig({});
  assert.equal(config.driver, 'memory');
  assert.equal(config.ttl, 300);
  assert.match(config.prefix, /^[a-zA-Z0-9_-]+:cache:$/);
  assert.throws(() => readCacheConfig({ CACHE_DRIVER: 'file' }), /CACHE_DRIVER/);
  assert.throws(() => readCacheConfig({ CACHE_TTL: 'abc' }), /ttl/);
  assert.throws(() => readCacheConfig({ CACHE_PREFIX: 'no-colon' }), /CACHE_PREFIX/);
  assert.throws(() => readCacheConfig({ CACHE_DRIVER: 'redis', REDIS_URL: 'http://localhost' }), /REDIS_URL/);
});

// Runs only when TEST_REDIS_URL points to a Redis server you can safely write to.
test('redis driver stores, expires and flushes only its own prefix', { skip: !process.env.TEST_REDIS_URL }, async () => {
  const { createClient } = await import('redis');
  const raw = createClient({ url: process.env.TEST_REDIS_URL });
  await raw.connect();
  await raw.set('other-app:key', 'keep');
  const cache = createCache({ driver: 'redis', redisUrl: process.env.TEST_REDIS_URL, prefix: 'exg-test:' });
  try {
    await cache.put('user', { id: 1 }, 60);
    assert.deepEqual(await cache.get('user'), { id: 1 });
    assert.ok((await raw.ttl('exg-test:user')) > 0);
    let calls = 0;
    await cache.remember('list', 60, () => { calls += 1; return [1, 2]; });
    assert.deepEqual(await cache.remember('list', 60, () => { calls += 1; return []; }), [1, 2]);
    assert.equal(calls, 1);
    await cache.flush();
    assert.equal(await cache.has('user'), false);
    assert.equal(await raw.get('other-app:key'), 'keep');
  } finally {
    await raw.del('other-app:key');
    await cache.close();
    raw.destroy();
  }
});

test('redis driver reports a safe error when Redis is down', async () => {
  const cache = createCache({ driver: 'redis', redisUrl: 'redis://user:secret@127.0.0.1:1', prefix: 'exg-test:', timeoutMs: 500 });
  try {
    await assert.rejects(cache.get('key'), (error) => {
      assert.match(error.message, /Redis cache is unavailable/);
      assert.doesNotMatch(error.message, /secret/);
      return true;
    });
  } finally {
    await cache.close();
  }
});
