/**
 * Copies the prebuilt CesiumJS runtime into public/cesium so it is served
 * same-origin in development and in the production build.
 *
 * We deliberately do not bundle Cesium with Vite: the prebuilt IIFE build
 * resolves its Workers/Assets relative to CESIUM_BASE_URL, which keeps the app
 * bundle small and avoids worker/asset plugin breakage.
 */
import { cp, mkdir, rm, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const src = new URL('../node_modules/cesium/Build/Cesium/', import.meta.url)
const dest = new URL('../public/cesium/', import.meta.url)

const sourceDir = fileURLToPath(src)
const destDir = fileURLToPath(dest)

try {
  const info = await stat(new URL('Cesium.js', src))
  if (!info.isFile()) throw new Error('not a file')
} catch {
  console.error('[copy-cesium] Cesium build not found. Run `npm install` first.')
  process.exit(1)
}

await rm(dest, { recursive: true, force: true })
await mkdir(dest, { recursive: true })

const DIRS = ['Assets', 'ThirdParty', 'Widgets', 'Workers']
for (const dir of DIRS) {
  await cp(new URL(`${dir}/`, src), new URL(`${dir}/`, dest), { recursive: true })
}
await cp(new URL('Cesium.js', src), new URL('Cesium.js', dest))

console.log(`[copy-cesium] copied Cesium 1.147 runtime -> ${destDir}`)
console.log(`[copy-cesium] source: ${sourceDir}`)
