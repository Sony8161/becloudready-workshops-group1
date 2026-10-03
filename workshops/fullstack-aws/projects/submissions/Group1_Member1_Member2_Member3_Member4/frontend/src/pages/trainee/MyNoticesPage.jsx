import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Spinner from '../../components/Spinner'
import { Badge, EmptyState, ErrorBox, PageHead } from '../../components/ui'
import { api } from '../../lib/api'
import { fmtDateTime, timeAgo } from '../../lib/format'
import { useApi } from '../../lib/useApi'

export default function MyNoticesPage() {
  const { id: focus } = useParams()
  const { data, error, loading, reload, setData } = useApi('/api/notices')
  const [onlyUnread, setOnlyUnread] = useState(false)

  const markRead = async (n) => {
    if (n.read) return
    setData((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
    await api.post(`/api/notices/${n.id}/read`).catch(() => reload())
  }

  useEffect(() => {
    if (!focus || !data) return
    const n = data.find((x) => x.id === focus)
    if (n) {
      document.getElementById(`notice-${focus}`)?.scrollIntoView({ block: 'center' })
      markRead(n)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, data === null])

  if (loading && !data) return <Spinner />
  const list = (data || []).filter((n) => !onlyUnread || !n.read)
  const unread = (data || []).filter((n) => !n.read).length

  return (
    <>
      <PageHead title="Notices" subtitle={unread ? `${unread} unread` : 'You are all caught up.'}
        actions={
          <>
            <label className="check"><input type="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} /> Unread only</label>
            {unread > 0 && <button className="btn" onClick={() => data.filter((n) => !n.read).forEach(markRead)}>Mark all read</button>}
          </>
        } />
      <ErrorBox error={error} onRetry={reload} />
      {list.length === 0 ? <EmptyState title="Nothing here">New notices show up here and in the bell.</EmptyState> : (
        <div className="stack">
          {list.map((n) => (
            <article key={n.id} id={`notice-${n.id}`}
              className={`card notice ${n.read ? '' : 'notice-unread'} ${n.priority === 'URGENT' ? 'notice-urgent' : ''} ${focus === n.id ? 'report-focus' : ''}`}>
              <div className="notice-head">
                <div>
                  <h2>{n.pinned && <span className="pin" title="Pinned">●</span>}{n.title}</h2>
                  <div className="small muted">{n.author} · to {n.audience_name} · <span title={fmtDateTime(n.created_at)}>{timeAgo(n.created_at)}</span></div>
                </div>
                <div className="row-gap">
                  {n.priority !== 'NORMAL' && <Badge value={n.priority} />}
                  {!n.read && <span className="badge badge-info">New</span>}
                </div>
              </div>
              <p className="notice-body">{n.body}</p>
              {!n.read && <button className="btn btn-sm" onClick={() => markRead(n)}>Mark as read</button>}
            </article>
          ))}
        </div>
      )}
    </>
  )
}
