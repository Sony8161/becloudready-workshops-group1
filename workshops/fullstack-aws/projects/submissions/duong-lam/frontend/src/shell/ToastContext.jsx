import { createContext, useCallback, useContext, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'

// TOASTS: the small "Deposited $50.00" messages in the corner that go away by themselves.
// Any component can call  const toast = useToast();  toast('Saved')  or  toast('Failed', 'bad').
const ToastContext = createContext(() => {})

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(1)

  const toast = useCallback((text, tone = 'good') => {
    const id = nextId.current++
    setToasts((list) => [...list.slice(-2), { id, text, tone }]) // at most 3 on screen
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4500)
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* aria-live: screen readers read each new toast out loud */}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            <Icon name={t.tone === 'bad' ? 'alert' : 'check'} size={18} strokeWidth={2.4} />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
