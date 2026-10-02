import { useEffect, useState } from 'react'

// A thin bar across the top of the page while ANY request is in flight.
// api.js counts open requests and sends an "api:loading" event every time the count changes.
// It waits 150 ms before showing, so fast requests don't make the bar flicker.
export default function TopLoader() {
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let timer
    function onLoading(event) {
      clearTimeout(timer)
      if (event.detail > 0) timer = setTimeout(() => setBusy(true), 150)
      else setBusy(false)
    }
    window.addEventListener('api:loading', onLoading)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('api:loading', onLoading)
    }
  }, [])

  return <div className={`top-loader ${busy ? 'on' : ''}`} role="progressbar" aria-hidden={!busy} aria-label="Loading" />
}
