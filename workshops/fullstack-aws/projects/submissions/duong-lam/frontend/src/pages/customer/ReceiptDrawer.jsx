import Drawer from '../../components/Drawer.jsx'
import Icon from '../../components/Icon.jsx'
import { maskedAccount, money, shortDate, shortTime } from '../../utils/format.js'
import { byStaff, describe, TYPE_LABEL } from '../../utils/transactions.js'

// One transaction's details, in a side drawer, with "download receipt" and (for transfers you made) "send again".
export default function ReceiptDrawer({ txn, ownIds, username, names = {}, onClose, onRepeat }) {
  const d = describe(txn, ownIds, names)
  const label = (id) => (names[id] && !ownIds.has(id) ? `${names[id]} ${maskedAccount(id)}` : maskedAccount(id))
  const canRepeat = txn.type === 'TRANSFER' && ownIds.has(txn.fromAccountId)
  const who = byStaff(txn, ownIds, username) ? 'Bank staff (teller)' : txn.performedBy === username ? 'You, online' : txn.performedBy ?? 'Unknown'
  const rows = [
    ['Reference', `#${String(txn.id).padStart(6, '0')}`],
    ['Type', TYPE_LABEL[txn.type]],
    ...(txn.fromAccountId ? [['From', label(txn.fromAccountId)]] : []),
    ...(txn.toAccountId ? [['To', label(txn.toAccountId)]] : []),
    ['Date', shortDate(txn.timestamp)],
    ['Time', shortTime(txn.timestamp)],
    ['Done by', who],
    ['Status', 'Completed'],
  ]

  // A receipt is just text: build it, then let the browser save it as a file.
  function download() {
    const text = ['SIMPLE BANK RECEIPT', '', `${d.text}`, `Amount: ${money(txn.amount)}`, ...rows.map(([k, v]) => `${k}: ${v}`)].join('\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `receipt-${txn.id}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Drawer title="Receipt" onClose={onClose}>
      <div className="receipt-top">
        <span className="receipt-check"><Icon name="check" size={26} strokeWidth={2.4} /></span>
        <span className="muted">{d.text}</span>
        <strong className="receipt-amount">{d.direction > 0 ? '+' : d.direction < 0 ? '−' : ''}{money(txn.amount)}</strong>
      </div>
      <dl className="rows dashed">
        {rows.map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
      <div className="two-buttons">
        <button type="button" className="btn btn-outline" onClick={download}><Icon name="download" />Download receipt</button>
        {canRepeat && (
          <button type="button" className="btn btn-primary" onClick={() => onRepeat(txn)}><Icon name="refresh" />Send again</button>
        )}
      </div>
    </Drawer>
  )
}
