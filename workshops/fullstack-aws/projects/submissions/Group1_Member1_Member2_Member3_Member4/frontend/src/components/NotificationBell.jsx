import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { timeAgo } from '../lib/format'

const ICON = {
  NOTICE: ['N', 'info'], PLAN: ['P', 'brand'], REPORT: ['R', 'good'], BLOCKED: ['!', 'bad'],
  FEEDBACK: ['F', 'brand'], COHORT: ['C', 'info'], WELCOME: ['W', 'good'],
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState({ items: [], unread: 0 })
  const navigate = useNavigate()
  const box = useRef(null)

  const load = useCallback(() => {
    api.get('/api/notifications').then(setData).catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 30000) // automated updates without a refresh
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(id); window.removeEventListener('focus', onFocus) }
  }, [load])

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (!box.current?.contains(e.target)) setOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  const openItem = async (n) => {
    setOpen(false)
    if (!n.read) {
      await api.post(`/api/notifications/${n.id}/read`).catch(() => {})
      load()
    }
    if (n.link) navigate(n.link)
  }

  const readAll = async () => {
    await api.post('/api/notifications/read-all').catch(() => {})
    load()
  }

  return (
    <div className="bell" ref={box}>
      <button
        className="icon-btn"
        onClick={() => { setOpen((o) => !o); if (!open) load() }}
        aria-label={`Notifications${data.unread ? `, ${data.unread} unread` : ''}`}
        aria-expanded={open}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {data.unread > 0 && <span className="bell-count">{data.unread > 9 ? '9+' : data.unread}</span>}
      </button>
      {open && (
        <div className="bell-panel" role="menu">
          <div className="bell-head">
            <strong>Notifications</strong>
            {data.unread > 0 && <button className="link-btn" onClick={readAll}>Mark all read</button>}
          </div>
          {data.items.length === 0 && <div className="bell-empty muted">Nothing yet. Updates land here automatically.</div>}
          <ul className="bell-list">
            {data.items.slice(0, 20).map((n) => (
              <li key={n.id}>
                <button className={`bell-item ${n.read ? '' : 'unread'}`} onClick={() => openItem(n)} role="menuitem">
                  <span className={`bell-icon tone-${(ICON[n.type] || ['', 'muted'])[1]}`} aria-hidden="true">{(ICON[n.type] || ['•'])[0]}</span>
                  <span className="bell-text">
                    <span className="bell-title">{n.title}</span>
                    {n.message && <span className="bell-msg">{n.message}</span>}
                    <span className="bell-time">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
