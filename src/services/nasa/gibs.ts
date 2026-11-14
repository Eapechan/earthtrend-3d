import type { GibsVariant } from '../../types'
import { latestImageryDate, snapToCadence, startOfMonth, clampISO, addDays } from '../../utils/date'
import { fetchOk } from '../http'

export const GIBS_WMTS_BASE = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'

/** Base map: Blue Marble shaded relief + bathymetry (static, no date). */
export const BASE_LAYER = {
  id: 'blue-marble',
  gibsLayer: 'BlueMarble_ShadedRelief_Bathymetry',
  tileMatrixSet: 'GoogleMapsCompatible_Level8',
  maxLevel: 8,
  extension: 'jpeg',
}

/** Optional dated true-colour imagery. */
export const TRUE_COLOR_LAYER = {
  gibsLayer: 'MODIS_Terra_CorrectedReflectance_TrueColor',
  tileMatrixSet: 'GoogleMapsCompatible_Level9',
  maxLevel: 9,
  extension: 'png',
  lagDays: 2,
}

/**
 * Builds a Cesium UrlTemplateImageryProvider template. The {time} token is
 * replaced by Cesium's custom tag at request time; z/y/x follow the Web
 * Mercator tile scheme that Cesium's WebMercatorTilingScheme expects.
 */
export function gibsTileTemplate(layerId: string, tileMatrixSet: string, extension = 'png'): string {
  return `${GIBS_WMTS_BASE}/${layerId}/default/{time}/${tileMatrixSet}/{z}/{y}/{x}.${extension}`
}

export function gibsDateForVariant(variant: GibsVariant, iso: string): string {
  return snapToCadence(iso, variant.cadence)
}

/** Inclusive availability window clamped to what GIBS can have published. */
export function variantDateBounds(variant: GibsVariant): { min: string; max: string } {
  const min = variant.startDate
  // Monthly products publish after the month closes, with layer-specific
  // delays (MERRA-2 lags ~3 months, NDVI ~1 month); daily products lag by the
  // per-layer publication delay (AIRS is ~6 days, MODIS/IMERG ~2 days).
  let max =
    variant.cadence === 'monthly'
      ? startOfMonth(addDays(latestImageryDate(0), -variant.lagDays))
      : latestImageryDate(variant.lagDays)
  if (variant.endDate) max = variant.endDate < max ? variant.endDate : max
  if (max < min) max = min
  return { min, max }
}

export function clampVariantDate(variant: GibsVariant, iso: string): string {
  const { min, max } = variantDateBounds(variant)
  return clampISO(snapToCadence(iso, variant.cadence), min, max)
}

export function startDateForLayer(variant: GibsVariant): string {
  return clampVariantDate(variant, latestImageryDate(6))
}

export function gibsTileUrl(
  layerId: string,
  tileMatrixSet: string,
  date: string | null,
  z = 0,
  x = 0,
  y = 0,
  extension = 'png',
): string {
  const timePart = date ? `${date}/` : ''
  return `${GIBS_WMTS_BASE}/${layerId}/default/${timePart}${tileMatrixSet}/${z}/${y}/${x}.${extension}`
}

/**
 * A cheap preflight check so a missing archive date is reported honestly
 * instead of leaving the globe blank. The world tile at zoom 0 is ~10–30 KB.
 */
export async function checkImageryAvailability(variant: GibsVariant, date: string): Promise<boolean> {
  const snapped = gibsDateForVariant(variant, date)
  const key = `gibs:avail:${variant.gibsLayer}:${snapped}`

  const cache = sessionStorage.getItem(key)
  if (cache === '1') return true
  if (cache === '0') return false

  const url = gibsTileUrl(variant.gibsLayer, variant.tileMatrixSet, snapped, 0, 0, 0)
  const ok = await fetchOk(url)
  try {
    sessionStorage.setItem(key, ok ? '1' : '0')
  } catch {
    // Storage can be full or disabled; the check still returns a result.
  }
  return ok
}

export function serverAttribution(variant: GibsVariant): string {
  return `${variant.label} — NASA GIBS WMTS (EPSG:3857).`
}
