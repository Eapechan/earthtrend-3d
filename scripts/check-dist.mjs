/**
 * Reports build artefacts and flags any single file larger than 10 MB.
 * Netlify serves the static dist/ folder; keeping an eye on asset size keeps
 * cold loads (and Cesium decoding) predictable on average laptops and phones.
 */
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

const WARN_BYTES = 10 * 1024 * 1024

async function walk(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(full)))
    else out.push({ path: full, size: (await stat(full)).size })
  }
  return out
}

let files
try {
  files = await walk('dist')
} catch {
  console.error('[check-dist] dist/ not found')
  process.exit(1)
}

const total = files.reduce((sum, f) => sum + f.size, 0)
const large = files.filter((f) => f.size > WARN_BYTES).sort((a, b) => b.size - a.size)

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`
console.log(`[check-dist] ${files.length} files, ${mb(total)} total`)
console.log(
  '[check-dist] largest files:\n' +
    files
      .sort((a, b) => b.size - a.size)
      .slice(0, 6)
      .map((f) => `  ${mb(f.size).padStart(9)}  ${f.path.replace(/\\/g, '/')}`)
      .join('\n'),
)

if (large.length) {
  console.warn(
    `[check-dist] WARNING: ${large.length} file(s) exceed 10 MB. Consider serving heavy Cesium assets from a CDN.`,
  )
  for (const f of large) console.warn(`  ${mb(f.size)}  ${f.path}`)
} else {
  console.log('[check-dist] all files are under 10 MB')
}
