/**
 * Verifies the generated administrative coverage against the acceptance
 * requirements (global level-1, curated level-2, correct native terms and no
 * invented geometry). Run with `npm run verify:geo` after `npm run geo`.
 */
import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

const GEO = join(process.cwd(), 'public', 'geo')
const MAX_BYTES = 10 * 1024 * 1024

let passed = 0
let failed = 0

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed += 1
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function json(file) {
  return JSON.parse(await readFile(join(GEO, file), 'utf8'))
}

function ringCount(geometry) {
  if (!geometry) return 0
  if (geometry.type === 'Polygon') return geometry.coordinates[0]?.length ?? 0
  const first = geometry.coordinates[0]
  return first?.[0]?.length ?? 0
}

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

function contains(geometry, lon, lat) {
  if (!geometry) return false
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polygons.some((polygon) => {
    const outer = polygon[0]
    return outer && outer.length > 3 && ringContains(outer, lon, lat)
  })
}

async function main() {
  console.log('[verify:geo] administration coverage')
  const index = await json('index.json')
  const countriesPayload = await json('countries.json')
  const countries = countriesPayload.countries
  const search = await json('search-index.json')

  check('country payload is global', countries.length >= 200, `${countries.length} countries`)
  check('index agrees with payload', index.countryCount === countries.length)
  check('every country has usable geometry', countries.every((c) => ringCount(c.geometry) >= 4))
  check(
    'ISO-3 codes are well formed',
    countries.every((c) => /^[A-Z]{3}$/.test(c.iso3)),
  )

  const admin2Set = new Set(index.admin2.map((entry) => entry.iso3))
  check('second-level coverage is declared', admin2Set.size >= 10, `${admin2Set.size} countries`)

  const expectedAdmin1 = {
    IND: 36,
    USA: 51,
    CAN: 13,
    AUS: 11,
    BRA: 27,
    DEU: 16,
    GBR: 200,
    FRA: 90,
    CHN: 30,
    KEN: 8,
  }

  for (const [iso3, minimum] of Object.entries(expectedAdmin1)) {
    const payload = await json(`admin1/${iso3}.json`)
    check(
      `${iso3} first-level divisions`,
      payload.divisions.length >= minimum,
      `${payload.divisions.length} divisions`,
    )
    check(
      `${iso3} division ids are unique`,
      new Set(payload.divisions.map((d) => d.id)).size === payload.divisions.length,
    )
  }

  const ind1 = await json('admin1/IND.json')
  const kerala = ind1.divisions.find((d) => /kerala/i.test(d.name))
  check('India exposes Kerala as a state', Boolean(kerala) && kerala.type === 'State', kerala?.type)

  const ind2 = await json('admin2/IND.json')
  const alappuzha = ind2.units.find((u) => /alappuzha/i.test(u.name))
  check('Kerala districts include Alappuzha', Boolean(alappuzha), ind2.canonical ?? '')
  if (alappuzha && kerala) {
    const inside =
      alappuzha.label[0] >= kerala.bbox[0] - 0.5 &&
      alappuzha.label[0] <= kerala.bbox[2] + 0.5 &&
      alappuzha.label[1] >= kerala.bbox[1] - 0.5 &&
      alappuzha.label[1] <= kerala.bbox[3] + 0.5
    check('Alappuzha sits inside the Kerala envelope', inside, alappuzha.label.join(', '))
  }
  check(
    'Kerala geometry contains its centroid',
    contains(kerala?.geometry, kerala?.label?.[0], kerala?.label?.[1]),
  )

  const usa2 = await json('admin2/USA.json')
  check('USA second level is counties', /count(y|ies)/i.test(usa2.canonical ?? ''), usa2.canonical)
  check('USA county count is plausible', usa2.units.length > 3000, `${usa2.units.length}`)

  const bra2 = await json('admin2/BRA.json')
  check('Brazil second level is municipalities', /municipality/i.test(bra2.canonical ?? ''), bra2.canonical)

  const aus2 = await json('admin2/AUS.json')
  check('Australia second level uses LGA terminology', /local government/i.test(aus2.canonical ?? ''), aus2.canonical)

  const can1 = await json('admin1/CAN.json')
  check(
    'Canada exposes provinces/territories',
    can1.divisions.some((d) => /ontario/i.test(d.name)),
  )

  const gbr1 = await json('admin1/GBR.json')
  check('United Kingdom exposes its constituent divisions', gbr1.divisions.length > 100)

  check('search index includes countries', search.entries.some((e) => e.k === 'country' && e.n === 'India'))
  check('search index includes states', search.entries.some((e) => e.k === 'state' && /kerala/i.test(e.n)))
  check('search index includes USA states', search.entries.some((e) => e.c === 'USA' && /california/i.test(e.n)))

  // Missing coverage must be explicit, never invented.
  for (const iso3 of ['FJI', 'MDG', 'PNG']) {
    check(`${iso3} correctly has no curated second level`, !admin2Set.has(iso3))
  }

  // Second-level names are searchable and know their parent province.
  const districtEntries = search.entries.filter((entry) => entry.k === 'district')
  check('search index includes districts', districtEntries.length > 10_000, `${districtEntries.length} districts`)
  const alappuzhaEntry = districtEntries.find((entry) => /^alappuzha$/i.test(entry.n) && entry.c === 'IND')
  check(
    'Alappuzha district is indexed under Kerala',
    Boolean(alappuzhaEntry) && /kerala/i.test(alappuzhaEntry?.pn ?? ''),
    alappuzhaEntry?.pn ?? 'missing',
  )
  check(
    'every district search entry has a bbox',
    districtEntries.every((entry) => Array.isArray(entry.b) && entry.b.length === 4),
  )

  const ind2Units = ind2.units
  const withParent = ind2Units.filter((unit) => unit.parent).length
  check(
    'Indian districts are attributed to a state',
    withParent / ind2Units.length > 0.95,
    `${withParent}/${ind2Units.length}`,
  )
  check(
    'district parents are real admin-1 ids',
    ind2Units.every(
      (unit) => !unit.parent || ind1.divisions.some((division) => division.id === unit.parent),
    ),
  )
  const usaWithParent = usa2.units.filter((unit) => unit.parent).length
  check(
    'US counties are attributed to a state',
    usaWithParent / usa2.units.length > 0.9,
    `${usaWithParent}/${usa2.units.length}`,
  )

  // File-size gate: Netlify and the browser both dislike very large payloads.
  const big = []
  for (const dir of ['admin1', 'admin2', '']) {
    const base = dir ? join(GEO, dir) : GEO
    for (const name of await readdir(base)) {
      const info = await stat(join(base, name))
      if (info.isFile() && info.size > MAX_BYTES) big.push(`${dir}/${name}`)
    }
  }
  check('all boundary payloads are under 10 MB', big.length === 0, big.join(', '))

  console.log(`\n[verify:geo] ${passed} passed, ${failed} failed`)
  if (failed) process.exitCode = 1
}

main().catch((error) => {
  console.error('[verify:geo] crashed:', error)
  process.exitCode = 1
})
