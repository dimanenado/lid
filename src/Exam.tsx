import { ChevronDown, ChevronLeft, ChevronRight, Clock, Flag, Grid3x3, Play, RotateCcw, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { BY_ID, GENERAL, PASS, STATES, shuffle, stateQuestions } from './data'
import { ExamResults, ExamSummaryCard } from './ExamStats'
import { QuestionCard } from './QuestionCard'
import { Store } from './store'
import { trackEvent } from './analytics'
import { useConfirm } from './hooks'
import { LangToggle } from './ui'

const LIMIT = 60 * 60

interface Props {
  store: Store
  /** called while an exam is running so the app can hide the tab bar */
  onActiveChange: (active: boolean) => void
  onPractise: (title: string, ids: string[]) => void
  onChangeState: () => void
  /** exam stats live in the Progress tab */
  onOpenStats: () => void
}

/** Exam tab: rules and start screen, then a running exam, then results. */
export function ExamTab({ store, onActiveChange, onPractise, onChangeState, onOpenStats }: Props) {
  const [run, setRun] = useState(0)
  useEffect(() => () => onActiveChange(false), [onActiveChange])

  if (run === 0) {
    return (
      <div className="stack">
        <section className="intro-card">
          <span className="eyebrow">Mock exam</span>
          <h1>Practise the real test</h1>
          <ul className="rules">
            <li>
              <b>33</b> questions: 30 general and 3 about {STATES[store.p.state]}
            </li>
            <li>
              <b>60</b> minutes, answers can be changed until you submit
            </li>
            <li>
              <b>{PASS}</b> correct answers to pass
            </li>
          </ul>
          <div className="actions">
            <button
              className="btn btn-primary btn-lg"
              onClick={() => {
                onActiveChange(true)
                setRun(1)
              }}
            >
              <Play size={18} aria-hidden /> Start exam
            </button>
            <button className="btn btn-ghost" onClick={onChangeState}>
              Change state
            </button>
          </div>
        </section>
        {store.p.exams.length > 0 && (
          <ExamSummaryCard
            exams={store.p.exams}
            onOpen={onOpenStats}
          />
        )}
      </div>
    )
  }

  return (
    <Exam
      key={run}
      store={store}
      onExit={() => {
        onActiveChange(false)
        setRun(0)
      }}
      onRetake={() => setRun((r) => r + 1)}
      onPractise={onPractise}
    />
  )
}

interface ExamProps {
  store: Store
  onExit: () => void
  onRetake: () => void
  onPractise: (title: string, ids: string[]) => void
}

/** Mock test: 30 general + 3 state questions, 60 minutes, results at the end. */
function Exam({ store, onExit, onRetake, onPractise }: ExamProps) {
  const ids = useMemo(
    () => [
      ...shuffle(GENERAL).slice(0, 30).map((q) => q.id),
      ...shuffle(stateQuestions(store.p.state)).slice(0, 3).map((q) => q.id),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [answers, setAnswers] = useState<(number | null)[]>(() => ids.map(() => null))
  const [idx, setIdx] = useState(0)
  const [start] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [finished, setFinished] = useState<number | null>(null)
  /** after finishing: null = summary, number = reviewing that question */
  const [review, setReview] = useState<number | null>(null)
  const [mapOpen, setMapOpen] = useState(false)
  const [ask, confirmEl] = useConfirm()

  const elapsed = Math.floor(((finished ?? now) - start) / 1000)
  const left = Math.max(0, LIMIT - elapsed)

  useEffect(() => {
    if (finished) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [finished])

  const submit = () => {
    if (finished) return
    const end = Date.now()
    let score = 0
    ids.forEach((id, i) => {
      const q = BY_ID.get(id)!
      const ok = answers[i] === q.correct
      if (ok) score++
      if (answers[i] !== null) store.record(id, ok)
    })
    store.addExam({
      date: end,
      state: store.p.state,
      score,
      total: ids.length,
      seconds: Math.floor((end - start) / 1000),
      answers: ids.map((id, i) => [id, answers[i]]),
    })
    trackEvent('exam-finished', {
      state: store.p.state,
      score,
      passed: score >= PASS,
      translation: store.p.showTranslation ? store.p.lang : 'off',
    })
    setFinished(end)
    window.scrollTo({ top: 0 })
  }

  useEffect(() => {
    if (left === 0 && !finished) submit()
  })

  const go = (i: number) => {
    setIdx(Math.max(0, Math.min(ids.length - 1, i)))
    setMapOpen(false)
    window.scrollTo({ top: 0 })
  }

  useEffect(() => {
    if (finished) return
    const onKey = (e: KeyboardEvent) => {
      if (document.body.classList.contains('noscroll')) return
      if (['1', '2', '3', '4'].includes(e.key)) setAnswers((a) => a.map((v, k) => (k === idx ? Number(e.key) - 1 : v)))
      else if (e.key === 'ArrowRight') go(idx + 1)
      else if (e.key === 'ArrowLeft') go(idx - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const correct = (i: number) => answers[i] === BY_ID.get(ids[i])!.correct
  const score = ids.filter((_, i) => correct(i)).length
  const unanswered = answers.filter((a) => a === null).length
  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')
  const timeTone = left < 300 ? 'chip-bad' : left < 600 ? 'chip-warn' : ''
  const english = <LangToggle store={store} />

  const leave = async () => {
    if (finished) return onExit()
    if (await ask({ title: 'Leave the exam?', body: 'Your answers so far will be lost.', ok: 'Leave exam', cancel: 'Keep going', danger: true }))
      onExit()
  }

  const grid = (
    <nav className="qgrid" aria-label="Questions">
      {ids.map((id, i) => {
        let cls = answers[i] !== null ? 'answered' : ''
        if (finished) cls = correct(i) ? 'correct' : 'wrong'
        const cur = finished ? review === i : i === idx
        return (
          <button
            key={id}
            className={`${cls} ${cur ? 'current' : ''}`}
            aria-current={cur ? 'step' : undefined}
            aria-label={`Question ${i + 1}${finished ? (correct(i) ? ', correct' : ', wrong') : answers[i] !== null ? ', answered' : ''}`}
            onClick={() => (finished ? setReview(i) : go(i))}
          >
            {i + 1}
          </button>
        )
      })}
    </nav>
  )

  /* ---------- results ---------- */
  if (finished && review === null) {
    const missed = ids.filter((_, i) => !correct(i))
    return (
      <ExamResults
        title={`Mock exam · ${STATES[store.p.state]}`}
        seconds={elapsed}
        score={score}
        total={ids.length}
        answers={ids.map((id, i) => [id, answers[i]])}
        closeLabel="Close results"
        onClose={onExit}
        onReview={setReview}
        dock={
          <>
            <button className="btn btn-secondary" onClick={onRetake}>
              <RotateCcw size={16} aria-hidden /> New exam
            </button>
            {missed.length > 0 ? (
              <button className="btn btn-primary" onClick={() => onPractise('Missed in mock exam', missed)}>
                Practise the {missed.length} I missed
              </button>
            ) : (
              <button className="btn btn-primary" onClick={onExit}>
                Done
              </button>
            )}
          </>
        }
      />
    )
  }

  /* ---------- running exam, or reviewing one question after it ---------- */
  const cur = finished ? review! : idx
  const q = BY_ID.get(ids[cur])!

  return (
    <div className="session">
      {confirmEl}
      <header className="sessbar">
        <div className="sessbar-in">
          {finished ? (
            <button className="icon-btn" aria-label="Back to results" onClick={() => setReview(null)}>
              <ChevronLeft size={18} />
            </button>
          ) : (
            <button className="icon-btn" aria-label="Leave exam" onClick={leave}>
              <X size={18} />
            </button>
          )}
          <strong className="sess-title">{finished ? 'Review' : 'Mock exam'}</strong>
          {english}
          {!finished && (
            <span className={`chip timer ${timeTone}`} aria-label={`${mm} minutes ${ss} seconds left`}>
              <Clock size={14} aria-hidden /> {mm}:{ss}
            </span>
          )}
        </div>
      </header>
      <div className="sess-progress">
        <button className="map-toggle" aria-expanded={mapOpen} onClick={() => setMapOpen((o) => !o)}>
          <Grid3x3 size={16} aria-hidden />
          <span>
            Question {cur + 1} of {ids.length}
          </span>
          {!finished && <span className="muted">· {ids.length - unanswered} answered</span>}
          <ChevronDown size={16} aria-hidden className={mapOpen ? 'flip' : ''} />
        </button>
        <div className={mapOpen ? 'map open' : 'map'}>{grid}</div>
      </div>
      <main className="page page-wide">
        <QuestionCard
          q={q}
          label={cur >= 30 ? 'State question' : undefined}
          selected={answers[cur]}
          reveal={!!finished}
          keywords={!!finished && store.p.keywords}
          userState={store.p.state}
          onSelect={finished ? undefined : (i) => setAnswers((a) => a.map((v, k) => (k === idx ? i : v)))}
        />
        {finished && answers[cur] === null && <p className="muted center">You did not answer this question.</p>}
      </main>
      <footer className="dock">
        <div className="dock-in">
          <button
            className="btn btn-secondary btn-icon"
            aria-label="Previous question"
            disabled={cur === 0}
            onClick={() => (finished ? setReview(cur - 1) : go(idx - 1))}
          >
            <ChevronLeft size={18} />
          </button>
          {cur + 1 < ids.length ? (
            <button className="btn btn-secondary grow" onClick={() => (finished ? setReview(cur + 1) : go(idx + 1))}>
              Next <ChevronRight size={18} aria-hidden />
            </button>
          ) : (
            <span className="grow" />
          )}
          {!finished && (
            <button
              className={cur + 1 === ids.length || unanswered === 0 ? 'btn btn-primary' : 'btn btn-ghost'}
              onClick={async () => {
                const ok =
                  unanswered === 0 ||
                  (await ask({
                    title: 'Submit the exam?',
                    body: `${unanswered} question${unanswered === 1 ? ' is' : 's are'} still unanswered and will count as wrong.`,
                    ok: 'Submit',
                    cancel: 'Keep going',
                  }))
                if (ok) submit()
              }}
            >
              <Flag size={16} aria-hidden /> Submit
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
