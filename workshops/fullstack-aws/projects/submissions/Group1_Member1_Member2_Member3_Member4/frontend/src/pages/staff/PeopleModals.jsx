// HR modals: onboard one person, bulk import a roster, show temporary passwords, edit a person.
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Spinner from '../../components/Spinner'
import { Badge, ErrorBox, Field, Modal } from '../../components/ui'
import { api } from '../../lib/api'
import { parseCsv, rowsToRoster } from '../../lib/csv'

const SAMPLE = `name,email,track,start_date,cohort
Mia Brown,mia@example.com,Full Stack AWS,2026-10-05,Cloud Cohort A
Noah Davis,noah@example.com,Data Engineering,2026-10-05,Data Cohort B`

export function OnboardModal({ cohorts, defaultRole = 'TRAINEE', onClose, onDone }) {
  const [form, setForm] = useState({ name: '', email: '', role: defaultRole, track: '', phone: '', start_date: '', cohort_id: '' })
  const [error, setError] = useState(null)
  const [matches, setMatches] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (force = false) => {
    setBusy(true)
    setError(null)
    try {
      const body = { ...form, force }
      Object.keys(body).forEach((k) => { if (body[k] === '') delete body[k] })
      if (body.role !== 'TRAINEE') delete body.cohort_id
      const res = await api.post('/api/users', body)
      onDone(res)
    } catch (err) {
      if (err.data?.code === 'POSSIBLE_DUPLICATE') setMatches(err.data.matches)
      else setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={form.role === 'TRAINEE' ? 'Onboard a trainee' : 'Add a staff member'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy || !form.name || !form.email} onClick={() => submit(false)}>
            {busy ? <Spinner inline label="Saving" /> : 'Create account'}
          </button>
        </>
      }
    >
      <ErrorBox error={error} />
      {matches && (
        <div className="alert alert-warn">
          <div>
            <strong>Is this the same person?</strong> A trainee with this name already exists:
            <ul>{matches.map((m) => <li key={m.id}><Link to={`/trainees/${m.id}`} onClick={onClose}>{m.name}</Link> · {m.email} · {m.status.toLowerCase()}</li>)}</ul>
            Duplicates make tracking unreliable. Only continue if this is a different person.
          </div>
          <button className="btn btn-sm" onClick={() => submit(true)} disabled={busy}>Different person, create</button>
        </div>
      )}
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); submit(false) }}>
        <Field label="Full name"><input value={form.name} onChange={set('name')} required /></Field>
        <Field label="Email"><input type="email" value={form.email} onChange={set('email')} required /></Field>
        <Field label="Role">
          <select value={form.role} onChange={set('role')}>
            <option value="TRAINEE">Trainee</option>
            <option value="MANAGER">Training Manager</option>
            <option value="HR">HR</option>
          </select>
        </Field>
        <Field label="Track"><input value={form.track} onChange={set('track')} placeholder="e.g. Full Stack AWS" /></Field>
        <Field label="Phone (optional)"><input value={form.phone} onChange={set('phone')} /></Field>
        <Field label="Start date"><input type="date" value={form.start_date} onChange={set('start_date')} /></Field>
        {form.role === 'TRAINEE' && (
          <Field label="Cohort (optional)">
            <select value={form.cohort_id} onChange={set('cohort_id')}>
              <option value="">Not yet</option>
              {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

export function CredentialsModal({ people, onClose }) {
  const [copied, setCopied] = useState(false)
  const text = people.map((p) => `${p.name} <${p.email}>  temporary password: ${p.temporary_password}`).join('\n')
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true) } catch { setCopied(false) }
  }
  return (
    <Modal title={people.length === 1 ? 'Account ready' : `${people.length} accounts ready`} onClose={onClose}
      footer={<><button className="btn" onClick={copy}>{copied ? 'Copied' : 'Copy all'}</button><button className="btn btn-primary" onClick={onClose}>Done</button></>}>
      <p className="muted">Share each temporary password privately. It is shown only once, and the person must set a new one at first sign-in.</p>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Temporary password</th></tr></thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.email}><td>{p.name}</td><td>{p.email}</td><td><code className="secret">{p.temporary_password}</code></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}

const ROW_TONE = { NEW: 'NEW', EXISTS: 'EXISTS', DUPLICATE_IN_FILE: 'DUP', POSSIBLE_DUPLICATE: 'MAYBE', INVALID: 'INVALID' }
const ROW_LABEL = { NEW: 'New', EXISTS: 'Already exists', DUPLICATE_IN_FILE: 'Repeated in file', POSSIBLE_DUPLICATE: 'Possible duplicate', INVALID: 'Fix needed' }

export function ImportModal({ onClose, onDone }) {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState(null)
  const [includeMaybe, setIncludeMaybe] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const roster = useMemo(() => rowsToRoster(parseCsv(text)), [text])

  const onFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    f.text().then((t) => { setText(t); setPreview(null) })
  }

  const check = async () => {
    setBusy(true); setError(null)
    try { setPreview(await api.post('/api/users/import/preview', { rows: roster })) } catch (err) { setError(err) } finally { setBusy(false) }
  }

  const run = async () => {
    setBusy(true); setError(null)
    try { onDone(await api.post('/api/users/import', { rows: roster, include_possible_duplicates: includeMaybe })) } catch (err) { setError(err) } finally { setBusy(false) }
  }

  const willCreate = preview ? (preview.counts.NEW || 0) + (includeMaybe ? preview.counts.POSSIBLE_DUPLICATE || 0 : 0) : 0

  return (
    <Modal wide title="Bulk import trainees" onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          {!preview
            ? <button className="btn btn-primary" disabled={busy || roster.length === 0} onClick={check}>{busy ? <Spinner inline /> : `Check ${roster.length} row${roster.length === 1 ? '' : 's'}`}</button>
            : <button className="btn btn-primary" disabled={busy || willCreate === 0} onClick={run}>{busy ? <Spinner inline /> : `Create ${willCreate} account${willCreate === 1 ? '' : 's'}`}</button>}
        </>
      }>
      <ErrorBox error={error} />
      {!preview ? (
        <>
          <p className="muted">Paste rows from your spreadsheet (with the header row) or pick a .csv file. Columns: name, email, track, start_date (YYYY-MM-DD), cohort.</p>
          <div className="row-gap">
            <input type="file" accept=".csv,text/csv,text/plain" onChange={onFile} aria-label="CSV file" />
            <button className="btn btn-sm" type="button" onClick={() => setText(SAMPLE)}>Use sample</button>
          </div>
          <textarea className="mono" rows={9} value={text} onChange={(e) => { setText(e.target.value); setPreview(null) }}
            placeholder={SAMPLE} aria-label="Roster rows" />
          <p className="small muted">{roster.length} row{roster.length === 1 ? '' : 's'} found.</p>
        </>
      ) : (
        <>
          <div className="chips">
            {Object.entries(preview.counts).map(([k, v]) => <span key={k} className={`chip chip-static imp-${ROW_TONE[k]}`}>{ROW_LABEL[k]} <span className="chip-count">{v}</span></span>)}
          </div>
          {preview.counts.POSSIBLE_DUPLICATE > 0 && (
            <label className="check">
              <input type="checkbox" checked={includeMaybe} onChange={(e) => setIncludeMaybe(e.target.checked)} />
              Also create the possible duplicates (I checked they are different people)
            </label>
          )}
          <div className="table-wrap scroll-y">
            <table className="table">
              <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Cohort</th><th>Result</th></tr></thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.row} className={`imp-row imp-${ROW_TONE[r.status]}`}>
                    <td>{r.row}</td><td>{r.name || <span className="muted">—</span>}</td><td>{r.email}</td><td>{r.cohort || '—'}</td>
                    <td><strong>{ROW_LABEL[r.status]}</strong>{r.message && <div className="small">{r.message}</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-sm" onClick={() => setPreview(null)}>Back to edit</button>
        </>
      )}
    </Modal>
  )
}

export function EditUserModal({ person, onClose, onDone }) {
  const [form, setForm] = useState({ name: person.name, email: person.email, track: person.track || '', phone: person.phone || '', start_date: person.start_date || '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const save = async () => {
    setBusy(true); setError(null)
    try {
      const body = { ...form, start_date: form.start_date || null, track: form.track || null, phone: form.phone || null }
      onDone(await api.patch(`/api/users/${person.id}`, body))
    } catch (err) { setError(err) } finally { setBusy(false) }
  }
  return (
    <Modal title={`Edit ${person.name}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? <Spinner inline /> : 'Save'}</button></>}>
      <ErrorBox error={error} />
      <div className="form-grid">
        <Field label="Full name"><input value={form.name} onChange={set('name')} /></Field>
        <Field label="Email"><input type="email" value={form.email} onChange={set('email')} /></Field>
        <Field label="Track"><input value={form.track} onChange={set('track')} /></Field>
        <Field label="Phone"><input value={form.phone} onChange={set('phone')} /></Field>
        <Field label="Start date"><input type="date" value={form.start_date} onChange={set('start_date')} /></Field>
        <Field label="Role"><div className="static-field"><Badge value={person.role} /></div></Field>
      </div>
    </Modal>
  )
}
