import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TrendResult } from '../types'
import { formatNumber } from '../utils/math'

interface TrendChartProps {
  trend: TrendResult
  height?: number
  compact?: boolean
}

export default function TrendChart({ trend, height = 120, compact = false }: TrendChartProps) {
  const data = useMemo(
    () =>
      trend.series.map((point) => ({
        year: point.year,
        observed: point.value,
        fitted: point.fitted,
      })),
    [trend.series],
  )

  const decimals = trend.units === '°C/decade' ? 1 : 2

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={compact ? { top: 4, right: 4, bottom: 0, left: 0 } : { top: 8, right: 8, bottom: 0, left: -16 }}>
          {!compact && <CartesianGrid stroke="rgba(125,165,210,0.1)" vertical={false} />}
          {!compact && (
            <XAxis
              dataKey="year"
              type="number"
              domain={['dataMin', 'dataMax']}
              tick={{ fill: '#5d7793', fontSize: 9 }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(125,165,210,0.15)' }}
              tickCount={5}
            />
          )}
          {!compact && (
            <YAxis
              tick={{ fill: '#5d7793', fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => formatNumber(value, decimals === 1 ? 1 : 2)}
              width={44}
            />
          )}
          <Tooltip
            contentStyle={{
              background: 'rgba(7,13,24,0.96)',
              border: '1px solid rgba(125,165,210,0.2)',
              borderRadius: 8,
              fontSize: 11,
              color: '#e6edf7',
            }}
            labelStyle={{ color: '#8ea3bd', fontSize: 10 }}
            labelFormatter={(value) => `Year ${value}`}
            formatter={(value, name) => {
              const num = typeof value === 'number' ? value : Number(value)
              return [
                `${formatNumber(num, decimals === 1 ? 2 : 3)} ${trend.units.split('/')[0]}`,
                name === 'observed' ? 'Annual value' : "Sen's trend",
              ]
            }}
          />
          <Line
            type="monotone"
            dataKey="observed"
            stroke="#7dd3fc"
            strokeWidth={1.4}
            dot={false}
            activeDot={{ r: 3, fill: '#e0f2fe' }}
            isAnimationActive={false}
          />
          <Line
            type="linear"
            dataKey="fitted"
            stroke="#fbbf24"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
