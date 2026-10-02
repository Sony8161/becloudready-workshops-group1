import { Link } from 'react-router'

interface StatusPageProps {
  code: string
  title: string
  message: string
}

function StatusPage({ code, title, message }: StatusPageProps) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold text-brand-600">{code}</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-gray-500">{message}</p>
      <Link to="/" className="mt-6 text-sm font-medium text-brand-600 hover:text-brand-700">
        Go home
      </Link>
    </div>
  )
}

export function NotFoundPage() {
  return <StatusPage code="404" title="Page not found" message="The page you're looking for doesn't exist." />
}

export function UnauthorizedPage() {
  return <StatusPage code="403" title="Access denied" message="You don't have permission to view this page." />
}
