import { useStore } from '../state/store'

export function AnalyzingBanner() {
  const analyzing = useStore((s) => s.analyzing)
  if (!analyzing) return null

  const pct = analyzing.total > 0 ? (analyzing.current / analyzing.total) * 100 : 0

  return (
    <div className="analyzing-banner">
      <div className="analyzing-banner-spinner" />
      <div className="analyzing-banner-text">
        <div>
          Модель анализирует жанры… {analyzing.current}/{analyzing.total}
        </div>
        <div className="analyzing-banner-track">
          <div className="analyzing-banner-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}
