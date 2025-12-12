# Workflow Retry Script with AI-Powered Auto-Fix (PowerShell)
# This script runs a GitHub Actions workflow, monitors it, and uses cursor-agent
# to automatically fix errors until the workflow succeeds or max retries is reached.

param(
    [string]$ConfigFile = "$PSScriptRoot\workflow-retry-config.json"
)

$ErrorActionPreference = "Stop"
$SCRIPT_DIR = $PSScriptRoot
$PROJECT_ROOT = Split-Path (Split-Path $SCRIPT_DIR -Parent) -Parent
$LOG_DIR = Join-Path $PROJECT_ROOT ".workflow-retry-logs"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$LOG_FILE = Join-Path $LOG_DIR "workflow-retry_$TIMESTAMP.log"

# Ensure log directory exists
if (-not (Test-Path $LOG_DIR)) {
    New-Item -ItemType Directory -Path $LOG_DIR -Force | Out-Null
}

# Logging functions
function Write-Log {
    param(
        [string]$Level,
        [string]$Message,
        [string]$Color = "White"
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    Write-Host $logMessage -ForegroundColor $Color
    Add-Content -Path $LOG_FILE -Value $logMessage
}

function Write-Info {
    param([string]$Message)
    Write-Log "INFO" $Message "Cyan"
}

function Write-Success {
    param([string]$Message)
    Write-Log "SUCCESS" $Message "Green"
}

function Write-Warn {
    param([string]$Message)
    Write-Log "WARN" $Message "Yellow"
}

function Write-Error {
    param([string]$Message)
    Write-Log "ERROR" $Message "Red"
}

function Write-Debug {
    param([string]$Message)
    if ($script:LOG_LEVEL -eq "debug" -or $script:LOG_LEVEL -eq "verbose") {
        Write-Log "DEBUG" $Message "Gray"
    }
}

# Check prerequisites
function Test-Prerequisites {
    Write-Info "Checking prerequisites..."
    
    $missing = @()
    
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
        $missing += "gh (GitHub CLI)"
    }
    
    if (-not (Get-Command jq -ErrorAction SilentlyContinue)) {
        $missing += "jq"
    }
    
    if (-not (Get-Command cursor-agent -ErrorAction SilentlyContinue)) {
        $missing += "cursor-agent"
    }
    
    try {
        gh auth status 2>&1 | Out-Null
    } catch {
        Write-Error "GitHub CLI is not authenticated. Run 'gh auth login'"
        exit 1
    }
    
    if ($missing.Count -gt 0) {
        Write-Error "Missing required tools: $($missing -join ', ')"
        exit 1
    }
    
    Write-Success "All prerequisites met"
}

# Load configuration
function Load-Config {
    param([string]$ConfigPath)
    
    Write-Info "Loading configuration from: $ConfigPath"
    
    if (-not (Test-Path $ConfigPath)) {
        Write-Error "Configuration file not found: $ConfigPath"
        exit 1
    }
    
    $config = Get-Content $ConfigPath | ConvertFrom-Json
    
    $script:WORKFLOW = $config.workflow
    $script:WORKFLOW_INPUTS = $config.workflowInputs
    $script:MAX_RETRIES = if ($config.maxRetries) { $config.maxRetries } else { 10 }
    $script:WAIT_TIMEOUT = if ($config.waitTimeout) { $config.waitTimeout } else { 3600 }
    $script:POLL_INTERVAL = if ($config.pollInterval) { $config.pollInterval } else { 10 }
    $script:FIX_STRATEGY = if ($config.fixStrategy) { $config.fixStrategy } else { "auto" }
    $script:COMMIT_MESSAGE_TEMPLATE = if ($config.commitMessage) { $config.commitMessage } else { "fix: Auto-fix workflow errors (run {runNumber})" }
    $script:BRANCH = $config.branch
    $script:LOG_LEVEL = if ($config.logLevel) { $config.logLevel } else { "normal" }
    
    # Cursor agent options
    $script:CURSOR_MODEL = if ($config.cursorAgentOptions.model) { $config.cursorAgentOptions.model } else { "auto" }
    $script:CURSOR_FORCE = if ($config.cursorAgentOptions.force) { $config.cursorAgentOptions.force } else { $true }
    $script:CURSOR_ADDITIONAL_ARGS = if ($config.cursorAgentOptions.additionalArgs) { $config.cursorAgentOptions.additionalArgs -join " " } else { "" }
    
    # Skip steps
    $script:SKIP_FIX = if ($config.skipSteps -contains "fix") { $true } else { $false }
    $script:SKIP_COMMIT = if ($config.skipSteps -contains "commit") { $false } else { $false }
    $script:SKIP_PUSH = if ($config.skipSteps -contains "push") { $true } else { $false }
    
    if (-not $script:WORKFLOW) {
        Write-Error "Configuration must specify 'workflow'"
        exit 1
    }
    
    Write-Success "Configuration loaded"
    Write-Debug "Workflow: $script:WORKFLOW"
    Write-Debug "Max retries: $script:MAX_RETRIES"
    Write-Debug "Fix strategy: $script:FIX_STRATEGY"
}

# Get repository info
function Get-RepoInfo {
    try {
        $repoJson = gh repo view --json nameWithOwner 2>&1
        $repo = ($repoJson | ConvertFrom-Json).nameWithOwner
        if (-not $repo) {
            Write-Error "Could not determine repository. Are you in a git repository?"
            exit 1
        }
        $script:REPO = $repo
        Write-Debug "Repository: $script:REPO"
    } catch {
        Write-Error "Could not determine repository: $_"
        exit 1
    }
}

# Trigger workflow
function Start-Workflow {
    param([int]$RunNumber)
    
    Write-Info "Triggering workflow: $script:WORKFLOW (attempt $RunNumber)"
    
    $cmd = "gh workflow run $script:WORKFLOW"
    
    # Add inputs if provided
    if ($script:WORKFLOW_INPUTS -and $script:WORKFLOW_INPUTS.PSObject.Properties.Count -gt 0) {
        foreach ($key in $script:WORKFLOW_INPUTS.PSObject.Properties.Name) {
            $value = $script:WORKFLOW_INPUTS.$key
            if ($value) {
                $cmd += " -f ${key}=`"$value`""
            }
        }
    }
    
    Write-Debug "Command: $cmd"
    
    try {
        Invoke-Expression $cmd | Out-Null
        Start-Sleep -Seconds 2
        
        $runId = gh run list --workflow="$script:WORKFLOW" --limit 1 --json databaseId -q '.[0].databaseId' 2>&1
        if ($runId -and $runId -match '^\d+$') {
            return $runId
        } else {
            Write-Error "Could not get run ID after triggering workflow"
            return $null
        }
    } catch {
        Write-Error "Failed to trigger workflow: $_"
        return $null
    }
}

# Wait for workflow completion
function Wait-Workflow {
    param([string]$RunId)
    
    $startTime = Get-Date
    $elapsed = 0
    
    Write-Info "Waiting for workflow run $RunId to complete..."
    
    while ($elapsed -lt $script:WAIT_TIMEOUT) {
        try {
            $statusJson = gh run view $RunId --json status,conclusion 2>&1
            $statusObj = $statusJson | ConvertFrom-Json
            $status = "$($statusObj.status)/$($statusObj.conclusion)"
            
            Write-Debug "Workflow status: $status"
            
            if ($status -match '/(failure|cancelled|success)$') {
                return $status
            }
        } catch {
            Write-Warn "Could not get workflow status, retrying..."
        }
        
        Start-Sleep -Seconds $script:POLL_INTERVAL
        $elapsed = ((Get-Date) - $startTime).TotalSeconds
        
        if ([math]::Floor($elapsed) % 60 -eq 0 -and $elapsed -gt 0) {
            Write-Info "Still waiting... ($([math]::Floor($elapsed))s elapsed)"
        }
    }
    
    Write-Error "Workflow timed out after $script:WAIT_TIMEOUT seconds"
    return "timeout/unknown"
}

# Extract workflow errors
function Get-WorkflowErrors {
    param([string]$RunId)
    
    $errorFile = Join-Path $LOG_DIR "errors_$RunId.txt"
    $summaryFile = Join-Path $LOG_DIR "summary_$RunId.txt"
    
    Write-Info "Extracting workflow logs and errors..."
    
    try {
        $jobId = gh run view $RunId --json jobs -q '.[] | select(.conclusion == "failure") | .databaseId' 2>&1 | Select-Object -First 1
        if (-not $jobId) {
            $jobId = gh run view $RunId --json jobs -q '.[0].databaseId' 2>&1
        }
        
        gh run view $RunId --log > $errorFile 2>&1
    } catch {
        Write-Warn "Could not extract full logs: $_"
    }
    
    # Create summary
    @"
=== Workflow Run Summary ===
Run ID: $RunId
Repository: $script:REPO
Workflow: $script:WORKFLOW

=== Status ===
$(gh run view $RunId --json status,conclusion,displayTitle,event -q '.[]' 2>&1)

=== Failed Steps ===
$(gh run view $RunId --json jobs -q '.[] | select(.conclusion == "failure") | "Job: \(.name) - \(.conclusion)"' 2>&1)

=== Error Logs (last 100 lines) ===
$(Get-Content $errorFile -Tail 100 -ErrorAction SilentlyContinue)
"@ | Out-File -FilePath $summaryFile -Encoding UTF8
    
    return $summaryFile
}

# Generate fix prompt
function New-FixPrompt {
    param(
        [string]$ErrorFile,
        [int]$RunNumber
    )
    
    $prompt = "The GitHub Actions workflow '$script:WORKFLOW' failed on run $RunNumber. "
    $prompt += "Please analyze the error logs and fix the issues in the codebase. "
    $prompt += "The error details are in the file: $ErrorFile. "
    $prompt += "Review the workflow file and related code, identify the root cause, and make the necessary fixes. "
    $prompt += "After making changes, ensure the fixes are correct and the code follows best practices. "
    $prompt += "Focus on the specific errors shown in the logs."
    
    return $prompt
}

# Apply fixes
function Invoke-Fixes {
    param(
        [string]$ErrorFile,
        [int]$RunNumber
    )
    
    if ($script:SKIP_FIX) {
        Write-Warn "Skipping fix step (configured in skipSteps)"
        return $true
    }
    
    Write-Info "Generating fixes using cursor-agent..."
    
    $prompt = New-FixPrompt $ErrorFile $RunNumber
    Write-Debug "Fix prompt: $prompt"
    
    $cursorCmd = ".\cicd\scripts\run-cursor-agent.sh"
    if ($script:CURSOR_FORCE) {
        $cursorCmd += " --force"
    }
    if ($script:CURSOR_MODEL -and $script:CURSOR_MODEL -ne "null") {
        $cursorCmd += " --model $script:CURSOR_MODEL"
    }
    if ($script:CURSOR_ADDITIONAL_ARGS) {
        $cursorCmd += " $script:CURSOR_ADDITIONAL_ARGS"
    }
    $cursorCmd += " `"$prompt`""
    
    Write-Debug "Executing: $cursorCmd"
    
    Push-Location $PROJECT_ROOT
    
    try {
        $fixOutput = Join-Path $LOG_DIR "fix_$RunNumber.log"
        & bash -c $cursorCmd > $fixOutput 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Fixes applied successfully"
            return $true
        } else {
            Write-Error "Failed to apply fixes (exit code: $LASTEXITCODE)"
            Write-Error "Fix output saved to: $fixOutput"
            return $false
        }
    } finally {
        Pop-Location
    }
}

# Commit changes
function Save-Changes {
    param([int]$RunNumber)
    
    if ($script:SKIP_COMMIT) {
        Write-Warn "Skipping commit step (configured in skipSteps)"
        return $true
    }
    
    Write-Info "Committing changes..."
    
    Push-Location $PROJECT_ROOT
    
    try {
        $status = git status --porcelain
        if (-not $status) {
            Write-Warn "No changes to commit"
            return $true
        }
        
        $commitMsg = $script:COMMIT_MESSAGE_TEMPLATE -replace '\{runNumber\}', $RunNumber -replace '\{errorSummary\}', "Workflow error fixes"
        
        if ($script:FIX_STRATEGY -eq "review" -or $script:FIX_STRATEGY -eq "auto-with-review") {
            Write-Info "Changes to be committed:"
            git diff --stat
            Write-Info "Diff:"
            git diff
            
            if ($script:FIX_STRATEGY -eq "review") {
                $response = Read-Host "Commit these changes? (y/n)"
                if ($response -ne "y" -and $response -ne "Y") {
                    Write-Warn "Commit cancelled by user"
                    return $false
                }
            }
        }
        
        git add -A
        git commit -m $commitMsg
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Changes committed: $commitMsg"
            return $true
        } else {
            Write-Error "Failed to commit changes"
            return $false
        }
    } finally {
        Pop-Location
    }
}

# Push changes
function Publish-Changes {
    Write-Info "Pushing changes..."
    
    Push-Location $PROJECT_ROOT
    
    try {
        $currentBranch = git branch --show-current
        $targetBranch = if ($script:BRANCH) { $script:BRANCH } else { $currentBranch }
        
        if ($targetBranch -ne $currentBranch) {
            Write-Info "Switching to branch: $targetBranch"
            git checkout $targetBranch
        }
        
        git push origin $targetBranch
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Changes pushed to $targetBranch"
            return $true
        } else {
            Write-Error "Failed to push changes"
            return $false
        }
    } finally {
        Pop-Location
    }
}

# Main function
function Main {
    Write-Info "Starting workflow retry script"
    Write-Info "Log file: $LOG_FILE"
    
    Test-Prerequisites
    Load-Config -ConfigPath $ConfigFile
    Get-RepoInfo
    
    $runNumber = 1
    $lastRunId = ""
    
    while ($runNumber -le $script:MAX_RETRIES) {
        Write-Info "=== Attempt $runNumber/$script:MAX_RETRIES ==="
        
        $runId = Start-Workflow -RunNumber $runNumber
        if (-not $runId) {
            Write-Error "Failed to trigger workflow"
            exit 1
        }
        
        $lastRunId = $runId
        Write-Info "Workflow run ID: $runId"
        
        $statusResult = Wait-Workflow -RunId $runId
        $statusParts = $statusResult -split '/'
        $status = $statusParts[0]
        $conclusion = $statusParts[1]
        
        Write-Info "Workflow completed with status: $status, conclusion: $conclusion"
        
        if ($conclusion -eq "success") {
            Write-Success "Workflow succeeded on attempt $runNumber!"
            Write-Success "Run ID: $runId"
            Write-Success "View run: https://github.com/$script:REPO/actions/runs/$runId"
            exit 0
        }
        
        if ($conclusion -eq "failure" -or $conclusion -eq "cancelled") {
            Write-Warn "Workflow failed with conclusion: $conclusion"
            
            $errorFile = Get-WorkflowErrors -RunId $runId
            Write-Info "Error details saved to: $errorFile"
            
            if (-not (Invoke-Fixes -ErrorFile $errorFile -RunNumber $runNumber)) {
                Write-Error "Failed to apply fixes, continuing anyway..."
            }
            
            if (-not (Save-Changes -RunNumber $runNumber)) {
                Write-Warn "Failed to commit changes or no changes to commit"
            }
            
            if (-not (Publish-Changes)) {
                Write-Error "Failed to push changes"
                Write-Error "Please push manually and retry"
                exit 1
            }
            
            Write-Info "Waiting 5 seconds before next attempt..."
            Start-Sleep -Seconds 5
        } else {
            Write-Error "Unexpected workflow conclusion: $conclusion"
            exit 1
        }
        
        $runNumber++
    }
    
    Write-Error "Maximum retries ($script:MAX_RETRIES) reached. Workflow did not succeed."
    Write-Error "Last run ID: $lastRunId"
    Write-Error "View last run: https://github.com/$script:REPO/actions/runs/$lastRunId"
    exit 1
}

# Run main
Main

