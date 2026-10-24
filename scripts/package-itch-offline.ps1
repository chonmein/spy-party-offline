$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$distPath = Join-Path $projectRoot "apps/web/dist"
$outputPath = Join-Path $projectRoot "dist"
$zipPath = Join-Path $outputPath "spy-party-offline.zip"

if (-not (Test-Path (Join-Path $distPath "index.html"))) {
  throw "Missing apps/web/dist/index.html. Run pnpm build first."
}

New-Item -ItemType Directory -Force $outputPath | Out-Null
if (Test-Path $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
Compress-Archive -Path (Join-Path $distPath "*") -DestinationPath $zipPath -Force
Write-Output "Created itch.io offline package: $zipPath"
