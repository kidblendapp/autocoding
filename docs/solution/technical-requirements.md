# Technical Requirements Specification

## 1. System Overview
The Gantt Schedule Calculation System is a Node.js/TypeScript application designed to process project backlogs and output calculated schedules based on team velocity and capacity. It operates as a CLI tool initially, with a library architecture to support future browser plugin integration.

## 2. Technology Stack
*   **Runtime:** Node.js (LTS v18+)
*   **Language:** TypeScript 5.x
*   **Package Manager:** npm or pnpm
*   **Testing:** Jest or Vitest
*   **Linting/Formatting:** ESLint, Prettier

## 3. Architecture Components

### 3.1. Data Ingestion Layer
*   **Parsers:**
    *   `CsvParser`: Uses `csv-parse` library to read CSV files with flexible column matching, quoted fields, and escaped characters.
    *   `XlsxParser`: (Future) Uses `xlsx` library for Excel sheets.
    *   `JiraAdapter`: (Future) Fetches/parses JIRA API responses or DOM constructs.
*   **Normalization:**
    *   Converts input rows into a standardized `Task` interface.
    *   `EstimateProcessor`: Validates and processes estimates (Story Points or Days/Hours).
    *   Resolves team assignment based on configurable rules (Component, Label, Custom Field, Regex on Title).
*   **Components:**
    *   `Task` model with required fields (id, title, estimate) and optional fields (component, parentId, issueType)
    *   Structured logger for consistent warning/error logging

### 3.2. Configuration System
*   **Configuration Loader:**
    *   Reads and parses `config.json` files from file system
    *   Supports default and custom file paths
    *   Handles file not found and JSON parse errors
*   **Configuration Validator:**
    *   Validates required fields (projectStartDate, sprintDurationDays, velocity)
    *   Validates optional fields (nonWorkingDays array)
    *   Provides detailed error messages for validation failures
*   **Configuration Singleton:**
    *   Implements singleton pattern for single source of truth
    *   Immutable configuration after initialization
    *   Provides accessor methods: `getProjectStartDate()`, `getSprintDurationDays()`, `getVelocity()`

### 3.3. Core Scheduling Engine
*   **Models:**
    *   `Task`: `{ id, title, estimate, remainingTime, dependencies, teamId, ... }`
    *   `ScheduledTask`: Extends Task with `calculatedStartDate` and `calculatedEndDate` (ISO format)
    *   `TeamConfig`: `{ id, velocity: number, velocityPeriod: 'week'|'sprint', capacityPerDay: number, ... }`
*   **Schedule Calculator:**
    *   `calculateDuration()`: Pure function implementing formula `(Estimate / Velocity) * SprintDuration`
    *   `calculateSchedule()`: Processes tasks sequentially, calculating start and end dates
*   **Working Days Calculator:**
    *   `WorkingDaysCalendar`: Encapsulates working day logic
    *   `isWorkingDay()`: Checks if a date is a working day
    *   `addWorkingDays()`: Adds working days with fractional support and rounding
    *   `nextWorkingDay()`: Finds next working day from a given date
    *   Handles weekends (Saturday, Sunday) and configurable holidays
*   **Logic:**
    *   **Queue Management:** Tasks are ordered by Rank/Priority.
    *   **Allocation:**
        *   *Scenario 1 (High-level):* `Duration = Estimate / Velocity`.
        *   *Scenario 2 (Detailed):* `Duration = Sum(Subtask Estimates) / (Team Size * Daily Capacity)`.
        *   *Scenario 3 (Hybrid):* Logic to prioritize Subtask sums over Parent estimates if present.
    *   **Calendar Awareness:** Skips weekends/holidays using `WorkingDaysCalendar`.

### 3.4. Change History Service
*   **Change History Extractor:**
    *   Executes JQL queries using `dmtools` CLI
    *   Retrieves ticket changelogs from JIRA API
    *   Filters for Status, Sprint, and Story Points fields
    *   Supports custom field mapping
*   **CSV Generator:**
    *   Transforms changelog data to CSV format
    *   Writes to timestamped directories (format: YYYYMMDD_HH)
    *   Handles CSV escaping for special characters

### 3.5. Output Layer
*   **Output Generator:**
    *   Writes scheduled tasks to `output.json` in formatted JSON
    *   Preserves all original task fields
    *   Includes calculated start and end dates in ISO format
*   **Format:** JSON object representing the timeline.
    *   Start Date, End Date, Assigned Team/Resource.
*   **Visualization Support:** Structured to easily map to libraries like `vis-timeline` or D3 Gantt charts.

## 4. Scenario Handling Details

### 4.1. Estimates per Team (Completed/Remaining)
*   **Input:** Story Points or Hours on the Parent Issue.
*   **Calculation:** Uses Team Velocity (e.g., 20 points/sprint).
*   **Formula:** `Duration = (Estimate / Velocity) * SprintDuration`
*   **Date Calculation:** `EndDate = addWorkingDays(StartDate, Duration)`
*   **Working Days:** Uses `WorkingDaysCalendar` to skip weekends and holidays

### 4.2. Partial Team Estimates with Subtasks
*   **Input:** Parent has points (optional), Subtasks have hours.
*   **Logic:**
    *   If Subtasks exist, their sum (in hours) is used to verify or replace the parent estimate.
    *   "Remaining Estimate" field is prioritized for in-flight work.
*   **Working Days:** Subtask estimates converted to working days using calendar

### 4.3. All Estimates in Subtasks
*   **Input:** Parent has no estimate. Subtasks have hours/days.
*   **Calculation:** Rollup subtasks to parent. Schedule based on parallelizability (configured max concurrency per task).
*   **Working Days:** All date calculations use working days calendar

### 4.4. Fractional Duration Handling
*   **Fractional Durations:** Supported in calculations (e.g., 2.5 days)
*   **Rounding:** Fractional days rounded up using `Math.ceil()` for date arithmetic
*   **Example:** 2.5 days starting Monday → Wednesday (not Tuesday)
*   **Working Days:** Result always falls on a working day

## 5. Security & Performance
*   **Data Safety:** No data sent to external servers. All processing is local RAM.
*   **Performance:** Capable of processing 5,000 tasks in < 2 seconds on standard hardware.
*   **Extensibility:** Plugin system for custom parsers (e.g., specific JIRA CSV export formats).

## 6. Key Architectural Decisions (Confirmed)
*   **Local Execution Only:** To ensure data privacy, the application runs strictly client-side (CLI or Local Web/Plugin). No data exfiltration.
*   **Strict Partitioning:** A lowest-level task belongs to exactly one team/resource. Shared ownership is handled by splitting tasks into subtasks.
*   **Predictive Scheduling:** Dates are calculated outputs, not manual inputs. The system forecasts completion based on velocity/capacity.
*   **Working Days First:** All date calculations use working days calendar, skipping weekends and holidays by default.
*   **Fractional Duration Support:** Durations can be fractional, but date arithmetic rounds up to ensure working day results.
*   **Graceful Error Handling:** Invalid data is logged but doesn't stop processing. System continues with valid rows.
*   **Singleton Configuration:** Configuration uses singleton pattern to ensure single source of truth and immutability.
*   **Phased Rollout:** Phase 1 focuses on CSV/XLSX ingestion. JIRA integration is a subsequent phase.

## 7. Subsystem Documentation

For detailed technical requirements for each subsystem, see:
*   [CSV Backlog Ingestion](./subsystems/csv-ingestion.md)
*   [Configuration Management](./subsystems/configuration.md)
*   [Schedule Calculation](./subsystems/schedule-calculation.md)
*   [Change History Extraction](./subsystems/change-history.md)

