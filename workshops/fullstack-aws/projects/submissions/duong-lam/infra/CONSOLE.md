# Deploy by hand in the AWS console: S3 + CloudFront + Lambda + API Gateway

The same app as `deploy.ps1`, but every piece clicked together in the AWS web console, plus **CloudFront** so the
website is HTTPS and the bucket stays private. About 45 minutes the first time.

```
Browser --HTTPS--> CloudFront (https://dxxxx.cloudfront.net)
   |                  '--> private S3 bucket (index.html + assets/, the built React app)
   |
   '------HTTPS--> API Gateway HTTP API (https://<id>.execute-api.us-east-1.amazonaws.com)
                      route ANY /api/{proxy+}
                      '--> Lambda (FastAPI through Mangum) --> MongoDB Atlas
```

> **Pick one way.** This guide and `deploy.ps1` (Terraform) use the same names (`duonglam-simplebank-*`).
> Don't run both against the same account, or Terraform will fail with "already exists".

## What's already done in the code

| Piece | Where | What it does |
|---|---|---|
| Lambda entry point | `backend/lambda_handler.py` | Mangum turns API Gateway events into normal FastAPI requests |
| Health check | `GET /api/health` (`backend/main.py`) | `{"status":"ok","database":"ok"}` when Lambda can reach Atlas |
| Zip builder | `infra/build_lambda.py` | Our `.py` files + the **Linux** builds of bcrypt and pydantic, into `infra/build/lambda.zip` |
| Lambda test event | `infra/console/test-event-health.json` | Paste into the Lambda console's Test tab |
| Smoke test | `infra/smoke_test.py` | Read-only check of the live site, API and AWS settings (part 10) |
| Redeploy scripts | `infra/console/redeploy_api.ps1`, `redeploy_site.ps1` | One command per side after a code change |
| QA results | `infra/QA.md` | Last check, fixes, a signed-in checklist and what to add next |

Tested before handing over: the built zip, run with Python 3.12 on Linux and fed API Gateway events, passed 21/21
checks (health, CORS from a CloudFront address, login, deposit, lockout, rate limits, gzip, real client IP).

## Write these down as you go

| Value | Where it comes from | Used in |
|---|---|---|
| `MONGODB_URI` | Atlas (part 1) | Lambda settings |
| `JWT_SECRET` | You generate it (part 2) | Lambda settings |
| `ADMIN_PASSWORD` | You generate it (part 2) | Lambda settings, then signing in |
| API URL | API Gateway (part 4) | React build |
| Site URL | CloudFront (part 6) | Lambda settings |

---

## Part 1. MongoDB Atlas: let Lambda in

Lambda has no fixed IP address, so Atlas has to accept connections from anywhere. The password still protects it.

1. Atlas > **Network Access** > **Add IP Address** > **Allow access from anywhere** (`0.0.0.0/0`) > Confirm.
2. Atlas > **Database Access** > **Add New Database User**: username `simplebank-lambda`, a strong password,
   **Specific privileges** > `readWrite` on database `banking_prod`. (A separate user you can delete after the course.)
3. Copy the connection string (Connect > Drivers) and put that user's password in it. That's your `MONGODB_URI`.

## Part 2. Build the zip and make two secrets

From the project root in PowerShell:

```powershell
.\.venv\Scripts\python.exe infra\build_lambda.py
# -> Built ...\infra\build\lambda.zip (about 5 MB)

.\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_hex(32))"   # JWT_SECRET
.\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_hex(12))"   # ADMIN_PASSWORD
```

Don't zip the backend folder yourself. A zip made on Windows has Windows builds of bcrypt and pydantic, and Lambda
(Linux) can't load them.

## Part 3. Lambda: the API

AWS console (region **N. Virginia, us-east-1**, top right) > **Lambda** > **Create function**.

1. **Author from scratch**
   - Function name: `duonglam-simplebank-api`
   - Runtime: **Python 3.12**
   - Architecture: **x86_64** (the zip is built for x86_64; arm64 won't load bcrypt)
   - Permissions > Change default execution role > **Use an existing role**:
     `quicklabs-fullstack-aws-28sep-batch-a-lambda-exec` (the lab blocks creating roles)
   - **Create function**
2. **Code** tab > **Upload from** > **.zip file** > `infra\build\lambda.zip` > Save.
3. **Code** tab > **Runtime settings** > Edit > Handler: `lambda_handler.handler` > Save.
   (File `lambda_handler.py`, variable `handler`.)
4. **Configuration** > **General configuration** > Edit:
   - Memory: **1024 MB** (more memory also means more CPU, so bcrypt sign-ins are faster)
   - Timeout: **0 min 29 sec** (the 3-second default is too short for a cold start; API Gateway gives up at 30)
5. **Configuration** > **Environment variables** > Edit > add:

   | Key | Value |
   |---|---|
   | `MONGODB_URI` | from part 1 |
   | `MONGODB_DB` | `banking_prod` |
   | `JWT_SECRET` | from part 2 |
   | `ADMIN_USERNAME` | `admin` |
   | `ADMIN_PASSWORD` | from part 2 |
   | `ALLOWED_ORIGINS` | `http://localhost:5173` for now (part 8 changes it) |
   | `FRONTEND_URL` | `http://localhost:5173` for now (part 8 changes it) |

   Do **not** add `ORIGIN_SECRET`. That's for the EC2 version, where CloudFront also sits in front of the API;
   here it would make every API call answer 403.
6. **Test** tab > Create new event > name `health` > paste `infra/console/test-event-health.json` > **Test**.
   Expect `statusCode: 200` and `{"status":"ok","database":"ok"}`. A `503` means Atlas is blocking (part 1).
   The first run takes a few seconds (cold start, plus creating the admin login and the indexes).

## Part 4. API Gateway: a public HTTPS address

**API Gateway** > **Create API** > **HTTP API** > **Build**.

1. **Integrations** > Add integration > **Lambda** > `duonglam-simplebank-api` (us-east-1), version 2.0.
   API name: `duonglam-simplebank-http-api` > Next.
2. **Configure routes**: Method **ANY**, Resource path **`/api/{proxy+}`**, target the Lambda > Next.
3. **Stages**: keep **`$default`** with **Auto-deploy** on > Next > **Create**.
   (`$default` means no `/prod` in the URL, so paths match FastAPI's routes exactly.)
4. Copy the **Invoke URL**, e.g. `https://abc123.execute-api.us-east-1.amazonaws.com`.
   Open `<Invoke URL>/api/health` in a browser: `{"status":"ok","database":"ok"}`.
   Your **API URL** for the React build is `<Invoke URL>/api`.
5. **Protect** > **Throttling** > Edit default route throttling: burst **50**, rate **25** per second.
   (Slows down password guessing and runaway bills.)

Leave **CORS** in API Gateway **empty**. FastAPI already answers CORS; if API Gateway does it too, it answers
the browser's preflight itself and logins fail with confusing CORS errors.

The console adds the "API Gateway may call this Lambda" permission for you (Lambda > Configuration > Permissions >
Resource-based policy shows it).

## Part 5. S3: a private bucket for the website

**S3** > **Create bucket**:
- Name: `duonglam-simplebank-site` (names are global; if it's taken, add a number)
- Region: us-east-1
- **Block all public access: leave ON.** Only CloudFront will read it.
- Everything else default > **Create bucket**. Don't turn on "Static website hosting"; CloudFront replaces it.

## Part 6. CloudFront: HTTPS in front of the bucket

**CloudFront** > **Create distribution**. (If the console asks you to choose a pricing plan, pick the free or
pay-as-you-go option; a class demo is far below any paid tier.)

AWS redesigns this screen often. If yours is a step-by-step wizard instead of one long form, the same choices are
spread over its pages: an **S3 origin** with **private bucket access (OAC)**, **redirect HTTP to HTTPS**, **no WAF**.
If it offers to update the bucket policy for you, let it and skip step 8.

1. **Origin domain**: choose the bucket from the list: `duonglam-simplebank-site.s3.us-east-1.amazonaws.com`.
   Not the `s3-website` address. If it isn't in the list, part 5 wasn't finished: create the bucket first.
   Don't type the name by hand; a bucket that doesn't exist gives `<Code>NotFound</Code>` later.
2. **Origin access**: **Origin access control settings (recommended)** > Create new OAC > defaults > Create.
3. **Viewer protocol policy**: **Redirect HTTP to HTTPS**.
4. **Allowed HTTP methods**: GET, HEAD. **Cache policy**: CachingOptimized.
5. **Web Application Firewall**: Do not enable (it costs extra and the lab may block it).
6. **Default root object**: `index.html` (exactly; `index.htm` silently falls back to the error page).
7. **Price class**: Use only North America and Europe.
8. **Create distribution**. A yellow banner says the bucket policy needs updating: **Copy policy** >
   open the bucket > **Permissions** > **Bucket policy** > Edit > paste > Save.
   (It lets this one distribution, and nobody else, read the files.)
9. Back in the distribution > **Error pages** > **Create custom error response**, twice:

   | HTTP error code | Customize response | Response page path | HTTP response code |
   |---|---|---|---|
   | 403 | Yes | `/index.html` | 200 |
   | 404 | Yes | `/index.html` | 200 |

   Why: `/app`, `/admin` and `/reset-password?token=...` aren't files in the bucket. S3 says 403, CloudFront hands back
   `index.html`, and React Router shows the right page. Without this, refreshing any page except `/` breaks.
10. Wait for **Last modified** to change from "Deploying" to a date (about 5 minutes). Copy the
    **Distribution domain name**: your **Site URL** is `https://dxxxx.cloudfront.net`.

## Part 7. Build React and upload it

```powershell
cd frontend
$env:VITE_API_URL = "https://abc123.execute-api.us-east-1.amazonaws.com/api"   # your API URL from part 4
npm run build
Remove-Item Env:VITE_API_URL
```

It must end in **`/api`**. Without it every call goes to `/auth/login` instead of `/api/auth/login` and API Gateway
answers Not Found. `VITE_API_URL` is baked into the JavaScript at build time, so build again whenever it changes.

S3 > `duonglam-simplebank-site` > **Upload** > drag in **what's inside** `frontend\dist` (`index.html` and the `assets`
folder), not the `dist` folder itself > **Upload**.

## Part 8. Point the API at the site

Lambda > `duonglam-simplebank-api` > Configuration > Environment variables > Edit:

| Key | Value |
|---|---|
| `ALLOWED_ORIGINS` | `https://dxxxx.cloudfront.net` (exactly, with `https://` and **no** slash at the end) |
| `FRONTEND_URL` | `https://dxxxx.cloudfront.net` |

Save. The next request uses the new values.

## Part 9. Try it

1. Open `https://dxxxx.cloudfront.net` and sign in as `admin` with your `ADMIN_PASSWORD`.
2. Go to `/app` or `/admin` and press F5: the page should reload, not show an XML error.
3. Forgot password: the "email" is printed in the Lambda's log. Lambda > **Monitor** > **View CloudWatch logs** >
   newest stream, and copy the reset link from there.
4. Demo logins for the new `banking_prod` database: customers `john` / `john123` and `jane` / `jane123`, plus staff
   `demoadmin` / `admin123` (delete it once the demos are over):
   ```powershell
   cd backend
   $env:MONGODB_DB = "banking_prod"; ..\.venv\Scripts\python.exe seed_demo.py; Remove-Item Env:MONGODB_DB
   ```

## Part 10. Finishing touches (5 minutes)

| Where | Setting | Why |
|---|---|---|
| CloudFront > distribution > **Behaviors** > Edit the default one | Response headers policy: **SecurityHeadersPolicy** (managed) | Adds HSTS, `X-Content-Type-Options`, `X-Frame-Options` and `Referrer-Policy` to the site |
| Lambda > **Configuration** > **Concurrency** > Edit | Reserve concurrency: **10** | At most 10 copies at once, so a traffic spike can't open hundreds of MongoDB connections (the free Atlas tier allows 500) or run up a bill |
| CloudWatch > **Log groups** > `/aws/lambda/duonglam-simplebank-api` > Actions > Edit retention | **2 weeks** | Logs (including the printed reset links) don't pile up forever |
| Each resource > **Tags** (Lambda, API, bucket, CloudFront, log group) | `workshop=full-stack`, `date=<today, dd-Mon-yyyy>`, `autodelete=false`, `owner=<you>` | The course's tagging rule. `autodelete=false` stops the weekly cleanup from deleting your app |

Then check everything at once. It never signs in or changes data:

```powershell
.\.venv\Scripts\python.exe infra\smoke_test.py
```

It tests the live site and API (pages, refresh on `/app`, HTTPS redirect, the baked API address, CORS, 401s,
headers) and the AWS settings from this guide. Fix anything marked FAIL; WARN lines are worth fixing too.

## Redeploying after a change

Two scripts do it, finding the API address and the distribution by name (so `/api` can't be forgotten):

| Changed | Run |
|---|---|
| Backend code | `powershell -ExecutionPolicy Bypass -File infra\console\redeploy_api.ps1` (build zip, upload, health check) |
| Frontend code | `powershell -ExecutionPolicy Bypass -File infra\console\redeploy_site.ps1` (build with `<API>/api`, upload with cache headers, invalidate) |
| A setting (secret, origin) | Lambda > Configuration > Environment variables |

By hand instead: `build_lambda.py` + Lambda > Code > Upload from .zip; or part 7 again + CloudFront > Invalidations >
`/*` (CloudFront keeps a file for up to a day, so without the invalidation visitors see the old version).

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `/api/health` says 503, or the Lambda times out | Atlas is blocking Lambda: part 1, step 1. Then check the log. |
| `Runtime.ImportModuleError: No module named 'lambda_handler'` | Handler setting wrong (part 3, step 3), or a hand-made zip. Use `build_lambda.py`. |
| `invalid ELF header` or `No module named 'pydantic_core._pydantic_core'` | Architecture is arm64, or the zip was built for Windows. x86_64 + `build_lambda.py`. |
| `Task timed out after 3.00 seconds` | Timeout still at the default: part 3, step 4. |
| Site shows `<Code>NotFound</Code>` "The resource you requested does not exist" | CloudFront's origin points at a bucket that doesn't exist. Create a bucket with exactly that name (part 5), or edit the origin to your real bucket. |
| Sign-in says "Request failed with status 404" | The site was built without `/api` at the end of `VITE_API_URL` (part 7). |
| Site shows `AccessDenied` XML | Bucket policy not pasted (part 6, step 8), or you uploaded the `dist` folder instead of its contents. |
| Refreshing `/app` shows an error | Error pages missing (part 6, step 9). |
| Browser console: CORS error | `ALLOWED_ORIGINS` doesn't match the site exactly (https, no trailing slash), CORS was set in API Gateway, or the site was built with an old API URL. |
| Every API call answers `403 {"detail":"Forbidden"}` | `ORIGIN_SECRET` is set on the Lambda. Remove it. |
| Old version still showing | Create an invalidation `/*`. |
| Some requests fail with 429 or 503 "Rate exceeded" under load | The concurrency cap (part 10) or API throttling (part 4) is doing its job. Raise it only if real traffic needs it. |
| `iam:PassRole` AccessDenied when creating the function | Wrong role for your batch. See `infra/README.md` troubleshooting. |
| AccessDenied when creating the distribution | The lab blocks CloudFront. Use the S3 website version instead: `infra/README.md`. |

## Turning it all off

CloudFront distribution: **Disable**, wait, then **Delete** > S3: **Empty** the bucket, then **Delete** >
API Gateway: delete the API > Lambda: delete the function > CloudWatch: delete log group
`/aws/lambda/duonglam-simplebank-api` > Atlas: delete the `simplebank-lambda` user.

## Good to know (for the demo)

- **Why HTTP API and not REST API:** cheaper, faster, and the `$default` stage has no `/prod` prefix, so FastAPI's
  paths work unchanged. One catch-all route; FastAPI does the real routing.
- **Why one Lambda for the whole API:** Mangum lets the unchanged FastAPI app run there. Less to manage than one
  function per endpoint, and the same code still runs locally with uvicorn.
- **Cold starts:** after a quiet spell, the first request takes a few seconds while AWS starts a copy and connects to
  Atlas. Later requests reuse that copy and its database connection.
- **Secrets as environment variables:** the lab blocks Secrets Manager and SSM. Lambda encrypts environment variables
  at rest, but anyone in the shared account who can open the function can read them. Rotate the Atlas password after
  the course.
- **Rate limits live in each Lambda copy's memory,** so under heavy load each copy counts separately. API Gateway
  throttling (part 4, step 5) is the account-wide limit.
