# Simple Bank (FastAPI + MongoDB Atlas + React)

A small online bank: customers, accounts, deposits, withdrawals, transfers and an audit trail of every money movement,
with a full login system (JWT) and two roles: **admin** (bank staff) and **customer**.
Built with Python, FastAPI, Pydantic, MongoDB Atlas and React, using a layered (MVC-style) design.

Each role gets **one page with everything on it**: customers see balance, move money, accounts, activity, insights and
security at `/app`; staff get a command center with numbers, customers, a live transaction feed and the sign-in log at `/admin`.
Soft rose theme with light and dark mode, `Ctrl+K` search on both pages.

Convenience features on the customer page:
- **Name check before money moves:** typing an account number shows who owns it ("Jane S.").
- **New-payee warning (like Zelle):** the first payment to someone new needs an "I know this person" tick.
- **One-tap recipients and Send again:** people you've paid before are chips; any receipt can repeat a transfer.
- **Quick amounts** ($20 / $50 / $100 / All) with a live "balance after".
- **Nicknames and savings goals** per account, with a progress bar.
- **Alerts bell:** money received, large payments, bank-staff actions and sign-in events, with "New" since your last look.
- **Date ranges and monthly statements:** opening and closing balance, running balance, CSV or print / Save as PDF.
- **"Still there?" warning** 2 minutes before the session ends, with **Stay signed in**.
- Staff get **notes** on each customer and the same name check in the teller form.

```
React page -> Axios service (adds "Authorization: Bearer <token>")
           -> Controller (routes + role checks) -> Service (business rules) -> Repository (MongoDB) -> Atlas
```

## Live demo

**https://d2q7afhbbrmnob.cloudfront.net** (AWS: CloudFront + private S3 for the React site, API Gateway + Lambda for
the FastAPI backend, MongoDB Atlas for data). The first click after a quiet spell can take 2 to 3 seconds while AWS starts the API.

| Try it as | Username | Password |
|---|---|---|
| Customer with savings + checking | `john` | `john123` |
| Customer with checking | `jane` | `jane123` |
| Bank staff (command center) | ask the author: shared privately | |

No email is sent: "Forgot password" works, but the reset link goes to the server log, which only the owner can read.
Architecture and diagrams: [Architecture.md](Architecture.md). How it was deployed: [infra/CONSOLE.md](infra/CONSOLE.md). Last QA: [infra/QA.md](infra/QA.md).

## Run it (Windows / PowerShell)

Backend (terminal 1):

```powershell
cd backend
..\.venv\Scripts\python.exe -m pip install -r requirements.txt
..\.venv\Scripts\python.exe seed_demo.py        # optional: demo customers + logins (safe to run twice)
..\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

Frontend (terminal 2):

```powershell
cd frontend
npm install
npm run dev        # http://localhost:5173
```

`backend/.env` (not committed) must contain:

```
MONGODB_URI="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority"
JWT_SECRET="<long random string>"     # python -c "import secrets; print(secrets.token_hex(32))"
# optional: ADMIN_USERNAME, ADMIN_PASSWORD (default admin / admin123), JWT_MINUTES (60),
#           MAX_FAILED_LOGINS (5), LOCK_MINUTES (15), RESET_MINUTES (15),
#           FRONTEND_URL (http://localhost:5173, used in reset links), ALLOWED_ORIGINS (CORS)
```

Swagger UI: http://127.0.0.1:8000/docs (log in with `POST /api/auth/login`, copy `accessToken`, click **Authorize**).

## Run it in Docker

```powershell
docker compose up --build -d     # then open http://localhost:8080
docker compose down              # stop
```

## Deploy to AWS (Terraform)

- **Lab account: S3 + Lambda + API Gateway.** Guide: [infra/README.md](infra/README.md).
  One command: `powershell -ExecutionPolicy Bypass -File infra\deploy.ps1`
- **Same thing by hand in the AWS console, with CloudFront (HTTPS):** [infra/CONSOLE.md](infra/CONSOLE.md)
- **Own AWS account: Docker on EC2 + CloudFront** (HTTPS, ECR, SSM secrets, GitHub OIDC). Guide: [infra-ec2/README.md](infra-ec2/README.md)

## Logins and roles

| Login | Role | What they can do |
|---|---|---|
| `admin` / `admin123` | ADMIN | Everything: customers, accounts, teller deposits/withdrawals/transfers, audit log, sign-in log, unlock logins, temporary passwords |
| `demoadmin` / `admin123` (from `seed_demo.py`) | ADMIN | Same as admin. An easy staff login for demos, including on AWS where `admin` has a generated password |
| `john` / `john123`, `jane` / `jane123` (from `seed_demo.py`) | CUSTOMER | Only their own record, accounts and transactions; open accounts, deposit, withdraw, transfer, change password |

`seed_demo.py` also adds **Ann Lee**, a customer with no login yet, so staff can try "Turn on online banking".

### The login system

| Feature | How it works |
|---|---|
| Sign in / sign up | bcrypt password hashes; HS256-signed JWT that expires after `JWT_MINUTES` |
| Password rules | 6 to 72 characters, at least one letter and one number (checked in the browser AND the API) |
| Lockout | 5 wrong passwords in a row lock the login for 15 minutes (`429`) |
| Forgot username | emails the username to the address on file |
| Forgot password | emails a one-time link `/reset-password?token=...`, valid 15 minutes. Only a SHA-256 hash of the token is stored; asking again cancels older links |
| Same answer for everyone | forgot-username / forgot-password say the same thing whether or not the account exists, so they can't be used to find customers |
| Rate limit | 5 forgot requests and 10 reset attempts per 15 minutes per IP |
| Change password | needs the current password; signs out every other device |
| Sign out everywhere | every older token stops working (`token_version` in the JWT); this browser gets a fresh one |
| Stay signed in | 2 minutes before the token expires a warning offers a fresh token (`POST /api/auth/refresh`) |
| Staff tools | unlock a login, give a temporary password (shown once), turn on online banking for a customer |
| Sign-in log | every login, wrong password, lockout, reset and staff action goes to `security_events` |

**Demo email:** nothing is really sent. `backend/mailer.py` prints each email (with the reset link) in the uvicorn terminal.
To go live, replace the body of `send_email` with SMTP / SendGrid / Amazon SES.

`401` = not signed in, bad / expired token, or signed out everywhere. `403` = signed in, but not allowed.

## Endpoints

| Area | Method | Route | Who |
|---|---|---|---|
| Auth | POST | `/api/auth/login`, `/api/auth/register` | anyone |
| | POST | `/api/auth/forgot-username` `{"email"}`, `/api/auth/forgot-password` `{"usernameOrEmail"}` | anyone (rate limited) |
| | POST | `/api/auth/reset-password` `{"token", "newPassword"}` | anyone with a valid link |
| | GET | `/api/auth/me`, `/api/auth/me/events?limit=20` | any login |
| | PUT | `/api/auth/me/password` `{"currentPassword", "newPassword"}` (returns a new token) | any login |
| | POST | `/api/auth/refresh` (a fresh token while the current one is still valid) | any login |
| | POST | `/api/auth/me/sign-out-everywhere` (returns a new token) | any login |
| | GET, POST | `/api/auth/users` (list logins / turn on a login for a customer) | admin |
| | POST | `/api/auth/users/{id}/unlock`, `/api/auth/users/{id}/temporary-password` | admin |
| Admin | GET | `/api/admin/stats` (dashboard numbers, counted by MongoDB) | admin |
| | GET | `/api/admin/customers?query=&premium=&limit=25&skip=0` (+ `X-Total-Count` header) | admin |
| | GET, POST | `/api/admin/customers/{id}/notes` `{"text"}` (staff notes, newest first) | admin |
| Customers | GET, POST | `/api/customers` | admin |
| | GET | `/api/customers/search?name=jo`, `/api/customers/premium?threshold=1000` | admin |
| | GET | `/api/customers/{id}`, `/api/customers/{id}/accounts`, `/api/customers/{id}/transactions` | admin or that customer |
| | PUT, DELETE | `/api/customers/{id}` (delete also removes accounts and login) | admin |
| Accounts | POST | `/api/accounts` | admin, or a customer for themselves |
| | GET | `/api/accounts`, `/api/accounts/premium?threshold=1000` | admin |
| | GET | `/api/accounts/{id}`, `/api/accounts/{id}/transactions` | admin or the owner |
| | GET | `/api/accounts/{id}/payee` → `{"accountId", "name": "Jane S."}` (30 a minute per IP) | any login |
| | PATCH | `/api/accounts/{id}/settings` `{"nickname", "goal"}` (never touches the balance) | admin or the owner |
| | PUT, DELETE | `/api/accounts/{id}` (PUT can't change the balance) | admin |
| | POST | `/api/accounts/{id}/deposit`, `/api/accounts/{id}/withdraw` body `{"amount": 500}` | admin or the owner |
| Transfers | POST | `/api/transfers` body `{"fromAccountId": 1, "toAccountId": 2, "amount": 50}` | admin or the owner of the FROM account |
| Audit | GET | `/api/audit/transactions?limit=&skip=&type=&customerId=` (+ `X-Total-Count`), `/api/audit/transactions/{id}` | admin |
| | GET | `/api/audit/security-events?limit=&skip=&problems=true` (+ `X-Total-Count`) | admin |

Business rules: amounts must be more than $0, at most 2 decimal places and at most $1,000,000; no withdrawing or
transferring more than the balance; no transfer to the same account. Every deposit / withdrawal / transfer is recorded
in the audit trail (who did it, when, which accounts, how much). Audit records are never changed or deleted.
In the browser, amounts over $1,000 need `CONFIRM` typed in on the review step.

## Testing

- **Postman:** import `backend/Duong_Lam_Banking-app.postman_collection.json` and **Run collection** (83 requests, 151 assertions).
  Folder 0 logs in as admin and saves the token. Folder 5 checks the roles. Folder 6 tests the login system (forgot, reset,
  change password, sign out everywhere, lockout, unlock, temporary password). Folder 7 tests the name check, nicknames
  and goals, staff notes and refresh.
- **Browser:** 131 end-to-end checks (Playwright) on both one-page screens, light / dark / phone, plus 8 for the session
  warning, all passing (`frontend/test-results/`).
- **Demo:** `demo/Simple Bank Demo.mp4` walks through every feature with captions.

## Structure

```
backend/
  main.py                 app + routers, middleware (CORS, gzip, security headers), indexes, admin login on startup
  dependencies.py         creates and wires repositories and services (the composition root)
  db.py                   MongoDB connection, Decimal128 codec, auto-increment ids
  models.py               Pydantic models (requests/responses), password rule
  security.py             bcrypt password hashing, JWT create/decode, lockout + reset settings
  auth_guard.py           get_current_user, require_admin, ensure_owner (used with Depends)
  mailer.py               "sends" email (prints it in dev)
  rate_limit.py           per-IP limit for the forgot / reset routes
  *_controller.py         routes
  *_service.py            business rules (auth, accounts, audit, admin, stats)
  *_repository.py         MongoDB queries (users, customers, accounts, transactions, security events, password resets, staff notes)
  seed_demo.py            demo data
frontend/src/
  auth/                   AuthContext (who is signed in), ProtectedRoute, token storage
  shell/                  AppShell (top bar), Ctrl+K CommandPalette, toasts, the "Still there?" session warning
  theme/                  light / dark switch
  pages/customer/         CustomerHome + its cards (balance, accounts, activity, insights, security) and drawers (receipt, statements, alerts)
  pages/admin/            AdminHome + its cards (KPIs, customers, live feed, sign-in log, customer drawer)
  pages/                  public pages: welcome, sign in, sign up, forgot username / password, reset password
  components/             reusable pieces (MoveMoneyForm, Drawer, PasswordInput, PasswordStrength, Sparkline, Pager...)
  services/               Axios calls; api.js adds the token and handles 401
  utils/                  money, dates, transactions (alerts, statements), payee names, passwords, CSV
```
