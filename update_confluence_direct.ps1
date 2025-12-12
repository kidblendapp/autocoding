# Direct Confluence REST API update script
# This script updates the Confluence page directly using REST API

$body = @'
<h1>JIRA Template: Story</h1><p>This template provides a structure for creating Story issues in JIRA, focusing on business and user requirements without technical implementation details.</p><h2>Summary Format</h2><p><code>As a [user type], I want [functionality] so that [benefit]</code></p><p><em>Example: As a new user, I want to register with my email so that I can access the application</em></p><h2>Description Template</h2><pre>## User Story
As a [user type]
I want [specific functionality]
So that [business value/benefit]

## Parent Epic
- Epic: [KIDBLEND-XXX - Epic Name]
- Story contribution: [How this story contributes to the Epic]

## Detailed Requirements
### Functional Requirements
1. [Specific requirement 1 with acceptance criteria]
2. [Specific requirement 2 with acceptance criteria]
3. [Specific requirement 3 with acceptance criteria]
4. [Specific requirement 4 with acceptance criteria]
5. [Specific requirement 5 with acceptance criteria]

### Business Rules
1. [Rule 1: condition and outcome]
2. [Rule 2: condition and outcome]
3. [Rule 3: condition and outcome]

### User Interface Requirements
- Screen/Component: [Name]
- Layout: [Description or mockup reference]
- User interactions: [Click, type, select, etc.]
- Responsive behavior: [Mobile, tablet, desktop]
- Visual design: [Design system references, color schemes, typography]
- Accessibility: [WCAG requirements, keyboard navigation, screen reader support]

## Acceptance Criteria
### Functional Criteria
- [ ] Given [context], When [action], Then [outcome]
- [ ] Given [context], When [action], Then [outcome]
- [ ] Given [context], When [action], Then [outcome]
- [ ] All business rules implemented and validated
- [ ] All error cases handled with appropriate user-friendly messages

### User Experience Criteria
- [ ] User can complete the task without confusion
- [ ] Error messages are clear and actionable
- [ ] Loading states are appropriately displayed
- [ ] Success feedback is provided to the user

### Quality Criteria
- [ ] Feature works as expected in all supported browsers
- [ ] Feature works correctly on mobile devices
- [ ] Accessibility standards met (WCAG 2.1 AA)
- [ ] User documentation updated (if applicable)</pre><h2>Required Fields</h2><table><tbody><tr><th>Field</th><th>Description</th><th>Example Value</th></tr><tr><td>Issue Type</td><td>Story</td><td>Story</td></tr><tr><td>Priority</td><td>Story priority</td><td>High</td></tr><tr><td>Components</td><td>Affected components</td><td>API, Frontend, Database</td></tr><tr><td>Fix Version/s</td><td>Target release</td><td>Sprint 5</td></tr><tr><td>Epic Link</td><td>Parent Epic</td><td>KIDBLEND-150</td></tr><tr><td>Labels</td><td>Story tags</td><td>user-registration, api, frontend</td></tr><tr><td>Story Points</td><td>Estimation (1,2,3,5,8)</td><td>3</td></tr><tr><td>Sprint</td><td>Assigned sprint</td><td>Sprint 5</td></tr><tr><td>Assignee</td><td>AI Assistant or Project Lead</td><td>AI Assistant</td></tr></tbody></table><h2>Additional Notes</h2><ul><li>Stories should be completable within one sprint (1-5 days)</li><li>Each story should deliver working, tested functionality</li><li>Technical implementation details should be handled in Solution Design and Development tickets</li><li>Focus on <strong>what</strong> needs to be built, not <strong>how</strong> it should be built</li></ul><h2>Next Steps</h2><p>After story requirements are approved:</p><ol><li>Create <strong>Solution Design</strong> tickets for technical architecture and design decisions</li><li>Create <strong>Development</strong> tickets for implementation work</li><li>Reference this story in all related technical tickets</li></ol>
'@

# Load environment variables from dmtools.env file
$envFile = "dmtools.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
    Write-Host "Loaded environment variables from $envFile"
} else {
    Write-Host "Warning: $envFile not found, using system environment variables"
}

# Get current page to retrieve version number
$contentId = "786465"
$basePath = $env:CONFLUENCE_BASE_PATH
$email = $env:CONFLUENCE_EMAIL
$apiToken = $env:CONFLUENCE_API_TOKEN

if (-not $basePath) {
    Write-Host "Error: CONFLUENCE_BASE_PATH environment variable not set"
    exit 1
}

if (-not $email) {
    Write-Host "Error: CONFLUENCE_EMAIL environment variable not set"
    exit 1
}

if (-not $apiToken) {
    Write-Host "Error: CONFLUENCE_API_TOKEN environment variable not set"
    exit 1
}

# Create Basic Auth header
$base64AuthInfo = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${email}:${apiToken}"))
$headers = @{
    "Authorization" = "Basic $base64AuthInfo"
    "Content-Type" = "application/json"
    "Accept" = "application/json"
}

Write-Host "Fetching current page version..."
Write-Host "Base path: $basePath"
Write-Host "Content ID: $contentId"

# Get current page version
$getUrl = "${basePath}/rest/api/content/${contentId}?expand=version,body.storage"
Write-Host "Fetch URL: $getUrl"
try {
    $currentPage = Invoke-RestMethod -Uri $getUrl -Headers $headers -Method Get
    $currentVersion = $currentPage.version.number
    Write-Host "Current version: $currentVersion"
    Write-Host "Current title: $($currentPage.title)"
} catch {
    Write-Host "Error fetching current page: $_"
    Write-Host "URL tried: $getUrl"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response body: $responseBody"
    }
    exit 1
}

# Prepare update payload
$updatePayload = @{
    id = $contentId
    type = "page"
    title = "JIRA Template: Story"
    space = @{
        key = "AC"
    }
    body = @{
        storage = @{
            value = $body
            representation = "storage"
        }
    }
    version = @{
        number = ($currentVersion + 1)
    }
} | ConvertTo-Json -Depth 10

Write-Host "Updating Confluence page..."

# Update the page
$updateUrl = "$basePath/rest/api/content/$contentId"
try {
    $response = Invoke-RestMethod -Uri $updateUrl -Headers $headers -Method Put -Body $updatePayload
    Write-Host "✅ Confluence page updated successfully!"
    Write-Host "New version: $($response.version.number)"
    Write-Host "Page URL: $($response._links.webui)"
    
    # Add history comment (optional - page update already succeeded)
    Write-Host "Adding history comment..."
    $commentUrl = "${basePath}/rest/api/content/${contentId}/comment"
    $commentPayload = @{
        body = @{
            storage = @{
                value = "<p>Reduced template to focus only on business/user requirements and acceptance criteria. Removed all technical implementation details, which should be handled in Solution Design and Development tickets.</p>"
                representation = "storage"
            }
        }
    } | ConvertTo-Json -Depth 10
    
    try {
        $commentResponse = Invoke-RestMethod -Uri $commentUrl -Headers $headers -Method Post -Body $commentPayload
        Write-Host "✅ History comment added!"
    } catch {
        Write-Host "⚠️  Could not add comment (page update succeeded): $_"
        # Comment is optional, so we don't fail the script
    }
    
} catch {
    Write-Host "❌ Error updating page: $_"
    if ($_.ErrorDetails.Message) {
        Write-Host "Error details: $($_.ErrorDetails.Message)"
    }
    exit 1
}

