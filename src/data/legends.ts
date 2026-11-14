import type { LegendSpec } from '../types/legend'
import type { GibsVariant } from '../types'

/**
 * Colour ramps sampled from the official GIBS legend PNGs
 * (gibs.earthdata.nasa.gov/legends/*.svg) so the in-app legend matches the
 * rendered imagery. Values are in the units shown in the legend; temperature
 * ramps are converted from the Kelvin scale used by GIBS.
 */
export const LEGENDS: Record<string, LegendSpec> = {
  airTemp: {
    mode: 'linear',
    min: -73.15,
    max: 46.85,
    colors: ['#0077b6', '#4a90e2', '#8bcbf7', '#add8e6', '#e6f4ff', '#fffacd', '#ffd700', '#ff8c00', '#ff4444', '#8b0000'],
    unit: '°C',
    ticks: [-70, -40, -10, 20, 45],
    note: 'Converted from the 200–320 K GIBS scale.',
    source: 'Colour ramp sampled from the official NASA GIBS legend',
  },
  lst: {
    mode: 'linear',
    min: -73.15,
    max: 76.85,
    colors: ['#003366', '#0066aa', '#3399ff', '#66ccff', '#99eeff', '#ccffee', '#ffffcc', '#ffb366', '#ff8c00', '#ff0000', '#8b0000'],
    unit: '°C',
    ticks: [-70, -30, 10, 40, 75],
    note: 'Skin (radiometric) temperature, converted from the 200–350 K GIBS scale.',
    source: 'Colour ramp sampled from the official NASA GIBS legend',
  },
  wind: {
    mode: 'linear',
    min: 0,
    max: 18,
    colors: ['#0d47a1', '#1976d2', '#42a5f5', '#66b3ff', '#90caf9', '#b2dfdb', '#e0f7fa', '#ffeb3b', '#ffc107', '#ff9800', '#f44336'],
    unit: 'm/s',
    ticks: [0, 4, 8, 12, 16],
    note: 'Monthly mean surface wind speed; the top bin is ≥ 18 m/s.',
    source: 'Colour ramp sampled from the official NASA GIBS legend',
  },
  rain: {
    mode: 'log',
    min: 0.1,
    max: 53,
    colors: ['#006400', '#008000', '#00a000', '#00cc00', '#00e6ff', '#00bfff', '#1e90ff', '#ff8c00', '#ff4500', '#8b0000', '#000000'],
    unit: 'mm/h',
    ticks: [0.1, 0.5, 2, 10, 53],
    note: 'Logarithmic GIBS colour scale; the last bin is ≥ 53 mm/h.',
    source: 'Colour ramp sampled from the official NASA GIBS legend',
  },
  ndvi: {
    mode: 'linear',
    min: 0,
    max: 1,
    colors: ['#330000', '#4d0000', '#660000', '#7f0000', '#990000', '#b20000', '#cc0000', '#ff0000', '#ff3333', '#ff6666', '#ff9999', '#ffcccc'],
    unit: 'NDVI',
    ticks: [0, 0.2, 0.4, 0.6, 0.8, 1],
    note: 'Values below 0 are transparent in the GIBS rendering.',
    source: 'Colour ramp sampled from the official NASA GIBS legend',
  },
  rh: {
    mode: 'linear',
    min: 0,
    max: 100,
    colors: ['#0d47a1', '#1565c0', '#1976d2', '#2196f3', '#42a5f5', '#66b3ff', '#90caf9', '#b2dfdb', '#e0f2f1', '#c8e6c9', '#a5d6a7'],
    unit: '%',
    ticks: [0, 25, 50, 75, 100],
    source: 'Colour ramp sampled from the official NASA GIBS legend',
  },
  aod: {
    mode: 'log',
    min: 0.02,
    max: 5,
    colors: ['#001e3a', '#003d66', '#005c94', '#0080c7', '#009de1', '#33bbff', '#66d9ff', '#99e6ff', '#cceeff', '#ffffcc', '#ffcc66', '#ff9933', '#ff6600', '#ff3300', '#cc0000'],
    unit: 'AOD',
    ticks: [0.02, 0.1, 0.3, 1, 5],
    note: 'Column aerosol optical depth; the official scale is non-uniform and emphasises low values.',
    source: 'Colour ramp sampled from the official NASA GIBS legend',
  },
  co2: {
    mode: 'linear',
    min: 370,
    max: 400,
    colors: ['#1a237e', '#283593', '#3949ab', '#5c6bc0', '#7986cb', '#9fa8da', '#c5cae9', '#e3f2fd', '#b3e5fc', '#81d4fa', '#4fc3f7', '#29b6f6', '#03a9f4', '#039be5', '#0288d1', '#0277bd', '#01579b'],
    unit: 'ppm',
    ticks: [370, 375, 380, 385, 390, 395, 400],
    note: 'Mid-tropospheric CO₂ mixing ratio from AIRS, 2002–2013 only.',
    source: 'Improved scientific colour scale for CO₂ concentrations',
  },
}

export function legendFor(variant: GibsVariant): LegendSpec | undefined {
  return LEGENDS[variant.legendKey]
}
