# CSV Backlog Ingestion API Documentation

## Overview

The CSV Backlog Ingestion module provides functionality to parse CSV files containing task details and convert them into structured `Task` objects for use in the Gantt Schedule Calculation System.

## API Reference

### `parseCsvFile(filePath, config?, suppressWarnings?)`

Parses a CSV file and converts rows to Task objects.

**Parameters:**
- `filePath: string` - Path to the CSV file (required)
- `config: EstimateConfig` - Configuration for estimate processing (optional, defaults to story points)
- `suppressWarnings: boolean` - If true, warnings are not displayed (optional, default: false)

**Returns:** `ParseResult`
```typescript
interface ParseResult {
  tasks: Task[];
  skipped: number;
  total: number;
}
```

**Throws:** `Error` if file cannot be read or parsed

**Example:**
```typescript
import { parseCsvFile } from './parsers/csv-parser';
import { DEFAULT_CONFIG } from './config/Config';

const result = parseCsvFile('examples/backlog.csv', DEFAULT_CONFIG);
console.log(`Processed ${result.tasks.length} tasks, skipped ${result.skipped}`);
```

### `validateFile(filePath)`

Validates that a file exists and is readable.

**Parameters:**
- `filePath: string` - Path to the file

**Throws:** `Error` if file doesn't exist or is not readable

**Example:**
```typescript
import { validateFile } from './parsers/csv-parser';

try {
  validateFile('examples/backlog.csv');
  console.log('File is valid');
} catch (error) {
  console.error('File validation failed:', error.message);
}
```

### `processEstimate(estimateValue, config?, rowNumber?)`

Validates and processes an estimate value based on configuration.

**Parameters:**
- `estimateValue: string | undefined` - Raw estimate value from CSV
- `config: EstimateConfig` - Configuration for estimate processing (optional)
- `rowNumber: number` - Row number for logging purposes (optional)

**Returns:** `number` - Processed estimate in hours, or default value (1) if invalid

**Example:**
```typescript
import { processEstimate } from './utils/estimate-processor';
import { DEFAULT_CONFIG } from './config/Config';

const hours = processEstimate('5', DEFAULT_CONFIG); // Returns 40 (5 SP * 8 hours)
```

## Data Models

### `Task`

```typescript
interface Task {
  id: string;              // Required: Unique identifier
  title: string;           // Required: Human-readable title
  estimate: number;        // Required: Estimated effort in hours
  component?: string;      // Optional: Component/team identifier
  parentId?: string;       // Optional: Parent task ID
  issueType?: string;      // Optional: Issue type (Story, Bug, Task, etc.)
}
```

### `EstimateConfig`

```typescript
interface EstimateConfig {
  estimateType: 'story-points' | 'days-hours';
  hoursPerDay: number;           // Default: 8
  validStoryPoints: number[];    // Default: [1, 2, 3, 5, 8]
}
```

## CSV Format

### Required Columns

- **ID/Issue Key**: Unique identifier for the task
  - Supported column names: `Issue Key`, `ID`, `Id`, `id`, `issue-key`, `issue_key`
- **Title/Summary**: Human-readable task description
  - Supported column names: `Summary`, `Title`, `title`, `summary`

### Optional Columns

- **Estimate**: Effort estimation
  - Supported column names: `Story Points`, `Original Estimate`, `Estimate`, `estimate`, `story-points`, `story_points`, `original-estimate`, `original_estimate`
- **Component**: Team/component identifier
  - Supported column names: `Component`, `component`
- **Parent Id**: Parent task identifier for subtasks
  - Supported column names: `Parent Id`, `Parent ID`, `ParentId`, `parent-id`, `parent_id`, `parentId`
- **Issue Type**: Type of issue
  - Supported column names: `Issue Type`, `IssueType`, `issue-type`, `issue_type`, `issueType`

### Estimate Formats

#### Story Points Mode (default)
- Valid values: `1`, `2`, `3`, `5`, `8`
- Invalid values are rejected and defaulted to `1`
- Values >= 13 are rejected
- Non-integer values are rejected
- Conversion: 1 Story Point = 8 hours (configurable)

#### Days/Hours Mode
- **Hours**: `8h`, `4.5h`, `8 h`, or `8` (defaults to hours)
- **Days**: `1d`, `2d`, `1.5d`, `1 d`
  - Days >= 7 are rejected
  - Conversion: 1 day = 8 hours (configurable)
- **Weeks**: `1w`, `2w`, `1 w`
  - Conversion: 1 week = 5 working days * hours per day

## Error Handling

The parser uses a structured logger to report warnings and errors:

- **Warnings**: Logged for skipped rows, invalid estimates, missing optional fields
- **Errors**: Logged for file access issues, parsing failures
- **Summary**: Displayed at the end showing skipped vs. total rows

## Usage Examples

### Basic Usage

```typescript
import { parseCsvFile } from './parsers/csv-parser';

const result = parseCsvFile('examples/backlog.csv');
console.log(result.tasks);
```

### Custom Configuration

```typescript
import { parseCsvFile } from './parsers/csv-parser';
import { EstimateConfig } from './config/Config';

const config: EstimateConfig = {
  estimateType: 'days-hours',
  hoursPerDay: 6,
  validStoryPoints: [],
};

const result = parseCsvFile('examples/backlog.csv', config);
```

### Suppressing Warnings

```typescript
const result = parseCsvFile('examples/backlog.csv', DEFAULT_CONFIG, true);
```

## Logging

The module uses a structured logger that can be accessed:

```typescript
import { logger } from './utils/logger';

// Get all log entries
const entries = logger.getEntries();

// Get warning count
const warningCount = logger.getWarningCount();

// Clear logs
logger.clear();
```
