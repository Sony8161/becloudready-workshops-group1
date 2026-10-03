import { useState } from 'react'
import ReportCard from '../../components/ReportCard'
import Spinner from '../../components/Spinner'
import SubmitReportModal from '../../components/SubmitReportModal'
import { useToast } from '../../components/Toast'
import { EmptyState, ErrorBox, PageHead } from '../../components/ui'
import { useApi } from '../../lib/useApi'

export default function MyReportsPage() {
  const reports = useApi('/api/reports')
  const overview = useApi('/api/me/overview')
  const [open, setOpen] = useState(false)
  const toast = useToast()
  const plans = overview.data?.plans || []

  return (
    <>
      <PageHead title="My progress reports" subtitle="Everything you sent, with your manager's replies."
        actions={plans.length > 0 && <button className="btn btn-primary" onClick={() => setOpen(true)}>Submit progress report</button>} />
      <ErrorBox error={reports.error} onRetry={reports.reload} />
      {reports.loading && !reports.data ? <Spinner /> : reports.data?.length === 0 ? (
        <EmptyState title="No reports yet" action={plans.length > 0 && <button className="btn btn-primary" onClick={() => setOpen(true)}>Send your first report</button>}>
          Reports tell your manager how you're doing, without chasing you on chat.
        </EmptyState>
      ) : (
        <div className="stack">{reports.data?.map((r) => <ReportCard key={r.id} report={r} showTrainee={false} />)}</div>
      )}
      {open && (
        <SubmitReportModal plans={plans} onClose={() => setOpen(false)}
          onDone={() => { setOpen(false); toast('Report sent. Your manager was notified.'); reports.reload(); overview.reload() }} />
      )}
    </>
  )
}
