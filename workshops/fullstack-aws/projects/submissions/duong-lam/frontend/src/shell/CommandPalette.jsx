import { useEffect, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'

// Does every word the person typed appear in the label (or keywords)?  "dep 50" matches "Deposit $50".
function matches(item, query) {
  const haystack = `${item.label} ${item.keywords ?? ''}`.toLowerCase()
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((word) => haystack.includes(word))
}

// The Ctrl+K box: type to find an action or a record, Enter to run it.
//   getItems(query)  returns the page's items for this text (a list, or a Promise of one)
//   builtIns         actions available on every page (dark mode, sign out)
export default function CommandPalette({ getItems, builtIns, placeholder, onClose }) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState([])
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const lastFocus = useRef(document.activeElement)

  // Work out the list every time the text changes. A short wait (debounce) means typing
  // "jane" makes ONE server search, not four.
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      let pageItems = []
      try {
        pageItems = (await getItems?.(query)) ?? []
      } catch {
        pageItems = [] // a failed search just shows the built-in actions
      }
      if (cancelled) return
      const list = [...pageItems, ...builtIns].filter((item) => item.alwaysShow || !query.trim() || matches(item, query))
      // "fallback" items (like "Search activity for ...") go last, so a real match is picked by Enter first
      list.sort((x, y) => Number(!!x.fallback) - Number(!!y.fallback))
      setItems(list.slice(0, 9))
      setActive(0)
    }, query ? 150 : 0)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, getItems, builtIns])

  // Focus the box when it opens; give focus back to whatever had it when it closes.
  useEffect(() => {
    inputRef.current?.focus()
    const previous = lastFocus.current
    return () => previous?.focus?.()
  }, [])

  function run(item) {
    onClose()
    item.run()
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') onClose()
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((i) => Math.min(i + 1, items.length - 1))
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    }
    if (event.key === 'Enter' && items[active]) {
      event.preventDefault()
      run(items[active])
    }
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search or jump to" onKeyDown={onKeyDown}>
        <div className="palette-input">
          <Icon name="search" />
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder}
            aria-label="Search or type a command" role="combobox" aria-expanded="true" aria-controls="palette-list"
            aria-activedescendant={items[active] ? `cmd-${items[active].id}` : undefined} />
          <kbd>Esc</kbd>
        </div>
        <ul className="palette-list" id="palette-list" role="listbox">
          {items.map((item, index) => (
            <li key={item.id} id={`cmd-${item.id}`} role="option" aria-selected={index === active}
              className={index === active ? 'active' : ''} onMouseEnter={() => setActive(index)}
              onMouseDown={(e) => { e.preventDefault(); run(item) }}>
              <Icon name={item.icon ?? 'chevron'} />
              <span className="palette-label">{item.label}</span>
              {item.hint && <span className="palette-hint">{item.hint}</span>}
            </li>
          ))}
          {items.length === 0 && <li className="palette-empty">No matches. Try “deposit 50” or “statement”.</li>}
        </ul>
        <div className="palette-foot"><kbd>↑</kbd><kbd>↓</kbd> to move · <kbd>Enter</kbd> to run</div>
      </div>
    </div>
  )
}
