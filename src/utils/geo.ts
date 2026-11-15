import type { BBox, GeoCountry, GeoDivision, GeoGeometry, GeoSearchEntry } from '../services/geo/types'
import type { LocationKind, Place, PlaceHierarchyItem } from '../types'

/** Zoom bands derived from camera height above the ellipsoid, in metres. */
export const GEO_ALTITUDE = {
  /** Above this: continents and country names only. */
  global: 8_000_000,
  /** Below this: first-level (state/province) boundaries and names. */
  admin1: 1_500_000,
  /** Below this: second-level (district/county) boundaries and names. */
  admin2: 300_000,
} as const

export type GeoViewLevel = 'global' | 'country' | 'state' | 'local'

/**
 * Maps camera altitude to the administrative level that should be visible.
 * This is deliberately conservative: revealing districts while the whole
 * country is on screen would just produce unreadable clutter.
 */
export function altitudeToViewLevel(heightMeters: number): GeoViewLevel {
  if (!Number.isFinite(heightMeters) || heightMeters >= GEO_ALTITUDE.global) return 'global'
  if (heightMeters >= GEO_ALTITUDE.admin1) return 'country'
  if (heightMeters >= GEO_ALTITUDE.admin2) return 'state'
  return 'local'
}

/** 0 = country outlines, 1 = admin-1, 2 = admin-2, 3 = local labels. */
export function viewLevelToAdminLevel(level: GeoViewLevel): 0 | 1 | 2 | 3 {
  if (level === 'global') return 0
  if (level === 'country') return 1
  if (level === 'state') return 2
  return 3
}

export function bboxContains([west, south, east, north]: BBox, lon: number, lat: number): boolean {
  if (lat < south || lat > north) return false
  // Countries that cross the antimeridian are stored with a world-width bbox.
  if (east - west >= 359) return true
  return lon >= west && lon <= east
}

/** Ray-casting point-in-ring test in lon/lat space. */
export function ringContains(ring: ReadonlyArray<ReadonlyArray<number>>, lon: number, lat: number): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    const intersects = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

/**
 * Point-in-geometry for our simplified payloads. Holes were dropped during
 * simplification, so every stored ring is treated as filled.
 */
export function geometryContains(geometry: GeoGeometry, lon: number, lat: number): boolean {
  const polygons =
    geometry.type === 'Polygon'
      ? [geometry.coordinates as number[][][]]
      : (geometry.coordinates as number[][][][])

  for (const polygon of polygons) {
    const outer = polygon[0]
    if (!outer || outer.length < 4) continue
    let inside = ringContains(outer, lon, lat)
    if (!inside) continue
    // Inner rings, when present, are holes.
    for (let r = 1; r < polygon.length; r += 1) {
      if (ringContains(polygon[r], lon, lat)) {
        inside = false
        break
      }
    }
    if (inside) return true
  }
  return false
}

export interface GeoFeature {
  bbox: BBox
  geometry?: GeoGeometry
}

/** Finds the first feature containing a point, using bbox prefiltering. */
export function findFeatureAt<T extends GeoFeature>(features: ReadonlyArray<T>, lon: number, lat: number): T | null {
  for (const feature of features) {
    if (!bboxContains(feature.bbox, lon, lat)) continue
    if (!feature.geometry) return feature
    if (geometryContains(feature.geometry, lon, lat)) return feature
  }
  return null
}

export function findCountryAt(countries: ReadonlyArray<GeoCountry>, lon: number, lat: number): GeoCountry | null {
  return findFeatureAt(countries, lon, lat)
}

export function findDivisionAt(divisions: ReadonlyArray<GeoDivision>, lon: number, lat: number): GeoDivision | null {
  return findFeatureAt(divisions, lon, lat)
}

/** Largest east–west / north–south span of a bbox, in kilometres. */
export function bboxSpanKm([west, south, east, north]: BBox): number {
  const midLat = (((south + north) / 2) * Math.PI) / 180
  const widthKm = Math.abs(east - west) * 111.32 * Math.cos(midLat)
  const heightKm = Math.abs(north - south) * 110.57
  return Math.max(widthKm, heightKm)
}

const STATE_TYPES = /state|province|region|territory|oblast|krai|republic|governorate|prefecture|department|canton|emirate|county|island|district|division|parish|voivodeship|autonomous/i

/** Native administrative term → the coarse kind used by the UI. */
export function kindForAdminType(type: string | null | undefined, level: 1 | 2): LocationKind {
  if (level === 2) return 'district'
  const value = (type ?? '').toLowerCase()
  if (/district|county|parish|arrondissement|municipal/.test(value)) return 'district'
  if (STATE_TYPES.test(value)) return 'state'
  return 'state'
}

function boundaryBlurb(term: string, source: string, nativeKm: number): string {
  return (
    `This ${term.toLowerCase()} boundary comes from ${source}. Environmental values describe the ` +
    `surrounding dataset grid cell${nativeKm >= 10 ? ` (~${Math.round(nativeKm)} km)` : ''}, ` +
    'not the boundary itself — zooming in adds geographic detail, not measurement resolution.'
  )
}

export function placeFromCountry(country: GeoCountry, nativeKm = 50): Place {
  const span = bboxSpanKm(country.bbox)
  const term = 'Country'
  return {
    id: `geo-country-${country.iso3}`,
    name: country.name,
    region: country.continent ?? undefined,
    kind: 'country',
    lat: country.label[1],
    lon: country.label[0],
    bbox: country.bbox,
    level: 3,
    footprintKm: Math.max(span, 20),
    blurb: boundaryBlurb(term, 'Natural Earth 1:50m (public domain)', nativeKm),
    iso2: country.iso2 ?? undefined,
    iso3: country.iso3,
    adminLevel: 0,
    geoId: country.iso3,
    geoType: term,
    boundarySource: 'Natural Earth 1:50m',
    boundaryLicense: 'Public domain',
    hierarchy: [
      {
        id: country.iso3,
        name: country.name,
        kind: 'country',
        lat: country.label[1],
        lon: country.label[0],
        bbox: country.bbox,
        footprintKm: Math.max(span, 20),
        adminLevel: 0,
        iso2: country.iso2 ?? undefined,
        iso3: country.iso3,
        geoType: term,
        boundarySource: 'Natural Earth 1:50m',
        boundaryLicense: 'Public domain',
      },
    ],
  }
}

export interface DivisionContext {
  country: GeoCountry
  /** Parent admin-1 division; only meaningful for level 2. */
  parent?: GeoDivision
  inAdmin2List?: boolean
}

export function placeFromDivision(division: GeoDivision, level: 1 | 2, ctx: DivisionContext): Place {
  const kind = kindForAdminType(division.type, level)
  const nativeLabel = division.type || (level === 1 ? 'Admin-1' : 'Admin-2')
  const source = level === 1 ? 'Natural Earth 1:10m (public domain)' : 'geoBoundaries ADM2 (open licence)'
  const span = bboxSpanKm(division.bbox)
  const hierarchy = [
    {
      id: ctx.country.iso3,
      name: ctx.country.name,
      kind: 'country' as LocationKind,
      lat: ctx.country.label[1],
      lon: ctx.country.label[0],
      bbox: ctx.country.bbox,
      footprintKm: Math.max(bboxSpanKm(ctx.country.bbox), 20),
      adminLevel: 0 as const,
      iso2: ctx.country.iso2 ?? undefined,
      iso3: ctx.country.iso3,
      geoType: 'Country',
      boundarySource: 'Natural Earth 1:50m',
      boundaryLicense: 'Public domain',
    },
    ...(level === 2 && ctx.parent
      ? [
          {
            id: ctx.parent.id,
            name: ctx.parent.name,
            kind: kindForAdminType(ctx.parent.type, 1),
            lat: ctx.parent.label[1],
            lon: ctx.parent.label[0],
            bbox: ctx.parent.bbox,
            footprintKm: Math.max(bboxSpanKm(ctx.parent.bbox), 2),
            adminLevel: 1 as const,
            iso2: ctx.country.iso2 ?? undefined,
            iso3: ctx.country.iso3,
            geoType: ctx.parent.type,
            boundarySource: 'Natural Earth 1:10m',
            boundaryLicense: 'Public domain',
          },
        ]
      : []),
    {
      id: division.id,
      name: division.name,
      kind,
      lat: division.label[1],
      lon: division.label[0],
      bbox: division.bbox,
      footprintKm: Math.max(span, 2),
      adminLevel: level,
      iso2: ctx.country.iso2 ?? undefined,
      iso3: ctx.country.iso3,
      geoType: nativeLabel,
      boundarySource: level === 1 ? 'Natural Earth 1:10m' : 'geoBoundaries ADM2',
      boundaryLicense: level === 1 ? 'Public domain' : 'Open (see geoBoundaries)',
    },
  ]

  return {
    id: `geo-${level === 1 ? 'a1' : 'a2'}-${division.id}`,
    name: division.name,
    region:
      level === 2 && ctx.parent
        ? `${ctx.parent.name}, ${ctx.country.name}`
        : ctx.country.name,
    kind,
    lat: division.label[1],
    lon: division.label[0],
    bbox: division.bbox,
    level: 4,
    footprintKm: Math.max(span, 2),
    blurb: boundaryBlurb(nativeLabel, source, 50),
    iso2: ctx.country.iso2 ?? undefined,
    iso3: ctx.country.iso3,
    adminLevel: level,
    geoId: division.id,
    geoType: nativeLabel,
    boundarySource: level === 1 ? 'Natural Earth 1:10m' : 'geoBoundaries ADM2',
    boundaryLicense: level === 1 ? 'Public domain' : 'Open (see geoBoundaries)',
    hierarchy,
  }
}

/** A synthetic place for a free map point, carrying country context when known. */
export function placeForGeoPoint(
  lat: number,
  lon: number,
  country: GeoCountry | null,
  divisions: ReadonlyArray<GeoDivision> = [],
): Place {
  const division = findDivisionAt(divisions, lon, lat)
  const span = 0.6
  const hierarchy: PlaceHierarchyItem[] = country
    ? [
        {
          id: country.iso3,
          name: country.name,
          kind: 'country',
          lat: country.label[1],
          lon: country.label[0],
          bbox: country.bbox,
          footprintKm: Math.max(bboxSpanKm(country.bbox), 20),
          adminLevel: 0,
          iso2: country.iso2 ?? undefined,
          iso3: country.iso3,
          geoType: 'Country',
          boundarySource: 'Natural Earth 1:50m',
          boundaryLicense: 'Public domain',
        },
      ]
    : []
  if (division) {
    hierarchy.push({
      id: division.id,
      name: division.name,
      kind: kindForAdminType(division.type, 1),
      lat: division.label[1],
      lon: division.label[0],
      bbox: division.bbox,
      footprintKm: Math.max(bboxSpanKm(division.bbox), 2),
      adminLevel: 1,
      iso2: country?.iso2 ?? undefined,
      iso3: country?.iso3,
      geoType: division.type,
      boundarySource: 'Natural Earth 1:10m',
      boundaryLicense: 'Public domain',
    })
  }
  return {
    id: `point-${lat.toFixed(3)}-${lon.toFixed(3)}`,
    name: `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`,
    region: division && country ? `${division.name}, ${country.name}` : country?.name ?? 'Free map point',
    kind: 'point',
    lat,
    lon,
    bbox: [lon - span, lat - span, lon + span, lat + span],
    level: 4,
    footprintKm: 120,
    blurb:
      'A point you selected on the globe. Values describe the surrounding dataset grid cell, not a single village.',
    iso2: country?.iso2 ?? undefined,
    iso3: country?.iso3,
    adminLevel: division ? 1 : country ? 0 : undefined,
    hierarchy: hierarchy.length ? hierarchy : undefined,
  }
}

/**
 * Rebuilds a navigable place from a breadcrumb entry. `ancestors` is the
 * (already truncated) hierarchy up to and including the entry, so navigating
 * up a level keeps the trail consistent.
 */
export function placeFromHierarchyItem(
  item: PlaceHierarchyItem,
  ancestors: PlaceHierarchyItem[] = [item],
): Place {
  const lat = item.lat ?? 0
  const lon = item.lon ?? 0
  const bbox = item.bbox ?? [lon - 0.5, lat - 0.5, lon + 0.5, lat + 0.5]
  const adminLevel =
    item.adminLevel ?? (item.kind === 'country' ? 0 : item.kind === 'district' ? 2 : 1)
  const parentName =
    adminLevel === 0 || ancestors.length < 2
      ? undefined
      : ancestors[ancestors.length - 2]?.name
  return {
    id: adminLevel === 0 ? `geo-country-${item.id}` : `geo-${item.id}`,
    name: item.name,
    region: parentName,
    kind: item.kind,
    lat,
    lon,
    bbox,
    level: adminLevel === 0 ? 3 : 4,
    footprintKm: item.footprintKm ?? Math.max(bboxSpanKm(bbox), 5),
    iso2: item.iso2,
    iso3: item.iso3,
    adminLevel,
    geoId: item.id,
    geoType: item.geoType,
    boundarySource: item.boundarySource,
    boundaryLicense: item.boundaryLicense,
    hierarchy: ancestors,
  }
}

/**
 * Builds a navigable place from a compact search-index entry. Country entries
 * reuse the full country geometry when it is already loaded.
 */
export function placeFromSearchEntry(
  entry: GeoSearchEntry,
  country: GeoCountry | null,
): Place {
  if (entry.k === 'country' && country) return placeFromCountry(country)

  const [west, south, east, north] = entry.b
  const lon = (west + east) / 2
  const lat = (south + north) / 2
  const span = bboxSpanKm(entry.b)
  const isCountry = entry.k === 'country'
  const isDistrict = entry.k === 'district'
  const kind: LocationKind = isCountry ? 'country' : isDistrict ? 'district' : 'state'
  const adminLevel: 0 | 1 | 2 = isCountry ? 0 : isDistrict ? 2 : 1
  const term = isCountry ? 'Country' : isDistrict ? 'District' : 'Admin-1'
  const source = isDistrict ? 'geoBoundaries ADM2' : 'Natural Earth 1:10m'
  const licence = isDistrict ? 'Open (see geoBoundaries)' : 'Public domain'
  const hierarchy: PlaceHierarchyItem[] = []

  if (country) {
    hierarchy.push({
      id: country.iso3,
      name: country.name,
      kind: 'country',
      lat: country.label[1],
      lon: country.label[0],
      bbox: country.bbox,
      footprintKm: Math.max(bboxSpanKm(country.bbox), 20),
      adminLevel: 0,
      iso2: country.iso2 ?? undefined,
      iso3: country.iso3,
      geoType: 'Country',
      boundarySource: 'Natural Earth 1:50m',
      boundaryLicense: 'Public domain',
    })
  }
  if (isDistrict && entry.pn) {
    const parentBBox = entry.pb ?? entry.b
    hierarchy.push({
      id: entry.p ?? entry.pn,
      name: entry.pn,
      kind: 'state',
      lat: entry.pl?.[1] ?? (parentBBox[1] + parentBBox[3]) / 2,
      lon: entry.pl?.[0] ?? (parentBBox[0] + parentBBox[2]) / 2,
      bbox: parentBBox,
      footprintKm: Math.max(bboxSpanKm(parentBBox), 2),
      iso2: country?.iso2 ?? undefined,
      iso3: entry.c,
      adminLevel: 1,
      geoType: 'Admin-1',
      boundarySource: 'Natural Earth 1:10m',
      boundaryLicense: 'Public domain',
    })
  }
  hierarchy.push({
    id: entry.i,
    name: entry.n,
    kind,
    lat,
    lon,
    bbox: entry.b,
    footprintKm: Math.max(span, 2),
    adminLevel,
    iso2: country?.iso2 ?? undefined,
    iso3: entry.c,
    geoType: term,
    boundarySource: source,
    boundaryLicense: licence,
  })

  return {
    id: `geo-search-${entry.k}-${entry.i}`,
    name: entry.n,
    region: isDistrict && entry.pn ? `${entry.pn}, ${country?.name ?? entry.c}` : country?.name ?? entry.c,
    kind,
    lat,
    lon,
    bbox: entry.b,
    level: adminLevel === 0 ? 3 : 4,
    footprintKm: Math.max(span, 2),
    iso2: country?.iso2 ?? undefined,
    iso3: entry.c,
    adminLevel,
    geoId: entry.i,
    geoType: term,
    boundarySource: source,
    boundaryLicense: licence,
    hierarchy,
  }
}

export interface LabelRect {
  id: string
  name: string
  /** Screen-space centre, in CSS pixels. */
  x: number
  y: number
  w: number
  h: number
  priority: number
  kind: string
  selected: boolean
  meta?: string
}

export interface Rect {
  x0: number
  y0: number
  x1: number
  y1: number
}

function overlaps(a: Rect, b: Rect): boolean {
  return !(a.x1 < b.x0 || a.x0 > b.x1 || a.y1 < b.y0 || a.y0 > b.y1)
}

/**
 * Greedy screen-space label placement. Higher priority wins; the selected
 * label always ranks first. Returned order is the draw order.
 */
export function resolveLabelCollisions(
  candidates: ReadonlyArray<LabelRect>,
  viewport: { width: number; height: number },
  padding = 3,
): LabelRect[] {
  const sorted = [...candidates].sort((a, b) => {
    if (a.selected !== b.selected) return a.selected ? -1 : 1
    if (a.priority !== b.priority) return b.priority - a.priority
    if (a.name.length !== b.name.length) return a.name.length - b.name.length
    return a.name.localeCompare(b.name)
  })

  const accepted: Rect[] = []
  const out: LabelRect[] = []
  for (const label of sorted) {
    const box: Rect = {
      x0: label.x - label.w / 2 - padding,
      y0: label.y - label.h / 2 - padding,
      x1: label.x + label.w / 2 + padding,
      y1: label.y + label.h / 2 + padding,
    }
    // Drop labels that would be clipped by the viewport edge; a half-visible
    // country name looks like a rendering bug.
    if (box.x0 < 0 || box.y0 < 0 || box.x1 > viewport.width || box.y1 > viewport.height) continue
    if (accepted.some((taken) => overlaps(taken, box))) continue
    accepted.push(box)
    out.push(label)
  }
  return out
}
