# Change History Extraction - Technical Requirements

## Overview

The Change History Extraction subsystem extracts change history from JIRA tickets using JQL queries and exports it to CSV format. It integrates with the existing `ingest-csv` command workflow and runs in parallel with schedule calculation.

## Architecture

### Components

1. **Change History Configuration** (`src/config/types.ts`)
   - `ChangeHistoryConfig` interface
   - `ChangeHistoryFieldMapping` interface for custom field mapping
   - Extended `ScheduleConfig` and `RawScheduleConfig` to support optional change history configuration

2. **Change History Extractor** (`src/services/change-history-extractor.ts`)
   - Executes JQL queries using `dmtools` CLI
   - Retrieves ticket changelogs from JIRA API
   - Filters for Status, Sprint, and Story Points fields
   - Supports custom field mapping
   - Handles empty query results and tickets with no changelog data

3. **Change History CSV Generator** (`src/services/change-history-csv-generator.ts`)
   - Transforms changelog data to CSV format
   - Writes to timestamped directories (format: YYYYMMDD_HH)
   - Handles CSV escaping for special characters (quotes, commas, newlines)
   - Supports all three field types (Status, Sprint, Story Points)

4. **Integration** (`src/cli/commands/ingest-csv.ts`)
   - Integrated change history extraction to run automatically when configuration is provided
   - Runs in parallel with schedule calculation
   - Doesn't block or break existing functionality if it fails

## Implementation Details

### Configuration Schema

```typescript
interface ChangeHistoryConfig {
  jql: string;  // Required: JQL query string
  fieldMapping?: ChangeHistoryFieldMapping;  // Optional: Custom field mapping
}

interface ChangeHistoryFieldMapping {
  sprint?: string;        // Custom field ID for Sprint
  storyPoints?: string;   // Custom field ID for Story Points
}
```

### JQL Query Execution

- Uses `dmtools` CLI to execute JQL queries
- Queries are executed against JIRA to find matching tickets
- Empty query results are handled gracefully
- API failures are logged but don't fail the entire command

### Changelog Extraction

- Retrieves changelog data for all tickets matching JQL query
- Filters for only Status, Sprint, and Story Points fields
- Other field changes are ignored
- Tickets with no changelog data are handled gracefully
- Supports custom field mapping for Sprint and Story Points

### CSV Output Format

- CSV files generated in timestamped directories
- Directory format: `YYYYMMDD_HH` (e.g., `20241217_15`)
- CSV includes proper headers and data rows
- Special characters (quotes, commas, newlines) are properly escaped
- Multiple tickets' changes included in single CSV file

### Change History Data Structure

Each change includes:
- Ticket key
- Field name (Status, Sprint, or Story Points)
- Old value
- New value
- Timestamp
- Author (if available)

## API/Interface Specifications

### Change History Extractor Interface
```typescript
interface ChangeHistoryEntry {
  ticketKey: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  timestamp: string;
  author?: string;
}

function extractChangeHistory(
  jql: string,
  fieldMapping?: ChangeHistoryFieldMapping
): Promise<ChangeHistoryEntry[]>
```

### CSV Generator Interface
```typescript
function generateChangeHistoryCSV(
  changes: ChangeHistoryEntry[],
  outputDir?: string
): string  // Returns path to generated CSV file
```

## Error Handling

- **Graceful Degradation:** Change history extraction errors don't break existing functionality
- **Error Logging:** Errors are logged but don't fail the entire command
- **dmtools Availability:** Handles case when dmtools CLI is not available
- **JIRA API Failures:** Handles JIRA API access failures gracefully
- **Empty Results:** Handles empty JQL query results and tickets with no changelog data

## Integration

### Workflow Integration
- Integrated into existing `ingest-csv` command workflow
- Runs automatically when `changeHistory` configuration is provided
- Runs in parallel with schedule calculation
- Optional feature - only runs when configuration is provided

### Configuration Integration
- Extended schedule configuration to support optional `changeHistory` section
- Validation ensures JQL query is non-empty string if provided
- Field mapping is optional

## Testing

### Configuration Validator Tests
- Valid change history configuration with JQL query
- Change history with field mapping (sprint and story points)
- Change history with partial field mapping
- Validation errors for missing/invalid JQL
- Validation errors for invalid field mapping
- Configuration without change history (backward compatibility)

### Change History Extractor Tests
- Extraction of change history for multiple tickets matching JQL query
- Handling of empty JQL query results
- Filtering for only Status, Sprint, and Story Points fields
- Handling tickets with no changelog data
- Error handling for API failures
- Custom field mapping support

### CSV Generator Tests
- CSV file generation with proper header and data rows
- Timestamped directory creation (format: YYYYMMDD_HH)
- Handling empty changes array
- CSV escaping for special characters (quotes, commas, newlines)
- Support for all three field types (Status, Sprint, Story Points)
- Multiple tickets handling

**Total:** 157 tests passing (12 test files)

## Dependencies

- **dmtools CLI:** Required for JIRA API access
- **JIRA API Credentials:** Must be configured in dmtools
- Node.js `fs` and `path` modules for file operations

## Related Files

- Implementation: `src/services/change-history-extractor.ts`, `src/services/change-history-csv-generator.ts`
- Tests: `src/services/__tests__/change-history-extractor.test.ts`, `src/services/__tests__/change-history-csv-generator.test.ts`
- Configuration: `src/config/types.ts`, `src/config/validator.ts`

## Usage Example

```json
{
  "projectStartDate": "2024-01-01",
  "sprintDurationDays": 7,
  "velocity": 20,
  "changeHistory": {
    "jql": "project = AP AND status != DONE",
    "fieldMapping": {
      "sprint": "customfield_10020",
      "storyPoints": "customfield_10016"
    }
  }
}
```

