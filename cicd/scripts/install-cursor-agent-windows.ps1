# PowerShell script to install cursor-agent on Windows using the workaround method
# Based on: https://github.com/TomasHubelbauer/cursor-agent-windows
# 
# Note: Cursor Agent CLI doesn't officially support Windows yet.
# This script implements the workaround by downloading Linux package and replacing native modules.

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Cursor Agent Windows Installation" -ForegroundColor Cyan
Write-Host "  (Unofficial Workaround)" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[WARNING] Cursor Agent CLI doesn't officially support Windows yet." -ForegroundColor Yellow
Write-Host "This script uses a workaround method documented at:" -ForegroundColor Yellow
Write-Host "https://github.com/TomasHubelbauer/cursor-agent-windows" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to cancel, or any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Check prerequisites
Write-Host ""
Write-Host "Checking prerequisites..." -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js is required but not found." -ForegroundColor Red
    Write-Host "Please install Node.js from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

$nodeVersion = node --version
Write-Host "[SUCCESS] Node.js found: $nodeVersion" -ForegroundColor Green

# Determine installation directory
$installDir = Join-Path $env:USERPROFILE ".cursor-agent-windows"
$packageDir = Join-Path $installDir "package"

Write-Host ""
Write-Host "Installation directory: $installDir" -ForegroundColor Cyan
Write-Host ""

# Create installation directory
if (Test-Path $installDir) {
    Write-Host "Removing existing installation..." -ForegroundColor Yellow
    Remove-Item $installDir -Recurse -Force
}
New-Item -ItemType Directory -Path $installDir -Force | Out-Null
New-Item -ItemType Directory -Path $packageDir -Force | Out-Null

# Download Linux package
Write-Host "Step 1: Downloading Linux package..." -ForegroundColor Cyan
$packageUrl = "https://downloads.cursor.com/lab/2025.08.15-dbc8d73/linux/x64/agent-cli-package.tar.gz"
$packageFile = Join-Path $installDir "agent-cli-package.tar.gz"

try {
    Invoke-WebRequest -Uri $packageUrl -OutFile $packageFile -UseBasicParsing
    Write-Host "[SUCCESS] Package downloaded" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to download package: $_" -ForegroundColor Red
    exit 1
}

# Extract package (requires tar or 7zip)
Write-Host ""
Write-Host "Step 2: Extracting package..." -ForegroundColor Cyan

$tempExtractDir = Join-Path $installDir "temp-extract"
New-Item -ItemType Directory -Path $tempExtractDir -Force | Out-Null

if (Get-Command tar -ErrorAction SilentlyContinue) {
    # Use tar if available (Windows 10 1803+)
    tar -xzf $packageFile -C $tempExtractDir
    Write-Host "[SUCCESS] Package extracted" -ForegroundColor Green
} elseif (Get-Command 7z -ErrorAction SilentlyContinue) {
    # Use 7zip as fallback
    & 7z x $packageFile -o"$tempExtractDir" -y | Out-Null
    # Extract the inner tar if needed
    $innerTar = Get-ChildItem -Path $tempExtractDir -Filter "*.tar" | Select-Object -First 1
    if ($innerTar) {
        & 7z x $innerTar.FullName -o"$tempExtractDir" -y | Out-Null
    }
    Write-Host "[SUCCESS] Package extracted" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Neither tar nor 7zip found. Please install one:" -ForegroundColor Red
    Write-Host "  - tar: Built into Windows 10 1803+" -ForegroundColor Yellow
    Write-Host "  - 7zip: Download from https://www.7-zip.org/" -ForegroundColor Yellow
    exit 1
}

# Handle nested directory structure (tar.gz often contains a single directory)
$extractedContents = Get-ChildItem -Path $tempExtractDir
if ($extractedContents.Count -eq 1 -and $extractedContents[0].PSIsContainer) {
    # Single directory - move its contents to packageDir
    Write-Host "  Flattening nested directory structure..." -ForegroundColor Yellow
    $nestedDir = $extractedContents[0].FullName
    Get-ChildItem -Path $nestedDir -Recurse | ForEach-Object {
        $relativePath = $_.FullName.Substring($nestedDir.Length + 1)
        $destPath = Join-Path $packageDir $relativePath
        $destDir = Split-Path -Parent $destPath
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        Copy-Item -Path $_.FullName -Destination $destPath -Force
    }
    Remove-Item -Path $tempExtractDir -Recurse -Force
} else {
    # Multiple files or files at root - move everything to packageDir
    Get-ChildItem -Path $tempExtractDir | ForEach-Object {
        $destPath = Join-Path $packageDir $_.Name
        if ($_.PSIsContainer) {
            Copy-Item -Path $_.FullName -Destination $destPath -Recurse -Force
        } else {
            Copy-Item -Path $_.FullName -Destination $destPath -Force
        }
    }
    Remove-Item -Path $tempExtractDir -Recurse -Force
}

# Find the extracted files and verify structure
Write-Host "Verifying extracted package structure..." -ForegroundColor Yellow
$extractedFiles = Get-ChildItem -Path $packageDir -Recurse -File | Where-Object { $_.Name -eq "index.js" -or $_.Name -like "*.node" -or $_.Name -eq "rg" -or $_.Name -eq "rg.exe" }

if ($extractedFiles.Count -eq 0) {
    Write-Host "[ERROR] Could not find extracted files. Package structure may have changed." -ForegroundColor Red
    Write-Host "Checking package directory contents..." -ForegroundColor Yellow
    $allFiles = Get-ChildItem -Path $packageDir -Recurse -File | Select-Object -First 20
    if ($allFiles.Count -gt 0) {
        Write-Host "Found files:" -ForegroundColor Gray
        $allFiles | ForEach-Object { Write-Host "  $($_.FullName)" -ForegroundColor Gray }
    } else {
        Write-Host "No files found in package directory: $packageDir" -ForegroundColor Red
    }
    exit 1
}

# Check if index.js exists
$indexJsCheck = Get-ChildItem -Path $packageDir -Recurse -Filter "index.js" | Select-Object -First 1
if (-not $indexJsCheck) {
    Write-Host "[WARNING] index.js not found in expected location" -ForegroundColor Yellow
    Write-Host "Package may have a different structure. Continuing anyway..." -ForegroundColor Yellow
} else {
    Write-Host "[SUCCESS] Found index.js at: $($indexJsCheck.FullName)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Step 3: Downloading Windows native modules..." -ForegroundColor Cyan

# Download Windows native modules
$modulesDir = Join-Path $packageDir "node_modules"

# Download merkle-tree Windows build
Write-Host "  Downloading merkle-tree Windows module..." -ForegroundColor Yellow
$merkleTreeUrl = "https://github.com/btc-vision/rust-merkle-tree/releases/download/v0.0.5/rust-merkle-tree.win32-x64-msvc.node"
$merkleTreeFile = Join-Path $installDir "merkle-tree-windows.node"

try {
    Invoke-WebRequest -Uri $merkleTreeUrl -OutFile $merkleTreeFile -UseBasicParsing
    Write-Host "  [SUCCESS] merkle-tree downloaded" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Failed to download merkle-tree: $_" -ForegroundColor Red
    Write-Host "  Please download manually from:" -ForegroundColor Yellow
    Write-Host "  https://github.com/btc-vision/rust-merkle-tree/releases" -ForegroundColor Cyan
    exit 1
}

# Download sqlite3 Windows build
Write-Host "  Downloading sqlite3 Windows module..." -ForegroundColor Yellow
$sqlite3Url = "https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v3-win32-x64.tar.gz"
$sqlite3File = Join-Path $installDir "sqlite3-windows.tar.gz"
$sqlite3ExtractDir = Join-Path $installDir "sqlite3-extract"

try {
    Invoke-WebRequest -Uri $sqlite3Url -OutFile $sqlite3File -UseBasicParsing
    Write-Host "  [SUCCESS] sqlite3 downloaded" -ForegroundColor Green
    
    # Extract sqlite3
    New-Item -ItemType Directory -Path $sqlite3ExtractDir -Force | Out-Null
    if (Get-Command tar -ErrorAction SilentlyContinue) {
        tar -xzf $sqlite3File -C $sqlite3ExtractDir
    } elseif (Get-Command 7z -ErrorAction SilentlyContinue) {
        & 7z x $sqlite3File -o"$sqlite3ExtractDir" -y | Out-Null
    }
} catch {
    Write-Host "  [ERROR] Failed to download sqlite3: $_" -ForegroundColor Red
    Write-Host "  Please download manually from:" -ForegroundColor Yellow
    Write-Host "  https://github.com/TryGhost/node-sqlite3/releases" -ForegroundColor Cyan
    exit 1
}

# Download ripgrep Windows build
Write-Host "  Downloading ripgrep Windows binary..." -ForegroundColor Yellow
$ripgrepUrl = "https://github.com/BurntSushi/ripgrep/releases/download/14.1.0/ripgrep-14.1.0-x86_64-pc-windows-msvc.zip"
$ripgrepFile = Join-Path $installDir "ripgrep-windows.zip"
$ripgrepExtractDir = Join-Path $installDir "ripgrep-extract"

try {
    Invoke-WebRequest -Uri $ripgrepUrl -OutFile $ripgrepFile -UseBasicParsing
    Write-Host "  [SUCCESS] ripgrep downloaded" -ForegroundColor Green
    
    # Extract ripgrep
    New-Item -ItemType Directory -Path $ripgrepExtractDir -Force | Out-Null
    if (Get-Command Expand-Archive -ErrorAction SilentlyContinue) {
        Expand-Archive -Path $ripgrepFile -DestinationPath $ripgrepExtractDir -Force
    } elseif (Get-Command 7z -ErrorAction SilentlyContinue) {
        & 7z x $ripgrepFile -o"$ripgrepExtractDir" -y | Out-Null
    }
} catch {
    Write-Host "  [ERROR] Failed to download ripgrep: $_" -ForegroundColor Red
    Write-Host "  Please download manually from:" -ForegroundColor Yellow
    Write-Host "  https://github.com/BurntSushi/ripgrep/releases" -ForegroundColor Cyan
    exit 1
}

Write-Host ""
Write-Host "Step 4: Replacing native modules..." -ForegroundColor Cyan

# Find merkle-tree .node file (look for qfpzq242.node or similar)
Write-Host "  Finding merkle-tree module..." -ForegroundColor Yellow
$merkleTreeNodeFiles = Get-ChildItem -Path $packageDir -Recurse -Filter "*.node" | Where-Object {
    $_.DirectoryName -like "*merkle*" -or 
    $_.Name -match "qfpzq242|merkle"
}

if ($merkleTreeNodeFiles.Count -eq 0) {
    # Try to find by searching in node_modules
    $merkleTreeNodeFiles = Get-ChildItem -Path $modulesDir -Recurse -Filter "*.node" | Where-Object {
        $_.DirectoryName -like "*merkle*"
    }
}

if ($merkleTreeNodeFiles.Count -gt 0) {
    $merkleTreeTarget = $merkleTreeNodeFiles[0]
    Write-Host "  Found: $($merkleTreeTarget.FullName)" -ForegroundColor Gray
    Copy-Item -Path $merkleTreeFile -Destination $merkleTreeTarget.FullName -Force
    Write-Host "  [SUCCESS] Replaced merkle-tree module" -ForegroundColor Green
} else {
    Write-Host "  [WARNING]  Could not find merkle-tree .node file to replace" -ForegroundColor Yellow
    Write-Host "  You may need to replace it manually" -ForegroundColor Yellow
}

# Find sqlite3 .node file (look for kkkzjw1t.node or similar)
Write-Host "  Finding sqlite3 module..." -ForegroundColor Yellow
$sqlite3NodeFiles = Get-ChildItem -Path $packageDir -Recurse -Filter "*.node" | Where-Object {
    $_.DirectoryName -like "*sqlite3*" -or 
    $_.Name -match "kkkzjw1t|sqlite3"
}

if ($sqlite3NodeFiles.Count -eq 0) {
    # Try to find by searching in node_modules
    $sqlite3NodeFiles = Get-ChildItem -Path $modulesDir -Recurse -Filter "*.node" | Where-Object {
        $_.DirectoryName -like "*sqlite3*"
    }
}

if ($sqlite3NodeFiles.Count -gt 0) {
    $sqlite3Target = $sqlite3NodeFiles[0]
    Write-Host "  Found: $($sqlite3Target.FullName)" -ForegroundColor Gray
    
    # Find the Windows sqlite3 .node file in extracted directory
    $sqlite3WindowsNode = Get-ChildItem -Path $sqlite3ExtractDir -Recurse -Filter "*.node" | Select-Object -First 1
    if ($sqlite3WindowsNode) {
        Copy-Item -Path $sqlite3WindowsNode.FullName -Destination $sqlite3Target.FullName -Force
        Write-Host "  [SUCCESS] Replaced sqlite3 module" -ForegroundColor Green
    } else {
        Write-Host "  [WARNING]  Could not find Windows sqlite3 .node in extracted archive" -ForegroundColor Yellow
    }
} else {
    Write-Host "  [WARNING]  Could not find sqlite3 .node file to replace" -ForegroundColor Yellow
    Write-Host "  You may need to replace it manually" -ForegroundColor Yellow
}

# Find and replace ripgrep binary
Write-Host "  Finding ripgrep binary..." -ForegroundColor Yellow
$ripgrepFiles = Get-ChildItem -Path $packageDir -Recurse -Filter "rg" | Where-Object { -not $_.PSIsContainer }
if ($ripgrepFiles.Count -eq 0) {
    $ripgrepFiles = Get-ChildItem -Path $packageDir -Recurse -Filter "rg.exe"
}

if ($ripgrepFiles.Count -gt 0) {
    $ripgrepTarget = $ripgrepFiles[0]
    Write-Host "  Found: $($ripgrepTarget.FullName)" -ForegroundColor Gray
    
    # Find Windows ripgrep binary
    $ripgrepWindows = Get-ChildItem -Path $ripgrepExtractDir -Recurse -Filter "rg.exe" | Select-Object -First 1
    if (-not $ripgrepWindows) {
        $ripgrepWindows = Get-ChildItem -Path $ripgrepExtractDir -Recurse -Filter "rg" | Where-Object { -not $_.PSIsContainer } | Select-Object -First 1
    }
    
    if ($ripgrepWindows) {
        Copy-Item -Path $ripgrepWindows.FullName -Destination $ripgrepTarget.FullName -Force
        Write-Host "  [SUCCESS] Replaced ripgrep binary" -ForegroundColor Green
    } else {
        Write-Host "  [WARNING]  Could not find Windows ripgrep binary in extracted archive" -ForegroundColor Yellow
    }
} else {
    Write-Host "  [WARNING]  Could not find ripgrep binary to replace" -ForegroundColor Yellow
    Write-Host "  You may need to replace it manually" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 5: Modifying native.js for Windows support..." -ForegroundColor Cyan

# Find and modify native.js file
$nativeJsFiles = Get-ChildItem -Path $packageDir -Recurse -Filter "native.js" | Where-Object {
    $_.DirectoryName -like "*merkle*"
}

if ($nativeJsFiles.Count -gt 0) {
    foreach ($nativeJsFile in $nativeJsFiles) {
        Write-Host "  Processing: $($nativeJsFile.FullName)" -ForegroundColor Gray
        
        $content = Get-Content -Path $nativeJsFile.FullName -Raw
        $originalContent = $content
        $modified = $false
        
        # Try multiple patterns to find and replace the unsupported platform error
        $patterns = @(
            # Pattern 1: } else { throw new Error(`Unsupported platform: ${platform3}`); }
            @{
                Pattern = '} else \{\s*throw new Error\([^)]*Unsupported platform[^)]*\);\s*\}'
                Replacement = "} else {`n      // Windows workaround: use darwin-arm64 module`n      nativeBinding = require_merkle_tree_napi_darwin_arm64();`n    }"
            },
            # Pattern 2: throw new Error(`Unsupported platform: ${platform3}`)
            @{
                Pattern = 'throw new Error\([^)]*Unsupported platform[^)]*\);'
                Replacement = "// Windows workaround: use darwin-arm64 module`n      nativeBinding = require_merkle_tree_napi_darwin_arm64();"
            },
            # Pattern 3: } else { ... throw ... }
            @{
                Pattern = '(\} else \{)[\s\S]*?(throw new Error\([^)]*Unsupported platform[^)]*\);)[\s\S]*?(\})'
                Replacement = '$1`n      // Windows workaround: use darwin-arm64 module`n      nativeBinding = require_merkle_tree_napi_darwin_arm64();`n    $3'
            }
        )
        
        foreach ($patternObj in $patterns) {
            if ($content -match $patternObj.Pattern) {
                $content = $content -replace $patternObj.Pattern, $patternObj.Replacement
                $modified = $true
                Write-Host "  [SUCCESS] Modified using pattern matching" -ForegroundColor Green
                break
            }
        }
        
        # If pattern matching didn't work, try line-by-line approach
        if (-not $modified) {
            Write-Host "  Trying line-by-line modification..." -ForegroundColor Yellow
            $lines = Get-Content -Path $nativeJsFile.FullName
            $newLines = @()
            $inElseBlock = $false
            $foundUnsupported = $false
            
            for ($i = 0; $i -lt $lines.Count; $i++) {
                $line = $lines[$i]
                
                # Detect else block start
                if ($line -match '^\s*\} else \{') {
                    $inElseBlock = $true
                    $newLines += $line
                }
                # Detect unsupported platform error
                elseif ($inElseBlock -and $line -match 'Unsupported platform') {
                    $foundUnsupported = $true
                    # Replace with Windows workaround
                    $newLines += "      // Windows workaround: use darwin-arm64 module"
                    $newLines += "      nativeBinding = require_merkle_tree_napi_darwin_arm64();"
                    # Skip the throw line and any closing brace on same line
                    if ($line -notmatch '\}') {
                        # Continue to find the closing brace
                        $inElseBlock = $true
                    } else {
                        $inElseBlock = $false
                    }
                }
                # Handle closing brace of else block
                elseif ($inElseBlock -and $foundUnsupported -and $line -match '^\s*\}') {
                    $newLines += $line
                    $inElseBlock = $false
                    $foundUnsupported = $false
                }
                # Regular line
                else {
                    $newLines += $line
                }
            }
            
            if ($foundUnsupported) {
                $content = $newLines -join "`n"
                $modified = $true
                Write-Host "  [SUCCESS] Modified using line-by-line approach" -ForegroundColor Green
            }
        }
        
        # Key modification: Add Windows platform check before else block
        # This is the critical fix from the GitHub repo
        if (-not $modified) {
            Write-Host "  Attempting direct Windows platform check insertion..." -ForegroundColor Yellow
            
            # Simple approach: Find } else { and replace with Windows check
            # This should work regardless of what's inside the else block
            if ($content -match '\} else \{' -and $content -notmatch 'win32') {
                # Replace the first occurrence of } else { with Windows check
                $windowsCheckCode = @"
} else if (platform3 === "win32") {
      // Windows workaround: use darwin-arm64 module
      nativeBinding = require_merkle_tree_napi_darwin_arm64();
    } else {
"@
                # Use a more specific pattern to avoid replacing all else blocks
                if ($content -match '(\} else \{[\s\S]{0,500}?throw new Error\([^)]*Unsupported platform)') {
                    # Found the specific else block with unsupported platform error
                    $content = $content -replace '(\} else \{)', $windowsCheckCode
                    $modified = $true
                    Write-Host "  [SUCCESS] Added Windows platform check (method 1)" -ForegroundColor Green
                } elseif ($content -match '(\} else \{[\s\S]{0,100}?throw new Error)') {
                    # Found else block with throw error
                    $content = $content -replace '(\} else \{)', $windowsCheckCode, 1
                    $modified = $true
                    Write-Host "  [SUCCESS] Added Windows platform check (method 2)" -ForegroundColor Green
                } else {
                    # Last resort: replace any } else { that appears after platform checks
                    if ($content -match 'platform3 === "darwin"' -or $content -match 'platform3 === "linux"') {
                        $content = $content -replace '(\} else \{)', $windowsCheckCode, 1
                        $modified = $true
                        Write-Host "  [SUCCESS] Added Windows platform check (method 3)" -ForegroundColor Green
                    }
                }
            }
        }
        
        # Final attempt: Direct replacement of the entire else block structure
        if (-not $modified) {
            Write-Host "  Trying comprehensive else block replacement..." -ForegroundColor Yellow
            # Look for: } else { throw new Error(`Unsupported platform: ${platform3}`); }
            $elseBlockPattern = '(\} else \{[\s\S]{0,500}?throw new Error\([^)]*Unsupported platform[^)]*\);[^}]*\})'
            if ($content -match $elseBlockPattern) {
                $replacement = @"
} else if (platform3 === "win32") {
      // Windows workaround: use darwin-arm64 module
      nativeBinding = require_merkle_tree_napi_darwin_arm64();
    } else {
      throw new Error(`Unsupported platform: ${platform3}`);
    }
"@
                $content = $content -replace $elseBlockPattern, $replacement
                $modified = $true
                Write-Host "  [SUCCESS] Replaced else block with Windows support" -ForegroundColor Green
            }
        }
        
        if ($modified) {
            # Save the modified content
            Set-Content -Path $nativeJsFile.FullName -Value $content -NoNewline -Encoding UTF8
            Write-Host "  [SUCCESS] Saved modified native.js" -ForegroundColor Green
            
            # Verify the modification
            $verifyContent = Get-Content -Path $nativeJsFile.FullName -Raw
            if ($verifyContent -match 'require_merkle_tree_napi_darwin_arm64' -or $verifyContent -match 'win32') {
                Write-Host "  [SUCCESS] Verification passed - Windows support added" -ForegroundColor Green
            } else {
                Write-Host "  [WARNING] Modification may not have worked - please verify manually" -ForegroundColor Yellow
            }
        } else {
            Write-Host "  [WARNING] Could not find pattern to modify" -ForegroundColor Yellow
            Write-Host "  Showing relevant lines for manual modification:" -ForegroundColor Yellow
            $lines = Get-Content -Path $nativeJsFile.FullName
            for ($i = 0; $i -lt $lines.Count; $i++) {
                if ($lines[$i] -match 'Unsupported platform' -or $lines[$i] -match '} else \{') {
                    $start = [Math]::Max(0, $i - 2)
                    $end = [Math]::Min($lines.Count - 1, $i + 2)
                    for ($j = $start; $j -le $end; $j++) {
                        Write-Host "    Line $($j + 1): $($lines[$j])" -ForegroundColor Gray
                    }
                    Write-Host ""
                }
            }
        }
    }
} else {
    Write-Host "  [WARNING] Could not find native.js file to modify" -ForegroundColor Yellow
    Write-Host "  Searching for all native.js files..." -ForegroundColor Yellow
    $allNativeJs = Get-ChildItem -Path $packageDir -Recurse -Filter "native.js"
    if ($allNativeJs.Count -gt 0) {
        Write-Host "  Found $($allNativeJs.Count) native.js files:" -ForegroundColor Yellow
        $allNativeJs | ForEach-Object { Write-Host "    $($_.FullName)" -ForegroundColor Gray }
    }
    Write-Host "  You may need to modify it manually" -ForegroundColor Yellow
}

# Verify native.js modification
Write-Host ""
Write-Host "Verifying native.js modification..." -ForegroundColor Cyan
$verifyNativeJs = Get-ChildItem -Path $packageDir -Recurse -Filter "native.js" | Where-Object {
    $_.DirectoryName -like "*merkle*"
} | Select-Object -First 1

if ($verifyNativeJs) {
    $verifyContent = Get-Content -Path $verifyNativeJs.FullName -Raw
    if ($verifyContent -match 'require_merkle_tree_napi_darwin_arm64' -or $verifyContent -match 'win32.*darwin') {
        Write-Host "  [SUCCESS] Windows support confirmed in native.js" -ForegroundColor Green
    } else {
        Write-Host "  [WARNING] Windows support not found in native.js - modification may have failed" -ForegroundColor Yellow
        Write-Host "  File location: $($verifyNativeJs.FullName)" -ForegroundColor Gray
        Write-Host "  Please check the file manually" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Step 6: Creating wrapper script..." -ForegroundColor Cyan

# Create a wrapper script to run cursor-agent
$wrapperScript = Join-Path $installDir "cursor-agent.ps1"
$indexJs = Get-ChildItem -Path $packageDir -Recurse -Filter "index.js" | Select-Object -First 1

if ($indexJs) {
    $indexJsPath = $indexJs.FullName
    $indexJsDir = $indexJs.DirectoryName
    # Calculate relative path from packageDir
    $relativePath = $indexJsPath.Replace($packageDir, "").TrimStart("\", "/")
    
    Write-Host "  Found index.js at: $indexJsPath" -ForegroundColor Gray
    Write-Host "  Relative path: $relativePath" -ForegroundColor Gray
    
    # Create wrapper with both absolute path (for reliability) and relative path (for portability)
    $wrapperContent = @"
# Cursor Agent Windows Wrapper
# Run this script to start cursor-agent

`$scriptPath = Split-Path -Parent `$MyInvocation.MyCommand.Path
`$packageDir = Join-Path `$scriptPath "package"

# Use the known relative path from installation
`$indexJs = Join-Path `$packageDir "$relativePath"

# If not found at relative path, search recursively
if (-not (Test-Path `$indexJs)) {
    `$found = Get-ChildItem -Path `$packageDir -Recurse -Filter "index.js" -ErrorAction SilentlyContinue | Select-Object -First 1
    if (`$found) {
        `$indexJs = `$found.FullName
    }
}

# If still not found, try common locations
if (-not (Test-Path `$indexJs)) {
    `$possiblePaths = @(
        Join-Path `$packageDir "index.js",
        Join-Path (Join-Path `$packageDir "dist") "index.js",
        Join-Path (Join-Path `$packageDir "lib") "index.js"
    )
    foreach (`$path in `$possiblePaths) {
        if (Test-Path `$path) {
            `$indexJs = `$path
            break
        }
    }
}

if (-not (Test-Path `$indexJs)) {
    Write-Host "Error: Could not find index.js in package directory" -ForegroundColor Red
    Write-Host "Package directory: `$packageDir" -ForegroundColor Yellow
    Write-Host "Expected relative path: $relativePath" -ForegroundColor Yellow
    Write-Host "Please check the installation." -ForegroundColor Yellow
    exit 1
}

`$indexJsDir = Split-Path -Parent `$indexJs
Push-Location `$indexJsDir
node `$indexJs `$args
`$exitCode = `$LASTEXITCODE
Pop-Location
exit `$exitCode
"@
    Set-Content -Path $wrapperScript -Value $wrapperContent
    Write-Host "  [SUCCESS] Created wrapper script: $wrapperScript" -ForegroundColor Green
    Write-Host "  Using index.js at: $indexJsPath" -ForegroundColor Gray
} else {
    Write-Host "  [WARNING]  Could not find index.js" -ForegroundColor Yellow
    Write-Host "  Searching in: $packageDir" -ForegroundColor Gray
    Write-Host "  Files found:" -ForegroundColor Gray
    Get-ChildItem -Path $packageDir -Recurse -File | Select-Object -First 10 | ForEach-Object {
        Write-Host "    $($_.FullName)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Installation directory: $installDir" -ForegroundColor Cyan
Write-Host ""

# Ask user if they want to add to PATH
Write-Host ""
Write-Host "Would you like to add cursor-agent to your PATH? (y/n)" -ForegroundColor Yellow
Write-Host "This will allow you to run 'cursor-agent' from any directory." -ForegroundColor Gray
$addToPath = Read-Host

if ($addToPath -eq "y" -or $addToPath -eq "Y") {
    try {
        $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
        
        # Check if already in PATH
        if ($currentPath -like "*$installDir*") {
            Write-Host "  [INFO] Installation directory is already in PATH" -ForegroundColor Cyan
        } else {
            # Add to PATH
            $newPath = $currentPath + ";$installDir"
            [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
            
            # Also update current session PATH
            $env:Path = $env:Path + ";$installDir"
            
            Write-Host "  [SUCCESS] Added to PATH: $installDir" -ForegroundColor Green
            Write-Host "  Note: You may need to restart your terminal for PATH changes to take effect." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  [WARNING] Failed to update PATH: $_" -ForegroundColor Yellow
        Write-Host "  You can add it manually using:" -ForegroundColor Yellow
        $manualCommand = '[Environment]::SetEnvironmentVariable("Path", $env:Path + ";' + $installDir + '", "User")'
        Write-Host "  $manualCommand" -ForegroundColor Cyan
    }
} else {
    Write-Host "  Skipped PATH update. You can add it manually later." -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Usage Instructions" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($wrapperScript -and (Test-Path $wrapperScript)) {
    Write-Host "To use cursor-agent:" -ForegroundColor Yellow
    if ($addToPath -eq "y" -or $addToPath -eq "Y") {
        Write-Host "  cursor-agent [arguments]" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Or use full path:" -ForegroundColor Gray
    }
    Write-Host "  & '$wrapperScript' [arguments]" -ForegroundColor Cyan
} else {
    Write-Host "To use cursor-agent, navigate to:" -ForegroundColor Yellow
    Write-Host "  $packageDir" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Then run:" -ForegroundColor Yellow
    Write-Host "  node index.js [arguments]" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Post-Installation Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test if cursor-agent can run
Write-Host "Testing cursor-agent installation..." -ForegroundColor Cyan
if ($wrapperScript -and (Test-Path $wrapperScript)) {
    Write-Host "  Running: $wrapperScript --help" -ForegroundColor Gray
    $testResult = & $wrapperScript --help 2>&1
    $testExitCode = $LASTEXITCODE
    
    if ($testExitCode -eq 0) {
        Write-Host "  [SUCCESS] cursor-agent is working!" -ForegroundColor Green
    } else {
        Write-Host "  [WARNING] cursor-agent test failed with exit code: $testExitCode" -ForegroundColor Yellow
        Write-Host "  Error output:" -ForegroundColor Yellow
        $testResult | Select-Object -First 10 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
        
        # Check if it's the native.js issue
        if ($testResult -match "Unsupported platform" -or $testResult -match "Failed to load native binding") {
            Write-Host ""
            Write-Host "  [INFO] This appears to be a native.js modification issue." -ForegroundColor Yellow
            Write-Host "  The native.js file may need manual modification." -ForegroundColor Yellow
            Write-Host ""
            Write-Host "  Manual fix instructions:" -ForegroundColor Cyan
            Write-Host "  1. Find native.js in: $packageDir" -ForegroundColor Gray
            Write-Host "  2. Look for: } else { throw new Error(`Unsupported platform: ...`); }" -ForegroundColor Gray
            Write-Host "  3. Replace with:" -ForegroundColor Gray
            Write-Host "     } else if (platform3 === `"win32`") {" -ForegroundColor Gray
            Write-Host "       nativeBinding = require_merkle_tree_napi_darwin_arm64();" -ForegroundColor Gray
            Write-Host "     } else {" -ForegroundColor Gray
            Write-Host "       throw new Error(`Unsupported platform: ...`);" -ForegroundColor Gray
            Write-Host "     }" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "  [INFO] Wrapper script not found, skipping test" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Note: This is an unofficial workaround. For official support, use WSL." -ForegroundColor Yellow

