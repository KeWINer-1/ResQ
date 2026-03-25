param(
  [string]$SiteName = "ResQ"
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

Import-Module WebAdministration

if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
  throw "pm2 nincs telepitve. Futtasd eloszor: .\\deploy\\setup-server.ps1"
}

Push-Location $root
$env:NODE_ENV = "production"
pm2 restart resq --update-env
pm2 save
Pop-Location

if (Test-Path "IIS:\Sites\$SiteName") {
  Restart-Website -Name $SiteName
}

Write-Host "ResQ ujrainditva (PM2 + IIS site: $SiteName)."
