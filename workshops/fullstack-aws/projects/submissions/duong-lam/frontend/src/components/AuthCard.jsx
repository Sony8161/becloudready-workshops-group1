// The two-part card used by every signed-out page: a plum side with a short explanation,
// and the form on the right (stacked on a phone).
export default function AuthCard({ sideTitle, sideText, sideExtra, children }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-side">
          <h2>{sideTitle}</h2>
          <p>{sideText}</p>
          {sideExtra}
        </div>
        <div className="auth-form">{children}</div>
      </div>
    </div>
  )
}
