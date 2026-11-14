export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function formatNumber(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return round(value, decimals).toFixed(decimals)
}

export function formatSigned(value: number, decimals = 2): string {
  if (Number.isNaN(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${round(value, decimals).toFixed(decimals)}`
}

export function formatCompact(value: number, decimals = 1): string {
  const abs = Math.abs(value)
  if (abs >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
  return formatNumber(value, decimals)
}

/** Compass bearing (degrees, meteorological) to a 16-point label. */
export function bearingToCompass(degrees: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return dirs[Math.round(((degrees % 360) + 360) % 360 / 22.5) % 16]
}

/**
 * Formats a p-value honestly: never claims more precision than the normal
 * approximation of the Mann–Kendall test supports.
 */
export function formatP(p: number): string {
  if (!Number.isFinite(p)) return '—'
  if (p < 0.001) return '< 0.001'
  if (p < 0.01) return p.toFixed(3)
  return p.toFixed(2)
}
