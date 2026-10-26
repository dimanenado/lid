import { ChevronLeft, ChevronRight, Clock, RotateCcw, Trophy, X } from 'lucide-react'
import { ReactNode, useState } from 'react'
import { BY_ID, PASS, STATES, TOPIC_SHORT, questionRef } from './data'
import { QuestionCard } from './QuestionCard'
import { ExamResult, Store } from './store'
import { LangToggle, TransQuestion } from './ui'

const CHART_MAX = 20

const passed = (e: ExamResult) => e.score >= PASS
const minutes = (s: number) => Math.max(1, Math.round(s / 60))
const fmtDate = (d: number) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

/** Score bars, oldest left, with the pass line. With onOpen each bar opens its attempt. */
function ScoreChart({ exams, compact = false, onOpen }: { exams: ExamResult[]; compact?: boolean; onOpen?: (e: ExamResult) => void }) {
  const shown = exams.slice(0, compact ? 10 : CHART_MAX).reverse()
  const total = shown[0]?.total ?? 33
  return (
    <div className={compact ? 'score-chart compact' : 'score-chart'}>
      {!compact && (
        <div className="chart-axis" aria-hidden>
          <span>{total}</span>
          <span style={{ bottom: `${(PASS / total) * 100}%` }}>{PASS}</span>
          <span>0</span>
        </div>
      )}
      <div
        className="chart-plot"
        role={onOpen ? 'group' : 'img'}
        aria-label={`Scores of your last ${shown.length} exams: ${shown.map((e) => e.score).join(', ')}`}
      >
        <i className="pass-line" style={{ bottom: `${(PASS / total) * 100}%` }} />
        {shown.map((e) => {
          const label = `${e.score} / ${e.total}, ${fmtDate(e.date)}`
          const bar = <i className={passed(e) ? 'ok' : 'bad'} style={{ height: `${Math.max(3, (e.score / e.total) * 100)}%` }} />
          return onOpen ? (
            <button
              key={e.date}
              className="chart-col"
              title={label}
              aria-label={`Exam on ${fmtDate(e.date)}: ${e.score} of ${e.total}, ${passed(e) ? 'passed' : 'not passed'}`}
              onClick={() => onOpen(e)}
            >
              {bar}
            </button>
          ) : (
            <span key={e.date} className="chart-col" title={label}>
              {bar}
            </span>
          )
        })}
      </div>
    </div>
  )
}

interface ResultsProps {
  title: string
  seconds: number
  score: number
  total: number
  /** [question id, chosen option or null]; missing on exams saved without answers */
  answers?: [string, number | null][]
  closeLabel: string
  onClose: () => void
  onReview: (i: number) => void
  dock: ReactNode
}

/** Results screen of one exam: score with the pass track, question grid, and missed questions. */
export function ExamResults({ title, seconds, score, total, answers, closeLabel, onClose, onReview, dock }: ResultsProps) {
  const ok = score >= PASS
  const missed = answers?.map(([id, c], i) => ({ q: BY_ID.get(id)!, i, c })).filter(({ q, c }) => c !== q.correct) ?? []
  return (
    <div className="session session-narrow">
      <header className="sessbar">
        <div className="sessbar-in">
          <button className="icon-btn" aria-label={closeLabel} onClick={onClose}>
            <X size={18} />
          </button>
          <strong className="sess-title">{title}</strong>
          <span className="chip">
            <Clock size={14} aria-hidden /> {minutes(seconds)} min
          </span>
        </div>
      </header>
      <main className="page">
        <div className="stack">
          <section className="result-card">
            <span className={`chip ${ok ? 'chip-ok' : 'chip-bad'}`}>{ok ? 'Passed' : 'Not passed'}</span>
            <div className="big-score">
              {score} <small>/ {total}</small>
            </div>
            <div className="pass-track" aria-hidden>
              <i className={ok ? 'ok' : 'bad'} style={{ width: `${(score / total) * 100}%` }} />
              <b style={{ left: `${(PASS / total) * 100}%` }} />
            </div>
            <div className="pass-legend" aria-hidden>
              <span>0</span>
              <span>{PASS} needed to pass</span>
              <span>{total}</span>
            </div>
          </section>

          {answers ? (
            <section className="stack-sm">
              <h2 className="label">Tap a question to review</h2>
              <nav className="qgrid" aria-label="Questions">
                {answers.map(([id, c], i) => {
                  const right = c === BY_ID.get(id)!.correct
                  return (
                    <button
                      key={id}
                      className={right ? 'correct' : 'wrong'}
                      aria-label={`Question ${i + 1}, ${right ? 'correct' : 'wrong'}`}
                      onClick={() => onReview(i)}
                    >
                      {i + 1}
                    </button>
                  )
                })}
              </nav>
            </section>
          ) : (
            <div className="panel muted small">The answers of this exam were not saved, so only the score is shown.</div>
          )}

          {missed.length > 0 && (
            <section className="stack-sm">
              <h2 className="label">You missed</h2>
              <ul className="rows">
                {missed.map(({ q, i }) => (
                  <li key={q.id}>
                    <button className="row-btn" onClick={() => onReview(i)}>
                      <span className="row-main">
                        <span className="clamp-2" lang="de">
                          {q.de.q}
                        </span>
                        <TransQuestion q={q} className="en clamp-2" />
                      </span>
                      <small className="muted">{questionRef(q)}</small>
                      <ChevronRight size={18} aria-hidden className="muted" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
      <footer className="dock">
        <div className="dock-in">{dock}</div>
      </footer>
    </div>
  )
}

/** Card on the exam start screen; opens the stats screen. */
export function ExamSummaryCard({ exams, onOpen }: { exams: ExamResult[]; onOpen: () => void }) {
  const last = exams[0]
  const pass = exams.filter(passed).length
  return (
    <button className="exam-summary" onClick={onOpen}>
      <span className="exam-summary-head">
        <span className="label">Your exams</span>
        <span className="link">
          Stats <ChevronRight size={16} aria-hidden />
        </span>
      </span>
      <span className="exam-summary-body">
        <span className="exam-summary-nums">
          <span className="big-num tnum">
            {last.score}
            <small> / {last.total}</small>
          </span>
          <span className={`chip ${passed(last) ? 'chip-ok' : 'chip-bad'}`}>{passed(last) ? 'Passed' : 'Not passed'}</span>
          <small className="muted">
            Last exam, {fmtDate(last.date)} · passed {pass} of {exams.length}
          </small>
        </span>
        <ScoreChart exams={exams} compact />
      </span>
    </button>
  )
}

interface StatsProps {
  store: Store
  onPractise: (title: string, ids: string[]) => void
  onOpen: (exam: ExamResult) => void
}

/** Exam statistics for the Progress tab: totals, score chart, topic accuracy, most missed questions, and every attempt. */
export function ExamStats({ store, onPractise, onOpen }: StatsProps) {
  const exams = store.p.exams
  if (!exams.length)
    return (
      <section className="stack-sm">
        <h2 className="label">Exams</h2>
        <div className="panel muted">No mock exams yet. Your results and stats will show up here.</div>
      </section>
    )

  const n = exams.length
  const pass = exams.filter(passed).length
  const best = Math.max(...exams.map((e) => e.score))
  const avg = exams.reduce((a, e) => a + e.score, 0) / n
  const avgMin = minutes(exams.reduce((a, e) => a + e.seconds, 0) / n)

  // per-question detail exists only for exams saved with answers
  const detailed = exams.filter((e) => e.answers)
  const topics = new Map<string, { ok: number; all: number }>()
  const missed = new Map<string, number>()
  for (const e of detailed)
    for (const [id, chosen] of e.answers!) {
      const q = BY_ID.get(id)
      if (!q) continue
      const key = q.state ? 'state' : q.topic
      const t = topics.get(key) ?? { ok: 0, all: 0 }
      t.all++
      if (chosen === q.correct) t.ok++
      else missed.set(id, (missed.get(id) ?? 0) + 1)
      topics.set(key, t)
    }
  const topicRows = (['politics', 'history', 'society', 'state'] as const)
    .filter((k) => topics.has(k))
    .map((k) => ({ label: k === 'state' ? 'State questions' : TOPIC_SHORT[k], ...topics.get(k)! }))
  const mostMissed = [...missed.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)

  return (
    <>
      <section className="stack-sm" id="exams">
        <h2 className="label">Exams</h2>
        <div className="stat-tiles">
          <div className="stat">
            <span className="stat-num tnum">{n}</span>
            <span className="stat-label">Attempts</span>
          </div>
          <div className="stat">
            <span className="stat-num tnum">{Math.round((pass / n) * 100)}%</span>
            <span className="stat-label">Passed ({pass})</span>
          </div>
          <div className="stat">
            <span className="stat-num tnum">{best}</span>
            <span className="stat-label">Best score</span>
          </div>
          <div className="stat">
            <span className="stat-num tnum">{avg.toFixed(1)}</span>
            <span className="stat-label">Average</span>
          </div>
          <div className="stat">
            <span className="stat-num tnum">{avgMin}</span>
            <span className="stat-label">Avg minutes</span>
          </div>
        </div>
      </section>

      <section className="stack-sm">
        <h2 className="label">Exam scores{n > CHART_MAX ? ` · last ${CHART_MAX}` : ''}</h2>
        <div className="panel">
          <ScoreChart exams={exams} onOpen={onOpen} />
          <div className="chart-legend">
            <span>Oldest</span>
            <span>
              <i className="legend-line" /> {PASS} to pass
            </span>
            <span>Latest</span>
          </div>
        </div>
      </section>

      <section className="stack-sm">
        <h2 className="label">By topic in exams</h2>
        {topicRows.length ? (
          <div className="panel">
            {topicRows.map((t) => {
              const pct = Math.round((t.ok / t.all) * 100)
              return (
                <div key={t.label} className="mastery">
                  <div className="mastery-head">
                    <b>{t.label}</b>
                    <span className="muted tnum">
                      {pct}% · {t.ok} / {t.all}
                    </span>
                  </div>
                  <div className="meter">
                    <i className={pct < 50 ? 'low' : ''} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="panel muted small">Topic results start with your next exam.</div>
        )}
      </section>

      {mostMissed.length > 0 && (
        <section className="stack-sm">
          <div className="section-head">
            <h2 className="label">Missed most often</h2>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() =>
                onPractise(
                  'Missed most in exams',
                  mostMissed.map(([id]) => id),
                )
              }
            >
              <RotateCcw size={14} aria-hidden /> Practise these
            </button>
          </div>
          <ul className="rows">
            {mostMissed.map(([id, count]) => {
              const q = BY_ID.get(id)!
              return (
                <li key={id} className="row-static">
                  <span className="row-main">
                    <span className="clamp-2" lang="de">
                      {q.de.q}
                    </span>
                    <TransQuestion q={q} className="en clamp-2" />
                  </span>
                  <span className="chip chip-bad">{count}×</span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="stack-sm">
        <h2 className="label">All attempts</h2>
        <ul className="list">
          {exams.map((e) => (
            <li key={e.date}>
              <button className="list-row" onClick={() => onOpen(e)}>
                <span className={`chip ${passed(e) ? 'chip-ok' : 'chip-bad'}`}>{passed(e) ? 'Passed' : 'Not passed'}</span>
                <span className="row-main">
                  <b className="tnum">
                    {e.score} / {e.total}
                  </b>
                  <small>
                    {new Date(e.date).toLocaleDateString()} · {STATES[e.state]} · {minutes(e.seconds)} min
                    {!e.answers && ' · answers not saved'}
                  </small>
                </span>
                {e.score === best && <Trophy size={16} aria-label="Best score" className="trophy" />}
                <ChevronRight size={18} aria-hidden className="muted" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

interface PastProps {
  exam: ExamResult
  store: Store
  onBack: () => void
  onPractise: (title: string, ids: string[]) => void
}

/** One past exam: its results screen, and a read-only walk through the answers given. */
export function PastExam({ exam, store, onBack, onPractise }: PastProps) {
  const answers = exam.answers?.filter(([id]) => BY_ID.has(id))
  const [review, setReview] = useState<number | null>(null)

  if (answers && review !== null)
    return <ExamReview exam={exam} answers={answers} idx={review} onGo={setReview} store={store} onBack={() => setReview(null)} />

  const missed = answers?.filter(([id, c]) => c !== BY_ID.get(id)!.correct).map(([id]) => id) ?? []
  return (
    <ExamResults
      title={`${fmtDate(exam.date)} · ${STATES[exam.state]}`}
      seconds={exam.seconds}
      score={exam.score}
      total={exam.total}
      answers={answers}
      closeLabel="Back to progress"
      onClose={onBack}
      onReview={(i) => {
        setReview(i)
        window.scrollTo({ top: 0 })
      }}
      dock={
        missed.length > 0 ? (
          <button className="btn btn-primary grow" onClick={() => onPractise('Missed in mock exam', missed)}>
            Practise the {missed.length} I missed
          </button>
        ) : (
          <button className="btn btn-primary grow" onClick={onBack}>
            Done
          </button>
        )
      }
    />
  )
}

interface ReviewProps {
  exam: ExamResult
  answers: [string, number | null][]
  idx: number
  onGo: (i: number) => void
  store: Store
  onBack: () => void
}

/** Read-only walk through one past exam with the answers given. */
function ExamReview({ exam, answers, idx, onGo, store, onBack }: ReviewProps) {
  const [id, chosen] = answers[idx]
  const q = BY_ID.get(id)!
  const go = (i: number) => {
    onGo(i)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="session">
      <header className="sessbar">
        <div className="sessbar-in">
          <button className="icon-btn" aria-label="Back to results" onClick={onBack}>
            <ChevronLeft size={18} />
          </button>
          <strong className="sess-title">
            {fmtDate(exam.date)} · {exam.score} / {exam.total}
          </strong>
          <LangToggle store={store} />
          <span className="chip">
            <Clock size={14} aria-hidden /> {minutes(exam.seconds)} min
          </span>
        </div>
      </header>
      <div className="sess-progress">
        <nav className="qgrid" aria-label="Questions">
          {answers.map(([qid, c], i) => {
            const ok = c === BY_ID.get(qid)!.correct
            return (
              <button
                key={qid}
                className={`${ok ? 'correct' : 'wrong'} ${i === idx ? 'current' : ''}`}
                aria-current={i === idx ? 'step' : undefined}
                aria-label={`Question ${i + 1}, ${ok ? 'correct' : 'wrong'}`}
                onClick={() => go(i)}
              >
                {i + 1}
              </button>
            )
          })}
        </nav>
      </div>
      <main className="page page-wide">
        <QuestionCard
          q={q}
          label={`Question ${idx + 1}`}
          selected={chosen}
          reveal
          keywords={store.p.keywords}
          userState={store.p.state}
        />
        {chosen === null && <p className="muted center">You did not answer this question.</p>}
      </main>
      <footer className="dock">
        <div className="dock-in">
          <button
            className="btn btn-secondary btn-icon"
            aria-label="Previous question"
            disabled={idx === 0}
            onClick={() => go(idx - 1)}
          >
            <ChevronLeft size={18} />
          </button>
          <span className="grow muted small center">{questionRef(q)}</span>
          <button
            className="btn btn-secondary btn-icon"
            aria-label="Next question"
            disabled={idx + 1 === answers.length}
            onClick={() => go(idx + 1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </footer>
    </div>
  )
}
