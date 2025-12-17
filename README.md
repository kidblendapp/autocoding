# JIRA Extraction and Schedule Calculation System

A Node.js/TypeScript CLI tool for extracting JIRA tickets, generating team configurations, and calculating project schedules based on team velocity and capacity.

## Features

- **Direct JIRA Integration**: Extract tickets directly from JIRA REST API v3
- **Comprehensive Field Extraction**: Extract all relevant ticket fields including custom fields
- **Change History Tracking**: Optional extraction of change history for Status, Sprint, Original Estimate, and Story Points
- **Team Configuration Generation**: Automatically generate team configurations from ticket tags and assignees
- **Schedule Calculation**: Calculate project schedules based on team velocity and working days
- **CSV Export**: Export extracted data to CSV format for analysis

## Prerequisites

- Node.js (LTS v18+)
- npm or pnpm
- JIRA API access (email and API token)

## Installation

```bash
npm install
```

## Configuration

### JIRA Configuration

Create a `jira-config.json` file in the project root:

```json
{
  "jiraPath": "https://your-instance.atlassian.net",
  "jiraEmail": "your-email@example.com",
  "jiraApiToken": "your-api-token",
  "projectName": "PROJECT"
}
```

To get your JIRA API token:
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Create a new API token
3. Copy the token to `jira-config.json`

## Usage Scenarios

### Scenario 1: Extract All JIRA Tickets

Extract all tickets from a JIRA project and export to CSV:

```bash
npx tsx extract-jira-estimates.ts
```

This will:
- Extract all tickets from the project (handles pagination automatically)
- Export to `outputs/jira-export.csv`
- Generate a separate `outputs/jira-export-sprints.csv` with unique sprint details

**Output Files:**
- `outputs/jira-export.csv`: Main ticket export with all fields
- `outputs/jira-export-sprints.csv`: Unique sprint details

**Extracted Fields:**
- Issue Key, Summary, Issue Type, Status, Status Category, Priority
- Assignee, Reporter, Creator
- Story Points (from `customfield_10052`)
- Original Estimate (from `customfield_10410` or `timeoriginalestimate`)
- Time Estimate, Component, Parent Id, Epic Link
- Labels, Fix Versions, Versions, Sprint
- Created, Updated, Resolution Date, Due Date, Resolution

### Scenario 2: Extract Tickets with Change History

Extract tickets including change history for Status, Sprint, Original Estimate, and Story Points:

```bash
npx tsx extract-jira-estimates.ts --history
```

This will:
- Extract all tickets as in Scenario 1
- Additionally fetch change history for each ticket
- Append history columns to the CSV export

**Additional CSV Columns:**
- Status History: JSON array of status changes with value, timestamp, and user
- Sprint History: JSON array of sprint changes
- Original Estimate History: JSON array of estimate changes
- Story Points History: JSON array of story point changes

**Note:** History extraction is slower as it requires additional API calls per ticket. Tickets are processed in batches of 10 to avoid rate limits.

### Scenario 3: Extract Team Configuration from CSV

Generate team configuration based on tags in ticket summaries and assignees:

```bash
npx tsx extract-teams-from-csv.ts
```

This will:
- Parse `outputs/jira-export.csv`
- Extract unique tags from ticket summaries (e.g., `[FE]`, `[BE]`, `[SFMC]`, `[CRM]`)
- Map tags to assignees
- Generate `teams_config.json` with team definitions

**Input:** `outputs/jira-export.csv`

**Output:** `teams_config.json`

**Example Output:**
```json
{
  "projectStartDate": "2025-01-01",
  "sprintDurationDays": 10,
  "teams": [
    {
      "id": "team-fe",
      "name": "Frontend Team",
      "velocity": 20,
      "velocityPeriod": "sprint",
      "members": ["User 1", "User 2"],
      "matchRules": {
        "components": ["UI", "Frontend"]
      }
    },
    {
      "id": "team-be",
      "name": "Backend Team",
      "velocity": 20,
      "velocityPeriod": "sprint",
      "members": ["User 3", "User 4"],
      "matchRules": {
        "components": ["Backend", "API"]
      }
    }
  ]
}
```

### Scenario 4: Inspect Specific Ticket Fields

Inspect all fields for a specific JIRA ticket to identify custom field IDs:

```bash
npx tsx inspect-ticket-fields.ts
```

Edit `inspect-ticket-fields.ts` to change the ticket key (default: `PSME-2777`).

This will:
- Fetch all fields for the specified ticket
- Display field names and values
- Save full ticket data to `outputs/psme-160-fields.json` (filename reflects the ticket key)

**Use Case:** Identify custom field IDs for fields like Team name, Original Estimate, Story Points, etc.

### Scenario 5: Calculate Schedule from CSV

Calculate project schedule based on team velocity and working days:

```bash
npm run build
node dist/index.js calculate-schedule --input outputs/jira-export.csv --config teams_config.json --output outputs/schedule.json
```

This will:
- Parse tickets from CSV
- Match tickets to teams based on configuration rules
- Calculate start and end dates based on team velocity
- Account for working days (excludes weekends and holidays)
- Export scheduled tasks to JSON

## CLI Commands

### Extract JIRA Tickets

```bash
# Using standalone script
npx tsx extract-jira-estimates.ts [--history] [--config jira-config.json] [--output outputs/jira-export.csv]

# Using CLI (after build)
npm run build
node dist/index.js extract-jira [--history] [--config jira-config.json] [--output outputs/jira-export.csv]
```

**Options:**
- `--history`: Include change history for Status, Sprint, Original Estimate, and Story Points
- `--config`: Path to JIRA configuration file (default: `jira-config.json`)
- `--output`: Path to output CSV file (default: `outputs/jira-export.csv`)

### Calculate Schedule

```bash
npm run build
node dist/index.js calculate-schedule --input <csv-file> --config <config-file> --output <output-file>
```

**Options:**
- `--input`: Path to CSV file with tickets
- `--config`: Path to team configuration file
- `--output`: Path to output JSON file

## Custom Field Mapping

The system extracts data from the following JIRA custom fields:

| Field ID | Field Name | Data Type | Description |
|----------|------------|-----------|-------------|
| `customfield_10052` | Story Points | Number | Story points estimate |
| `customfield_10410` | Original Estimate | Number | Original time estimate (numeric) |
| `customfield_10014` | Epic Link | String | Link to parent epic |
| `customfield_10010` | Sprint | Array | Sprint information (name, dates, state) |
| `customfield_10001` | Team | Object | Team name (e.g., "PSME-FE") |

## Pagination Strategy

The JIRA extraction uses a key-range based pagination strategy because `/rest/api/3/search/jql` does not support `startAt` for pagination:

1. First batch: `project = PROJECT ORDER BY key ASC` (first 100 tickets)
2. Subsequent batches: `project = PROJECT AND issueKey > "PROJECT-100" AND issueKey <= "PROJECT-200" ORDER BY key ASC`
3. Continues until no tickets are returned

This approach handles projects with 2000+ tickets efficiently.

## Output Files

### `outputs/jira-export.csv`

Main ticket export with the following columns:
- Issue Key, Summary, Issue Type, Status, Status Category, Priority
- Assignee, Reporter, Creator
- Story Points, Original Estimate, Time Estimate
- Component, Parent Id, Epic Link
- Labels, Fix Versions, Versions, Sprint
- Created, Updated, Resolution Date, Due Date, Resolution
- (Optional) Status History, Sprint History, Original Estimate History, Story Points History

### `outputs/jira-export-sprints.csv`

Unique sprint details with columns:
- Sprint ID, Name, Start Date, End Date, Complete Date, State, Board ID, Goal

### `teams_config.json`

Team configuration file with:
- Project start date
- Sprint duration (days)
- Team definitions (ID, name, velocity, members, match rules)

## Error Handling

- **API Errors**: Logged with detailed error messages, processing continues with valid tickets
- **Missing Fields**: Logged as warnings, missing values exported as empty strings
- **Invalid Data**: Logged but doesn't stop processing
- **File Locking**: If CSV file is open, close it and retry

## Development

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Lint

```bash
npm run lint
```

## Architecture

- **Data Ingestion**: `src/services/jira-extractor.ts` - JIRA API integration
- **Change History**: `src/services/jira-extractor.ts` - Changelog extraction
- **CSV Export**: `src/services/jira-extractor.ts` - CSV generation
- **Team Configuration**: `extract-teams-from-csv.ts` - Team config generation
- **Schedule Calculation**: `src/calculators/schedule-calculator.ts` - Schedule engine

## Troubleshooting

### "JIRA API request failed: 401 Unauthorized"
- Verify your API token in `jira-config.json`
- Ensure your email and token are correct
- Check that your JIRA instance URL is correct

### "JIRA API request failed: 400 Bad Request"
- Check JQL query syntax
- Verify project name is correct
- Ensure custom field IDs exist in your JIRA instance

### "EBUSY: resource busy or locked"
- Close the CSV file if it's open in Excel or another application
- Retry the extraction

### History extraction is slow
- This is expected for large projects (2000+ tickets)
- Tickets are processed in batches of 10 to avoid rate limits
- Consider running without `--history` flag for initial extraction

## License

[Your License Here]

