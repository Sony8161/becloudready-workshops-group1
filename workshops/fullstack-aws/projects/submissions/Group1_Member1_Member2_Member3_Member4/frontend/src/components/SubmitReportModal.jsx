import { useMemo, useState } from 'react'
import { api } from '../lib/api'
import { dueLabel } from '../lib/format'
import { ErrorBox, Field, Modal } from './ui'
import Spinner from './Spinner'

const STATUSES = [
  { value: 'IN_PROGRESS', label: 'Working on it' },
  { value: 'DONE', label: 'Finished a task' },
  { value: 'BLOCKED', label: "I'm blocked" },
]

// plans: [{ plan_id, title, tasks: [{id, title, done, due_date}] }]
export default function SubmitReportModal({ plans, planId, taskId, status: initialStatus, onClose, onDone }) {
  const [pid, setPid] = useState(planId || plans[0]?.plan_id || '')
  const [tid, setTid] = useState(taskId || '')
  const [status, setStatus] = useState(initialStatus || 'IN_PROGRESS')
  const [summary, setSummary] = useState('')
  const [blockers, setBlockers] = useState('')
  const [hours, setHours] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const plan = plans.find((p) => p.plan_id === pid)
  const tasks = useMemo(() => (plan ? [...plan.tasks].sort((a, b) => Number(a.done) - Number(b.done)) : []), [plan])
  const valid = pid && summary.trim().length >= 3 && (status !== 'DONE' || tid) && (status !== 'BLOCKED' || blockers.trim())

  const submit = async () => {
    setBusy(true); setError(null)
    try {
      const body = { plan_id: pid, task_id: tid || null, status, summary, blockers, hours: hours === '' ? null : Number(hours) }
      onDone(await api.post('/api/reports', body))
    } catch (err) { setError(err) } finally { setBusy(false) }
  }

  return (
    <Modal title="Progress report" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!valid || busy} onClick={submit}>{busy ? <Spinner inline /> : 'Send report'}</button></>}>
      <ErrorBox error={error} />
      <Field label="How is it going?">
        <div className="seg seg-3">
          {STATUSES.map((s) => (
            <button key={s.value} type="button" className={`${status === s.value ? 'seg-on' : ''} seg-${s.value}`} onClick={() => setStatus(s.value)}>{s.label}</button>
          ))}
        </div>
      </Field>
      <div className="form-grid">
        <Field label="Plan">
          <select value={pid} onChange={(e) => { setPid(e.target.value); setTid('') }}>
            {plans.map((p) => <option key={p.plan_id} value={p.plan_id}>{p.title}</option>)}
          </select>
        </Field>
        <Field label={status === 'DONE' ? 'Which task did you finish?' : 'Task (optional)'}>
          <select value={tid} onChange={(e) => setTid(e.target.value)}>
            <option value="">{status === 'DONE' ? 'Choose a task…' : 'Whole plan'}</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id} disabled={status === 'DONE' && t.done}>
                {t.done ? '✓ ' : ''}{t.title}{t.done ? '' : ` · ${dueLabel(t.due_date)}`}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="What did you do?" hint="A few sentences is enough.">
        <textarea rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} />
      </Field>
      {status === 'BLOCKED' && (
        <Field label="What is blocking you?" hint="Your manager is alerted right away.">
          <textarea rows={2} value={blockers} onChange={(e) => setBlockers(e.target.value)} />
        </Field>
      )}
      <Field label="Hours spent (optional)">
        <input type="number" min="0" max="100" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} className="w-sm" />
      </Field>
    </Modal>
  )
}
