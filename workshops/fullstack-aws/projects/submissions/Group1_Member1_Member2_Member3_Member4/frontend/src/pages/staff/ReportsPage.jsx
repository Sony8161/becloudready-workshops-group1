import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ReportCard from '../../components/ReportCard'
import Spinner from '../../components/Spinner'
import { EmptyState, ErrorBox, PageHead } from '../../components/ui'
import { qs } from '../../lib/api'
import { useApi } from '../../lib/useApi'

const VIEWS = [
  { key: 'review', label: 'Needs review' },
  { key: 'BLOCKED', label: 'Blocked' },
  { key: 'all', label: 'All reports' },
]

export default function ReportsPage() {
  const [params, setParams] = useSearchParams()
  const focus = params.get('focus')
  const traineeId = params.get('trainee_id') || ''
  const planId = params.get('plan_id') || ''
  const [view, setView] = useState(focus || traineeId || planId ? 'all' : 'review')
  const [cohortId, setCohortId] = useState('')
  const cohorts = useApi('/api/cohorts')
  const path = `/api/reports${qs({
    awaiting_feedback: view === 'review',
    status: view === 'BLOCKED' ? 'BLOCKED' : '',
    cohort_id: cohortId, trainee_id: traineeId, plan_id: planId,
  })}`
  const { data, error, loading, reload, setData } = useApi(path)

  useEffect(() => {
    if (focus && data) document.getElementById(`report-${focus}`)?.scrollIntoView({ block: 'center' })
  }, [focus, data])

  // Update one card in place; in "Needs review", reviewed cards drop out.
  const onChange = (r) => setData((list) => (view === 'review' && r.reviewed ? list.filter((x) => x.id !== r.id) : list.map((x) => (x.id === r.id ? r : x))))

  return (
    <>
      <PageHead title="Progress reports" subtitle="What trainees sent in. Reply to close the loop; they are notified." />
      <div className="toolbar">
        <div className="chips" role="tablist">
          {VIEWS.map((v) => (
            <button key={v.key} role="tab" aria-selected={view === v.key} className={`chip ${view === v.key ? 'chip-on' : ''}`} onClick={() => setView(v.key)}>{v.label}</button>
          ))}
        </div>
        <select value={cohortId} onChange={(e) => setCohortId(e.target.value)} aria-label="Cohort">
          <option value="">All cohorts</option>
          {(cohorts.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {(traineeId || planId) && (
          <button className="chip chip-on" onClick={() => setParams({})}>Filtered by {traineeId ? 'trainee' : 'plan'} ×</button>
        )}
      </div>
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Spinner /> : data?.length === 0 ? (
        <EmptyState title={view === 'review' ? 'All caught up' : 'No reports'}>
          {view === 'review' ? 'Every report has been reviewed. ' : ''}<Link to="/dashboard">Back to the dashboard</Link>
        </EmptyState>
      ) : (
        <div className="stack">
          <p className="small muted">{data?.length} report{data?.length === 1 ? '' : 's'}</p>
          {data?.map((r) => <ReportCard key={r.id} report={r} staff onChange={onChange} focused={focus === r.id} />)}
        </div>
      )}
    </>
  )
}
