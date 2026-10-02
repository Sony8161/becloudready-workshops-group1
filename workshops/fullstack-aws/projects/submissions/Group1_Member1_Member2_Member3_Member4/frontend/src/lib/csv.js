// CSV in and out: export the dashboard (the old Excel sheet) and read pasted/uploaded rosters.

function cell(v) {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function downloadCsv(filename, columns, rows) {
  const lines = [columns.map((c) => cell(c.label)).join(',')]
  rows.forEach((r) => lines.push(columns.map((c) => cell(c.value(r))).join(',')))
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// Parses CSV text (quoted fields supported). Tabs work too, so a paste from Excel is fine.
export function parseCsv(text) {
  const sep = text.includes('\t') && !text.split('\n')[0].includes(',') ? '\t' : ','
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === sep) { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
    } else field += ch
  }
  row.push(field)
  if (row.some((c) => c.trim() !== '')) rows.push(row)
  return rows
}

const HEADER_ALIASES = {
  name: ['name', 'full name', 'trainee', 'trainee name'],
  email: ['email', 'e-mail', 'email address'],
  track: ['track', 'program', 'course'],
  phone: ['phone', 'mobile', 'phone number'],
  start_date: ['start_date', 'start date', 'start', 'joined'],
  cohort: ['cohort', 'group', 'batch'],
}

// Turns parsed rows into objects. The first row must be a header row.
export function rowsToRoster(rows) {
  if (rows.length < 2) return []
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const index = {}
  Object.entries(HEADER_ALIASES).forEach(([key, names]) => {
    const i = header.findIndex((h) => names.includes(h))
    if (i >= 0) index[key] = i
  })
  return rows.slice(1).map((r) => {
    const o = {}
    Object.entries(index).forEach(([key, i]) => { o[key] = (r[i] || '').trim() })
    return o
  })
}
