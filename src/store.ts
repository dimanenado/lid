import { useCallback, useEffect, useState } from 'react'
import { shuffle } from './data'
import { TransLang, isTransLang } from './i18n'

export interface QStat {
  seen: number
  correct: number
  wrong: number
  /** consecutive correct answers; one right answer clears a mistake, two count as mastered */
  streak: number
  last: number
}

export interface ExamResult {
  date: number
  state: string
  score: number
  total: number
  seconds: number
  /** [question id, chosen option or null] in exam order; missing on exams taken before this was saved */
  answers?: [string, number | null][]
}

/** The saved run through every question for the user's state, picked up with Continue on Learn. */
export interface Round {
  ids: string[]
  /** right or wrong for ids[0..results.length - 1]; the next question is ids[results.length] */
  results: boolean[]
}

export type Theme = 'system' | 'light' | 'dark'

export interface Progress {
  state: string
  /** color theme; "system" follows the device setting */
  theme: Theme
  /** show the translation next to the German text */
  showTranslation: boolean
  /** language of the translation */
  lang: TransLang
  /** shuffle practice sets (exam is always random) */
  shuffle: boolean
  /** highlight key words in questions and answers */
  keywords: boolean
  /** keep a copy of the whole app in the browser so it works without internet */
  offline: boolean
  /** the user picked a state at least once; hides the welcome screen */
  onboarded: boolean
  stats: Record<string, QStat>
  exams: ExamResult[]
  round?: Round
}

const KEY = 'lid-prep:v1'
const DEFAULT: Progress = { state: 'BE', theme: 'system', showTranslation: true, lang: 'en', shuffle: true, keywords: true, offline: true, onboarded: false, stats: {}, exams: [] }

/** Translation settings from saved or imported progress; older saves only have "showEnglish". */
export function translationSettings(data: Record<string, unknown>): Pick<Progress, 'showTranslation' | 'lang'> {
  const show = data.showTranslation ?? data.showEnglish
  return { showTranslation: typeof show === 'boolean' ? show : true, lang: isTransLang(data.lang) ? data.lang : 'en' }
}

function load(): Progress {
  try {
    const s = localStorage.getItem(KEY)
    if (s) {
      // progress saved before the redesign has no "onboarded" flag; those users already chose a state
      const saved = JSON.parse(s)
      const translation = translationSettings(saved)
      delete saved.showEnglish
      return { ...DEFAULT, onboarded: true, ...saved, ...translation }
    }
  } catch {
    /* storage unavailable */
  }
  return DEFAULT
}

export const isMistake = (s?: QStat) => !!s && s.wrong > 0 && s.streak === 0
export const isMastered = (s?: QStat) => !!s && s.streak >= 2

/** A fresh round over the given questions: the ones never answered come first, each part shuffled if the setting is on. */
export function newRound(ids: string[], stats: Record<string, QStat>, shuffled: boolean): Round {
  const order = (a: string[]) => (shuffled ? shuffle(a) : a)
  return { ids: [...order(ids.filter((id) => !stats[id])), ...order(ids.filter((id) => stats[id]))], results: [] }
}

/** The round fitted to the current question pool, e.g. after a state change: drops questions not in it and adds new ones at the end. */
export function fitRound(round: Round, ids: string[]): Round {
  const pool = new Set(ids)
  const keep = round.ids.map((id, i) => [id, round.results[i]] as const).filter(([id]) => pool.has(id))
  const have = new Set(round.ids)
  const added = shuffle(ids.filter((id) => !have.has(id)))
  return {
    ids: [...keep.map(([id]) => id), ...added],
    results: keep.flatMap(([, r]) => (r === undefined ? [] : [r])),
  }
}

export function useProgress() {
  const [p, setP] = useState<Progress>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(p))
    } catch {
      /* storage unavailable */
    }
  }, [p])

  const record = useCallback((id: string, ok: boolean) => {
    setP((prev) => {
      const s = prev.stats[id] ?? { seen: 0, correct: 0, wrong: 0, streak: 0, last: 0 }
      const next: QStat = {
        seen: s.seen + 1,
        correct: s.correct + (ok ? 1 : 0),
        wrong: s.wrong + (ok ? 0 : 1),
        streak: ok ? s.streak + 1 : 0,
        last: Date.now(),
      }
      return { ...prev, stats: { ...prev.stats, [id]: next } }
    })
  }, [])

  /** Add an answer to the round; the question is the next one in it. */
  const recordRound = useCallback(
    (ok: boolean) => setP((prev) => (prev.round ? { ...prev, round: { ...prev.round, results: [...prev.round.results, ok] } } : prev)),
    [],
  )

  const update = useCallback((patch: Partial<Progress>) => setP((prev) => ({ ...prev, ...patch })), [])

  const addExam = useCallback(
    (r: ExamResult) => setP((prev) => ({ ...prev, exams: [r, ...prev.exams].slice(0, 50) })),
    [],
  )

  return { p, record, recordRound, update, addExam }
}

export type Store = ReturnType<typeof useProgress>
