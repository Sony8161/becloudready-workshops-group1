// A tiny line chart drawn with one SVG <polyline>. No chart library needed.
// points = balances, oldest -> newest.
export default function Sparkline({ points, label }) {
  const W = 200
  const H = 48
  const values = points.length > 1 ? points : [points[0] ?? 0, points[0] ?? 0] // one point = flat line
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const coords = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W
    const y = H - 4 - ((v - min) / range) * (H - 8) // 4px padding top and bottom
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return (
    <svg className="sparkline" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <polyline points={coords.join(' ')} fill="none" stroke="currentColor" strokeWidth="2.5"
        strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
