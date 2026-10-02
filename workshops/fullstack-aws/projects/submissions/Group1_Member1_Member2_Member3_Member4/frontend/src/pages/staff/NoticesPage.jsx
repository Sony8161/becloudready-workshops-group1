import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Spinner from '../../components/Spinner'
import { useToast } from '../../components/Toast'
import { Badge, EmptyState, ErrorBox, Field, Modal, PageHead, Progress } from '../../components/ui'
import { api } from '../../lib/api'
import { fmtDateTime, timeAgo } from '../../lib/format'
import { useApi } from '../../lib/useApi'

function ComposeModal({ onClose, onDone }) {
  const cohorts = useApi('/api/cohorts')
  const trainees = useApi('/api/users?role=TRAINEE&status=ACTIVE')
  const [form, setForm] = useState({ title: '', body: '', priority: 'NORMAL', audience_type: 'ALL', audience_id: '', pinned: false })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const valid = form.title.trim().length >= 2 && form.body.trim() && (form.audience_type === 'ALL' || form.audience_id)
  const send = async () => {
    setBusy(true); setError(null)
    try { onDone(await api.post('/api/notices', { ...form, audience_id: form.audience_id || null })) } catch (err) { setError(err) } finally { setBusy(false) }
  }
  return (
    <Modal wide title="Post a notice" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!valid || busy} onClick={send}>{busy ? <Spinner inline /> : 'Post and notify'}</button></>}>
      <ErrorBox error={error} />
      <Field label="Title"><input value={form.title} onChange={set('title')} placeholder="e.g. Demo day moved to Friday" /></Field>
      <Field label="Message"><textarea rows={5} value={form.body} onChange={set('body')} /></Field>
      <div className="form-grid">
        <Field label="Send to">
          <select value={form.audience_type} onChange={(e) => setForm((f) => ({ ...f, audience_type: e.target.value, audience_id: '' }))}>
            <option value="ALL">Every trainee</option><option value="COHORT">One cohort</option><option value="TRAINEE">One trainee</option>
          </select>
        </Field>
        {form.audience_type !== 'ALL' && (
          <Field label={form.audience_type === 'COHORT' ? 'Cohort' : 'Trainee'}>
            <select value={form.audience_id} onChange={set('audience_id')}>
              <option value="">Choose…</option>
              {form.audience_type === 'COHORT'
                ? (cohorts.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
                : (trainees.data || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Priority">
          <select value={form.priority} onChange={set('priority')}>
            <option value="NORMAL">Normal</option><option value="IMPORTANT">Important</option><option value="URGENT">Urgent</option>
          </select>
        </Field>
      </div>
      <label className="check"><input type="checkbox" checked={form.pinned} onChange={set('pinned')} /> Pin to the top</label>
    </Modal>
  )
}

function Readers({ id }) {
  const { data, loading } = useApi(`/api/notices/${id}`)
  if (loading && !data) return <Spinner inline />
  return (
    <div className="readers">
      <div><div className="small muted">Read ({data.read_by.length})</div><p>{data.read_by.join(', ') || '—'}</p></div>
      <div><div className="small muted">Not yet ({data.not_read_by.length})</div><p className={data.not_read_by.length ? 'text-warn' : ''}>{data.not_read_by.join(', ') || 'Everyone has read it'}</p></div>
    </div>
  )
}

export default function NoticesPage() {
  const { data, error, loading, reload } = useApi('/api/notices')
  const [params] = useSearchParams()
  const focus = params.get('focus')
  const [open, setOpen] = useState(focus)
  const [composing, setComposing] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (focus && data) document.getElementById(`notice-${focus}`)?.scrollIntoView({ block: 'center' })
  }, [focus, data])

  const togglePin = async (n) => {
    try { await api.patch(`/api/notices/${n.id}`, { pinned: !n.pinned }); reload() } catch (err) { toast(err.message, 'bad') }
  }
  const remove = async (n) => {
    if (!window.confirm(`Delete "${n.title}"?`)) return
    try { await api.del(`/api/notices/${n.id}`); toast('Notice deleted'); reload() } catch (err) { toast(err.message, 'bad') }
  }

  return (
    <>
      <PageHead title="Notices" subtitle="Announcements replace scattered 1:1 messages. Trainees are notified right away."
        actions={<button className="btn btn-primary" onClick={() => setComposing(true)}>Post a notice</button>} />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Spinner /> : data?.length === 0 ? (
        <EmptyState title="No notices yet" action={<button className="btn btn-primary" onClick={() => setComposing(true)}>Post the first notice</button>} />
      ) : (
        <div className="stack">
          {data?.map((n) => {
            const pct = n.audience_size ? Math.round((100 * n.read_count) / n.audience_size) : 0
            return (
              <article key={n.id} id={`notice-${n.id}`} className={`card notice ${n.priority === 'URGENT' ? 'notice-urgent' : ''} ${focus === n.id ? 'report-focus' : ''}`}>
                <div className="notice-head">
                  <div>
                    <h2>{n.pinned && <span className="pin" title="Pinned">●</span>}{n.title}</h2>
                    <div className="small muted">To {n.audience_name} · {n.author || 'Staff'} · <span title={fmtDateTime(n.created_at)}>{timeAgo(n.created_at)}</span></div>
                  </div>
                  {n.priority !== 'NORMAL' && <Badge value={n.priority} />}
                </div>
                <p className="notice-body">{n.body}</p>
                <div className="notice-foot">
                  <button className="link-btn reach" onClick={() => setOpen(open === n.id ? null : n.id)} aria-expanded={open === n.id}>
                    <Progress value={pct} size="xs" />
                    <span className="small">{n.read_count} of {n.audience_size} read</span>
                  </button>
                  <div className="row-actions">
                    <button className="btn btn-sm btn-ghost" onClick={() => togglePin(n)}>{n.pinned ? 'Unpin' : 'Pin'}</button>
                    <button className="btn btn-sm btn-danger-ghost" onClick={() => remove(n)}>Delete</button>
                  </div>
                </div>
                {open === n.id && <Readers id={n.id} />}
              </article>
            )
          })}
        </div>
      )}
      {composing && (
        <ComposeModal onClose={() => setComposing(false)}
          onDone={(n) => { setComposing(false); toast(`Posted. ${n.audience_size} trainee${n.audience_size === 1 ? '' : 's'} notified.`); reload() }} />
      )}
    </>
  )
}
