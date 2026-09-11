param([switch]$SkipBuild)
$ErrorActionPreference='Stop'
$ptRoot=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $ptRoot
$ptNode=(Get-Command node -ErrorAction Stop).Source
$ptNpm=Join-Path $ptRoot '.tools/package/bin/npm-cli.js'
if(Test-Path -LiteralPath (Join-Path $ptRoot '.tools/bin')){$env:PATH=(Join-Path $ptRoot '.tools/bin')+';'+$env:PATH}
if(!(Test-Path -LiteralPath '.env')){throw 'Create .env from README and configure the database first.'}
New-Item -ItemType Directory -Force .local | Out-Null
$ptDbConfig=Join-Path $ptRoot '.tools/mariadb-data/my.ini'
if(Test-Path -LiteralPath $ptDbConfig){
  $ptListener=Get-NetTCPConnection -LocalPort 3307 -State Listen -ErrorAction SilentlyContinue
  if(!$ptListener){
    Start-Process -FilePath (Join-Path $ptRoot '.tools/mariadb-11.4.9-winx64/bin/mariadbd.exe') -ArgumentList ('--defaults-file="'+$ptDbConfig+'"'),'--bind-address=127.0.0.1','--console' -WindowStyle Hidden -RedirectStandardOutput .local/db-out.log -RedirectStandardError .local/db-error.log | Out-Null
    Start-Sleep -Seconds 2
  }
}
if(!(Test-Path -LiteralPath $ptNpm)){throw 'Local npm runtime is missing. Follow the standard npm commands in README.'}
& $ptNode $ptNpm run db:migrate
if($LASTEXITCODE -ne 0){throw 'Database connection or migration failed.'}
if(!$SkipBuild){& $ptNode $ptNpm run build;if($LASTEXITCODE -ne 0){throw 'Build failed.'}}
if(!(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)){
  Start-Process -FilePath $ptNode -ArgumentList 'dist/server.js' -WorkingDirectory (Join-Path $ptRoot 'apps/api') -WindowStyle Hidden -RedirectStandardOutput .local/api-out.log -RedirectStandardError .local/api-error.log | Out-Null
}
if(!(Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue)){
  Start-Process -FilePath $ptNode -ArgumentList '../../node_modules/vite/bin/vite.js','--host','127.0.0.1' -WorkingDirectory (Join-Path $ptRoot 'apps/web') -WindowStyle Hidden -RedirectStandardOutput .local/web-out.log -RedirectStandardError .local/web-error.log | Out-Null
}
# Database leases prevent multiple workers from claiming the same job.
Start-Process -FilePath $ptNode -ArgumentList 'dist/worker.js' -WorkingDirectory (Join-Path $ptRoot 'apps/api') -WindowStyle Hidden -RedirectStandardOutput (Join-Path '.local' ('worker-'+[guid]::NewGuid()+'.log')) | Out-Null
$ptReady=$false
for($ptAttempt=0;$ptAttempt -lt 20;$ptAttempt++){
  try{if((Invoke-RestMethod -Uri 'http://127.0.0.1:3000/health/ready' -TimeoutSec 2).status -eq 'ready'){$ptReady=$true;break}}catch{}
  Start-Sleep -Seconds 1
}
if(!$ptReady){throw 'API is not ready. Check .local/api-error.log.'}
Write-Output 'Innovate Academy is running at http://localhost:5173. Local test accounts are in .local/test-accounts.json.'
