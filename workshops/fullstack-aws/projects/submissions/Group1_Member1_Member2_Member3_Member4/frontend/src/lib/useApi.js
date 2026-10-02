import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

// Loads a GET endpoint and keeps loading / error / data together. reload() fetches again.
export function useApi(path, { skip = false } = {}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(!skip)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (skip || !path) return
    let alive = true
    setLoading(true)
    setError(null)
    api.get(path)
      .then((d) => { if (alive) setData(d) })
      .catch((e) => { if (alive) setError(e) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [path, skip, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, loading, reload, setData }
}
