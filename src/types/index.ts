export type LayerId = 'temperature' | 'wind' | 'rainfall' | 'vegetation' | 'atmosphere'

export type Cadence = 'daily' | 'monthly' | 'static'

export type PowerVariableId = 'T2M' | 'PRECTOTCORR' | 'WS2M' | 'RH2M'

export type LocationKind = 'global' | 'continent' | 'country' | 'state' | 'district' | 'city' | 'town' | 'point'

export interface PlaceHierarchyItem {
  id: string
  name: string
  kind: LocationKind
  lat?: number
  lon?: number
  bbox?: [number, number, number, number]
  footprintKm?: number
  adminLevel?: 0 | 1 | 2 | 3
  iso2?: string
  iso3?: string
  geoType?: string
  boundarySource?: string
  boundaryLicense?: string
}

export interface Place {
  id: string
  name: string
  region?: string
  kind: LocationKind
  lat: number
  lon: number
  /** [west, south, east, north] in degrees */
  bbox: [number, number, number, number]
  level: 1 | 2 | 3 | 4
  /** Approximate width of the area of interest in km, used for resolution honesty checks. */
  footprintKm: number
  blurb?: string
  /** ISO 3166-1 alpha-2 / alpha-3 for the containing country. */
  iso2?: string
  iso3?: string
  /** 0 = country, 1 = first-level, 2 = second-level, 3 = local point. */
  adminLevel?: 0 | 1 | 2 | 3
  /** Stable id of the boundary feature this place came from. */
  geoId?: string
  /** Native term for the boundary, e.g. "State", "Province", "District". */
  geoType?: string
  boundarySource?: string
  boundaryLicense?: string
  /** Ancestors, outermost first, ending with this place itself. */
  hierarchy?: PlaceHierarchyItem[]
}

export interface GibsVariant {
  id: string
  label: string
  shortLabel: string
  provenanceId: string
  gibsLayer: string
  tileMatrixSet: string
  maxLevel: number
  cadence: Cadence
  startDate: string
  endDate?: string
  /** Days of publication lag: the newest date GIBS can be expected to hold. */
  lagDays: number
  units: string
  quantityLabel: string
  nativeResolution: string
  nativeResolutionKm: number
  display: 'temperature' | 'rate' | 'index' | 'percent' | 'concentration'
  kelvinToCelsius?: boolean
  legendKey: string
  legendUrl?: string
  description: string
  caveat: string
  powerVariable?: PowerVariableId
  supportsPointTrend: boolean
  supportsPixelSample: boolean
  opacity?: number
}

export interface LayerDefinition {
  id: LayerId
  label: string
  tagline: string
  blurb: string
  accent: string
  variants: GibsVariant[]
  defaultVariantId: string
}

export interface Provenance {
  id: string
  dataset: string
  shortName: string
  provider: string
  instrument?: string
  platform?: string
  resolution: string
  cadence: string
  latency: string
  license: string
  url: string
  doi?: string
  caveats: string[]
}

export interface PowerMonth {
  year: number
  month: number
  value: number | null
}

export interface PowerSeries {
  parameter: PowerVariableId
  units: string
  startYear: number
  endYear: number
  months: PowerMonth[]
  sourceLat: number
  sourceLon: number
  fetchedAt: number
  /** POWER fills gaps with -999; those become null and are excluded. */
  missingCount: number
}

export interface WindSample {
  lat: number
  lon: number
  /** metres per second */
  u: number
  v: number
  speed: number
}

export interface WindField {
  samples: WindSample[]
  stepDeg: number
  validTime: string
  mode: 'forecast' | 'archive'
  attribution: string
  fetchedAt: number
}

export interface TrendResult {
  variable: PowerVariableId
  label: string
  units: string
  startYear: number
  endYear: number
  observations: number
  expected: number
  completeness: number
  mannKendallZ: number
  pValue: number
  tau: number
  slopePerYear: number
  slopePerDecade: number
  slopeCi: [number, number] | null
  slopeCiPerDecade: [number, number] | null
  direction: 'increasing' | 'decreasing' | 'none'
  significant: boolean
  alpha: number
  changeOverPeriod: number
  percentChange: number | null
  series: Array<{ year: number; value: number; fitted: number }>
  notes: string[]
}

export interface AnomalyResult {
  year: number
  month: number
  value: number
  baselineMean: number
  baselineSd: number
  baselineCount: number
  zScore: number
  classification: 'well above average' | 'above average' | 'near average' | 'below average' | 'well below average'
}

export interface RasterSample {
  value: number
  units: string
  matchedColor: string
  binConfidence: 'approximate'
  tileCoords: { z: number; x: number; y: number }
  pixel: { x: number; y: number }
}
