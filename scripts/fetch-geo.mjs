/**
 * Downloads open administrative boundary data and turns it into small,
 * progressive per-country payloads under public/geo.
 *
 * Sources (verified licences):
 *  - Natural Earth admin-0 countries, 1:50m      — public domain
 *  - Natural Earth admin-1 states/provinces, 1:10m — public domain
 *  - geoBoundaries ADM2 (districts/counties)      — ODbL 1.0 / CC BY 4.0,
 *    per-country, only for a curated set of countries with good coverage.
 *
 * Output is NOT committed: it is rebuilt by `npm run geo` (also run from
 * `npm run build`) and self-hosted from the same origin, so no third-party CDN
 * is required at runtime. Every network step is non-fatal: if a download fails
 * and previous output exists, the previous output is kept and the app still
 * works (missing levels are simply reported as unavailable in the UI).
 */
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const CACHE = path.join(ROOT, '.geocache')
const OUT = path.join(ROOT, 'public', 'geo')

const SOURCES = {
  admin0: {
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson',
    file: 'admin0.geojson',
    license: 'Public domain (Natural Earth)',
  },
  admin1: {
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson',
    file: 'admin1_10m.geojson',
    license: 'Public domain (Natural Earth)',
  },
}

/**
 * Second-level coverage is deliberately curated. geoBoundaries has real ADM2
 * geometry for most countries, but some archives are tens of megabytes; this
 * keeps the app fast and honest (the UI says "second-level data unavailable"
 * everywhere else instead of inventing boundaries).
 */
const ADM2_COUNTRIES = [
  'IND', 'USA', 'CAN', 'AUS', 'BRA', 'DEU', 'FRA', 'GBR', 'KEN', 'JPN',
  'MEX', 'ZAF', 'IDN', 'ESP', 'ITA', 'NGA', 'TUR', 'ARG', 'PHL', 'VNM',
]

const ADM2_BASE = 'https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/gbOpen'
const ADM2_MAX_BYTES = 5 * 1024 * 1024

const COUNTRY_TOLERANCE_DEG = 0.035
const ADMIN1_TOLERANCE_DEG = 0.01
const ADMIN2_TOLERANCE_DEG = 0.006
const ROUND_DECIMALS = 3
const MIN_RING_AREA = 0.0025 // roughly 25 km² at the equator
const MAX_VERTICES_PER_FEATURE = 6000
const MAX_ADM2_VERTICES_PER_FEATURE = 1400

async function download(source) {
  await mkdir(CACHE, { recursive: true })
  const cached = path.join(CACHE, source.file)
  if (existsSync(cached)) {
    const info = await stat(cached)
    if (info.size > 100_000) return cached
  }
  console.log(`[geo] downloading ${source.url}`)
  const response = await fetch(source.url)
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${source.url}`)
  const text = await response.text()
  await writeFile(cached, text, 'utf8')
  return cached
}

/** Douglas–Peucker, carried out in lon/lat with a latitude-aware scale. */
function simplifyRing(ring, tolerance) {
  if (ring.length <= 4) return ring
  const cosLat = Math.cos((ring[0][1] * Math.PI) / 180) || 1
  const tol2 = tolerance * tolerance

  const keep = new Uint8Array(ring.length)
  keep[0] = 1
  keep[ring.length - 1] = 1

  const stack = [[0, ring.length - 1]]
  while (stack.length) {
    const [first, last] = stack.pop()
    if (last - first < 2) continue
    const [x1, y1] = ring[first]
    const [x2, y2] = ring[last]
    const dx = (x2 - x1) * cosLat
    const dy = y2 - y1
    const len2 = dx * dx + dy * dy
    let maxDist = -1
    let index = -1
    for (let i = first + 1; i < last; i += 1) {
      const px = (ring[i][0] - x1) * cosLat
      const py = ring[i][1] - y1
      let dist
      if (len2 === 0) {
        dist = px * px + py * py
      } else {
        let t = (px * dx + py * dy) / len2
        t = t < 0 ? 0 : t > 1 ? 1 : t
        const ex = px - t * dx
        const ey = py - t * dy
        dist = ex * ex + ey * ey
      }
      if (dist > maxDist) {
        maxDist = dist
        index = i
      }
    }
    if (maxDist > tol2 && index > 0) {
      keep[index] = 1
      stack.push([first, index], [index, last])
    }
  }

  const out = []
  for (let i = 0; i < ring.length; i += 1) {
    if (!keep[i]) continue
    const [x, y] = ring[i]
    const factor = 10 ** ROUND_DECIMALS
    out.push([Math.round(x * factor) / factor, Math.round(y * factor) / factor])
  }
  // Collapse consecutive duplicates produced by rounding.
  const dedup = [out[0]]
  for (let i = 1; i < out.length; i += 1) {
    const prev = dedup[dedup.length - 1]
    if (out[i][0] !== prev[0] || out[i][1] !== prev[1]) dedup.push(out[i])
  }
  if (dedup.length < 4) return null
  const first = dedup[0]
  const last = dedup[dedup.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) dedup.push(first)
  return dedup
}

function ringArea(ring) {
  let sum = 0
  for (let i = 0; i < ring.length - 1; i += 1) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
  }
  return Math.abs(sum / 2)
}

/**
 * Simplify a GeoJSON geometry while staying under a vertex budget.
 * Holes and small islands below MIN_RING_AREA are dropped.
 */
function simplifyGeometry(geometry, tolerance, maxVertices = MAX_VERTICES_PER_FEATURE) {
  if (!geometry) return null
  const polygons =
    geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates
        : []

  const kept = []
  for (const polygon of polygons) {
    const rings = []
    for (let r = 0; r < polygon.length; r += 1) {
      const ring = polygon[r]
      if (!Array.isArray(ring) || ring.length < 4) continue
      const area = ringArea(ring)
      // Keep the outer ring even when tiny (a small island country); drop small holes.
      if (r > 0 && area < MIN_RING_AREA) continue
      const simplified = simplifyRing(ring, tolerance)
      if (simplified) rings.push({ ring: simplified, area })
    }
    if (!rings.length) continue
    kept.push(rings)
  }
  if (!kept.length) return null

  // Enforce a per-feature budget by keeping the largest rings first.
  let budget = maxVertices
  const chosen = []
  const flat = kept.flat().sort((a, b) => b.area - a.area)
  for (const entry of flat) {
    if (budget <= 0) break
    if (entry.ring.length > budget && chosen.length > 0) continue
    chosen.push(entry.ring)
    budget -= entry.ring.length
  }
  if (!chosen.length) return null

  if (chosen.length === 1) return { type: 'Polygon', coordinates: [chosen[0]] }
  return { type: 'MultiPolygon', coordinates: chosen.map((ring) => [ring]) }
}

function bboxOf(geometry) {
  let west = 180
  let south = 90
  let east = -180
  let north = -90
  const walk = (coords) => {
    if (typeof coords[0] === 'number') {
      const [x, y] = coords
      if (x < west) west = x
      if (x > east) east = x
      if (y < south) south = y
      if (y > north) north = y
      return
    }
    for (const entry of coords) walk(entry)
  }
  walk(geometry.coordinates)
  return [west, south, east, north].map((v) => Math.round(v * 1000) / 1000)
}

/** Ray casting in lon/lat; used only to attribute admin-2 units to a parent. */
function ringContains(ring, lon, lat) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    const intersects = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

function geometryContains(geometry, lon, lat) {
  if (!geometry) return false
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polygons.some((polygon) => {
    const outer = polygon[0]
    return outer && outer.length > 3 && ringContains(outer, lon, lat)
  })
}

/**
 * A point that is reliably inside the feature. bbox centres fall in the sea for
 * coastal counties and in neighbouring units for irregular shapes, so try the
 * bbox centre, then ring centroids, then the first vertex of each ring.
 */
function interiorPoint(geometry, bbox) {
  const candidates = [[(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]]
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  for (const polygon of polygons.slice(0, 6)) {
    const outer = polygon[0]
    if (!outer || outer.length < 4) continue
    let sx = 0
    let sy = 0
    for (const [x, y] of outer) {
      sx += x
      sy += y
    }
    candidates.push([sx / outer.length, sy / outer.length], outer[0], outer[Math.floor(outer.length / 2)])
  }
  for (const [lon, lat] of candidates) {
    if (geometryContains(geometry, lon, lat)) return [lon, lat]
  }
  return candidates[0]
}

function safeIso3(props) {
  const candidates = [props.ADM0_A3, props.ISO_A3_EH, props.ISO_A3, props.SOV_A3]
  for (const value of candidates) {
    if (!value) continue
    const clean = String(value).trim().toUpperCase()
    if (/^[A-Z]{3}$/.test(clean) && clean !== 'UNK') return clean
  }
  return null
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(value), 'utf8')
}

/** Fallback native terminology when the geoBoundaries metadata call fails. */
const ADM2_TERMS = {
  IND: 'District',
  USA: 'County',
  CAN: 'Census division',
  AUS: 'Local government area',
  BRA: 'Municipality',
  DEU: 'District',
  FRA: 'Arrondissement',
  GBR: 'District',
  KEN: 'Sub-county',
  JPN: 'Municipality',
  MEX: 'Municipality',
  ZAF: 'District municipality',
  IDN: 'Regency / city',
  ESP: 'Province',
  ITA: 'Province',
  NGA: 'Local government area',
  TUR: 'District',
  ARG: 'Department',
  PHL: 'Municipality / city',
  VNM: 'District',
}

async function downloadAdm2(iso3) {
  await mkdir(path.join(CACHE, 'adm2'), { recursive: true })
  const cached = path.join(CACHE, 'adm2', `${iso3}.geojson`)
  if (existsSync(cached)) {
    const info = await stat(cached)
    if (info.size > 10_000) return cached
  }
  const url = `${ADM2_BASE}/${iso3}/ADM2/geoBoundaries-${iso3}-ADM2_simplified.geojson`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const text = await response.text()
  if (!text.trimStart().startsWith('{')) throw new Error('not GeoJSON (LFS pointer?)')
  await writeFile(cached, text, 'utf8')
  return cached
}

async function adm2Meta(iso3) {
  await mkdir(path.join(CACHE, 'adm2'), { recursive: true })
  const cached = path.join(CACHE, 'adm2', `${iso3}.meta.json`)
  if (existsSync(cached)) {
    try {
      return JSON.parse(await readFile(cached, 'utf8'))
    } catch {
      /* fall through and re-fetch */
    }
  }
  try {
    const response = await fetch(`https://www.geoboundaries.org/api/current/gbOpen/${iso3}/ADM2/`)
    if (!response.ok) return null
    const meta = await response.json()
    await writeFile(cached, JSON.stringify(meta), 'utf8')
    return meta
  } catch {
    return null
  }
}

/** Builds one admin-2 payload; returns a summary object plus search entries. */
async function buildAdm2(iso3, admin1Divisions = []) {
  const [file, meta] = await Promise.all([downloadAdm2(iso3), adm2Meta(iso3)])
  const raw = JSON.parse(await readFile(file, 'utf8'))
  const term = meta?.boundaryCanonical || ADM2_TERMS[iso3] || 'Admin-2'
  const units = []
  const districts = []

  /** Parent lookup is a bbox-filtered point-in-polygon against level-1 units. */
  const findParent = (lon, lat) => {
    for (const division of admin1Divisions) {
      const [west, south, east, north] = division.bbox
      if (lat < south || lat > north) continue
      if (east - west < 359 && (lon < west || lon > east)) continue
      if (geometryContains(division.geometry, lon, lat)) return division
    }
    return null
  }

  for (const feature of raw.features ?? []) {
    const props = feature.properties ?? {}
    const name = props.shapeName || props.name || props.NAME
    if (!name) continue
    const geometry = simplifyGeometry(feature.geometry, ADMIN2_TOLERANCE_DEG, MAX_ADM2_VERTICES_PER_FEATURE)
    if (!geometry) continue
    const bbox = bboxOf(geometry)
    // A tiny placeholder ring would be dishonest; require at least a triangle.
    const ringCount = geometry.type === 'Polygon' ? geometry.coordinates[0].length : geometry.coordinates[0][0].length
    if (ringCount < 4) continue
    const [lon, lat] = interiorPoint(geometry, bbox)
    const parent = findParent(lon, lat)
    const id = String(props.shapeID || props.shapeISO || `${iso3}-ADM2-${units.length}`)
    units.push({
      id,
      name,
      local: props.shapeName_local || null,
      type: term,
      label: [Number(lon.toFixed(3)), Number(lat.toFixed(3))],
      bbox,
      parent: parent?.id ?? null,
      geometry,
    })
    districts.push({
      k: 'district',
      n: name,
      c: iso3,
      i: id,
      b: bbox,
      p: parent?.id ?? null,
      pn: parent?.name ?? null,
      pl: parent?.label ?? null,
      pb: parent?.bbox ?? null,
    })
  }
  if (!units.length) throw new Error('no usable geometry')
  units.sort((a, b) => a.name.localeCompare(b.name))
  const payload = {
    country: iso3,
    source: 'geoBoundaries ADM2',
    license: meta?.boundaryLicense || raw.licenseDetail || 'See geoBoundaries',
    canonical: meta?.boundaryCanonical || term,
    year: meta?.boundaryYearRepresented || raw.boundaryYearRepresented || null,
    units,
  }
  const target = path.join(OUT, 'admin2', `${iso3}.json`)
  await writeJson(target, payload)
  const size = (await stat(target)).size
  if (size > ADM2_MAX_BYTES) {
    // Too heavy for a runtime fetch; drop it rather than ship a slow layer.
    await rm(target, { force: true })
    throw new Error(`simplified payload still ${(size / 1048576).toFixed(1)} MB`)
  }
  return { iso3, units: units.length, size, districts }
}

async function main() {
  const force = process.argv.includes('--force')
  const skipAdm2 = process.argv.includes('--no-adm2')
  const indexFile = path.join(OUT, 'index.json')
  const haveOutput = existsSync(indexFile)

  let admin0Path
  let admin1Path
  try {
    admin0Path = await download(SOURCES.admin0)
    admin1Path = await download(SOURCES.admin1)
  } catch (error) {
    if (haveOutput && !force) {
      console.warn(`[geo] download failed, keeping existing boundaries: ${error.message}`)
      return
    }
    console.warn(`[geo] download failed, writing an empty index: ${error.message}`)
    await writeJson(indexFile, {
      generated: new Date().toISOString(),
      source: 'Natural Earth (download failed)',
      license: 'Public domain (Natural Earth)',
      countries: [],
      admin2: [],
    })
    return
  }

  const admin0 = JSON.parse(await readFile(admin0Path, 'utf8'))
  const admin1 = JSON.parse(await readFile(admin1Path, 'utf8'))

  await rm(OUT, { recursive: true, force: true })
  await mkdir(OUT, { recursive: true })

  const countries = []
  const byIso3 = new Map()
  const aliasesByIso3 = new Map()

  for (const feature of admin0.features) {
    const props = feature.properties ?? {}
    const iso3 = safeIso3(props)
    // Prefer the familiar short name ("China", not "People's Republic of China").
    const name = props.NAME || props.ADMIN || props.NAME_EN || props.NAME_LONG
    if (!iso3 || !name) continue
    const geometry = simplifyGeometry(feature.geometry, COUNTRY_TOLERANCE_DEG)
    if (!geometry) continue
    const bbox = bboxOf(geometry)
    const iso2 = /^[A-Z]{2}$/.test(props.ISO_A2_EH || '')
      ? props.ISO_A2_EH
      : /^[A-Z]{2}$/.test(props.ISO_A2 || '')
        ? props.ISO_A2
        : null
    const entry = {
      id: iso3,
      iso3,
      iso2,
      name,
      formal: props.FORMAL_EN || null,
      continent: props.CONTINENT || null,
      region: props.SUBREGION || props.REGION_UN || null,
      label:
        Number.isFinite(props.LABEL_X) && Number.isFinite(props.LABEL_Y)
          ? [Number(props.LABEL_X.toFixed(3)), Number(props.LABEL_Y.toFixed(3))]
          : [Number(((bbox[0] + bbox[2]) / 2).toFixed(3)), Number(((bbox[1] + bbox[3]) / 2).toFixed(3))],
      bbox,
      population: Number.isFinite(props.POP_EST) ? props.POP_EST : null,
      geometry,
    }
    countries.push(entry)
    if (!byIso3.has(iso3)) byIso3.set(iso3, entry)
    // Alternate names used only by search; kept out of the geometry payload.
    const aliases = [props.NAME_EN, props.NAME_LONG, props.ADMIN, props.FORMAL_EN]
      .filter((value) => typeof value === 'string' && value.length > 1)
      .map((value) => value.trim())
    const unique = [...new Set(aliases)]
    if (unique.length > 1 || (unique.length === 1 && unique[0] !== name)) {
      aliasesByIso3.set(iso3, unique)
    }
  }

  countries.sort((a, b) => a.name.localeCompare(b.name))
  await writeJson(path.join(OUT, 'countries.json'), {
    generated: new Date().toISOString(),
    source: 'Natural Earth 1:50m admin-0 countries',
    license: SOURCES.admin0.license,
    countries,
  })

  // Per-country admin-1 payloads keep first-load cost to one small request.
  const divisionsByCountry = new Map()
  const usedIds = new Map()
  const searchEntries = []
  let skipped = 0
  for (const feature of admin1.features) {
    const props = feature.properties ?? {}
    const iso3 = String(props.adm0_a3 || '').toUpperCase()
    if (!/^[A-Z]{3}$/.test(iso3)) continue
    const name = props.name || props.name_en
    if (!name) continue
    const geometry = simplifyGeometry(feature.geometry, ADMIN1_TOLERANCE_DEG)
    if (!geometry) {
      skipped += 1
      continue
    }
    const bbox = bboxOf(geometry)
    const lat = Number.isFinite(props.latitude) ? Number(props.latitude) : (bbox[1] + bbox[3]) / 2
    const lon = Number.isFinite(props.longitude) ? Number(props.longitude) : (bbox[0] + bbox[2]) / 2
    const baseId = String(props.iso_3166_2 || props.adm1_code || `${iso3}-A1-${name}`)
    const ids = usedIds.get(iso3) ?? new Set()
    let id = baseId
    if (ids.has(id)) {
      let suffix = 2
      while (ids.has(`${baseId}-${suffix}`)) suffix += 1
      id = `${baseId}-${suffix}`
    }
    ids.add(id)
    usedIds.set(iso3, ids)
    const list = divisionsByCountry.get(iso3) ?? []
    list.push({
      id,
      name,
      local: props.name_local || null,
      type: props.type_en || props.type || 'Admin-1',
      region: props.region || null,
      label: [Number(lon.toFixed(3)), Number(lat.toFixed(3))],
      bbox,
      geometry,
    })
    divisionsByCountry.set(iso3, list)
    searchEntries.push({
      k: 'state',
      n: name,
      c: iso3,
      i: id,
      b: bbox,
    })
  }

  const countryIndex = []
  let admin1Files = 0
  let admin1Bytes = 0

  console.log(
    `[geo] admin-1: ${admin1.features.length} features, ${divisionsByCountry.size} countries, ` +
      `${skipped} skipped with no usable geometry`,
  )

  for (const [iso3, divisions] of divisionsByCountry) {
    divisions.sort((a, b) => a.name.localeCompare(b.name))
    const file = path.join(OUT, 'admin1', `${iso3}.json`)
    await writeJson(file, {
      country: iso3,
      source: 'Natural Earth 1:10m admin-1 states/provinces',
      license: SOURCES.admin1.license,
      divisions,
    })
    admin1Files += 1
    try {
      admin1Bytes += (await stat(file)).size
    } catch {
      /* ignore */
    }
  }

  for (const entry of countries) {
    countryIndex.push({
      iso3: entry.iso3,
      iso2: entry.iso2,
      name: entry.name,
      continent: entry.continent,
      level1: divisionsByCountry.get(entry.iso3)?.length ?? 0,
    })
  }

  // Compact search index: every admin-1 name plus its country and bbox.
  for (const entry of countries) {
    searchEntries.push({ k: 'country', n: entry.name, c: entry.iso3, i: entry.iso3, b: entry.bbox })
    // Alternate official names still match, so "People's Republic of China"
    // and "Russian Federation" find the same country as "China" and "Russia".
    for (const alias of aliasesByIso3.get(entry.iso3) ?? []) {
      if (alias === entry.name) continue
      searchEntries.push({ k: 'country', n: alias, c: entry.iso3, i: entry.iso3, b: entry.bbox })
    }
  }
  const seenSearch = new Set()
  const dedupSearch = () =>
    searchEntries.filter((entry) => {
      const key = `${entry.k}|${entry.n}|${entry.c}`
      if (seenSearch.has(key)) return false
      seenSearch.add(key)
      return true
    })

  // Second-level coverage.
  const admin2 = []
  if (!skipAdm2) {
    console.log(`[geo] admin-2: ${ADM2_COUNTRIES.length} curated countries`)
    const queue = [...ADM2_COUNTRIES]
    const workers = Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const iso3 = queue.shift()
        try {
          const result = await buildAdm2(iso3, divisionsByCountry.get(iso3) ?? [])
          admin2.push({ iso3: result.iso3, units: result.units })
          for (const entry of result.districts) searchEntries.push(entry)
          console.log(
            `[geo]   ${iso3}: ${result.units} units, ${(result.size / 1024).toFixed(0)} KB`,
          )
        } catch (error) {
          console.warn(`[geo]   ${iso3}: skipped (${error.message})`)
        }
      }
    })
    await Promise.all(workers)
    admin2.sort((a, b) => a.iso3.localeCompare(b.iso3))
  } else {
    console.log('[geo] admin-2: skipped (--no-adm2)')
  }

  // Written last so it includes country, level-1 and level-2 names.
  const dedupedSearch = dedupSearch()
  await writeJson(path.join(OUT, 'search-index.json'), {
    generated: new Date().toISOString(),
    note: 'Compact administrative name index for search. Geometry lives in the per-country files.',
    entries: dedupedSearch,
  })

  await writeJson(indexFile, {
    generated: new Date().toISOString(),
    source: 'Natural Earth + geoBoundaries',
    license: 'Natural Earth: public domain. geoBoundaries: ODbL 1.0 / CC BY 4.0 per country.',
    note:
      'Level-1 (state/province) boundaries are Natural Earth. Level-2 (district/county) ' +
      'boundaries exist only for the countries listed in `admin2`; elsewhere the app ' +
      'says so instead of inventing boundaries.',
    countryCount: countries.length,
    countries: countryIndex,
    admin1Files,
    admin2,
  })

  const countriesSize = (await stat(path.join(OUT, 'countries.json'))).size
  console.log(
    `[geo] ${countries.length} countries (${(countriesSize / 1024).toFixed(0)} KB), ` +
      `${admin1Files} admin-1 files (${(admin1Bytes / 1024 / 1024).toFixed(2)} MB total)`,
  )
  const admin1Dir = path.join(OUT, 'admin1')
  const largest = await readdir(admin1Dir)
  let biggest = { name: '', size: 0 }
  for (const name of largest) {
    const size = (await stat(path.join(admin1Dir, name))).size
    if (size > biggest.size) biggest = { name, size }
  }
  console.log(`[geo] largest admin-1 file: ${biggest.name} ${(biggest.size / 1024).toFixed(0)} KB`)
  console.log(`[geo] search index: ${dedupedSearch.length} entries`)
}

main().catch((error) => {
  console.error('[geo] failed:', error)
  process.exitCode = 0 // boundaries are optional: never break the app build
})
