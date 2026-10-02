# QA: the deployed app (S3 + CloudFront + Lambda + API Gateway)

Checked 2026-10-02 against https://d2q7afhbbrmnob.cloudfront.net and its API. Re-run any time:

```powershell
.\.venv\Scripts\python.exe infra\smoke_test.py
```

## Result

**40 / 40 automated checks pass** on the live site (first run: 29 pass, 8 warnings). The signed-in flows passed
**131 / 131 + 8 / 8 browser checks** on a local copy of the exact code that's deployed (same backend, same React build).
No errors in the Lambda log. Cold start about 2.3 s, then 2 to 500 ms per request, 108 MB of the 1024 MB used.
The database `banking_prod` has `admin`, `demoadmin`, `john`, `jane` and `testing123`.

| Area | Checked | Status |
|---|---|---|
| Site | `/` loads; refresh on `/app`, `/admin`, `/login`, `/reset-password` works; http goes to https | Pass |
| Build | JS served as JavaScript, CSS as CSS, API address baked in with `/api` | Pass |
| Caching | `index.html` no-cache, hashed assets cached for a year | Pass (fixed) |
| Security headers | Site: HSTS, nosniff, frame options, referrer policy. API: its own set + `no-store` | Pass (site fixed) |
| CORS | The site may call the API; another website may not | Pass |
| API | Health reaches MongoDB; no token = 401; unknown route = 404 | Pass |
| Lambda | x86_64, `lambda_handler.handler`, 29 s, 1024 MB, all settings present, no `ORIGIN_SECRET` | Pass |
| Limits | API throttling 25/s burst 50; at most 10 Lambda copies at once | Pass (fixed) |
| Storage | Bucket private (OAC only), all public access blocked | Pass |
| Logs | Kept 14 days | Pass (fixed) |

Business rules behind the API (money math, lockout, rate limits, roles) were tested on the same zip before upload:
21/21, plus the earlier 151 Postman assertions and 139 browser checks on the app itself.

## Fixed today (and how to redo them by hand)

| Fix | By hand |
|---|---|
| CloudFront default root object was `index.htm` | Distribution > General > Edit > `index.html` |
| Site had no security headers | Behaviors > Edit > Response headers policy: SecurityHeadersPolicy |
| `index.html` had no Cache-Control, so a redeploy could stay hidden for a day | `infra\console\redeploy_site.ps1` uploads with the right headers |
| API Gateway throttling was never set | API > Protect > Throttling: rate 25, burst 50 |
| Lambda could scale without limit | Lambda > Configuration > Concurrency > Reserve 10 |
| Lambda logs never expired | CloudWatch > Log groups > Edit retention > 2 weeks |
| Forgot-password pages told visitors to look in the "backend terminal" | `DevMailHint.jsx`: that text only in `npm run dev`; the live site explains the log |
| "Is the backend running on port 8000?" could show on the live site | `api.js`: dev-only; the live site says to try again |
| No browser-tab icon (the page itself came back as the icon) | `frontend/public/favicon.svg` + a link in `index.html` |
| No course tags, so the weekly cleanup could sweep the app once tagged | Tags `workshop=full-stack`, `date=02-Oct-2026`, `autodelete=false`, `owner=duong-lam` on the Lambda, API, bucket, CloudFront, WAF and log group |

## Signed-in checks on the live site (optional, about 10 minutes)

The same flows passed in the browser suite on a local copy of this code. Claude doesn't type passwords into live
websites, so a final pass on the real site is yours. Tick them on the CloudFront site:

- [ ] `john` / `john123`: home loads with two accounts and charts
- [ ] Deposit $20, then withdraw $20: balance back to the start, both in Activity
- [ ] Transfer to Jane (in Recent recipients): toast names "Jane S."
- [ ] Transfer to a new account number: name check appears, then "Do you know…?" must be ticked
- [ ] Over $1,000: the review asks you to type CONFIRM
- [ ] Statements: pick this month, Download CSV, Print / Save as PDF
- [ ] Refresh the page while signed in: still signed in
- [ ] Sign out, then press Back: you don't get the old page back
- [ ] `demoadmin` / `admin123`: command center shows the numbers, customers and live feed
- [ ] Open Jane in the customer drawer, add a staff note, deposit $1 as the teller
- [ ] Sign-in log shows your sign-ins with your real IP
- [ ] Forgot password for `jane`: the "email" appears in Lambda > Monitor > CloudWatch logs; the link opens the reset page
- [ ] Phone: open the site on your phone and sign in as `jane`
- [ ] Wrong password 5 times for `testing123`: locked; `demoadmin` can unlock it

## To add (ordered)

**Before sharing the link outside class**
1. After grading, delete `demoadmin` (Atlas > Browse Collections > `banking_prod.users`). Until then, give it to the
   trainer privately; the README only lists the customer logins.
2. Done: the Lambda uses its own Atlas user (`simplebank-lambda`), not your main one.
3. Rotate the Atlas password and `JWT_SECRET` after the course: the lab is shared, and anyone in it can read Lambda settings.

**Worth doing**
4. CloudWatch alarm on Lambda errors and API 5xx, emailing you (CloudWatch > Alarms > Create; SNS email topic).
5. API Gateway access logs (API > Monitor > Logging) so each request is recorded with status and IP.
6. Serve the API through the same CloudFront (behavior `/api/*` to API Gateway, CachingDisabled, AllViewerExceptHostHeader).
   One address for everything, no CORS needed, and the raw API Gateway URL can then be locked with `ORIGIN_SECRET`.
7. GitHub deploys: set repo variables `AWS_REGION`, `LAMBDA_FUNCTION`, `S3_BUCKET`, `VITE_API_URL`,
   `CLOUDFRONT_DISTRIBUTION_ID` (the workflow now invalidates CloudFront when that one is set) and secrets for the keys.

**Nice to have**
8. Real email for reset links (Amazon SES) instead of printing them to the log. The lab may block SES.
9. A custom domain with an ACM certificate on CloudFront.
10. WAF is on (CloudFront added it during setup). It blocks common attacks but bills per month per rule set;
    keep it if the lab pays, or turn it off in Security if cost matters.
11. The code-level items from the "Deep dive" tab: atomic balance updates, MongoDB transactions for transfers,
    idempotency keys, and a pytest suite in CI.
