interface CacheEntry { v: any; exp: number; }

export function cacheSet(key: string, value: any, ttlMs: number) {
  try {
    const entry: CacheEntry = { v: value, exp: Date.now() + ttlMs };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {}
}

export function cacheGet<T=any>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() > entry.exp) { localStorage.removeItem(key); return null; }
    return entry.v as T;
  } catch { return null; }
}
