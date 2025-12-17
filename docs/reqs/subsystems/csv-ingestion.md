# CSV Backlog Ingestion - Business Requirements

## Overview

The CSV Backlog Ingestion subsystem enables users to import backlog data from CSV exports (primarily from JIRA) and process it into a standardized task format for schedule calculation.

## User Stories

*   **US-3:** As a user, I want to import a CSV export from JIRA containing "Summary", "Story Points", "Original Estimate", "Assignee", and "Issue Type".
*   **US-4:** As a user, I want the system to automatically detect which team a task belongs to based on its "Component" or "Label".

## Business Rules

### File Format Requirements
*   CSV files must be readable and contain valid CSV format
*   Files must have headers with column names
*   System supports flexible column name matching (e.g., "Issue Key" or "ID", "Summary" or "Title")
*   File size limits apply to prevent memory issues

### Estimate Validation Rules

#### Story Points
*   **Allowed values:** 1, 2, 3, 5, 8 (configurable)
*   **Invalid values:** >= 13 story points
*   **Default:** If estimate is missing or invalid, default to 1 story point

#### Days/Hours
*   **Supported formats:** "4h", "2d", "1w" (hours, days, weeks)
*   **Maximum limit:** >= 7 calendar days (56 hours) is invalid for day/hour estimates
*   **Weeks:** Up to 2 weeks (10 working days) allowed since weeks represent a different planning unit
*   **Default:** If estimate is missing or invalid, default to 1 hour

### Task Validation Rules
*   Tasks must have an ID (Issue Key) and Title (Summary)
*   Rows missing ID or Title are skipped with a warning
*   Optional fields: component, parentId, issueType

### Error Handling
*   Invalid estimates are logged as warnings but processing continues
*   Missing required fields result in row skipping with warning
*   System continues processing valid rows even if some rows fail
*   Summary statistics are provided at the end of processing

## Acceptance Criteria

### AC1: CSV File Parsing
*   System successfully parses CSV files with standard formats
*   Handles quoted fields, escaped commas, and empty rows
*   Supports flexible column name matching

### AC2: Estimate Processing
*   Story Points are validated against allowed values
*   Days/Hours estimates are parsed and converted to hours
*   Invalid estimates default to appropriate values with logging

### AC3: Task Creation
*   Valid tasks are created with all required fields
*   Optional fields are included when available
*   Invalid rows are skipped with appropriate warnings

### AC4: Error Reporting
*   Warnings are logged with row numbers and details
*   Summary statistics show processed vs. skipped rows
*   Errors don't stop processing of valid rows

## Related Subsystems

*   **Configuration Management:** Uses estimation type configuration (Story Points vs Days/Hours)
*   **Schedule Calculation:** Provides task data for schedule calculation

## Implementation Status

**Status:** ✅ Implemented (AP-2)
**Components:** CSV Parser, Estimate Processor, Task Model, Logger

