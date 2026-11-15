import { useEffect, useRef, useState } from 'react'
import type { Cartesian2, Entity, ImageryLayer, Viewer } from 'cesium'
import { useApp } from '../../state/AppContext'
import { loadCesium } from '../../services/cesium/loader'
import {
  BASE_LAYER,
  GIBS_WMTS_BASE,
  TRUE_COLOR_LAYER,
  gibsDateForVariant,
} from '../../services/nasa/gibs'
import { placeForPoint } from '../../data/locations'
import { resolveGeoSelection } from '../../services/geo/selection'
import { useIsMobile, useReducedMotion } from '../../hooks/useMotion'
import type { Place, WindField } from '../../types'
import WindOverlay from './WindOverlay'
import GlobeGeography from './GlobeGeography'

type CesiumApi = typeof import('cesium')

interface GlobeViewProps {
  windField: WindField | null
  windLoading: boolean
  windError: string | null
  onReady?: () => void
  onError?: () => void
}

function staticTileUrl(layerId: string, tms: string, extension: string): string {
  return `${GIBS_WMTS_BASE}/${layerId}/default/${tms}/{z}/{y}/{x}.${extension}`
}

/**
 * Administrative names are rendered by GlobeGeography's HTML overlay, so the
 * Cesium entity label is reserved for point-like places to avoid duplicates.
 */
function showsMarkerLabel(kind: Place['kind']): boolean {
  return kind === 'point' || kind === 'city' || kind === 'town'
}

function createBaseLayer(Cesium: CesiumApi, date: string, trueColor: boolean): ImageryLayer {
  const provider = trueColor
    ? new Cesium.UrlTemplateImageryProvider({
        url: staticTileUrl(
          TRUE_COLOR_LAYER.gibsLayer,
          TRUE_COLOR_LAYER.tileMatrixSet,
          TRUE_COLOR_LAYER.extension,
        ).replace('/default/', `/default/${date}/`),
        tilingScheme: new Cesium.WebMercatorTilingScheme(),
        maximumLevel: TRUE_COLOR_LAYER.maxLevel,
        minimumLevel: 0,
        credit: new Cesium.Credit('NASA GIBS — MODIS true colour'),
      })
    : new Cesium.UrlTemplateImageryProvider({
        url: staticTileUrl(BASE_LAYER.gibsLayer, BASE_LAYER.tileMatrixSet, BASE_LAYER.extension),
        tilingScheme: new Cesium.WebMercatorTilingScheme(),
        maximumLevel: BASE_LAYER.maxLevel,
        minimumLevel: 0,
        credit: new Cesium.Credit('NASA GIBS — Blue Marble'),
      })

  const layer = new Cesium.ImageryLayer(provider)
  layer.alpha = trueColor ? 0.95 : 1
  layer.brightness = trueColor ? 1.02 : 1.04
  layer.contrast = trueColor ? 1.08 : 1.12
  layer.saturation = trueColor ? 0.98 : 0.96
  return layer
}

function createDataLayer(
  Cesium: CesiumApi,
  url: string,
  maxLevel: number,
  alpha: number,
  label: string,
): ImageryLayer {
  const provider = new Cesium.UrlTemplateImageryProvider({
    url,
    tilingScheme: new Cesium.WebMercatorTilingScheme(),
    maximumLevel: maxLevel,
    minimumLevel: 0,
    credit: new Cesium.Credit(`NASA GIBS — ${label}`),
  })
  const layer = new Cesium.ImageryLayer(provider)
  layer.alpha = alpha
  // Improved visualization: better contrast for readability while preserving satellite detail
  layer.brightness = 1.02
  layer.contrast = 1.08
  layer.saturation = 1.0
  return layer
}

function flyToPlace(
  Cesium: CesiumApi,
  viewer: Viewer,
  place: Place,
  instant: boolean,
  nativeKm: number,
) {
  const duration = instant ? 0 : 1.9
  if (place.kind === 'global') {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(10, 12, 22_000_000),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
      duration,
    })
    return
  }

  const [regionWest, regionSouth, regionEast, regionNorth] = place.bbox
  // Never fly closer than several dataset cells across: a town that is smaller
  // than one 1° cell would otherwise fill the screen with almost a single flat
  // colour. Five cells keeps the cell boundaries and geographic context in view.
  const minSpanKm = Math.max(20, nativeKm * 5)
  const minSpan = Math.min(25, minSpanKm / 111)
  const centerLon = (regionWest + regionEast) / 2
  const centerLat = (regionSouth + regionNorth) / 2
  const halfLon = Math.max((regionEast - regionWest) / 2, minSpan / 2)
  const halfLat = Math.max((regionNorth - regionSouth) / 2, minSpan / 2)
  const rectangle = Cesium.Rectangle.fromDegrees(
    centerLon - halfLon,
    Math.max(-89.5, centerLat - halfLat),
    centerLon + halfLon,
    Math.min(89.5, centerLat + halfLat),
  )
  viewer.camera.flyTo({ destination: rectangle, duration })
}

export default function GlobeView({ windField, windLoading, windError, onReady, onError }: GlobeViewProps) {
  const { state, dispatch, variant } = useApp()
  const isMobile = useIsMobile()
  const reducedMotion = useReducedMotion()

  const containerRef = useRef<HTMLDivElement | null>(null)
  const creditRef = useRef<HTMLDivElement | null>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const cesiumRef = useRef<CesiumApi | null>(null)
  const baseRef = useRef<ImageryLayer | null>(null)
  const activeRef = useRef<ImageryLayer | null>(null)
  const compareRef = useRef<ImageryLayer | null>(null)
  const markerRef = useRef<Entity | null>(null)
  const splitRef = useRef(0.5)
  const clickHandlerRef = useRef<{ destroy: () => void } | null>(null)
  const firstPlaceRef = useRef(true)
  const nativeKmRef = useRef(110)
  const baseKeyRef = useRef('')

  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draggingSplit, setDraggingSplit] = useState(false)
  const [, forceTick] = useState(0)

  // --- Create the viewer once -------------------------------------------------
  useEffect(() => {
    let cancelled = false
    let viewer: Viewer | null = null

    loadCesium()
      .then((Cesium) => {
        if (cancelled || !containerRef.current || !creditRef.current) return
        cesiumRef.current = Cesium

        viewer = new Cesium.Viewer(containerRef.current, {
          baseLayer: false,
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
          creditContainer: creditRef.current,
          requestRenderMode: true,
          maximumRenderTimeChange: 0.5,
          useBrowserRecommendedResolution: true,
        })

        viewerRef.current = viewer
        const scene = viewer.scene
        scene.backgroundColor = Cesium.Color.fromCssColorString('#04060b')
        scene.globe.baseColor = Cesium.Color.fromCssColorString('#071523')
        scene.globe.showGroundAtmosphere = true
        scene.globe.maximumScreenSpaceError = isMobile ? 4 : 2
        scene.globe.tileCacheSize = isMobile ? 120 : 420
        scene.globe.preloadAncestors = !isMobile
        scene.fog.enabled = true
        scene.fog.density = 0.00018
        if (scene.sun) scene.sun.show = false
        if (scene.moon) scene.moon.show = false
        if (scene.skyAtmosphere) {
          scene.skyAtmosphere.show = true
          scene.skyAtmosphere.brightnessShift = -0.08
          scene.skyAtmosphere.saturationShift = -0.1
        }
        if ('msaaSamples' in scene) {
          ;(scene as unknown as { msaaSamples: number }).msaaSamples = isMobile ? 1 : 2
        }
        scene.postProcessStages.fxaa.enabled = !isMobile
        viewer.resolutionScale = isMobile ? 0.85 : 1

        // Blue Marble / true colour base.
        const base = createBaseLayer(Cesium, state.date, state.showTrueColor)
        viewer.imageryLayers.add(base, 0)
        baseRef.current = base
        baseKeyRef.current = state.showTrueColor ? `tc:${state.date}` : 'bm'

        // Initial data layer.
        const template = `${GIBS_WMTS_BASE}/${variant.gibsLayer}/default/${gibsDateForVariant(
          variant,
          state.date,
        )}/${variant.tileMatrixSet}/{z}/{y}/{x}.png`
        const active = createDataLayer(Cesium, template, variant.maxLevel, state.opacity, variant.shortLabel)
        viewer.imageryLayers.add(active)
        activeRef.current = active

        // Location marker.
        const marker = viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(state.place.lon, state.place.lat, 0),
          point: {
            pixelSize: 9,
            color: Cesium.Color.fromCssColorString('#7dd3fc'),
            outlineColor: Cesium.Color.fromCssColorString('#04060b'),
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            scaleByDistance: new Cesium.NearFarScalar(1_000, 1.4, 20_000_000, 0.6),
          },
          label: {
            text: state.place.name,
            show: showsMarkerLabel(state.place.kind),
            font: '600 12px Inter, system-ui, sans-serif',
            fillColor: Cesium.Color.fromCssColorString('#e6edf7'),
            showBackground: true,
            backgroundColor: Cesium.Color.fromCssColorString('#0a1422').withAlpha(0.82),
            backgroundPadding: new Cesium.Cartesian2(8, 5),
            pixelOffset: new Cesium.Cartesian2(0, -20),
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 40_000_000),
          },
        })
        markerRef.current = marker

        // Click anywhere on the globe to analyse that point.
        const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas)
        handler.setInputAction((movement: { position: Cartesian2 }) => {
          const cartesian = viewer?.camera.pickEllipsoid(movement.position, scene.globe.ellipsoid)
          if (!cartesian) return
          const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
          const lon = Cesium.Math.toDegrees(cartographic.longitude)
          const lat = Cesium.Math.toDegrees(cartographic.latitude)
          // Administrative hit-testing first (country → state → district),
          // then the curated dataset of named places, then a free map point.
          const place = resolveGeoSelection(lon, lat) ?? placeForPoint(lat, lon)
          dispatch({ type: 'setPlace', place })
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
        clickHandlerRef.current = handler

        scene.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(78, 18, 12_000_000),
          duration: 0,
        })

        setReady(true)
        onReady?.()
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'The 3D globe could not start.')
        onError?.()
      })

    return () => {
      cancelled = true
      clickHandlerRef.current?.destroy()
      clickHandlerRef.current = null
      if (viewer) viewer.destroy()
      viewerRef.current = null
      cesiumRef.current = null
      baseRef.current = null
      activeRef.current = null
      compareRef.current = null
      markerRef.current = null
    }
    // The viewer is created once; subsequent updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, dispatch])

  // --- Base map / true colour -------------------------------------------------
  useEffect(() => {
    const Cesium = cesiumRef.current
    const viewer = viewerRef.current
    if (!ready || !Cesium || !viewer) return
    // Blue Marble is static: do not reload it as the date steps. Only the dated
    // true-colour base needs to follow the timeline.
    const key = state.showTrueColor ? `tc:${state.date}` : 'bm'
    if (baseKeyRef.current === key) return
    baseKeyRef.current = key
    if (baseRef.current) viewer.imageryLayers.remove(baseRef.current, true)
    const base = createBaseLayer(Cesium, state.date, state.showTrueColor)
    viewer.imageryLayers.add(base, 0)
    baseRef.current = base
    viewer.scene.requestRender()
  }, [ready, state.showTrueColor, state.date])

  // --- Active imagery layer ---------------------------------------------------
  useEffect(() => {
    const Cesium = cesiumRef.current
    const viewer = viewerRef.current
    if (!ready || !Cesium || !viewer) return
    if (activeRef.current) viewer.imageryLayers.remove(activeRef.current, true)

    const date = gibsDateForVariant(variant, state.date)
    const template = `${GIBS_WMTS_BASE}/${variant.gibsLayer}/default/${date}/${variant.tileMatrixSet}/{z}/{y}/{x}.png`
    const layer = createDataLayer(Cesium, template, variant.maxLevel, state.opacity, variant.shortLabel)
    layer.splitDirection = state.compareEnabled ? Cesium.SplitDirection.LEFT : Cesium.SplitDirection.NONE
    viewer.imageryLayers.add(layer)
    activeRef.current = layer
    viewer.scene.requestRender()
  }, [ready, variant, state.date, state.compareEnabled])

  // Opacity is a cheap property update, never a layer rebuild.
  useEffect(() => {
    if (!ready) return
    if (activeRef.current) activeRef.current.alpha = state.opacity
    if (compareRef.current) compareRef.current.alpha = state.opacity
    viewerRef.current?.scene.requestRender()
  }, [ready, state.opacity])

  // --- Comparison layer -------------------------------------------------------
  useEffect(() => {
    const Cesium = cesiumRef.current
    const viewer = viewerRef.current
    if (!ready || !Cesium || !viewer) return
    if (compareRef.current) {
      viewer.imageryLayers.remove(compareRef.current, true)
      compareRef.current = null
    }
    if (!state.compareEnabled) {
      viewer.scene.splitPosition = 0.5
      const active = activeRef.current
      if (active) active.splitDirection = Cesium.SplitDirection.NONE
      viewer.scene.requestRender()
      return
    }

    const date = gibsDateForVariant(variant, state.compareDate)
    const template = `${GIBS_WMTS_BASE}/${variant.gibsLayer}/default/${date}/${variant.tileMatrixSet}/{z}/{y}/{x}.png`
    const layer = createDataLayer(Cesium, template, variant.maxLevel, state.opacity, variant.shortLabel)
    layer.splitDirection = Cesium.SplitDirection.RIGHT
    viewer.imageryLayers.add(layer)
    compareRef.current = layer
    if (activeRef.current) activeRef.current.splitDirection = Cesium.SplitDirection.LEFT
    viewer.scene.splitPosition = splitRef.current
    viewer.scene.requestRender()
  }, [ready, variant, state.compareEnabled, state.compareDate])

  // --- Marker + camera --------------------------------------------------------
  useEffect(() => {
    nativeKmRef.current = variant.nativeResolutionKm
  }, [variant.nativeResolutionKm])

  useEffect(() => {
    const Cesium = cesiumRef.current
    const viewer = viewerRef.current
    if (!ready || !Cesium || !viewer) return
    const marker = markerRef.current
    if (marker) {
      marker.position = new Cesium.ConstantPositionProperty(
        Cesium.Cartesian3.fromDegrees(state.place.lon, state.place.lat, 0),
      )
      if (marker.label) {
        marker.label.text = new Cesium.ConstantProperty(state.place.name)
        // Administrative names are drawn by the HTML label overlay; only
        // point-like places keep a Cesium label to avoid duplicate text.
        marker.label.show = new Cesium.ConstantProperty(showsMarkerLabel(state.place.kind))
      }
    }
    // Keep the opening wide shot: do not dive into the default place on load.
    if (firstPlaceRef.current) {
      firstPlaceRef.current = false
      viewer.scene.requestRender()
      return
    }
    if (state.place.kind !== 'point') {
      flyToPlace(Cesium, viewer, state.place, reducedMotion, nativeKmRef.current)
    }
    viewer.scene.requestRender()
  }, [ready, state.place, reducedMotion])

  // --- Comparison swipe interaction ------------------------------------------
  useEffect(() => {
    const Cesium = cesiumRef.current
    const viewer = viewerRef.current
    if (!ready || !Cesium || !viewer || !draggingSplit) return
    const scene = viewer.scene

    const update = (clientX: number) => {
      const canvas = scene.canvas
      const rect = canvas.getBoundingClientRect()
      const fraction = Math.min(0.95, Math.max(0.05, (clientX - rect.left) / rect.width))
      splitRef.current = fraction
      scene.splitPosition = fraction
      scene.requestRender()
      forceTick((n) => n + 1)
    }
    const onMove = (event: PointerEvent) => update(event.clientX)
    const onUp = () => setDraggingSplit(false)

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [ready, draggingSplit])

  return (
    <div className="absolute inset-0">
      <div
        ref={containerRef}
        className="cesium-host absolute inset-0"
        aria-label="Interactive 3D Earth globe showing NASA satellite imagery"
      />

      <GlobeGeography viewer={ready ? viewerRef.current : null} cesium={ready ? cesiumRef.current : null} />

      <WindOverlay
        viewer={viewerRef.current}
        cesium={cesiumRef.current}
        field={windField}
        enabled={state.showFlow}
        reducedMotion={reducedMotion}
        isMobile={isMobile}
      />

      {state.compareEnabled && (
        <div className="pointer-events-none absolute inset-0 z-20">
          <div
            className="pointer-events-auto absolute top-0 bottom-0 z-20 w-[2px] cursor-ew-resize bg-sky-300/70 shadow-[0_0_18px_rgba(56,189,248,0.7)]"
            style={{ left: `${splitRef.current * 100}%` }}
            onPointerDown={(event) => {
              event.preventDefault()
              setDraggingSplit(true)
            }}
            role="separator"
            aria-orientation="vertical"
            aria-label="Drag to compare two dates"
          >
            <div className="absolute top-1/2 left-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-sky-300/60 bg-[#071522]/90 text-[10px] text-sky-200 shadow-lg">
              ⇄
            </div>
          </div>
          <div className="absolute top-[calc(50%+34px)] left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/65 px-3 py-1 text-[10px] tracking-wide text-sky-100/80 backdrop-blur">
            Drag to reveal another date
          </div>
        </div>
      )}

      {/* Cesium's required credits stay visible. */}
      <div
        ref={creditRef}
        id="cesium-credits"
        className="pointer-events-auto absolute right-3 bottom-2 z-30 max-w-[58vw] text-[9px] leading-tight text-white/45 [&_a]:text-sky-300/70"
      />

      {(windLoading || windError) && state.showFlow && (
        <div className="pointer-events-none absolute bottom-28 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[10px] text-white/60 backdrop-blur md:bottom-24">
          {windError ? `Wind vectors: ${windError}` : 'Loading 10 m wind vectors…'}
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-abyss/90 p-6">
          <div className="glass max-w-md rounded-2xl p-6 text-center">
            <p className="font-display text-lg text-white">The 3D globe could not start</p>
            <p className="mt-2 text-sm text-muted">{error}</p>
            <p className="mt-4 text-xs text-faint">
              EarthTrend 3D needs WebGL. Try a current version of Chrome, Edge, Firefox or Safari with hardware
              acceleration enabled.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}