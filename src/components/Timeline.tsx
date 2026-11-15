import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pause,
  Play,
  Radar,
  RotateCcw,
  TriangleAlert,
} from 'lucide-react'
import { useApp } from '../state/AppContext'
import {
  checkImageryAvailability,
  gibsDateForVariant,
} from '../services/nasa/gibs'
import {
  dateFraction,
  formatDateLong,
  fractionToDate,
  addMonths,
  todayISO,
} from '../utils/date'

export default function Timeline() {
  const { state, dispatch, variant, bounds } = useApp()
  const [available, setAvailable] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)
  const [finding, setFinding] = useState(false)
  const [lastFound, setLastFound] = useState<string | null>(null)
  const playTimer = useRef<number | null>(null)

  const fraction = useMemo(() => dateFraction(state.date, bounds.min, bounds.max), [state.date, bounds])

  // Preflight the exact tile: NASA GIBS has real gaps, and pretending otherwise
  // would leave the user staring at a silent blank globe.
  useEffect(() => {
    let active = true
    setChecking(true)
    setAvailable(null)
    checkImageryAvailability(variant, state.date)
      .then((ok) => {
        if (!active) return
        setAvailable(ok)
        setChecking(false)
      })
      .catch(() => {
        if (!active) return
        setAvailable(false)
        setChecking(false)
      })
    return () => {
      active = false
    }
  }, [variant, state.date])

  useEffect(() => {
    if (!state.playing) {
      if (playTimer.current) window.clearInterval(playTimer.current)
      playTimer.current = null
      return
    }
    if (state.date >= bounds.max) {
      dispatch({ type: 'setPlaying', playing: false })
      return
    }
    const interval = (variant.cadence === 'monthly' ? 1150 : 780) / state.speed
    playTimer.current = window.setInterval(() => {
      dispatch({ type: 'step', direction: 1 })
    }, interval)
    return () => {
      if (playTimer.current) window.clearInterval(playTimer.current)
      playTimer.current = null
    }
  }, [state.playing, state.speed, state.date, bounds.max, variant.cadence, dispatch])

  const findNearest = async () => {
    setFinding(true)
    const maxTries = variant.cadence === 'monthly' ? 7 : 12
    for (let i = 1; i <= maxTries; i += 1) {
      for (const direction of [-1, 1]) {
        const iso =
          variant.cadence === 'monthly'
            ? addMonths(state.date, direction * i)
            : new Date(new Date(`${state.date}T00:00:00Z`).getTime() + direction * i * 86_400_000)
                .toISOString()
                .slice(0, 10)
        if (iso < bounds.min || iso > bounds.max) continue
        // eslint-disable-next-line no-await-in-loop
        const ok = await checkImageryAvailability(variant, iso)
        if (ok) {
          dispatch({ type: 'setDate', date: gibsDateForVariant(variant, iso) })
          setLastFound(gibsDateForVariant(variant, iso))
          setFinding(false)
          return
        }
      }
    }
    setFinding(false)
  }

  return (
    <div
      data-overlay="timeline"
      className="pointer-events-none absolute inset-x-0 bottom-[56px] z-30 px-3 pb-3 sm:px-4 sm:pb-4 lg:bottom-0 lg:px-4 lg:pb-4"
    >
      <div className="pointer-events-auto glass mx-auto max-w-[860px] rounded-2xl px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <CalendarDays size={13} className="shrink-0 text-sky-300" />
            <div className="min-w-0">
              <div className="truncate font-display text-[13px] font-semibold leading-tight text-white sm:text-[14px]">
                {formatDateLong(state.date)}
              </div>
              <div className="flex items-center gap-1.5 text-[9px] text-faint">
                <span className="uppercase tracking-[0.12em]">{variant.cadence}</span>
                <span>·</span>
                <span className="truncate">{variant.shortLabel}</span>
              </div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              className="icon-btn"
              onClick={() => dispatch({ type: 'step', direction: -1 })}
              aria-label="Previous date"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'setPlaying', playing: !state.playing })}
              className={`btn h-8 w-8 !p-0 ${state.playing ? 'btn-active' : ''}`}
              aria-label={state.playing ? 'Pause time series' : 'Play time series'}
            >
              {state.playing ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => dispatch({ type: 'step', direction: 1 })}
              aria-label="Next date"
            >
              <ChevronRight size={16} />
            </button>
            <select
              value={state.speed}
              onChange={(event) => dispatch({ type: 'setSpeed', speed: Number(event.target.value) })}
              className="select !w-[58px] !py-1 !text-[10px]"
              aria-label="Playback speed"
            >
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={4}>4×</option>
            </select>
            <button
              type="button"
              className="btn h-8 px-2 text-[10px]"
              onClick={() => dispatch({ type: 'setDate', date: bounds.max })}
              title="Jump to the newest date this product can have"
            >
              <RotateCcw size={11} /> Latest
            </button>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2.5">
          <span className="num hidden w-[74px] shrink-0 text-[9px] text-faint sm:block">{bounds.min}</span>
          <div className="relative flex-1">
            <input
              type="range"
              min={0}
              max={1}
              step={0.0001}
              value={fraction}
              onChange={(event) => dispatch({ type: 'setDate', date: fractionToDate(Number(event.target.value), bounds.min, bounds.max) })}
              className="range relative z-10"
              aria-label="Selected imagery date"
            />
            <div className="pointer-events-none absolute inset-x-0 top-1/2 -z-0 h-[3px] -translate-y-1/2 rounded-full bg-white/5" />
            <div
              className="pointer-events-none absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-sky-400/50"
              style={{ width: `${fraction * 100}%` }}
            />
          </div>
          <span className="num hidden w-[74px] shrink-0 text-right text-[9px] text-faint sm:block">{bounds.max}</span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px]">
          <AvailabilityBadge available={available} checking={checking} />

          {available === false && (
            <button
              type="button"
              onClick={findNearest}
              disabled={finding}
              className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200 disabled:opacity-50"
            >
              {finding ? <Loader2 size={10} className="animate-spin" /> : <Radar size={10} />}
              {finding ? 'searching nearby dates…' : 'find nearest date with an image'}
            </button>
          )}
          {lastFound && lastFound !== state.date && (
            <span className="text-faint">found image on {lastFound}</span>
          )}

          <span className="hidden items-center gap-1.5 text-faint sm:inline-flex">
            <span className="h-1 w-1 rounded-full bg-sky-400/60" /> NASA GIBS imagery · NASA POWER data
          </span>

          <span className="ml-auto flex items-center gap-2">
            <label className="hidden items-center gap-1.5 text-faint sm:flex">
              <span>Jump to</span>
              <input
                type="date"
                min={bounds.min}
                max={bounds.max}
                value={state.date}
                onChange={(event) => event.target.value && dispatch({ type: 'setDate', date: event.target.value })}
                className="rounded border border-line/70 bg-black/40 px-1.5 py-0.5 text-[9.5px] text-muted [color-scheme:dark]"
                aria-label="Jump to date"
              />
            </label>
            {state.compareEnabled && (
              <label className="flex items-center gap-1.5 text-faint">
                <span className="hidden sm:inline">Compare with</span>
                <input
                  type="date"
                  min={bounds.min}
                  max={bounds.max}
                  value={state.compareDate}
                  onChange={(event) => event.target.value && dispatch({ type: 'setCompareDate', date: event.target.value })}
                  className="rounded border border-line/70 bg-black/40 px-1.5 py-0.5 text-[9.5px] text-amber-200/90 [color-scheme:dark]"
                  aria-label="Comparison date"
                />
              </label>
            )}
            <span className="hidden text-faint sm:inline">
              {state.date > todayISO() ? 'future' : `${Math.round((Date.now() - Date.parse(`${state.date}T00:00:00Z`)) / 86_400_000)} days ago`}
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}

function AvailabilityBadge({
  available,
  checking,
}: {
  available: boolean | null
  checking: boolean
}) {
  if (checking) {
    return (
      <span className="inline-flex items-center gap-1 text-faint">
        <Loader2 size={10} className="animate-spin" /> checking NASA GIBS for this exact date…
      </span>
    )
  }
  if (available) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-300/90">
        <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" /> NASA image available for this date
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-amber-300/90">
      <TriangleAlert size={10} /> No NASA image for this exact date (a real gap in the archive)
    </span>
  )
}
