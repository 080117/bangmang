# QQ 机器人启动器（茜特菈莉）—— 双击桌面快捷方式即可
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

Write-Host "======================================"
Write-Host "  QQ 机器人启动器（茜特菈莉）"
Write-Host "======================================"

# 1) 检查是否已在运行
$existing = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match 'dist/index.js' }
if ($existing) {
    Write-Host "[提示] 机器人已在运行 (PID: $($existing.ProcessId -join ', '))，无需重复启动。"
    Read-Host "按回车关闭本窗口"
    exit 0
}

# 2) 检查 NapCat / QQ
$napcat = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -match 'NapCatWinBootMain|^QQ$' }
if ($napcat) {
    Write-Host "[OK] NapCat/QQ 已在运行。"
} else {
    Write-Host "[提示] 未检测到 NapCat/QQ，正在启动 NapCat…"
    try {
        & "$PSScriptRoot\launch-napcat.ps1"
        Start-Sleep -Seconds 5
    } catch {
        Write-Host "[警告] 启动 NapCat 失败: $($_.Exception.Message)"
    }
}

# 3) 检查 .env
if (-not (Test-Path -LiteralPath "$repo\.env")) {
    Write-Host "[警告] 未找到 .env（缺少 DEEPSEEK_API_KEY 将无法对话）。"
}

# 4) 检查编译产物
if (-not (Test-Path -LiteralPath "$repo\dist\index.js")) {
    Write-Host "[提示] 未找到编译产物，正在构建…"
    & npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[错误] 构建失败，请检查代码后重试。"
        Read-Host "按回车退出"
        exit 1
    }
}

# 5) 前台启动机器人（本窗口显示日志，Ctrl+C 停止）
Write-Host "[启动] node dist/index.js（日志将显示在本窗口，按 Ctrl+C 停止）"
Write-Host "--------------------------------------"
& node dist/index.js
$code = $LASTEXITCODE
Write-Host "--------------------------------------"
Write-Host "机器人已退出（code=$code）。"
Read-Host "按回车关闭窗口"