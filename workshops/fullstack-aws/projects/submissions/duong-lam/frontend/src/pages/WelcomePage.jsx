import { Link } from 'react-router-dom'
import FeatureCard from '../components/FeatureCard.jsx'
import Icon from '../components/Icon.jsx'

// The public home page (what a visitor sees before signing in).
export default function WelcomePage() {
  return (
    <section className="welcome">
      <div className="hero">
        <div className="hero-text">
          <span className="eyebrow">Online banking</span>
          <h1>Banking that keeps it simple.</h1>
          <p>
            Check balances, move money between accounts and see every transaction, all in one
            place. Built with React, FastAPI and MongoDB Atlas.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary btn-lg" to="/register">Open an account</Link>
            <Link className="btn btn-outline btn-lg" to="/login">Sign in</Link>
          </div>
          <p className="hero-note"><Icon name="lock" size={14} /> Secured with JSON Web Tokens and hashed passwords</p>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="bank-card">
            <div className="bank-card-top">
              <span>Simple Bank</span>
              <span className="chip" />
            </div>
            <span className="bank-card-number">•••• •••• •••• 0001</span>
            <div className="bank-card-bottom">
              <span>JOHN DOE</span>
              <span>DEBIT</span>
            </div>
          </div>
          <div className="mini-balance">
            <small>Total balance</small>
            <strong>$6,040.00</strong>
            <span className="amt-in">+ $150.00 today</span>
          </div>
        </div>
      </div>

      <div className="cards">
        {/* the same component, reused with different props */}
        <FeatureCard to="/register" title="Checking & savings" text="Open a new account in seconds and see your balance straight away." />
        <FeatureCard to="/login" title="Instant transfers" text="Move money between your accounts, or send it to another customer." />
        <FeatureCard to="/login" title="Every move recorded" text="Deposits, withdrawals and transfers land in an audit trail you can trace." />
      </div>
    </section>
  )
}
