# Configuration Management - Business Requirements

## Overview

The Configuration Management subsystem provides a centralized way to configure team velocity, sprint duration, project start date, and other scheduling parameters. It ensures configuration is validated, accessible throughout the application, and immutable after initialization.

## User Stories

*   **US-1:** As a PM, I want to define my teams (Backend, Frontend, QA) and their average velocities (e.g., "30 points/sprint" or "20 hours/day").
*   **US-2:** As a PM, I want to define the "Start Date" for the project so all calculations anchor to a real point in time.
*   **US-2.1:** As a PM, I want to configure non-working days (holidays) so the schedule accounts for team availability.

## Business Rules

### Required Configuration Fields
*   **projectStartDate:** Must be a valid ISO date string (YYYY-MM-DD format)
*   **sprintDurationDays:** Must be a positive integer (> 0)
*   **velocity:** Must be a positive number (> 0, supports decimals)

### Optional Configuration Fields
*   **nonWorkingDays:** Array of ISO date strings (YYYY-MM-DD) representing holidays
*   **changeHistory:** Optional configuration for change history extraction

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

