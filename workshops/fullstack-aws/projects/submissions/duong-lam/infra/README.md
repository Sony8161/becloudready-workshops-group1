# Deploying Simple Bank: S3 + Lambda + API Gateway (lab account)

```
Browser --HTTP---> S3 static website (the built React files)
   |               http://duonglam-simplebank-site.s3-website-us-east-1.amazonaws.com
   '---HTTPS--> API Gateway (HTTP API, route ANY /api/{proxy+})
                   --> Lambda (FastAPI, through Mangum) --> MongoDB Atlas
                   https://<id>.execute-api.us-east-1.amazonaws.com/api/...
```

| File | What it does |
|---|---|
| `backend/lambda_handler.py` | Lambda entry point: Mangum turns API Gateway events into FastAPI requests |
| `infra/site.tf` | S3 bucket with static website hosting + public-read policy |
| `infra/lambda.tf` | The Lambda function, its settings (env vars) and generated secrets |
| `infra/api.tf` | API Gateway HTTP API: one catch-all route to the Lambda, throttling |
| `infra/build_lambda.py` | Builds `infra/build/lambda.zip` (our code + Linux versions of the packages) |
| `infra/deploy.ps1` | One command: build zip, `terraform apply`, build React, upload to S3 |
| `.github/workflows/ci-cd.yml` | CI on every push; on `main`, updates the Lambda and S3 |

Prefer clicking through the AWS console, with CloudFront for HTTPS? Same pieces, step by step: [CONSOLE.md](CONSOLE.md).

The full EC2 + CloudFront version (needs your own AWS account) is in [../infra-ec2](../infra-ec2/README.md).

## 1. Check the AWS login

```powershell
aws sts get-caller-identity     # should show user/duong-lam@quicklabs.internal
```
If it fails, run `aws configure` with the lab's access key and secret, region `us-east-1`.

## 2. Let Lambda reach MongoDB Atlas

Lambda has no fixed IP address, so in Atlas > **Network Access** add `0.0.0.0/0` (allow from anywhere).
The database password is still required. Better still: in Atlas > **Database Access**, make a separate user just for
the deployed app, with read/write on `banking_prod` only, and use that user's connection string below.

## 3. Fill in the settings

```powershell
copy infra\terraform.tfvars.example infra\terraform.tfvars
notepad infra\terraform.tfvars        # paste your mongodb_uri, save
```

## 4. Deploy

```powershell
powershell -ExecutionPolicy Bypass -File infra\deploy.ps1
```
It shows Terraform's plan (12 things to create the first time) and waits for you to type `yes`.
Run the same command again after any code change: only what changed gets updated.

## 5. Use it

```powershell
terraform -chdir=infra output website_url            # open this
terraform -chdir=infra output -raw admin_password     # admin login (username: admin)
```
The deployed app has its own database (`banking_prod`), so it starts empty. To add the demo logins (john / jane):
```powershell
cd backend
$env:MONGODB_DB = "banking_prod"; python seed_demo.py; Remove-Item Env:MONGODB_DB
```

## 6. Optional: deploy from GitHub on every push to main

Repo > Settings > Secrets and variables > Actions:
- **Secrets:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (your lab keys)
- **Variables:** each entry of `terraform -chdir=infra output github_variables`

After that, a push to `main` that passes CI updates the Lambda's code and the website. (Terraform itself still runs
from your PC, because its state file lives there.)

## Everyday commands

| Task | Command |
|---|---|
| Watch the API log | `aws logs tail /aws/lambda/duonglam-simplebank-api --follow` |
| Health check | `Invoke-RestMethod "$(terraform -chdir=infra output -raw vite_api_url)/health"` |
| Redeploy | `powershell -ExecutionPolicy Bypass -File infra\deploy.ps1` |
| Delete everything | `terraform -chdir=infra destroy` |

## Good to know (and to explain in a demo)

- **Shared lab account.** About 30 other students use this account, so everything is named `duonglam-simplebank-*`.
  The lab blocks IAM, SSM and Secrets Manager, so secrets are Lambda environment variables (encrypted at rest,
  but readable by anyone in the account who can view Lambda settings). That's why step 2 recommends a separate
  Atlas user: change its password after the course.
- **HTTP website, HTTPS API.** S3 website hosting can't do HTTPS; passwords still travel over HTTPS because they go to
  API Gateway. For HTTPS on the site too, put CloudFront in front of the bucket (see `infra-ec2/cloudfront.tf`).
- **Cold starts.** After a quiet period the first request takes a few seconds (AWS starts a fresh copy and
  connects to MongoDB). Later requests are fast.
- **Limits that still work:** API Gateway throttling (25 req/s, bursts of 50), plus the app's own lockout and
  rate limits, which see the visitor's real IP.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `AccessDenied ... iam:PassRole` | Wrong role for your batch. See which role your other functions use: `aws lambda get-function-configuration --function-name duonglam-restapi --query Role` and set `lambda_role_arn` in terraform.tfvars. |
| API answers 503 / times out | Atlas is blocking Lambda: step 2. Check the log. |
| Site loads, but every action says it can't reach the server | Open the browser console. A CORS error means the site was built for another API address: run deploy.ps1 again. |
| `BucketAlreadyExists` | Someone took the name: set `name_prefix` in terraform.tfvars. |
| `InvalidClientTokenId` / `ExpiredToken` | The lab keys changed: `aws configure` again. |
