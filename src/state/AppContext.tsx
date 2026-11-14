import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react'
import type { LayerId, Place } from '../types'
import { LAYERS, getLayer, getVariant } from '../data/layers'
import { PLACES } from '../data/locations'
import { addDays, addMonths, clampISO, snapToCadence } from '../utils/date'
import { clampVariantDate, variantDateBounds } from '../services/nasa/gibs'

export type PanelKey = 'left' | 'right' | 'timeline'

export interface AppState {
  layerId: LayerId
  variantId: string
  date: string
  place: Place
  compareEnabled: boolean
  compareDate: string
  playing: boolean
  speed: number
  opacity: number
  showTrueColor: boolean
  showFlow: boolean
  leftOpen: boolean
  rightOpen: boolean
  timelineOpen: boolean
  aboutOpen: boolean
  mobilePane: 'layers' | 'location' | null
}

type Action =
  | { type: 'setLayer'; layerId: LayerId }
  | { type: 'setVariant'; variantId: string }
  | { type: 'setDate'; date: string }
  | { type: 'step'; direction: 1 | -1 }
  | { type: 'setPlace'; place: Place }
  | { type: 'setCompare'; enabled: boolean }
  | { type: 'setCompareDate'; date: string }
  | { type: 'setPlaying'; playing: boolean }
  | { type: 'setSpeed'; speed: number }
  | { type: 'setOpacity'; opacity: number }
  | { type: 'toggleTrueColor' }
  | { type: 'toggleFlow' }
  | { type: 'togglePanel'; panel: PanelKey }
  | { type: 'setAbout'; open: boolean }
  | { type: 'setMobilePane'; pane: 'layers' | 'location' | null }

const initialLayer = getLayer('temperature')
const initialVariant = getVariant(initialLayer, initialLayer.defaultVariantId)
const initialDate = variantDateBounds(initialVariant).max
const initialPlace = PLACES.find((p) => p.id === 'india') ?? PLACES[0]

function currentVariant(state: AppState) {
  return getVariant(getLayer(state.layerId), state.variantId)
}

function initialState(): AppState {
  return {
    layerId: initialLayer.id,
    variantId: initialVariant.id,
    date: initialDate,
    place: initialPlace,
    compareEnabled: false,
    compareDate: clampVariantDate(initialVariant, addMonths(initialDate, -12)),
    playing: false,
    speed: 1,
    opacity: 0.5,
    showTrueColor: false,
    showFlow: initialLayer.id === 'wind',
    leftOpen: true,
    rightOpen: true,
    timelineOpen: true,
    aboutOpen: false,
    mobilePane: null,
  }
}

const COMPARE_DRIFT_MS = 45 * 86_400_000

/**
 * Keep the comparison date useful when the layer or cadence changes. A date
 * that is still roughly one year before the selected date is preserved;
 * otherwise it is reset to the same season a year earlier.
 */
function alignedCompareDate(
  variant: ReturnType<typeof currentVariant>,
  date: string,
  existing: string,
): string {
  const target = clampVariantDate(variant, addMonths(date, -12))
  const drift = Math.abs(Date.parse(existing) - Date.parse(target))
  return drift > COMPARE_DRIFT_MS ? target : clampVariantDate(variant, existing)
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'setLayer': {
      const layer = getLayer(action.layerId)
      const variant = getVariant(layer, layer.defaultVariantId)
      const date = clampVariantDate(variant, state.date)
      return {
        ...state,
        layerId: layer.id,
        variantId: variant.id,
        date,
        compareDate: state.compareEnabled
          ? alignedCompareDate(variant, date, state.compareDate)
          : clampVariantDate(variant, state.compareDate),
        showFlow: layer.id === 'wind' ? true : false,
        playing: layer.id === state.layerId ? state.playing : false,
      }
    }
    case 'setVariant': {
      const variant = getVariant(getLayer(state.layerId), action.variantId)
      const date = clampVariantDate(variant, state.date)
      return {
        ...state,
        variantId: variant.id,
        date,
        compareDate: state.compareEnabled
          ? alignedCompareDate(variant, date, state.compareDate)
          : clampVariantDate(variant, state.compareDate),
        playing: false,
      }
    }
    case 'setDate': {
      const variant = currentVariant(state)
      return { ...state, date: clampVariantDate(variant, action.date) }
    }
    case 'step': {
      const variant = currentVariant(state)
      const next =
        variant.cadence === 'monthly'
          ? addMonths(state.date, action.direction)
          : addDays(state.date, action.direction)
      const { min, max } = variantDateBounds(variant)
      const wrapped = next > max ? min : next < min ? max : next
      return { ...state, date: clampISO(snapToCadence(wrapped, variant.cadence), min, max) }
    }
    case 'setPlace':
      return { ...state, place: action.place, rightOpen: true, mobilePane: null }
    case 'setCompare': {
      if (!action.enabled) return { ...state, compareEnabled: false }
      const variant = currentVariant(state)
      return {
        ...state,
        compareEnabled: true,
        compareDate: alignedCompareDate(variant, state.date, state.compareDate),
      }
    }
    case 'setCompareDate': {
      const variant = currentVariant(state)
      return { ...state, compareDate: clampVariantDate(variant, action.date) }
    }
    case 'setPlaying':
      return { ...state, playing: action.playing }
    case 'setSpeed':
      return { ...state, speed: action.speed }
    case 'setOpacity':
      return { ...state, opacity: Math.min(1, Math.max(0.2, action.opacity)) }
    case 'toggleTrueColor':
      return { ...state, showTrueColor: !state.showTrueColor }
    case 'toggleFlow':
      return { ...state, showFlow: !state.showFlow }
    case 'togglePanel':
      if (action.panel === 'left') return { ...state, leftOpen: !state.leftOpen, mobilePane: null }
      if (action.panel === 'right') return { ...state, rightOpen: !state.rightOpen, mobilePane: null }
      return { ...state, timelineOpen: !state.timelineOpen }
    case 'setAbout':
      return { ...state, aboutOpen: action.open }
    case 'setMobilePane':
      return { ...state, mobilePane: action.pane }
    default:
      return state
  }
}

export interface AppContextValue {
  state: AppState
  dispatch: React.Dispatch<Action>
  layer: ReturnType<typeof getLayer>
  variant: ReturnType<typeof getVariant>
  bounds: { min: string; max: string }
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const layer = useMemo(() => getLayer(state.layerId), [state.layerId])
  const variant = useMemo(() => getVariant(layer, state.variantId), [layer, state.variantId])
  const bounds = useMemo(() => variantDateBounds(variant), [variant])

  const value = useMemo<AppContextValue>(
    () => ({ state, dispatch, layer, variant, bounds }),
    [state, layer, variant, bounds],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}

export const LAYER_ORDER = LAYERS.map((l) => l.id)
