import { useEffect, useRef, useState } from 'react'
import { GENERAL, STATES, TOPIC_SHORT, stateQuestions } from './data'
import { ExamStats, PastExam } from './ExamStats'
import { ExamResult, isMastered, isMistake, Store } from './store'
import { Meter } from './ui'

interface Props {
  store: Store
  onPractise: (title: string, ids: string[]) => void
  /** hides the app's top bar and tabs while a past exam is open */
  onFullscreen: (on: boolean) => void
}

export function ProgressTab({ store, onPractise, onFullscreen }: Props) {
  const { p } = store
  const [reviewing, setReviewing] = useState<ExamResult | null>(null)
  const scrollBack = useRef(0)

  useEffect(() => () => onFullscreen(false), [onFullscreen])

  const open = (e: ExamResult) => {
    scrollBack.current = window.scrollY
    onFullscreen(true)
    setReviewing(e)
    window.scrollTo({ top: 0 })
  }

  if (reviewing)
    return (
      <PastExam
        exam={reviewing}
        store={store}
        onPractise={onPractise}
        onBack={() => {
          onFullscreen(false)
          setReviewing(null)
          requestAnimationFrame(() => window.scrollTo({ top: scrollBack.current }))
        }}
      />
    )

  const groups = [
    ...(['politics', 'history', 'society'] as const).map((t) => ({ label: TOPIC_SHORT[t], qs: GENERAL.filter((q) => q.topic === t) })),
    { label: STATES[p.state], qs: stateQuestions(p.state) },
  ]

  return (
    <div className="stack">
      <section className="stack-sm">
        <h2 className="label">Mastery</h2>
        <div className="panel">
          {groups.map(({ label, qs }) => {
            const m = qs.filter((q) => isMastered(p.stats[q.id])).length
            const r = qs.filter((q) => isMistake(p.stats[q.id])).length
            return (
              <div key={label} className="mastery">
                <div className="mastery-head">
                  <b>{label}</b>
                  <span className="muted tnum">
                    {m} / {qs.length}
                    {r > 0 && <span className="bad"> · {r} to review</span>}
                  </span>
                </div>
                <Meter value={m / qs.length} label={`${label}: ${m} of ${qs.length} mastered`} />
              </div>
            )
          })}
        </div>
      </section>

      <ExamStats store={store} onPractise={onPractise} onOpen={open} />
    </div>
  )
}
