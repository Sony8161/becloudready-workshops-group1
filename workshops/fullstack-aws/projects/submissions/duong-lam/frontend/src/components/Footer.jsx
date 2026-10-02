// A component is just a function that returns what to draw (JSX).
export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="footer">
      <p>© {year} Simple Bank · React + FastAPI + MongoDB Atlas · A learning project, not a real bank</p>
    </footer>
  )
}
