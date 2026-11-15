import { useEffect, useRef, useState } from 'react'
import type { GeoJsonDataSource, Scene, Viewer } from 'cesium'
import { useApp } from '../../state/AppContext'
import {
  admin2Available,
  loadAdmin1,
  loadAdmin2,
  loadCountries,
  loadGeoIndex,
} from '../../services/geo'
import { registerGeoResolver } from '../../services/geo/selection'
import type { GeoCountry, GeoDivision, GeoIndex } from '../../services/geo/types'
import { PLACES } from '../../data/locations'
import {
  altitudeToViewLevel,
  bboxSpanKm,
  findCountryAt,
  findDivisionAt,
  placeFromCountry,
  placeFromDivision,
  resolveLabelCollisions,
  type GeoViewLevel,
  type LabelRect,
  type Rect,
} from '../../utils/geo'

type CesiumApi = typeof import('cesium')

interface GlobeGeographyProps {
  viewer: Viewer | null
  cesium: CesiumApi | null
}

interface Admin1State {
  iso3: string
  divisions: GeoDivision[]
}

interface Admin2State {
  iso3: string
  units: GeoDivision[]
}

interface ViewState {
  level: GeoViewLevel
  iso3: string | null
}

const ADMIN0_STROKE = '#7dd3fc'
const ADMIN1_STROKE = '#67e8f9'
const ADMIN2_STROKE = '#a7f3d0'

const CONTINENTS: Array<{ name: string; lon: number; lat: number }> = [
  { name: 'Africa', lon: 21, lat: 6 },
  { name: 'Europe', lon: 18, lat: 54 },
  { name: 'Asia', lon: 96, lat: 36 },
  { name: 'North America', lon: -101, lat: 46 },
  { name: 'South America', lon: -60, lat: -14 },
  { name: 'Oceania', lon: 140, lat: -25 },
  { name: 'Antarctica', lon: 0, lat: -78 },
]

const CITY_PLACES = PLACES.filter((place) => place.kind === 'city' || place.kind === 'town')

function toWindow(scene: Scene, cesium: CesiumApi, lon: number, lat: number) {
  const position = cesium.Cartesian3.fromDegrees(lon, lat, 0)
  const transforms = cesium.SceneTransforms as unknown as {
    worldToWindowCoordinates?: (scene: Scene, position: unknown) => { x: number; y: number } | undefined
    wgs84ToWindowCoordinates?: (scene: Scene, position: unknown) => { x: number; y: number } | undefined
  }
  const project = transforms.worldToWindowCoordinates ?? transforms.wgs84ToWindowCoordinates
  if (!project) return null
  return project(scene, position) ?? null
}

function groundPoint(viewer: Viewer, cesium: CesiumApi): { lon: number; lat: number } {
  const scene = viewer.scene
  const canvas = scene.canvas
  const center = new cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2)
  const ray = scene.camera.getPickRay(center)
  if (ray) {
    const cartesian = scene.globe.pick(ray, scene)
    if (cartesian) {
      const carto = cesium.Cartographic.fromCartesian(cartesian)
      return {
        lon: cesium.Math.toDegrees(carto.longitude),
        lat: cesium.Math.toDegrees(carto.latitude),
      }
    }
  }
  const carto = viewer.camera.positionCartographic
  return {
    lon: cesium.Math.toDegrees(carto.longitude),
    lat: cesium.Math.toDegrees(carto.latitude),
  }
}

function featureCollection(
  items: ReadonlyArray<{ id: string; geometry: unknown }>,
): { type: 'FeatureCollection'; features: Array<{ type: 'Feature'; properties: { id: string }; geometry: unknown }> } {
  return {
    type: 'FeatureCollection',
    features: items.map((item) => ({
      type: 'Feature',
      properties: { id: item.id },
      geometry: item.geometry,
    })),
  }
}

export default function GlobeGeography({ viewer, cesium }: GlobeGeographyProps) {
  const { state } = useApp()
  const [index, setIndex] = useState<GeoIndex | null>(null)
  const [countries, setCountries] = useState<GeoCountry[] | null>(null)
  const [admin1, setAdmin1] = useState<Admin1State | null>(null)
  const [admin2, setAdmin2] = useState<Admin2State | null>(null)
  const [view, setView] = useState<ViewState>({ level: 'global', iso3: null })
  const [labels, setLabels] = useState<LabelRect[]>([])
  const [loading, setLoading] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const countriesRef = useRef<GeoCountry[] | null>(null)
  const admin1Ref = useRef<Admin1State | null>(null)
  const admin2Ref = useRef<Admin2State | null>(null)
  const viewRef = useRef<ViewState & { lon: number; lat: number }>({ level: 'global', iso3: null, lon: 0, lat: 0 })
  const selectedRef = useRef(state.place)

  const admin0SourceRef = useRef<GeoJsonDataSource | null>(null)
  const admin1SourceRef = useRef<GeoJsonDataSource | null>(null)
  const admin2SourceRef = useRef<GeoJsonDataSource | null>(null)
  const highlightRef = useRef<GeoJsonDataSource | null>(null)

  // Latest-value refs used by the Cesium render loop and the click resolver.
  // Written in effects rather than during render so React stays the owner.
  useEffect(() => {
    selectedRef.current = state.place
  }, [state.place])

  useEffect(() => {
    admin1Ref.current = admin1
    admin2Ref.current = admin2
  }, [admin1, admin2])

  // --- Load the compact country payload and the coverage index ---------------
  useEffect(() => {
    if (!viewer || !cesium) return
    let cancelled = false
    Promise.all([loadGeoIndex(), loadCountries()])
      .then(([idx, list]) => {
        if (cancelled) return
        setIndex(idx)
        setCountries(list)
        countriesRef.current = list
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [viewer, cesium])

  // --- Country outlines ------------------------------------------------------
  useEffect(() => {
    if (!viewer || !cesium || !countries) return
    let cancelled = false
    const collection = featureCollection(countries)

    cesium.GeoJsonDataSource.load(collection as never, {
      stroke: cesium.Color.fromCssColorString(ADMIN0_STROKE).withAlpha(0.62),
      strokeWidth: 1.4,
      fill: cesium.Color.TRANSPARENT,
      clampToGround: false,
      markerSize: 0,
    })
      .then((source) => {
        if (cancelled) return
        viewer.dataSources.add(source)
        admin0SourceRef.current = source
        viewer.scene.requestRender()
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
      const source = admin0SourceRef.current
      if (source) {
        try {
          viewer.dataSources.remove(source, true)
        } catch {
          /* viewer may already be destroyed */
        }
        admin0SourceRef.current = null
      }
    }
  }, [viewer, cesium, countries])

  // --- First-level boundaries for the focused country ------------------------
  useEffect(() => {
    if (!viewer || !cesium) return
    let cancelled = false
    const previous = admin1SourceRef.current
    if (previous) {
      try {
        viewer.dataSources.remove(previous, true)
      } catch {
        /* ignore */
      }
      admin1SourceRef.current = null
    }
    if (!admin1 || admin1.iso3 !== view.iso3 || !admin1.divisions.length) {
      viewer.scene.requestRender()
      return
    }

    const collection = featureCollection(admin1.divisions)
    cesium.GeoJsonDataSource.load(collection as never, {
      stroke: cesium.Color.fromCssColorString(ADMIN1_STROKE).withAlpha(0.5),
      strokeWidth: 1.2,
      fill: cesium.Color.TRANSPARENT,
      clampToGround: false,
      markerSize: 0,
    })
      .then((source) => {
        if (cancelled) return
        viewer.dataSources.add(source)
        admin1SourceRef.current = source
        viewer.scene.requestRender()
      })
      .catch(() => {
        /* keep country outlines if this fails */
      })

    return () => {
      cancelled = true
    }
  }, [viewer, cesium, admin1, view.iso3])

  // --- Second-level boundaries ----------------------------------------------
  useEffect(() => {
    if (!viewer || !cesium) return
    let cancelled = false
    const previous = admin2SourceRef.current
    if (previous) {
      try {
        viewer.dataSources.remove(previous, true)
      } catch {
        /* ignore */
      }
      admin2SourceRef.current = null
    }
    if (!admin2 || admin2.iso3 !== view.iso3 || !admin2.units.length) {
      viewer.scene.requestRender()
      return
    }

    const collection = featureCollection(admin2.units)
    cesium.GeoJsonDataSource.load(collection as never, {
      stroke: cesium.Color.fromCssColorString(ADMIN2_STROKE).withAlpha(0.4),
      strokeWidth: 1,
      fill: cesium.Color.TRANSPARENT,
      clampToGround: false,
      markerSize: 0,
    })
      .then((source) => {
        if (cancelled) return
        viewer.dataSources.add(source)
        admin2SourceRef.current = source
        viewer.scene.requestRender()
      })
      .catch(() => {
        /* the UI still explains that this level is unavailable */
      })

    return () => {
      cancelled = true
    }
  }, [viewer, cesium, admin2, view.iso3])

  // --- Ask for boundary data as the camera moves ----------------------------
  useEffect(() => {
    if (!countries || !index) return
    if (view.level === 'global' || !view.iso3) {
      setAdmin1(null)
      setAdmin2(null)
      return
    }
    if (admin1?.iso3 === view.iso3) {
      // already have it
    } else {
      let cancelled = false
      setLoading('Loading states / provinces…')
      loadAdmin1(view.iso3)
        .then((divisions) => {
          if (!cancelled) setAdmin1({ iso3: view.iso3 as string, divisions })
        })
        .catch(() => {
          if (!cancelled) setAdmin1({ iso3: view.iso3 as string, divisions: [] })
        })
        .finally(() => {
          if (!cancelled) setLoading(null)
        })
      return () => {
        cancelled = true
      }
    }
  }, [view, countries, index, admin1?.iso3])

  useEffect(() => {
    if (!index || !view.iso3) {
      setAdmin2(null)
      return
    }
    if (view.level !== 'state' && view.level !== 'local') {
      setAdmin2(null)
      return
    }
    if (!admin2Available(index, view.iso3)) {
      setAdmin2(null)
      return
    }
    if (admin2?.iso3 === view.iso3) return

    let cancelled = false
    setLoading('Loading districts / counties…')
    loadAdmin2(view.iso3)
      .then((payload) => {
        if (!cancelled) setAdmin2({ iso3: view.iso3 as string, units: payload.units })
      })
      .catch(() => {
        if (!cancelled) setAdmin2(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(null)
      })
    return () => {
      cancelled = true
    }
  }, [view, index, admin2?.iso3])

  // --- Selection highlight ---------------------------------------------------
  useEffect(() => {
    if (!viewer || !cesium) return
    const previous = highlightRef.current
    if (previous) {
      try {
        viewer.dataSources.remove(previous, true)
      } catch {
        /* ignore */
      }
      highlightRef.current = null
    }

    const place = state.place
    if (!place.geoId || place.adminLevel === undefined || place.adminLevel === 3) {
      viewer.scene.requestRender()
      return
    }

    let geometry: GeoDivision['geometry'] | GeoCountry['geometry'] | null = null
    if (place.adminLevel === 0) {
      geometry = countriesRef.current?.find((entry) => entry.iso3 === place.geoId)?.geometry ?? null
    } else if (place.adminLevel === 1) {
      geometry = admin1Ref.current?.divisions.find((entry) => entry.id === place.geoId)?.geometry ?? null
    } else if (place.adminLevel === 2) {
      geometry = admin2Ref.current?.units.find((entry) => entry.id === place.geoId)?.geometry ?? null
    }
    if (!geometry) {
      viewer.scene.requestRender()
      return
    }

    const collection = featureCollection([{ id: place.geoId, geometry }])
    cesium.GeoJsonDataSource.load(collection as never, {
      stroke: cesium.Color.fromCssColorString('#7dd3fc').withAlpha(0.95),
      strokeWidth: 2.4,
      fill: cesium.Color.fromCssColorString('#38bdf8').withAlpha(0.16),
      clampToGround: false,
      markerSize: 0,
    })
      .then((source) => {
        viewer.dataSources.add(source)
        highlightRef.current = source
        viewer.scene.requestRender()
      })
      .catch(() => {
        /* highlight is cosmetic */
      })
  }, [viewer, cesium, state.place, admin1, admin2])

  // --- Click → real administrative place ------------------------------------
  useEffect(() => {
    return registerGeoResolver((lon, lat) => {
      const list = countriesRef.current
      if (!list) return null
      const country = findCountryAt(list, lon, lat)
      if (!country) return null
      const level = viewRef.current.level

      const second = admin2Ref.current
      if ((level === 'state' || level === 'local') && second && second.iso3 === country.iso3) {
        const unit = findDivisionAt(second.units, lon, lat)
        if (unit) {
          const first = admin1Ref.current
          // Prefer the parent recorded at build time (a point-in-polygon test
          // against level-1 geometry); fall back to testing the label point.
          const parent =
            first && first.iso3 === country.iso3
              ? (unit.parent ? first.divisions.find((d) => d.id === unit.parent) : undefined) ??
                findDivisionAt(first.divisions, unit.label[0], unit.label[1]) ??
                undefined
              : undefined
          return placeFromDivision(unit, 2, { country, parent })
        }
      }

      const first = admin1Ref.current
      if (level !== 'global' && first && first.iso3 === country.iso3) {
        const division = findDivisionAt(first.divisions, lon, lat)
        if (division) return placeFromDivision(division, 1, { country })
      }

      return placeFromCountry(country)
    })
  }, [])

  // --- Camera tracking + labels ---------------------------------------------
  useEffect(() => {
    if (!viewer || !cesium || !countries) return
    const scene = viewer.scene
    let lastUpdate = 0
    let disposed = false

    const updateLabels = () => {
      if (disposed) return
      const canvas = scene.canvas
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (!width || !height) return

      const level = viewRef.current.level
      const iso3 = viewRef.current.iso3
      const selectedId = selectedRef.current.geoId
      const occluder = new cesium.EllipsoidalOccluder(scene.globe.ellipsoid, viewer.camera.positionWC)

      let rect: { west: number; south: number; east: number; north: number } | null = null
      try {
        const viewRect = viewer.camera.computeViewRectangle(scene.globe.ellipsoid)
        if (viewRect) {
          rect = {
            west: cesium.Math.toDegrees(viewRect.west),
            south: cesium.Math.toDegrees(viewRect.south),
            east: cesium.Math.toDegrees(viewRect.east),
            north: cesium.Math.toDegrees(viewRect.north),
          }
        }
      } catch {
        rect = null
      }
      const worldWide = !rect || rect.east - rect.west > 180

      const bounds = rect
      const visible = (bbox: [number, number, number, number]) => {
        if (worldWide || !bounds) return true
        const [west, south, east, north] = bbox
        return !(east < bounds.west || west > bounds.east || north < bounds.south || south > bounds.north)
      }

      const candidates: LabelRect[] = []

      // Labels must not sit under the header, side panels, breadcrumb or
      // timeline. Measured from the live DOM so it follows responsive layout.
      const margin = 8
      const blocked: Rect[] = []
      for (const element of document.querySelectorAll<HTMLElement>(
        'header, aside[aria-label="Data layers"], aside[aria-label="Location analysis"], ' +
          'nav[aria-label="Administrative hierarchy"], [data-overlay="timeline"]',
      )) {
        const box = element.getBoundingClientRect()
        if (box.width < 4 || box.height < 4) continue
        blocked.push({
          x0: box.left - margin,
          y0: box.top - margin,
          x1: box.right + margin,
          y1: box.bottom + margin,
        })
      }
      const isBlocked = (x: number, y: number) =>
        blocked.some((box) => x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1)

      const push = (
        id: string,
        name: string,
        lon: number,
        lat: number,
        priority: number,
        kind: string,
        selected: boolean,
        size: number,
        meta?: string,
      ) => {
        const point = toWindow(scene, cesium, lon, lat)
        if (!point) return
        if (point.x < -40 || point.y < -40 || point.x > width + 40 || point.y > height + 40) return
        // A label under a panel is invisible; do not let it consume collision space.
        if (!selected && isBlocked(point.x, point.y)) return
        const cartesian = cesium.Cartesian3.fromDegrees(lon, lat, 0)
        if (!occluder.isPointVisible(cartesian)) return
        candidates.push({
          id,
          name,
          x: point.x,
          y: point.y,
          w: Math.max(26, name.length * size * 0.56 + 14),
          h: size + 8,
          priority,
          kind,
          selected,
          meta,
        })
      }

      if (level === 'global') {
        for (const continent of CONTINENTS) {
          push(`continents:${continent.name}`, continent.name, continent.lon, continent.lat, 950, 'continent', false, 14)
        }
      }

      for (const country of countriesRef.current ?? []) {
        if (!visible(country.bbox)) continue
        if (level === 'global' && bboxSpanKm(country.bbox) < 380 && (country.population ?? 0) < 6_000_000) {
          continue
        }
        const selected = selectedRef.current.adminLevel === 0 && selectedId === country.iso3
        const priority =
          selected
            ? 10_000
            : 500 + Math.min(120, Math.log10((country.population ?? 1000) + 10) * 24)
        push(
          `country:${country.iso3}`,
          country.name,
          country.label[0],
          country.label[1],
          priority,
          'country',
          selected,
          level === 'global' ? 12 : 11,
        )
      }

      const first = admin1Ref.current
      if (first && first.iso3 === iso3 && level !== 'global') {
        for (const division of first.divisions) {
          if (!visible(division.bbox)) continue
          const selected = selectedRef.current.adminLevel === 1 && selectedId === division.id
          push(
            `a1:${division.id}`,
            division.name,
            division.label[0],
            division.label[1],
            selected ? 9_000 : 700,
            'state',
            selected,
            11,
          )
        }
      }

      const second = admin2Ref.current
      if (second && second.iso3 === iso3 && (level === 'state' || level === 'local')) {
        for (const unit of second.units) {
          if (!visible(unit.bbox)) continue
          const selected = selectedRef.current.adminLevel === 2 && selectedId === unit.id
          push(
            `a2:${unit.id}`,
            unit.name,
            unit.label[0],
            unit.label[1],
            selected ? 8_000 : 400,
            'district',
            selected,
            level === 'local' ? 10 : 9,
          )
        }
      }

      if (level === 'local') {
        for (const place of CITY_PLACES) {
          if (!rect) continue
          const point = { lon: place.lon, lat: place.lat }
          if (
            !worldWide &&
            (point.lon < rect.west || point.lon > rect.east || point.lat < rect.south || point.lat > rect.north)
          ) {
            continue
          }
          const selected = selectedRef.current.id === place.id
          push(
            `city:${place.id}`,
            place.name,
            place.lon,
            place.lat,
            selected ? 7_000 : place.kind === 'city' ? 260 : 220,
            place.kind,
            selected,
            place.kind === 'city' ? 10 : 9,
          )
        }
      }

      setLabels(resolveLabelCollisions(candidates, { width, height }, 3))
    }

    const onPostRender = () => {
      if (disposed) return
      const now = performance.now()
      if (now - lastUpdate < 120) return
      lastUpdate = now

      const height = viewer.camera.positionCartographic.height
      const level = altitudeToViewLevel(height)
      const center = groundPoint(viewer, cesium)
      const country = findCountryAt(countries, center.lon, center.lat)
      const next: ViewState = { level, iso3: country?.iso3 ?? null }
      const previous = viewRef.current
      viewRef.current = { ...next, lon: center.lon, lat: center.lat }
      if (previous.level !== next.level || previous.iso3 !== next.iso3) {
        setView(next)
      }

      updateLabels()
    }

    scene.postRender.addEventListener(onPostRender)
    scene.requestRender()
    return () => {
      disposed = true
      scene.postRender.removeEventListener(onPostRender)
    }
  }, [viewer, cesium, countries])

  // Labels need to refresh when the selected place or loaded levels change,
  // even if the camera is perfectly still.
  useEffect(() => {
    viewer?.scene.requestRender()
  }, [viewer, state.place, admin1, admin2, view.level])

  if (failed) return null

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
        {labels.map((label) => {
          const selected = label.selected
          const base =
            'absolute whitespace-nowrap rounded-[4px] border px-1.5 py-[1px] text-center leading-tight'
          const tone =
            label.kind === 'continent'
              ? 'border-white/10 bg-[#04060b]/45 font-semibold tracking-[0.18em] text-sky-100/75 uppercase'
              : label.kind === 'country'
                ? 'border-white/10 bg-[#06101f]/72 text-slate-100'
                : label.kind === 'state'
                  ? 'border-cyan-300/20 bg-[#06101f]/58 text-cyan-100'
                  : label.kind === 'district'
                    ? 'border-emerald-300/20 bg-[#06101f]/48 text-emerald-100/90'
                    : 'border-transparent bg-[#04060b]/40 text-sky-100/85'
          const highlight = selected ? ' border-sky-300/70 bg-sky-400/25 text-white shadow-[0_0_12px_rgba(56,189,248,0.45)]' : ''
          return (
            <div
              key={label.id}
              className={`${base} ${tone}${highlight}`}
              style={{
                left: `${label.x}px`,
                top: `${label.y}px`,
                transform: 'translate(-50%, -50%)',
                fontSize: `${label.kind === 'continent' ? 10 : label.kind === 'country' ? 11 : 10}px`,
                letterSpacing: label.kind === 'continent' ? '0.18em' : undefined,
              }}
            >
              {label.name}
            </div>
          )
        })}
      </div>

      {loading && (
        <div className="pointer-events-none absolute bottom-28 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[10px] text-white/60 backdrop-blur md:bottom-24">
          {loading}
        </div>
      )}
    </>
  )
}
