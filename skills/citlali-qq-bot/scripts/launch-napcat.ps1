$napcatDir = 'C:\Users\29234\NapCat\Shell\napcat'
$qqPath = 'C:\Program Files\Tencent\QQNT\QQ.exe'

$env:NAPCAT_PATCH_PACKAGE = Join-Path $napcatDir 'qqnt.json'
$env:NAPCAT_LOAD_PATH     = Join-Path $napcatDir 'loadNapCat.js'
$env:NAPCAT_INJECT_PATH   = Join-Path $napcatDir 'NapCatWinBootHook.dll'
$env:NAPCAT_LAUNCHER_PATH = Join-Path $napcatDir 'NapCatWinBootMain.exe'
$env:NAPCAT_MAIN_PATH     = Join-Path $napcatDir 'napcat.mjs'

$mainForward = ($env:NAPCAT_MAIN_PATH -replace '\\','/')
$loadJs = '(async () => {await import("file:///' + $mainForward + '")})()'
[System.IO.File]::WriteAllText($env:NAPCAT_LOAD_PATH, $loadJs, (New-Object System.Text.UTF8Encoding($false)))

Set-Location $napcatDir
$log = Join-Path $napcatDir 'bootmain.log'
$p = Start-Process -FilePath $env:NAPCAT_LAUNCHER_PATH -ArgumentList @("`"$qqPath`"", "`"$env:NAPCAT_INJECT_PATH`"") -WorkingDirectory $napcatDir -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError ($log + '.err') -PassThru
Write-Host "NapCatWinBootMain started PID=$($p.Id)"
