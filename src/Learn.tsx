import { ArrowRight, BookOpen, Flame, Landmark, RotateCcw, Scale, Users } from 'lucide-react'
import { GENERAL, QUESTIONS, STATES, TOPIC_SHORT, stateQuestions } from './data'
import { useConfirm } from './hooks'
import { isMastered, isMistake, Store } from './store'
import { InfoLabel, MASTERED_HINT, Meter } from './ui'

const TOPIC_ICON = { politics: Scale, history: Landmark, society: Users }

interface Props {
  store: Store
  practise: (title: string, qs: typeof QUESTIONS, forceShuffle?: boolean) => void
  /** continue the saved round, or start a new one when there is none or it is finished */
  continueRound: () => void
}

export function Learn({ store, practise, continueRound }: Props) {
  const { p } = store
  const [ask, confirmEl] = useConfirm()
  const pool = [...GENERAL, ...stateQuestions(p.state)]
  const mastered = pool.filter((q) => isMastered(p.stats[q.id])).length
  const mistakes = pool.filter((q) => isMistake(p.stats[q.id]))
  const unseen = pool.filter((q) => !p.stats[q.id])
  // the 20 questions answered wrong most often, ties broken by the higher miss rate
  const missRate = (id: string) => p.stats[id].wrong / p.stats[id].seen
  const missedMost = pool
    .filter((q) => (p.stats[q.id]?.wrong ?? 0) > 0)
    .sort((a, b) => p.stats[b.id].wrong - p.stats[a.id].wrong || missRate(b.id) - missRate(a.id))
    .slice(0, 20)
  const mostMisses = missedMost.length ? p.stats[missedMost[0].id].wrong : 0

  // the round as App fits it to this state; before the first Start it covers the whole pool
  const total = p.round?.ids.length || pool.length
  const answered = p.round?.results.length ?? 0
  const right = p.round?.results.filter(Boolean).length ?? 0
  const done = answered >= total

  const startOver = async () => {
    if (
      await ask({
        title: 'Start a new round?',
        body: 'Your right and wrong counts for this round go back to zero. Mastered questions and mistakes stay as they are.',
        ok: 'Start over',
      })
    )
      store.update({ round: undefined })
  }

  const tiles = [
    ...(['politics', 'history', 'society'] as const).map((t) => ({
      key: t,
      title: TOPIC_SHORT[t],
      Icon: TOPIC_ICON[t],
      qs: GENERAL.filter((q) => q.topic === t),
    })),
    { key: 'state', title: STATES[p.state], Icon: BookOpen, qs: stateQuestions(p.state) },
  ]

  return (
    <div className="stack">
      {confirmEl}
      <section className="hero">
        <span className="hero-label">{done ? 'Round complete' : 'Your round through all questions'}</span>
        <div className="hero-num">
          {answered} <small>/ {total} answered</small>
        </div>
        <div className="hero-meter" aria-label={`${answered} of ${total} answered`}>
          <i style={{ width: `${(answered / total) * 100}%` }} />
        </div>
        {answered > 0 && (
          <div className="hero-stats">
            <span>✓ {right} right</span>
            <span>✗ {answered - right} wrong</span>
          </div>
        )}
        <div className="hero-actions">
          <button className="btn btn-on-accent btn-lg" onClick={continueRound}>
            {done ? 'Start a new round' : answered ? 'Continue' : 'Start'} <ArrowRight size={18} aria-hidden />
          </button>
          {answered > 0 && !done && (
            <button className="btn btn-outline-accent" onClick={startOver}>
              <RotateCcw size={16} aria-hidden /> Start over
            </button>
          )}
        </div>
      </section>

      <section className="stack-sm">
        <h2 className="label">Overall</h2>
        <div className="overall">
          <div className="overall-head">
            <InfoLabel label={<b>Mastered</b>} hint={MASTERED_HINT} />
            <span className="overall-num">
              {mastered} <small>/ {pool.length}</small>
            </span>
          </div>
          <Meter value={mastered / pool.length} label={`${mastered} of ${pool.length} mastered`} />
          <small className="muted">
            {pool.length - unseen.length} seen · {mistakes.length} mistake{mistakes.length === 1 ? '' : 's'}
            {p.exams[0] ? ` · last exam ${p.exams[0].score}/${p.exams[0].total}` : ''}
          </small>
        </div>
        <div className="list">
          <button className="list-row" disabled={!mistakes.length} onClick={() => practise('Review mistakes', mistakes, true)}>
            <RotateCcw size={18} aria-hidden className="list-icon" />
            <span className="row-main">
              <b>Practise mistakes</b>
              <small>{mistakes.length ? `${mistakes.length} answered wrong last time` : 'No mistakes to review'}</small>
            </span>
            <ArrowRight size={18} aria-hidden className="muted" />
          </button>
          <button className="list-row" disabled={!missedMost.length} onClick={() => practise('Missed most often', missedMost)}>
            <Flame size={18} aria-hidden className="list-icon" />
            <span className="row-main">
              <b>Missed most often</b>
              <small>
                {missedMost.length
                  ? `${missedMost.length} question${missedMost.length === 1 ? '' : 's'}, missed up to ${mostMisses} time${mostMisses === 1 ? '' : 's'}`
                  : 'Nothing missed yet'}
              </small>
            </span>
            <ArrowRight size={18} aria-hidden className="muted" />
          </button>
        </div>
      </section>

      <section className="stack-sm">
        <h2 className="label">Practise by topic</h2>
        <div className="tiles">
          {tiles.map(({ key, title, Icon, qs }) => {
            const m = qs.filter((q) => isMastered(p.stats[q.id])).length
            return (
              <button key={key} className="tile" onClick={() => practise(title, qs)}>
                <span className="tile-head">
                  <Icon size={18} aria-hidden className="tile-icon" />
                  <b>{title}</b>
                </span>
                <Meter value={m / qs.length} label={`${m} of ${qs.length} mastered`} />
                <small>
                  {m} / {qs.length} mastered
                </small>
              </button>
            )
          })}
        </div>
      </section>

    </div>
  )
}
