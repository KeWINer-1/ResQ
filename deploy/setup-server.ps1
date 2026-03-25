param(
  [string]$SiteName = "ResQ",
  [string]$HostHeader = "",
  [int]$IisPort = 80,
  [int]$BackendPort = 5000
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendPath = Join-Path $root "backend"
$publicPath = Join-Path $root "public"
$sourceWebConfig = Join-Path $root "deploy\iis\web.config"
$targetWebConfig = Join-Path $publicPath "web.config"

Write-Host "== ResQ IIS setup =="
Write-Host "Project root: $root"

Import-Module WebAdministration

Write-Host "1/7 IIS role check..."
$iisFeature = Get-WindowsFeature -Name Web-Server
if (-not $iisFeature.Installed) {
  Install-WindowsFeature -Name Web-Server -IncludeManagementTools | Out-Null
}

Write-Host "2/7 Node and npm check..."
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js nincs telepitve a szerveren. Telepitsd az LTS verziot, majd futtasd ujra."
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm nem erheto el. Ellenorizd a Node.js telepitest."
}

Write-Host "3/7 Backend dependencies telepitese..."
Push-Location $backendPath
npm ci
Pop-Location

Write-Host "4/7 PM2 telepitese/ellenorzese..."
if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
  npm install -g pm2
}

Write-Host "5/7 Production env letrehozasa, ha hianyzik..."
$prodEnv = Join-Path $backendPath ".env.production"
$devEnv = Join-Path $backendPath ".env"
if (-not (Test-Path $prodEnv)) {
  if (Test-Path $devEnv) {
    Copy-Item $devEnv $prodEnv
    Write-Host "Letrejott: backend/.env.production (a .env alapjan)."
    Write-Host "FONTOS: allitsd at production ertekekre (DB, JWT, SMTP, CORS)."
  } else {
    throw "Nincs backend/.env es backend/.env.production sem. Hozd letre valamelyiket."
  }
}

Write-Host "6/7 Backend inditasa PM2-vel..."
Push-Location $root
pm2 delete resq 2>$null | Out-Null
$env:NODE_ENV = "production"
pm2 start ecosystem.config.cjs --only resq --update-env
pm2 save
Pop-Location

Write-Host "7/7 IIS site konfiguracio..."
Copy-Item $sourceWebConfig $targetWebConfig -Force

if (-not (Test-Path "IIS:\AppPools\$SiteName")) {
  New-WebAppPool -Name $SiteName | Out-Null
}
Set-ItemProperty "IIS:\AppPools\$SiteName" -Name processModel.identityType -Value ApplicationPoolIdentity

if (-not (Test-Path "IIS:\Sites\$SiteName")) {
  New-Website -Name $SiteName -PhysicalPath $publicPath -Port $IisPort -HostHeader $HostHeader -ApplicationPool $SiteName | Out-Null
} else {
  Set-ItemProperty "IIS:\Sites\$SiteName" -Name physicalPath -Value $publicPath
  Set-ItemProperty "IIS:\Sites\$SiteName" -Name applicationPool -Value $SiteName
}

$rulePath = "MACHINE/WEBROOT/APPHOST/$SiteName"
try {
  Set-WebConfigurationProperty -PSPath $rulePath -Filter "system.webServer/rewrite/rules/rule[@name='ReverseProxyApi']/action" -Name "url" -Value "http://localhost:$BackendPort/api/{R:1}" | Out-Null
  Set-WebConfigurationProperty -PSPath $rulePath -Filter "system.webServer/rewrite/rules/rule[@name='ReverseProxyHealth']/action" -Name "url" -Value "http://localhost:$BackendPort/health" | Out-Null
} catch {
  throw "IIS URL Rewrite modul hianyzik vagy nem aktiv. Telepitsd a 'URL Rewrite' modult, majd futtasd ujra a scriptet."
}

Restart-WebAppPool -Name $SiteName
Restart-Website -Name $SiteName

Write-Host ""
Write-Host "Kesz. Elindult:"
Write-Host "- IIS site: $SiteName (port $IisPort, host '$HostHeader')"
Write-Host "- Backend PM2: resq (localhost:$BackendPort)"
Write-Host ""
Write-Host "Teszteld: http://localhost:$IisPort/health"
