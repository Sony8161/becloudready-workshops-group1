# Deploys from YOUR PC: the same steps as the .github/workflows/deploy-ec2.yml.
# Handy for the first deploy, or to deploy a branch that isn't on main yet.
# Needs: Docker Desktop running, AWS CLI logged in (aws configure), and `terraform apply` done.
# Run from anywhere:   powershell -ExecutionPolicy Bypass -File infra-ec2\deploy-from-pc.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

function Check($step) {
    if ($LASTEXITCODE -ne 0) { throw "$step failed (exit code $LASTEXITCODE)" }
}

# The resource names Terraform created
$vars = terraform -chdir="$PSScriptRoot" output -json github_variables | ConvertFrom-Json; Check "terraform output"
$region   = $vars.AWS_REGION
$instance = $vars.EC2_INSTANCE_ID
$account  = aws sts get-caller-identity --query Account --output text; Check "aws sts (are you logged in?)"
$registry = "$account.dkr.ecr.$region.amazonaws.com"
$image    = "$registry/$($vars.ECR_REPOSITORY)"
$tag      = git -C $root rev-parse --short HEAD

Write-Host "`n1/4 Build and push the API image ($tag)" -ForegroundColor Cyan
aws ecr get-login-password --region $region | docker login --username AWS --password-stdin $registry; Check "docker login"
docker build -t "${image}:$tag" -t "${image}:latest" "$root\backend"; Check "docker build"
docker push "${image}:$tag"; Check "docker push"
docker push "${image}:latest"; Check "docker push"

Write-Host "`n2/4 Restart the API on EC2 (SSM Run Command)" -ForegroundColor Cyan
$cmdId = aws ssm send-command --region $region --instance-ids $instance --document-name AWS-RunShellScript `
    --comment "Deploy $tag from PC" --parameters commands=/opt/simplebank/deploy.sh `
    --query Command.CommandId --output text; Check "ssm send-command"
$status = "Pending"
foreach ($i in 1..60) {
    Start-Sleep 5
    try {
        $status = aws ssm get-command-invocation --region $region --command-id $cmdId --instance-id $instance `
            --query Status --output text 2>$null
    } catch { $status = "Pending" }   # right after sending, AWS may not know the command yet
    if ($status -notin @("Pending", "InProgress", "Delayed", $null, "")) { break }
}
aws ssm get-command-invocation --region $region --command-id $cmdId --instance-id $instance `
    --query StandardOutputContent --output text
if ($status -ne "Success") { throw "Deploy on the server ended with status: $status" }

Write-Host "`n3/4 Build and upload the website" -ForegroundColor Cyan
Push-Location "$root\frontend"
try {
    $env:VITE_API_URL = "/api"
    npm run build; Check "npm run build"
} finally {
    Remove-Item Env:VITE_API_URL -ErrorAction SilentlyContinue
    Pop-Location
}
$bucket = "s3://$($vars.S3_BUCKET)"
aws s3 sync "$root\frontend\dist\assets" "$bucket/assets" --cache-control "public,max-age=31536000,immutable"; Check "s3 sync"
aws s3 sync "$root\frontend\dist" $bucket --delete --exclude "assets/*" --cache-control "no-cache"; Check "s3 sync"

Write-Host "`n4/4 Refresh CloudFront" -ForegroundColor Cyan
aws cloudfront create-invalidation --distribution-id $vars.CLOUDFRONT_DISTRIBUTION_ID --paths "/*" | Out-Null; Check "invalidation"

$url = terraform -chdir="$PSScriptRoot" output -raw website_url
Write-Host "`nDone: $url" -ForegroundColor Green
