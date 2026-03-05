# JIRA dmtools verification runner. Run from repo root.
# Uses env: JIRA_VERIFY_PROJECT, JIRA_VERIFY_TICKET (optional), JIRA_VERIFY_EMAIL (optional)
# Or load from config.env in this folder if present.

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Get-Item $ScriptDir).Parent.Parent.FullName

# Load config.env if present
$configPath = Join-Path $ScriptDir "config.env"
if (Test-Path $configPath) {
    Get-Content $configPath | ForEach-Object {
        if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2].Trim(), "Process")
        }
    }
}

$ProjectKey = $env:JIRA_VERIFY_PROJECT
$TicketKey = $env:JIRA_VERIFY_TICKET
$VerifyEmail = $env:JIRA_VERIFY_EMAIL

# Load JIRA_BASE_PATH and JIRA_EMAIL from dmtools.env when not already in env
$dmtoolsEnvPath = Join-Path $RepoRoot "dmtools.env"
if (Test-Path $dmtoolsEnvPath) {
    Get-Content $dmtoolsEnvPath | ForEach-Object {
        if (-not $env:JIRA_BASE_PATH -and $_ -match '^\s*JIRA_BASE_PATH\s*=\s*(.+)$') { $env:JIRA_BASE_PATH = $matches[1].Trim().Trim('"') }
        if (-not $env:JIRA_EMAIL -and $_ -match '^\s*JIRA_EMAIL\s*=\s*(.+)$') { $env:JIRA_EMAIL = $matches[1].Trim().Trim('"') }
    }
}
if (-not $VerifyEmail -and $env:JIRA_EMAIL) { $VerifyEmail = $env:JIRA_EMAIL }

$ResultsFile = Join-Path $ScriptDir "results.md"
$LogFile = Join-Path $ScriptDir "run.log"

# Ensure we run from repo root so dmtools.env is found
Set-Location $RepoRoot

function Log-Cmd {
    param([string]$Name, [int]$ExitCode, [string]$Status, [string]$Reason)
    $line = "| $Name | $ExitCode | $Status | $Reason |"
    Add-Content -Path $ResultsFile -Value $line
}

$DmtoolsExe = (Get-Command dmtools -ErrorAction SilentlyContinue).Source
if (-not $DmtoolsExe) { $DmtoolsExe = "dmtools" }

function Run-Dmtools {
    param([string[]]$Args)
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $DmtoolsExe
    $psi.Arguments = $Args
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $psi.WorkingDirectory = $RepoRoot
    $p = [System.Diagnostics.Process]::Start($psi)
    $stdout = $p.StandardOutput.ReadToEnd()
    $stderr = $p.StandardError.ReadToEnd()
    $p.WaitForExit()
    return @{ ExitCode = $p.ExitCode; Stdout = $stdout; Stderr = $stderr }
}

# Initialize results
@"
# JIRA dmtools verification results

Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

## Config
- JIRA_VERIFY_PROJECT: $ProjectKey
- JIRA_VERIFY_TICKET: $TicketKey
- JIRA_VERIFY_EMAIL: (set if used)

## Results

| Command | ExitCode | Status | Notes |
|---------|----------|--------|-------|
"@ | Set-Content -Path $ResultsFile

$createdTicketKey = $null

try {
    # --- Pre-check ---
    $r = Run-Dmtools @("--version")
    if ($r.ExitCode -eq 0) { Log-Cmd "dmtools --version" $r.ExitCode "ok" "CLI available" } else { Log-Cmd "dmtools --version" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }

    $r = Run-Dmtools @("jira_get_my_profile")
    if ($r.ExitCode -eq 0) { Log-Cmd "jira_get_my_profile" $r.ExitCode "ok" "auth OK" } else { Log-Cmd "jira_get_my_profile" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }

    $myProfileJson = $null
    $userId = $null
    if ($r.ExitCode -eq 0 -and $r.Stdout) {
        if ($r.Stdout -match '"accountId"\s*:\s*"([^"]+)"') { $userId = $matches[1] }
        $myProfileJson = $r.Stdout | ConvertFrom-Json -ErrorAction SilentlyContinue
        if (-not $userId -and $myProfileJson) {
            if ($myProfileJson.accountId) { $userId = $myProfileJson.accountId }
            elseif ($myProfileJson.AccountId) { $userId = $myProfileJson.AccountId }
            elseif ($myProfileJson.result -and $myProfileJson.result.accountId) { $userId = $myProfileJson.result.accountId }
            elseif ($myProfileJson.key) { $userId = $myProfileJson.key }
        }
    }

    if (-not $ProjectKey) {
        Add-Content -Path $ResultsFile -Value "`n* All subsequent commands skipped: JIRA_VERIFY_PROJECT not set.`n"
        exit 0
    }

    # --- Profile (read) ---
    if ($VerifyEmail) {
        $r = Run-Dmtools @("jira_get_account_by_email", "`"$VerifyEmail`"")
        if ($r.ExitCode -eq 0) { Log-Cmd "jira_get_account_by_email" $r.ExitCode "ok" "" } else { Log-Cmd "jira_get_account_by_email" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }
    } else {
        Log-Cmd "jira_get_account_by_email" 0 "skipped" "JIRA_VERIFY_EMAIL not set"
    }

    if ($userId) {
        $r = Run-Dmtools @("jira_get_user_profile", "--data", "{`"userId`":`"$userId`"}")
        if ($r.ExitCode -eq 0) { Log-Cmd "jira_get_user_profile" $r.ExitCode "ok" "" } else { Log-Cmd "jira_get_user_profile" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }
    } else {
        Log-Cmd "jira_get_user_profile" 0 "skipped" "no accountId from profile"
    }

    # --- Metadata (read) ---
    $r = Run-Dmtools @("jira_get_issue_types", $ProjectKey)
    if ($r.ExitCode -eq 0) { Log-Cmd "jira_get_issue_types" $r.ExitCode "ok" "" } else { Log-Cmd "jira_get_issue_types" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }

    $r = Run-Dmtools @("jira_get_project_statuses", $ProjectKey)
    if ($r.ExitCode -eq 0) { Log-Cmd "jira_get_project_statuses" $r.ExitCode "ok" "" } else { Log-Cmd "jira_get_project_statuses" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }

    $r = Run-Dmtools @("jira_get_components", $ProjectKey)
    if ($r.ExitCode -eq 0) { Log-Cmd "jira_get_components" $r.ExitCode "ok" "" } else { Log-Cmd "jira_get_components" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }

    # --- Fields data (read) ---
    $r = Run-Dmtools @("jira_get_fields", $ProjectKey)
    if ($r.ExitCode -eq 0) { Log-Cmd "jira_get_fields" $r.ExitCode "ok" "" } else { Log-Cmd "jira_get_fields" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }

    $r = Run-Dmtools @("jira_get_field_custom_code", "--data", "{`"project`":`"$ProjectKey`",`"fieldName`":`"Summary`"}")
    if ($r.ExitCode -eq 0) { Log-Cmd "jira_get_field_custom_code" $r.ExitCode "ok" "" } else { Log-Cmd "jira_get_field_custom_code" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }

    $r = Run-Dmtools @("jira_get_all_fields_with_name", "--data", "{`"project`":`"$ProjectKey`",`"fieldName`":`"Summary`"}")
    if ($r.ExitCode -eq 0) { Log-Cmd "jira_get_all_fields_with_name" $r.ExitCode "ok" "" } else { Log-Cmd "jira_get_all_fields_with_name" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }

    # --- Search (read) ---
    $jql = "project = $ProjectKey"
    $r = Run-Dmtools @("jira_search_by_jql", $jql, "key,summary")
    if ($r.ExitCode -eq 0) { Log-Cmd "jira_search_by_jql" $r.ExitCode "ok" "" } else { Log-Cmd "jira_search_by_jql" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }

    $r = Run-Dmtools @("jira_search_by_page", "--data", "{`"jql`":`"$($jql.Replace('"','\"'))`",`"fields`":[`"key`"],`"nextPageToken`":`"`"}")
    if ($r.ExitCode -eq 0) { Log-Cmd "jira_search_by_page" $r.ExitCode "ok" "" } else { Log-Cmd "jira_search_by_page" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }

    $r = Run-Dmtools @("jira_search_with_pagination", "--data", "{`"jql`":`"$($jql.Replace('"','\"'))`",`"fields`":[`"key`"],`"startAt`":0}")
    if ($r.ExitCode -eq 0) { Log-Cmd "jira_search_with_pagination" $r.ExitCode "ok" "" } else { Log-Cmd "jira_search_with_pagination" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }

    # Resolve a ticket key for read tests if not provided
    $ticketForRead = $TicketKey
    if (-not $ticketForRead) {
        $searchResult = Run-Dmtools @("jira_search_by_jql", $jql, "key")
        if ($searchResult.ExitCode -eq 0 -and $searchResult.Stdout) {
            $parsed = $searchResult.Stdout | ConvertFrom-Json -ErrorAction SilentlyContinue
            if ($parsed.result -and $parsed.result.Count -gt 0 -and $parsed.result[0].key) { $ticketForRead = $parsed.result[0].key }
            elseif ($parsed.issues -and $parsed.issues.Count -gt 0) { $ticketForRead = $parsed.issues[0].key }
            elseif ($parsed.issues -and $parsed.issues.Count -gt 0 -and $parsed.issues[0].Key) { $ticketForRead = $parsed.issues[0].Key }
            elseif ($parsed -is [Array] -and $parsed.Count -gt 0 -and $parsed[0].key) { $ticketForRead = $parsed[0].key }
            elseif ($parsed.result -and $parsed.result[0]) { $ticketForRead = $parsed.result[0].key }
            if (-not $ticketForRead -and $searchResult.Stdout -match '"key"\s*:\s*"([A-Za-z]+-\d+)"') { $ticketForRead = $matches[1] }
        }
    }

    # --- Tickets-read ---
    if ($ticketForRead) {
        $r = Run-Dmtools @("jira_get_ticket", $ticketForRead)
        if ($r.ExitCode -eq 0) { Log-Cmd "jira_get_ticket" $r.ExitCode "ok" "" } else { Log-Cmd "jira_get_ticket" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }

        $r = Run-Dmtools @("jira_get_subtasks", $ticketForRead)
        if ($r.ExitCode -eq 0) { Log-Cmd "jira_get_subtasks" $r.ExitCode "ok" "" } else { Log-Cmd "jira_get_subtasks" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }

        $r = Run-Dmtools @("jira_get_comments", $ticketForRead)
        if ($r.ExitCode -eq 0) { Log-Cmd "jira_get_comments" $r.ExitCode "ok" "" } else { Log-Cmd "jira_get_comments" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }

        $r = Run-Dmtools @("jira_get_transitions", $ticketForRead)
        if ($r.ExitCode -eq 0) { Log-Cmd "jira_get_transitions" $r.ExitCode "ok" "" } else { Log-Cmd "jira_get_transitions" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }
    } else {
        Log-Cmd "jira_get_ticket" 0 "skipped" "no ticket key"
        Log-Cmd "jira_get_subtasks" 0 "skipped" "no ticket key"
        Log-Cmd "jira_get_comments" 0 "skipped" "no ticket key"
        Log-Cmd "jira_get_transitions" 0 "skipped" "no ticket key"
    }

    # --- Links (read) ---
    $r = Run-Dmtools @("jira_get_issue_link_types")
    if ($r.ExitCode -eq 0) { Log-Cmd "jira_get_issue_link_types" $r.ExitCode "ok" "" } else { Log-Cmd "jira_get_issue_link_types" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }

    # --- Fix versions (read) ---
    $r = Run-Dmtools @("jira_get_fix_versions", $ProjectKey)
    if ($r.ExitCode -eq 0) { Log-Cmd "jira_get_fix_versions" $r.ExitCode "ok" "" } else { Log-Cmd "jira_get_fix_versions" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }

    # --- Advanced (read) ---
    $basePath = $env:JIRA_BASE_PATH
    if ($basePath -and $ticketForRead) {
        $url = "$($basePath.TrimEnd('/'))/rest/api/3/issue/$ticketForRead"
        $r = Run-Dmtools @("jira_execute_request", "--data", "{`"url`":`"$url`"}")
        if ($r.ExitCode -eq 0) { Log-Cmd "jira_execute_request" $r.ExitCode "ok" "" } else { Log-Cmd "jira_execute_request" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }
    } else {
        Log-Cmd "jira_execute_request" 0 "skipped" "no JIRA_BASE_PATH or ticket"
    }

    # --- Mutating: use provided ticket or create one ---
    $testTicketKey = $TicketKey
    if (-not $testTicketKey) {
        $r = Run-Dmtools @("jira_create_ticket_basic", "Task", "dmtools-verify-test", $ProjectKey, "Created by run-verify.ps1 for command verification.")
        if ($r.ExitCode -eq 0 -and $r.Stdout) {
            $created = $r.Stdout | ConvertFrom-Json -ErrorAction SilentlyContinue
            if ($created -and -not $created.error) {
                if ($created.key) { $testTicketKey = $created.key; $createdTicketKey = $created.key }
                elseif ($created.result -and $created.result.key) { $testTicketKey = $created.result.key; $createdTicketKey = $created.result.key }
            }
            if (-not $testTicketKey -and $r.Stdout -match '"key"\s*:\s*"([A-Za-z]+-\d+)"') { $testTicketKey = $matches[1]; $createdTicketKey = $matches[1] }
        }
        if ($r.ExitCode -eq 0) { Log-Cmd "jira_create_ticket_basic" $r.ExitCode "ok" "created $testTicketKey" } else { Log-Cmd "jira_create_ticket_basic" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }
    } else {
        Log-Cmd "jira_create_ticket_basic" 0 "skipped" "using existing JIRA_VERIFY_TICKET"
    }

    if ($testTicketKey) {
        # Comments (write)
        $r = Run-Dmtools @("jira_post_comment", $testTicketKey, "dmtools verify comment")
        if ($r.ExitCode -eq 0) { Log-Cmd "jira_post_comment" $r.ExitCode "ok" "" } else { Log-Cmd "jira_post_comment" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }

        $r = Run-Dmtools @("jira_post_comment_if_not_exists", "--data", "{`"key`":`"$testTicketKey`",`"comment`":`"dmtools verify idempotent`"}")
        if ($r.ExitCode -eq 0) { Log-Cmd "jira_post_comment_if_not_exists" $r.ExitCode "ok" "" } else { Log-Cmd "jira_post_comment_if_not_exists" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }

        # Ticket update
        $r = Run-Dmtools @("jira_update_description", "--data", "{`"key`":`"$testTicketKey`",`"description`":`"Updated by verify script`"}")
        if ($r.ExitCode -eq 0) { Log-Cmd "jira_update_description" $r.ExitCode "ok" "" } else { Log-Cmd "jira_update_description" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }

        $r = Run-Dmtools @("jira_update_field", "--data", "{`"key`":`"$testTicketKey`",`"field`":`"priority`",`"value`":{`"name`":`"Medium`"}}")
        if ($r.ExitCode -eq 0) { Log-Cmd "jira_update_field" $r.ExitCode "ok" "" } else { Log-Cmd "jira_update_field" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }

        # Workflow (may fail if no transition to In Progress etc.)
        $r = Run-Dmtools @("jira_move_to_status", "--data", "{`"key`":`"$testTicketKey`",`"statusName`":`"In Progress`"}")
        if ($r.ExitCode -eq 0) { Log-Cmd "jira_move_to_status" $r.ExitCode "ok" "" } else { Log-Cmd "jira_move_to_status" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }

        if ($userId) {
            $r = Run-Dmtools @("jira_assign_ticket_to", "--data", "{`"key`":`"$testTicketKey`",`"accountId`":`"$userId`"}")
            if ($r.ExitCode -eq 0) { Log-Cmd "jira_assign_ticket_to" $r.ExitCode "ok" "" } else { Log-Cmd "jira_assign_ticket_to" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }
        } else { Log-Cmd "jira_assign_ticket_to" 0 "skipped" "no accountId" }

        # Fix versions (write) - only if project has versions
        $fv = Run-Dmtools @("jira_get_fix_versions", $ProjectKey)
        $fixVer = $null
        if ($fv.ExitCode -eq 0 -and $fv.Stdout) {
            $fvList = $fv.Stdout | ConvertFrom-Json -ErrorAction SilentlyContinue
            if ($fvList -is [Array] -and $fvList.Count -gt 0 -and $fvList[0].name) { $fixVer = $fvList[0].name }
            elseif ($fvList -and $fvList.values -and $fvList.values.Count -gt 0) { $fixVer = $fvList.values[0].name }
        }
        if ($fixVer) {
            $r = Run-Dmtools @("jira_set_fix_version", "--data", "{`"key`":`"$testTicketKey`",`"fixVersion`":`"$fixVer`"}")
            if ($r.ExitCode -eq 0) { Log-Cmd "jira_set_fix_version" $r.ExitCode "ok" "" } else { Log-Cmd "jira_set_fix_version" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }
            $r = Run-Dmtools @("jira_remove_fix_version", "--data", "{`"key`":`"$testTicketKey`",`"fixVersion`":`"$fixVer`"}")
            if ($r.ExitCode -eq 0) { Log-Cmd "jira_remove_fix_version" $r.ExitCode "ok" "" } else { Log-Cmd "jira_remove_fix_version" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }
        } else {
            Log-Cmd "jira_set_fix_version" 0 "skipped" "no fix versions in project"
            Log-Cmd "jira_remove_fix_version" 0 "skipped" "no fix versions"
        }
        $r = Run-Dmtools @("jira_add_fix_version", "--data", "{`"key`":`"$testTicketKey`",`"fixVersion`":`"1.0.0`"}")
        if ($r.ExitCode -eq 0) { Log-Cmd "jira_add_fix_version" $r.ExitCode "ok" "" } else { Log-Cmd "jira_add_fix_version" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }

        # Links / labels / priority
        $r = Run-Dmtools @("jira_add_label", $testTicketKey, "dmtools-verify")
        if ($r.ExitCode -eq 0) { Log-Cmd "jira_add_label" $r.ExitCode "ok" "" } else { Log-Cmd "jira_add_label" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }

        $r = Run-Dmtools @("jira_set_priority", "--data", "{`"key`":`"$testTicketKey`",`"priority`":`"Low`"}")
        if ($r.ExitCode -eq 0) { Log-Cmd "jira_set_priority" $r.ExitCode "ok" "" } else { Log-Cmd "jira_set_priority" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }

        # Attachments
        $testFilePath = Join-Path $ScriptDir "test.txt"
        "dmtools verify test file" | Set-Content -Path $testFilePath -NoNewline
        $absPath = (Resolve-Path $testFilePath).Path.Replace("\", "/")
        $r = Run-Dmtools @("jira_attach_file_to_ticket", "--data", "{`"name`":`"test.txt`",`"ticketKey`":`"$testTicketKey`",`"filePath`":`"$absPath`"}")
        if ($r.ExitCode -eq 0) { Log-Cmd "jira_attach_file_to_ticket" $r.ExitCode "ok" "" } else { Log-Cmd "jira_attach_file_to_ticket" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }

        $r = Run-Dmtools @("jira_get_ticket", $testTicketKey, "attachment")
        $attachHref = $null
        if ($r.ExitCode -eq 0 -and $r.Stdout) {
            $ticket = $r.Stdout | ConvertFrom-Json -ErrorAction SilentlyContinue
            $attachments = $ticket.fields.attachment
            if (-not $attachments -and $ticket.result -and $ticket.result.fields) { $attachments = $ticket.result.fields.attachment }
            if ($attachments -and $attachments.Count -gt 0) {
                $first = $attachments[0]
                if ($first.content) { $attachHref = $first.content }
                elseif ($first.self) { $attachHref = $first.self }
            }
        }
        if ($attachHref) {
            $r = Run-Dmtools @("jira_download_attachment", "--data", "{`"href`":`"$attachHref`"}")
            if ($r.ExitCode -eq 0) { Log-Cmd "jira_download_attachment" $r.ExitCode "ok" "" } else { Log-Cmd "jira_download_attachment" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }
        } else {
            Log-Cmd "jira_download_attachment" 0 "skipped" "no attachment href"
        }

        # Ticket update (other)
        $r = Run-Dmtools @("jira_update_ticket", "--data", "{`"key`":`"$testTicketKey`",`"params`":{`"summary`":`"dmtools-verify-test (updated)`"}}")
        if ($r.ExitCode -eq 0) { Log-Cmd "jira_update_ticket" $r.ExitCode "ok" "" } else { Log-Cmd "jira_update_ticket" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }

        # Create with JSON and with parent (optional, can skip to avoid clutter)
        $r = Run-Dmtools @("jira_create_ticket_with_json", "--data", "{`"project`":`"$ProjectKey`",`"fieldsJson`":{`"summary`":`"Verify JSON create`",`"issuetype`":{`"name`":`"Task`"}}}")
        if ($r.ExitCode -eq 0) { Log-Cmd "jira_create_ticket_with_json" $r.ExitCode "ok" "" } else { Log-Cmd "jira_create_ticket_with_json" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }

        $r = Run-Dmtools @("jira_create_ticket_with_parent", "--data", "{`"issueType`":`"Subtask`",`"summary`":`"Verify subtask`",`"project`":`"$ProjectKey`",`"description`":`"`",`"parentKey`":`"$testTicketKey`"}")
        if ($r.ExitCode -eq 0) { Log-Cmd "jira_create_ticket_with_parent" $r.ExitCode "ok" "" } else { Log-Cmd "jira_create_ticket_with_parent" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }

        # Xray (skip if not available)
        $r = Run-Dmtools @("jira_xray_search_tickets", "--data", "{`"searchQueryJQL`":`"project=$ProjectKey AND issueType=Test`"}")
        if ($r.ExitCode -eq 0) { Log-Cmd "jira_xray_search_tickets" $r.ExitCode "ok" "" } else { Log-Cmd "jira_xray_search_tickets" $r.ExitCode "fail/skip" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }

        # Delete only the ticket we created
        if ($createdTicketKey) {
            $r = Run-Dmtools @("jira_delete_ticket", $createdTicketKey)
            if ($r.ExitCode -eq 0) { Log-Cmd "jira_delete_ticket" $r.ExitCode "ok" "deleted $createdTicketKey" } else { Log-Cmd "jira_delete_ticket" $r.ExitCode "fail" $r.Stderr.Trim().Substring(0, [Math]::Min(80, $r.Stderr.Trim().Length)) }
        } else {
            Log-Cmd "jira_delete_ticket" 0 "skipped" "no ticket created by script"
        }
    }

} finally {
    Add-Content -Path $ResultsFile -Value "`n---"
    Add-Content -Path $ResultsFile -Value "`n## Summary"
    Add-Content -Path $ResultsFile -Value "See table above. Commands: ok = exit 0 and expected output; fail = non-zero or error; skipped = missing config or dependency. When a command fails, retry with positional args or fix \`--data\` JSON quoting; update the skill in \`.cursor/skills/jira-dmtools/commands/<group>/SKILL.md\` if the working form differs from the documented one."
    Add-Content -Path $ResultsFile -Value "`nDone."
}

Write-Host "Results written to $ResultsFile"
