import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Info, Layers, MapPin, Orbit } from 'lucide-react'
import { AppProvider, useApp } from './state/AppContext'
import GlobeView from './components/Globe/GlobeView'
import Header from './components/Header'
import LayerRail from './components/LayerRail'
import LocationPanel from './components/LocationPanel'
import Timeline from './components/Timeline'
import AboutModal from './components/AboutModal'
import Breadcrumb from './components/Breadcrumb'
import LoadingScreen from './components/LoadingScreen'
import { useWindField } from './hooks/useWindField'
import { useIsMobile } from './hooks/useMotion'

function Shell() {
  const { state, dispatch } = useApp()
  const isMobile = useIsMobile()
  const [globeReady, setGlobeReady] = useState(false)
  const [globeFailed, setGlobeFailed] = useState(false)
  const wind = useWindField(state.date, state.showFlow && state.layerId === 'wind')

  useEffect(() => {
    const splash = document.getElementById('boot-splash')
    if (!splash) return
    splash.style.opacity = '0'
    const timer = window.setTimeout(() => splash.remove(), 450)
    return () => window.clearTimeout(timer)
  }, [])

  const closePane = useCallback(() => dispatch({ type: 'setMobilePane', pane: null }), [dispatch])
  const onReady = useCallback(() => setGlobeReady(true), [])
  const onGlobeError = useCallback(() => {
    setGlobeFailed(true)
    setGlobeReady(true)
  }, [])

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-abyss">
      <GlobeView
        windField={wind.data}
        windLoading={wind.loading}
        windError={wind.error}
        onReady={onReady}
        onError={onGlobeError}
      />

      <Header onOpenAbout={() => dispatch({ type: 'setAbout', open: true })} />

      <Breadcrumb />

      {state.mobilePane && (
        <button
          type="button"
          aria-label="Close panel"
          onClick={closePane}
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        className={`glass fixed left-2 right-2 top-[62px] bottom-[56px] z-50 overflow-hidden rounded-2xl lg:left-3 lg:right-auto lg:top-[74px] lg:bottom-[150px] lg:flex lg:w-[320px] ${
          state.mobilePane === 'layers' ? 'flex' : 'hidden'
        }`}
        aria-label="Data layers"
      >
        {!isMobile || state.mobilePane === 'layers' ? <LayerRail /> : null}
      </aside>

      <aside
        className={`glass fixed left-2 right-2 top-[62px] bottom-[56px] z-50 overflow-hidden rounded-2xl lg:left-auto lg:right-3 lg:top-[74px] lg:bottom-[150px] lg:flex lg:w-[360px] ${
          state.mobilePane === 'location' ? 'flex' : 'hidden'
        }`}
        aria-label="Location analysis"
      >
        {!isMobile || state.mobilePane === 'location' ? <LocationPanel /> : null}
      </aside>

      <Timeline />

      <nav className="glass fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch justify-around border-t border-white/10 px-2 pb-[env(safe-area-inset-bottom)] lg:hidden">
        <MobileTab
          active={state.mobilePane === 'layers'}
          icon={<Layers size={17} />}
          label="Layers"
          onClick={() => dispatch({ type: 'setMobilePane', pane: state.mobilePane === 'layers' ? null : 'layers' })}
        />
        <MobileTab
          active={state.mobilePane === 'location'}
          icon={<MapPin size={17} />}
          label="Location"
          onClick={() =>
            dispatch({ type: 'setMobilePane', pane: state.mobilePane === 'location' ? null : 'location' })
          }
        />
        <MobileTab
          active={false}
          icon={<Orbit size={17} />}
          label="Globe"
          onClick={() => {
            closePane()
            window.scrollTo({ top: 0 })
          }}
        />
        <MobileTab
          active={state.aboutOpen}
          icon={<Info size={17} />}
          label="About"
          onClick={() => dispatch({ type: 'setAbout', open: true })}
        />
      </nav>

      {state.aboutOpen && <AboutModal onClose={() => dispatch({ type: 'setAbout', open: false })} />}

      <LoadingScreen visible={!globeReady && !globeFailed} />
    </div>
  )
}

function MobileTab({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-lg transition ${
        active ? 'text-sky-200' : 'text-faint hover:text-muted'
      }`}
      aria-pressed={active}
    >
      {icon}
      <span className="text-[9px] tracking-wide">{label}</span>
    </button>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
