# Deploy (or redeploy) Simple Bank to the lab account: S3 + Lambda + API Gateway.
#   1) build the Lambda zip   2) terraform apply   3) build React with the API's address   4) upload it to S3
# Needs: AWS CLI logged in (aws sts get-caller-identity works), infra\terraform.tfvars filled in.
# Run from anywhere:   powershell -ExecutionPolicy Bypass -File infra\deploy.ps1
# Add -AutoApprove to skip Terraform's "type yes" question.
param([switch]$AutoApprove)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$tf = @("-chdir=$PSScriptRoot")

function Check($step) {
    if ($LASTEXITCODE -ne 0) { throw "$step failed (exit code $LASTEXITCODE)" }
}

if (-not (Test-Path "$PSScriptRoot\terraform.tfvars")) {
    throw "Copy infra\terraform.tfvars.example to infra\terraform.tfvars and put your MongoDB URI in it first."
}
$who = aws sts get-caller-identity --query Arn --output text; Check "AWS login (run aws configure)"
Write-Host "AWS user: $who"

Write-Host "`n1/4 Build the Lambda package" -ForegroundColor Cyan
$python = if (Test-Path "$root\.venv\Scripts\python.exe") { "$root\.venv\Scripts\python.exe" } else { "python" }
& $python "$PSScriptRoot\build_lambda.py"; Check "build_lambda.py"

Write-Host "`n2/4 terraform apply" -ForegroundColor Cyan
terraform @tf init -input=false | Out-Null; Check "terraform init"
if ($AutoApprove) { terraform @tf apply -input=false -auto-approve } else { terraform @tf apply -input=false }
Check "terraform apply"

$apiUrl = terraform @tf output -raw vite_api_url
$bucket = "s3://" + (terraform @tf output -raw site_bucket)
$site   = terraform @tf output -raw website_url

Write-Host "`n3/4 Build the website (VITE_API_URL=$apiUrl)" -ForegroundColor Cyan
Push-Location "$root\frontend"
try {
    $env:VITE_API_URL = $apiUrl
    npm run build; Check "npm run build"
} finally {
    Remove-Item Env:VITE_API_URL -ErrorAction SilentlyContinue
    Pop-Location
}

Write-Host "`n4/4 Upload the website to S3" -ForegroundColor Cyan
$dist = "$root\frontend\dist"
# Content types set by hand: on Windows the AWS CLI can guess .js wrong, and browsers refuse JS sent as text/plain.
# Hashed files in assets/ never change, so browsers may cache them for a year.
$long = "public,max-age=31536000,immutable"
aws s3 sync "$dist\assets" "$bucket/assets" --exclude "*" --include "*.js" --content-type "text/javascript" --cache-control $long; Check "upload js"
aws s3 sync "$dist\assets" "$bucket/assets" --exclude "*" --include "*.css" --content-type "text/css" --cache-control $long; Check "upload css"
aws s3 sync "$dist\assets" "$bucket/assets" --exclude "*.js" --exclude "*.css" --cache-control $long; Check "upload other assets"
# index.html must be re-checked on every visit, so a new deploy shows up right away
aws s3 sync $dist $bucket --delete --exclude "assets/*" --cache-control "no-cache"; Check "upload index.html"

Write-Host "`nChecking the API..." -ForegroundColor Cyan
try {
    $health = Invoke-RestMethod "$apiUrl/health" -TimeoutSec 40
    Write-Host "API health: $($health.status), database: $($health.database)"
} catch {
    Write-Warning "The API isn't healthy yet: $($_.Exception.Message). Check: MongoDB Atlas > Network Access allows 0.0.0.0/0, and the log (terraform output api_logs)."
}

Write-Host "`nDone: $site" -ForegroundColor Green
Write-Host "Admin login: $(terraform @tf output -raw admin_username) / (terraform -chdir=infra output -raw admin_password)"
