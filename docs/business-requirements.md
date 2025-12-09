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

### 4.2. Data Import
*   **US-3:** As a user, I want to import a CSV export from JIRA containing "Summary", "Story Points", "Original Estimate", "Assignee", and "Issue Type".
*   **US-4:** As a user, I want the system to automatically detect which team a task belongs to based on its "Component" or "Label".

### 4.3. Scheduling Scenarios
*   **US-5 (Velocity-based):** As a PM, I want high-level Epics estimated in Story Points to be scheduled across future Sprints based on my team's velocity.
*   **US-6 (Capacity-based):** As a Tech Lead, I want tasks with granular "Hours" estimates (subtasks) to be scheduled based on the number of available developers.
*   **US-7 (Hybrid):** As a user, I want to see a schedule that combines both high-level estimates (future work) and detailed subtasks (current sprint work) without conflict.

### 4.4. Reporting & Visualization
*   **US-8:** As a stakeholder, I want to view a Gantt chart showing the sequence of Epics and their predicted delivery dates.
*   **US-9:** As a PM, I want to see a warning if a task has no estimate or team assigned.

## 5. Success Metrics
*   **Accuracy:** Calculated completion dates usually fall within +/- 15% of actual completion (once velocity is calibrated).
*   **Speed:** Generating a schedule for a 3-month project takes less than 5 seconds.
*   **Adoption:** Can be used by at least 3 distinct teams with different workflow configurations.

