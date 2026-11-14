import { Activity, GitBranch, Info, MapPin, Satellite } from 'lucide-react'
import SearchBox from './SearchBox'
import { useApp } from '../state/AppContext'
import { formatDateLong } from '../utils/date'

export default function Header({ onOpenAbout }: { onOpenAbout: () => void }) {
  const { state, variant } = useApp()

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-40 px-3 pt-3 sm:px-4 sm:pt-4">
      <div className="pointer-events-auto mx-auto flex max-w-[1800px] items-center gap-3">
        <div className="glass flex h-11 shrink-0 items-center gap-2.5 rounded-xl px-2.5 sm:px-3">
          <img src="/favicon.svg" alt="" className="h-7 w-7 rounded-md" />
          <div className="block leading-none">
            <div className="font-display text-[12px] font-semibold tracking-tight text-white sm:text-[14px]">
              EarthTrend<span className="text-sky-300"> 3D</span>
            </div>
            <div className="mt-1 hidden items-center gap-1.5 text-[9px] tracking-[0.14em] text-faint uppercase sm:flex">
              <Satellite size={9} /> NASA Earth observation
            </div>
          </div>
        </div>

        <div className="glass flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-2">
          <div className="hidden shrink-0 items-center gap-1.5 pl-1 text-[10px] text-faint md:flex">
            <MapPin size={12} className="text-sky-300/80" />
            <span className="max-w-[120px] truncate text-muted">{state.place.name}</span>
            <span className="text-faint/60">·</span>
            <span className="max-w-[110px] truncate">{formatDateLong(state.date)}</span>
          </div>
          <div className="min-w-0 flex-1 md:max-w-[460px]">
            <SearchBox compact />
          </div>
          <div className="ml-auto hidden shrink-0 items-center gap-2 pl-1 lg:flex">
            <span className="hidden text-[9.5px] text-faint xl:inline">
              Click the globe to analyse any point
            </span>
            <span className="chip border-emerald-400/20 bg-emerald-400/5 text-emerald-200/90">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live NASA tiles
            </span>
            <span className="chip">{variant.shortLabel}</span>
          </div>
        </div>

        <div className="glass hidden h-11 shrink-0 items-center gap-1 rounded-xl px-1.5 sm:flex">
          <button
            type="button"
            className="icon-btn hidden sm:inline-flex"
            aria-label="About the data and methods"
            onClick={onOpenAbout}
          >
            <Info size={16} />
          </button>
          <a
            href="https://github.com/Eapechan/earthtrend-3d"
            target="_blank"
            rel="noreferrer noopener"
            className="icon-btn hidden sm:inline-flex"
            aria-label="EarthTrend 3D on GitHub"
          >
            <GitBranch size={15} />
          </a>
          <div className="hidden items-center gap-1 rounded-md border border-line/70 px-1.5 py-1 text-[9px] text-faint xl:flex">
            <Activity size={10} className="text-sky-300" />
            free · keyless
          </div>
        </div>
      </div>
    </header>
  )
}
