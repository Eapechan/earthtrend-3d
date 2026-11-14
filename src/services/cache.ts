const memory = new Map<string, { value: unknown; expires: number }>()
const inflight = new Map<string, Promise<unknown>>()

export function readCache<T>(key: string): T | null {
  const hit = memory.get(key)
  if (hit && hit.expires > Date.now()) return hit.value as T
  if (hit) memory.delete(key)
  return null
}

export function writeCache<T>(key: string, value: T, ttlMs: number): void {
  memory.set(key, { value, expires: Date.now() + ttlMs })
}

/**
 * Deduplicates concurrent requests and keeps successful responses in memory.
 * Historical POWER/Open-Meteo data changes slowly, so a multi-hour TTL is safe;
 * near-real-time responses use short TTLs at the call site.
 */
export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const hit = readCache<T>(key)
  if (hit !== null) return hit

  const pending = inflight.get(key)
  if (pending) return pending as Promise<T>

  const promise = loader()
    .then((value) => {
      writeCache(key, value, ttlMs)
      return value
    })
    .finally(() => {
      inflight.delete(key)
    })

  inflight.set(key, promise as Promise<unknown>)
  return promise
}

export function clearCache(): void {
  memory.clear()
}
