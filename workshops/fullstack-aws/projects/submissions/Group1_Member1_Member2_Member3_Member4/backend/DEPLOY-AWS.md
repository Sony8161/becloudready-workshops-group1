# Deploy to AWS (console, Version 1)

Same path as `ASSIGNMENT-Version1-DeployWith_AwsGui.md`, adapted to this app: one Lambda runs the whole FastAPI API.

```
Browser -> S3 static website (React) -> API Gateway HTTP API -> Lambda (FastAPI) -> MongoDB Atlas
```

## 1. MongoDB Atlas

1. Create a free M0 cluster on AWS.
2. **Database Access**: add a user (for example `noticeboard-lambda`) with a strong password.
3. **Network Access**: add `0.0.0.0/0` (Lambda has no fixed IP).
4. **Connect > Drivers > Python**: copy the `mongodb+srv://...` string and put the password in.
5. Optional demo data: put the string in `backend/.env` as `MONGODB_URI`, then run `python seed_demo.py` from `backend/`.

## 2. Build the Lambda zip

From `backend/` on your PC:

```powershell
python build_lambda.py
```

This makes `backend/_build/lambda.zip` with Linux wheels for Python 3.12. It works from Windows too, so you don't need Docker.

## 3. Lambda

1. **Create function** > Author from scratch. Name it `<yourname>-noticeboard-api`. Runtime **Python 3.12**, architecture **x86_64**.
2. **Code** > Upload from > .zip file > `lambda.zip`.
3. **Runtime settings** > Edit > Handler: `lambda_handler.handler`
4. **Configuration > General**: memory **512 MB**, timeout **15 s**.
5. **Configuration > Environment variables**:

| Key | Value |
|---|---|
| `MONGODB_URI` | your Atlas string |
| `MONGODB_DB` | `noticeboard` |
| `JWT_SECRET` | a long random string |
| `BOOTSTRAP_HR_EMAIL` | first HR login, e.g. `hr@noticeboard.dev` |
| `BOOTSTRAP_HR_PASSWORD` | a strong password (only used if no HR user exists yet) |
| `CORS_ORIGINS` | your S3 website URL from step 5, e.g. `http://my-bucket.s3-website-us-east-1.amazonaws.com` |

Leave `SEED_DEMO` unset on AWS.

6. **Test**: create a test event with the `apigateway-http-api-proxy` template and set `rawPath` and `requestContext.http.path` to `/api/health` and the method to `GET`. You should get `{"status":"ok"}`.

## 4. API Gateway (HTTP API)

1. **Create API** > HTTP API > Build. Integration: **Lambda**, pick the function. Name: `<yourname>-noticeboard-http`.
2. **Routes**: add `ANY /api/{proxy+}`. One route covers the whole API.
3. Stage `$default`, auto-deploy on.
4. **Do not turn on API Gateway CORS.** FastAPI already answers CORS. If both are on, the gateway's settings replace the app's.
5. Optional: **Throttling** on `$default` (e.g. rate 25, burst 50) to protect Atlas.
6. Copy the **Invoke URL** (e.g. `https://abc123.execute-api.us-east-1.amazonaws.com`).
7. Check it: open `<Invoke URL>/api/health` in the browser.

## 5. Frontend on S3

1. Build with the API URL baked in (PowerShell, from `frontend/`):

```powershell
$env:VITE_API_URL = "https://abc123.execute-api.us-east-1.amazonaws.com"
npm run build
```

2. **S3 > Create bucket** (unique name). Untick **Block all public access** and confirm.
3. **Properties > Static website hosting**: enable. Index document `index.html`, error document `index.html` (React handles the routes).
4. **Permissions > Bucket policy** (replace the bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
  }]
}
```

5. Upload everything **inside** `frontend/dist` (so `index.html` is at the bucket root).
6. Open the **Bucket website endpoint**. If the browser says CORS failed, check that `CORS_ORIGINS` on the Lambda matches this URL exactly (no trailing slash), then save.

## Redeploy

- API change: `python build_lambda.py`, then upload the new zip in the Lambda console.
- UI change: `npm run build` with `VITE_API_URL` set, then upload `dist/` again (delete the old `assets/` files first).

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| 502 from API Gateway | Wrong handler name, or the zip was built on Windows without `build_lambda.py` (wrong bcrypt / pydantic-core binaries). Check CloudWatch logs. |
| 503 on `/api/health` | Lambda can't reach Atlas: check `MONGODB_URI`, the Atlas user, and Network Access `0.0.0.0/0`. |
| Timeout after 3 s | Lambda timeout is still the default 3 s. Set 15 s. |
| CORS error in the browser | `CORS_ORIGINS` doesn't match the site URL, or API Gateway CORS is turned on. |
| Login works, then 401 everywhere | `JWT_SECRET` changed. Sign in again. |
