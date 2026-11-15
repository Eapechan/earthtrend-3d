import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  ChevronRight,
  Clock,
  Database,
  Droplets,
  ExternalLink,
  Gauge,
  Globe2,
  Minus,
  Ruler,
  Thermometer,
  Wind,
  X,
} from 'lucide-react'
import { useApp } from '../state/AppContext'
import { usePowerBundle } from '../hooks/usePower'
import { usePowerDaily } from '../hooks/usePowerDaily'
import { nearestDailyValue } from '../services/nasa/power'
import { loadGeoIndex } from '../services/geo'
import type { GeoIndex } from '../services/geo/types'
import { POWER_VARIABLES, SEASON_LABELS } from '../data/power'
import { PROVENANCE } from '../data/provenance'
import { assessResolution, pointCellNote } from '../utils/resolution'
import { buildSeasonalSeries, computeTrend, type Season } from '../utils/trends'
import { formatDateLong, todayISO } from '../utils/date'
import { formatNumber, formatP, formatSigned } from '../utils/math'
import type { PowerVariableId, TrendResult } from '../types'
import TrendChart from './TrendChart'

const SEASONS: Season[] = ['annual', 'DJF', 'MAM', 'JJA', 'SON']

function freshness(fetchedAt: number): string {
  const seconds = Math.max(0, (Date.now() - fetchedAt) / 1000)
  if (seconds < 90) return 'fetched just now'
  if (seconds < 3600) return `cached · ${Math.round(seconds / 60)} min old`
  return `cached · ${Math.round(seconds / 3600)} h old`
}

function DirectionBadge({ trend }: { trend: TrendResult }) {
  if (!trend.significant) {
    return (
      <span className="chip border-white/10 text-muted">
        <Minus size={10} /> no significant monotonic trend
      </span>
    )
  }
  const increasing = trend.direction === 'increasing'
  return (
    <span
      className={`chip ${
        increasing
          ? 'border-amber-400/30 bg-amber-400/10 text-amber-200'
          : 'border-sky-400/30 bg-sky-400/10 text-sky-200'
      }`}
    >
      {increasing ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
      significant {trend.direction === 'increasing' ? 'increase' : 'decrease'}
    </span>
  )
}

export default function LocationPanel() {
  const { state, dispatch, variant } = useApp()
  const place = state.place
  const [season, setSeason] = useState<Season>('annual')
  const [expanded, setExpanded] = useState(false)
  const [geoIndex, setGeoIndex] = useState<GeoIndex | null>(null)

  useEffect(() => {
    let cancelled = false
    loadGeoIndex()
      .then((index) => {
        if (!cancelled) setGeoIndex(index)
      })
      .catch(() => {
        /* the panel simply omits coverage numbers */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const countryEntry = place.iso3
    ? geoIndex?.countries.find((country) => country.iso3 === place.iso3) ?? null
    : null
  const hasLevel2 = place.iso3 ? geoIndex?.admin2.some((entry) => entry.iso3 === place.iso3) ?? false : false
  const hierarchy = place.hierarchy ?? []

  const assessment = useMemo(
    () => assessResolution(place, variant.nativeResolutionKm, variant.maxLevel),
    [place, variant.nativeResolutionKm, variant.maxLevel],
  )

  const { data: bundle, loading: bundleLoading, error: bundleError } = usePowerBundle(place.lat, place.lon)
  const dailyEnd = state.date > todayISO() ? todayISO() : state.date
  const { data: daily, loading: dailyLoading } = usePowerDaily(place.lat, place.lon, dailyEnd, true)

  const trendVariable: PowerVariableId = variant.powerVariable ?? 'T2M'
  const meta = POWER_VARIABLES[trendVariable]
  const substituted = !variant.powerVariable

  const months = bundle?.series[trendVariable] ?? []

  const trend = useMemo(() => {
    if (!months.length) return null
    const annual = buildSeasonalSeries(months, meta.aggregation, season)
    return computeTrend({
      annual,
      variable: trendVariable,
      label: meta.label,
      units: meta.trendUnits,
      aggregation: meta.aggregation,
    })
  }, [months, meta.aggregation, meta.label, meta.trendUnits, season, trendVariable])

  const nearestDate = daily ? nearestDailyValue(daily, dailyEnd, 'T2M')?.date ?? null : null
  const day = nearestDate && daily ? daily.byDate[nearestDate] : null
  const dailyValues = day?.values

  const directSource = PROVENANCE[variant.provenanceId]
  const powerSource = PROVENANCE.power

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 px-3.5 pt-3 pb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="label-caps">Location analysis</span>
          </div>
          <h2 className="mt-0.5 truncate font-display text-[17px] font-semibold leading-tight text-white">
            {place.name}
          </h2>
          <p className="truncate text-[10px] text-faint">
            {place.region ? `${place.region} · ` : ''}
            {Math.abs(place.lat).toFixed(3)}°{place.lat >= 0 ? 'N' : 'S'},{' '}
            {Math.abs(place.lon).toFixed(3)}°{place.lon >= 0 ? 'E' : 'W'}
          </p>
        </div>
        <button
          type="button"
          className="icon-btn lg:hidden"
          onClick={() => dispatch({ type: 'setMobilePane', pane: null })}
          aria-label="Close location panel"
        >
          <X size={15} />
        </button>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-3.5 pb-5">
        {place.blurb && <p className="text-[11px] leading-relaxed text-muted">{place.blurb}</p>}

        {/* ---- Administrative geography ----------------------------------- */}
        <section className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="label-caps flex items-center gap-1.5 text-sky-200/80">
              <Globe2 size={11} /> Administrative geography
            </span>
            <span className="chip">{place.geoType ?? (place.kind === 'country' ? 'Country' : place.kind)}</span>
          </div>

          {hierarchy.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {hierarchy.map((item, index) => (
                <Fragment key={`${item.kind}:${item.id}`}>
                  {index > 0 && <ChevronRight size={9} className="text-faint/70" aria-hidden="true" />}
                  <span
                    className={`rounded-full border px-1.5 py-[1px] text-[9.5px] ${
                      index === hierarchy.length - 1
                        ? 'border-sky-300/40 bg-sky-400/10 text-sky-100'
                        : 'border-white/10 bg-white/[0.03] text-muted'
                    }`}
                  >
                    {item.name}
                  </span>
                </Fragment>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[10px] text-faint">
              {place.kind === 'point'
                ? 'Free map point — no administrative boundary is attached to this location.'
                : 'This curated place is not tied to a boundary feature. Click the globe or search an administrative name to load its boundary and full hierarchy.'}
            </p>
          )}

          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[9.5px]">
            <dt className="text-faint">Boundary source</dt>
            <dd className="truncate text-right text-muted" title={place.boundarySource ?? undefined}>
              {place.boundarySource ?? '—'}
            </dd>
            <dt className="text-faint">Licence</dt>
            <dd className="truncate text-right text-muted" title={place.boundaryLicense ?? undefined}>
              {place.boundaryLicense ?? '—'}
            </dd>
            <dt className="text-faint">Level</dt>
            <dd className="text-right text-muted">
              {place.adminLevel === 0
                ? 'Country (ADM0)'
                : place.adminLevel === 1
                  ? 'First-level (ADM1)'
                  : place.adminLevel === 2
                    ? 'Second-level (ADM2)'
                    : place.adminLevel === 3
                      ? 'Local'
                      : '—'}
            </dd>
            <dt className="text-faint">Coverage</dt>
            <dd className="text-right text-muted">
              {!place.iso3
                ? 'Point only'
                : countryEntry
                  ? `${countryEntry.level1} first-level${hasLevel2 ? ' · second-level included' : ' · no second-level data'}`
                  : geoIndex
                    ? 'No matched country'
                    : 'Loading…'}
            </dd>
          </dl>

          <p className="mt-2 text-[10px] leading-relaxed text-sky-100/60">
            Boundaries are geographic reference layers. Zooming in adds administrative detail; it never
            increases the measurement resolution of the NASA dataset.
          </p>
        </section>

        {/* ---- Resolution honesty ------------------------------------------ */}
        <section className="mt-3 rounded-xl border border-sky-400/20 bg-sky-400/[0.05] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="label-caps flex items-center gap-1.5 text-sky-200/80">
              <Ruler size={11} /> What this dataset can see
            </span>
            <span
              className={`chip ${
                assessment.verdict === 'sub-cell'
                  ? 'border-amber-400/30 bg-amber-400/10 text-amber-200'
                  : assessment.verdict === 'marginal'
                    ? 'border-sky-400/30 bg-sky-400/10 text-sky-200'
                    : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
              }`}
            >
              {assessment.verdict === 'sub-cell'
                ? 'sub-cell'
                : assessment.verdict === 'marginal'
                  ? 'marginal'
                  : 'resolvable'}
            </span>
          </div>

          <p className="mt-1.5 text-[12px] font-medium text-white">{assessment.headline}</p>

          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-[86px] shrink-0 text-[9.5px] text-faint">Place width</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-sky-300/80"
                  style={{ width: `${Math.min(100, Math.max(6, assessment.cellsAcross * 33))}%` }}
                />
              </div>
              <span className="num w-[62px] shrink-0 text-right text-[9.5px] text-muted">
                ~{Math.round(assessment.footprintKm)} km
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-[86px] shrink-0 text-[9.5px] text-faint">Dataset cell</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-1/3 rounded-full bg-amber-300/70" />
              </div>
              <span className="num w-[62px] shrink-0 text-right text-[9.5px] text-muted">
                ~{assessment.nativeKm < 10 ? assessment.nativeKm.toFixed(1) : Math.round(assessment.nativeKm)} km
              </span>
            </div>
          </div>

          <p className="mt-2 text-[10px] leading-relaxed text-sky-100/65">{assessment.detail}</p>

          <div className="mt-2 flex flex-wrap gap-1">
            <span className="chip">{variant.nativeResolution}</span>
            <span className="chip">
              {assessment.cellsAcross < 1
                ? `${assessment.cellsAcross.toFixed(2)}× one cell`
                : `${assessment.cellsAcross.toFixed(1)} cells across`}
            </span>
          </div>
        </section>

        {/* ---- Current values --------------------------------------------- */}
        <section className="mt-3">
          <div className="flex items-center justify-between">
            <span className="label-caps">Reanalysis values near this date</span>
            {dailyLoading && <span className="text-[9px] text-faint">loading…</span>}
          </div>

          {day ? (
            <>
              <div className="mt-1 flex items-baseline gap-1.5">
                <Clock size={10} className="text-faint" />
                <span className="text-[10px] text-muted">Nearest POWER day: {formatDateLong(day.date)}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <ValueCard
                  icon={<Thermometer size={12} />}
                  label="Air temp (2 m)"
                  value={dailyValues?.T2M}
                  unit="°C"
                  decimals={1}
                />
                <ValueCard
                  icon={<Droplets size={12} />}
                  label="Precipitation"
                  value={dailyValues?.PRECTOTCORR}
                  unit="mm/day"
                  decimals={1}
                />
                <ValueCard
                  icon={<Wind size={12} />}
                  label="Wind (2 m)"
                  value={dailyValues?.WS2M}
                  unit="m/s"
                  decimals={1}
                />
                <ValueCard
                  icon={<Gauge size={12} />}
                  label="Humidity (2 m)"
                  value={dailyValues?.RH2M}
                  unit="%"
                  decimals={0}
                />
              </div>
              <p className="mt-1.5 text-[9px] leading-relaxed text-faint">
                {pointCellNote(60)} POWER values lag real time; the exact day shown is the nearest available, never
                relabelled as today.
              </p>
            </>
          ) : (
            <div className="mt-2 rounded-lg border border-line/60 bg-black/20 p-2.5 text-[10.5px] text-muted">
              {dailyLoading
                ? 'Loading daily NASA POWER values…'
                : 'No daily POWER value is available in the 12-day window ending on this date. Monthly trends below are unaffected.'}
            </div>
          )}
        </section>

        {/* ---- Trend ------------------------------------------------------ */}
        <section className="mt-4">
          <div className="flex items-center justify-between">
            <span className="label-caps flex items-center gap-1.5">
              <BarChart3 size={11} /> Trend test
            </span>
            <span className="chip">{meta.shortLabel}</span>
          </div>

          {substituted && (
            <p className="mt-1.5 rounded-md border border-amber-400/20 bg-amber-400/[0.06] px-2 py-1.5 text-[9.5px] leading-relaxed text-amber-100/80">
              {layerFriendlyName(state.layerId)} imagery has no POWER point series. The trend below is for 2 m air
              temperature at this location — not for the displayed layer.
            </p>
          )}

          <div className="mt-2 flex gap-1">
            {SEASONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSeason(option)}
                className={`flex-1 rounded-md border px-1 py-1 text-[9.5px] transition ${
                  season === option
                    ? 'border-sky-400/50 bg-sky-400/10 text-sky-100'
                    : 'border-line/60 bg-black/20 text-faint hover:text-muted'
                }`}
                aria-pressed={season === option}
              >
                {SEASON_LABELS[option]}
              </button>
            ))}
          </div>

          {bundleLoading ? (
            <div className="mt-2 h-[92px] animate-pulse rounded-lg border border-line/50 bg-white/[0.03]" />
          ) : bundleError ? (
            <div className="mt-2 rounded-lg border border-red-400/20 bg-red-400/[0.05] p-2.5 text-[10px] text-red-200/80">
              NASA POWER could not be loaded: {bundleError}
            </div>
          ) : trend ? (
            <>
              <div className="mt-2 rounded-lg border border-line/60 bg-black/20 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="num font-display text-[19px] font-semibold leading-none text-white">
                      {formatSigned(trend.slopePerDecade, 2)}
                    </div>
                    <div className="mt-1 text-[9.5px] text-faint">
                      Sen’s slope · {meta.trendUnits}
                    </div>
                  </div>
                  <DirectionBadge trend={trend} />
                </div>

                <div className="mt-2">
                  <TrendChart trend={trend} height={86} compact />
                </div>

                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[9.5px]">
                  <dt className="text-faint">95% CI / decade</dt>
                  <dd className="num text-right text-muted">
                    {trend.slopeCiPerDecade
                      ? `${formatSigned(trend.slopeCiPerDecade[0], 2)} … ${formatSigned(
                          trend.slopeCiPerDecade[1],
                          2,
                        )}`
                      : 'unavailable'}
                  </dd>
                  <dt className="text-faint">Mann–Kendall p</dt>
                  <dd className="num text-right text-muted">{formatP(trend.pValue)}</dd>
                  <dt className="text-faint">Complete years</dt>
                  <dd className="num text-right text-muted">
                    {trend.observations} / {trend.expected} ({Math.round(trend.completeness * 100)}%)
                  </dd>
                  <dt className="text-faint">Period</dt>
                  <dd className="num text-right text-muted">
                    {trend.startYear}–{trend.endYear}
                  </dd>
                </dl>

                {trend.percentChange !== null && (
                  <p className="mt-1.5 text-[9.5px] text-faint">
                    ≈ {formatSigned(trend.percentChange, 1)}% change over the full period (ratio-scaled variable).
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-line/70 bg-white/[0.03] py-1.5 text-[10px] text-sky-200 transition hover:border-sky-400/40 hover:text-white"
                >
                  Detailed statistics & methodology
                </button>
              </div>

              {trend.notes.length > 0 && (
                <ul className="mt-1.5 space-y-1">
                  {trend.notes.map((note) => (
                    <li key={note} className="flex items-start gap-1.5 text-[9px] leading-relaxed text-amber-100/70">
                      <AlertTriangle size={10} className="mt-0.5 shrink-0 text-amber-300/80" />
                      {note}
                    </li>
                  ))}
                </ul>
              )}

              <p className="mt-1.5 text-[9px] leading-relaxed text-faint">
                Two-sided Mann–Kendall test with tie and continuity correction, α = 0.05. An unavailable trend means
                the data are insufficient — not that nothing changed.
              </p>
            </>
          ) : (
            <div className="mt-2 rounded-lg border border-line/60 bg-black/20 p-2.5 text-[10px] leading-relaxed text-muted">
              Not enough complete {SEASON_LABELS[season].toLowerCase()} years to test a trend here. EarthTrend requires
              at least 10 years and, for annual means, at least 9 of 12 months per year.
            </div>
          )}
        </section>

        {/* ---- Provenance -------------------------------------------------- */}
        <section className="mt-4 rounded-lg border border-line/60 bg-black/20 p-2.5">
          <span className="label-caps flex items-center gap-1.5">
            <Database size={11} /> Data provenance
          </span>
          <div className="mt-1.5 space-y-2">
            <div>
              <p className="text-[10.5px] font-medium text-ink/90">{directSource?.dataset}</p>
              <p className="text-[9.5px] text-faint">
                {directSource?.provider} · {directSource?.resolution} · {directSource?.cadence}
              </p>
              <a
                href={directSource?.url}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-0.5 inline-flex items-center gap-1 text-[9.5px] text-sky-300/80 hover:text-sky-200"
              >
                Imagery source <ExternalLink size={9} />
              </a>
            </div>
            <div className="divider" />
            <div>
              <p className="text-[10.5px] font-medium text-ink/90">{powerSource?.dataset}</p>
              <p className="text-[9.5px] text-faint">
                {powerSource?.provider} · {powerSource?.resolution}
              </p>
              <p className="mt-0.5 text-[9px] text-faint">
                {bundle ? freshness(bundle.fetchedAt) : 'monthly series not loaded'}
              </p>
            </div>
          </div>
        </section>
      </div>

      {expanded && trend && (
        <TrendModal trend={trend} meta={meta} onClose={() => setExpanded(false)} />
      )}
    </div>
  )
}

function layerFriendlyName(id: string): string {
  if (id === 'vegetation') return 'Vegetation'
  if (id === 'atmosphere') return 'Atmosphere'
  if (id === 'wind') return 'Wind'
  if (id === 'rainfall') return 'Rainfall'
  return 'This layer'
}

function ValueCard({
  icon,
  label,
  value,
  unit,
  decimals,
}: {
  icon: ReactNode
  label: string
  value: number | null | undefined
  unit: string
  decimals: number
}) {
  return (
    <div className="rounded-lg border border-line/60 bg-black/20 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[9px] text-faint">
        <span className="text-sky-300/70">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="num text-[15px] font-medium text-white">
          {formatNumber(value ?? null, decimals)}
        </span>
        <span className="text-[8.5px] text-faint">{unit}</span>
      </div>
    </div>
  )
}

function TrendModal({
  trend,
  meta,
  onClose,
}: {
  trend: TrendResult
  meta: (typeof POWER_VARIABLES)[PowerVariableId]
  onClose: () => void
}) {
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
      <div className="glass max-h-[90dvh] w-full max-w-[760px] overflow-y-auto rounded-2xl scroll-thin">
        <div className="flex items-start justify-between border-b border-line/60 px-5 py-4">
          <div>
            <span className="label-caps">Trend analysis</span>
            <h3 className="font-display text-lg font-semibold text-white">{meta.label}</h3>
            <p className="text-[10px] text-faint">
              {trend.startYear}–{trend.endYear} · {trend.observations} complete years ·{' '}
              {Math.round(trend.completeness * 100)}% coverage
            </p>
          </div>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="Close analysis">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="rounded-xl border border-line/60 bg-black/25 p-3">
            <TrendChart trend={trend} height={220} />
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-faint">
              <span className="flex items-center gap-1.5">
                <span className="h-[2px] w-4 bg-sky-300" /> Annual value
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-[2px] w-4 border-t border-dashed border-amber-300" /> Sen’s slope fit
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Stat
              label="Sen’s slope"
              value={`${formatSigned(trend.slopePerDecade, 2)} ${meta.trendUnits}`}
            />
            <Stat
              label="95% confidence interval"
              value={
                trend.slopeCiPerDecade
                  ? `${formatSigned(trend.slopeCiPerDecade[0], 2)} … ${formatSigned(
                      trend.slopeCiPerDecade[1],
                      2,
                    )} ${meta.trendUnits}`
                  : 'Not available (too few pairs)'
              }
            />
            <Stat label="Mann–Kendall p-value" value={formatP(trend.pValue)} />
            <Stat label="Kendall’s τ" value={formatNumber(trend.tau, 3)} />
            <Stat
              label="Change over period"
              value={`${formatSigned(trend.changeOverPeriod, 2)} ${trend.units
                .replace('/decade', '')
                .replace(' per decade', '')}`}
            />
            <Stat
              label="Missing / incomplete years"
              value={`${Math.max(0, trend.expected - trend.observations)} of ${trend.expected}`}
            />
          </div>

          <div className="mt-4 space-y-2 text-[11px] leading-relaxed text-muted">
            <p>
              <strong className="text-ink">Method.</strong> Annual (or seasonal) values are built from NASA POWER
              monthly data. A year is used only when at least 9 of 12 months are present; seasonal aggregates require
              all three months. Annual precipitation totals use actual month lengths. The trend is the median of all
              pairwise slopes (Sen, 1968) and the significance test is the tie- and continuity-corrected Mann–Kendall
              test (Mann, 1945; Kendall, 1975). The confidence interval is the Gilbert (1987) rank-based interval on
              Sen’s slope.
            </p>
            <p>
              <strong className="text-ink">Interpretation.</strong> {meta.description}
            </p>
            {trend.notes.map((note) => (
              <p key={note} className="text-amber-100/70">
                {note}
              </p>
            ))}
            <p className="text-faint">
              POWER returns the containing reanalysis grid cell, not a station observation. A non-significant result
              means the evidence is insufficient at α = 0.05, not that no change occurred.
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line/60 bg-black/20 px-3 py-2">
      <div className="text-[9px] uppercase tracking-[0.12em] text-faint">{label}</div>
      <div className="num mt-0.5 text-[12px] text-ink">{value}</div>
    </div>
  )
}
