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
    colors: ['#cceafc', '#8a83b8', '#5b4287', '#223189', '#4db8d0', '#e9fdd4', '#fbb85b', '#c31b27', '#fb03cf'],
    unit: '°C',
    ticks: [-70, -40, -10, 20, 45],
    note: 'Converted from the 200–320 K GIBS scale.',
    source: 'Colour ramp sampled from the official NASA GIBS legend',
  },
  lst: {
    mode: 'linear',
    min: -73.15,
    max: 76.85,
    colors: ['#c500ff', '#4500ff', '#004dff', '#00ebff', '#6aff09', '#deff00', '#ffbe00', '#ff5b00', '#ff0100'],
    unit: '°C',
    ticks: [-70, -30, 10, 40, 75],
    note: 'Skin (radiometric) temperature, converted from the 200–350 K GIBS scale.',
    source: 'Colour ramp sampled from the official NASA GIBS legend',
  },
  wind: {
    mode: 'linear',
    min: 0,
    max: 18,
    colors: ['#5e4fa2', '#69c3a4', '#addea3', '#e7f599', '#fefdbc', '#fddb86', '#fca75e', '#f06844', '#9e0142'],
    unit: 'm/s',
    ticks: [0, 6, 12, 18],
    note: 'Monthly mean surface wind speed; the top bin is ≥ 18 m/s.',
    source: 'Colour ramp sampled from the official NASA GIBS legend',
  },
  rain: {
    mode: 'log',
    min: 0.1,
    max: 53,
    colors: ['#00764e', '#009c14', '#4ec300', '#cfe700', '#ff980f', '#ff342c', '#da0000', '#830000', '#330000'],
    unit: 'mm/h',
    ticks: [0.1, 0.5, 2, 10, 53],
    note: 'Logarithmic GIBS colour scale; the last bin is ≥ 53 mm/h.',
    source: 'Colour ramp sampled from the official NASA GIBS legend',
  },
  ndvi: {
    mode: 'linear',
    min: 0,
    max: 1,
    colors: ['#f1ecec', '#dfcec1', '#b4a596', '#a18064', '#96ba20', '#529800', '#2e8001', '#006401', '#001801'],
    unit: 'NDVI',
    ticks: [0, 0.2, 0.4, 0.6, 0.8, 1],
    note: 'Values below 0 are transparent in the GIBS rendering.',
    source: 'Colour ramp sampled from the official NASA GIBS legend',
  },
  rh: {
    mode: 'linear',
    min: 0,
    max: 100,
    colors: ['#b87831', '#e4ad6e', '#f4e2c0', '#e8f8df', '#cafbe4', '#9de8db', '#62cad5', '#1f91a9', '#002360'],
    unit: '%',
    ticks: [0, 25, 50, 75, 100],
    source: 'Colour ramp sampled from the official NASA GIBS legend',
  },
  aod: {
    mode: 'log',
    min: 0.02,
    max: 5,
    colors: ['#fffdcd', '#ffe678', '#ffcb4e', '#ff9e2d', '#ff701e', '#fb3712', '#e1100b', '#b5000e', '#7d000e'],
    unit: 'AOD',
    ticks: [0.02, 0.1, 0.3, 1, 5],
    note: 'Column aerosol optical depth; the official scale is non-uniform and emphasises low values.',
    source: 'Colour ramp sampled from the official NASA GIBS legend',
  },
  co2: {
    mode: 'linear',
    min: 370,
    max: 400,
    colors: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026'],
    unit: 'ppm',
    ticks: [370, 375, 380, 385, 390, 395, 400],
    note: 'Mid-tropospheric CO₂ mixing ratio from AIRS, 2002–2013 only.',
    source: 'Approximate ramp for the AIRS CO₂ monthly product',
  },
}

export function legendFor(variant: GibsVariant): LegendSpec | undefined {
  return LEGENDS[variant.legendKey]
}
