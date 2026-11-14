import type { PowerVariableId } from '../types'

export interface PowerVariableMeta {
  id: PowerVariableId
  label: string
  shortLabel: string
  monthlyUnits: string
  trendUnits: string
  aggregation: 'mean' | 'sum'
  decimals: number
  /** Ratio-scaled variables can legitimately be described with a % change. */
  ratioScaled: boolean
  description: string
  powerDocs: string
}

export const POWER_VARIABLES: Record<PowerVariableId, PowerVariableMeta> = {
  T2M: {
    id: 'T2M',
    label: 'Air temperature at 2 m',
    shortLabel: 'Temperature',
    monthlyUnits: '°C',
    trendUnits: '°C/decade',
    aggregation: 'mean',
    decimals: 1,
    ratioScaled: false,
    description:
      'MERRA-2 2 m air temperature, aggregated to monthly means by NASA POWER. A temperature change is reported in °C, never as a percentage.',
    powerDocs: 'https://power.larc.nasa.gov/parameters/',
  },
  PRECTOTCORR: {
    id: 'PRECTOTCORR',
    label: 'Precipitation (bias corrected)',
    shortLabel: 'Rainfall',
    monthlyUnits: 'mm/day',
    trendUnits: 'mm/yr',
    aggregation: 'sum',
    decimals: 0,
    ratioScaled: true,
    description:
      'POWER monthly precipitation rate in mm/day. Trends use annual totals (mm per year) computed from the monthly values and actual month lengths.',
    powerDocs: 'https://power.larc.nasa.gov/parameters/',
  },
  WS2M: {
    id: 'WS2M',
    label: 'Wind speed at 2 m',
    shortLabel: 'Wind speed',
    monthlyUnits: 'm/s',
    trendUnits: 'm/s per decade',
    aggregation: 'mean',
    decimals: 2,
    ratioScaled: true,
    description: 'MERRA-2 2 m wind speed, monthly mean. Direction (WD2M) is fetched separately for the local wind card.',
    powerDocs: 'https://power.larc.nasa.gov/parameters/',
  },
  RH2M: {
    id: 'RH2M',
    label: 'Relative humidity at 2 m',
    shortLabel: 'Humidity',
    monthlyUnits: '%',
    trendUnits: '% per decade',
    aggregation: 'mean',
    decimals: 1,
    ratioScaled: false,
    description: 'MERRA-2 2 m relative humidity, monthly mean.',
    powerDocs: 'https://power.larc.nasa.gov/parameters/',
  },
}

export const SEASON_LABELS = {
  annual: 'Annual',
  DJF: 'Dec–Feb',
  MAM: 'Mar–May',
  JJA: 'Jun–Aug',
  SON: 'Sep–Nov',
} as const
