# Daily auto-commit and push. Registered via Windows Task Scheduler (task: IPOAlert-DailyPush).
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

$date = Get-Date -Format "yyyy-MM-dd"
$log = Join-Path $PSScriptRoot "daily-push.log"

function Log($msg) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg" | Add-Content $log }

try {
    git add -A
    git diff --cached --quiet
    if ($LASTEXITCODE -ne 0) {
        git commit -m "Daily update: $date"
        Log "committed: Daily update: $date"
    } else {
        Log "no changes to commit"
    }

    git push origin main
    if ($LASTEXITCODE -ne 0) { throw "git push failed with exit code $LASTEXITCODE" }
    Log "push ok"
} catch {
    Log "ERROR: $_"
    exit 1
}
