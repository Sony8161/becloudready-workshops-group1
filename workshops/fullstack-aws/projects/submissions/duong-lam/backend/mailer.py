"""Sending email. For now it PRINTS the email in the backend terminal (development mode),
so "forgot username" and "forgot password" can be demoed without an email service.
To go live, replace the body of send_email with SMTP, SendGrid or Amazon SES: nothing else changes."""
import os

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


def send_email(to: str, subject: str, body: str) -> None:
    line = "=" * 64
    print(f"\n{line}\nEMAIL (dev mode, not really sent)\nTo: {to}\nSubject: {subject}\n\n{body}\n{line}\n", flush=True)
