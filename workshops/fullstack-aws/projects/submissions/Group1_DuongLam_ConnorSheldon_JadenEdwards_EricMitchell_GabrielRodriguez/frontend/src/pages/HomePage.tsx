import { useAuth } from '../hooks/useAuth'
import { ROLE_LABELS } from '../types/auth'

export function HomePage() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user.name}</h1>
      <p className="mt-1 text-gray-500">Signed in as {ROLE_LABELS[user.role]}.</p>
    </section>
  )
}
