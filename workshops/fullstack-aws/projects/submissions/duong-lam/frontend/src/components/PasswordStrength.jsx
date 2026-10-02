import { passwordStrength } from '../utils/password.js'
import Icon from './Icon.jsx'

// A 4-part bar + the rules, ticked off live as you type.
export default function PasswordStrength({ password }) {
  const { score, label } = passwordStrength(password)
  const rules = [
    { ok: password.length >= 6, text: '6+ characters' },
    { ok: /[A-Za-z]/.test(password), text: 'a letter' },
    { ok: /\d/.test(password), text: 'a number' },
  ]
  return (
    <div className="strength" aria-live="polite">
      <div className={`strength-bar s${score}`} aria-hidden="true"><span /><span /><span /><span /></div>
      <div className="strength-row">
        <ul className="strength-rules">
          {rules.map((r) => (
            <li key={r.text} className={r.ok ? 'ok' : ''}>
              <Icon name={r.ok ? 'check' : 'x'} size={12} strokeWidth={3} /> {r.text}
            </li>
          ))}
        </ul>
        {label && <span className="strength-label">{label}</span>}
      </div>
    </div>
  )
}
