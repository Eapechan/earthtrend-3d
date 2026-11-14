import { describe, expect, it } from 'vitest'
import { assessResolution, pointCellNote, renderedPixelKm } from './resolution'
import { PLACE_BY_ID } from '../data/locations'

const chengannur = PLACE_BY_ID.get('chengannur')!
const kerala = PLACE_BY_ID.get('kerala')!

describe('spatial resolution honesty', () => {
  it('flags a town smaller than an AIRS 1° cell as sub-cell', () => {
    const result = assessResolution(chengannur, 110, 6)
    expect(result.verdict).toBe('sub-cell')
    expect(result.cellsAcross).toBeLessThan(0.1)
    expect(result.detail).toMatch(/cannot resolve neighbourhoods/)
    expect(result.detail).toMatch(/regional grid cell/)
  })

  it('treats a state larger than a POWER cell as resolvable', () => {
    const result = assessResolution(kerala, 60, 6)
    expect(result.verdict).toBe('resolved')
    expect(result.cellsAcross).toBeGreaterThan(2.5)
  })

  it('reports the real rendered GIBS pixel size', () => {
    expect(renderedPixelKm(6)).toBeCloseTo(2.44, 1)
    expect(renderedPixelKm(7)).toBeCloseTo(1.22, 1)
  })

  it('warns that point APIs return a grid cell, not a station', () => {
    expect(pointCellNote(60)).toMatch(/grid cell/)
    expect(pointCellNote(60)).toMatch(/not a measurement/)
  })
})
