param([switch]$SkipBuild)
$ErrorActionPreference='Stop'
$ptRoot=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $ptRoot
$ptNode=(Get-Command node -ErrorAction Stop).Source
$ptNpm=Join-Path $ptRoot '.tools/package/bin/npm-cli.js'
if(Test-Path -LiteralPath (Join-Path $ptRoot '.tools/bin')){$env:PATH=(Join-Path $ptRoot '.tools/bin')+';'+$env:PATH}
if(!(Test-Path -LiteralPath '.env')){throw '請先依 README 建立 .env 並設定資料庫。'}
New-Item -ItemType Directory -Force .local | Out-Null
$ptDbConfig=Join-Path $ptRoot '.tools/mariadb-data/my.ini'
if(Test-Path -LiteralPath $ptDbConfig){
  $ptListener=Get-NetTCPConnection -LocalPort 3307 -State Listen -ErrorAction SilentlyContinue
  if(!$ptListener){
    Start-Process -FilePath (Join-Path $ptRoot '.tools/mariadb-11.4.9-winx64/bin/mariadbd.exe') -ArgumentList ('--defaults-file="'+$ptDbConfig+'"'),'--bind-address=127.0.0.1','--console' -WindowStyle Hidden -RedirectStandardOutput .local/db-out.log -RedirectStandardError .local/db-error.log | Out-Null
    Start-Sleep -Seconds 2
  }
}
if(!(Test-Path -LiteralPath $ptNpm)){throw '此工作站啟動器需要先前安裝的 .tools npm；其他環境請使用 README 的 npm 指令。'}
& $ptNode $ptNpm run db:migrate
if($LASTEXITCODE -ne 0){throw '資料庫連線或 migration 失敗。'}
if(!$SkipBuild){& $ptNode $ptNpm run build;if($LASTEXITCODE -ne 0){throw '建置失敗。'}}
if(!(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)){
  Start-Process -FilePath $ptNode -ArgumentList 'dist/server.js' -WorkingDirectory (Join-Path $ptRoot 'apps/api') -WindowStyle Hidden -RedirectStandardOutput .local/api-out.log -RedirectStandardError .local/api-error.log | Out-Null
}
if(!(Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue)){
  Start-Process -FilePath $ptNode -ArgumentList '../../node_modules/vite/bin/vite.js','--host','127.0.0.1' -WorkingDirectory (Join-Path $ptRoot 'apps/web') -WindowStyle Hidden -RedirectStandardOutput .local/web-out.log -RedirectStandardError .local/web-error.log | Out-Null
}
# 多個 worker 使用資料庫 lease 避免同時取得同一工作；不停止任何既有程序。
Start-Process -FilePath $ptNode -ArgumentList 'dist/worker.js' -WorkingDirectory (Join-Path $ptRoot 'apps/api') -WindowStyle Hidden -RedirectStandardOutput (Join-Path '.local' ('worker-'+[guid]::NewGuid()+'.log')) | Out-Null
$ptReady=$false
for($ptAttempt=0;$ptAttempt -lt 20;$ptAttempt++){
  try{if((Invoke-RestMethod -Uri 'http://127.0.0.1:3000/health/ready' -TimeoutSec 2).status -eq 'ready'){$ptReady=$true;break}}catch{}
  Start-Sleep -Seconds 1
}
if(!$ptReady){throw 'API 尚未就緒，請查看 .local/api-error.log。'}
Write-Output '平台已啟動：http://localhost:5173 。本機測試帳戶請查看 .local/test-accounts.json。'
