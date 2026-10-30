# Daily health check, auto-commit and push. Registered via Windows Task Scheduler (task: IPOAlert-DailyPush).
# Flow: health check -> (on failure) ask Claude to fix -> re-check -> push only if healthy.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$date = Get-Date -Format "yyyy-MM-dd"
$log = Join-Path $PSScriptRoot "daily-push.log"
$port = 3100
$routes = @("/", "/calendar", "/watchlist", "/api/ipos")

function Log($msg) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg" | Add-Content $log }

# Runs a command, returns $true on exit code 0. Output goes to the log.
function Step($name, [scriptblock]$cmd) {
    $out = & $cmd 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        Log "FAIL [$name]: $($out.Trim() -replace '\s+', ' ' | Select-Object -First 1)"
        $script:lastFailure = "$name failed:`n$out"
        return $false
    }
    Log "ok [$name]"
    return $true
}

function Test-Health {
    $env:NODE_ENV = "production"
    $script:lastFailure = ""
    if (-not (Step "typecheck" { npm run typecheck })) { return $false }
    if (-not (Step "lint"      { npm run lint }))      { return $false }
    if (-not (Step "tests"     { npm test }))          { return $false }
    if (-not (Step "build"     { npm run build }))     { return $false }

    # Smoke test: start the production server and request every route.
    $next = Join-Path $root "node_modules\.bin\next.cmd"
    $proc = Start-Process -FilePath $next -ArgumentList "start", "-p", $port -WorkingDirectory $root -PassThru -WindowStyle Hidden
    try {
        $ready = $false
        for ($i = 0; $i -lt 30 -and -not $ready; $i++) {
            Start-Sleep 1
            try { Invoke-WebRequest "http://localhost:$port/" -UseBasicParsing -TimeoutSec 3 | Out-Null; $ready = $true } catch { }
        }
        if (-not $ready) { Log "FAIL [smoke]: server did not start"; $script:lastFailure = "smoke: production server did not start"; return $false }
        foreach ($r in $routes) {
            try {
                $res = Invoke-WebRequest "http://localhost:$port$r" -UseBasicParsing -TimeoutSec 15
                if ($res.StatusCode -ne 200) { throw "status $($res.StatusCode)" }
            } catch {
                Log "FAIL [smoke]: $r -> $_"
                $script:lastFailure = "smoke: $r returned error: $_"
                return $false
            }
        }
        Log "ok [smoke] $($routes -join ' ')"
        return $true
    } finally {
        taskkill /PID $proc.Id /T /F 2>&1 | Out-Null
    }
}

try {
    $healthy = Test-Health
    if (-not $healthy) {
        Log "unhealthy, asking Claude to repair"
        $prompt = "The IPOAlert app at $root failed its daily health check (typecheck, lint, tests, production build, route smoke test). Failure:`n$lastFailure`nDiagnose and fix the root cause with minimal changes so everything passes. Use NODE_ENV=production for builds. Do not commit or push."
        & claude -p $prompt --permission-mode acceptEdits --allowedTools "Read,Edit,Write,Glob,Grep,Bash" --max-turns 40 2>&1 | Out-String | ForEach-Object { Log "claude: $($_.Trim() -replace '\s+', ' ')" }
        $healthy = Test-Health
    }
    if (-not $healthy) {
        Log "ABORTED: app still unhealthy after repair attempt, nothing pushed"
        exit 1
    }

    git add -A
    git diff --cached --quiet
    if ($LASTEXITCODE -ne 0) {
        git commit -m "Daily update: $date"
        Log "committed: Daily update: $date"
    } else {
        git commit --allow-empty -m "Daily update: $date (no changes)"
        Log "committed (empty): Daily update: $date"
    }

    git push origin main
    if ($LASTEXITCODE -ne 0) { throw "git push failed with exit code $LASTEXITCODE" }
    Log "push ok"
} catch {
    Log "ERROR: $_"
    exit 1
}
