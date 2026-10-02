# Rebuild the React site and put it live (the console version: S3 + CloudFront).
# Finds the API address and the CloudFront distribution by name, so nothing has to be typed by hand,
# which avoids the two classic mistakes: a missing /api at the end, or a stale page after the upload.
# Run from anywhere:   powershell -ExecutionPolicy Bypass -File infra\console\redeploy_site.ps1
param(
    [string]$Bucket  = "duonglam-simplebank-site",
    [string]$ApiName = "duonglam-simplebank-http-api"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path "$PSScriptRoot\..\.."
function Check($step) {
    if ($LASTEXITCODE -ne 0) { throw "$step failed (exit code $LASTEXITCODE)" }
}

# --output json, not text: with text the CLI applies the query to each page of results separately
$endpoint = aws apigatewayv2 get-apis --query "Items[?Name=='$ApiName'].ApiEndpoint | [0]" --output json | ConvertFrom-Json; Check "find the API"
if (-not $endpoint) { throw "No API Gateway API named $ApiName" }
$apiUrl = "$endpoint/api"

$originDomain = "$Bucket.s3.us-east-1.amazonaws.com"
$found = aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items[?DomainName=='$originDomain']] | [0].{id:Id,site:DomainName}" --output json | ConvertFrom-Json; Check "find the distribution"
if (-not $found) { throw "No CloudFront distribution reads from $Bucket" }
$distId = $found.id
$site = $found.site

Write-Host "1/3 Build the website (VITE_API_URL=$apiUrl)" -ForegroundColor Cyan
Push-Location "$root\frontend"
try {
    $env:VITE_API_URL = $apiUrl
    npm run build; Check "npm run build"
} finally {
    Remove-Item Env:VITE_API_URL -ErrorAction SilentlyContinue
    Pop-Location
}

Write-Host "`n2/3 Upload to s3://$Bucket" -ForegroundColor Cyan
$dist = "$root\frontend\dist"
$target = "s3://$Bucket"
# Content types set by hand: on Windows the AWS CLI can guess .js wrong, and browsers refuse JS sent as text/plain.
# Hashed files in assets/ never change (a new build gets new names), so browsers may keep them for a year.
$long = "public,max-age=31536000,immutable"
aws s3 sync "$dist\assets" "$target/assets" --exclude "*" --include "*.js" --content-type "text/javascript" --cache-control $long; Check "upload js"
aws s3 sync "$dist\assets" "$target/assets" --exclude "*" --include "*.css" --content-type "text/css" --cache-control $long; Check "upload css"
aws s3 sync "$dist\assets" "$target/assets" --exclude "*.js" --exclude "*.css" --cache-control $long; Check "upload other assets"
# index.html last, and re-checked on every visit, so visitors switch to the new build right away
aws s3 sync $dist $target --delete --exclude "assets/*" --cache-control "no-cache"; Check "upload index.html"

Write-Host "`n3/3 Tell CloudFront to drop its old copy of index.html" -ForegroundColor Cyan
aws cloudfront create-invalidation --distribution-id $distId --paths "/index.html" "/" --query "Invalidation.Status" --output text; Check "invalidation"

Write-Host "`nDone: https://$site  (check it: python infra\smoke_test.py)" -ForegroundColor Green
