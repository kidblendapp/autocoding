# Figma Design References Output Formatting Rules

## Response Format

The response must be a valid JSON object with the following structure:

```json
{
  "matches": [
    {
      "acId": "AC1",
      "acTitle": "User Login",
      "screenIds": ["123:456", "123:457"],
      "confidence": "high",
      "rationale": "Login screen contains email/password fields matching AC requirements"
    }
  ],
  "suggestedAcs": [
    {
      "acId": "AC1",
      "title": "User Registration",
      "screenIds": ["123:458"],
      "requirements": [
        "User can enter registration details",
        "Form validates input fields"
      ]
    }
  ],
  "unmatchedScreens": [
    {
      "screenId": "123:459",
      "screenName": "Settings",
      "suggestedAcTitle": "User Settings Management"
    }
  ]
}
```

## Field Descriptions

### matches (Array)
Used when story has existing Acceptance Criteria:
- `acId`: AC identifier (e.g., "AC1", "AC2")
- `acTitle`: Title of the Acceptance Criteria
- `screenIds`: Array of Figma node IDs in colon format (e.g., "123:456")
- `confidence`: "high", "medium", or "low"
- `rationale`: Brief explanation of why these screens match this AC

### suggestedAcs (Array)
Used when story has NO existing Acceptance Criteria:
- `acId`: Suggested AC identifier
- `title`: Suggested AC title based on screen analysis
- `screenIds`: Array of related Figma node IDs
- `requirements`: Array of requirement bullet points

### unmatchedScreens (Array)
Screens that don't match any existing AC (for gap analysis):
- `screenId`: Figma node ID
- `screenName`: Screen name from Figma
- `suggestedAcTitle`: Optional suggested AC if this screen should have one

## Markdown Output Format

### AC-Driven Mode (default)

```markdown
## Acceptance Criteria with Design References

**AC 1 - User Login**
- [ ] User can enter email and password
- [ ] Login button triggers authentication
- :art: **Design**: [Login Screen](https://figma.com/design/xxx?node-id=123-456) | [View attachment](login_screen.png)

**AC 2 - Dashboard Overview**
- [ ] User sees summary metrics
- :art: **Design**: [Dashboard](https://figma.com/design/xxx?node-id=123-789)
```

### Screen-Centric Mode

```markdown
## Design References

| Screen | Related ACs | Figma Link | Attachment |
|--------|-------------|------------|------------|
| Login Screen | AC 1 | [View](https://figma.com/...) | ![](login.png) |
| Dashboard | AC 2, AC 3 | [View](https://figma.com/...) | ![](dashboard.png) |
```

### Hybrid Mode

Combines both AC-driven content and screen summary table.

## Important Rules

1. **Screen IDs**: Always use colon format in JSON (e.g., "123:456"), not dash format
2. **URLs**: Use dash format in Figma URLs (e.g., "node-id=123-456")
3. **Confidence Levels**:
   - High: Direct name match or obvious functional match
   - Medium: Related but not explicit match
   - Low: Possible but uncertain connection
4. **Rationale**: Keep brief (1-2 sentences) but specific
5. **JSON Validation**: Response must be valid JSON - no trailing commas, proper escaping
