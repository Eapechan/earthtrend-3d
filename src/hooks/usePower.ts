import { useEffect, useState } from 'react'
import type { PowerVariableId } from '../types'
import type { PowerBundle } from '../services/nasa/power'
import { fetchPowerBundle } from '../services/nasa/power'

interface State {
  data: PowerBundle | null
  loading: boolean
  error: string | null
}

/** Monthly NASA POWER series for a point (30-year window, cached). */
export function usePowerBundle(lat: number, lon: number, enabled = true): State {
  const [state, setState] = useState<State>({ data: null, loading: enabled, error: null })

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    let active = true
    setState((prev) => ({ ...prev, loading: true, error: null }))

    fetchPowerBundle(lat, lon, 1991, new Date().getUTCFullYear(), controller.signal)
      .then((data) => {
        if (active) setState({ data, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (!active) return
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState({
          data: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Unable to load NASA POWER data.',
        })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [lat, lon, enabled])

  return state
}

export interface DailySeriesPoint {
  date: string
  value: number | null
}

export function usePowerVariable(
  bundle: PowerBundle | null,
  variable: PowerVariableId,
): { months: NonNullable<PowerBundle['series'][PowerVariableId]>; loading: boolean } {
  return {
    months: bundle?.series[variable] ?? [],
    loading: false,
  }
}
