// "1-8 of 230" with Previous / Next. Used by every list on the staff page.
export default function Pager({ skip, limit, total, onChange, noun }) {
  if (total <= limit) return <div className="pager muted small">{total} {noun}</div>
  return (
    <div className="pager">
      <span className="muted small">{skip + 1}-{Math.min(skip + limit, total)} of {total.toLocaleString()} {noun}</span>
      <div className="pager-buttons">
        <button type="button" className="btn btn-outline btn-sm" disabled={skip === 0} onClick={() => onChange(Math.max(0, skip - limit))}>Previous</button>
        <button type="button" className="btn btn-outline btn-sm" disabled={skip + limit >= total} onClick={() => onChange(skip + limit)}>Next</button>
      </div>
    </div>
  )
}
