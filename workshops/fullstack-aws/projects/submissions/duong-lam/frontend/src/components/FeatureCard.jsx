import { Link } from 'react-router-dom'

// One reusable component, three props. The Welcome page draws it twice with different props.
export default function FeatureCard({ to, title, text }) {
  return (
    <Link to={to} className="card">
      <h3>{title}</h3>
      <p>{text}</p>
    </Link>
  )
}
