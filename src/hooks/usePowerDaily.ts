import { useEffect, useState } from 'react'
import type { PowerDailyWindow } from '../services/nasa/power'
import { fetchPowerDailyWindow } from '../services/nasa/power'

export function usePowerDaily(lat: number, lon: number, endDate: string, enabled = true) {
  const [data, setData] = useState<PowerDailyWindow | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    const controller = new AbortController()
    let active = true
    setLoading(true)
    setError(null)

    fetchPowerDailyWindow(lat, lon, endDate, 12, controller.signal)
      .then((window) => {
        if (active) {
          setData(window)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!active) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setData(null)
        setLoading(false)
        setError(err instanceof Error ? err.message : 'Daily NASA POWER data unavailable.')
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [lat, lon, endDate, enabled])

  return { data, loading, error }
}
