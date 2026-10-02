import { fmtShort } from '../lib/format'

// 14 bars, one per day: progress reports received.
export default function ActivityChart({ data }) {
  const max = Math.max(1, ...data.map((d) => d.reports))
  const total = data.reduce((s, d) => s + d.reports, 0)
  return (
    <figure className="chart" aria-label={`${total} reports in the last 14 days`}>
      <div className="chart-bars">
        {data.map((d) => (
          <div key={d.date} className="chart-col" title={`${fmtShort(d.date)}: ${d.reports} report${d.reports === 1 ? '' : 's'}`}>
            <div className="chart-bar" style={{ height: `${(d.reports / max) * 100}%` }}>
              {d.reports > 0 && <span className="chart-val">{d.reports}</span>}
            </div>
          </div>
        ))}
      </div>
      <figcaption className="chart-axis">
        <span>{fmtShort(data[0]?.date)}</span>
        <span>Today</span>
      </figcaption>
    </figure>
  )
}
