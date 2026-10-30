import { CircleCheck, CircleX, RotateCcw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BY_ID } from './data'
import { QuestionCard } from './QuestionCard'
import { Store } from './store'
import { LangToggle } from './ui'

interface Props {
  title: string
  ids: string[]
  /** answers already given in the saved round; set when this session continues it, and new answers are added to it */
  round?: boolean[]
  store: Store
  onExit: () => void
  /** start a new session, e.g. with the questions missed in this one */
  onRestart: (title: string, ids: string[]) => void
}

/** Answer one question at a time with immediate feedback. */
export function Practice({ title, ids, round, store, onExit, onRestart }: Props) {
  const [idx, setIdx] = useState(round?.length ?? 0)
  const [selected, setSelected] = useState<number | null>(null)
  const [results, setResults] = useState<boolean[]>(round ?? [])

  const q = BY_ID.get(ids[idx])
  const answered = selected !== null
  const right = results.filter(Boolean).length
  const wrong = results.length - right

  const choose = (i: number) => {
    if (answered || !q) return
    setSelected(i)
    const ok = i === q.correct
    store.record(q.id, ok)
    if (round) store.recordRound(ok)
    setResults((r) => [...r, ok])
  }

  const next = () => {
    setSelected(null)
    setIdx((i) => i + 1)
    window.scrollTo({ top: 0 })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.body.classList.contains('noscroll')) return
      if (!answered && ['1', '2', '3', '4'].includes(e.key)) choose(Number(e.key) - 1)
      else if (answered && e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const header = (
    <header className="sessbar">
      <div className="sessbar-in">
        <button className="icon-btn" aria-label="Close practice" onClick={onExit}>
          <X size={18} />
        </button>
        <strong className="sess-title">{title}</strong>
        <LangToggle store={store} />
      </div>
    </header>
  )

  if (ids.length === 0) {
    return (
      <div className="session session-narrow">
        {header}
        <main className="page">
          <div className="empty">
            <h2>Nothing to practise here yet</h2>
            <button className="btn btn-primary" onClick={onExit}>
              Back to Learn
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (!q) {
    const missed = ids.filter((_, i) => results[i] === false)
    return (
      <div className="session session-narrow">
        {header}
        <main className="page">
          <section className="result-card">
            <span className="eyebrow">Session complete</span>
            <div className="big-score">
              {right} <small>/ {ids.length} correct</small>
            </div>
            <div className="seg-progress" aria-hidden>
              {results.map((ok, i) => (
                <i key={i} className={ok ? 'ok' : 'bad'} />
              ))}
            </div>
            <p className="muted">A right answer clears a question from your mistakes. Two right in a row count as mastered.</p>
            <div className="actions">
              {missed.length > 0 && (
                <button className="btn btn-primary" onClick={() => onRestart(`${title}: missed`, missed)}>
                  <RotateCcw size={16} aria-hidden /> Review the {missed.length} I missed
                </button>
              )}
              <button className={missed.length ? 'btn btn-secondary' : 'btn btn-primary'} onClick={onExit}>
                Back to Learn
              </button>
            </div>
          </section>
        </main>
      </div>
    )
  }

  const segmented = ids.length <= 40
  const ok = selected === q.correct

  return (
    <div className="session">
      {header}
      <div className="sess-progress">
        {segmented ? (
          <div className="seg-progress" aria-hidden>
            {ids.map((_, i) => (
              <i key={i} className={i < results.length ? (results[i] ? 'ok' : 'bad') : i === idx ? 'cur' : ''} />
            ))}
          </div>
        ) : (
          <div className="meter meter-accent" aria-hidden>
            <i style={{ width: `${(idx / ids.length) * 100}%` }} />
          </div>
        )}
        <div className="sess-counts">
          <span>
            {idx + 1} / {ids.length}
          </span>
          <span className="ok">✓ {right}</span>
          <span className="bad">✗ {wrong}</span>
        </div>
      </div>
      <main className="page page-wide">
        <QuestionCard
          q={q}
          selected={selected}
          reveal={answered}
          onSelect={answered ? undefined : choose}
          keywords={store.p.keywords}
          userState={store.p.state}
        />
      </main>
      <footer className="dock">
        <div className="dock-in">
          {answered ? (
            <>
              <span className={`verdict ${ok ? 'ok' : 'bad'}`} role="status">
                {ok ? <CircleCheck size={20} aria-hidden /> : <CircleX size={20} aria-hidden />}
                {ok ? 'Correct' : `Not quite. The answer is ${'ABCD'[q.correct]}.`}
              </span>
              <button className="btn btn-primary" onClick={next} autoFocus>
                {idx + 1 < ids.length ? 'Next question' : 'See results'}
              </button>
            </>
          ) : (
            <span className="dock-hint">Pick an answer{' · '}keys 1–4</span>
          )}
        </div>
      </footer>
    </div>
  )
}
