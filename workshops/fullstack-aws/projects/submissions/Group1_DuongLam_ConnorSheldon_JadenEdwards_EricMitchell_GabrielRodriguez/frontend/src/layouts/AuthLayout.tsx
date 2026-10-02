import { Outlet } from 'react-router'

export function AuthLayout() {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Notice Board Tracker</h1>
          <p className="mt-1 text-sm text-gray-500">Trainee onboarding, plans & progress in one place</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
