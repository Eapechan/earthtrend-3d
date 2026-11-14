import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  BarChart3,
  Database,
  ExternalLink,
  Layers,
  MapPin,
  Sparkles,
  Wind,
  X,
} from 'lucide-react'
import { PROVENANCE } from '../data/provenance'

const GROUPS: Array<{ title: string; ids: string[] }> = [
  { title: 'Imagery', ids: ['gibs', 'airs-air-temp', 'modis-lst', 'merra2-wind', 'imerg', 'modis-ndvi', 'airs-rh', 'modis-aod', 'airs-co2', 'viirs-truecolor', 'blue-marble'] },
  { title: 'Point data & vectors', ids: ['power', 'open-meteo'] },
]

export default function AboutModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="About EarthTrend 3D"
    >
      <div className="glass my-2 w-full max-w-[900px] rounded-2xl sm:my-6">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 rounded-t-2xl border-b border-line/70 bg-[#08111e]/95 px-4 py-3.5 backdrop-blur sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <img src="/favicon.svg" alt="" className="h-6 w-6" />
              <span className="font-display text-[15px] font-semibold text-white">
                EarthTrend<span className="text-sky-300"> 3D</span>
              </span>
              <span className="chip border-emerald-400/25 bg-emerald-400/5 text-emerald-200/90">
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" /> NASA open data
              </span>
            </div>
            <p className="mt-1 max-w-[560px] text-[11px] leading-relaxed text-muted">
              A 3D Earth observation explorer that shows real NASA imagery, real reanalysis values, and honest
              uncertainty — with no API keys, accounts or paid services.
            </p>
          </div>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="Close about panel">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-6 px-4 py-5 sm:px-6">
          <section>
            <h3 className="label-caps flex items-center gap-1.5">
              <Sparkles size={11} className="text-sky-300" /> What is live, cached or illustrative
            </h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <ModeCard
                tone="live"
                title="Live"
                body="NASA GIBS tiles and NASA POWER responses are fetched from the public services when you open a layer, date or place. Nothing is pre-baked into the app."
              />
              <ModeCard
                tone="cache"
                title="Cached"
                body="Responses are reused in memory (and GIBS availability in session storage) so panning and stepping dates does not hammer the APIs. The UI labels POWER data as “fetched just now” or “cached”."
              />
              <ModeCard
                tone="effect"
                title="Illustrative"
                body="The wind particles animate real 10 m vectors, but the animation speed is visual, not physical. No other displayed value or pixel is simulated."
              />
            </div>
          </section>

          <section>
            <h3 className="label-caps flex items-center gap-1.5">
              <MapPin size={11} className="text-sky-300" /> Spatial resolution honesty
            </h3>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              A satellite dataset's native grid is the smallest area it can genuinely represent. EarthTrend compares
              that grid to the footprint of the place you selected and states when the place is <em>smaller than one
              cell</em>. For example, Chengannur is about 8 km wide; AIRS surface air temperature and NASA POWER use
              roughly 100 km and 50 km cells respectively. The app therefore reports the regional cell containing the
              town — never a fabricated local measurement.
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              Imagery is also capped by the GIBS Web-Mercator zoom levels. A level-6 tile has ~2.4 km per pixel and a
              level-7 tile ~1.2 km per pixel, regardless of a product's native resolution. The layer panel reports the
              actual rendered scale so extra zooming is not mistaken for extra detail.
            </p>
          </section>

          <section>
            <h3 className="label-caps flex items-center gap-1.5">
              <BarChart3 size={11} className="text-sky-300" /> Trend methodology
            </h3>
            <div className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-muted">
              <p>
                Monthly NASA POWER values are aggregated to annual (or seasonal) values. A year is included only if at
                least 9 of 12 months are present; seasonal aggregates require all three months. Precipitation is
                summed using real month lengths; temperature, wind and humidity are averaged.
              </p>
              <p>
                Missing values arrive as <code className="text-sky-200">-999</code> and are converted to null before
                aggregation. They are never treated as zero. The number of complete years and the percentage of the
                period covered are shown next to every trend.
              </p>
              <p>
                Significance uses the two-sided Mann–Kendall test with tie correction and continuity correction at
                α = 0.05. The effect size is Sen's slope (median of all pairwise slopes), with the Gilbert rank-based
                95% confidence interval. A trend is only labelled significant when at least 10 complete years exist.
                A non-significant result is described as “no significant monotonic trend”, not as “no change”.
              </p>
            </div>
          </section>

          <section>
            <h3 className="label-caps flex items-center gap-1.5">
              <Wind size={11} className="text-sky-300" /> Wind temporal handling
            </h3>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              GIBS publishes MERRA-2 wind <em>speed</em> as a monthly mean and contains no direction vectors. To show
              flow, the app separately requests 10 m wind speed and direction from Open-Meteo, always at 12:00 UTC on
              the selected date: the forecast endpoint for the last 7 days and the ERA5 archive endpoint for older
              dates. The UI states which endpoint and hour were used. The particle animation is an <em>illustrative</em>{' '}
              visualisation of those real vectors — not a measurement and not a forecast for any other hour. Under{' '}
              <code className="text-sky-200">prefers-reduced-motion</code>, the particles are replaced by static arrows.
            </p>
          </section>

          <section>
            <h3 className="label-caps flex items-center gap-1.5">
              <Database size={11} className="text-sky-300" /> Dataset provenance
            </h3>
            <p className="mt-1.5 text-[10px] leading-relaxed text-faint">
              Every product used by the app is listed below with provider, grid, cadence, latency and known caveats.
            </p>
            {GROUPS.map((group) => (
              <div key={group.title} className="mt-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-[10.5px] font-medium text-ink">{group.title}</span>
                  <div className="h-px flex-1 bg-line/60" />
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {group.ids.map((id) => {
                    const entry = PROVENANCE[id]
                    if (!entry) return null
                    return (
                      <div key={id} className="rounded-lg border border-line/60 bg-black/20 p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[10.5px] font-medium leading-snug text-ink/90">
                            {entry.shortName}
                          </span>
                          <span className="chip shrink-0 !text-[8.5px]">{entry.resolution}</span>
                        </div>
                        <p className="mt-0.5 text-[9px] text-faint">
                          {entry.provider} · {entry.cadence} · {entry.latency}
                        </p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-3 text-[9px] leading-relaxed text-muted/80">
                          {entry.caveats.slice(0, 2).map((caveat) => (
                            <li key={caveat}>{caveat}</li>
                          ))}
                        </ul>
                        <a
                          href={entry.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mt-1 inline-flex items-center gap-1 text-[9px] text-sky-300/80 hover:text-sky-200"
                        >
                          Source <ExternalLink size={8} />
                        </a>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </section>

          <section>
            <h3 className="label-caps flex items-center gap-1.5">
              <AlertTriangle size={11} className="text-amber-300" /> Limitations
            </h3>
            <ul className="mt-2 grid gap-1 text-[10.5px] leading-relaxed text-muted sm:grid-cols-2">
              <li>• GIBS imagery is colour-rendered; it is not raw science data and cannot be used for quantitative pixel analysis here.</li>
              <li>• Products have real archive gaps. The app reports a missing date instead of silently substituting another.</li>
              <li>• AIRS surface temperature and humidity are infrared retrievals and are absent under thick cloud.</li>
              <li>• MODIS land-surface temperature is skin temperature, not the air temperature you feel.</li>
              <li>• AOD is a column optical measure, not surface PM₂.₅.</li>
              <li>• NDVI saturates in dense tropical forest; a green canopy can hide degradation.</li>
              <li>• POWER and Open-Meteo are reanalysis/model grids, not weather stations.</li>
              <li>• Trends cover the satellite/reanalysis era only; they say nothing about pre-industrial change.</li>
            </ul>
          </section>

          <section className="rounded-xl border border-line/60 bg-black/20 p-3">
            <h3 className="label-caps flex items-center gap-1.5">
              <Layers size={11} className="text-sky-300" /> Attribution & licence
            </h3>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted">
              NASA imagery and data are produced by NASA's Earth Science Division and served by NASA EOSDIS (GIBS,
              Worldview), the LP DAAC, GES DISC, LAADS DAAC and the NASA POWER project. NASA data are open and free to
              use; this app credits NASA wherever its data appear and keeps Cesium's credit display visible.
            </p>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted">
              Wind vectors come from Open-Meteo (CC-BY 4.0), derived from ECMWF ERA5 and NOAA GFS. The globe is
              rendered with CesiumJS (Apache-2.0). EarthTrend 3D is an independent project and is not affiliated with
              or endorsed by NASA.
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
              <a className="text-sky-300 hover:text-sky-200" href="https://earthdata.nasa.gov/" target="_blank" rel="noreferrer noopener">
                NASA Earthdata
              </a>
              <a className="text-sky-300 hover:text-sky-200" href="https://gibs.earthdata.nasa.gov/" target="_blank" rel="noreferrer noopener">
                NASA GIBS
              </a>
              <a className="text-sky-300 hover:text-sky-200" href="https://power.larc.nasa.gov/" target="_blank" rel="noreferrer noopener">
                NASA POWER
              </a>
              <a className="text-sky-300 hover:text-sky-200" href="https://open-meteo.com/" target="_blank" rel="noreferrer noopener">
                Open-Meteo
              </a>
              <a className="text-sky-300 hover:text-sky-200" href="https://cesium.com/platform/cesiumjs/" target="_blank" rel="noreferrer noopener">
                CesiumJS
              </a>
            </div>
            <p className="mt-2 text-[9px] text-faint">
              This project is open source and self-contained: no private keys, no server-side proxy, no tracking.
            </p>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function ModeCard({
  tone,
  title,
  body,
}: {
  tone: 'live' | 'cache' | 'effect'
  title: string
  body: string
}) {
  const styles =
    tone === 'live'
      ? 'border-emerald-400/25 bg-emerald-400/[0.05]'
      : tone === 'cache'
        ? 'border-sky-400/25 bg-sky-400/[0.05]'
        : 'border-violet-400/25 bg-violet-400/[0.05]'
  return (
    <div className={`rounded-lg border p-2.5 ${styles}`}>
      <div className="text-[10.5px] font-medium text-ink">{title}</div>
      <p className="mt-1 text-[9.5px] leading-relaxed text-muted/90">{body}</p>
    </div>
  )
}
