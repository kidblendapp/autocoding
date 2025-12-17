# Extract Merged Pull Request Descriptions
# This script fetches the descriptions of merged PRs into main branch

param(
    [Parameter(Mandatory=$false)]
    [int]$Count = 5,
    [Parameter(Mandatory=$false)]
    [string]$OutputFile = "merged_prs_description.txt"
)

Write-Host "Fetching last $Count merged pull requests..." -ForegroundColor Cyan

try {
    # Get merged PRs using GitHub CLI
    $prData = gh pr list --state merged --limit $Count --json number,title,body,mergedAt,url,author | ConvertFrom-Json
    
    if ($prData.Count -eq 0) {
        Write-Host "No merged pull requests found." -ForegroundColor Yellow
        exit 0
    }
    
    Write-Host "Found $($prData.Count) merged pull request(s)" -ForegroundColor Green
    
    # Build output content
    $output = @"
================================================================================
MERGED PULL REQUESTS INTO MAIN
================================================================================
Extracted: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Total PRs: $($prData.Count)

"@
    
    # Process each PR
    for ($i = 0; $i -lt $prData.Count; $i++) {
        $pr = $prData[$i]
        
        Write-Host "`n[$($i + 1)/$($prData.Count)] Processing PR #$($pr.number)..." -ForegroundColor Yellow
        
        $output += @"
================================================================================
PULL REQUEST #$($pr.number)
================================================================================
Title: $($pr.title)
Merged: $($pr.mergedAt)
Author: $($pr.author.login)
URL: $($pr.url)

--- Description ---

$($pr.body)

"@
        
        # Add separator between PRs (except for the last one)
        if ($i -lt $prData.Count - 1) {
            $output += "`n" + ("=" * 80) + "`n`n"
        }
    }
    
    # Save to file
    $output | Out-File -FilePath $OutputFile -Encoding UTF8
    Write-Host "`n✅ All descriptions saved to: $OutputFile" -ForegroundColor Green
    
    # Also save as JSON for structured data
    $jsonFile = $OutputFile -replace '\.txt$', '.json'
    $prData | ConvertTo-Json -Depth 10 | Out-File -FilePath $jsonFile -Encoding UTF8
    Write-Host "✅ JSON data saved to: $jsonFile" -ForegroundColor Green
    
    # Display summary
    Write-Host "`n=== Summary ===" -ForegroundColor Cyan
    foreach ($pr in $prData) {
        Write-Host "PR #$($pr.number): $($pr.title)" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    Write-Host "Make sure GitHub CLI (gh) is installed and authenticated." -ForegroundColor Yellow
    Write-Host "Run: gh auth login" -ForegroundColor Gray
    exit 1
}

