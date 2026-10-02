import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { fmtDateTime, timeAgo } from '../lib/format'
import { Avatar, Badge } from './ui'
import Spinner from './Spinner'
import { useToast } from './Toast'

// One progress report. Staff can reply (feedback) or mark it reviewed.
export default function ReportCard({ report, staff, showTrainee = true, onChange, focused }) {
  const [reply, setReply] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const send = async () => {
    setBusy(true)
    try {
      const r = await api.post(`/api/reports/${report.id}/feedback`, { text: reply })
      setReply(''); setOpen(false)
      toast(`Feedback sent to ${report.trainee_name}`)
      onChange?.(r)
    } catch (err) { toast(err.message, 'bad') } finally { setBusy(false) }
  }

  const markReviewed = async () => {
    setBusy(true)
    try { onChange?.(await api.post(`/api/reports/${report.id}/reviewed`)) } catch (err) { toast(err.message, 'bad') } finally { setBusy(false) }
  }

  return (
    <article className={`report ${report.status === 'BLOCKED' ? 'report-blocked' : ''} ${focused ? 'report-focus' : ''}`} id={`report-${report.id}`}>
      <header className="report-head">
        {showTrainee && <Avatar name={report.trainee_name} size={30} />}
        <div className="report-who">
          {showTrainee && (staff ? <Link to={`/trainees/${report.trainee_id}`}><strong>{report.trainee_name}</strong></Link> : <strong>{report.trainee_name}</strong>)}
          <div className="small muted">
            {report.plan_title}{report.task_title ? ` · ${report.task_title}` : ''}
          </div>
        </div>
        <div className="report-meta">
          <Badge value={report.status} />
          <span className="small muted" title={fmtDateTime(report.created_at)}>{timeAgo(report.created_at)}</span>
        </div>
      </header>
      <p className="report-summary">{report.summary}</p>
      {report.blockers && <p className="report-blockers"><strong>Blocker:</strong> {report.blockers}</p>}
      {report.hours != null && <p className="small muted">{report.hours} h spent</p>}
      {report.feedback && (
        <div className="feedback">
          <div className="small"><strong>{report.feedback.by_name}</strong> <span className="muted">replied {timeAgo(report.feedback.at)}</span></div>
          <p>{report.feedback.text}</p>
        </div>
      )}
      {staff && (
        <div className="report-actions">
          {!open ? (
            <>
              <button className="btn btn-sm" onClick={() => setOpen(true)}>{report.feedback ? 'Reply again' : 'Give feedback'}</button>
              {!report.reviewed && <button className="btn btn-sm btn-ghost" onClick={markReviewed} disabled={busy}>Mark reviewed</button>}
              {report.reviewed && !report.feedback && <span className="small muted">Reviewed</span>}
            </>
          ) : (
            <div className="reply">
              <textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={`Reply to ${report.trainee_name}…`} aria-label="Feedback" autoFocus />
              <div className="row-gap">
                <button className="btn btn-sm btn-primary" disabled={busy || !reply.trim()} onClick={send}>{busy ? <Spinner inline /> : 'Send'}</button>
                <button className="btn btn-sm" onClick={() => { setOpen(false); setReply('') }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  )
}
