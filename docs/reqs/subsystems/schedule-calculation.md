# Schedule Calculation - Business Requirements

## Overview

The Schedule Calculation subsystem calculates realistic start and end dates for tasks based on team velocity, sprint duration, and working days. It supports sequential task processing, fractional durations, and working days calculation.

## User Stories

*   **US-5 (Velocity-based):** As a PM, I want high-level Epics estimated in Story Points to be scheduled across future Sprints based on my team's velocity.
*   **US-6 (Capacity-based):** As a Tech Lead, I want tasks with granular "Hours" estimates (subtasks) to be scheduled based on the number of available developers.
*   **US-7 (Hybrid):** As a user, I want to see a schedule that combines both high-level estimates (future work) and detailed subtasks (current sprint work) without conflict.
*   **US-7.1:** As a PM, I want tasks to be scheduled using working days only (excluding weekends and holidays).
*   **US-7.2:** As a PM, I want fractional durations (e.g., 2.5 days) to be properly handled with rounding up to the next working day.

## Business Rules

### Duration Calculation Formula
*   **Formula:** `Duration = (Estimate / Velocity) * SprintDuration`
*   Supports fractional durations (e.g., 3.5 days)
*   Duration is calculated in days

### Sequential Task Processing
*   First task uses project start date
*   Subsequent tasks use previous task's end date as their start date
*   Tasks are processed in order (no parallelization in basic linear schedule)
*   No gaps between sequential tasks

### Working Days Calculation
*   **Working days:** Monday through Friday
*   **Non-working days:** Saturday, Sunday, and configured holidays
*   Project start date is adjusted to next working day if needed
*   Task completion dates use working days calculation
*   Sequential tasks chain correctly with no gaps

### Fractional Duration Handling
*   Fractional durations are preserved in calculations (e.g., 2.5 days stored as 2.5)
*   Date calculations round up fractional days using `Math.ceil()`
*   Example: 2.5 days starting Monday → Wednesday (not Tuesday)
*   Ensures result is always a working day

### Date Format
*   All dates are in ISO format (YYYY-MM-DD)
*   Calculated dates are stored as `calculatedStartDate` and `calculatedEndDate`

### Validation Rules
*   Velocity must be > 0
*   Sprint duration must be > 0
*   Estimates must be >= 0 (negative estimates handled as 0)
*   Project start date must be valid ISO format

## Acceptance Criteria

### AC1: Basic Schedule Calculation
*   Duration is calculated correctly using the formula
*   First task starts on project start date
*   Subsequent tasks start on previous task's end date

### AC2: Working Days Support
*   Tasks skip weekends (Saturday, Sunday)
*   Tasks skip configured holidays
*   Project start date is adjusted to working day if needed
*   All calculated dates are working days

### AC3: Fractional Duration Support
*   Fractional durations (2.5, 1.5, 0.5 days) are handled correctly
*   Fractional days are rounded up to next working day
*   Tasks spanning weekends are handled correctly (e.g., Friday + 1.5 days → Monday)

### AC4: Sequential Task Chaining
*   Tasks chain correctly with no gaps
*   Sequential tasks properly use previous task's end date
*   Edge cases handled (zero estimates, year boundaries, leap years)

## Related Subsystems

*   **Configuration Management:** Uses velocity, sprint duration, project start date, and non-working days
*   **CSV Ingestion:** Receives task data with estimates
*   **Output Layer:** Generates scheduled tasks with calculated dates

## Implementation Status

**Status:** ✅ Implemented (AP-4, AP-29)
**Components:** Schedule Calculator, Working Days Calculator, Scheduled Task Model

