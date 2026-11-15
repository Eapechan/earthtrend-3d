/**
 * Shapes of the self-hosted boundary payloads built by scripts/fetch-geo.mjs.
 * Geometry is stored as plain [lon, lat] rings so it stays compact on the wire.
 */

export type LonLat = [number, number]
export type BBox = [west: number, south: number, east: number, north: number]

export interface GeoGeometry {
  type: 'Polygon' | 'MultiPolygon'
  /** Polygon: rings[ringIndex][pointIndex]; MultiPolygon: polygons[polygonIndex][ringIndex][pointIndex]. */
  coordinates: LonLat[][] | LonLat[][][]
}

export interface GeoCountry {
  id: string
  iso3: string
  iso2: string | null
  name: string
  formal: string | null
  continent: string | null
  region: string | null
  label: LonLat
  bbox: BBox
  population: number | null
  geometry: GeoGeometry
}

export interface GeoDivision {
  id: string
  name: string
  local: string | null
  /** Native administrative term, e.g. "State", "Province", "District", "County". */
  type: string
  region: string | null
  label: LonLat
  bbox: BBox
  /** For level-2 units: the level-1 division that contains this unit, when known. */
  parent?: string | null
  geometry: GeoGeometry
}

export interface Admin2Payload {
  country: string
  source: string
  license: string
  canonical: string | null
  year: string | null
  units: GeoDivision[]
}

export interface CountriesPayload {
  generated: string
  source: string
  license: string
  countries: GeoCountry[]
}

export interface Admin1Payload {
  country: string
  source: string
  license: string
  divisions: GeoDivision[]
}

export interface GeoIndexCountry {
  iso3: string
  iso2: string | null
  name: string
  continent: string | null
  level1: number
}

export interface GeoIndex {
  generated: string
  source: string
  license: string
  note: string
  countryCount: number
  countries: GeoIndexCountry[]
  admin1Files: number
  admin2: Array<{ iso3: string; units: number }>
}

export interface GeoSearchEntry {
  /** country | state | district */
  k: 'country' | 'state' | 'district'
  /** display name */
  n: string
  /** ISO-3 country code */
  c: string
  /** stable id (ISO-3 for countries, feature id for divisions) */
  i: string
  b: BBox
  /** District only: parent level-1 id. */
  p?: string | null
  /** District only: parent level-1 name. */
  pn?: string | null
  /** District only: parent level-1 label [lon, lat], for breadcrumb navigation. */
  pl?: [number, number] | null
  /** District only: parent level-1 bbox [west, south, east, north]. */
  pb?: BBox | null
}

export interface GeoSearchPayload {
  generated: string
  note: string
  entries: GeoSearchEntry[]
}

export interface GeoBoundaryMeta {
  source: string
  license: string
  /** Native term for the level, e.g. "District". */
  term: string | null
}
