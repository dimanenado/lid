import { ChevronRight, CloudOff, Download, Languages, MapPin, MessageSquare, RefreshCw, RotateCcw, Upload } from 'lucide-react'
import { useRef, useState, useSyncExternalStore } from 'react'
import { STATES } from './data'
import { feedbackUrl } from './feedback'
import { OfflineStatus, removeOffline, syncOffline, useOfflineStatus } from './offline'
import { LANGS } from './i18n'
import { Store, Theme, translationSettings } from './store'
import { useConfirm, useToast } from './hooks'
import { LangPicker, Switch } from './ui'

const THEMES: [Theme, string][] = [
  ['system', 'System'],
  ['light', 'Light'],
  ['dark', 'Dark'],
]

interface Props {
  store: Store
  onChangeState: () => void
}

export function SettingsTab({ store, onChangeState }: Props) {
  const { p, update } = store
  const [langPicker, setLangPicker] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [ask, confirmEl] = useConfirm()
  const [toast, toastEl] = useToast()

  const exportProgress = () => {
    const blob = new Blob([JSON.stringify(p, null, 1)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `lid-progress-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importProgress = async (f: File) => {
    try {
      const data = JSON.parse(await f.text())
      if (typeof data !== 'object' || !data.stats) throw new Error('bad file')
      update({
        state: data.state ?? p.state,
        ...translationSettings(data),
        shuffle: data.shuffle ?? true,
        keywords: data.keywords ?? true,
        onboarded: true,
        stats: data.stats,
        exams: data.exams ?? [],
      })
      toast('Progress imported')
    } catch {
      toast('That file is not an exported progress file')
    }
  }

  const reset = async () => {
    if (
      await ask({
        title: 'Reset all progress?',
        body: 'This deletes your answers and exam history in this browser. Export first if you want to keep a copy.',
        ok: 'Reset',
        danger: true,
      })
    ) {
      update({ stats: {}, exams: [] })
      toast('Progress reset')
    }
  }

  return (
    <div className="stack">
      {confirmEl}
      {toastEl}
      {langPicker && <LangPicker store={store} onClose={() => setLangPicker(false)} />}

      <section className="stack-sm">
        <h2 className="label">Settings</h2>
        <div className="list">
          <button className="list-row" onClick={onChangeState}>
            <MapPin size={18} aria-hidden className="list-icon" />
            <span className="row-main">
              <b>Federal state</b>
              <small>{STATES[p.state]}</small>
            </span>
            <ChevronRight size={18} aria-hidden className="muted" />
          </button>
          <button className="list-row" onClick={() => setLangPicker(true)}>
            <Languages size={18} aria-hidden className="list-icon" />
            <span className="row-main">
              <b>Translation</b>
              <small>{p.showTranslation ? LANGS[p.lang].native : 'Off · German only'}</small>
            </span>
            <ChevronRight size={18} aria-hidden className="muted" />
          </button>
          <div className="setting static" role="group" aria-labelledby="set-theme">
            <span className="setting-text">
              <span id="set-theme">Appearance</span>
              <small>System follows your device's light or dark mode</small>
            </span>
            <div className="seg">
              {THEMES.map(([v, label]) => (
                <button key={v} className={p.theme === v ? 'on' : ''} aria-pressed={p.theme === v} onClick={() => update({ theme: v })}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <Switch
            id="set-keywords"
            label="Highlight key words"
            hint="Marks the words that link each question to its answer, and warns about look-alike questions"
            checked={p.keywords}
            onChange={(v) => update({ keywords: v })}
          />
          <Switch
            id="set-shuffle"
            label="Shuffle practice questions"
            hint="Off keeps the catalog order"
            checked={p.shuffle}
            onChange={(v) => update({ shuffle: v })}
          />
        </div>
      </section>

      <OfflineSection store={store} />

      <section className="stack-sm">
        <h2 className="label">Your data</h2>
        <p className="muted small">Progress is saved in this browser only. Export it to move it to another device.</p>
        <div className="actions">
          <button className="btn btn-secondary" onClick={exportProgress}>
            <Download size={16} aria-hidden /> Export
          </button>
          <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
            <Upload size={16} aria-hidden /> Import
          </button>
          <button className="btn btn-ghost btn-danger-text" onClick={reset}>
            <RotateCcw size={16} aria-hidden /> Reset
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) importProgress(f)
            }}
          />
        </div>
      </section>

      <section className="stack-sm">
        <h2 className="label">About</h2>
        <p className="muted small">
          Questions from the official BAMF catalog “Gesamtfragenkatalog zum Test Leben in Deutschland” (as of 07.05.2025).
          Translations are unofficial. Answers were checked against the official BAMF online tool on 15.10.2026.
        </p>
        <p className="muted small">
          Anonymous usage stats (which screens and practice sessions are opened, mock exam scores, the chosen state and translation language) are counted with Umami. No
          cookies, no personal data; your progress stays in this browser.
        </p>
        <p className="muted small">Version {__APP_VERSION__}</p>
        <p className="small">Spotted a wrong answer or an odd translation, or have an idea? Let me know.</p>
        <div className="actions">
          <a className="btn btn-secondary" href={feedbackUrl({ state: store.p.state })} target="_blank" rel="noopener">
            <MessageSquare size={16} aria-hidden /> Share feedback
          </a>
        </div>
      </section>
    </div>
  )
}

const mb = (bytes: number) => `${(bytes / 1e6).toFixed(1)} MB`

function offlineText(s: OfflineStatus, on: boolean, online: boolean): string {
  switch (s.kind) {
    case 'unsupported':
      return 'This browser cannot save the app for offline use'
    case 'dev':
      return 'Works in the published app only'
    case 'none':
      return on ? (online ? 'Not downloaded yet' : 'Downloads when you are back online') : 'Not downloaded'
    case 'downloading':
      return `Downloading… ${s.done} of ${s.total} files`
    case 'paused':
      return `Paused at ${s.done} of ${s.total} files, continues when the connection is back`
    case 'ready':
      return `Ready offline · ${mb(s.bytes)} · updated ${new Date(s.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
  }
}

/** switch for the offline copy, with what is saved and a button to check for updates now */
function OfflineSection({ store }: { store: Store }) {
  const { p, update } = store
  const s = useOfflineStatus()
  const online = useOnline()
  const busy = s.kind === 'downloading'
  const usable = s.kind !== 'unsupported' && s.kind !== 'dev'

  const toggle = (v: boolean) => {
    update({ offline: v })
    if (!v) removeOffline()
  }

  return (
    <section className="stack-sm">
      <h2 className="label">Offline use</h2>
      <div className="list">
        <Switch
          id="set-offline"
          label="Save for offline use"
          hint="Downloads all questions, translations and images in the background, so the app works with a weak or no connection"
          checked={p.offline && usable}
          onChange={toggle}
        />
        <div className="setting static" role="status">
          {!online && <CloudOff size={18} aria-hidden className="list-icon" />}
          <span className="setting-text">
            <span>{online ? 'Status' : 'You are offline'}</span>
            <small>{offlineText(s, p.offline, online)}</small>
            {(busy || s.kind === 'paused') && (
              <span className="meter meter-accent" aria-hidden>
                <i style={{ width: `${(100 * s.done) / s.total}%` }} />
              </span>
            )}
          </span>
          {p.offline && usable && (
            <button className="btn btn-secondary btn-sm" disabled={busy || !online} onClick={() => syncOffline()}>
              <RefreshCw size={16} aria-hidden /> {s.kind === 'paused' ? 'Retry' : s.kind === 'ready' ? 'Check' : 'Download'}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

function useOnline() {
  return useSyncExternalStore(
    (l) => {
      window.addEventListener('online', l)
      window.addEventListener('offline', l)
      return () => {
        window.removeEventListener('online', l)
        window.removeEventListener('offline', l)
      }
    },
    () => navigator.onLine,
  )
}
