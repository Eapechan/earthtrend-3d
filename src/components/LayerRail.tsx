import { useMemo, useState } from 'react'
import {
  Atom,
  CloudRain,
  ExternalLink,
  Info,
  Leaf,
  Layers,
  SplitSquareHorizontal,
  Thermometer,
  Wind,
  X,
} from 'lucide-react'
import type { LayerId } from '../types'
import { useApp } from '../state/AppContext'
import { LAYERS } from '../data/layers'
import { PROVENANCE } from '../data/provenance'
import { legendFor } from '../data/legends'
import { renderedPixelKm } from '../utils/resolution'
import Legend from './Legend'

const LAYER_ICONS: Record<LayerId, typeof Thermometer> = {
  temperature: Thermometer,
  wind: Wind,
  rainfall: CloudRain,
  vegetation: Leaf,
  atmosphere: Atom,
}

export default function LayerRail() {
  const { state, dispatch, layer, variant, bounds } = useApp()
  const [showSources, setShowSources] = useState(false)
  const legend = legendFor(variant)
  const provenance = PROVENANCE[variant.provenanceId]
  const pixelKm = useMemo(() => renderedPixelKm(variant.maxLevel), [variant.maxLevel])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-sky-300" />
          <span className="font-display text-[12px] font-semibold tracking-wide text-white">Data layers</span>
        </div>
        <button
          type="button"
          className="icon-btn lg:hidden"
          onClick={() => dispatch({ type: 'setMobilePane', pane: null })}
          aria-label="Close layers"
        >
          <X size={15} />
        </button>
      </div>

      <div className="px-2">
        <div className="grid grid-cols-5 gap-1 rounded-lg border border-line/70 bg-black/25 p-1">
          {LAYERS.map((definition) => {
            const Icon = LAYER_ICONS[definition.id]
            const selected = definition.id === state.layerId
            return (
              <button
                key={definition.id}
                type="button"
                onClick={() => dispatch({ type: 'setLayer', layerId: definition.id })}
                className={`flex flex-col items-center gap-1 rounded-md px-1 py-2 transition ${
                  selected ? 'bg-white/[0.07] text-white' : 'text-faint hover:bg-white/[0.04] hover:text-muted'
                }`}
                aria-pressed={selected}
                title={definition.tagline}
              >
                <Icon size={15} style={{ color: selected ? definition.accent : undefined }} />
                <span className="text-[8.5px] leading-none tracking-wide">{definition.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-3.5 pt-3 pb-4">
        <p className="text-[11px] leading-relaxed text-muted">{layer.blurb}</p>

        <div className="mt-3">
          <span className="label-caps">Product</span>
          <div className="mt-1.5 space-y-1">
            {layer.variants.map((item) => {
              const selected = item.id === state.variantId
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => dispatch({ type: 'setVariant', variantId: item.id })}
                  className={`w-full rounded-lg border px-2.5 py-2 text-left transition ${
                    selected
                      ? 'border-sky-400/50 bg-sky-400/10'
                      : 'border-line/70 bg-black/20 hover:border-line hover:bg-white/[0.03]'
                  }`}
                  aria-pressed={selected}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[11.5px] ${selected ? 'text-sky-100' : 'text-ink/90'}`}>
                      {item.label}
                    </span>
                    <span className="num shrink-0 text-[9px] text-faint">{item.cadence}</span>
                  </div>
                  <div className="mt-0.5 text-[9.5px] text-faint">
                    {item.nativeResolution} · {item.tileMatrixSet.replace('GoogleMapsCompatible_Level', 'L')}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {legend && (
          <div className="mt-3.5 rounded-lg border border-line/60 bg-black/20 p-2.5">
            <Legend legend={legend} />
            <div className="mt-2 flex flex-wrap gap-1">
              <span className="chip">renders at ~{pixelKm.toFixed(1)} km/px</span>
              <span className="chip">native {variant.nativeResolution}</span>
            </div>
          </div>
        )}

        <div className="mt-3.5">
          <div className="flex items-center justify-between">
            <span className="label-caps">Layer opacity</span>
            <span className="num text-[10px] text-muted">{Math.round(state.opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min={20}
            max={100}
            value={Math.round(state.opacity * 100)}
            onChange={(event) => dispatch({ type: 'setOpacity', opacity: Number(event.target.value) / 100 })}
            className="range mt-2"
            aria-label="Data layer opacity"
          />
        </div>

        <div className="mt-3 space-y-1.5">
          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-line/60 bg-black/20 px-2.5 py-2">
            <span className="flex items-center gap-2 text-[11px] text-ink/90">
              <span className="h-2 w-2 rounded-full bg-emerald-400/80" /> True-colour imagery
            </span>
            <input
              type="checkbox"
              checked={state.showTrueColor}
              onChange={() => dispatch({ type: 'toggleTrueColor' })}
              className="accent-sky-400"
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-line/60 bg-black/20 px-2.5 py-2">
            <span className="flex items-center gap-2 text-[11px] text-ink/90">
              <SplitSquareHorizontal size={12} className="text-sky-300" /> Compare two dates
            </span>
            <input
              type="checkbox"
              checked={state.compareEnabled}
              onChange={(event) => dispatch({ type: 'setCompare', enabled: event.target.checked })}
              className="accent-sky-400"
            />
          </label>

          {state.layerId === 'wind' && (
            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-line/60 bg-black/20 px-2.5 py-2">
              <span className="flex items-center gap-2 text-[11px] text-ink/90">
                <Wind size={12} className="text-cyan-300" /> Wind flow vectors
              </span>
              <input
                type="checkbox"
                checked={state.showFlow}
                onChange={() => dispatch({ type: 'toggleFlow' })}
                className="accent-sky-400"
              />
            </label>
          )}
        </div>

        <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-2.5">
          <div className="flex items-start gap-1.5">
            <Info size={12} className="mt-0.5 shrink-0 text-amber-300" />
            <p className="text-[10px] leading-relaxed text-amber-100/75">{variant.caveat}</p>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-line/60 bg-black/20">
          <button
            type="button"
            onClick={() => setShowSources((value) => !value)}
            className="flex w-full items-center justify-between px-2.5 py-2 text-left"
            aria-expanded={showSources}
          >
            <span className="label-caps">Dataset provenance</span>
            <span className="text-[10px] text-sky-300/80">{showSources ? 'Hide' : 'Show'}</span>
          </button>
          {showSources && provenance && (
            <div className="border-t border-line/60 px-2.5 py-2.5">
              <p className="text-[11px] font-medium text-ink">{provenance.dataset}</p>
              <dl className="mt-2 grid grid-cols-[72px_1fr] gap-x-2 gap-y-1 text-[10px]">
                <dt className="text-faint">Provider</dt>
                <dd className="text-muted">{provenance.provider}</dd>
                <dt className="text-faint">Resolution</dt>
                <dd className="text-muted">{provenance.resolution}</dd>
                <dt className="text-faint">Cadence</dt>
                <dd className="text-muted">{provenance.cadence}</dd>
                <dt className="text-faint">Latency</dt>
                <dd className="text-muted">{provenance.latency}</dd>
                <dt className="text-faint">Licence</dt>
                <dd className="text-muted">{provenance.license}</dd>
                <dt className="text-faint">Window</dt>
                <dd className="num text-muted">
                  {bounds.min} → {bounds.max}
                </dd>
              </dl>
              {provenance.doi && (
                <p className="mt-1.5 text-[9.5px] text-faint">DOI: {provenance.doi}</p>
              )}
              <a
                href={provenance.url}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-2 inline-flex items-center gap-1 text-[10px] text-sky-300 hover:text-sky-200"
              >
                Official product page <ExternalLink size={10} />
              </a>
            </div>
          )}
        </div>

        <p className="mt-3 text-[9px] leading-relaxed text-faint/80">
          Every image is fetched live from NASA GIBS for the selected date. No imagery is bundled, recoloured or
          simulated. If a product has no image for a date, the app says so rather than substituting another day.
        </p>
      </div>
    </div>
  )
}
