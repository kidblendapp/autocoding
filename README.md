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

### Schedule Configuration

Create a `schedule_config.json` file in the project root for schedule calculations:

```json
{
  "projectStartDate": "2026-01-01",
  "sprintDurationDays": 10,
  "jql": "project = PROJECT AND issuetype = Story AND fixVersion in (\"MVP 1.0\", \"MVP 2.0\")",
  "planningIssueTypes": ["Story"],
  "planningFixVersions": ["MVP 1.0", "MVP 2.0"],
  "teams": { ... }
}
```

**Key Configuration Fields:**
- **`jql`**: Custom JQL query to filter tickets during extraction from JIRA. If not provided, defaults to `project = PROJECTNAME ORDER BY key ASC`.
- **`planningIssueTypes`** and **`planningFixVersions`**: Used for planning operations (decomposition, schedule generation), not for extraction filtering.

See `examples/schedule_config.example.json` for a complete example.

## Usage Scenarios

### Scenario 1: Extract All JIRA Tickets

Extract all tickets from a JIRA project and export to CSV:

```bash
npx tsx extract-jira-estimates.ts
```

This will:
- Extract all tickets from the project (handles pagination automatically)
- Use JQL query from `schedule_config.json` if provided, otherwise extracts all tickets from the project
- Export to `outputs/jira-export.csv`
- Generate a separate `outputs/jira-export-sprints.csv` with unique sprint details

**Filtering Tickets:**
- Configure a custom JQL query in `schedule_config.json` to filter which tickets are extracted
- Example: `"jql": "project = PROJECT AND issuetype = Story AND status != Done"`
- If no JQL is specified, all tickets from the project are extracted

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

### Scenario 6: Generate Gantt Chart Schedule

Generate a per-team schedule with BA/Dev/QA segments for Gantt chart visualization:

```bash
npx tsx generate-team-schedule-from-jira.ts
```

This will:
- Read `outputs/jira-export.csv` (generated by `extract-jira-estimates.ts`)
- Load team configuration from `schedule_config.json`
- Filter tickets by `planningIssueTypes` and `planningFixVersions` if specified (for planning operations only)
- For each ticket:
  - Extract estimate (Story Points or Original Estimate)
  - Split effort into BA (25%), Dev (45%), QA (30%)
  - Calculate sequential schedules per team using working hours (09:00-13:00, 14:00-18:00, Mon-Fri)
  - Apply velocity-based duration scaling
- Generate `outputs/jira-team-schedule.csv` with start/end timestamps

**Output:** `outputs/jira-team-schedule.csv` with columns:
- Issue Key, Summary, Issue Type, Status, Jira Team
- Role (BA/Dev/QA), Execution Team
- Estimate Hours, Story Points
- Start, End (datetime strings)

### Scenario 7: Generate Excel Gantt Chart

Convert the team schedule CSV to Excel format for Gantt visualization:

```bash
npx tsx generate-team-schedule-xlsx.ts
```

This will:
- Read `outputs/jira-team-schedule.csv`
- Add calculated duration columns (Duration Hours, Duration Days)
- Generate `outputs/jira-team-schedule.xlsx` with:
  - Formatted date columns
  - Frozen header row
  - Ready for Gantt chart creation in Excel or project management tools

**Output:** `outputs/jira-team-schedule.xlsx` - Excel file ready for Gantt chart visualization

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

The system extracts data from JIRA custom fields. Custom field IDs are configurable through the UI (Field Mapping tab) or in `jira-config.json`.

### Default Custom Field Mappings

| Field Name | Default Field ID | Data Type | Description |
|------------|------------------|-----------|-------------|
| Team | `customfield_10001` | Object | Team name (e.g., "PSME-FE") |
| Story Points | `customfield_10052` | Number | Story points estimate |
| Original Estimate | `customfield_10410` | Number | Original time estimate (numeric) |
| Epic Link | `customfield_10008` | String | Link to parent epic |
| Sprint | `customfield_10010` | Array | Sprint information (name, dates, state) |
| Date Field | `customfield_10098` | Date | Custom date field |
| DateTime Field | `customfield_10012` | DateTime | Custom date-time field |

### Configuring Custom Fields

1. **Via UI**: Navigate to Configuration → Field Mapping tab
   - Configure custom field IDs for each field type
   - Set optional display names for better readability
   - Field IDs must follow pattern: `customfield_XXXXX` where XXXXX is numeric

2. **Via Config File**: Edit `jira-config.json`:
   ```json
   {
     "customFieldMapping": {
       "team": "customfield_10001",
       "storyPoints": "customfield_10052",
       "originalEstimate": "customfield_10410",
       "epicLink": "customfield_10008",
       "sprint": "customfield_10010",
       "dateField": "customfield_10098",
       "dateTimeField": "customfield_10012"
     },
     "customFieldNames": {
       "customfield_10001": "Team",
       "customfield_10052": "Story Points"
     }
   }
   ```

### Finding Custom Field IDs in JIRA

To find custom field IDs in your JIRA instance:

1. Navigate to any ticket in JIRA
2. Inspect the page source or use browser developer tools
3. Look for field IDs in the HTML (e.g., `id="customfield_10001"`)
4. Or use the JIRA REST API: `GET /rest/api/3/field` to list all fields
5. Or use the UI's "Inspect Ticket Fields" feature in JIRA Operations

**Note**: Custom field IDs are project-specific. If you're working with multiple JIRA projects, you may need different configurations.

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

### `outputs/jira-team-schedule.csv`

Per-team schedule with BA/Dev/QA segments for Gantt chart visualization:
- Issue Key, Summary, Issue Type, Status, Jira Team
- Role (BA/Dev/QA), Execution Team
- Estimate Hours, Story Points
- Start, End (datetime in format "YYYY-MM-DD HH:mm")

**Schedule Calculation:**
- Each ticket is split into BA (25%), Dev (45%), QA (30%) effort segments
- BA and QA segments are scheduled sequentially across all tickets
- Dev segments are scheduled sequentially per JIRA team (parallel streams)
- Working hours: 09:00-13:00 and 14:00-18:00, Monday-Friday
- Duration scaled by team velocity: `durationHours = effortHours × (sprintDays / velocity)`

### `outputs/jira-team-schedule.xlsx`

Excel file for Gantt chart visualization:
- All columns from `jira-team-schedule.csv`
- Additional calculated columns: Duration Hours, Duration Days
- Formatted date/time columns
- Frozen header row for easy navigation
- Ready for Gantt chart creation in Excel, Microsoft Project, or other tools

### `schedule_config.json`

Schedule configuration file with:
- Project start date
- Optional project rescheduling date
- Sprint duration (days)
- JQL query for filtering tickets during extraction
- Planning issue types and fix versions (for planning operations)
- Team definitions (ID, name, velocity, members, match rules)
- Work types and work type sequences
- Predecessor link types
- Estimate type (story points or hours)
- Non-working days (holidays)

See `examples/schedule_config.example.json` for a complete example.

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

### Testing

The project includes comprehensive test coverage with multiple testing levels:

#### Unit Tests

Run unit tests for individual components:

```bash
npm test
```

Or run in watch mode for development:

```bash
npm run test:watch
```

Run specific unit test suites:

```bash
npm run test:unit
```

**Test Coverage:**
- Configuration validation and loading
- Schedule calculators
- Working days calculator
- CSV parsers
- Output generators
- Service utilities (story analyzer, subtask matcher, change history extractor)
- Models (Task, ScheduledTask)

#### Integration Tests

Test API routes and service integrations:

```bash
npm run test:integration
```

**Coverage:**
- Configuration API routes
- JIRA API routes
- File system operations
- Error handling

#### Smoke Tests

Quick smoke tests to verify basic functionality:

```bash
npm run test:smoke
```

**Coverage:**
- Health check endpoint
- Configuration API availability
- JIRA API connectivity

#### End-to-End (E2E) Tests

Run Playwright E2E tests for the UI:

```bash
npm run test:e2e
```

Or run with UI mode for debugging:

```bash
npm run test:e2e:ui
```

**Coverage:**
- JIRA configuration page
- Schedule configuration page
- UI interactions and workflows

**Note:** E2E tests automatically start the backend and frontend servers. Ensure ports 3000 and 3001 are available.

#### Run All Tests

Run all test suites in sequence:

```bash
npm run test:all
```

This runs unit tests, integration tests, and smoke tests.

#### Test Configuration

- **Unit/Integration/Smoke Tests**: Uses Vitest (`vitest.config.ts`)
- **E2E Tests**: Uses Playwright (`tests/playwright.config.ts`)
- **Test Setup**: `src/__tests__/setup.ts` provides test utilities and mocks
- **Test Timeout**: 10 seconds for unit/integration tests

### Lint

```bash
npm run lint
```

## UI Tool

A web-based UI tool is available for configuring settings and running operations:

```bash
npm run ui:dev
```

This starts both the backend API server (port 3001) and the React frontend (port 3000). Open `http://localhost:3000` in your browser.

See [ui/README.md](ui/README.md) for more details.

## Architecture

- **Data Ingestion**: `src/services/jira-extractor.ts` - JIRA API integration
- **Change History**: `src/services/jira-extractor.ts` - Changelog extraction
- **CSV Export**: `src/services/jira-extractor.ts` - CSV generation
- **Team Configuration**: `extract-teams-from-csv.ts` - Team config generation
- **Schedule Calculation**: `src/calculators/schedule-calculator.ts` - Schedule engine
- **Gantt Chart Generation**: 
  - `generate-team-schedule-from-jira.ts` - Per-team schedule with BA/Dev/QA segments
  - `generate-team-schedule-xlsx.ts` - Excel file generation for Gantt visualization

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

