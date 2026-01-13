# Configuration Management - Technical Requirements

## Overview

The Configuration Management subsystem provides a centralized, validated, and immutable configuration system for team velocity, sprint duration, project start date, and optional settings like non-working days.

## Architecture

### Components

1. **Configuration Types** (`src/config/types.ts`)
   - `ScheduleConfig`: Validated configuration interface
   - `RawScheduleConfig`: Unvalidated configuration structure
   - Comprehensive JSDoc documentation

2. **Configuration Loader** (`src/config/loader.ts`)
   - Reads and parses `config.json` files from file system
   - Supports custom file paths via `LoadConfigOptions`
   - Defaults to `config.json` in current working directory
   - Handles file not found errors and JSON parse errors
   - Uses Node.js `fs` and `path` modules

3. **Configuration Validator** (`src/config/validator.ts`)
   - Validates presence of all required fields
   - Validates projectStartDate is valid ISO date string (YYYY-MM-DD)
   - Validates sprintDurationDays is positive integer (> 0)
   - Validates velocity is positive number (> 0, supports decimals)
   - Validates nonWorkingDays array (optional) with ISO date format checking
   - Provides specific error messages for each validation failure
   - Returns structured validation results with error details

4. **Configuration Singleton** (`src/config/schedule-config.ts`)
   - Implements singleton pattern ensuring single source of truth
   - Configuration is immutable after initialization
   - Provides accessor methods: `getProjectStartDate()`, `getSprintDurationDays()`, `getVelocity()`, `getConfig()`
   - Prevents double initialization
   - Returns copies of configuration to prevent external modification
   - Includes `reset()` method for testing purposes

## Implementation Details

### Configuration Schema

```typescript
interface ScheduleConfig {
  projectStartDate: string;      // ISO date: YYYY-MM-DD
  sprintDurationDays: number;     // Positive integer
  velocity: number;               // Positive number (supports decimals)
  nonWorkingDays?: string[];      // Optional: Array of ISO dates
  jql?: string;                   // Optional: JQL query for filtering tickets during extraction
  predecessorLinkTypes?: string[]; // Optional: Array of link type names (changed from single string)
  estimateType?: 'storyPoints' | 'hours'; // Optional: Type of estimate to use
  planningIssueTypes?: string[];  // Optional: Issue types for planning operations (decomposition, schedule generation)
  planningFixVersions?: string[]; // Optional: Fix versions for planning operations (decomposition, schedule generation)
  ganttGrouping?: string;         // Optional: Gantt chart grouping method
  teams?: Record<string, TeamConfig>; // Team configurations
  workTypes?: Record<string, { name: string }>; // Work type definitions
  workTypeSequences?: Record<string, WorkTypeSequence[]>; // Work type sequences
}

interface ExtractedValues {
  issueTypes?: string[];          // Extracted from JIRA tickets
  fixVersions?: string[];         // Extracted from project
  linkTypes?: string[];           // Extracted from JIRA link types
  teams?: string[];               // Extracted from Team field in tickets
  components?: string[];          // Extracted from ticket components
  statuses?: string[];            // Extracted from ticket statuses
  lastExtracted?: string;         // ISO timestamp of last extraction
  projectName?: string;           // Project name for change detection
}
```

**Note:** `ExtractedValues` is stored in a separate `extracted-values.json` file, not in `schedule_config.json`.

### Validation Rules

1. **projectStartDate:**
   - Must be a string
   - Must be valid ISO format (YYYY-MM-DD)
   - Must be a valid calendar date (handles leap years)
   - Examples: "2024-01-15" ✓, "2024-02-29" ✓ (leap year), "2024-13-01" ✗

2. **sprintDurationDays:**
   - Must be a number
   - Must be a positive integer (> 0)
   - Examples: 7 ✓, 14 ✓, 0 ✗, -5 ✗, 7.5 ✗

3. **velocity:**
   - Must be a number
   - Must be positive (> 0)
   - Supports decimals
   - Examples: 20 ✓, 30.5 ✓, 0 ✗, -10 ✗

4. **jql (optional):**
   - Custom JQL query for filtering tickets during extraction from JIRA
   - If not provided, defaults to `project = PROJECTNAME ORDER BY key ASC`
   - Examples: 
     - `project = PSME AND issuetype = Story`
     - `project = PSME AND fixVersion in ("MVP 1.0", "MVP 2.0")`
     - `project = PSME AND status != Done`

5. **planningIssueTypes and planningFixVersions (optional):**
   - Used for filtering during planning operations (decomposition, schedule generation)
   - These are separate from extraction filtering and do not affect which tickets are extracted from JIRA
   - If not specified, all extracted tickets are used for planning

6. **nonWorkingDays (optional):**
   - Must be an array if provided
   - Each element must be a string in ISO format (YYYY-MM-DD)
   - Each date must be a valid calendar date
   - Supports individual dates and date ranges (expanded automatically)
   - Past dates are allowed (for historical analysis)
   - Examples: ["2024-12-25", "2024-01-01"] ✓, ["2024-01-01:2024-01-05"] ✓ (expanded to 5 dates)

5. **jql (optional):**
   - Custom JQL query to filter tickets for extraction
   - If not provided, defaults to `project = {projectName}`
   - Used for issue types, teams, components, and statuses extraction

6. **predecessorLinkTypes (optional):**
   - Array of link type names (changed from single string)
   - Default link types are auto-selected if present: ["Blocks", "blocks", "Successors", "Has to be done before"]
   - Users can unselect default link types

7. **estimateType (optional):**
   - Type of estimate to use: 'storyPoints' or 'hours'
   - Default: 'storyPoints'
   - When 'hours': Uses originalEstimate or remainingEstimate directly
   - When 'hours' and hours missing: Falls back to average hours from tickets with same story points
   - Affects story decomposition only (CSV will have all estimates after decomposition)

### Error Handling

- **File Not Found:** Clear error message specifying attempted path
- **JSON Parse Errors:** Includes specific syntax error details
- **Validation Errors:** Format: "field - specific error message"
- **Multiple Errors:** All validation errors reported together
- **Error Formatting:** Single and multiple error message formatting

## API/Interface Specifications

### Configuration Loader
```typescript
interface LoadConfigOptions {
  configPath?: string;  // Optional: custom file path
}

function loadConfig(options?: LoadConfigOptions): RawScheduleConfig
```

### Configuration Validator
```typescript
interface ValidationResult {
  success: boolean;
  config?: ScheduleConfig;
  errors?: string[];
}

function validateConfig(rawConfig: RawScheduleConfig): ValidationResult
```

### Configuration Singleton
```typescript
class ScheduleConfig {
  initialize(options?: LoadConfigOptions): void
  getProjectStartDate(): string
  getSprintDurationDays(): number
  getVelocity(): number
  getConfig(): ScheduleConfig
  isInitialized(): boolean
  reset(): void  // For testing only
}
```

## Integration Patterns

### Initialization
```typescript
import { scheduleConfig } from './config/schedule-config';

// Initialize during application startup
scheduleConfig.initialize({ configPath: 'config.json' });

// Access configuration values
const startDate = scheduleConfig.getProjectStartDate();
const sprintDays = scheduleConfig.getSprintDurationDays();
const velocity = scheduleConfig.getVelocity();
```

### Error Handling
- Configuration must be initialized before access
- Uninitialized access produces clear error message
- Double initialization is prevented with error message

## Testing

- **Configuration Loader:** 9 tests covering file reading, path resolution, error handling
- **Configuration Validator:** 30 tests covering all validation scenarios, edge cases, error reporting
- **Configuration Singleton:** 17 tests covering initialization, accessor methods, immutability, error handling
- **Total:** 56 tests, all passing

## Dependencies

- Node.js `fs` and `path` modules for file operations
- No external dependencies

## Related Files

- Implementation: `src/config/loader.ts`, `src/config/validator.ts`, `src/config/schedule-config.ts`
- Tests: `src/config/__tests__/loader.test.ts`, `src/config/__tests__/validator.test.ts`, `src/config/__tests__/schedule-config.test.ts`

