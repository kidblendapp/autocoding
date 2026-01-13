# Configuration Management - Business Requirements

## Overview

The Configuration Management subsystem provides a centralized way to configure team velocity, sprint duration, project start date, and other scheduling parameters. It ensures configuration is validated, accessible throughout the application, and immutable after initialization.

## User Stories

*   **US-1:** As a PM, I want to define my teams (Backend, Frontend, QA) and their average velocities (e.g., "30 points/sprint" or "20 hours/day").
*   **US-2:** As a PM, I want to define the "Start Date" for the project so all calculations anchor to a real point in time.
*   **US-2.1:** As a PM, I want to configure non-working days (holidays) so the schedule accounts for team availability.
*   **US-3:** As a PM, I want to extract issue types, fix versions, link types, teams, components, and statuses from JIRA with a single action, so I don't have to extract each field separately.
*   **US-4:** As a PM, I want to see only issue types that are actually used in my project (filtered by JQL or project), not all system-wide issue types.
*   **US-5:** As a PM, I want to select multiple predecessor link types, so I can capture different types of dependencies (e.g., "Blocks", "Successors").
*   **US-6:** As a PM, I want to specify whether estimates are based on story points or hours (original/remaining estimates), so the system uses the correct calculation method.
*   **US-7:** As a PM, I want to use extracted teams, components, and statuses in team matching rules via dropdowns, so I don't have to type them manually.

## Business Rules

### Required Configuration Fields
*   **projectStartDate:** Must be a valid ISO date string (YYYY-MM-DD format)
*   **sprintDurationDays:** Must be a positive integer (> 0)
*   **velocity:** Must be a positive number (> 0, supports decimals)

### Optional Configuration Fields
*   **nonWorkingDays:** Array of ISO date strings (YYYY-MM-DD) representing holidays (supports individual dates and date ranges)
*   **jql:** Custom JQL query to filter tickets during extraction from JIRA (defaults to `project = {projectName} ORDER BY key ASC` if not provided)
*   **predecessorLinkTypes:** Array of link type names (changed from single string, supports multiple selections)
*   **estimateType:** Type of estimate to use: 'storyPoints' or 'hours' (default: 'storyPoints')
*   **planningIssueTypes:** Array of issue types to use for planning operations (decomposition, schedule generation). Does not affect extraction filtering.
*   **planningFixVersions:** Array of fix versions to use for planning operations (decomposition, schedule generation). Does not affect extraction filtering.
*   **ganttGrouping:** Gantt chart grouping method
*   **changeHistory:** Optional configuration for change history extraction

### Extracted Values (stored in extracted-values.json)
*   **issueTypes:** Unique issue types from actual tickets (filtered by project/JQL)
*   **fixVersions:** Fix versions from project
*   **linkTypes:** Link types available in JIRA
*   **teams:** Teams extracted from Team field in tickets
*   **components:** Components from ticket components
*   **statuses:** Statuses from ticket statuses
*   **lastExtracted:** ISO timestamp of last extraction
*   **projectName:** Project name for change detection

### Configuration File
*   Default location: `config.json` in current working directory
*   Supports custom file paths for different deployment scenarios
*   Configuration must be valid JSON format

### Validation Rules
*   All required fields must be present
*   projectStartDate must be a valid calendar date (handles leap years)
*   sprintDurationDays must be a positive integer
*   velocity must be a positive number (supports decimals)
*   nonWorkingDays array must contain valid ISO date strings
*   Multiple validation errors are reported together

### Configuration Access
*   Configuration is accessible via singleton pattern
*   Configuration is immutable after initialization
*   Configuration must be initialized before use
*   Double initialization is prevented

## Acceptance Criteria

### AC1: Configuration Loading
*   System successfully loads configuration from JSON file
*   Supports default and custom file paths
*   Handles file not found errors gracefully

### AC2: Configuration Validation
*   All required fields are validated
*   Invalid values produce clear error messages
*   Multiple errors are reported together

### AC3: Configuration Access
*   Configuration values are accessible via singleton
*   Configuration cannot be modified after initialization
*   Uninitialized access produces clear error message

### AC4: Error Messages
*   Error messages specify which field failed and why
*   Format: "field - specific error message"
*   Messages are user-friendly and actionable

## Related Subsystems

*   **Schedule Calculation:** Uses configuration for velocity, sprint duration, and start date
*   **CSV Ingestion:** Uses configuration for estimation type validation

## Implementation Status

**Status:** ✅ Implemented (AP-3)
**Components:** Config Loader, Config Validator, Schedule Config Singleton

