import { describe, expect, it } from 'vitest'
import {
  buildAnnualSeries,
  buildSeasonalSeries,
  computeAnomaly,
  computeTrend,
  mannKendall,
  monthlyClimatology,
  sensSlope,
} from './trends'
import type { PowerMonth } from '../types'

function yearOfMonths(year: number, value: number | null, fillAll = true): PowerMonth[] {
  const months: PowerMonth[] = []
  for (let month = 1; month <= 12; month += 1) {
    if (!fillAll && month > 8) continue
    months.push({ year, month, value })
  }
  return months
}

describe('Mann–Kendall', () => {
  it('detects a strong monotonic increase', () => {
    const result = mannKendall(Array.from({ length: 30 }, (_, i) => i + 1))
    expect(result).not.toBeNull()
    expect(result?.s).toBe(435)
    expect(result?.z).toBeGreaterThan(5)
    expect(result?.p).toBeLessThan(0.001)
    expect(result?.significant).toBe(true)
  })

  it('does not flag pure noise as significant', () => {
    const result = mannKendall([3, 1, 4, 1, 5, 9, 2, 6, 5, 3])
    expect(result).not.toBeNull()
    expect(result?.significant).toBe(false)
  })

  it('returns null with fewer than three observations', () => {
    expect(mannKendall([1, 2])).toBeNull()
  })
})

describe("Sen's slope", () => {
  it('recovers an exact linear slope and produces a confidence interval', () => {
    const points = Array.from({ length: 20 }, (_, i) => ({ x: 2000 + i, y: 5 + 2 * i }))
    const mk = mannKendall(points.map((p) => p.y))
    const result = sensSlope(points, mk?.varianceS)
    expect(result?.slopePerYear).toBeCloseTo(2, 10)
    expect(result?.ci).not.toBeNull()
    expect(result?.ci?.[0]).toBeCloseTo(2, 8)
    expect(result?.ci?.[1]).toBeCloseTo(2, 8)
  })

  it('returns null for degenerate input', () => {
    expect(sensSlope([])).toBeNull()
  })
})

describe('annual aggregation with missing data', () => {
  it('excludes years with fewer than 9 months', () => {
    const months = [
      ...yearOfMonths(2000, 10),
      ...yearOfMonths(2001, 20, false),
      ...yearOfMonths(2002, 30),
    ]
    const annual = buildAnnualSeries(months, 'mean')
    expect(annual.map((p) => p.year)).toEqual([2000, 2002])
    expect(annual[0].value).toBeCloseTo(10, 10)
  })

  it('ignores null months when computing means', () => {
    const months = yearOfMonths(2005, 10)
    months[0].value = null
    const annual = buildAnnualSeries(months, 'mean')
    expect(annual).toHaveLength(1)
    expect(annual[0].value).toBeCloseTo(10, 10)
    expect(annual[0].monthsUsed).toBe(11)
  })

  it('weights precipitation totals by real month length', () => {
    const months: PowerMonth[] = Array.from({ length: 12 }, (_, i) => ({
      year: 2021,
      month: i + 1,
      value: 1,
    }))
    const annual = buildAnnualSeries(months, 'sum')
    expect(annual[0].value).toBeCloseTo(365, 10)
  })
})

describe('seasonal aggregation', () => {
  it('pulls December from the previous year for DJF', () => {
    const months: PowerMonth[] = []
    for (const year of [2000, 2001]) {
      for (let month = 1; month <= 12; month += 1) {
        months.push({ year, month, value: year + month / 100 })
      }
    }
    const djf = buildSeasonalSeries(months, 'mean', 'DJF')
    // DJF 2001 = Dec 2000 + Jan 2001 + Feb 2001
    const expected = ((2000 + 0.12) + (2001 + 0.01) + (2001 + 0.02)) / 3
    expect(djf.find((p) => p.year === 2001)?.value).toBeCloseTo(expected, 10)
  })

  it('requires all three months for a seasonal value', () => {
    const months: PowerMonth[] = [
      { year: 2010, month: 6, value: 1 },
      { year: 2010, month: 7, value: 1 },
    ]
    expect(buildSeasonalSeries(months, 'mean', 'JJA')).toHaveLength(0)
  })
})

describe('trend assessment', () => {
  it('finds a significant warming trend and reports its interval', () => {
    const months: PowerMonth[] = []
    for (let year = 1991; year <= 2020; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        months.push({ year, month, value: 20 + (year - 1991) * 0.03 + Math.sin(month) * 0.15 })
      }
    }
    const annual = buildAnnualSeries(months, 'mean')
    const trend = computeTrend({
      annual,
      variable: 'T2M',
      label: 'Air temperature',
      units: '°C/decade',
      aggregation: 'mean',
    })
    expect(trend).not.toBeNull()
    expect(trend?.observations).toBe(30)
    expect(trend?.significant).toBe(true)
    expect(trend?.slopePerDecade).toBeCloseTo(0.3, 1)
    expect(trend?.slopeCiPerDecade).not.toBeNull()
    expect(trend?.direction).toBe('increasing')
    expect(trend?.percentChange).toBeNull()
  })

  it('refuses to label a trend from too few years', () => {
    const months: PowerMonth[] = []
    for (let year = 2015; year <= 2019; year += 1) months.push(...yearOfMonths(year, 10 + year))
    const annual = buildAnnualSeries(months, 'mean')
    const trend = computeTrend({
      annual,
      variable: 'T2M',
      label: 'Air temperature',
      units: '°C/decade',
      aggregation: 'mean',
    })
    expect(trend?.significant).toBe(false)
    expect(trend?.notes.join(' ')).toMatch(/fewer than the 10 years/)
  })

  it('does not claim significance from missing-heavy records', () => {
    const months: PowerMonth[] = [
      ...yearOfMonths(2000, 1),
      ...yearOfMonths(2006, 2),
      ...yearOfMonths(2012, 3),
      ...yearOfMonths(2018, 4),
    ]
    const annual = buildAnnualSeries(months, 'mean')
    const trend = computeTrend({
      annual,
      variable: 'T2M',
      label: 'Air temperature',
      units: '°C/decade',
      aggregation: 'mean',
    })
    if (trend) expect(trend.significant).toBe(false)
  })
})

describe('climatology and anomalies', () => {
  it('builds a 12-month climatology', () => {
    const months: PowerMonth[] = []
    for (const year of [1991, 1992, 1993]) {
      for (let month = 1; month <= 12; month += 1) months.push({ year, month, value: month })
    }
    const climatology = monthlyClimatology(months, 1991, 1993)
    expect(climatology).toHaveLength(12)
    expect(climatology[6].value).toBe(7)
    expect(climatology[0].n).toBe(3)
  })

  it('detects a well-above-average month against a full baseline', () => {
    const months: PowerMonth[] = []
    for (let year = 1991; year <= 2020; year += 1) {
      months.push({ year, month: 7, value: 25 + (year % 5) * 0.2 })
    }
    months.push({ year: 2025, month: 7, value: 30 })
    const anomaly = computeAnomaly(months, 2025, 7)
    expect(anomaly).not.toBeNull()
    expect(anomaly?.zScore).toBeGreaterThan(2)
    expect(anomaly?.classification).toBe('well above average')
    expect(anomaly?.baselineCount).toBe(30)
  })

  it('will not report an anomaly from a thin baseline', () => {
    const months: PowerMonth[] = [
      { year: 2015, month: 7, value: 25 },
      { year: 2016, month: 7, value: 25.2 },
      { year: 2025, month: 7, value: 30 },
    ]
    expect(computeAnomaly(months, 2025, 7)).toBeNull()
  })
})
