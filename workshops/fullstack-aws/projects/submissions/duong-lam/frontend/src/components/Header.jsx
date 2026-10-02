import { Link, NavLink } from 'react-router-dom'
import Logo from './Logo.jsx'
import ThemeToggle from '../theme/ThemeToggle.jsx'
import { homeFor, useAuth } from '../auth/AuthContext.jsx'

// Header for the PUBLIC pages (home, sign in, open an account).
// Signed-in screens use the sidebar in layouts/AppLayout.jsx instead.
export default function Header({ title }) {
  const { user } = useAuth()
  return (
    <header className="header">
      <Logo />
      <nav className="nav" aria-label={title}>
        <ThemeToggle compact />
        <NavLink to="/" end>Home</NavLink>
        {user ? (
          <Link className="btn btn-primary" to={homeFor(user)}>Go to dashboard</Link>
        ) : (
          <>
            <NavLink to="/login">Sign in</NavLink>
            <Link className="btn btn-primary" to="/register">Open an account</Link>
          </>
        )}
      </nav>
    </header>
  )
}
