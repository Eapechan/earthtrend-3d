import type { Place } from '../types'

export type ResolutionVerdict = 'sub-cell' | 'marginal' | 'resolved'

export interface ResolutionAssessment {
  /** Native footprint of the dataset cell, in km. */
  nativeKm: number
  /** Approximate width of the place, in km. */
  footprintKm: number
  /** Place width divided by one dataset cell. < 1 means the place is inside one cell. */
  cellsAcross: number
  /** Effective ground size of one screen pixel in the rendered GIBS tiles, if known. */
  renderedKmPerPixel: number | null
  verdict: ResolutionVerdict
  headline: string
  detail: string
}

/**
 * Ground size (km) of one pixel at the maximum Web-Mercator zoom level GIBS
 * renders for a layer. A level-6 tile covers 5.625° at 256 px, so the on-screen
 * detail is coarser than many products' native grids. Saying so is part of the
 * point of this app.
 */
export function renderedPixelKm(maxLevel: number): number {
  const degreesPerPixel = 360 / (256 * 2 ** maxLevel)
  return degreesPerPixel * 111.32
}

export function assessResolution(
  place: Place,
  nativeKm: number,
  maxLevel?: number,
): ResolutionAssessment {
  const footprintKm = Math.max(place.footprintKm, 0.5)
  const cellsAcross = footprintKm / nativeKm
  const renderedKmPerPixel = maxLevel === undefined ? null : renderedPixelKm(maxLevel)

  let verdict: ResolutionVerdict
  if (cellsAcross < 0.85) verdict = 'sub-cell'
  else if (cellsAcross < 2.5) verdict = 'marginal'
  else verdict = 'resolved'

  const cellWord = nativeKm >= 10 ? `${Math.round(nativeKm)} km` : `${nativeKm.toFixed(1)} km`
  const placeWord = footprintKm >= 10 ? `${Math.round(footprintKm)} km` : `${footprintKm.toFixed(0)} km`
  const renderedNote =
    renderedKmPerPixel === null
      ? ''
      : ` Web tiles cap the visible detail at roughly ${renderedKmPerPixel.toFixed(1)} km per pixel at maximum zoom, so further zooming cannot add real detail.`

  const headline =
    verdict === 'sub-cell'
      ? 'Smaller than one data cell'
      : verdict === 'marginal'
        ? 'About the size of a few data cells'
        : 'Larger than several data cells'

  let detail: string
  if (verdict === 'sub-cell') {
    detail =
      `${place.name} is roughly ${placeWord} across, while one ${cellWord} grid cell is wider than the whole place. ` +
      `The app therefore reports the regional grid cell containing ${place.name} — it cannot resolve neighbourhoods, streets or a single river gauge. ` +
      `Local values can differ substantially from this cell average.`
  } else if (verdict === 'marginal') {
    detail =
      `${place.name} spans about ${cellsAcross.toFixed(1)} data cells (each ~${cellWord}). ` +
      `That is enough to compare broad districts, but not enough for street-level or single-village claims.`
  } else {
    detail =
      `${place.name} spans roughly ${cellsAcross.toFixed(0)} data cells (each ~${cellWord}), so regional contrasts inside it are meaningful at this grid scale — still not a direct local measurement.`
  }

  return {
    nativeKm,
    footprintKm,
    cellsAcross,
    renderedKmPerPixel,
    verdict,
    headline,
    detail: detail + renderedNote,
  }
}

/** Plain-language reminder for point APIs (POWER/Open-Meteo). */
export function pointCellNote(nativeKm: number): string {
  return `The point you selected pulls the value of the reanalysis grid cell that contains it (~${Math.round(
    nativeKm,
  )} km across), not a measurement taken at that exact coordinate.`
}
