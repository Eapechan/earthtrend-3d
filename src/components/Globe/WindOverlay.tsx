import { useEffect, useRef } from 'react'
import type { Viewer } from 'cesium'
import type { WindField } from '../../types'

type CesiumApi = typeof import('cesium')

interface WindOverlayProps {
  viewer: Viewer | null
  cesium: CesiumApi | null
  field: WindField | null
  enabled: boolean
  reducedMotion: boolean
  isMobile: boolean
}

interface Particle {
  lat: number
  lon: number
  age: number
  maxAge: number
  lastScreen: { x: number; y: number } | null
}

const EARTH_RADIUS_M = 6_371_000

function speedColor(speed: number): string {
  // The wind raster is a pale pastel, so dark vectors read best; high speeds
  // shift towards deep violet to preserve the official speed ramp's ordering.
  if (speed < 3) return '17, 53, 79'
  if (speed < 7) return '12, 74, 110'
  if (speed < 12) return '13, 68, 128'
  return '91, 33, 133'
}

const LAT_ORIGIN = -75
const LON_ORIGIN = -180

function wrapLon(index: number, lonCount: number): number {
  return ((index % lonCount) + lonCount) % lonCount
}

function windAt(
  lat: number,
  lon: number,
  map: Map<string, { u: number; v: number; speed: number }>,
  step: number,
): { u: number; v: number; speed: number } | null {
  const lonCount = Math.round(360 / step)
  const maxLatIndex = Math.round(150 / step)
  const rawLat = Math.min(maxLatIndex, Math.max(0, (lat - LAT_ORIGIN) / step))
  const rawLon = (lon - LON_ORIGIN) / step
  const lat0 = Math.min(maxLatIndex - 1, Math.floor(rawLat))
  const lon0 = Math.floor(rawLon)
  const tLat = rawLat - lat0
  const tLon = rawLon - lon0

  const corners = [
    { w: (1 - tLat) * (1 - tLon), key: `${lat0}:${wrapLon(lon0, lonCount)}` },
    { w: (1 - tLat) * tLon, key: `${lat0}:${wrapLon(lon0 + 1, lonCount)}` },
    { w: tLat * (1 - tLon), key: `${lat0 + 1}:${wrapLon(lon0, lonCount)}` },
    { w: tLat * tLon, key: `${lat0 + 1}:${wrapLon(lon0 + 1, lonCount)}` },
  ]

  let u = 0
  let v = 0
  let weight = 0
  for (const corner of corners) {
    const sample = map.get(corner.key)
    if (!sample) continue
    u += sample.u * corner.w
    v += sample.v * corner.w
    weight += corner.w
  }
  if (weight > 0.001) {
    const speed = Math.hypot(u / weight, v / weight)
    return { u: u / weight, v: v / weight, speed }
  }

  // Off-grid (beyond ±75°) — fall back to the nearest row and column.
  const nearest = map.get(`${Math.round(rawLat)}:${wrapLon(Math.round(rawLon), lonCount)}`)
  return nearest ?? null
}

export default function WindOverlay({
  viewer,
  cesium,
  field,
  enabled,
  reducedMotion,
  isMobile,
}: WindOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const clear = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, Math.round(rect.width * Math.min(window.devicePixelRatio || 1, 2)))
      canvas.height = Math.max(1, Math.round(rect.height * Math.min(window.devicePixelRatio || 1, 2)))
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    clear()
    if (!enabled || !field || !viewer || !cesium) return

    const Cesium = cesium
    const scene = viewer.scene
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const map = new Map<string, { u: number; v: number; speed: number }>()
    const lonCount = Math.round(360 / field.stepDeg)
    for (const sample of field.samples) {
      const latIndex = Math.round((sample.lat - LAT_ORIGIN) / field.stepDeg)
      const lonIndex = wrapLon(Math.round((sample.lon - LON_ORIGIN) / field.stepDeg), lonCount)
      map.set(`${latIndex}:${lonIndex}`, { u: sample.u, v: sample.v, speed: sample.speed })
    }

    let width = 0
    let height = 0
    let raf = 0
    let disposed = false

    const sizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    sizeCanvas()

    const scratch = new Cesium.Cartesian2()
    const cameraDir = new Cesium.Cartesian3()
    const pointDir = new Cesium.Cartesian3()

    const visible = (cartesian: InstanceType<CesiumApi['Cartesian3']>) => {
      const cameraPosition = scene.camera.positionWC
      const distance = Cesium.Cartesian3.magnitude(cameraPosition)
      const altitude = Math.max(1, distance - EARTH_RADIUS_M)
      const horizon = EARTH_RADIUS_M / (EARTH_RADIUS_M + altitude) - 0.0015
      Cesium.Cartesian3.normalize(cameraPosition, cameraDir)
      Cesium.Cartesian3.normalize(cartesian, pointDir)
      return Cesium.Cartesian3.dot(cameraDir, pointDir) > horizon
    }

    const project = (cartesian: InstanceType<CesiumApi['Cartesian3']>) => {
      const result = Cesium.SceneTransforms.worldToWindowCoordinates(scene, cartesian, scratch)
      if (!result) return null
      if (result.x < -40 || result.y < -40 || result.x > width + 40 || result.y > height + 40) return null
      return { x: result.x, y: result.y }
    }

    // ---- Reduced motion: a static, legible vector field ---------------------
    if (reducedMotion) {
      const drawArrows = () => {
        if (disposed) return
        ctx.clearRect(0, 0, width, height)

        // Sample a screen-space lattice and invert each point onto the globe.
        // This keeps arrow density constant at every zoom level instead of
        // relying on the coarse lat/lon grid of the Open-Meteo samples.
        const spacing = isMobile ? 44 : 46
        const carto = new Cesium.Cartographic()
        const scratch2 = new Cesium.Cartesian2()

        for (let y = spacing / 2; y < height; y += spacing) {
          for (let x = spacing / 2; x < width; x += spacing) {
            Cesium.Cartesian2.fromElements(x, y, scratch2)
            const cartesian = scene.camera.pickEllipsoid(scratch2, scene.globe.ellipsoid)
            if (!cartesian) continue
            Cesium.Cartographic.fromCartesian(cartesian, scene.globe.ellipsoid, carto)
            const lat = Cesium.Math.toDegrees(carto.latitude)
            const lon = Cesium.Math.toDegrees(carto.longitude)
            const wind = windAt(lat, lon, map, field.stepDeg)
            if (!wind || wind.speed < 0.35) continue

            // Local east/north basis, projected to screen space so the arrows
            // follow the globe's orientation rather than a flat map's.
            const base = project(cartesian)
            const east = project(Cesium.Cartesian3.fromDegrees(lon + 0.05, lat, 0))
            const north = project(Cesium.Cartesian3.fromDegrees(lon, lat + 0.05, 0))
            if (!base || !east || !north) continue
            let ex = east.x - base.x
            let ey = east.y - base.y
            let nx = north.x - base.x
            let ny = north.y - base.y
            const eLen = Math.hypot(ex, ey)
            const nLen = Math.hypot(nx, ny)
            if (eLen < 0.01 || nLen < 0.01) continue
            ex /= eLen
            ey /= eLen
            nx /= nLen
            ny /= nLen

            let dx = wind.u * ex + wind.v * nx
            let dy = wind.u * ey + wind.v * ny
            const magnitude = Math.hypot(dx, dy)
            if (magnitude < 0.001) continue
            const length = Math.min(30, 8 + wind.speed * 1.55)
            dx = (dx / magnitude) * length
            dy = (dy / magnitude) * length
            const angle = Math.atan2(dy, dx)
            const head = Math.min(6, 2.8 + wind.speed * 0.24)

            // Pale halo keeps the dark vector legible on both light rasters
            // and darker true-colour imagery.
            ctx.strokeStyle = 'rgba(240, 249, 255, 0.45)'
            ctx.lineWidth = 2.8
            ctx.beginPath()
            ctx.moveTo(base.x - dx / 2, base.y - dy / 2)
            ctx.lineTo(base.x + dx / 2, base.y + dy / 2)
            ctx.stroke()

            ctx.strokeStyle = `rgba(${speedColor(wind.speed)}, 0.88)`
            ctx.fillStyle = `rgba(${speedColor(wind.speed)}, 0.88)`
            ctx.lineWidth = 1.25
            ctx.beginPath()
            ctx.moveTo(base.x - dx / 2, base.y - dy / 2)
            ctx.lineTo(base.x + dx / 2, base.y + dy / 2)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(base.x + dx / 2, base.y + dy / 2)
            ctx.lineTo(
              base.x + dx / 2 - head * Math.cos(angle - 0.45),
              base.y + dy / 2 - head * Math.sin(angle - 0.45),
            )
            ctx.lineTo(
              base.x + dx / 2 - head * Math.cos(angle + 0.45),
              base.y + dy / 2 - head * Math.sin(angle + 0.45),
            )
            ctx.closePath()
            ctx.fill()
          }
        }
      }
      drawArrows()
      scene.postRender.addEventListener(drawArrows)
      const onResize = () => {
        sizeCanvas()
        drawArrows()
      }
      window.addEventListener('resize', onResize)
      return () => {
        disposed = true
        scene.postRender.removeEventListener(drawArrows)
        window.removeEventListener('resize', onResize)
      }
    }

    // ---- Motion: advected particles over the real vector grid ---------------
    // Particles are moved in *screen space* along the real wind direction and
    // then re-projected onto the ellipsoid. Geographic advection at true 10 m
    // wind speed is sub-pixel at globe zoom, which made the layer look empty;
    // this keeps the direction honest while making the motion legible at any
    // zoom. The About panel states that speed and trails are illustrative.
    const count = isMobile ? 170 : 340
    const particles: Particle[] = Array.from({ length: count }, () => ({
      lat: 0,
      lon: 0,
      age: 0,
      maxAge: 8 + Math.random() * 10,
      lastScreen: null,
    }))

    const carto = new Cesium.Cartographic()
    const pickScratch = new Cesium.Cartesian2()
    const up = new Cesium.Cartesian3()
    const east = new Cesium.Cartesian3()
    const north = new Cesium.Cartesian3()
    const tangentA = new Cesium.Cartesian3()
    const tangentB = new Cesium.Cartesian3()
    const screenDir = new Cesium.Cartesian3()

    const resetParticle = (particle: Particle, initial: boolean) => {
      for (let attempt = 0; attempt < 14; attempt += 1) {
        const x = Math.random() * width
        const y = Math.random() * height
        Cesium.Cartesian2.fromElements(x, y, pickScratch)
        const cartesian = scene.camera.pickEllipsoid(pickScratch, scene.globe.ellipsoid)
        if (!cartesian) continue
        Cesium.Cartographic.fromCartesian(cartesian, scene.globe.ellipsoid, carto)
        const lat = Cesium.Math.toDegrees(carto.latitude)
        const lon = Cesium.Math.toDegrees(carto.longitude)
        const wind = windAt(lat, lon, map, field.stepDeg)
        if (!wind || wind.speed < 0.35) continue
        particle.lat = lat
        particle.lon = lon
        particle.maxAge = 8 + Math.random() * 10
        particle.age = initial ? Math.random() * particle.maxAge * 0.8 : 0
        particle.lastScreen = null
        return true
      }
      return false
    }

    for (const particle of particles) resetParticle(particle, true)

    let last = performance.now()

    const cameraPosition = new Cesium.Cartesian3()
    const cameraDirection = new Cesium.Cartesian3()
    Cesium.Cartesian3.clone(scene.camera.positionWC, cameraPosition)
    Cesium.Cartesian3.clone(scene.camera.directionWC, cameraDirection)

    const frame = (now: number) => {
      if (disposed) return
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000))
      last = now

      // Panning or zooming re-projects every particle. Drop the previous
      // screen points so no segment is drawn across an unrelated part of the
      // globe while the camera moves.
      const moved =
        Cesium.Cartesian3.distance(scene.camera.positionWC, cameraPosition) > 2 ||
        Cesium.Cartesian3.dot(scene.camera.directionWC, cameraDirection) < 0.999999
      if (moved) {
        for (const particle of particles) particle.lastScreen = null
        Cesium.Cartesian3.clone(scene.camera.positionWC, cameraPosition)
        Cesium.Cartesian3.clone(scene.camera.directionWC, cameraDirection)
      }

      // Fade the previous frame instead of clearing it: this leaves short,
      // comet-like trails without tinting the globe underneath.
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.2, 0.045 * (dt / 0.0167)).toFixed(3)})`
      ctx.fillRect(0, 0, width, height)
      ctx.globalCompositeOperation = 'source-over'
      ctx.lineCap = 'round'

      const camRight = scene.camera.rightWC
      const camUp = scene.camera.upWC

      for (const particle of particles) {
        particle.age += dt
        if (particle.age > particle.maxAge) resetParticle(particle, false)

        const wind = windAt(particle.lat, particle.lon, map, field.stepDeg)
        if (!wind) {
          particle.lastScreen = null
          resetParticle(particle, false)
          continue
        }

        const cartesian = Cesium.Cartesian3.fromDegrees(particle.lon, particle.lat, 0)
        if (!visible(cartesian)) {
          particle.lastScreen = null
          resetParticle(particle, false)
          continue
        }
        const screen = project(cartesian)
        if (!screen) {
          particle.lastScreen = null
          resetParticle(particle, false)
          continue
        }

        // Build the local east/north basis, then take its screen-space
        // direction from the camera's right/up vectors.
        Cesium.Cartesian3.normalize(cartesian, up)
        Cesium.Cartesian3.cross(Cesium.Cartesian3.UNIT_Z, up, east)
        const eastLength = Cesium.Cartesian3.magnitude(east)
        if (eastLength < 1e-6) {
          particle.lastScreen = null
          continue
        }
        Cesium.Cartesian3.divideByScalar(east, eastLength, east)
        Cesium.Cartesian3.cross(up, east, north)

        Cesium.Cartesian3.multiplyByScalar(east, wind.u, tangentA)
        Cesium.Cartesian3.multiplyByScalar(north, wind.v, tangentB)
        Cesium.Cartesian3.add(tangentA, tangentB, screenDir)

        let dx = Cesium.Cartesian3.dot(screenDir, camRight)
        let dy = -Cesium.Cartesian3.dot(screenDir, camUp)
        const magnitude = Math.hypot(dx, dy)
        if (magnitude < 1e-6) {
          particle.lastScreen = null
          continue
        }
        dx /= magnitude
        dy /= magnitude

        // Screen speed, not physical ground speed. Calm air creeps, strong
        // jets stream; the cap keeps the layer readable while panning.
        const pxPerSecond = Math.min(150, 24 + wind.speed * 5)
        const stepPx = Math.min(24, pxPerSecond * dt)
        const nextX = screen.x + dx * stepPx
        const nextY = screen.y + dy * stepPx
        if (nextX < 0 || nextY < 0 || nextX > width || nextY > height) {
          particle.lastScreen = null
          resetParticle(particle, false)
          continue
        }

        Cesium.Cartesian2.fromElements(nextX, nextY, pickScratch)
        const next = scene.camera.pickEllipsoid(pickScratch, scene.globe.ellipsoid)
        if (!next) {
          particle.lastScreen = null
          resetParticle(particle, false)
          continue
        }
        Cesium.Cartographic.fromCartesian(next, scene.globe.ellipsoid, carto)
        particle.lat = Cesium.Math.toDegrees(carto.latitude)
        particle.lon = Cesium.Math.toDegrees(carto.longitude)

        if (particle.lastScreen) {
          const previous = particle.lastScreen
          const exitFade = Math.min(1, (particle.maxAge - particle.age) / 1.2)
          const rgb = speedColor(wind.speed)

          ctx.strokeStyle = `rgba(240, 249, 255, ${(0.18 * exitFade).toFixed(3)})`
          ctx.lineWidth = 3.4
          ctx.beginPath()
          ctx.moveTo(previous.x, previous.y)
          ctx.lineTo(nextX, nextY)
          ctx.stroke()

          ctx.strokeStyle = `rgba(${rgb}, ${(0.85 * exitFade).toFixed(3)})`
          ctx.lineWidth = 1.35
          ctx.beginPath()
          ctx.moveTo(previous.x, previous.y)
          ctx.lineTo(nextX, nextY)
          ctx.stroke()
        }
        particle.lastScreen = { x: nextX, y: nextY }
      }
    }

    raf = requestAnimationFrame(frame)

    const onResize = () => {
      sizeCanvas()
      for (const particle of particles) {
        particle.lastScreen = null
        resetParticle(particle, false)
      }
    }
    window.addEventListener('resize', onResize)
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [viewer, cesium, field, enabled, reducedMotion, isMobile])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      aria-hidden="true"
    />
  )
}
