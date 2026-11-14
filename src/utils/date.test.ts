import { describe, expect, it } from 'vitest'
import { addDays, addMonths, dateFraction, fractionToDate, snapToCadence, startOfMonth } from './date'

describe('date arithmetic', () => {
  it('snaps monthly products to the first of the month', () => {
    expect(snapToCadence('2024-03-17', 'monthly')).toBe('2024-03-01')
    expect(snapToCadence('2024-03-17', 'daily')).toBe('2024-03-17')
    expect(startOfMonth('2024-12-31')).toBe('2024-12-01')
  })

  it('clamps month addition to the last valid day', () => {
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
    expect(addMonths('2023-01-31', 1)).toBe('2023-02-28')
    expect(addMonths('2024-03-31', -1)).toBe('2024-02-29')
  })

  it('adds days across month and year boundaries', () => {
    expect(addDays('2024-12-31', 1)).toBe('2025-01-01')
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29')
  })

  it('round-trips slider fractions', () => {
    expect(dateFraction('2020-07-01', '2020-01-01', '2021-01-01')).toBeCloseTo(0.5, 1)
    expect(fractionToDate(0, '2000-01-01', '2010-01-01')).toBe('2000-01-01')
    expect(fractionToDate(1, '2000-01-01', '2010-01-01')).toBe('2010-01-01')
    const mid = fractionToDate(0.5, '2000-01-01', '2010-01-01')
    expect(mid >= '2004-12-31' && mid <= '2005-01-03').toBe(true)
  })
})
