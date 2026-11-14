import type * as CesiumRuntime from 'cesium'

declare global {
  interface Window {
    Cesium: typeof CesiumRuntime
    CESIUM_BASE_URL?: string
  }
}

let loading: Promise<typeof CesiumRuntime> | null = null

/**
 * Loads the self-hosted Cesium IIFE build once. Setting CESIUM_BASE_URL before
 * the script executes is essential: Cesium resolves Workers/, Assets/ and
 * Widgets/ from that URL.
 */
export function loadCesium(): Promise<typeof CesiumRuntime> {
  if (window.Cesium) return Promise.resolve(window.Cesium)
  if (loading) return loading

  loading = new Promise((resolve, reject) => {
    window.CESIUM_BASE_URL = new URL('/cesium/', window.location.origin).href

    if (!document.querySelector('link[data-cesium-widgets]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = '/cesium/Widgets/widgets.css'
      link.dataset.cesiumWidgets = 'true'
      document.head.appendChild(link)
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-cesium]')
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Cesium))
      existing.addEventListener('error', () => reject(new Error('Cesium failed to load.')))
      return
    }

    const script = document.createElement('script')
    script.src = '/cesium/Cesium.js'
    script.async = true
    script.dataset.cesium = 'true'
    script.onload = () => {
      if (!window.Cesium) {
        reject(new Error('Cesium loaded but did not expose its runtime.'))
        return
      }
      resolve(window.Cesium)
    }
    script.onerror = () => reject(new Error('Unable to download the Cesium runtime.'))
    document.head.appendChild(script)
  }).catch((error: unknown) => {
    loading = null
    throw error
  }) as Promise<typeof CesiumRuntime>

  return loading
}
