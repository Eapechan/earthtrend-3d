export type LegendMode = 'linear' | 'log'

export interface LegendSpec {
  mode: LegendMode
  min: number
  max: number
  colors: string[]
  unit: string
  ticks: number[]
  note?: string
  source: string
}
