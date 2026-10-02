# Rebuild the Lambda zip and put the new backend code live (the console version).
# Settings (environment variables, memory, timeout) are not touched: only the code changes.
# Run from anywhere:   powershell -ExecutionPolicy Bypass -File infra\console\redeploy_api.ps1
param(
    [string]$Function = "duonglam-simplebank-api",
    [string]$ApiName  = "duonglam-simplebank-http-api"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path "$PSScriptRoot\..\.."
function Check($step) {
    if ($LASTEXITCODE -ne 0) { throw "$step failed (exit code $LASTEXITCODE)" }
}

Write-Host "1/3 Build the Lambda package" -ForegroundColor Cyan
$python = if (Test-Path "$root\.venv\Scripts\python.exe") { "$root\.venv\Scripts\python.exe" } else { "python" }
& $python "$root\infra\build_lambda.py"; Check "build_lambda.py"

Write-Host "`n2/3 Upload it to $Function" -ForegroundColor Cyan
aws lambda update-function-code --function-name $Function --zip-file "fileb://$root\infra\build\lambda.zip" --query "LastUpdateStatus" --output text; Check "update-function-code"
aws lambda wait function-updated --function-name $Function; Check "wait for the update"

Write-Host "`n3/3 Health check" -ForegroundColor Cyan
$endpoint = aws apigatewayv2 get-apis --query "Items[?Name=='$ApiName'].ApiEndpoint | [0]" --output json | ConvertFrom-Json
try {
    $health = Invoke-RestMethod "$endpoint/api/health" -TimeoutSec 40
    Write-Host "API health: $($health.status), database: $($health.database)" -ForegroundColor Green
} catch {
    Write-Warning "Not healthy yet: $($_.Exception.Message). Look at the log: aws logs tail /aws/lambda/$Function --since 10m"
}
