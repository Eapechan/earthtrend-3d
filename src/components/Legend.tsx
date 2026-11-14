import type { LegendSpec } from '../types/legend'

function position(value: number, legend: LegendSpec): number {
  if (legend.max === legend.min) return 0
  if (legend.mode === 'log') {
    const lo = Math.log10(Math.max(legend.min, 1e-6))
    const hi = Math.log10(legend.max)
    return Math.min(1, Math.max(0, (Math.log10(Math.max(value, 1e-6)) - lo) / (hi - lo)))
  }
  return Math.min(1, Math.max(0, (value - legend.min) / (legend.max - legend.min)))
}

function formatTick(value: number): string {
  if (value >= 100) return value.toFixed(0)
  if (value >= 10) return value.toFixed(0)
  if (value >= 1) return Number(value.toFixed(1)).toString()
  if (value >= 0.1) return value.toFixed(1)
  return value.toFixed(2)
}

export default function Legend({ legend }: { legend: LegendSpec }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="label-caps">Colour scale</span>
        <span className="text-[10px] text-muted">
          {legend.unit}
          {legend.mode === 'log' ? ' · log' : ''}
        </span>
      </div>
      <div className="relative">
        <div
          className="h-[10px] w-full rounded-[3px] border border-white/10"
          style={{ background: `linear-gradient(90deg, ${legend.colors.join(', ')})` }}
        />
        <div className="relative mt-1 h-4">
          {legend.ticks.map((tick) => {
            const left = position(tick, legend) * 100
            const align = left < 8 ? 'translateX(0)' : left > 92 ? 'translateX(-100%)' : 'translateX(-50%)'
            return (
              <span
                key={tick}
                className="num absolute text-[9px] text-faint"
                style={{ left: `${left}%`, transform: align }}
              >
                {formatTick(tick)}
              </span>
            )
          })}
        </div>
      </div>
      {legend.note && <p className="mt-1.5 text-[10px] leading-relaxed text-faint">{legend.note}</p>}
    </div>
  )
}
