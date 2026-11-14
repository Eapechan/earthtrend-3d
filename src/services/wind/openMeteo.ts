import type { WindField, WindSample } from '../../types'
import { fetchJson, HttpError } from '../http'
import { cached } from '../cache'
import { addDays, todayISO } from '../../utils/date'

const FORECAST_BASE = 'https://api.open-meteo.com/v1/forecast'
const ARCHIVE_BASE = 'https://archive-api.open-meteo.com/v1/archive'

interface OpenMeteoLocation {
  latitude: number
  longitude: number
  hourly?: {
    time: string[]
    wind_speed_10m?: Array<number | null>
    wind_direction_10m?: Array<number | null>
  }
  reason?: string
}

const LATS: number[] = []
for (let lat = -75; lat <= 75; lat += 15) LATS.push(lat)
const LONS: number[] = []
for (let lon = -180; lon <= 165; lon += 15) LONS.push(lon)

/** Coordinates per request. Open-Meteo counts each location against its quota. */
const CHUNK = 24
/** Sequential requests avoid the endpoint's burst protection (429/404 flakes). */
const CONCURRENCY = 1

function buildGrid(lats: number[], lons: number[]): Array<{ lat: number; lon: number }> {
  const points: Array<{ lat: number; lon: number }> = []
  for (const lat of lats) for (const lon of lons) points.push({ lat, lon })
  return points
}

function windComponents(speed: number, direction: number): { u: number; v: number } {
  // Meteorological direction is where the wind comes FROM.
  const rad = (direction * Math.PI) / 180
  return { u: -speed * Math.sin(rad), v: -speed * Math.cos(rad) }
}

function pickNoon(hourly: NonNullable<OpenMeteoLocation['hourly']>, date: string) {
  // Only accept the exact 12:00 UTC step. Falling back to another hour would
  // make the UI's stated valid time wrong.
  const index = hourly.time.indexOf(`${date}T12:00`)
  if (index === -1) return null
  const speed = hourly.wind_speed_10m?.[index]
  const direction = hourly.wind_direction_10m?.[index]
  if (speed === null || speed === undefined || direction === null || direction === undefined) return null
  if (!Number.isFinite(speed) || !Number.isFinite(direction)) return null
  return { speed, direction, time: hourly.time[index] }
}

async function requestChunk(
  base: string,
  points: Array<{ lat: number; lon: number }>,
  date: string,
  signal?: AbortSignal,
): Promise<WindSample[]> {
  const params = new URLSearchParams({
    latitude: points.map((p) => p.lat).join(','),
    longitude: points.map((p) => p.lon).join(','),
    start_date: date,
    end_date: date,
    hourly: 'wind_speed_10m,wind_direction_10m',
    wind_speed_unit: 'ms',
    timezone: 'UTC',
  })
  const url = `${base}?${params.toString()}`

  let json: OpenMeteoLocation[] | OpenMeteoLocation
  for (let attempt = 0; ; attempt += 1) {
    try {
      json = await fetchJson<OpenMeteoLocation[] | OpenMeteoLocation>(url, {
        timeoutMs: 25_000,
        retries: 0,
        signal,
      })
      break
    } catch (error) {
      // The free endpoint sometimes answers 404/429 under burst load. Those
      // are transient for a well-formed request, so back off and retry this
      // chunk rather than dropping the whole wind field.
      const status = error instanceof HttpError ? error.status : undefined
      const transient =
        status === 429 || status === 404 || (status !== undefined && status >= 500)
      if (!transient || attempt >= 3 || signal?.aborted) throw error
      const wait = 1_000 * (attempt + 1)
      await new Promise((resolve) => setTimeout(resolve, wait))
    }
  }

  const locations = Array.isArray(json) ? json : [json]
  const samples: WindSample[] = []
  for (const location of locations) {
    if (!location.hourly) continue
    const noon = pickNoon(location.hourly, date)
    if (!noon) continue
    const { u, v } = windComponents(noon.speed, noon.direction)
    samples.push({
      lat: location.latitude,
      lon: location.longitude,
      u,
      v,
      speed: noon.speed,
    })
  }
  return samples
}

async function mapLimited<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
  signal?: AbortSignal,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next
      next += 1
      if (index >= items.length) return
      try {
        results[index] = await task(items[index])
      } catch (error) {
        // A single failed chunk should not blank the whole globe. Keep the
        // samples we have and let the caller decide whether there are enough.
        if (signal?.aborted) throw error
        results[index] = [] as unknown as R
      }
    }
  })
  await Promise.all(workers)
  return results
}

async function fetchAtResolution(
  base: string,
  step: number,
  date: string,
  signal?: AbortSignal,
): Promise<WindSample[]> {
  const lats = step === 15 ? LATS : LATS.filter((_, i) => i % 2 === 0)
  const lons = step === 15 ? LONS : LONS.filter((_, i) => i % 2 === 0)
  const points = buildGrid(lats, lons)
  const chunks: Array<Array<{ lat: number; lon: number }>> = []
  for (let i = 0; i < points.length; i += CHUNK) chunks.push(points.slice(i, i + CHUNK))

  const results = await mapLimited(chunks, CONCURRENCY, (chunk) =>
    requestChunk(base, chunk, date, signal),
    signal,
  )
  return results.flat()
}

/**
 * Real 10 m wind vectors for a specific date at 12:00 UTC.
 *
 * Recent dates use the forecast API (which also serves recent history); older
 * dates use the ERA5 archive. The UI always displays which mode and hour was
 * used, so the animation is never mistaken for a live measurement of a past
 * date.
 */
export async function fetchWindField(date: string, signal?: AbortSignal): Promise<WindField> {
  const recentCutoff = addDays(todayISO(), -7)
  const mode: WindField['mode'] = date >= recentCutoff ? 'forecast' : 'archive'
  const base = mode === 'forecast' ? FORECAST_BASE : ARCHIVE_BASE
  const key = `wind:${mode}:${date}`

  return cached(key, mode === 'forecast' ? 30 * 60 * 1000 : 14 * 24 * 60 * 60 * 1000, async () => {
    let samples = await fetchAtResolution(base, 15, date, signal)
    let stepDeg = 15
    if (samples.length < 40) {
      samples = await fetchAtResolution(base, 30, date, signal)
      stepDeg = 30
    }
    if (samples.length < 12) {
      throw new Error('Wind vectors are unavailable for this date.')
    }
    return {
      samples,
      stepDeg,
      validTime: `${date}T12:00Z`,
      mode,
      attribution:
        mode === 'forecast'
          ? '10 m wind vectors: NOAA GFS/ECMWF blend via Open-Meteo (forecast/recent)'
          : '10 m wind vectors: ERA5 reanalysis via Open-Meteo (archive)',
      fetchedAt: Date.now(),
    }
  })
}
