# Figma Design to Acceptance Criteria Matching Rules

## Overview

This document provides guidelines for matching Figma design screens to Story Acceptance Criteria (ACs) using AI-powered multimodal analysis.

## Workflow

### Step 1: Extract Figma URL
- Default: Parse from ticket description using regex pattern for figma.com URLs
- Alternative: Read from custom Jira/ADO field (configurable via `figmaUrlField` param)

### Step 2: Discover Screens
Use `figma_get_layers` MCP tool to get hierarchical structure:
```javascript
const layers = figma_get_layers({ href: figmaUrl });
// Returns: { children: [{ id, name, type, width, height }] }
```

### Step 3: Download Previews
Use `figma_download_node_image` for each screen:
```javascript
const imagePath = figma_download_node_image({
    href: baseUrl,
    nodeId: "123:456",
    format: "png",
    scale: 2
});
```

### Step 4: AI Multimodal Analysis
Use `gemini_ai_chat_with_files` with screen images:
```javascript
const analysis = gemini_ai_chat_with_files({
    message: analysisPrompt,
    filePaths: ["/path/to/screen1.png", "/path/to/screen2.png"]
});
```

## Matching Principles

### 1. Screen Name Analysis
- Screen names often indicate their purpose (e.g., "Login", "Dashboard", "Settings")
- Component names within screens provide additional context
- Design system naming conventions should be respected

### 2. Visual Content Analysis
- Analyze UI elements visible in screen screenshots
- Form fields suggest data entry requirements
- Buttons indicate user actions
- Tables/lists suggest data display requirements
- Navigation elements indicate flow between screens

### 3. Story Context Alignment
- Match screens to the business context described in the story
- Consider the user journey implied by the requirements
- Account for edge cases mentioned in the story

## Confidence Levels

| Level | Criteria | Example |
|-------|----------|---------|
| **High** | Direct name match OR obvious functional match | Screen "Login" → AC "User Login" |
| **Medium** | Related but covers multiple ACs or partial match | Screen "Dashboard" → AC "View Stats" + AC "Navigation" |
| **Low** | Possible but uncertain connection | Screen "Settings" → AC "User Preferences" |

## Matching Rules

### Rule 1: Direct Name Match
If a screen name contains keywords from an AC title, it's likely a match.

```
AC: "User Login" → Screen: "Login Screen" = High confidence
```

### Rule 2: Functional Match
If a screen's visible UI elements implement the functionality described in an AC.

```
AC: "User can enter credentials" → Screen with email/password fields = High confidence
```

### Rule 3: Flow Match
Sequential screens may match ACs that describe a multi-step process.

```
AC: "User completes checkout" → Screens: "Cart", "Shipping", "Payment", "Confirmation"
```

### Rule 4: Component Match
Individual components within screens may match specific AC requirements.

```
AC: "Display user avatar" → Header component with avatar element
```

### Rule 5: State Match
Different states of the same screen may cover different AC scenarios.

```
AC: "Error handling" → Screen "Login - Error State"
AC: "Success feedback" → Screen "Login - Success"
```

## Handling Edge Cases

### No ACs in Story
When story has no explicit Acceptance Criteria:
1. Analyze all screens for functionality
2. Generate suggested ACs based on UI capabilities
3. Group related screens under single AC
4. Follow standard AC format: "AC N - Title"

### Unmatched Screens
When screens don't match any existing AC:
1. Report as `unmatchedScreens` in output
2. Suggest potential AC title for each
3. May indicate missing requirements (gap analysis)

### Multiple Screens per AC
When an AC spans a flow:
1. Include all relevant screen IDs in `screenIds` array
2. Mention the flow in rationale
3. Order screens by logical flow sequence

## Output Format

See `output_formatting_rules.md` for detailed JSON and Markdown format specifications.

## Best Practices

1. **Be Conservative**: Only create matches with reasonable confidence
2. **Consider Multiple Matches**: One screen may serve multiple ACs
3. **Note Gaps**: Identify screens without matching ACs
4. **Preserve Context**: Include rationale for matches
5. **Respect Hierarchy**: Parent screens may contain child components
6. **Use Correct ID Format**: Colon format in JSON (123:456), dash format in URLs (123-456)

## MCP Tools Reference

| Tool | Purpose | Parameters |
|------|---------|------------|
| `figma_get_layers` | Get screen hierarchy | `href` |
| `figma_download_node_image` | Download screenshot | `href`, `nodeId`, `format`, `scale` |
| `figma_get_node_details` | Get CSS properties | `href`, `nodeIds` |
| `gemini_ai_chat_with_files` | Multimodal analysis | `message`, `filePaths` |
| `jira_attach_file_to_ticket` | Attach screenshots | `ticketKey`, `name`, `path` |
| `jira_add_label` | Add tracking label | `key`, `label` |
