import Icon from './Icon.jsx'

// Online banking status for a customer row: their username, Locked, or No login.
export default function LoginBadge({ login }) {
  if (!login) return <span className="badge badge-off">No login</span>
  if (login.locked) return <span className="badge badge-bad"><Icon name="lock" size={12} /> Locked</span>
  return <span className="badge badge-good">{login.username}</span>
}
