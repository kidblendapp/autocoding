 #!/bin/bash
set -euo pipefail

# Workflow Retry Script with AI-Powered Auto-Fix
# This script runs a GitHub Actions workflow, monitors it, and uses cursor-agent
# to automatically fix errors until the workflow succeeds or max retries is reached.

# Show help if requested
if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
    cat <<EOF
Workflow Retry Script with AI-Powered Auto-Fix

Usage: $0 [config-file] [--skip-fix]

Arguments:
  config-file    Path to configuration JSON file (default: cicd/scripts/workflow-retry-config.json)
  --skip-fix      Skip the AI fix generation step (manual fixes only)

Examples:
  $0                                    # Use default config
  $0 /path/to/config.json              # Use custom config
  $0 --skip-fix                        # Skip AI fixes (manual fixes only)
  $0 --help                            # Show this help message

Prerequisites:
  - GitHub CLI (gh) installed and authenticated (run 'gh auth login')
  - jq installed
  - cursor-agent installed (optional if --skip-fix is used)
  - Git configured

Installing cursor-agent:
  # Windows (unofficial workaround):
  powershell -ExecutionPolicy Bypass -File cicd/scripts/install-cursor-agent-windows.ps1
  
  # Linux/macOS/WSL (official method):
  curl https://cursor.com/install -fsS | bash
  # Then ensure ~/.local/bin is in your PATH:
  export PATH="\$HOME/.local/bin:\$PATH"

For more information, see: cicd/scripts/README-workflow-retry.md
EOF
    exit 0
fi

# Get script directory early (needed for default config path)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check for --skip-fix flag
SKIP_FIX_FLAG=false
if [[ "${1:-}" == "--skip-fix" ]]; then
    SKIP_FIX_FLAG=true
    CONFIG_FILE="${2:-${SCRIPT_DIR}/workflow-retry-config.json}"
elif [[ "${2:-}" == "--skip-fix" ]]; then
    SKIP_FIX_FLAG=true
    CONFIG_FILE="${1:-${SCRIPT_DIR}/workflow-retry-config.json}"
else
    CONFIG_FILE="${1:-${SCRIPT_DIR}/workflow-retry-config.json}"
fi
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LOG_DIR="${PROJECT_ROOT}/.workflow-retry-logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/workflow-retry_${TIMESTAMP}.log"

# Ensure log directory exists early
mkdir -p "${LOG_DIR}" 2>/dev/null || true

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
    local log_line="[${timestamp}] [${level}] ${message}"
    # Output to stderr (so it doesn't interfere with command substitution) and append to log file
    echo -e "${log_line}" >&2
    echo -e "${log_line}" >> "${LOG_FILE}"
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

# Install cursor-agent if missing
install_cursor_agent() {
    log_info "Attempting to install cursor-agent..."
    
    # Check if we're on Windows and have the Windows workaround script
    if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]] || [[ -n "${WSL_DISTRO_NAME:-}" ]]; then
        if [[ -z "${WSL_DISTRO_NAME:-}" ]]; then
            # On Windows (not WSL), use Windows workaround script
            local windows_script="${SCRIPT_DIR}/install-cursor-agent-windows.ps1"
            if [ -f "${windows_script}" ]; then
                log_info "Using Windows workaround installation script..."
                log_warn "Please run manually: powershell -ExecutionPolicy Bypass -File ${windows_script}"
                log_warn "Or use WSL to install the Linux version"
                return 1
            fi
        fi
    fi
    
    # For Linux/macOS, try official installer
    log_info "Attempting to install via official installer..."
    log_warn "On Windows, use: powershell -ExecutionPolicy Bypass -File cicd/scripts/install-cursor-agent-windows.ps1"
    log_warn "On Linux/macOS, use: curl https://cursor.com/install -fsS | bash"
    
    # Fallback: Try direct installation with line ending fix
    log_info "Installing cursor-agent (fixing line endings)..."
    local temp_installer
    temp_installer=$(mktemp /tmp/cursor-install-XXXXXX.sh 2>/dev/null || mktemp cursor-install-XXXXXX.sh)
    
    if curl -fsSL https://cursor.com/install -o "${temp_installer}" 2>/dev/null; then
        # Fix line endings (remove \r)
        if command -v sed >/dev/null 2>&1; then
            sed -i 's/\r$//' "${temp_installer}" 2>/dev/null || \
            sed -i '' 's/\r$//' "${temp_installer}" 2>/dev/null || true
        fi
        
        chmod +x "${temp_installer}" 2>/dev/null || true
        
        if bash "${temp_installer}"; then
            rm -f "${temp_installer}"
            sleep 2
            export PATH="$HOME/.local/bin:$HOME/.cursor/bin:${PATH}"
            if command -v cursor-agent >/dev/null 2>&1; then
                log_success "cursor-agent installed successfully"
                return 0
            fi
        fi
        rm -f "${temp_installer}"
    fi
    
    log_warn "Could not install cursor-agent automatically"
    if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        if [[ -z "${WSL_DISTRO_NAME:-}" ]]; then
            log_warn "On Windows, try: powershell -ExecutionPolicy Bypass -File cicd/scripts/install-cursor-agent-windows.ps1"
        else
            log_warn "In WSL, try: curl https://cursor.com/install -fsS | bash"
        fi
    else
        log_warn "Try: curl https://cursor.com/install -fsS | bash"
    fi
    return 1
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local missing=()
    local errors=()
    local warnings=()
    
    # Check for required commands
    if ! command -v gh >/dev/null 2>&1; then
        missing+=("gh (GitHub CLI)")
        errors+=("GitHub CLI (gh) is not installed. Install from: https://cli.github.com/manual/installation")
    fi
    
    if ! command -v jq >/dev/null 2>&1; then
        missing+=("jq")
        errors+=("jq is not installed. Install from: https://stedolan.github.io/jq/download/")
    fi
    
    # Check for cursor-agent (required only if fix step is not skipped)
    # Check both the command-line flag and config value (if config was already loaded)
    local skip_fix_check=false
    if [ "${SKIP_FIX_FLAG}" = "true" ]; then
        skip_fix_check=true
    elif [ -n "${SKIP_FIX:-}" ] && [ "${SKIP_FIX}" = "true" ]; then
        skip_fix_check=true
    fi
    
    local cursor_agent_found=false
    if command -v cursor-agent >/dev/null 2>&1; then
        cursor_agent_found=true
    else
        # Check common installation locations
        local possible_paths=(
            "$HOME/.local/bin/cursor-agent"
            "$HOME/.cursor/bin/cursor-agent"
            "/usr/local/bin/cursor-agent"
        )
        
        for path in "${possible_paths[@]}"; do
            if [ -f "${path}" ] && [ -x "${path}" ]; then
                log_info "Found cursor-agent at: ${path}, adding to PATH"
                export PATH="$(dirname "${path}"):${PATH}"
                cursor_agent_found=true
                break
            fi
        done
    fi
    
    if [ "${cursor_agent_found}" = false ]; then
        # Check if fix step is skipped - if so, cursor-agent is optional
        if [ "${skip_fix_check}" = "true" ]; then
            log_warn "cursor-agent not found, but fix step is skipped - continuing without it"
        else
            missing+=("cursor-agent")
            warnings+=("cursor-agent is not installed or not in PATH")
            warnings+=("Installation options:")
            if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
                if [[ -z "${WSL_DISTRO_NAME:-}" ]]; then
                    warnings+=("  Windows: powershell -ExecutionPolicy Bypass -File cicd/scripts/install-cursor-agent-windows.ps1")
                    warnings+=("  Or use WSL: curl https://cursor.com/install -fsS | bash")
                else
                    warnings+=("  WSL: curl https://cursor.com/install -fsS | bash")
                fi
            else
                warnings+=("  Linux/macOS: curl https://cursor.com/install -fsS | bash")
            fi
            warnings+=("  After installation, ensure ~/.local/bin is in your PATH")
            warnings+=("  Or add 'skipSteps': ['fix'] to config, or use --skip-fix flag")
        fi
    fi
    
    # Check GitHub CLI authentication
    if command -v gh >/dev/null 2>&1; then
        if ! gh auth status >/dev/null 2>&1; then
            errors+=("GitHub CLI is not authenticated. Run 'gh auth login' to authenticate")
        fi
    fi
    
    # Report all errors
    if [ ${#missing[@]} -gt 0 ]; then
        log_error "Missing required tools: ${missing[*]}"
        for error in "${errors[@]}"; do
            log_error "  - ${error}"
        done
        for warning in "${warnings[@]}"; do
            log_warn "  - ${warning}"
        done
        echo ""
        
        # Offer to install cursor-agent if it's the only missing tool
        if [ ${#missing[@]} -eq 1 ] && [[ "${missing[0]}" == *"cursor-agent"* ]]; then
            log_info "Would you like to attempt automatic installation of cursor-agent? (y/n)"
            read -t 10 -r response || response="n"
            if [[ "${response}" =~ ^[Yy]$ ]]; then
                if install_cursor_agent; then
                    log_success "cursor-agent installed, continuing..."
                    # Remove from missing list
                    missing=()
                else
                    log_error "Automatic installation failed. Please install manually."
                    log_error "For help, run: $0 --help"
                    exit 1
                fi
            else
                log_error "Please install missing tools and try again."
                log_error "For help, run: $0 --help"
                exit 1
            fi
        else
            log_error "Please install missing tools and try again."
            log_error "For help, run: $0 --help"
            exit 1
        fi
    fi
    
    if [ ${#errors[@]} -gt 0 ]; then
        for error in "${errors[@]}"; do
            log_error "${error}"
        done
        echo ""
        log_error "Please fix the issues above and try again."
        exit 1
    fi
    
    log_success "All prerequisites met"
}

# Load configuration
load_config() {
    log_info "Loading configuration from: ${CONFIG_FILE}"
    
    if [ ! -f "${CONFIG_FILE}" ]; then
        log_error "Configuration file not found: ${CONFIG_FILE}"
        echo ""
        log_error "To create a configuration file:"
        log_error "  1. Copy the example: cp cicd/scripts/workflow-retry-config.example.json ${CONFIG_FILE}"
        log_error "  2. Edit the configuration file with your workflow settings"
        log_error "  3. Run the script again"
        echo ""
        log_error "For help, run: $0 --help"
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
    
    # Skip steps (command line flag overrides config)
    if [ "${SKIP_FIX_FLAG}" = "true" ]; then
        SKIP_FIX="true"
    else
        SKIP_FIX=$(jq -r '.skipSteps // [] | contains(["fix"])' "${CONFIG_FILE}")
    fi
    SKIP_COMMIT=$(jq -r '.skipSteps // [] | contains(["commit"])' "${CONFIG_FILE}")
    SKIP_PUSH=$(jq -r '.skipSteps // [] | contains(["push"])' "${CONFIG_FILE}")
    
    # Export SKIP_FIX for prerequisite check
    export SKIP_FIX
    
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
    
    # Get the run ID - try multiple times as it may take a moment to appear
    local run_id=""
    local attempts=0
    local max_attempts=5
    
    while [ $attempts -lt $max_attempts ] && [ -z "${run_id}" ]; do
        sleep 1
        run_id=$(gh run list --workflow="${WORKFLOW}" --limit 1 --json databaseId -q '.[0].databaseId' 2>/dev/null || echo "")
        attempts=$((attempts + 1))
    done
    
    # Clean run_id - ensure it's only numeric
    run_id=$(echo "${run_id}" | tr -d '\n\r' | grep -oE '[0-9]+' | head -1)
    
    if [ -z "${run_id}" ]; then
        log_error "Could not get run ID after triggering workflow (tried ${max_attempts} times)"
        log_error "Try running manually: gh run list --workflow=${WORKFLOW} --limit 1"
        return 1
    fi
    
    # Output only the run_id to stdout (for command substitution)
    echo "${run_id}"
}

# Wait for workflow completion
wait_for_workflow() {
    local run_id=$1
    local start_time=$(date +%s)
    local elapsed=0
    local retry_count=0
    local max_retries_before_error=3
    
    # Clean run_id - remove any non-numeric characters (in case log messages got captured)
    run_id=$(echo "${run_id}" | tr -d '\n\r' | grep -oE '[0-9]+' | head -1)
    
    if [ -z "${run_id}" ]; then
        log_error "Invalid run ID provided: ${1}"
        echo "error/invalid_id"
        return 1
    fi
    
    log_info "Waiting for workflow run ${run_id} to complete..."
    
    while [ $elapsed -lt $WAIT_TIMEOUT ]; do
        local status
        local gh_output
        gh_output=$(gh run view "${run_id}" --json status,conclusion -q '.status + "/" + (.conclusion // "none")' 2>&1)
        local gh_exit_code=$?
        
        if [ $gh_exit_code -eq 0 ] && [ -n "${gh_output}" ]; then
            status="${gh_output}"
            log_debug "Workflow status: ${status}"
            
            if [[ "${status}" == *"/failure"* ]] || [[ "${status}" == *"/cancelled"* ]] || [[ "${status}" == *"/success"* ]]; then
                echo "${status}"
                return 0
            fi
        else
            retry_count=$((retry_count + 1))
            if [ $retry_count -le $max_retries_before_error ]; then
                log_warn "Could not get workflow status (attempt ${retry_count}/${max_retries_before_error}): ${gh_output}"
            else
                log_error "Failed to get workflow status after ${retry_count} attempts. Error: ${gh_output}"
                log_error "Run ID: ${run_id}. Please verify the run exists: gh run view ${run_id}"
                echo "error/status_check_failed"
                return 1
            fi
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
    
    log_info "Extracting workflow logs and errors for run ${run_id}..."
    
    # Clean run_id
    run_id=$(echo "${run_id}" | tr -d '\n\r' | grep -oE '[0-9]+' | head -1)
    
    if [ -z "${run_id}" ]; then
        log_error "Invalid run ID provided to extract_workflow_errors: ${1}"
        echo ""
        return 1
    fi
    
    # Verify the run exists
    if ! gh run view "${run_id}" --json databaseId >/dev/null 2>&1; then
        log_error "Run ${run_id} does not exist or is not accessible"
        log_error "Please verify: gh run view ${run_id}"
        echo ""
        return 1
    fi
    
    # Get failed job
    local job_id
    job_id=$(gh run view "${run_id}" --json jobs -q '.[] | select(.conclusion == "failure") | .databaseId' 2>/dev/null | head -1)
    
    if [ -z "${job_id}" ]; then
        # Try to get any job
        job_id=$(gh run view "${run_id}" --json jobs -q '.[0].databaseId' 2>/dev/null || echo "")
    fi
    
    if [ -z "${job_id}" ]; then
        log_warn "Could not get job ID, extracting from run logs"
        if ! gh run view "${run_id}" --log > "${error_file}" 2>&1; then
            log_warn "Failed to extract logs, trying alternative method"
            echo "Failed to extract logs for run ${run_id}" > "${error_file}"
        fi
    else
        log_debug "Extracting logs from job ${job_id}"
        if ! gh run view "${run_id}" --log > "${error_file}" 2>&1; then
            log_warn "Failed to extract logs for job ${job_id}"
        fi
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
        local status_info
        status_info=$(gh run view "${run_id}" --json status,conclusion,displayTitle,event 2>/dev/null)
        if [ -n "${status_info}" ]; then
            echo "${status_info}" | jq -r '.status + " / " + (.conclusion // "none") + " - " + (.displayTitle // "N/A")' 2>/dev/null || echo "${status_info}"
        else
            echo "Could not get status"
        fi
        echo ""
        echo "=== Failed Jobs ==="
        local failed_jobs
        failed_jobs=$(gh run view "${run_id}" --json jobs -q '.[] | select(.conclusion == "failure") | "Job: \(.name) - \(.conclusion)"' 2>/dev/null)
        if [ -n "${failed_jobs}" ]; then
            echo "${failed_jobs}"
        else
            echo "Could not get failed jobs or no failed jobs found"
        fi
        echo ""
        echo "=== All Jobs ==="
        gh run view "${run_id}" --json jobs -q '.[] | "\(.name): \(.conclusion // "unknown")"' 2>/dev/null || echo "Could not get jobs"
        echo ""
        echo "=== Error Logs (last 200 lines) ==="
        if [ -f "${error_file}" ] && [ -s "${error_file}" ]; then
            tail -200 "${error_file}" 2>/dev/null || echo "Could not read error logs"
        else
            echo "No error logs available"
        fi
    } > "${summary_file}" 2>&1
    
    log_info "Error summary saved to: ${summary_file}"
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
    
    # Initial banner
    echo ""
    echo "=========================================="
    echo "  Workflow Retry Script"
    echo "  AI-Powered Auto-Fix"
    echo "=========================================="
    echo ""
    
    log_info "Starting workflow retry script"
    log_info "Configuration file: ${CONFIG_FILE}"
    log_info "Log file: ${LOG_FILE}"
    log_info "Working directory: ${PROJECT_ROOT}"
    if [ "${SKIP_FIX_FLAG}" = "true" ]; then
        log_info "Fix step will be skipped (--skip-fix flag)"
    fi
    echo ""
    
    # Verify we can write to log file
    if ! touch "${LOG_FILE}" 2>/dev/null; then
        log_error "Cannot write to log file: ${LOG_FILE}"
        log_error "Please check permissions or specify a different location"
        exit 1
    fi
    
    # Load config first to get skipSteps, then check prerequisites
    load_config
    check_prerequisites
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
        
        # Clean run_id to ensure it's only numeric
        run_id=$(echo "${run_id}" | tr -d '\n\r' | grep -oE '[0-9]+' | head -1)
        
        if [ -z "${run_id}" ]; then
            log_error "Invalid run ID received from trigger_workflow"
            exit 1
        fi
        
        last_run_id="${run_id}"
        log_info "Workflow run ID: ${run_id}"
        
        # Wait for completion
        local status_result
        if ! status_result=$(wait_for_workflow "${run_id}"); then
            log_error "Failed to get workflow status"
            log_error "Run ID: ${run_id}"
            log_error "Please check manually: gh run view ${run_id}"
            exit 1
        fi
        
        local status=$(echo "${status_result}" | cut -d'/' -f1)
        local conclusion=$(echo "${status_result}" | cut -d'/' -f2)
        
        log_info "Workflow completed with status: ${status}, conclusion: ${conclusion}"
        
        # Handle error cases
        if [ "${status}" == "error" ]; then
            log_error "Error checking workflow status: ${conclusion}"
            log_error "Run ID: ${run_id}"
            log_error "Please check manually: gh run view ${run_id}"
            exit 1
        fi
        
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

