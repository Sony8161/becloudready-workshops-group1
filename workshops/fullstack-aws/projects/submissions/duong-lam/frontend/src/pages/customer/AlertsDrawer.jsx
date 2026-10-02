import Drawer from '../../components/Drawer.jsx'
import Icon from '../../components/Icon.jsx'
import { whenText } from '../../utils/format.js'

// The customer's alerts: money received, large payments, bank-staff actions, and security events.
// "New" = newer than the last time they opened this drawer on this device.
export default function AlertsDrawer({ alerts, seenAt, onOpenTxn, onSecurity, onClose }) {
  return (
    <Drawer title="Alerts" subtitle="Money in, large payments and anything that touched your login." onClose={onClose}>
      {alerts.length === 0 && <div className="empty-box">No alerts yet.</div>}
      <ul className="alert-list">
        {alerts.map((a) => {
          const isNew = new Date(a.at).getTime() > seenAt
          return (
            <li key={a.id}>
              <button type="button" className={`alert-item tone-${a.tone}`} onClick={() => (a.txn ? onOpenTxn(a.txn) : onSecurity())}>
                <span className="alert-icon"><Icon name={a.icon} size={18} /></span>
                <span className="alert-text">
                  <strong>{a.title}{isNew && <span className="badge badge-info tiny">New</span>}</strong>
                  <small>{a.detail} · {whenText(a.at)}</small>
                </span>
                <Icon name="chevron" size={16} />
              </button>
            </li>
          )
        })}
      </ul>
    </Drawer>
  )
}
