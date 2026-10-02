import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ReportCard from '../../components/ReportCard'
import Spinner from '../../components/Spinner'
import SubmitReportModal from '../../components/SubmitReportModal'
import { useToast } from '../../components/Toast'
import { Badge, EmptyState, ErrorBox, PageHead, Progress } from '../../components/ui'
import { dueLabel, fmtDate } from '../../lib/format'
import { useApi } from '../../lib/useApi'

export default function MyPlanPage() {
  const { id } = useParams()
  const toast = useToast()
  const plan = useApi(`/api/plans/${id}`)
  const reports = useApi('/api/reports')
  const [reporting, setReporting] = useState(null)

  if (plan.loading && !plan.data) return <Spinner />
  if (plan.error && !plan.data) return <ErrorBox error={plan.error} onRetry={plan.reload} />
  const p = plan.data
  const prog = p.my_progress
  const mine = (reports.data || []).filter((r) => r.plan_id === id)
  const modalPlan = [{ plan_id: id, title: p.title, tasks: prog.tasks }]

  return (
    <>
      <div className="crumbs"><Link to="/me">My home</Link> / {p.title}</div>
      <PageHead title={p.title} subtitle={`${p.assignee_type === 'TRAINEE' ? 'Solo track' : p.assignee_name} · ${prog.done_count} of ${prog.task_count} tasks done`}
        actions={<><Badge value={prog.state} />{prog.state !== 'COMPLETE' && <button className="btn btn-primary" onClick={() => setReporting({})}>Submit progress report</button>}</>} />
      {p.description && <p className="lead">{p.description}</p>}
      <div className="progress-cell big"><Progress value={prog.progress} tone={prog.state === 'BLOCKED' ? 'bad' : undefined} /><strong>{prog.progress}%</strong></div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head"><h2>Tasks</h2></div>
          <ul className="tasks">
            {prog.tasks.map((t) => (
              <li key={t.id} className={`task ${t.done ? 'task-done' : ''} ${t.overdue ? 'task-overdue' : ''}`}>
                <span className="task-check" aria-hidden="true">{t.done ? '✓' : ''}</span>
                <span className="task-title">{t.title}<span className="small muted block">{t.due_date ? fmtDate(t.due_date) : 'No due date'}</span></span>
                {t.done ? <span className="task-due small">Done</span> : (
                  <span className="task-side">
                    <span className="task-due small">{dueLabel(t.due_date)}</span>
                    <button className="btn btn-sm" onClick={() => setReporting({ taskId: t.id, status: 'DONE' })}>Mark done</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <div className="card-head"><h2>My reports on this plan</h2></div>
          {mine.length === 0 ? <EmptyState title="No reports yet">Send one when you make progress or get stuck.</EmptyState> : (
            <div className="stack">{mine.map((r) => <ReportCard key={r.id} report={r} showTrainee={false} />)}</div>
          )}
        </section>
      </div>

      {reporting && (
        <SubmitReportModal plans={modalPlan} planId={id} taskId={reporting.taskId} status={reporting.status}
          onClose={() => setReporting(null)}
          onDone={() => { setReporting(null); toast('Report sent. Your manager was notified.'); plan.reload(); reports.reload() }} />
      )}
    </>
  )
}
