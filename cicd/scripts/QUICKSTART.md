# Quick Start Guide - Workflow Retry Script

## Running the Script

### On Windows (PowerShell)

The script requires bash. You have several options:

**Option 1: Use Git Bash (Recommended)**
```bash
# Open Git Bash, navigate to project root, then:
./cicd/scripts/workflow-retry.sh
```

**Option 2: Use WSL (Windows Subsystem for Linux)**
```bash
# In WSL terminal:
cd /mnt/c/Users/YourUsername/Code/autocoding
./cicd/scripts/workflow-retry.sh
```

**Option 3: Use PowerShell with bash**
```powershell
# In PowerShell:
bash cicd/scripts/workflow-retry.sh
```

### On Linux/Mac

```bash
./cicd/scripts/workflow-retry.sh
```

## Prerequisites Check

Before running, ensure you have:

1. **GitHub CLI (gh)** - Install from https://cli.github.com/manual/installation
   ```bash
   # Verify installation:
   gh --version
   
   # Authenticate:
   gh auth login
   ```

2. **jq** - JSON processor
   - Linux: `sudo apt-get install jq` or `sudo yum install jq`
   - Mac: `brew install jq`
   - Windows: Download from https://stedolan.github.io/jq/download/

3. **cursor-agent** - Cursor AI CLI
   
   ⚠️ **IMPORTANT:** Cursor Agent CLI doesn't officially support Windows yet.
   The official installer only works on Linux and macOS.
   
   **On Windows - Recommended Options:**
   
   **Option A: Use WSL (Recommended)**
   ```bash
   # In WSL terminal:
   curl https://cursor.com/install -fsS | bash
   export PATH="$HOME/.local/bin:$PATH"
   cursor-agent --version
   ```
   
   **Option B: Windows Workaround (Advanced)**
   ```powershell
   # Uses unofficial workaround method (fully automated):
   .\cicd\scripts\install-cursor-agent-windows.ps1
   ```
   This script automatically:
   - Downloads Linux package
   - Downloads Windows-native modules (merkle-tree, sqlite3, ripgrep)
   - Replaces native modules automatically
   - Modifies code for Windows support
   - Creates a wrapper script for easy use
   
   Based on: [Cursor Agent Windows Workaround](https://github.com/TomasHubelbauer/cursor-agent-windows)
   
   **On Linux/Mac:**
   ```bash
   # Direct installation (official method):
   curl https://cursor.com/install -fsS | bash
   export PATH="$HOME/.local/bin:$PATH"
   cursor-agent --version
   ```
   
   **After installation, add to PATH:**
   - **WSL/Bash:** Add `export PATH="$HOME/.local/bin:$PATH"` to `~/.bashrc` or `~/.zshrc`
   - **PowerShell:** Add `$env:USERPROFILE\.local\bin` to your PATH
   
   **Verify installation:**
   ```bash
   cursor-agent --version
   ```
   
   **Note:** If you plan to skip the fix step, cursor-agent is optional
   - Run with `--skip-fix` flag: `./workflow-retry.sh --skip-fix`

4. **Configuration file** - Copy the example:
   ```bash
   cp cicd/scripts/workflow-retry-config.example.json cicd/scripts/workflow-retry-config.json
   ```

## Common Issues

### "No result" or Script Exits Immediately

**Problem:** Script exits due to missing prerequisites or authentication issues.

**Solution:**
1. Check prerequisites are installed and in PATH
2. Verify GitHub CLI is authenticated: `gh auth status`
3. Run with explicit bash: `bash cicd/scripts/workflow-retry.sh`
4. Check the log file: `.workflow-retry-logs/workflow-retry_*.log`

### Script Not Found

**Problem:** `./cicd/scripts/workflow-retry.sh: No such file or directory`

**Solution:**
- Ensure you're in the project root directory
- Use full path: `bash cicd/scripts/workflow-retry.sh`
- Check file exists: `ls -la cicd/scripts/workflow-retry.sh`

### Tools Not Found in PATH

**Problem:** Script says tools are missing even though they're installed

**Solution:**
- On Windows, tools might be installed but not in PATH for bash
- Add tools to PATH or use full paths
- For WSL, ensure Windows tools are accessible or install Linux versions
- For cursor-agent specifically:
  - It installs to `~/.local/bin/` by default
  - Add to PATH: `export PATH="$HOME/.local/bin:$PATH"`
  - Or run script with `--skip-fix` to skip cursor-agent requirement

### Cursor-Agent Installation Issues on Windows

**Problem:** Cursor Agent CLI doesn't officially support Windows

**Solution:**
- **Best option:** Use WSL (Windows Subsystem for Linux)
  ```bash
  # In WSL:
  curl https://cursor.com/install -fsS | bash
  export PATH="$HOME/.local/bin:$PATH"
  ```
  
- **Alternative:** Use the Windows workaround (advanced)
  ```powershell
  .\cicd\scripts\install-cursor-agent-windows.ps1
  ```
  This requires manual steps. See: [Cursor Agent Windows Workaround](https://github.com/TomasHubelbauer/cursor-agent-windows)
  
- **Simplest option:** Skip cursor-agent requirement
  ```bash
  ./workflow-retry.sh --skip-fix
  ```
  This allows the script to run without cursor-agent (you'll need to fix errors manually)

**Problem:** `$'\r': command not found` errors when installing cursor-agent

**Solution:**
- This happens because the installer script has Windows line endings
- Use WSL instead (recommended)
- Or use the Windows workaround script which handles this
- Or manually fix line endings before running the installer

### Configuration File Not Found

**Problem:** `Configuration file not found`

**Solution:**
```bash
# Copy the example config:
cp cicd/scripts/workflow-retry-config.example.json cicd/scripts/workflow-retry-config.json

# Edit if needed:
# Then run the script again
```

## Testing the Script

1. **Check help:**
   ```bash
   bash cicd/scripts/workflow-retry.sh --help
   ```

2. **Verify prerequisites:**
   ```bash
   gh --version
   jq --version
   cursor-agent --version
   gh auth status
   ```

3. **Test with a simple workflow:**
   - Ensure your config file points to a test workflow
   - Run the script and monitor output

## Getting Help

- See full documentation: `cicd/scripts/README-workflow-retry.md`
- Check log files: `.workflow-retry-logs/`
- Run with `--help` flag

