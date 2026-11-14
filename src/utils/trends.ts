import type { AnomalyResult, PowerMonth, PowerVariableId, TrendResult } from '../types'
import { daysInMonth } from './date'

export type Aggregation = 'mean' | 'sum'
export type Season = 'annual' | 'DJF' | 'MAM' | 'JJA' | 'SON'

export interface AnnualPoint {
  year: number
  value: number
  monthsUsed: number
}

const MIN_MONTHS = 9
const MIN_YEARS_FOR_TREND = 10

/** Standard normal CDF via the Abramowitz–Stegun erf approximation (|ε| < 1.5e-7). */
export function normalCdf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * ax)
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax)
  return 0.5 * (1 + sign * y)
}

/** Acklam's inverse normal CDF (relative error < 1.15e-9). */
export function inverseNormalCdf(p: number): number {
  if (p <= 0) return Number.NEGATIVE_INFINITY
  if (p >= 1) return Number.POSITIVE_INFINITY
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239]
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572]
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416]
  const plow = 0.02425
  const phigh = 1 - plow

  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    )
  }
  if (p > phigh) {
    const q = Math.sqrt(-2 * Math.log(1 - p))
    return -(
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    )
  }
  const q = p - 0.5
  const r = q * q
  return (
    ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  )
}

export interface MannKendall {
  n: number
  s: number
  varianceS: number
  z: number
  p: number
  tau: number
  alpha: number
  significant: boolean
}

/**
 * Two-sided Mann–Kendall trend test with tie correction and continuity
 * correction. Returns null when fewer than three observations are available.
 */
export function mannKendall(values: number[], alpha = 0.05): MannKendall | null {
  const clean = values.filter((v) => Number.isFinite(v))
  const n = clean.length
  if (n < 3) return null

  let s = 0
  for (let i = 0; i < n - 1; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      s += Math.sign(clean[j] - clean[i])
    }
  }

  const counts = new Map<number, number>()
  for (const v of clean) counts.set(v, (counts.get(v) ?? 0) + 1)
  let tieTerm = 0
  for (const t of counts.values()) {
    if (t > 1) tieTerm += t * (t - 1) * (2 * t + 5)
  }

  const varianceS = (n * (n - 1) * (2 * n + 5) - tieTerm) / 18
  let z = 0
  if (varianceS > 0) {
    if (s > 0) z = (s - 1) / Math.sqrt(varianceS)
    else if (s < 0) z = (s + 1) / Math.sqrt(varianceS)
  }
  const p = Math.min(1, 2 * (1 - normalCdf(Math.abs(z))))
  const pairs = (n * (n - 1)) / 2

  return {
    n,
    s,
    varianceS,
    z,
    p,
    tau: pairs > 0 ? s / pairs : 0,
    alpha,
    significant: p < alpha,
  }
}

export interface SensSlopeResult {
  slopePerYear: number
  intercept: number
  ci: [number, number] | null
  pairCount: number
}

/**
 * Sen's slope estimator (median of pairwise slopes) with the Gilbert
 * rank-based confidence interval. `varianceS` should come from the
 * Mann–Kendall test on the same sample so ties are accounted for.
 */
export function sensSlope(
  points: Array<{ x: number; y: number }>,
  varianceS?: number,
  alpha = 0.05,
): SensSlopeResult | null {
  const clean = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
  if (clean.length < 3) return null

  const slopes: number[] = []
  for (let i = 0; i < clean.length - 1; i += 1) {
    for (let j = i + 1; j < clean.length; j += 1) {
      const dx = clean[j].x - clean[i].x
      if (dx !== 0) slopes.push((clean[j].y - clean[i].y) / dx)
    }
  }
  if (!slopes.length) return null
  slopes.sort((a, b) => a - b)

  const median = quantileSorted(slopes, 0.5)
  const meanX = clean.reduce((sum, p) => sum + p.x, 0) / clean.length
  const meanY = clean.reduce((sum, p) => sum + p.y, 0) / clean.length
  const intercept = meanY - median * meanX

  let ci: [number, number] | null = null
  if (varianceS !== undefined && varianceS > 0 && slopes.length > 2) {
    const zCrit = inverseNormalCdf(1 - alpha / 2)
    const c = zCrit * Math.sqrt(varianceS)
    const n = slopes.length
    const m1 = (n - c) / 2
    const m2 = (n + c) / 2 + 1
    if (m1 >= 1 && m2 <= n) {
      ci = [quantileSorted(slopes, (m1 - 1) / (n - 1)), quantileSorted(slopes, (m2 - 1) / (n - 1))]
    }
  }

  return { slopePerYear: median, intercept, ci, pairCount: slopes.length }
}

function quantileSorted(sorted: number[], q: number): number {
  if (sorted.length === 1) return sorted[0]
  const pos = (sorted.length - 1) * Math.min(1, Math.max(0, q))
  const base = Math.floor(pos)
  const rest = pos - base
  if (sorted[base + 1] !== undefined) return sorted[base] + rest * (sorted[base + 1] - sorted[base])
  return sorted[base]
}

/**
 * Builds one value per calendar year, requiring at least 9 available months
 * (POWER uses -999 for missing values, mapped to null upstream).
 */
export function buildAnnualSeries(months: PowerMonth[], aggregation: Aggregation): AnnualPoint[] {
  const byYear = new Map<number, PowerMonth[]>()
  for (const m of months) {
    if (m.month < 1 || m.month > 12) continue
    const list = byYear.get(m.year) ?? []
    list.push(m)
    byYear.set(m.year, list)
  }

  const out: AnnualPoint[] = []
  for (const [year, list] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
    const available = list.filter((m) => m.value !== null && Number.isFinite(m.value))
    if (available.length < MIN_MONTHS) continue
    const value =
      aggregation === 'mean'
        ? available.reduce((sum, m) => sum + (m.value as number), 0) / available.length
        : available.reduce((sum, m) => sum + (m.value as number) * daysInMonth(year, m.month), 0)
    out.push({ year, value, monthsUsed: available.length })
  }
  return out
}

/** Season aggregation; DJF for year Y uses Dec(Y-1), Jan(Y) and Feb(Y). */
export function buildSeasonalSeries(
  months: PowerMonth[],
  aggregation: Aggregation,
  season: Season,
): AnnualPoint[] {
  if (season === 'annual') return buildAnnualSeries(months, aggregation)

  const lookup = new Map<string, number>()
  for (const m of months) {
    if (m.value !== null && Number.isFinite(m.value)) lookup.set(`${m.year}-${m.month}`, m.value)
  }

  const seasonMonths: Record<Exclude<Season, 'annual'>, number[]> = {
    DJF: [12, 1, 2],
    MAM: [3, 4, 5],
    JJA: [6, 7, 8],
    SON: [9, 10, 11],
  }
  const wanted = seasonMonths[season]

  const years = [...new Set(months.filter((m) => m.month >= 1 && m.month <= 12).map((m) => m.year))].sort()
  const out: AnnualPoint[] = []

  for (const year of years) {
    const values: Array<{ value: number; days: number }> = []
    for (const month of wanted) {
      const sourceYear = season === 'DJF' && month === 12 ? year - 1 : year
      const v = lookup.get(`${sourceYear}-${month}`)
      if (v !== undefined) values.push({ value: v, days: daysInMonth(sourceYear, month) })
    }
    if (season === 'DJF' && !values.some((v) => v.days >= 31)) continue
    if (values.length < wanted.length) continue
    const value =
      aggregation === 'mean'
        ? values.reduce((sum, v) => sum + v.value, 0) / values.length
        : values.reduce((sum, v) => sum + v.value * v.days, 0)
    out.push({ year, value, monthsUsed: values.length })
  }
  return out
}

const RATIO_SCALED: PowerVariableId[] = ['PRECTOTCORR', 'WS2M']

export interface TrendInput {
  annual: AnnualPoint[]
  variable: PowerVariableId
  label: string
  units: string
  aggregation: Aggregation
  alpha?: number
}

/**
 * Computes a full trend assessment. The p-value always comes from a real
 * Mann–Kendall test on the available annual values — never assumed.
 */
export function computeTrend({ annual, variable, label, units, aggregation, alpha = 0.05 }: TrendInput): TrendResult | null {
  if (annual.length < 3) return null

  const sorted = [...annual].sort((a, b) => a.year - b.year)
  const values = sorted.map((p) => p.value)
  const mk = mannKendall(values, alpha)
  if (!mk) return null
  const sen = sensSlope(
    sorted.map((p) => ({ x: p.year, y: p.value })),
    mk.varianceS,
    alpha,
  )
  if (!sen) return null

  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const span = last.year - first.year
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  const changeOverPeriod = sen.slopePerYear * span
  const notes: string[] = []

  if (sorted.length < MIN_YEARS_FOR_TREND) {
    notes.push(
      `Only ${sorted.length} complete years are available — fewer than the ${MIN_YEARS_FOR_TREND} years we require before treating a trend as reliable.`,
    )
  }
  const expected = span + 1
  const completeness = expected > 0 ? sorted.length / expected : 0
  if (completeness < 0.8) {
    notes.push(`${Math.round((1 - completeness) * 100)}% of years in this record are missing or incomplete.`)
  }
  if (aggregation === 'sum' && sorted.some((p) => p.monthsUsed < 12)) {
    notes.push('Some annual totals are built from fewer than 12 months; totals are therefore conservative.')
  }

  const reliable = sorted.length >= MIN_YEARS_FOR_TREND
  const significant = mk.p < alpha && reliable && Math.sign(sen.slopePerYear) !== 0
  const direction = !sen || sen.slopePerYear === 0 ? 'none' : sen.slopePerYear > 0 ? 'increasing' : 'decreasing'

  return {
    variable,
    label,
    units,
    startYear: first.year,
    endYear: last.year,
    observations: sorted.length,
    expected,
    completeness,
    mannKendallZ: mk.z,
    pValue: mk.p,
    tau: mk.tau,
    slopePerYear: sen.slopePerYear,
    slopePerDecade: sen.slopePerYear * 10,
    slopeCi: sen.ci,
    slopeCiPerDecade: sen.ci ? [sen.ci[0] * 10, sen.ci[1] * 10] : null,
    direction: significant ? direction : 'none',
    significant,
    alpha,
    changeOverPeriod,
    percentChange:
      mean !== 0 && RATIO_SCALED.includes(variable) ? (changeOverPeriod / mean) * 100 : null,
    series: sorted.map((p) => ({
      year: p.year,
      value: p.value,
      fitted: sen.intercept + sen.slopePerYear * p.year,
    })),
    notes,
  }
}

/** Monthly climatology over an inclusive baseline period. */
export function monthlyClimatology(
  months: PowerMonth[],
  startYear: number,
  endYear: number,
): Array<{ month: number; value: number; n: number }> {
  const out: Array<{ month: number; value: number; n: number }> = []
  for (let month = 1; month <= 12; month += 1) {
    const values = months
      .filter(
        (m) =>
          m.month === month &&
          m.year >= startYear &&
          m.year <= endYear &&
          m.value !== null &&
          Number.isFinite(m.value),
      )
      .map((m) => m.value as number)
    out.push({
      month,
      value: values.length ? values.reduce((a, b) => a + b, 0) / values.length : Number.NaN,
      n: values.length,
    })
  }
  return out
}

/**
 * Z-score anomaly of one month against the same calendar month in a baseline.
 * Requires at least 15 baseline years; never reports an anomaly from thin data.
 */
export function computeAnomaly(
  months: PowerMonth[],
  year: number,
  month: number,
  baselineStart = 1991,
  baselineEnd = 2020,
): AnomalyResult | null {
  const target = months.find((m) => m.year === year && m.month === month)
  if (!target || target.value === null || !Number.isFinite(target.value)) return null

  const baseline = months
    .filter(
      (m) =>
        m.month === month &&
        m.year >= baselineStart &&
        m.year <= baselineEnd &&
        m.value !== null &&
        Number.isFinite(m.value),
    )
    .map((m) => m.value as number)

  if (baseline.length < 15) return null
  const mean = baseline.reduce((a, b) => a + b, 0) / baseline.length
  const variance = baseline.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (baseline.length - 1)
  const sd = Math.sqrt(variance)
  if (!(sd > 0)) return null

  const zScore = ((target.value as number) - mean) / sd
  const classification: AnomalyResult['classification'] =
    zScore >= 2
      ? 'well above average'
      : zScore >= 0.75
        ? 'above average'
        : zScore <= -2
          ? 'well below average'
          : zScore <= -0.75
            ? 'below average'
            : 'near average'

  return {
    year,
    month,
    value: target.value as number,
    baselineMean: mean,
    baselineSd: sd,
    baselineCount: baseline.length,
    zScore,
    classification,
  }
}
