import type { Cadence } from '../types'

const MS_PER_DAY = 86_400_000

/** Current UTC date at midnight, as an ISO yyyy-mm-dd string. */
export function todayISO(): string {
  return toISO(new Date())
}

export function toISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
}

export function addDays(iso: string, days: number): string {
  return toISO(new Date(parseISO(iso).getTime() + days * MS_PER_DAY))
}

export function addMonths(iso: string, months: number): string {
  const date = parseISO(iso)
  const day = date.getUTCDate()
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
  const maxDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, maxDay))
  return toISO(target)
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

export function endOfMonth(iso: string): string {
  const date = parseISO(iso)
  return toISO(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)))
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function clampISO(iso: string, min: string, max: string): string {
  if (iso < min) return min
  if (iso > max) return max
  return iso
}

/**
 * Snaps a date to the cadence of an imagery product.
 * Monthly products publish on the first of the month; daily products keep the day.
 */
export function snapToCadence(iso: string, cadence: Cadence): string {
  if (cadence === 'monthly') return startOfMonth(iso)
  return iso
}

/** Latest date we consider available for near-real-time NASA imagery (UTC). */
export function latestImageryDate(daysBehind = 1): string {
  return addDays(todayISO(), -daysBehind)
}

export function formatDateLong(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parseISO(iso))
}

export function formatMonthYear(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parseISO(iso))
}

export function formatYearMonth(year: number, month: number): string {
  return new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  )
}

/** Fractional position (0..1) of a date within a range, for the timeline slider. */
export function dateFraction(iso: string, start: string, end: string): number {
  if (start === end) return 1
  const t = parseISO(iso).getTime()
  const a = parseISO(start).getTime()
  const b = parseISO(end).getTime()
  return Math.min(1, Math.max(0, (t - a) / (b - a)))
}

/** Maps a 0..1 slider position back to a spaced date between start and end. */
export function fractionToDate(fraction: number, start: string, end: string): string {
  const a = parseISO(start).getTime()
  const b = parseISO(end).getTime()
  return toISO(new Date(a + (b - a) * Math.min(1, Math.max(0, fraction))))
}

export function yearsBetween(startISO: string, endISO: string): number {
  return (parseISO(endISO).getTime() - parseISO(startISO).getTime()) / (365.25 * MS_PER_DAY)
}

export function isFuture(iso: string): boolean {
  return iso > todayISO()
}
