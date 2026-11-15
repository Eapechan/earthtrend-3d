import { Fragment } from 'react'
import { ChevronRight, Globe2, MapPin } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { GLOBE_PLACE } from '../data/locations'
import { placeFromHierarchyItem } from '../utils/geo'

/**
 * Administrative breadcrumb: Globe › Country › State/Province › District.
 * Every crumb is a real, navigable place reconstructed from the geometry that
 * produced it, so going "up" keeps the map and the analysis panel in sync
 * without a second network request.
 */
export default function Breadcrumb() {
  const { state, dispatch } = useApp()
  const place = state.place
  const hierarchy = place.hierarchy ?? []

  if (place.kind === 'global') return null
  if (!hierarchy.length && place.kind === 'continent') return null

  const jump = (item: (typeof hierarchy)[number], index: number) => {
    const next = placeFromHierarchyItem(item, hierarchy.slice(0, index + 1))
    dispatch({ type: 'setPlace', place: next })
  }

  return (
    <nav
      aria-label="Administrative hierarchy"
      className="pointer-events-none absolute left-1/2 top-[60px] z-30 w-full max-w-[calc(100vw-1rem)] -translate-x-1/2 px-2 lg:top-[70px] lg:max-w-[560px]"
    >
      <div className="glass pointer-events-auto flex items-center gap-1 overflow-x-auto rounded-full px-1.5 py-1 text-[10.5px] whitespace-nowrap scroll-thin">
        <button
          type="button"
          onClick={() => dispatch({ type: 'setPlace', place: GLOBE_PLACE })}
          className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-sky-200/90 transition hover:bg-sky-400/10 hover:text-sky-100"
          title="Reset to the global view"
        >
          <Globe2 size={11} aria-hidden="true" />
          Globe
        </button>

        {hierarchy.map((item, index) => {
          const last = index === hierarchy.length - 1
          return (
            <Fragment key={`${item.kind}:${item.id}`}>
              <ChevronRight size={10} className="shrink-0 text-faint/60" aria-hidden="true" />
              <button
                type="button"
                onClick={() => jump(item, index)}
                aria-current={last ? 'location' : undefined}
                className={`flex min-w-0 shrink-0 items-center gap-1 rounded-full px-2 py-1 transition ${
                  last
                    ? 'bg-sky-400/15 font-medium text-sky-100'
                    : 'text-muted hover:bg-white/5 hover:text-ink'
                }`}
                title={item.geoType ? `${item.geoType}: ${item.name}` : item.name}
              >
                {index === 0 ? (
                  <MapPin size={10} aria-hidden="true" className="shrink-0 opacity-70" />
                ) : null}
                <span className="max-w-[150px] truncate">{item.name}</span>
              </button>
            </Fragment>
          )
        })}

        <button
          type="button"
          onClick={() => dispatch({ type: 'setPlace', place: GLOBE_PLACE })}
          className="ml-auto flex shrink-0 items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] text-faint transition hover:border-sky-300/40 hover:text-sky-200"
        >
          Reset
        </button>
      </div>
    </nav>
  )
}
