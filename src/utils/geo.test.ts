import { describe, expect, it } from 'vitest'
import type { GeoCountry, GeoDivision, GeoGeometry } from '../services/geo/types'
import {
  altitudeToViewLevel,
  bboxContains,
  bboxSpanKm,
  findCountryAt,
  findDivisionAt,
  geometryContains,
  kindForAdminType,
  placeForGeoPoint,
  placeFromCountry,
  placeFromDivision,
  placeFromHierarchyItem,
  placeFromSearchEntry,
  resolveLabelCollisions,
  ringContains,
  viewLevelToAdminLevel,
  type LabelRect,
} from './geo'

function polygon(ring: number[][]): GeoGeometry {
  return { type: 'Polygon', coordinates: [ring] as never }
}

const SQUARE = polygon([
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
  [0, 0],
])

const HOLE = polygon([
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
  [0, 0],
])

// Add a hole ring to HOLE's coordinates.
;(HOLE.coordinates as number[][][]).push([
  [4, 4],
  [6, 4],
  [6, 6],
  [4, 6],
  [4, 4],
])

const country: GeoCountry = {
  id: 'TST',
  iso3: 'TST',
  iso2: 'TS',
  name: 'Testland',
  formal: 'Republic of Testland',
  continent: 'Asia',
  region: 'Southern Asia',
  label: [5, 5],
  bbox: [0, 0, 10, 10],
  population: 12_000_000,
  geometry: SQUARE,
}

const division: GeoDivision = {
  id: 'TS-01',
  name: 'North Province',
  local: null,
  type: 'Province',
  region: null,
  label: [3, 7],
  bbox: [0, 5, 10, 10],
  geometry: SQUARE,
}

describe('bounding boxes and point-in-polygon', () => {
  it('checks simple boxes', () => {
    expect(bboxContains([0, 0, 10, 10], 5, 5)).toBe(true)
    expect(bboxContains([0, 0, 10, 10], 11, 5)).toBe(false)
    expect(bboxContains([0, 0, 10, 10], 5, -1)).toBe(false)
  })

  it('treats world-width boxes as covering every longitude', () => {
    expect(bboxContains([-180, 40, 180, 80], 179.9, 60)).toBe(true)
    expect(bboxContains([-180, 40, 180, 80], -179.9, 60)).toBe(true)
    expect(bboxContains([-180, 40, 180, 80], 0, 20)).toBe(false)
  })

  it('ray-casts a square ring', () => {
    const ring = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ]
    expect(ringContains(ring, 5, 5)).toBe(true)
    expect(ringContains(ring, 15, 5)).toBe(false)
    expect(ringContains(ring, -1, 5)).toBe(false)
  })

  it('respects holes inside a polygon', () => {
    expect(geometryContains(HOLE, 2, 2)).toBe(true)
    expect(geometryContains(HOLE, 5, 5)).toBe(false)
    expect(geometryContains(HOLE, 12, 5)).toBe(false)
  })

  it('finds the containing feature and returns null outside coverage', () => {
    expect(findCountryAt([country], 5, 5)?.iso3).toBe('TST')
    expect(findCountryAt([country], 50, 50)).toBeNull()
  })

  it('returns null when a level has no features (missing coverage)', () => {
    expect(findDivisionAt([], 5, 5)).toBeNull()
  })
})

describe('camera altitude → administrative level', () => {
  it('maps the documented thresholds', () => {
    expect(altitudeToViewLevel(40_000_000)).toBe('global')
    expect(altitudeToViewLevel(8_000_000)).toBe('global')
    expect(altitudeToViewLevel(7_999_999)).toBe('country')
    expect(altitudeToViewLevel(1_500_000)).toBe('country')
    expect(altitudeToViewLevel(1_499_999)).toBe('state')
    expect(altitudeToViewLevel(300_000)).toBe('state')
    expect(altitudeToViewLevel(299_999)).toBe('local')
    expect(altitudeToViewLevel(Number.NaN)).toBe('global')
  })

  it('maps view levels onto admin levels', () => {
    expect(viewLevelToAdminLevel('global')).toBe(0)
    expect(viewLevelToAdminLevel('country')).toBe(1)
    expect(viewLevelToAdminLevel('state')).toBe(2)
    expect(viewLevelToAdminLevel('local')).toBe(3)
  })

  it('computes a latitude-aware span', () => {
    const equator = bboxSpanKm([0, -1, 2, 1])
    const highLat = bboxSpanKm([0, 59, 2, 61])
    expect(equator).toBeGreaterThan(highLat)
    expect(equator).toBeCloseTo(222.64, 1)
  })
})

describe('native administrative terminology', () => {
  it('keeps level-1 terms and recognises district-like units', () => {
    expect(kindForAdminType('Province', 1)).toBe('state')
    expect(kindForAdminType('Bundesland', 1)).toBe('state')
    expect(kindForAdminType('Prefecture', 1)).toBe('state')
    expect(kindForAdminType('Governorate', 1)).toBe('state')
    expect(kindForAdminType('District', 1)).toBe('district')
    expect(kindForAdminType('County', 2)).toBe('district')
    expect(kindForAdminType(null, 1)).toBe('state')
  })
})

describe('place construction', () => {
  it('builds a country place with a navigable hierarchy', () => {
    const place = placeFromCountry(country)
    expect(place.kind).toBe('country')
    expect(place.iso3).toBe('TST')
    expect(place.adminLevel).toBe(0)
    expect(place.geoId).toBe('TST')
    expect(place.hierarchy).toHaveLength(1)
    expect(place.hierarchy?.[0].bbox).toEqual([0, 0, 10, 10])
    expect(place.footprintKm).toBeGreaterThan(1000)
  })

  it('builds a first-level place under its country', () => {
    const place = placeFromDivision(division, 1, { country })
    expect(place.kind).toBe('state')
    expect(place.region).toBe('Testland')
    expect(place.adminLevel).toBe(1)
    expect(place.hierarchy?.map((item) => item.name)).toEqual(['Testland', 'North Province'])
  })

  it('builds a second-level place under its first-level parent', () => {
    const second: GeoDivision = {
      ...division,
      id: 'TS-01-01',
      name: 'Central County',
      type: 'County',
      label: [4, 7],
    }
    const place = placeFromDivision(second, 2, { country, parent: division })
    expect(place.kind).toBe('district')
    expect(place.region).toBe('North Province, Testland')
    expect(place.hierarchy?.map((item) => item.name)).toEqual([
      'Testland',
      'North Province',
      'Central County',
    ])
  })

  it('rebuilds a place from a breadcrumb and truncates the trail', () => {
    const statePlace = placeFromDivision(division, 1, { country })
    const hierarchy = statePlace.hierarchy ?? []
    const rebuilt = placeFromHierarchyItem(hierarchy[0], hierarchy.slice(0, 1))
    expect(rebuilt.name).toBe('Testland')
    expect(rebuilt.kind).toBe('country')
    expect(rebuilt.hierarchy).toHaveLength(1)
  })

  it('builds search places from compact index entries', () => {
    const place = placeFromSearchEntry(
      { k: 'state', n: 'North Province', c: 'TST', i: 'TS-01', b: [0, 5, 10, 10] },
      country,
    )
    expect(place.kind).toBe('state')
    expect(place.iso3).toBe('TST')
    expect(place.hierarchy?.[0].name).toBe('Testland')
    expect(place.lat).toBeCloseTo(7.5)
    expect(place.lon).toBeCloseTo(5)
  })

  it('builds a district search place with its province in the hierarchy', () => {
    const place = placeFromSearchEntry(
      {
        k: 'district',
        n: 'Central County',
        c: 'TST',
        i: 'TS-01-01',
        b: [1, 6, 4, 9],
        p: 'TS-01',
        pn: 'North Province',
      },
      country,
    )
    expect(place.kind).toBe('district')
    expect(place.adminLevel).toBe(2)
    expect(place.geoType).toBe('District')
    expect(place.region).toBe('North Province, Testland')
    expect(place.hierarchy?.map((item) => item.name)).toEqual([
      'Testland',
      'North Province',
      'Central County',
    ])
  })

  it('keeps point places honest about their context', () => {
    const point = placeForGeoPoint(7, 5, country, [division])
    expect(point.kind).toBe('point')
    expect(point.iso3).toBe('TST')
    expect(point.hierarchy?.map((item) => item.name)).toEqual(['Testland', 'North Province'])
    expect(point.blurb).toContain('grid cell')
  })
})

describe('label collision handling', () => {
  const base: LabelRect = { id: 'a', name: 'Alpha', x: 100, y: 100, w: 60, h: 18, priority: 10, kind: 'country', selected: false }

  it('keeps non-overlapping labels', () => {
    const result = resolveLabelCollisions(
      [base, { ...base, id: 'b', name: 'Beta', x: 300, y: 300 }],
      { width: 800, height: 600 },
    )
    expect(result).toHaveLength(2)
  })

  it('drops a lower-priority overlapping label', () => {
    const result = resolveLabelCollisions(
      [base, { ...base, id: 'b', name: 'Beta', x: 108, y: 104, priority: 5 }],
      { width: 800, height: 600 },
    )
    expect(result.map((label) => label.id)).toEqual(['a'])
  })

  it('always keeps the selected label even at lower priority', () => {
    const result = resolveLabelCollisions(
      [{ ...base, priority: 1, selected: true }, { ...base, id: 'b', name: 'Beta', x: 102, y: 101, priority: 99 }],
      { width: 800, height: 600 },
    )
    expect(result[0].id).toBe('a')
    expect(result).toHaveLength(1)
  })

  it('drops labels outside the viewport', () => {
    const result = resolveLabelCollisions(
      [{ ...base, x: 2000, y: 2000 }],
      { width: 800, height: 600 },
    )
    expect(result).toHaveLength(0)
  })
})
