import { useEffect, useState } from 'react'
import { getPayee } from '../services/accountService.js'

// Names for account numbers ("Jane S."), looked up once per account and kept for the whole visit,
// so the same number is never asked for twice. null = no such account.
const cache = new Map()

export function lookupPayee(id) {
  if (!cache.has(id)) {
    cache.set(id, getPayee(id).then((p) => p.name).catch((err) => {
      cache.delete(id) // a network blip can be retried later
      if (err.response?.status === 404) {
        cache.set(id, Promise.resolve(null))
        return null
      }
      throw err
    }))
  }
  return cache.get(id)
}

// { 3: "Jane S.", 7: "Bob S." } for a list of account ids
export function usePayeeNames(ids) {
  const key = [...new Set(ids)].sort((a, b) => a - b).join(',')
  const [names, setNames] = useState({})
  useEffect(() => {
    if (!key) return
    let alive = true
    const list = key.split(',').map(Number)
    Promise.all(list.map((id) => lookupPayee(id).then((name) => [id, name]).catch(() => [id, null])))
      .then((pairs) => alive && setNames(Object.fromEntries(pairs.filter(([, name]) => name))))
    return () => {
      alive = false
    }
  }, [key])
  return names
}
