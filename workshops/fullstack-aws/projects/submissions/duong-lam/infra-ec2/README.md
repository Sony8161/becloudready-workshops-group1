# Deploying Simple Bank: Docker on EC2 + CloudFront (full version)

> This version needs your OWN AWS account: it creates IAM roles, ECR, SSM parameters and a budget,
> which the QuickLabs lab account blocks. For the lab, use the serverless version in [../infra](../infra/README.md)
> (S3 + Lambda + API Gateway).

```
Browser --HTTPS--> CloudFront  (https://dxxxx.cloudfront.net, the ONE public address)
                     |-- /api/*  --> EC2 server, Docker container (FastAPI) --> MongoDB Atlas
                     '-- /*      --> S3 bucket (the built React files)

"Deploy EC2 version" (GitHub Actions) --> API image to ECR --> SSM tells EC2 "pull + restart"
                                                --> React build to S3 --> CloudFront refresh
```

| File | What it does |
|---|---|
| `backend/Dockerfile`, `frontend/Dockerfile` + `nginx.conf` | Turn the API and the website into Docker images |
| `docker-compose.yml` | Runs both images on your PC |
| `infra-ec2/*.tf` | Terraform: everything on AWS (see the comments in each file) |
| `infra-ec2/user_data.sh.tftpl` | First-boot script for EC2: installs Docker, writes `/opt/simplebank/deploy.sh` |
| `infra-ec2/deploy-from-pc.ps1` | Deploy from your PC (same steps as the GitHub Actions job) |
| `.github/workflows/deploy-ec2.yml` | Deploy from GitHub (manual: Actions tab > Deploy EC2 version) |

## Step 0: run it in Docker on your PC

Docker Desktop must be running. Stop the normal `uvicorn` / `npm run dev` first (ports 8000 and 8080).

```powershell
docker compose up --build -d       # build + start
docker compose ps                  # api should say (healthy)
docker compose logs -f api         # backend log (dev-mode emails print here)
docker compose down                # stop
```
Open http://localhost:8080 (Swagger: http://localhost:8000/docs). It uses `backend/.env`, so it's the same database as local dev.

## Step 1: AWS account and CLI (one time)

1. Create an AWS account and turn on MFA for the root user. Don't use root day to day.
2. IAM > Users > create `duong-admin` with `AdministratorAccess`, turn on MFA, create an access key for the CLI.
3. `aws configure` (key, secret, region `us-east-1`). Check: `aws sts get-caller-identity`.
4. Optional, for a shell on the server: install the AWS CLI "Session Manager plugin".

## Step 2: build the AWS side with Terraform

```powershell
cd infra-ec2
copy terraform.tfvars.example terraform.tfvars   # then fill in mongodb_uri and budget_email
terraform init       # downloads the AWS provider
terraform plan       # shows what will be created (nothing happens yet)
terraform apply      # type "yes". CloudFront takes the longest (5-10 min)
```
`terraform.tfvars` and `terraform.tfstate` are git-ignored: they hold secrets.

## Step 3: let the server reach MongoDB Atlas

Atlas > Network Access > Add IP Address > paste `terraform output -raw server_ip`.

## Step 4: first deploy

Wait 2 to 3 minutes after `apply` (the server has to boot and check in with SSM). Then pick one:

- **From your PC:** `powershell -ExecutionPolicy Bypass -File infra-ec2\deploy-from-pc.ps1`
- **From GitHub:** run `terraform output github_variables` and add each one in GitHub:
  repo > Settings > Secrets and variables > Actions > **Variables** tab (they aren't secrets).
  Then run "Deploy EC2 version" from the Actions tab (on `main`).

## Step 5: use it

```powershell
terraform output website_url             # the live site
terraform output -raw admin_password     # admin login (username: admin)
```
The AWS site uses its own database (`banking_prod`), so it starts empty with a strong admin password.
For the demo logins (john / jane), open a shell on the server and run the seed script:
```powershell
aws ssm start-session --target <instance id>      # exact command: terraform output shell_on_server
sudo docker exec simplebank-api python seed_demo.py
```

## Everyday commands

| Task | Command |
|---|---|
| Watch the API log | `aws logs tail /simplebank/api --follow` |
| Shell on the server | `terraform output shell_on_server` |
| Redeploy | run "Deploy EC2 version" in GitHub Actions, or `deploy-from-pc.ps1` |
| Change a setting | edit the `.tf` / `tfvars`, `terraform apply`, then redeploy (settings load when the container starts) |
| Delete everything | `terraform destroy` |

## Security choices (worth explaining in a demo)

- **No SSH.** No port 22, no key pair. Shells and deploys go through SSM (logged in CloudTrail).
- **Only CloudFront can reach the server.** The firewall allows port 80 only from CloudFront's IP list, and the API rejects
  any request without the secret `X-Origin-Verify` header (403), so nobody can skip CloudFront.
- **Secrets never touch Git or the image.** They live in SSM Parameter Store as SecureString (encrypted with KMS).
  Terraform generates the JWT secret, admin password and origin secret.
- **GitHub has no AWS keys.** It logs in with OIDC, and the role only works from this repo's `main` branch,
  on exactly these resources (least privilege).
- **Hardening:** IMDSv2 only, encrypted disk, container runs as a non-root user, ECR scans every image for CVEs,
  HTTPS everywhere for visitors, security headers on the site, real visitor IP for rate limits (CloudFront-Viewer-Address).
- **Known gaps (next steps):** the CloudFront-to-EC2 hop is plain HTTP (fix: a custom domain with a TLS certificate on
  the server, or CloudFront VPC origins); state is on your PC (fix: the encrypted S3 backend in `versions.tf`);
  one server means no high availability (fix: ECS Fargate or an Auto Scaling group behind a load balancer).

## Costs

The EC2 server and its public IP bill by the hour while they exist. CloudFront, S3, ECR, SSM and CloudWatch cost
pennies at this size. The budget in `budget.tf` emails you at 80% of `monthly_budget_usd`.
Run `terraform destroy` when you're done showing it.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Deploy says `InvalidInstanceId` | The server hasn't checked in with SSM yet. Wait a few minutes. |
| Deploy says "did not become healthy" | Usually MongoDB Atlas blocking the server: Step 3. |
| `403 Forbidden` on `/api` | You called the server directly. Use the CloudFront URL. |
| `502` / `504` on `/api` | The container isn't running. Check the log, then redeploy. |
| GitHub: `Not authorized to perform sts:AssumeRoleWithWebIdentity` | `github_repo` / `deploy_branch` don't match the repo, or the job ran on another branch. |
| Site shows an old version | Hard refresh (Ctrl+F5). The deploy refreshes CloudFront, which takes a minute. |
