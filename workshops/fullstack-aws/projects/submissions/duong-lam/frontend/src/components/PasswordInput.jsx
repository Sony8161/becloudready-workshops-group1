import { useId, useState } from 'react'
import Icon from './Icon.jsx'

// A password box with two helpers people expect from a bank:
//   - an eye button to show what you typed (fewer typos)
//   - a "Caps Lock is on" warning (the #1 reason for "wrong password")
export default function PasswordInput({ label = 'Password', value, onChange, autoComplete = 'current-password', name, autoFocus, children }) {
  const id = useId()
  const [show, setShow] = useState(false)
  const [capsLock, setCapsLock] = useState(false)

  // getModifierState tells us if Caps Lock is on, on every key press
  function checkCaps(event) {
    setCapsLock(event.getModifierState?.('CapsLock') ?? false)
  }

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-pw">
        <input id={id} name={name} type={show ? 'text' : 'password'} value={value} onChange={onChange}
          autoComplete={autoComplete} autoFocus={autoFocus} onKeyDown={checkCaps} onKeyUp={checkCaps}
          onBlur={() => setCapsLock(false)} spellCheck="false" />
        <button type="button" className="pw-toggle" onClick={() => setShow(!show)}
          aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} title={show ? 'Hide' : 'Show'}>
          <Icon name={show ? 'eyeOff' : 'eye'} />
        </button>
      </div>
      {capsLock && <small className="caps-warn"><Icon name="alert" size={14} /> Caps Lock is on</small>}
      {children}
    </div>
  )
}
