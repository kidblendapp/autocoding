# CSV Backlog Ingestion - Technical Requirements

## Overview

The CSV Backlog Ingestion subsystem provides CSV file parsing, estimate validation, and task model creation. It follows a modular architecture with clear separation of concerns.

## Architecture

### Components

1. **Task Model** (`src/models/Task.ts`)
   - Interface definition with required fields (id, title, estimate)
   - Optional fields: component, parentId, issueType
   - Aligned with broader Task model from technical requirements

2. **Structured Logger** (`src/utils/logger.ts`)
   - Consistent warning/error logging with row numbers
   - Supports warning suppression via `--quiet` flag
   - Provides summary statistics

3. **Configuration Types** (`src/config/types.ts`)
   - Supports Story Points and Days/Hours estimation types
   - Configurable validation rules
   - Default values and allowed value sets

4. **Estimate Processor** (`src/processors/estimate-processor.ts`)
   - Validates and processes estimates
   - Story Points: Validates against allowed values (1,2,3,5,8 by default), rejects >= 13
   - Days/Hours: Supports "4h", "2d", "1w" formats, converts to hours, rejects >= 7 calendar days
   - Defaults to 1 when estimate is missing or invalid

5. **CSV Parser** (`src/parsers/csv-parser.ts`)
   - File validation (existence, readability, size limits)
   - CSV parsing with csv-parse library
   - Handles quoted fields, escaped commas, empty rows
   - Flexible column name matching (supports "Issue Key"/"ID", "Summary"/"Title", etc.)
   - Row validation skipping rows with missing ID or Title
   - Task object creation with all field combinations

6. **CLI Command** (`src/cli/commands/ingest-csv.ts`)
   - Entry point for CSV ingestion
   - Supports `--input` flag and `--quiet` option
   - Integrates all components

## Implementation Details

### CSV Parsing
- Uses `csv-parse` library for robust CSV handling
- Supports flexible column name matching for compatibility with different CSV formats
- Validates file existence and readability before parsing
- Implements size limits to prevent memory issues

### Estimate Processing
- **Story Points:**
  - Validates against configurable allowed values (default: 1, 2, 3, 5, 8)
  - Rejects values >= 13
  - Defaults to 1 for missing/invalid values
  
- **Days/Hours:**
  - Parses formats: "4h" (hours), "2d" (days), "1w" (weeks)
  - Converts all to hours for internal processing
  - Rejects estimates >= 7 calendar days (56 hours)
  - Allows weeks up to 2 weeks (10 working days)
  - Defaults to 1 hour for missing/invalid values

### Error Handling
- Invalid estimates logged as warnings, processing continues
- Missing required fields result in row skipping with warning
- System continues processing valid rows even if some rows fail
- Summary statistics provided at end of processing

## API/Interface Specifications

### Task Interface
```typescript
interface Task {
  id: string;              // Required: Issue Key/ID
  title: string;           // Required: Summary/Title
  estimate: number;        // Required: Processed estimate value
  component?: string;      // Optional: Component name
  parentId?: string;       // Optional: Parent issue key
  issueType?: string;      // Optional: Issue type
}
```

### CSV Parser Interface
```typescript
function parseCsv(filePath: string, options?: ParseOptions): Task[]
```

### Estimate Processor Interface
```typescript
function processEstimate(
  estimate: string | number | undefined,
  estimationType: 'storyPoints' | 'daysHours',
  config: EstimationConfig
): number
```

## Error Handling Approach

- **Functional Programming Principles:** Immutable data structures, pure functions
- **Graceful Degradation:** Logs warnings but continues processing
- **Clear Error Messages:** Row numbers and specific error details
- **Summary Statistics:** Reports processed vs. skipped rows

## Testing

- Comprehensive unit tests for all components
- File I/O mocking for CSV parser tests
- Edge case coverage (empty files, invalid formats, large files)
- 40 tests total, all passing

## Dependencies

- `csv-parse`: CSV file parsing library
- Node.js `fs` and `path` modules for file operations

## Related Files

- Implementation: `src/parsers/csv-parser.ts`, `src/processors/estimate-processor.ts`
- Tests: `src/parsers/__tests__/csv-parser.test.ts`, `src/processors/__tests__/estimate-processor.test.ts`

