import { useSyncExternalStore } from 'react'

// Offline copy of the app: public/sw.js serves files from the browser cache, and this module downloads
// every file listed in offline-manifest.json (written at build time, see vite.config.ts) into that cache.

const CACHE = 'lid-offline'
const RUNTIME = 'lid-runtime'
const META_KEY = 'lid-prep:offline'
const BASE = new URL(import.meta.env.BASE_URL, location.href)

interface Manifest {
  version: string
  files: Record<string, { bytes: number; h: string }>
}

/** what is in the offline cache: build version, content hash per file, size, when it finished */
interface Meta {
  version: string
  hashes: Record<string, string>
  bytes: number
  date: number
}

export type OfflineStatus =
  | { kind: 'unsupported' }
  | { kind: 'dev' }
  | { kind: 'none' }
  | { kind: 'downloading'; done: number; total: number }
  | { kind: 'paused'; done: number; total: number }
  | { kind: 'ready'; bytes: number; date: number }

const supported = 'serviceWorker' in navigator && 'caches' in window

function readMeta(): Meta | null {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) || 'null')
  } catch {
    return null
  }
}

function writeMeta(m: Meta | null) {
  try {
    if (m) localStorage.setItem(META_KEY, JSON.stringify(m))
    else localStorage.removeItem(META_KEY)
  } catch {
    /* storage unavailable */
  }
}

const initial = (): OfflineStatus => {
  if (!supported) return { kind: 'unsupported' }
  if (!import.meta.env.PROD) return { kind: 'dev' }
  const m = readMeta()
  return m?.version ? { kind: 'ready', bytes: m.bytes, date: m.date } : { kind: 'none' }
}

let status = initial()
const listeners = new Set<() => void>()
function set(s: OfflineStatus) {
  status = s
  listeners.forEach((l) => l())
}

export const useOfflineStatus = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => status,
  )

/** registers the service worker, so files already loaded keep working offline even without a full download */
export function registerServiceWorker() {
  if (!supported || !import.meta.env.PROD) return
  navigator.serviceWorker.register(new URL('sw.js', BASE), { scope: BASE.pathname }).catch(() => {})
  // the browser may have cleared the cache (Safari does after weeks without a visit); then the saved state is wrong
  if (readMeta()?.version)
    caches
      .open(CACHE)
      .then((c) => c.match(new URL('index.html', BASE)))
      .then((hit) => {
        if (!hit) {
          writeMeta(null)
          set({ kind: 'none' })
        }
      })
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** fetch past the service worker and the HTTP cache, retrying a few times on a flaky connection */
async function get(url: URL, tries = 4): Promise<Response> {
  for (let i = 1; ; i++) {
    const res = await fetch(url, { cache: 'reload' }).catch(() => null)
    if (res?.ok) return res
    if (i >= tries || !navigator.onLine || (res && res.status < 500)) throw new Error(`could not load ${url}`)
    await wait(1000 * 2 ** i)
  }
}

let running: Promise<void> | null = null
// set by removeOffline to stop a download in progress
let cancelled = false

/** downloads what is missing or changed since the last download; safe to call often */
export function syncOffline(): Promise<void> {
  if (!supported || !import.meta.env.PROD) return Promise.resolve()
  running ??= run().finally(() => (running = null))
  return running
}

async function run() {
  cancelled = false
  const old = readMeta()
  let manifest: Manifest
  try {
    manifest = await (await get(new URL('offline-manifest.json', BASE), 2)).json()
  } catch {
    // offline or the server is unreachable: keep whatever is saved, try again later
    if (status.kind === 'downloading') set({ kind: 'paused', done: status.done, total: status.total })
    return
  }
  const cache = await caches.open(CACHE)
  const names = Object.keys(manifest.files)
  const have = new Set((await cache.keys()).map((r) => r.url))
  const todo = names.filter((n) => old?.hashes[n] !== manifest.files[n].h || !have.has(new URL(n, BASE).href))
  const hashes: Record<string, string> = {}
  for (const n of names) if (!todo.includes(n)) hashes[n] = manifest.files[n].h
  const bytes = names.reduce((s, n) => s + manifest.files[n].bytes, 0)

  if (todo.length) {
    // ask the browser not to clear the cache under storage pressure; it may say no
    navigator.storage?.persist?.().catch(() => {})
    let done = names.length - todo.length
    set({ kind: 'downloading', done, total: names.length })
    const queue = [...todo]
    const worker = async () => {
      for (let n = queue.shift(); n && !cancelled; n = queue.shift()) {
        const url = new URL(n, BASE)
        await cache.put(url, await get(url))
        hashes[n] = manifest.files[n].h
        done++
        set({ kind: 'downloading', done, total: names.length })
      }
    }
    try {
      await Promise.all([worker(), worker(), worker(), worker()])
    } catch {
      // remember what did arrive, so the next try only fetches the rest
      writeMeta({ version: '', hashes, bytes: 0, date: 0 })
      set({ kind: 'paused', done, total: names.length })
      return
    }
    if (cancelled) return
  }

  const meta: Meta = { version: manifest.version, hashes, bytes, date: old?.version === manifest.version && old.date ? old.date : Date.now() }
  writeMeta(meta)
  set({ kind: 'ready', bytes: meta.bytes, date: meta.date })

  // drop files of older versions from both caches
  const keep = new Set(names.map((n) => new URL(n, BASE).href))
  for (const c of [cache, await caches.open(RUNTIME)])
    for (const r of await c.keys()) if (!keep.has(r.url)) await c.delete(r)
}

/** deletes the offline copy; files the service worker cached on the way stay */
export async function removeOffline() {
  cancelled = true
  await running?.catch(() => {})
  if (!supported) return
  await caches.delete(CACHE)
  writeMeta(null)
  if (import.meta.env.PROD) set({ kind: 'none' })
}
