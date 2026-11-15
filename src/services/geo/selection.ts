import type { Place } from '../../types'

/**
 * Small registry so the globe's click handler can ask the geography layer to
 * turn a lon/lat into a real administrative place before falling back to a free
 * map point. This keeps Cesium entity picking out of the hot path and makes the
 * hit-testing logic unit-testable.
 */
export type GeoSelectionResolver = (lon: number, lat: number) => Place | null

let resolver: GeoSelectionResolver | null = null

export function registerGeoResolver(next: GeoSelectionResolver): () => void {
  resolver = next
  return () => {
    if (resolver === next) resolver = null
  }
}

export function resolveGeoSelection(lon: number, lat: number): Place | null {
  return resolver ? resolver(lon, lat) : null
}
