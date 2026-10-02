import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="empty not-found">
      <h2>Page not found.</h2>
      <p>The page you're looking for doesn't exist.</p>
      <Link className="btn btn-primary" to="/">Back to home</Link>
    </div>
  )
}
