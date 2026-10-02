// Export the audit log to a CSV file that opens in Excel.

// Turn a list of objects into CSV text.
//   columns = [{ key: 'id', label: 'ID' }, { key: 'amount', label: 'Amount' }, ...]
//   result  = "ID,Amount\n1,500\n2,25.5"
export function toCsv(rows, columns) {
  const header = columns.map((c) => cell(c.label)).join(',')
  const lines = rows.map((row) => columns.map((c) => cell(row[c.key])).join(','))
  return [header, ...lines].join('\n')
}

// One CSV cell. A value with a comma, quote or new line must be wrapped in quotes,
// and any quote inside it doubled: He said "hi"  ->  "He said ""hi"""
function cell(value) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

// Give the browser a file to save, without any server involved.
export function downloadCsv(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
