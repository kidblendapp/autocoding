# Project Constitution: Gantt Schedule Calculation System

## 1. Vision & Mission
**Vision:** To empower software teams with realistic, data-driven schedule forecasts that adapt to their unique structures and workflows.
**Mission:** Build a flexible, privacy-focused scheduling engine that transforms raw backlog data into actionable Gantt chart visualizations, accommodating diverse estimation strategies and team topologies.

## 2. Core Values & Guiding Principles
*   **Accuracy over Optimism:** Schedules should reflect historical velocity and capacity, not just "best case" scenarios.
*   **Flexibility by Design:** The system must handle mixed-mode estimations (Story Points vs. Hours, Team-level vs. Subtask-level) seamlessly.
*   **Privacy First:** Project data (JIRA exports, internal estimates) is sensitive. Processing should happen locally or within a secure perimeter, without unnecessary external data transmission.
*   **Configuration over Convention:** While defaults exist, every aspect of team capacity, velocity, and task parsing must be configurable to match the reality of different organizations.

## 3. Scope
*   **In Scope:**
    *   Ingestion of backlog data via CSV/XLSX.
    *   Period-based velocity calculation (Day, Week, Sprint).
    *   Support for multiple scenarios: Team-based estimates, Subtask rollups, and Hybrid models.
    *   Generation of schedule artifacts (Start/End dates) for Gantt visualization.
    *   Future: JIRA Browser Plugin integration.
*   **Out of Scope (v1):**
    *   Real-time bi-directional sync with JIRA (Write-back).
    *   Complex resource leveling (automatic reassignment of individuals).
    *   SaaS hosting (initially designed for local/plugin execution).

## 4. Stakeholders
*   **Project Managers (Primary Users):** Responsible for inputting data, configuring team capacities, and generating reports.
*   **Tech Leads:** Responsible for verifying technical constraints, estimation accuracy, and team velocity inputs.
*   **Developers:** Consumers of the schedule; providers of the raw estimates.

## 5. Non-Negotiables
*   **Code Quality:** All logic must be covered by unit tests, specifically the scheduling algorithms.
*   **Documentation:** Configuration options must be well-documented with examples.
*   **Performance:** Parsing and calculation for < 10,000 items must be near-instantaneous (< 2s).

