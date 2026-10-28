import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const commit = () => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

const hash = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex').slice(0, 12)

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

// Lists every file of the build (code, translations, fonts, images) with its size and a content hash,
// so the app can download all of it for offline use (src/offline.ts) and tell when a new version is out.
function offlineManifest(): Plugin {
  const skip = new Set(['sw.js', 'offline-manifest.json'])
  return {
    name: 'offline-manifest',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const files: Record<string, { bytes: number; h: string }> = {}
      for (const [name, item] of Object.entries(bundle)) {
        if (name.endsWith('.map')) continue
        const data = item.type === 'chunk' ? item.code : item.source
        files[name] = { bytes: typeof data === 'string' ? Buffer.byteLength(data) : data.length, h: hash(data) }
      }
      for (const p of walk('public')) {
        const name = relative('public', p).split('\\').join('/')
        if (skip.has(name)) continue
        const data = readFileSync(p)
        files[name] = { bytes: data.length, h: hash(data) }
      }
      const version = hash(JSON.stringify(Object.entries(files).sort()))
      this.emitFile({ type: 'asset', fileName: 'offline-manifest.json', source: JSON.stringify({ version, files }) })
    },
  }
}

// Relative base so the build works on GitHub Pages under /<repo>/ and when opened locally.
export default defineConfig({
  base: './',
  plugins: [react(), offlineManifest()],
  // build date and commit, shown in About and sent with feedback so reports can be matched to a release
  define: { __APP_VERSION__: JSON.stringify(`${new Date().toISOString().slice(0, 10)} (${commit()})`) },
})
