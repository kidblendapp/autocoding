# CSV Backlog Ingestion - User Guide

## Overview

The CSV Backlog Ingestion tool allows you to import task data from CSV files into the Gantt Schedule Calculation System. The tool parses CSV files, validates data quality, and converts rows into structured Task objects ready for scheduling calculations.

## Installation

Ensure you have Node.js (LTS v18+) installed, then install dependencies:

```bash
npm install
```

Build the project:

```bash
npm run build
```

## Basic Usage

### Command-Line Interface

```bash
node dist/index.js --input <csv-file-path>
```

**Example:**
```bash
node dist/index.js --input examples/backlog.csv
```

### Options

- `--input, -i <path>` - Path to CSV file (required)
- `--config, -c <path>` - Path to configuration file (optional)
- `--suppress-warnings, -q` - Suppress warning messages (optional)
- `--help, -h` - Show help message

**Examples:**
```bash
# Basic usage
node dist/index.js --input examples/backlog.csv

# Suppress warnings
node dist/index.js --input examples/backlog.csv --suppress-warnings

# Use custom configuration
node dist/index.js --input examples/backlog.csv --config team-config.json
```

## CSV File Format

### Required Columns

Your CSV file must include at least these columns:

- **ID/Issue Key**: Unique identifier (e.g., `PROJ-101`)
- **Title/Summary**: Task description (e.g., `Implement Login Page`)

### Optional Columns

- **Estimate**: Effort estimation (Story Points or Days/Hours)
- **Component**: Team/component identifier (e.g., `UI`, `Backend`)
- **Parent Id**: Parent task ID for subtasks
- **Issue Type**: Type of issue (e.g., `Story`, `Bug`, `Task`)

### Example CSV File

```csv
Issue Key,Summary,Issue Type,Story Points,Original Estimate,Component,Parent Id
PROJ-101,Implement Login Page,Story,5,,UI,
PROJ-102,Design Database Schema,Story,8,,Backend,
PROJ-103,Fix Login Timeout,Bug,,4h,Frontend,
PROJ-104,API Authentication,Story,13,,Backend,
PROJ-105,User Profile API,Story,,,Backend,
PROJ-106,Get User Data,Sub-task,,2h,,PROJ-105
PROJ-107,Update User Data,Sub-task,,3h,,PROJ-105
PROJ-108,Setup Infrastructure,Task,,8h,SRE,
```

### Column Name Variations

The tool supports various column name formats (case-insensitive):

- **ID**: `Issue Key`, `ID`, `Id`, `id`, `issue-key`, `issue_key`
- **Title**: `Summary`, `Title`, `title`, `summary`
- **Estimate**: `Story Points`, `Original Estimate`, `Estimate`, `estimate`, `story-points`, `story_points`, `original-estimate`, `original_estimate`
- **Component**: `Component`, `component`
- **Parent Id**: `Parent Id`, `Parent ID`, `ParentId`, `parent-id`, `parent_id`, `parentId`
- **Issue Type**: `Issue Type`, `IssueType`, `issue-type`, `issue_type`, `issueType`

## Estimate Formats

### Story Points (Default)

When using Story Points mode (default):

- **Valid values**: `1`, `2`, `3`, `5`, `8`
- **Invalid values**: Any other number, non-integer values, values >= 13
- **Default**: Invalid estimates default to `1`
- **Conversion**: 1 Story Point = 8 hours

**Examples:**
- `5` → 40 hours (5 SP × 8 hours)
- `8` → 64 hours (8 SP × 8 hours)
- `4` → 1 hour (invalid, defaulted)
- `13` → 1 hour (invalid, too large)

### Days/Hours

When using Days/Hours mode (configure via config file):

**Hours:**
- `8h` or `8 h` → 8 hours
- `4.5h` → 4.5 hours
- `8` (no unit) → 8 hours (defaults to hours)

**Days:**
- `1d` or `1 d` → 8 hours (1 day × 8 hours/day)
- `2d` → 16 hours
- `1.5d` → 12 hours
- Days >= 7 are rejected and defaulted to 1

**Weeks:**
- `1w` or `1 w` → 40 hours (1 week = 5 working days × 8 hours/day)
- `2w` → 80 hours

## Configuration

### Default Configuration

By default, the tool uses Story Points mode:

```json
{
  "estimateType": "story-points",
  "hoursPerDay": 8,
  "validStoryPoints": [1, 2, 3, 5, 8]
}
```

### Custom Configuration File

Create a JSON configuration file (e.g., `team-config.json`):

```json
{
  "estimateType": "days-hours",
  "hoursPerDay": 6,
  "validStoryPoints": []
}
```

**Configuration Options:**
- `estimateType`: `"story-points"` or `"days-hours"`
- `hoursPerDay`: Number of hours per working day (default: 8)
- `validStoryPoints`: Array of valid story point values (only used in story-points mode)

**Usage:**
```bash
node dist/index.js --input examples/backlog.csv --config team-config.json
```

## Output

The tool outputs:

1. **Task Array**: JSON array of Task objects
2. **Summary Statistics**: Number of tasks processed, skipped rows
3. **Warnings**: Logged for skipped rows, invalid estimates, missing fields

### Example Output

```json
[
  {
    "id": "PROJ-101",
    "title": "Implement Login Page",
    "estimate": 40,
    "component": "UI"
  },
  {
    "id": "PROJ-102",
    "title": "Design Database Schema",
    "estimate": 64,
    "component": "Backend"
  }
]
```

Console output:
```
ℹ️  Successfully processed all 2 row(s)
=== Parse Results ===
[... JSON output ...]
```

## Data Validation

### Row Validation

- Rows with missing **ID** are skipped with a warning
- Rows with missing **Title** are skipped with a warning
- Valid rows are processed and converted to Task objects

### Estimate Validation

- Missing estimates default to `1` hour with a warning
- Invalid estimates (non-numeric, out of range) default to `1` hour with a warning
- Story Points must be one of: 1, 2, 3, 5, 8
- Days estimates >= 7 are rejected
- Story Points >= 13 are rejected

### Processing Summary

At the end of processing, a summary is displayed:

```
ℹ️  Skipped 2 row(s) out of 10 total
```

or

```
ℹ️  Successfully processed all 10 row(s)
```

## Troubleshooting

### File Not Found

**Error:** `File does not exist: <path>`

**Solution:** Check that the file path is correct and the file exists.

### File Not Readable

**Error:** `File is not readable: <path>`

**Solution:** Check file permissions. Ensure the file is readable by the current user.

### CSV Parsing Errors

**Error:** `CSV parsing failed: <error>`

**Solution:** 
- Check that the file is a valid CSV format
- Ensure proper encoding (UTF-8)
- Check for malformed rows or special characters

### Missing Required Fields

**Warning:** `Row skipped: missing required field "ID"`

**Solution:** Ensure all rows have both ID and Title columns populated.

### Invalid Estimates

**Warning:** `Invalid story points value: 4, allowed values: 1, 2, 3, 5, 8, defaulting to 1`

**Solution:** 
- For Story Points: Use only values 1, 2, 3, 5, or 8
- For Days/Hours: Use valid format (e.g., `8h`, `2d`, `1w`)

## Best Practices

1. **Validate CSV Format**: Ensure your CSV file has proper headers and data before processing
2. **Use Consistent Column Names**: Stick to one column name format throughout your CSV
3. **Handle Missing Data**: The tool handles missing estimates gracefully, but ensure IDs and Titles are present
4. **Review Warnings**: Check warning messages to identify data quality issues
5. **Test with Sample Data**: Test with a small CSV file first before processing large files

## Integration

The CSV parser can be used programmatically:

```typescript
import { parseCsvFile } from './parsers/csv-parser';
import { DEFAULT_CONFIG } from './config/Config';

const result = parseCsvFile('examples/backlog.csv', DEFAULT_CONFIG);
// Use result.tasks for scheduling calculations
```

## Support

For issues or questions:
- Check the [API Documentation](./csv-ingestion-api.md) for detailed API reference
- Review the [Technical Requirements](../docs/technical-requirements.md) for system architecture
- Check test files in `src/parsers/__tests__/` for usage examples
