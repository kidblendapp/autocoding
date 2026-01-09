# Stop servers running on ports 3000 and 3001
Write-Host "Checking for running servers on ports 3000 and 3001..." -ForegroundColor Yellow

$ports = @(3000, 3001)
$found = $false
$stoppedPids = @()

foreach ($port in $ports) {
    try {
        $connections = netstat -ano 2>$null | findstr ":$port" 2>$null
        if ($connections) {
            $found = $true
            Write-Host "Found processes on port $port" -ForegroundColor Yellow
            $connections | ForEach-Object {
                $parts = $_ -split '\s+' | Where-Object { $_ -ne '' }
                if ($parts -and $parts[-1] -match '^\d+$') {
                    $pid = [int]$parts[-1]
                    if ($stoppedPids -notcontains $pid) {
                        Write-Host "  Stopping process $pid on port $port" -ForegroundColor Yellow
                        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                        $stoppedPids += $pid
                    }
                }
            }
        }
    } catch {
        # Ignore errors when checking ports
    }
}

# Also check for node processes that might be running the servers
try {
    $nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
    if ($nodeProcesses) {
        foreach ($proc in $nodeProcesses) {
            try {
                # Check if process is listening on our ports
                $procPorts = netstat -ano 2>$null | findstr "$($proc.Id)" 2>$null | findstr "LISTENING" 2>$null
                if ($procPorts -match ':3000|:3001') {
                    if ($stoppedPids -notcontains $proc.Id) {
                        Write-Host "  Stopping Node.js process $($proc.Id)" -ForegroundColor Yellow
                        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                        $stoppedPids += $proc.Id
                        $found = $true
                    }
                }
            } catch {
                # Ignore errors for individual processes
            }
        }
    }
} catch {
    # Ignore errors when checking node processes
}

if ($found -and $stoppedPids.Count -gt 0) {
    Write-Host "Waiting for processes to stop..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    Write-Host "Servers stopped successfully (stopped $($stoppedPids.Count) process(es))" -ForegroundColor Green
} else {
    Write-Host "No servers found running on ports 3000 and 3001" -ForegroundColor Green
}
