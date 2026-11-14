import { useEffect, useState } from 'react'
import type { WindField } from '../types'
import { fetchWindField } from '../services/wind/openMeteo'

export function useWindField(date: string, enabled: boolean) {
  const [data, setData] = useState<WindField | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      setError(null)
      return
    }
    const controller = new AbortController()
    let active = true
    // Never animate yesterday's vectors under today's date label.
    setData(null)
    setLoading(true)
    setError(null)

    fetchWindField(date, controller.signal)
      .then((field) => {
        if (active) {
          setData(field)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!active) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setData(null)
        setLoading(false)
        setError(err instanceof Error ? err.message : 'Wind vectors unavailable for this date.')
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [date, enabled])

  return { data, loading, error }
}

export function useImageryAvailability(
  check: (signal: AbortSignal) => Promise<boolean>,
  deps: unknown[],
) {
  const [available, setAvailable] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true
    setChecking(true)
    check(new AbortController().signal)
      .then((ok) => {
        if (active) {
          setAvailable(ok)
          setChecking(false)
        }
      })
      .catch(() => {
        if (active) {
          setAvailable(false)
          setChecking(false)
        }
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { available, checking }
}
