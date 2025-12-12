# Check repository access using token and SSH
param(
    [Parameter(Mandatory=$false)]
    [string]$Token = $env:GITHUB_TOKEN
)

Write-Host "Checking access to kidblendapp/autocoding repository..." -ForegroundColor Cyan
Write-Host ""

# Check 1: SSH Key Access
Write-Host "1. Checking SSH Key Access..." -ForegroundColor Yellow
try {
    $job = Start-Job -ScriptBlock {
        ssh -T git@github.com 2>&1
    }
    
    $timeout = 10  # 10 seconds timeout
    $result = Wait-Job -Job $job -Timeout $timeout
    
    if ($result) {
        $sshOutput = Receive-Job -Job $job | Out-String
        Remove-Job -Job $job -ErrorAction SilentlyContinue
        
        if ($sshOutput -match "successfully authenticated") {
            Write-Host "   [OK] SSH key is authenticated" -ForegroundColor Green
            if ($sshOutput -match "Hi (\w+)!") {
                $username = $matches[1]
            } else {
                $username = "unknown"
            }
            Write-Host "   Username: $username" -ForegroundColor Gray
        } elseif ($sshOutput -match "Permission denied") {
            Write-Host "   [FAIL] SSH key not authorized or not added to GitHub" -ForegroundColor Red
        } else {
            Write-Host "   [WARN] SSH connection issue: $sshOutput" -ForegroundColor Yellow
        }
    } else {
        Stop-Job -Job $job -ErrorAction SilentlyContinue
        Remove-Job -Job $job -ErrorAction SilentlyContinue
        Write-Host "   [WARN] SSH check timed out after ${timeout}s (connection may be slow or blocked)" -ForegroundColor Yellow
        Write-Host "   Tip: Check if SSH key is added to GitHub account at: https://github.com/settings/keys" -ForegroundColor Gray
    }
} catch {
    Write-Host "   [FAIL] SSH test failed: $_" -ForegroundColor Red
}

Write-Host ""

# Check 2: Token-based API Access
Write-Host "2. Checking Token-based API Access..." -ForegroundColor Yellow

# Check for token in environment or credential manager
if (-not $Token) {
    # Try to get token from Windows Credential Manager
    try {
        $cred = cmdkey /list | Select-String "github.com"
        if ($cred) {
            Write-Host "   [INFO] GitHub credentials found in Windows Credential Manager" -ForegroundColor Gray
        }
    } catch {}
    
    Write-Host "   [WARN] No token provided. Set GITHUB_TOKEN environment variable or use -Token parameter" -ForegroundColor Yellow
    Write-Host "   Trying GitHub CLI authentication..." -ForegroundColor Gray
    
    try {
        $ghAuth = & "c:\program files\GitHub CLI\gh.exe" auth status 2>&1 | Out-String
        if ($ghAuth -match "Logged in") {
            Write-Host "   [OK] GitHub CLI is authenticated" -ForegroundColor Green
            $Token = "using-gh-cli"
        } else {
            Write-Host "   [FAIL] GitHub CLI not authenticated" -ForegroundColor Red
            Write-Host "   Run: gh auth login" -ForegroundColor Gray
        }
    } catch {
        Write-Host "   [FAIL] GitHub CLI check failed" -ForegroundColor Red
    }
}

if ($Token -and $Token -ne "using-gh-cli") {
    $headers = @{
        "Accept" = "application/vnd.github+json"
        "Authorization" = "Bearer $Token"
        "X-GitHub-Api-Version" = "2022-11-28"
    }
    
    try {
        # Check repository access
        $repoUrl = "https://api.github.com/repos/kidblendapp/autocoding"
        $response = Invoke-RestMethod -Uri $repoUrl -Headers $headers -Method Get
        
        Write-Host "   [OK] Token has access to repository" -ForegroundColor Green
        Write-Host "   Repository: $($response.full_name)" -ForegroundColor Gray
        Write-Host "   Private: $($response.private)" -ForegroundColor Gray
        Write-Host "   Permissions:" -ForegroundColor Gray
        
        # Check permissions
        $permsUrl = "https://api.github.com/repos/kidblendapp/autocoding/collaborators/$($response.owner.login)/permission"
        try {
            $perms = Invoke-RestMethod -Uri $permsUrl -Headers $headers -Method Get
            Write-Host "     - Permission level: $($perms.permission)" -ForegroundColor Gray
        } catch {
            Write-Host "     - Could not determine permission level (might not be a collaborator)" -ForegroundColor Yellow
        }
        
    } catch {
        if ($_.Exception.Response.StatusCode -eq 404) {
            Write-Host "   [FAIL] Repository not found or token has no access" -ForegroundColor Red
        } elseif ($_.Exception.Response.StatusCode -eq 403) {
            Write-Host "   [FAIL] Token lacks permissions - 403 Forbidden" -ForegroundColor Red
        } else {
            Write-Host "   [FAIL] Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
} elseif ($Token -eq "using-gh-cli") {
    # Use GitHub CLI to check access
    Write-Host "   Checking via GitHub CLI..." -ForegroundColor Gray
    try {
        $repoInfo = & "c:\program files\GitHub CLI\gh.exe" repo view kidblendapp/autocoding --json name,isPrivate,viewerPermission 2>&1
        if ($LASTEXITCODE -eq 0) {
            $repo = $repoInfo | ConvertFrom-Json
            Write-Host "   [OK] GitHub CLI has access to repository" -ForegroundColor Green
            Write-Host "   Repository: $($repo.name)" -ForegroundColor Gray
            Write-Host "   Permission: $($repo.viewerPermission)" -ForegroundColor Gray
        } else {
            Write-Host "   [FAIL] GitHub CLI cannot access repository: $repoInfo" -ForegroundColor Red
        }
    } catch {
        Write-Host "   [FAIL] GitHub CLI check failed: $_" -ForegroundColor Red
    }
}

Write-Host ""

# Check 3: Repository Permissions via GitHub CLI
Write-Host "3. Checking Repository Permissions (via GitHub CLI)..." -ForegroundColor Yellow
try {
    $perms = & "c:\program files\GitHub CLI\gh.exe" api repos/kidblendapp/autocoding/collaborators/$(git config user.name)/permission 2>&1
    if ($LASTEXITCODE -eq 0) {
        $permData = $perms | ConvertFrom-Json
        Write-Host "   [OK] Your permission level: $($permData.permission)" -ForegroundColor Green
    } else {
        Write-Host "   [WARN] Could not determine permissions (you might not be a collaborator)" -ForegroundColor Yellow
        Write-Host "   Response: $perms" -ForegroundColor Gray
    }
} catch {
    Write-Host "   [WARN] Permission check failed: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Quick Fixes:" -ForegroundColor Cyan
Write-Host "1. To check SSH key: Visit https://github.com/settings/keys" -ForegroundColor White
Write-Host "2. To authenticate GitHub CLI: gh auth login" -ForegroundColor White
Write-Host "3. To use token: Set `$env:GITHUB_TOKEN = 'your-token' then run this script with -Token parameter" -ForegroundColor White
Write-Host "4. To request access: Ask repository owner to add you as collaborator" -ForegroundColor White

