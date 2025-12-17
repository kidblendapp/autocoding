# Change History Extraction - Business Requirements

## Overview

The Change History Extraction subsystem enables users to extract change history from JIRA tickets and export it to CSV format for analysis and reporting. It tracks changes to Status, Sprint, and Story Points fields over time.

## User Stories

*   **US-10:** As a PM, I want to extract change history from JIRA tickets to track status, sprint, and story point changes over time.
*   **US-11:** As a PM, I want change history exported to CSV format with timestamps for analysis and reporting.

## Business Rules

### JQL Query Requirements
*   JQL query must be provided in configuration
*   Query must be non-empty string
*   Query is executed against JIRA to find matching tickets
*   Empty query results are handled gracefully

### Field Tracking
*   **Default tracked fields:** Status, Sprint, Story Points
*   **Custom field mapping:** Supports mapping custom field names to standard field types
*   Only changes to tracked fields are extracted
*   Other field changes are ignored

### Change History Data
*   Each change includes: ticket key, field name, old value, new value, timestamp, author
*   Changes are ordered chronologically
*   Tickets with no changelog data are handled gracefully

### CSV Output Format
*   CSV files are generated in timestamped directories (format: YYYYMMDD_HH)
*   CSV includes proper headers and data rows
*   Special characters (quotes, commas, newlines) are properly escaped
*   Multiple tickets' changes are included in single CSV file

### Error Handling
*   Change history extraction errors don't break existing functionality
*   Errors are logged but don't fail the entire command
*   Graceful handling when dmtools CLI is not available
*   Graceful handling when JIRA API access fails

### Integration
*   Runs in parallel with schedule calculation
*   Integrated into existing `ingest-csv` command workflow
*   Optional feature - only runs when configuration is provided

## Acceptance Criteria

### AC1: JQL Query Execution
*   System executes JQL query against JIRA
*   Finds all matching tickets
*   Handles empty results gracefully

### AC2: Changelog Extraction
*   Extracts changelog data for matching tickets
*   Filters for only Status, Sprint, and Story Points fields
*   Handles tickets with no changelog data

### AC3: CSV Generation
*   Generates CSV files with proper format
*   Creates timestamped directories
*   Properly escapes special characters

### AC4: Error Handling
*   Errors don't break existing functionality
*   Errors are logged appropriately
*   System continues processing even if change history fails

## Configuration

### Change History Configuration
```json
{
  "changeHistory": {
    "jql": "project = AP AND status != DONE",
    "fieldMapping": {
      "sprint": "customfield_10020",
      "storyPoints": "customfield_10016"
    }
  }
}
```

## Related Subsystems

*   **Configuration Management:** Uses change history configuration
*   **CSV Ingestion:** Runs in parallel with CSV ingestion workflow

## Implementation Status

**Status:** ✅ Implemented (AP-22)
**Components:** Change History Extractor, Change History CSV Generator
**Dependencies:** Requires dmtools CLI with JIRA API credentials

