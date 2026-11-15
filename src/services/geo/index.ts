import { fetchJson } from '../http'
import type {
  Admin1Payload,
  Admin2Payload,
  CountriesPayload,
  GeoCountry,
  GeoDivision,
  GeoIndex,
  GeoSearchEntry,
  GeoSearchPayload,
} from './types'

/**
 * Boundary loader.
 *
 * The payloads are self-hosted under /geo (generated at build time). Every
 * request is memoised for the lifetime of the page and a failed request is
 * evicted so a later zoom can retry. Nothing here blocks the globe: a missing
 * admin-1 or admin-2 file simply removes that level from the UI.
 */

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
const memo = new Map<string, Promise<unknown>>()

function load<T>(key: string, file: string, timeoutMs = 30_000): Promise<T> {
  const existing = memo.get(key)
  if (existing) return existing as Promise<T>
  const request = fetchJson<T>(`${BASE}/geo/${file}`, { timeoutMs, retries: 1 })
  memo.set(key, request)
  request.catch(() => memo.delete(key))
  return request
}

export function loadGeoIndex(): Promise<GeoIndex> {
  return load<GeoIndex>('index', 'index.json', 12_000)
}

export async function loadCountries(): Promise<GeoCountry[]> {
  const payload = await load<CountriesPayload>('countries', 'countries.json', 35_000)
  return payload.countries
}

export async function loadAdmin1(iso3: string): Promise<GeoDivision[]> {
  const code = iso3.toUpperCase()
  const payload = await load<Admin1Payload>(`admin1:${code}`, `admin1/${code}.json`, 25_000)
  return payload.divisions
}

export async function loadAdmin2(iso3: string): Promise<Admin2Payload> {
  const code = iso3.toUpperCase()
  return load<Admin2Payload>(`admin2:${code}`, `admin2/${code}.json`, 45_000)
}

export async function loadSearchIndex(): Promise<GeoSearchEntry[]> {
  const payload = await load<GeoSearchPayload>('search', 'search-index.json', 20_000)
  return payload.entries
}

/** True when the build includes second-level boundaries for this country. */
export function admin2Available(index: GeoIndex | null, iso3: string): boolean {
  if (!index) return false
  return index.admin2.some((entry) => entry.iso3 === iso3)
}

/** Clears the in-memory cache. Exposed for tests and for a manual "reload" action. */
export function clearGeoCache(): void {
  memo.clear()
}
