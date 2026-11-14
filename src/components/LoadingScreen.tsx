export default function LoadingScreen({ visible }: { visible: boolean }) {
  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-[radial-gradient(circle_at_50%_42%,#0b1c33_0%,#04060b_64%)] transition-opacity duration-500 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      aria-hidden={!visible}
    >
      <div className="flex flex-col items-center gap-4 px-6 text-center">
        <div className="relative h-20 w-20">
          <div className="loading-orbit absolute inset-0 rounded-full border border-sky-400/20" />
          <div className="loading-orbit loading-orbit-fast absolute inset-0 rounded-full border border-transparent border-t-sky-300" />
          <div className="absolute inset-[22%] rounded-full bg-[radial-gradient(circle_at_35%_30%,#7dd3fc,#0ea5e9_46%,#082f49)] shadow-[0_0_45px_rgba(56,189,248,0.35)]" />
          <div className="absolute inset-[22%] overflow-hidden rounded-full opacity-40">
            <div className="absolute left-0 top-1/3 h-[2px] w-full bg-white/50" />
            <div className="absolute left-0 top-2/3 h-[1.5px] w-full bg-white/30" />
          </div>
        </div>
        <div>
          <div className="font-display text-[13px] font-semibold uppercase tracking-[0.3em] text-sky-100/90">
            EarthTrend 3D
          </div>
          <p className="mt-2 text-[11px] text-muted">Starting the 3D globe and NASA imagery services…</p>
          <p className="mt-1 text-[9.5px] text-faint">
            The Cesium runtime is self-hosted and loads once, then is cached by your browser.
          </p>
        </div>
      </div>
    </div>
  )
}
