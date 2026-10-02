import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import Spinner from '../../components/Spinner'
import { useToast } from '../../components/Toast'
import { Avatar, Badge, EmptyState, ErrorBox, PageHead } from '../../components/ui'
import { api, qs } from '../../lib/api'
import { fmtDate, timeAgo } from '../../lib/format'
import { useApi } from '../../lib/useApi'
import { CredentialsModal, EditUserModal, ImportModal, OnboardModal } from './PeopleModals'

export default function TraineesPage() {
  const { user } = useAuth()
  const isHr = user.role === 'HR'
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'TRAINEE'
  const [status, setStatus] = useState('ACTIVE')
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [modal, setModal] = useState(null)
  const [creds, setCreds] = useState(null)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q), 250)
    return () => clearTimeout(id)
  }, [q])

  const role = tab === 'STAFF' ? '' : 'TRAINEE'
  const list = useApi(tab === 'DUPLICATES' ? null : `/api/users${qs({ role, status, q: debounced })}`, { skip: tab === 'DUPLICATES' })
  const dups = useApi(isHr ? '/api/users/duplicates' : null, { skip: !isHr })
  const cohorts = useApi('/api/cohorts')

  const rows = (list.data || []).filter((p) => (tab === 'STAFF' ? p.role !== 'TRAINEE' : true))

  const act = async (person, action) => {
    const verbs = { deactivate: 'Deactivate', reactivate: 'Reactivate', 'reset-password': 'Reset the password for' }
    if (action !== 'reactivate' && !window.confirm(`${verbs[action]} ${person.name}?`)) return
    try {
      const res = await api.post(`/api/users/${person.id}/${action}`)
      if (action === 'reset-password') setCreds([{ ...res.user, temporary_password: res.temporary_password }])
      else toast(`${person.name} is now ${res.status.toLowerCase()}`)
      list.reload()
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  const setTab = (t) => setParams(t === 'TRAINEE' ? {} : { tab: t })

  return (
    <>
      <PageHead
        title="People"
        subtitle={isHr ? 'Onboard trainees once, keep one clean record per person.' : 'Everyone in the training program.'}
        actions={isHr && (
          <>
            <button className="btn" onClick={() => setModal({ type: 'import' })}>Bulk import</button>
            <button className="btn btn-primary" onClick={() => setModal({ type: 'onboard', role: tab === 'STAFF' ? 'MANAGER' : 'TRAINEE' })}>
              {tab === 'STAFF' ? 'Add staff' : 'Onboard trainee'}
            </button>
          </>
        )}
      />

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'TRAINEE'} className={`tab ${tab === 'TRAINEE' ? 'tab-on' : ''}`} onClick={() => setTab('TRAINEE')}>Trainees</button>
        <button role="tab" aria-selected={tab === 'STAFF'} className={`tab ${tab === 'STAFF' ? 'tab-on' : ''}`} onClick={() => setTab('STAFF')}>Staff</button>
        {isHr && (
          <button role="tab" aria-selected={tab === 'DUPLICATES'} className={`tab ${tab === 'DUPLICATES' ? 'tab-on' : ''}`} onClick={() => setTab('DUPLICATES')}>
            Possible duplicates {dups.data?.length ? <span className="chip-count warn">{dups.data.length}</span> : null}
          </button>
        )}
      </div>

      {tab === 'DUPLICATES' ? (
        <section className="card">
          {dups.loading && !dups.data ? <Spinner /> : dups.data?.length === 0 ? (
            <EmptyState title="No duplicates found">Every trainee name is unique.</EmptyState>
          ) : (
            <>
              <p className="muted">These trainees share a name. If two rows are the same person, deactivate the extra one.</p>
              {dups.data?.map((g) => (
                <div key={g.name} className="dup-group">
                  <strong>{g.name}</strong>
                  <ul>{g.people.map((p) => <li key={p.id}><Link to={`/trainees/${p.id}`}>{p.email}</Link> <Badge value={p.status} /></li>)}</ul>
                </div>
              ))}
            </>
          )}
        </section>
      ) : (
        <section className="card">
          <div className="toolbar">
            <input className="search" type="search" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" />
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="">All</option>
            </select>
            <span className="muted small">{rows.length} {rows.length === 1 ? 'person' : 'people'}</span>
          </div>
          <ErrorBox error={list.error} onRetry={list.reload} />
          {list.loading && !list.data ? <Spinner /> : rows.length === 0 ? (
            <EmptyState title="No one found" action={isHr && tab === 'TRAINEE' && <button className="btn btn-primary" onClick={() => setModal({ type: 'onboard', role: 'TRAINEE' })}>Onboard a trainee</button>}>
              Try another search or status.
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    {tab === 'TRAINEE' ? <><th>Track</th><th>Cohorts</th><th>Start date</th></> : <th>Role</th>}
                    <th>Status</th><th>Last sign-in</th>{isHr && <th className="num">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="person">
                          <Avatar name={p.name} />
                          <div>
                            {p.role === 'TRAINEE' ? <Link to={`/trainees/${p.id}`}>{p.name}</Link> : <strong>{p.name}</strong>}
                            <div className="small muted">{p.email}</div>
                          </div>
                        </div>
                      </td>
                      {tab === 'TRAINEE' ? (
                        <>
                          <td>{p.track || '—'}</td>
                          <td>{p.cohorts?.length ? p.cohorts.map((c) => <Link key={c.id} to={`/cohorts/${c.id}`} className="tag">{c.name}</Link>) : <span className="text-warn small">None</span>}</td>
                          <td>{fmtDate(p.start_date)}</td>
                        </>
                      ) : <td><Badge value={p.role} /></td>}
                      <td>
                        <Badge value={p.status} />
                        {p.must_change_password && <div className="small muted">Temp password</div>}
                      </td>
                      <td className="small">{p.last_login_at ? timeAgo(p.last_login_at) : <span className="muted">Never</span>}</td>
                      {isHr && (
                        <td className="num">
                          <div className="row-actions">
                            <button className="btn btn-sm" onClick={() => setModal({ type: 'edit', person: p })}>Edit</button>
                            {p.id !== user.id && <button className="btn btn-sm" onClick={() => act(p, 'reset-password')}>Reset password</button>}
                            {p.id !== user.id && (p.status === 'ACTIVE'
                              ? <button className="btn btn-sm btn-danger-ghost" onClick={() => act(p, 'deactivate')}>Deactivate</button>
                              : <button className="btn btn-sm" onClick={() => act(p, 'reactivate')}>Reactivate</button>)}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {modal?.type === 'onboard' && (
        <OnboardModal cohorts={cohorts.data || []} defaultRole={modal.role} onClose={() => setModal(null)}
          onDone={(res) => { setModal(null); setCreds([{ ...res.user, temporary_password: res.temporary_password }]); list.reload(); dups.reload() }} />
      )}
      {modal?.type === 'import' && (
        <ImportModal onClose={() => setModal(null)}
          onDone={(res) => {
            setModal(null)
            list.reload(); dups.reload()
            if (res.created.length) setCreds(res.created)
            toast(`${res.created.length} created, ${res.skipped.length} skipped`, res.created.length ? 'good' : 'warn')
          }} />
      )}
      {modal?.type === 'edit' && (
        <EditUserModal person={modal.person} onClose={() => setModal(null)}
          onDone={() => { setModal(null); toast('Saved'); list.reload(); dups.reload() }} />
      )}
      {creds && <CredentialsModal people={creds} onClose={() => setCreds(null)} />}
    </>
  )
}