param(
  [string]$ServerUrl = ""
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$webRoot = Join-Path $projectRoot "apps\web"
$dist = Join-Path $webRoot "dist"
$zip = Join-Path $projectRoot "spy-party-itch.zip"

if ($ServerUrl) {
  $env:VITE_SERVER_URL = $ServerUrl
} else {
  throw "Provide -ServerUrl with the deployed wss:// backend before packaging for itch.io"
}

Push-Location $projectRoot
try {
  pnpm --filter @spy/web build
  if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }
  if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
  Compress-Archive -Path (Join-Path $dist "*") -DestinationPath $zip -Force
  Write-Output "Created $zip"
} finally {
  Pop-Location
}
