# Business Requirements Specification

## 1. Executive Summary
This project aims to deliver a "Gantt Schedule Calculation System" that automates the creation of project timelines. By ingesting existing backlog data (from CSVs or JIRA), it calculates realistic start and end dates for tasks, enabling Project Managers to communicate reliable delivery forecasts to stakeholders.

## 2. Target Audience
*   **Project Managers / Scrum Masters:** Need to report on "When will it be done?"
*   **Engineering Managers:** Need to assess if current team capacity matches the workload.
*   **Product Owners:** Need to prioritize features based on schedule impact.

## 3. Key Business Goals
1.  **Reduce Manual Effort:** Eliminate manual Excel date calculations.
2.  **Increase Transparency:** Make the "Velocity vs. Scope" equation visible to all stakeholders.
3.  **Support Hybrid Workflows:** Accommodate teams transitioning from Waterfall (hours) to Agile (points).

## 4. User Stories

### 4.1. Setup & Configuration
*   **US-1:** As a PM, I want to define my teams (Backend, Frontend, QA) and their average velocities (e.g., "30 points/sprint" or "20 hours/day").
*   **US-2:** As a PM, I want to define the "Start Date" for the project so all calculations anchor to a real point in time.
*   **US-2.1:** As a PM, I want to configure non-working days (holidays) so the schedule accounts for team availability.

### 4.2. Data Import
*   **US-3:** As a user, I want to import a CSV export from JIRA containing "Summary", "Story Points", "Original Estimate", "Assignee", and "Issue Type".
*   **US-3.1:** As a user, I want to extract all JIRA tickets directly from JIRA API using project configuration, including tickets without estimates.
*   **US-3.2:** As a user, I want the system to extract comprehensive ticket fields including Issue Key, Summary, Issue Type, Status, Assignee, Reporter, Creator, Priority, Story Points, Original Estimate, Component, Parent Id, Epic Link, Labels, Fix Versions, Versions, Sprint, Created, Updated, Resolution Date, Due Date, and Resolution.
*   **US-3.3:** As a user, I want the system to handle pagination automatically to extract all tickets from large projects (2000+ tickets).
*   **US-4:** As a user, I want the system to automatically detect which team a task belongs to based on its "Component", "Label", or "Team" custom field.
*   **US-4.1:** As a user, I want the system to validate estimates according to business rules (Story Points: 1,2,3,5,8 allowed; Days/Hours: max 7 calendar days).

### 4.3. Scheduling Scenarios
*   **US-5 (Velocity-based):** As a PM, I want high-level Epics estimated in Story Points to be scheduled across future Sprints based on my team's velocity.
*   **US-6 (Capacity-based):** As a Tech Lead, I want tasks with granular "Hours" estimates (subtasks) to be scheduled based on the number of available developers.
*   **US-7 (Hybrid):** As a user, I want to see a schedule that combines both high-level estimates (future work) and detailed subtasks (current sprint work) without conflict.
*   **US-7.1:** As a PM, I want tasks to be scheduled using working days only (excluding weekends and holidays).
*   **US-7.2:** As a PM, I want fractional durations (e.g., 2.5 days) to be properly handled with rounding up to the next working day.

### 4.4. Reporting & Visualization
*   **US-8:** As a stakeholder, I want to view a Gantt chart showing the sequence of Epics and their predicted delivery dates.
*   **US-9:** As a PM, I want to see a warning if a task has no estimate or team assigned.

### 4.5. Change History Tracking
*   **US-10:** As a PM, I want to extract change history from JIRA tickets to track status, sprint, original estimate, and story point changes over time.
*   **US-10.1:** As a PM, I want change history to include the value, timestamp, and user who made each change.
*   **US-11:** As a PM, I want change history exported to CSV format with timestamps for analysis and reporting.
*   **US-11.1:** As a PM, I want to optionally include change history when extracting JIRA tickets using a `--history` flag.

### 4.6. Team Configuration Generation
*   **US-12:** As a PM, I want to automatically generate team configuration files based on tags in JIRA ticket summaries and assignees.
*   **US-12.1:** As a PM, I want the system to extract unique tags (e.g., [FE], [BE], [SFMC], [CRM]) from ticket summaries and map them to team members.
*   **US-12.2:** As a PM, I want the system to generate a `teams_config.json` file with team definitions including team ID, name, velocity, members, and match rules.

## 5. Success Metrics
*   **Accuracy:** Calculated completion dates usually fall within +/- 15% of actual completion (once velocity is calibrated).
*   **Speed:** Generating a schedule for a 3-month project takes less than 5 seconds.
*   **Adoption:** Can be used by at least 3 distinct teams with different workflow configurations.
*   **Reliability:** System handles invalid data gracefully, logging warnings but continuing processing for valid rows.
*   **Flexibility:** Supports multiple estimation formats (Story Points, Days, Hours, Weeks) with configurable validation rules.

## 6. Subsystem Requirements

This section maps high-level user stories to concrete subsystem documentation paths for both business and technical requirements.  
Paths are written relative to the repository root so that automation tools (e.g., Cursor agents) can reliably locate them.

- **CSV Backlog Ingestion**
  - **Related user stories:** US-3, US-3.1, US-3.2, US-3.3, US-4, US-4.1
  - **Business requirements:** `docs/reqs/subsystems/csv-ingestion.md`
  - **Technical requirements:** `docs/solution/subsystems/csv-ingestion.md`

- **Configuration Management**
  - **Related user stories:** US-1, US-2, US-2.1
  - **Business requirements:** `docs/reqs/subsystems/configuration.md`
  - **Technical requirements:** `docs/solution/subsystems/configuration.md`

- **Schedule Calculation**
  - **Related user stories:** US-5, US-6, US-7, US-7.1, US-7.2
  - **Business requirements:** `docs/reqs/subsystems/schedule-calculation.md`
  - **Technical requirements:** `docs/solution/subsystems/schedule-calculation.md`

- **Change History Extraction**
  - **Related user stories:** US-10, US-10.1, US-11, US-11.1
  - **Business requirements:** `docs/reqs/subsystems/change-history.md`
  - **Technical requirements:** `docs/solution/subsystems/change-history.md`

