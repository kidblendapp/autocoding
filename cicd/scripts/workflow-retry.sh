#!/bin/bash
set -euo pipefail

# Workflow Retry Script with AI-Powered Auto-Fix
# This script runs a GitHub Actions workflow, monitors it, and uses cursor-agent
# to automatically fix errors until the workflow succeeds or max retries is reached.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CONFIG_FILE="${1:-${SCRIPT_DIR}/workflow-retry-config.json}"
LOG_DIR="${PROJECT_ROOT}/.workflow-retry-logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/workflow-retry_${TIMESTAMP}.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "[${timestamp}] [${level}] ${message}" | tee -a "${LOG_FILE}"
}

log_info() {
    log "INFO" "${BLUE}$*${NC}"
}

log_success() {
    log "SUCCESS" "${GREEN}$*${NC}"
}

log_warn() {
    log "WARN" "${YELLOW}$*${NC}"
}

log_error() {
    log "ERROR" "${RED}$*${NC}"
}

log_debug() {
    if [[ "${LOG_LEVEL}" == "debug" ]] || [[ "${LOG_LEVEL}" == "verbose" ]]; then
        log "DEBUG" "$*"
    fi
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local missing=()
    
    if ! command -v gh >/dev/null 2>&1; then
        missing+=("gh (GitHub CLI)")
    fi
    
    if ! command -v jq >/dev/null 2>&1; then
        missing+=("jq")
    fi
    
    if ! command -v cursor-agent >/dev/null 2>&1; then
        missing+=("cursor-agent")
    fi
    
    if ! gh auth status >/dev/null 2>&1; then
        log_error "GitHub CLI is not authenticated. Run 'gh auth login'"
        exit 1
    fi
    
    if [ ${#missing[@]} -gt 0 ]; then
        log_error "Missing required tools: ${missing[*]}"
        exit 1
    fi
    
    log_success "All prerequisites met"
}

# Load configuration
load_config() {
    log_info "Loading configuration from: ${CONFIG_FILE}"
    
    if [ ! -f "${CONFIG_FILE}" ]; then
        log_error "Configuration file not found: ${CONFIG_FILE}"
        exit 1
    fi
    
    # Load config with defaults
    WORKFLOW=$(jq -r '.workflow // empty' "${CONFIG_FILE}")
    WORKFLOW_INPUTS=$(jq -c '.workflowInputs // {}' "${CONFIG_FILE}")
    MAX_RETRIES=$(jq -r '.maxRetries // 10' "${CONFIG_FILE}")
    WAIT_TIMEOUT=$(jq -r '.waitTimeout // 3600' "${CONFIG_FILE}")
    POLL_INTERVAL=$(jq -r '.pollInterval // 10' "${CONFIG_FILE}")
    FIX_STRATEGY=$(jq -r '.fixStrategy // "auto"' "${CONFIG_FILE}")
    COMMIT_MESSAGE_TEMPLATE=$(jq -r '.commitMessage // "fix: Auto-fix workflow errors (run {runNumber})"' "${CONFIG_FILE}")
    BRANCH=$(jq -r '.branch // empty' "${CONFIG_FILE}")
    LOG_LEVEL=$(jq -r '.logLevel // "normal"' "${CONFIG_FILE}")
    
    # Cursor agent options
    CURSOR_MODEL=$(jq -r '.cursorAgentOptions.model // "auto"' "${CONFIG_FILE}")
    CURSOR_FORCE=$(jq -r '.cursorAgentOptions.force // true' "${CONFIG_FILE}")
    CURSOR_ADDITIONAL_ARGS=$(jq -r '.cursorAgentOptions.additionalArgs // [] | join(" ")' "${CONFIG_FILE}")
    
    # Skip steps
    SKIP_FIX=$(jq -r '.skipSteps // [] | contains(["fix"])' "${CONFIG_FILE}")
    SKIP_COMMIT=$(jq -r '.skipSteps // [] | contains(["commit"])' "${CONFIG_FILE}")
    SKIP_PUSH=$(jq -r '.skipSteps // [] | contains(["push"])' "${CONFIG_FILE}")
    
    if [ -z "${WORKFLOW}" ]; then
        log_error "Configuration must specify 'workflow'"
        exit 1
    fi
    
    log_success "Configuration loaded"
    log_debug "Workflow: ${WORKFLOW}"
    log_debug "Max retries: ${MAX_RETRIES}"
    log_debug "Fix strategy: ${FIX_STRATEGY}"
}

# Get repository info
get_repo_info() {
    REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
    if [ -z "${REPO}" ]; then
        log_error "Could not determine repository. Are you in a git repository?"
        exit 1
    fi
    log_debug "Repository: ${REPO}"
}

# Trigger workflow
trigger_workflow() {
    local run_number=$1
    log_info "Triggering workflow: ${WORKFLOW} (attempt ${run_number})"
    
    # Build gh workflow run command
    local cmd="gh workflow run ${WORKFLOW}"
    
    # Add inputs if provided
    if [ "${WORKFLOW_INPUTS}" != "{}" ] && [ -n "${WORKFLOW_INPUTS}" ]; then
        # Parse inputs and add them
        local inputs_json="${WORKFLOW_INPUTS}"
        while IFS= read -r line; do
            local key=$(echo "${line}" | cut -d'"' -f2)
            local value=$(echo "${line}" | jq -r ".[\"${key}\"]" <<< "${inputs_json}")
            if [ "${value}" != "null" ] && [ -n "${value}" ]; then
                cmd="${cmd} -f ${key}=\"${value}\""
            fi
        done < <(echo "${inputs_json}" | jq -r 'keys[]')
    fi
    
    log_debug "Command: ${cmd}"
    
    # Execute and capture run ID
    local output
    output=$(eval "${cmd}" 2>&1)
    local exit_code=$?
    
    if [ $exit_code -ne 0 ]; then
        log_error "Failed to trigger workflow: ${output}"
        return 1
    fi
    
    # Wait a moment for the run to be created
    sleep 2
    
    # Get the run ID
    local run_id
    run_id=$(gh run list --workflow="${WORKFLOW}" --limit 1 --json databaseId -q '.[0].databaseId' 2>/dev/null || echo "")
    
    if [ -z "${run_id}" ]; then
        log_error "Could not get run ID after triggering workflow"
        return 1
    fi
    
    echo "${run_id}"
}

# Wait for workflow completion
wait_for_workflow() {
    local run_id=$1
    local start_time=$(date +%s)
    local elapsed=0
    
    log_info "Waiting for workflow run ${run_id} to complete..."
    
    while [ $elapsed -lt $WAIT_TIMEOUT ]; do
        local status
        status=$(gh run view "${run_id}" --json status,conclusion -q '.status + "/" + (.conclusion // "none")' 2>/dev/null || echo "unknown/unknown")
        
        log_debug "Workflow status: ${status}"
        
        if [[ "${status}" == *"/failure"* ]] || [[ "${status}" == *"/cancelled"* ]] || [[ "${status}" == *"/success"* ]]; then
            echo "${status}"
            return 0
        fi
        
        if [[ "${status}" == "unknown"* ]]; then
            log_warn "Could not get workflow status, retrying..."
        fi
        
        sleep "${POLL_INTERVAL}"
        elapsed=$(($(date +%s) - start_time))
        
        if [ $((elapsed % 60)) -eq 0 ]; then
            log_info "Still waiting... (${elapsed}s elapsed)"
        fi
    done
    
    log_error "Workflow timed out after ${WAIT_TIMEOUT} seconds"
    echo "timeout/unknown"
    return 1
}

# Extract workflow logs and errors
extract_workflow_errors() {
    local run_id=$1
    local error_file="${LOG_DIR}/errors_${run_id}.txt"
    
    log_info "Extracting workflow logs and errors..."
    
    # Get failed job
    local job_id
    job_id=$(gh run view "${run_id}" --json jobs -q '.[] | select(.conclusion == "failure") | .databaseId' | head -1)
    
    if [ -z "${job_id}" ]; then
        # Try to get any job
        job_id=$(gh run view "${run_id}" --json jobs -q '.[0].databaseId' 2>/dev/null || echo "")
    fi
    
    if [ -z "${job_id}" ]; then
        log_warn "Could not get job ID, extracting from run logs"
        gh run view "${run_id}" --log > "${error_file}" 2>&1 || true
    else
        log_debug "Extracting logs from job ${job_id}"
        gh run view "${run_id}" --log > "${error_file}" 2>&1 || true
    fi
    
    # Also try to get a summary
    local summary_file="${LOG_DIR}/summary_${run_id}.txt"
    {
        echo "=== Workflow Run Summary ==="
        echo "Run ID: ${run_id}"
        echo "Repository: ${REPO}"
        echo "Workflow: ${WORKFLOW}"
        echo ""
        echo "=== Status ==="
        gh run view "${run_id}" --json status,conclusion,displayTitle,event -q '.[]' 2>/dev/null || echo "Could not get status"
        echo ""
        echo "=== Failed Steps ==="
        gh run view "${run_id}" --json jobs -q '.[] | select(.conclusion == "failure") | "Job: \(.name) - \(.conclusion)"' 2>/dev/null || echo "Could not get failed jobs"
        echo ""
        echo "=== Error Logs (last 100 lines) ==="
        tail -100 "${error_file}" 2>/dev/null || echo "Could not read error logs"
    } > "${summary_file}"
    
    echo "${summary_file}"
}

# Generate fix prompt for cursor-agent
generate_fix_prompt() {
    local error_file=$1
    local run_number=$2
    
    local prompt="The GitHub Actions workflow '${WORKFLOW}' failed on run ${run_number}. "
    prompt+="Please analyze the error logs and fix the issues in the codebase. "
    prompt+="The error details are in the file: ${error_file}. "
    prompt+="Review the workflow file and related code, identify the root cause, and make the necessary fixes. "
    prompt+="After making changes, ensure the fixes are correct and the code follows best practices. "
    prompt+="Focus on the specific errors shown in the logs."
    
    # Add error pattern context if available
    if [ -f "${error_file}" ]; then
        local error_content
        error_content=$(cat "${error_file}" 2>/dev/null || echo "")
        
        # Check against configured error patterns
        local pattern_count
        pattern_count=$(jq '.errorPatterns | length' "${CONFIG_FILE}" 2>/dev/null || echo "0")
        
        if [ "${pattern_count}" -gt 0 ]; then
            local i=0
            while [ $i -lt "${pattern_count}" ]; do
                local pattern_name
                local pattern
                local context
                pattern_name=$(jq -r ".errorPatterns[${i}].name" "${CONFIG_FILE}" 2>/dev/null || echo "")
                pattern=$(jq -r ".errorPatterns[${i}].pattern" "${CONFIG_FILE}" 2>/dev/null || echo "")
                context=$(jq -r ".errorPatterns[${i}].context" "${CONFIG_FILE}" 2>/dev/null || echo "")
                
                if [ -n "${pattern}" ] && echo "${error_content}" | grep -qE "${pattern}" 2>/dev/null; then
                    prompt+=" Detected error pattern: ${pattern_name}. ${context}"
                fi
                
                i=$((i + 1))
            done
        fi
    fi
    
    echo "${prompt}"
}

# Apply fixes using cursor-agent
apply_fixes() {
    local error_file=$1
    local run_number=$2
    
    if [ "${SKIP_FIX}" == "true" ]; then
        log_warn "Skipping fix step (configured in skipSteps)"
        return 0
    fi
    
    log_info "Generating fixes using cursor-agent..."
    
    local prompt
    prompt=$(generate_fix_prompt "${error_file}" "${run_number}")
    
    log_debug "Fix prompt: ${prompt}"
    
    # Build cursor-agent command
    local cursor_cmd="./cicd/scripts/run-cursor-agent.sh"
    if [ "${CURSOR_FORCE}" == "true" ]; then
        cursor_cmd="${cursor_cmd} --force"
    fi
    if [ -n "${CURSOR_MODEL}" ] && [ "${CURSOR_MODEL}" != "null" ]; then
        cursor_cmd="${cursor_cmd} --model ${CURSOR_MODEL}"
    fi
    if [ -n "${CURSOR_ADDITIONAL_ARGS}" ] && [ "${CURSOR_ADDITIONAL_ARGS}" != "null" ]; then
        cursor_cmd="${cursor_cmd} ${CURSOR_ADDITIONAL_ARGS}"
    fi
    
    cursor_cmd="${cursor_cmd} \"${prompt}\""
    
    log_debug "Executing: ${cursor_cmd}"
    
    cd "${PROJECT_ROOT}"
    
    local fix_output="${LOG_DIR}/fix_${run_number}.log"
    if eval "${cursor_cmd}" > "${fix_output}" 2>&1; then
        log_success "Fixes applied successfully"
        return 0
    else
        local exit_code=$?
        log_error "Failed to apply fixes (exit code: ${exit_code})"
        log_error "Fix output saved to: ${fix_output}"
        return 1
    fi
}

# Commit changes
commit_changes() {
    local run_number=$1
    
    if [ "${SKIP_COMMIT}" == "true" ]; then
        log_warn "Skipping commit step (configured in skipSteps)"
        return 0
    fi
    
    log_info "Committing changes..."
    
    cd "${PROJECT_ROOT}"
    
    # Check if there are changes to commit
    if git diff --quiet && git diff --cached --quiet; then
        log_warn "No changes to commit"
        return 0
    fi
    
    # Generate commit message
    local commit_msg
    commit_msg=$(echo "${COMMIT_MESSAGE_TEMPLATE}" | sed "s/{runNumber}/${run_number}/g" | sed "s/{errorSummary}/Workflow error fixes/g")
    
    # Show what will be committed
    if [ "${FIX_STRATEGY}" == "review" ] || [ "${FIX_STRATEGY}" == "auto-with-review" ]; then
        log_info "Changes to be committed:"
        git diff --stat
        echo ""
        log_info "Diff:"
        git diff
        echo ""
        
        if [ "${FIX_STRATEGY}" == "review" ]; then
            log_warn "Review mode: Waiting for manual approval..."
            read -p "Commit these changes? (y/n): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_warn "Commit cancelled by user"
                return 1
            fi
        fi
    fi
    
    # Stage all changes
    git add -A
    
    # Commit
    if git commit -m "${commit_msg}"; then
        log_success "Changes committed: ${commit_msg}"
        return 0
    else
        log_error "Failed to commit changes"
        return 1
    fi
}

# Push changes
push_changes() {
    if [ "${SKIP_PUSH}" == "true" ]; then
        log_warn "Skipping push step (configured in skipSteps)"
        return 0
    fi
    
    log_info "Pushing changes..."
    
    cd "${PROJECT_ROOT}"
    
    # Determine branch
    local current_branch
    current_branch=$(git branch --show-current)
    local target_branch="${BRANCH:-${current_branch}}"
    
    if [ "${target_branch}" != "${current_branch}" ]; then
        log_info "Switching to branch: ${target_branch}"
        git checkout "${target_branch}" || git checkout -b "${target_branch}"
    fi
    
    # Push
    if git push origin "${target_branch}"; then
        log_success "Changes pushed to ${target_branch}"
        return 0
    else
        log_error "Failed to push changes"
        return 1
    fi
}

# Main retry loop
main() {
    # Setup
    mkdir -p "${LOG_DIR}"
    log_info "Starting workflow retry script"
    log_info "Log file: ${LOG_FILE}"
    
    check_prerequisites
    load_config
    get_repo_info
    
    local run_number=1
    local last_run_id=""
    
    while [ $run_number -le $MAX_RETRIES ]; do
        log_info "=== Attempt ${run_number}/${MAX_RETRIES} ==="
        
        # Trigger workflow
        local run_id
        if ! run_id=$(trigger_workflow "${run_number}"); then
            log_error "Failed to trigger workflow"
            exit 1
        fi
        
        last_run_id="${run_id}"
        log_info "Workflow run ID: ${run_id}"
        
        # Wait for completion
        local status_result
        status_result=$(wait_for_workflow "${run_id}")
        local status=$(echo "${status_result}" | cut -d'/' -f1)
        local conclusion=$(echo "${status_result}" | cut -d'/' -f2)
        
        log_info "Workflow completed with status: ${status}, conclusion: ${conclusion}"
        
        # Check if successful
        if [ "${conclusion}" == "success" ]; then
            log_success "Workflow succeeded on attempt ${run_number}!"
            log_success "Run ID: ${run_id}"
            log_success "View run: https://github.com/${REPO}/actions/runs/${run_id}"
            exit 0
        fi
        
        # If failed, extract errors and fix
        if [ "${conclusion}" == "failure" ] || [ "${conclusion}" == "cancelled" ]; then
            log_warn "Workflow failed with conclusion: ${conclusion}"
            
            # Extract errors
            local error_file
            error_file=$(extract_workflow_errors "${run_id}")
            log_info "Error details saved to: ${error_file}"
            
            # Apply fixes
            if ! apply_fixes "${error_file}" "${run_number}"; then
                log_error "Failed to apply fixes, continuing anyway..."
            fi
            
            # Commit changes
            if ! commit_changes "${run_number}"; then
                log_warn "Failed to commit changes or no changes to commit"
            fi
            
            # Push changes
            if ! push_changes; then
                log_error "Failed to push changes"
                log_error "Please push manually and retry"
                exit 1
            fi
            
            # Wait a bit before next attempt
            log_info "Waiting 5 seconds before next attempt..."
            sleep 5
        else
            log_error "Unexpected workflow conclusion: ${conclusion}"
            exit 1
        fi
        
        run_number=$((run_number + 1))
    done
    
    log_error "Maximum retries (${MAX_RETRIES}) reached. Workflow did not succeed."
    log_error "Last run ID: ${last_run_id}"
    log_error "View last run: https://github.com/${REPO}/actions/runs/${last_run_id}"
    exit 1
}

# Run main function
main "$@"

