# Workflow Retry Script with AI-Powered Auto-Fix

This script automatically retries failed GitHub Actions workflows and uses cursor-agent to fix errors until the workflow succeeds or a maximum retry limit is reached.

## Features

- 🔄 **Automatic Retry**: Triggers workflow runs and monitors their status
- 🤖 **AI-Powered Fixes**: Uses cursor-agent to automatically fix errors based on workflow logs
- 📝 **Smart Error Extraction**: Extracts and analyzes error logs from failed workflow runs
- 🔧 **Configurable**: Highly configurable via JSON configuration file
- 📊 **Comprehensive Logging**: Detailed logs saved for debugging
- 🔀 **Git Integration**: Automatically commits and pushes fixes
- ⚙️ **Multiple Strategies**: Auto-commit, review mode, or auto-with-review

## Prerequisites

1. **GitHub CLI** (`gh`) - [Installation guide](https://cli.github.com/manual/installation)
2. **jq** - JSON processor - [Installation guide](https://stedolan.github.io/jq/download/)
3. **cursor-agent** - Cursor AI CLI tool
   - ⚠️ **Windows Note:** Cursor Agent CLI doesn't officially support Windows yet
   - Use WSL for best results, or see [Windows workaround](https://github.com/TomasHubelbauer/cursor-agent-windows)
   - Alternatively, use `--skip-fix` flag to skip cursor-agent requirement
4. **Git** - For committing and pushing changes
5. **Authenticated GitHub CLI** - Run `gh auth login` if not already authenticated

### Authentication Setup

#### Cursor API Key (Required for cursor-agent)

The script requires `CURSOR_API_KEY` environment variable to be set for cursor-agent authentication.

**Option 1: Set environment variable (Recommended)**
```bash
# For current session
export CURSOR_API_KEY='your-api-key-here'

# For permanent setup, add to ~/.bashrc or ~/.zshrc
echo 'export CURSOR_API_KEY="your-api-key-here"' >> ~/.bashrc
source ~/.bashrc
```

**Option 2: Interactive login**
```bash
cursor-agent login
```

**Getting your Cursor API Key:**
- Open Cursor IDE
- Go to Settings → Account → API Keys
- Create a new API key or copy an existing one

#### Git Credentials (WSL Users)

If you're using WSL, the script automatically configures Git to use the `store` credential helper, which saves credentials in `~/.git-credentials`. 

**Manual setup (if needed):**
```bash
# Configure Git to save credentials
git config --global credential.helper store

# On first push, you'll be prompted for username and token
# Credentials will be saved automatically for future pushes
```

**Note:** The script automatically detects WSL and configures this for you, but you can set it manually if needed.

## Quick Start

> **New to this script?** See [QUICKSTART.md](QUICKSTART.md) for detailed setup instructions and troubleshooting.

1. **Copy the example configuration:**
   ```bash
   cp cicd/scripts/workflow-retry-config.example.json cicd/scripts/workflow-retry-config.json
   ```

2. **Edit the configuration file** to match your workflow:
   ```json
   {
     "workflow": "ai-teammate-2.yaml",
     "workflowInputs": {
       "config_file": "agents/test_agent.json"
     }
   }
   ```
   
   **Note:** See the [Configuration Options](#configuration-options) section below for all available options and their descriptions. The example file includes all options with sensible defaults.

3. **Run the script:**
   ```bash
   # Bash (Linux/Mac/WSL/Git Bash)
   ./cicd/scripts/workflow-retry.sh
   
   # PowerShell (Windows)
   .\cicd\scripts\workflow-retry.ps1
   
   # Show help
   ./cicd/scripts/workflow-retry.sh --help
   ```

**Note:** If you don't see any output when running the script:
- Make sure you're running it from a terminal (not double-clicking)
- Check that you have the required prerequisites installed (see Prerequisites section)
- The script will show clear error messages if prerequisites are missing
- All output is also logged to `.workflow-retry-logs/workflow-retry_*.log`

## Configuration

The configuration file is a JSON file that controls all aspects of the workflow retry process. All options except `workflow` are optional and have sensible defaults.

**Configuration File Location:**
- Default: `cicd/scripts/workflow-retry-config.json`
- Custom: Pass as first argument: `./workflow-retry.sh /path/to/config.json`

### Basic Configuration

```json
{
  "workflow": "ai-teammate-2.yaml",
  "workflowInputs": {
    "config_file": "agents/test_agent.json",
    "encoded_config": ""
  },
  "maxRetries": 10
}
```

### Advanced Configuration

```json
{
  "workflow": "ai-teammate-2.yaml",
  "workflowInputs": {
    "config_file": "agents/test_agent.json"
  },
  "maxRetries": 10,
  "waitTimeout": 3600,
  "pollInterval": 10,
  "fixStrategy": "auto",
  "commitMessage": "fix: Auto-fix workflow errors (run {runNumber})",
  "branch": null,
  "cursorAgentOptions": {
    "model": "auto",
    "force": true,
    "additionalArgs": []
  },
  "errorPatterns": [
    {
      "name": "command_not_found",
      "pattern": "command not found",
      "context": "Check installation steps and PATH configuration."
    }
  ],
  "skipSteps": [],
  "logLevel": "normal"
}
```

### Configuration Options

#### Required Options

| Option | Type | Description |
|--------|------|-------------|
| `workflow` | string | **Required.** Workflow file name (e.g., `"ai-teammate-2.yaml"`) or workflow ID |

#### Workflow Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `workflowInputs` | object | `{}` | Inputs to pass to `workflow_dispatch`. Each key-value pair becomes a `-f key=value` parameter. Example: `{"config_file": "agents/test_agent.json", "encoded_config": ""}` |

#### Retry & Timing Options

| Option | Type | Default | Min | Max | Description |
|--------|------|---------|-----|-----|-------------|
| `maxRetries` | integer | `10` | `1` | `20` | Maximum number of failed runs before giving up. The script will retry up to this many times. |
| `waitTimeout` | integer | `3600` | `60` | - | Maximum time to wait for workflow completion in seconds. If workflow takes longer, it's considered timed out. |
| `pollInterval` | integer | `10` | `5` | - | Interval between status checks in seconds. Lower values check more frequently but use more API calls. |

#### Fix Strategy Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `fixStrategy` | string | `"auto"` | How to handle fixes: <br>- `"auto"`: Automatically commits and pushes fixes without user interaction <br>- `"review"`: Shows diff and waits for user approval before committing <br>- `"auto-with-review"`: Commits automatically but shows the diff for review |
| `commitMessage` | string | `"fix: Auto-fix workflow errors (run {runNumber})"` | Commit message template. Supports placeholders: <br>- `{runNumber}`: Current retry attempt number <br>- `{errorSummary}`: Brief summary of the error |

#### Git Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `branch` | string | `null` | Branch to commit to. If `null` or not set, uses the current branch. If specified, the script will switch to (or create) this branch before committing. |

#### Cursor Agent Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cursorAgentOptions` | object | `{}` | Options for cursor-agent when generating fixes. See below for sub-options. |
| `cursorAgentOptions.model` | string | `"auto"` | Model to use for cursor-agent. Examples: `"auto"`, `"sonnet-4"`, `"sonnet-4.5"`, `"o1"`. |
| `cursorAgentOptions.force` | boolean | `true` | Force cursor-agent to make changes. If `false`, cursor-agent may be more conservative. |
| `cursorAgentOptions.additionalArgs` | array | `[]` | Additional arguments to pass to cursor-agent. Each string in the array is passed as a separate argument. Example: `["--print", "--output-format=text"]` |

#### Error Pattern Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `errorPatterns` | array | `[]` | Array of error pattern objects to help provide better context to the AI. See Error Patterns section below. |
| `errorPatterns[].name` | string | - | **Required.** Name of the error pattern (for identification). |
| `errorPatterns[].pattern` | string | - | **Required.** Regex pattern to match in error logs. Uses standard regex syntax. |
| `errorPatterns[].context` | string | - | **Required.** Additional context to provide to AI when this error pattern is detected. This helps the AI understand the error better. |

#### Control Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `skipSteps` | array | `[]` | Steps to skip in the retry process. Valid values: <br>- `"fix"`: Skip the AI fix generation step (manual fixes only) <br>- `"commit"`: Skip the commit step (changes won't be committed) <br>- `"push"`: Skip the push step (changes won't be pushed) <br>Example: `["fix"]` to only retry without generating fixes. |
| `logLevel` | string | `"normal"` | Logging verbosity level: <br>- `"quiet"`: Minimal output <br>- `"normal"`: Standard output (default) <br>- `"verbose"`: Detailed output including debug info <br>- `"debug"`: Maximum verbosity for troubleshooting |

### Fix Strategies

- **`auto`**: Automatically commits and pushes fixes without user interaction
- **`review`**: Shows diff and waits for user approval before committing
- **`auto-with-review`**: Commits automatically but shows the diff for review

### Error Patterns

Error patterns help provide better context to the AI when specific errors are detected. When an error pattern matches, the AI receives additional context to better understand and fix the issue.

**Structure:**
- `name`: A descriptive name for the pattern (e.g., `"command_not_found"`)
- `pattern`: A regex pattern that matches error text (e.g., `"command not found"` or `"Permission denied|EACCES|403"`)
- `context`: Additional information to help the AI understand and fix this type of error

**Example:**
```json
{
  "errorPatterns": [
    {
      "name": "command_not_found",
      "pattern": "command not found",
      "context": "This usually indicates a missing tool or PATH issue. Check installation steps and PATH configuration in the workflow file."
    },
    {
      "name": "permission_denied",
      "pattern": "Permission denied|EACCES|403",
      "context": "This indicates a permissions issue. Check file permissions, GitHub token permissions, or API access. Verify secrets and variables are correctly configured."
    },
    {
      "name": "syntax_error",
      "pattern": "syntax error|Parse error|YAMLException",
      "context": "This indicates a syntax error in configuration files. Check YAML/JSON syntax, indentation, and ensure all required fields are present."
    },
    {
      "name": "timeout",
      "pattern": "timeout|timed out|exceeded",
      "context": "This indicates a timeout issue. Consider increasing timeout values in the workflow, optimizing long-running steps, or checking for infinite loops."
    }
  ]
}
```

**Tips:**
- Use specific patterns that match your common errors
- Provide actionable context that helps the AI understand the root cause
- Test patterns with actual error logs to ensure they match correctly
- Use regex alternation (`|`) to match multiple variations of the same error

## Usage Examples

### Basic Usage

```bash
# Use default config
./cicd/scripts/workflow-retry.sh

# Use custom config
./cicd/scripts/workflow-retry.sh /path/to/config.json
```

### Skip Auto-Fix (Manual Fixes)

```json
{
  "skipSteps": ["fix"],
  "maxRetries": 3
}
```

### Review Before Committing

```json
{
  "fixStrategy": "review"
}
```

### Use Specific Cursor Model

```json
{
  "cursorAgentOptions": {
    "model": "sonnet-4.5",
    "force": true
  }
}
```

## How It Works

1. **Trigger Workflow**: Uses `gh workflow run` to trigger the specified workflow
2. **Monitor Status**: Polls workflow status until completion or timeout
3. **Extract Errors**: Downloads and parses error logs from failed runs
4. **Generate Fixes**: Uses cursor-agent with error context to generate fixes
5. **Commit & Push**: Commits fixes and pushes to trigger a new workflow run
6. **Repeat**: Repeats until success or max retries reached

## Logs

All logs are saved to `.workflow-retry-logs/` directory:

- `workflow-retry_YYYYMMDD_HHMMSS.log` - Main execution log
- `errors_RUNID.txt` - Full error logs from workflow run
- `summary_RUNID.txt` - Summary of workflow run and errors
- `fix_RUNNUMBER.log` - Output from cursor-agent fix attempts

## Troubleshooting

### Workflow Not Triggering

- Check that `gh auth login` has been run
- Verify workflow file name is correct
- Ensure workflow has `workflow_dispatch` trigger

### Fixes Not Being Applied

- Check that `cursor-agent` is installed and in PATH
- Verify `CURSOR_API_KEY` environment variable is set
- Check fix logs in `.workflow-retry-logs/fix_*.log`

### Changes Not Committing

- Ensure you're on the correct branch
- Check git status for uncommitted changes
- Verify git user is configured

### Workflow Timing Out

- Increase `waitTimeout` in configuration
- Check if workflow is actually running (may be queued)
- Verify workflow doesn't have infinite loops

## Best Practices

1. **Start with Review Mode**: Use `"fixStrategy": "review"` initially to verify fixes
2. **Set Reasonable Retries**: Don't set `maxRetries` too high (10 is usually sufficient)
3. **Monitor Logs**: Check logs regularly to understand what fixes are being applied
4. **Use Error Patterns**: Configure error patterns for common issues in your workflows
5. **Test Configuration**: Run with a test workflow first to verify configuration

## Limitations

- Requires GitHub CLI authentication
- Works only with `workflow_dispatch` triggered workflows
- Fixes are based on error logs, may not catch all issues
- Maximum retry limit prevents infinite loops
- Requires cursor-agent to be functional

## Integration with CI/CD

You can integrate this script into your CI/CD pipeline:

```yaml
- name: Retry Failed Workflow
  if: failure()
  run: |
    ./cicd/scripts/workflow-retry.sh cicd/scripts/workflow-retry-config.json
```

## Support

For issues or questions:
1. Check logs in `.workflow-retry-logs/`
2. Review workflow run logs in GitHub Actions
3. Verify all prerequisites are installed
4. Check configuration file syntax

