import Icon from './Icon.jsx'

// This project has no real email server: backend/mailer.py PRINTS each email instead of sending it.
// On your PC that's the terminal running uvicorn; on AWS it's the Lambda's log in CloudWatch.
// A real bank would plug in an email service (SendGrid, Amazon SES...) there.
// import.meta.env.DEV is true under `npm run dev` and false in the built site.
export default function DevMailHint() {
  return (
    <p className="dev-hint">
      <Icon name="mail" size={16} />
      {import.meta.env.DEV ? (
        <span><strong>Demo:</strong> no email is really sent. Look in the <strong>backend terminal</strong> (where uvicorn runs) for a box marked EMAIL.</span>
      ) : (
        <span><strong>Demo:</strong> no email is really sent. On this live demo the message goes to the server log, which only the site's owner can read.</span>
      )}
    </p>
  )
}
