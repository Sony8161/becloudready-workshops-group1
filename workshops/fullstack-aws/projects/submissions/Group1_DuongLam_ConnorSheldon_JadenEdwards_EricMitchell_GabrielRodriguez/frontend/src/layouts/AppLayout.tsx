import { NavLink, Outlet, useNavigate } from 'react-router'
import { navItemsForRole } from '../config/navigation'
import { useAuth } from '../hooks/useAuth'
import { ROLE_LABELS } from '../types/auth'

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
        <span className="font-semibold tracking-tight">Notice Board Tracker</span>
        <div className="flex items-center gap-4">
          <div className="text-right leading-tight">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-gray-500">{ROLE_LABELS[user.role]}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Log out
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        <nav className="w-56 shrink-0 border-r border-gray-200 bg-white p-3">
          <ul className="space-y-1">
            {navItemsForRole(user.role).map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end
                  className={({ isActive }) =>
                    `block rounded-md px-3 py-2 text-sm ${
                      isActive ? 'bg-brand-50 font-medium text-brand-700' : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
