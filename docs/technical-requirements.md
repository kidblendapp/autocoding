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
    *   `CsvParser`: Uses `csv-parse` to read flat files.
    *   `XlsxParser`: Uses `xlsx` library for Excel sheets.
    *   `JiraAdapter`: (Future) Fetches/parses JIRA API responses or DOM constructs.
*   **Normalization:**
    *   Converts input rows into a standardized `Task` interface.
    *   Resolves team assignment based on configurable rules (Component, Label, Custom Field, Regex on Title).

### 3.2. Core Scheduling Engine
*   **Models:**
    *   `Task`: `{ id, title, estimate, remainingTime, dependencies, teamId, ... }`
    *   `TeamConfig`: `{ id, velocity: number, velocityPeriod: 'week'|'sprint', capacityPerDay: number, ... }`
*   **Logic:**
    *   **Queue Management:** Tasks are ordered by Rank/Priority.
    *   **Allocation:**
        *   *Scenario 1 (High-level):* `Duration = Estimate / Velocity`.
        *   *Scenario 2 (Detailed):* `Duration = Sum(Subtask Estimates) / (Team Size * Daily Capacity)`.
        *   *Scenario 3 (Hybrid):* Logic to prioritize Subtask sums over Parent estimates if present.
    *   **Calendar Awareness:** Skips weekends/holidays based on global configuration.

### 3.3. Output Layer
*   **Format:** JSON object representing the timeline.
    *   Start Date, End Date, Assigned Team/Resource.
*   **Visualization Support:** Structured to easily map to libraries like `vis-timeline` or D3 Gantt charts.

## 4. Scenario Handling Details

### 4.1. Estimates per Team (Completed/Remaining)
*   **Input:** Story Points or Hours on the Parent Issue.
*   **Calculation:** Uses Team Velocity (e.g., 20 points/sprint).
*   **Formula:** `Sprint Count = Points / Velocity`. `EndDate = StartDate + (Sprint Count * Sprint Length)`.

### 4.2. Partial Team Estimates with Subtasks
*   **Input:** Parent has points (optional), Subtasks have hours.
*   **Logic:**
    *   If Subtasks exist, their sum (in hours) is used to verify or replace the parent estimate.
    *   "Remaining Estimate" field is prioritized for in-flight work.

### 4.3. All Estimates in Subtasks
*   **Input:** Parent has no estimate. Subtasks have hours/days.
*   **Calculation:** Rollup subtasks to parent. Schedule based on parallelizability (configured max concurrency per task).

## 5. Security & Performance
*   **Data Safety:** No data sent to external servers. All processing is local RAM.
*   **Performance:** Capable of processing 5,000 tasks in < 2 seconds on standard hardware.
*   **Extensibility:** Plugin system for custom parsers (e.g., specific JIRA CSV export formats).

## 6. Key Architectural Decisions (Confirmed)
*   **Local Execution Only:** To ensure data privacy, the application runs strictly client-side (CLI or Local Web/Plugin). No data exfiltration.
*   **Strict Partitioning:** A lowest-level task belongs to exactly one team/resource. Shared ownership is handled by splitting tasks into subtasks.
*   **Predictive Scheduling:** Dates are calculated outputs, not manual inputs. The system forecasts completion based on velocity/capacity.
*   **Phased Rollout:** Phase 1 focuses on CSV/XLSX ingestion. JIRA integration is a subsequent phase.

