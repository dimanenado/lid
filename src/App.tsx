import { ChartNoAxesColumn, House, LucideIcon, MapPin, Search as SearchIcon, Settings, Timer } from 'lucide-react'
import { ReactNode, useCallback, useEffect, useState } from 'react'
import { QUESTIONS, STATES, shuffle } from './data'
import { ExamTab } from './Exam'
import { Learn } from './Learn'
import { Practice } from './Practice'
import { ProgressTab } from './ProgressTab'
import { Search } from './Search'
import { SettingsTab } from './SettingsTab'
import { trackEvent, trackView } from './analytics'
import { useTheme } from './hooks'
import { TranslationProvider } from './TranslationProvider'
import { useProgress } from './store'
import { syncOffline } from './offline'
import { StatePicker } from './ui'

// settings is reached from the gear in the top bar, not from the tabs
type Tab = 'learn' | 'exam' | 'search' | 'progress' | 'settings'
const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: 'learn', label: 'Learn', Icon: House },
  { id: 'exam', label: 'Exam', Icon: Timer },
  { id: 'search', label: 'Search', Icon: SearchIcon },
  { id: 'progress', label: 'Progress', Icon: ChartNoAxesColumn },
]

const tabFromHash = (): Tab => {
  const h = location.hash.slice(1)
  return TABS.some((t) => t.id === h) || h === 'settings' ? (h as Tab) : 'learn'
}

export default function App() {
  const store = useProgress()
  const { p, update } = store
  useTheme(p.theme)
  const [tab, setTab] = useState<Tab>(tabFromHash)
  const [session, setSession] = useState<{ title: string; ids: string[]; n: number } | null>(null)
  // a running exam or an exam review takes the whole screen
  const [fullscreen, setFullscreen] = useState(false)
  const [picker, setPicker] = useState(false)

  useEffect(trackView, [tab])

  // download the offline copy in the background a moment after start, and again when the connection returns
  useEffect(() => {
    if (!p.offline) return
    const t = setTimeout(syncOffline, 3000)
    window.addEventListener('online', syncOffline)
    return () => {
      clearTimeout(t)
      window.removeEventListener('online', syncOffline)
    }
  }, [p.offline])

  // the URL hash mirrors the tab so Back works and a reload keeps the tab
  useEffect(() => {
    const onHash = () => {
      if (fullscreen) history.replaceState(null, '', `#${tab}`)
      else setTab(tabFromHash())
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [fullscreen, tab])

  const go = (t: Tab) => {
    setTab(t)
    if (location.hash !== `#${t}`) location.hash = t
    window.scrollTo({ top: 0 })
  }

  const translation = p.showTranslation ? p.lang : 'off'
  const start = useCallback((title: string, ids: string[]) => {
    trackEvent('practice-started', { kind: title, questions: ids.length, translation })
    setSession((s) => ({ title, ids, n: (s?.n ?? 0) + 1 }))
    window.scrollTo({ top: 0 })
  }, [translation])

  const practise = (title: string, qs: typeof QUESTIONS, forceShuffle = false) =>
    start(title, (p.shuffle || forceShuffle ? shuffle(qs) : qs).map((q) => q.id))

  if (!p.onboarded) return <Welcome onPick={(state) => update({ state, onboarded: true })} />

  const wrap = (node: ReactNode) => (
    <TranslationProvider lang={p.lang} show={p.showTranslation}>
      {node}
    </TranslationProvider>
  )

  if (session)
    return wrap(
      <Practice
        key={session.n}
        title={session.title}
        ids={session.ids}
        store={store}
        onExit={() => setSession(null)}
        onRestart={start}
      />,
    )

  const picker_ = picker && <StatePicker value={p.state} onPick={(state) => update({ state })} onClose={() => setPicker(false)} />
  // the tree stays the same in full screen so a running exam keeps its state
  const chrome = !fullscreen

  return wrap(
    <div className={chrome ? 'shell' : undefined}>
      {chrome && (
        <header className="topbar">
          <div className="topbar-in">
            <button className="brand" aria-label="Leben in Deutschland" onClick={() => go('learn')}>
              <span className="brand-mark" aria-hidden>
                LiD
              </span>
              <span className="brand-name">Leben in Deutschland</span>
            </button>
            <nav className="topnav" aria-label="Main">
              {TABS.map(({ id, label, Icon }) => (
                <button key={id} className={tab === id ? 'on' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => go(id)}>
                  <Icon size={18} aria-hidden /> {label}
                </button>
              ))}
            </nav>
            <button className="chip chip-btn state-chip" onClick={() => setPicker(true)} aria-label={`Federal state: ${STATES[p.state]}. Change`}>
              <MapPin size={14} aria-hidden /> <span>{STATES[p.state]}</span>
            </button>
            <button
              className={`icon-btn gear${tab === 'settings' ? ' on' : ''}`}
              aria-label="Settings"
              aria-current={tab === 'settings' ? 'page' : undefined}
              onClick={() => go('settings')}
            >
              <Settings size={20} aria-hidden />
            </button>
          </div>
        </header>
      )}

      <main className={chrome ? 'page' : undefined}>
        {tab === 'learn' && <Learn store={store} practise={practise} />}
        {tab === 'exam' && (
          <ExamTab
            store={store}
            onActiveChange={setFullscreen}
            onPractise={start}
            onChangeState={() => setPicker(true)}
            onOpenStats={() => {
              go('progress')
              requestAnimationFrame(() => document.getElementById('exams')?.scrollIntoView())
            }}
          />
        )}
        {tab === 'search' && <Search store={store} />}
        {tab === 'progress' && (
          <ProgressTab store={store} onPractise={start} onFullscreen={setFullscreen} />
        )}
        {tab === 'settings' && <SettingsTab store={store} onChangeState={() => setPicker(true)} />}
      </main>

      {chrome && (
        <nav className="tabbar" aria-label="Main">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} className={tab === id ? 'on' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => go(id)}>
              <Icon size={22} aria-hidden />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}
      {picker_}
    </div>,
  )
}

function Welcome({ onPick }: { onPick: (state: string) => void }) {
  return (
    <main className="page welcome">
      <div className="stack">
        <div className="stack-sm">
          <span className="eyebrow">Leben in Deutschland · Einbürgerungstest</span>
          <h1>Prepare for the test in German and English</h1>
          <p className="muted">
            All 460 official questions with an English, Turkish or Russian translation next to each one. Practise by topic, review your
            mistakes and take timed mock exams. Your progress stays in this browser.
          </p>
        </div>
        <section className="stack-sm">
          <h2 className="label">Where will you take the test?</h2>
          <p className="muted small">Three questions in the test are about your federal state. You can change this later.</p>
          <ul className="state-grid">
            {Object.entries(STATES).map(([code, name]) => (
              <li key={code}>
                <button className="state-opt" onClick={() => onPick(code)}>
                  <MapPin size={16} aria-hidden />
                  <span>{name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}
