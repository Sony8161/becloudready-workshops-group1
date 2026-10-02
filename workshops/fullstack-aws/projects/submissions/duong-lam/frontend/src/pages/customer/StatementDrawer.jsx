import { useMemo, useState } from 'react'
import Drawer from '../../components/Drawer.jsx'
import Icon from '../../components/Icon.jsx'
import { downloadCsv, toCsv } from '../../utils/csv.js'
import { accountLabel, maskedAccount, money, monthKey, monthLabel, shortDate } from '../../utils/format.js'
import { describe, monthlyStatement, TYPE_LABEL } from '../../utils/transactions.js'

// Monthly statements: pick a month (and one account or all), see opening / closing balance and every move,
// then download it as CSV or print it (the browser's print dialog can "Save as PDF").
export default function StatementDrawer({ customer, accounts, txns, ownIds, names, onClose }) {
  // every month from the first transaction to now, newest first
  const months = useMemo(() => {
    const keys = []
    const now = new Date()
    const first = txns.length ? new Date(txns[txns.length - 1].timestamp) : now
    for (let d = new Date(now.getFullYear(), now.getMonth(), 1); d >= new Date(first.getFullYear(), first.getMonth(), 1); d.setMonth(d.getMonth() - 1)) {
      keys.push(monthKey(d.toISOString()))
    }
    return keys
  }, [txns])
  const [month, setMonth] = useState(months[0])
  const [accountId, setAccountId] = useState('all')

  const chosen = accountId === 'all' ? accounts : accounts.filter((a) => String(a.id) === accountId)
  const st = monthlyStatement(chosen, txns, month)
  const accountText = accountId === 'all' ? 'All accounts' : `${accountLabel(chosen[0])} ${maskedAccount(chosen[0].id)}`
  const title = `${monthLabel(month)} statement`

  function rowsForExport() {
    return st.lines.map(({ txn, change, balance }) => ({
      date: shortDate(txn.timestamp), ref: txn.id, type: TYPE_LABEL[txn.type],
      description: describe(txn, ownIds, names).text, amount: change.toFixed(2), balance: balance.toFixed(2),
    }))
  }

  function downloadStatement() {
    const columns = [
      { key: 'date', label: 'Date' }, { key: 'ref', label: 'Reference' }, { key: 'type', label: 'Type' },
      { key: 'description', label: 'Description' }, { key: 'amount', label: 'Amount' }, { key: 'balance', label: 'Balance' },
    ]
    downloadCsv(`statement-${month}${accountId === 'all' ? '' : `-${accountId}`}.csv`, toCsv(rowsForExport(), columns))
  }

  // A clean, printable page in a new window. The print dialog's "Save as PDF" turns it into a PDF.
  function printStatement() {
    const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
    const body = rowsForExport().map((r) => `<tr><td>${esc(r.date)}</td><td>${esc(r.description)}</td><td>${esc(r.type)}</td>`
      + `<td class="n">${esc(money(Number(r.amount)))}</td><td class="n">${esc(money(Number(r.balance)))}</td></tr>`).join('')
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      body{font-family:system-ui,sans-serif;color:#1f1720;margin:40px} h1{margin:0;color:#be123c} .muted{color:#6b5e66}
      table{width:100%;border-collapse:collapse;margin-top:18px;font-size:13px} th,td{text-align:left;padding:8px;border-bottom:1px solid #eee}
      .n{text-align:right} .sum td{font-weight:700} .box{display:flex;gap:28px;margin-top:18px} .box div{border:1px solid #eee;border-radius:10px;padding:10px 14px}
      </style></head><body>
      <h1>Simple Bank</h1><p class="muted">${esc(title)} · ${esc(customer?.name ?? '')} · ${esc(accountText)}</p>
      <div class="box"><div>Opening balance<br><b>${money(st.opening)}</b></div><div>Money in<br><b>${money(st.moneyIn)}</b></div>
      <div>Money out<br><b>${money(st.moneyOut)}</b></div><div>Closing balance<br><b>${money(st.closing)}</b></div></div>
      <table><thead><tr><th>Date</th><th>Description</th><th>Type</th><th class="n">Amount</th><th class="n">Balance</th></tr></thead>
      <tbody>${body || '<tr><td colspan="5" class="muted">No transactions this month.</td></tr>'}</tbody></table>
      <p class="muted" style="margin-top:24px;font-size:12px">Generated ${esc(new Date().toLocaleString('en-US'))}. A learning project, not a real bank.</p>
      </body></html>`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
  }

  return (
    <Drawer title="Statements" subtitle="Pick a month. Download it, or print it and choose Save as PDF." onClose={onClose}>
      <div className="field-row">
        <label className="field"><span>Month</span>
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </label>
        <label className="field"><span>Account</span>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="all">All accounts</option>
            {accounts.map((a) => <option key={a.id} value={String(a.id)}>{accountLabel(a)} {maskedAccount(a.id)}</option>)}
          </select>
        </label>
      </div>
      <dl className="rows statement-sum">
        <div><dt>Opening balance</dt><dd>{money(st.opening)}</dd></div>
        <div><dt>Money in</dt><dd className="good-text">+{money(st.moneyIn)}</dd></div>
        <div><dt>Money out</dt><dd>−{money(st.moneyOut)}</dd></div>
        <div><dt>Closing balance</dt><dd>{money(st.closing)}</dd></div>
      </dl>
      <div className="statement-lines">
        {st.lines.length === 0 && <div className="empty-box">No transactions in {monthLabel(month)}.</div>}
        {st.lines.map(({ txn, change, balance }) => (
          <div key={txn.id} className="kv-row">
            <span className="kv-text"><span>{describe(txn, ownIds, names).text}</span><small className="muted">{shortDate(txn.timestamp)}</small></span>
            <span className="stmt-amounts">
              <strong className={change > 0 ? 'good-text' : ''}>{change > 0 ? '+' : change < 0 ? '−' : ''}{money(Math.abs(change))}</strong>
              <small className="muted">{money(balance)}</small>
            </span>
          </div>
        ))}
      </div>
      <div className="two-buttons">
        <button type="button" className="btn btn-outline" onClick={downloadStatement}><Icon name="download" />Download CSV</button>
        <button type="button" className="btn btn-primary" onClick={printStatement}><Icon name="list" />Print / Save as PDF</button>
      </div>
    </Drawer>
  )
}
