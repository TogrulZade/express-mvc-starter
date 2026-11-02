export function createMemoryStore({ maxItems }, now = Date.now) {
  const entries = new Map();

  return {
    async get(key) {
      const item = entries.get(key);
      if (!item) return undefined;
      if (item.expiresAt <= now()) {
        entries.delete(key);
        return undefined;
      }
      // Recently used entries go to the end; the oldest entry is evicted first.
      entries.delete(key);
      entries.set(key, item);
      return item.value;
    },
    async put(key, value, ttl) {
      const time = now();
      for (const [candidate, item] of entries) if (item.expiresAt <= time) entries.delete(candidate);
      entries.delete(key);
      while (entries.size >= maxItems) entries.delete(entries.keys().next().value);
      entries.set(key, { value, expiresAt: time + ttl * 1000 });
    },
    async forget(key) { return entries.delete(key); },
    async flush() { entries.clear(); },
    async close() { entries.clear(); },
  };
}
