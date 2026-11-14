import type { PowerMonth, PowerVariableId } from '../../types'
import { fetchJson } from '../http'
import { cached } from '../cache'

const POWER_BASE = 'https://power.larc.nasa.gov/api/temporal'

export interface PowerBundle {
  startYear: number
  endYear: number
  sourceLat: number
  sourceLon: number
  fetchedAt: number
  series: Record<PowerVariableId, PowerMonth[]>
}

interface PowerResponse {
  properties?: {
    parameter?: Record<string, Record<string, number>>
  }
  header?: { fill_value?: number }
  messages?: string[]
}

const ALL_PARAMS: PowerVariableId[] = ['T2M', 'PRECTOTCORR', 'WS2M', 'RH2M']
const FILL = -999

function parseParameter(raw: Record<string, number> | undefined): PowerMonth[] {
  if (!raw) return []
  const out: PowerMonth[] = []
  for (const [key, value] of Object.entries(raw)) {
    const match = /^(\d{4})(\d{2})$/.exec(key)
    if (!match) continue
    const year = Number(match[1])
    const month = Number(match[2])
    // POWER includes month 13 as an annual aggregate; we build annual values
    // ourselves so that month lengths and completeness are handled explicitly.
    if (month < 1 || month > 12) continue
    out.push({
      year,
      month,
      value: value === FILL || !Number.isFinite(value) ? null : value,
    })
  }
  return out.sort((a, b) => a.year - b.year || a.month - b.month)
}

/** Monthly POWER series for a point, with a 30-year window by default. */
export async function fetchPowerBundle(
  lat: number,
  lon: number,
  startYear = 1991,
  endYear = new Date().getUTCFullYear(),
  signal?: AbortSignal,
): Promise<PowerBundle> {
  const key = `power:monthly:${lat.toFixed(3)}:${lon.toFixed(3)}:${startYear}:${endYear}`
  return cached(key, 6 * 60 * 60 * 1000, async () => {
    const url =
      `${POWER_BASE}/monthly/point?parameters=${ALL_PARAMS.join(',')}` +
      `&community=AG&longitude=${lon}&latitude=${lat}` +
      `&start=${startYear}&end=${endYear}&format=JSON`
    const json = await fetchJson<PowerResponse>(url, { timeoutMs: 25_000, retries: 2, signal })
    const params = json.properties?.parameter
    if (!params) throw new Error('NASA POWER returned no parameters for this point.')

    const series = Object.fromEntries(ALL_PARAMS.map((p) => [p, parseParameter(params[p])])) as Record<
      PowerVariableId,
      PowerMonth[]
    >

    if (!series.T2M.length) {
      throw new Error('NASA POWER has no monthly data at this location.')
    }

    return {
      startYear,
      endYear,
      sourceLat: lat,
      sourceLon: lon,
      fetchedAt: Date.now(),
      series,
    }
  })
}

export interface PowerDailyValue {
  date: string
  values: Partial<Record<PowerVariableId | 'WD2M' | 'T2M_MAX' | 'T2M_MIN', number | null>>
}

export interface PowerDailyWindow {
  startDate: string
  endDate: string
  sourceLat: number
  sourceLon: number
  byDate: Record<string, PowerDailyValue>
  fetchedAt: number
}

const DAILY_PARAMS = ['T2M', 'T2M_MAX', 'T2M_MIN', 'PRECTOTCORR', 'WS2M', 'WD2M', 'RH2M'] as const

function toPowerDate(iso: string): string {
  return iso.replaceAll('-', '')
}

function fromPowerDate(raw: string): string {
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
}

/**
 * Daily POWER values for a short window ending at `endDate`. POWER lags a few
 * days behind real time, so callers resolve the nearest available day instead
 * of implying that today's value exists.
 */
export async function fetchPowerDailyWindow(
  lat: number,
  lon: number,
  endDate: string,
  days = 12,
  signal?: AbortSignal,
): Promise<PowerDailyWindow> {
  const end = new Date(`${endDate}T00:00:00Z`)
  const start = new Date(end.getTime() - (days - 1) * 86_400_000)
  const startISO = start.toISOString().slice(0, 10)
  const key = `power:daily:${lat.toFixed(3)}:${lon.toFixed(3)}:${startISO}:${endDate}`

  return cached(key, 60 * 60 * 1000, async () => {
    const url =
      `${POWER_BASE}/daily/point?parameters=${DAILY_PARAMS.join(',')}` +
      `&community=AG&longitude=${lon}&latitude=${lat}` +
      `&start=${toPowerDate(startISO)}&end=${toPowerDate(endDate)}&format=JSON`
    const json = await fetchJson<PowerResponse>(url, { timeoutMs: 25_000, retries: 1, signal })
    const params = json.properties?.parameter
    if (!params) throw new Error('NASA POWER returned no daily parameters.')

    const dates = new Set<string>()
    for (const param of DAILY_PARAMS) {
      for (const raw of Object.keys(params[param] ?? {})) dates.add(raw)
    }

    const byDate: Record<string, PowerDailyValue> = {}
    for (const raw of [...dates].sort()) {
      const date = fromPowerDate(raw)
      const values: PowerDailyValue['values'] = {}
      for (const param of DAILY_PARAMS) {
        const v = params[param]?.[raw]
        values[param] = v === undefined || v === FILL || !Number.isFinite(v) ? null : v
      }
      byDate[date] = { date, values }
    }

    return {
      startDate: startISO,
      endDate,
      sourceLat: lat,
      sourceLon: lon,
      byDate,
      fetchedAt: Date.now(),
    }
  })
}

/** Latest day at or before `endDate` that actually contains a value. */
export function nearestDailyValue(
  window: PowerDailyWindow | null,
  endDate: string,
  param: keyof PowerDailyValue['values'],
): PowerDailyValue | null {
  if (!window) return null
  const dates = Object.keys(window.byDate)
    .filter((d) => d <= endDate)
    .sort()
    .reverse()
  for (const date of dates) {
    const entry = window.byDate[date]
    const value = entry.values[param]
    if (value !== null && value !== undefined) return entry
  }
  return null
}
