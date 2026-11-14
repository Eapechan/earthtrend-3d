import { useEffect, useRef, useState } from 'react'
import { CornerDownLeft, MapPin, Search, X } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { searchPlaces } from '../data/locations'
import type { Place } from '../types'

const KIND_LABEL: Record<string, string> = {
  continent: 'Continent',
  country: 'Country',
  state: 'State',
  district: 'District',
  city: 'City',
  town: 'Town',
  point: 'Point',
  global: 'Global',
}

export default function SearchBox({ compact = false }: { compact?: boolean }) {
  const { dispatch } = useApp()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const results = query.trim() ? searchPlaces(query, 7) : []

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        event.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const select = (place: Place) => {
    dispatch({ type: 'setPlace', place })
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        className={`flex items-center gap-2 rounded-lg border border-line/80 bg-[#07111f]/80 px-2.5 backdrop-blur transition focus-within:border-sky-400/60 ${
          compact ? 'h-8' : 'h-9'
        }`}
      >
        <Search size={14} className="shrink-0 text-faint" aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            setActive(0)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setActive((i) => Math.min(results.length - 1, i + 1))
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActive((i) => Math.max(0, i - 1))
            } else if (event.key === 'Enter' && results[active]) {
              event.preventDefault()
              select(results[active])
            } else if (event.key === 'Escape') {
              setOpen(false)
              inputRef.current?.blur()
            }
          }}
          placeholder="Search a place — try Chengannur or Kerala"
          aria-label="Search for a place"
          className="min-w-0 flex-1 bg-transparent text-[12.5px] text-ink placeholder:text-faint/80 focus:outline-none"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              inputRef.current?.focus()
            }}
            className="text-faint transition hover:text-ink"
            aria-label="Clear search"
          >
            <X size={13} />
          </button>
        ) : (
          <kbd className="hidden rounded border border-line px-1.5 py-0.5 font-sans text-[9px] text-faint sm:block">
            /
          </kbd>
        )}
      </div>

      {open && query.trim() && (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-line bg-[#08111e]/95 shadow-2xl backdrop-blur-xl animate-fade-in">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-[11px] text-muted">
              No curated place matches “{query}”. Click anywhere on the globe to analyse that point instead.
            </div>
          ) : (
            <ul className="max-h-[300px] overflow-y-auto scroll-thin py-1" role="listbox">
              {results.map((place, index) => (
                <li key={place.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === active}
                    onClick={() => select(place)}
                    onMouseEnter={() => setActive(index)}
                    className={`flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition ${
                      index === active ? 'bg-sky-400/10' : 'hover:bg-white/5'
                    }`}
                  >
                    <MapPin size={13} className="shrink-0 text-sky-300/80" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] text-ink">{place.name}</span>
                      <span className="block truncate text-[10px] text-faint">
                        {place.region ? `${place.region} · ` : ''}
                        {KIND_LABEL[place.kind] ?? place.kind}
                      </span>
                    </span>
                    {index === active && (
                      <CornerDownLeft size={12} className="shrink-0 text-faint" aria-hidden="true" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-line/60 px-2.5 py-1.5 text-[9.5px] text-faint">
            80 curated places · free map clicks also work · no API key required
          </div>
        </div>
      )}
    </div>
  )
}
