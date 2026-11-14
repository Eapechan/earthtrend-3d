/**
 * GeoLabels - Country labels for Cesium globe
 * 
 * Provides country name labels at appropriate zoom levels.
 */

import { useEffect, useRef, useState } from 'react'
import type { Viewer, EntityCollection } from 'cesium'
import { PLACES } from '../../data/locations'
import { useApp } from '../../state/AppContext'

type Place = {
  id: string
  name: string
  region?: string
  kind: 'global' | 'continent' | 'country' | 'state' | 'district' | 'city' | 'town' | 'point'
  lat: number
  lon: number
  level: 1 | 2 | 3 | 4
}

// Camera altitude thresholds for label visibility (in meters)
const ZOOM_LEVELS = {
  GLOBAL: 50_000_000,    // Show continents
  REGIONAL: 15_000_000,  // Show countries 
  COUNTRY: 3_000_000,    // Show states
  STATE: 500_000,        // Show districts
  LOCAL: 100_000,        // Show cities/towns
}

/**
 * Country-level place labels - major countries
 */
const COUNTRY_LEVEL_PLACES = PLACES.filter((p: Place) => p.kind === 'country')

/**
 * State-level place labels - states/regions
 */
const STATE_LEVEL_PLACES = PLACES.filter((p: Place) => p.kind === 'state' || p.kind === 'district')

/**
 * City-level place labels - cities/towns
 */
const CITY_LEVEL_PLACES = PLACES.filter((p: Place) => p.kind === 'city' || p.kind === 'town')

/**
 * Continents/labels at global level
 */
const CONTINENT_LABELS = [
  { name: 'Africa', lat: 9, lon: 21 },
  { name: 'Europe', lat: 55, lon: 18 },
  { name: 'Asia', lat: 37, lon: 98 },
  { name: 'North America', lat: 45, lon: -100 },
  { name: 'South America', lat: -14, lon: -62 },
  { name: 'Australia', lat: -25, lon: 134 },
]

export default function GeoLabels() {
  const { state } = useApp()
  const viewerRef = useRef<Viewer | null>(null)
  const entitiesRef = useRef<EntityCollection | null>(null)
  const [cameraAltitude, setCameraAltitude] = useState(0)

  // Get viewer through window (set by GlobeView)
  useEffect(() => {
    const handleViewerReady = () => {
      if (typeof window !== 'undefined' && (window as any).earthtrendViewer) {
        const v = (window as any).earthtrendViewer.current
        if (v) {
          viewerRef.current = v
        }
      }
    }

    window.addEventListener('globe-ready', handleViewerReady as any)
    return () => window.removeEventListener('globe-ready', handleViewerReady as any)
  }, [])

  // Update camera altitude whenever camera moves
  useEffect(() => {
    if (!viewerRef.current) return

    const camera = viewerRef.current.camera
    const position = camera.positionWC
    const earthRadius = 6378137
    
    const Cesium = (window as any).Cesium
    if (!Cesium) return
    
    const distance = Cesium.Cartesian3.magnitude(position)
    const altitude = Math.max(0, distance - earthRadius)
    
    setCameraAltitude(altitude)
  }, [state])

  // Create labels based on camera altitude
  useEffect(() => {
    const Cesium = (window as any).Cesium
    if (!viewerRef.current || !Cesium) return

    const viewer = viewerRef.current
    const altitude = cameraAltitude

    // Clear existing labels
    if (entitiesRef.current) {
      entitiesRef.current.removeAll()
      entitiesRef.current = null
    }

    const newEntityCollection = new Cesium.EntityCollection()
    viewer.entities.add(newEntityCollection)
    entitiesRef.current = newEntityCollection

    let labels: { name: string; lat: number; lon: number; priority: number; selected: boolean }[] = []

    if (altitude > ZOOM_LEVELS.GLOBAL) {
      // Global view - show continents
      for (const continent of CONTINENT_LABELS) {
        labels.push({
          name: continent.name,
          lat: continent.lat,
          lon: continent.lon,
          priority: 100,
          selected: false,
        })
      }
    }

    if (altitude > ZOOM_LEVELS.REGIONAL) {
      // Regional view - show countries
      const targetCountry = state.place.region
      for (const place of COUNTRY_LEVEL_PLACES) {
        labels.push({
          name: place.name,
          lat: place.lat,
          lon: place.lon,
          priority: place.region === targetCountry ? 100 : 50,
          selected: place.id === state.place.id,
        })
      }
    }

    if (altitude > ZOOM_LEVELS.COUNTRY) {
      // Country view - for India, show states
      if (state.place.region === 'India') {
        for (const place of STATE_LEVEL_PLACES) {
          if (place.region === 'India') {
            labels.push({
              name: place.name,
              lat: place.lat,
              lon: place.lon,
              priority: 30,
              selected: place.id === state.place.id,
            })
          }
        }
      }
    }

    if (altitude > ZOOM_LEVELS.STATE) {
      // State view - for Kerala, show districts
      if (state.place.region === 'Kerala') {
        for (const place of STATE_LEVEL_PLACES) {
          labels.push({
            name: place.name,
            lat: place.lat,
            lon: place.lon,
            priority: 10,
            selected: place.id === state.place.id,
          })
        }
      }
    }

    if (altitude > ZOOM_LEVELS.LOCAL) {
      // Local view - show cities/towns
      for (const place of CITY_LEVEL_PLACES) {
        labels.push({
          name: place.name,
          lat: place.lat,
          lon: place.lon,
          priority: 5,
          selected: place.id === state.place.id,
        })
      }
    }

    // Create entities from labels
    for (const label of labels) {
      const entity = new Cesium.Entity({
        position: Cesium.Cartesian3.fromDegrees(label.lon, label.lat, 0),
        label: {
          text: label.name,
          font: label.selected 
            ? 'bold 16px Inter, system-ui, sans-serif' 
            : label.priority > 50 
              ? 'bold 12px Inter, system-ui, sans-serif'
              : '11px Inter, system-ui, sans-serif',
          fillColor: Cesium.Color.fromCssColorString('#ffffff'),
          outlineColor: Cesium.Color.fromCssColorString('#000000').withAlpha(0.85),
          outlineWidth: 2,
          backgroundColor: Cesium.Color.fromCssColorString('#1a1422').withAlpha(0.85),
          backgroundPadding: new Cesium.Cartesian2(8, 4),
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -12),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 10_000_000),
        },
      })
      if (entitiesRef.current) {
        entitiesRef.current.add(entity)
      }
    }

    viewer.scene.requestRender()

  }, [cameraAltitude, state.place])

  return null
}