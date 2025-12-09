Project Constitution: Excel Gantt Chart Scheduler
This document outlines the project's purpose, scope, requirements, and governance for the development of a Node.js TypeScript application that generates resource-leveled Gantt chart schedules in Excel based on multi-team inputs and capacities.
1. Business Requirements
1.1 Project Goals
The primary goal is to provide a reliable, automated tool for project managers to generate realistic project schedules that account for specific team capacities and task dependencies, visualized within a standard Excel format.
1.2 Stakeholders
Project Managers (PMs): Primary users who input data, run the scheduling tool, and use the output for planning and reporting.
Team Leads/Scrum Masters: Provide and maintain team capacity data.
Development Team: The team building this Node.js application.
Stakeholders/Clients: Consumers of the final Gantt chart visualization for high-level project tracking.
1.3 Scope and Objectives
The application will:
Ingest data from defined Excel templates for tasks and team capacities.
Calculate task start and end dates based on estimates, team assignments, and resource availability (resource leveling).
Generate a new Excel file containing a visually formatted Gantt chart.
Handle various estimation units (hours, days, story points).
It will not be a real-time, interactive project management software (like Jira or MS Project), but a batch processing tool.
1.4 Key Performance Indicators (KPIs)
Accuracy: Scheduled start/end dates must align with provided capacity constraints.
Performance: Schedule generation should complete within 30 seconds for a typical project size (e.g., 500 tasks).
Usability: PMs can successfully generate a schedule using provided templates and documentation.
2. Technical Requirements
2.1 Technology Stack
Runtime Environment: Node.js (latest LTS version recommended).
Language: TypeScript (ensuring type safety and maintainability).
Input/Output: Library for reading/writing Excel files (e.g., exceljs or xlsx).
Version Control: Git, hosted on GitHub/GitLab.
Testing Framework: Jest or Mocha for unit and integration testing.
2.2 Functional Requirements
Input Data Structure:
Tasks Sheet: Columns for Task ID, Name, Description, Estimate (with unit), Assigned Team (BA, FE Dev, QA, etc.), Dependencies (optional: comma-separated Task IDs), Milestones (boolean/date).
Capacity Sheet: Columns for Team Name, Date (Day/Week start), Available Capacity (hours/points).
Scheduling Logic: The application must implement resource leveling logic, ensuring a team is never assigned more work than its specified daily/weekly capacity. Task dependencies must be respected (a task cannot start before its predecessors are complete).
Output: A single Excel file with two tabs: one for the raw calculated schedule data (Start Date, End Date, Duration, Assigned Team), and another with the visual stacked-bar Gantt chart representation.
Milestones: Milestones should be represented as zero-duration markers (e.g., diamonds) on the Gantt chart visualization.
2.3 Non-Functional Requirements
Maintainability: Code must be modular, well-commented, and follow standard TypeScript best practices.
Documentation: Comprehensive README.md including setup instructions, input template specifications, and execution commands.
Error Handling: Robust error reporting for invalid inputs (e.g., circular dependencies, invalid date formats, insufficient capacity).
3. Governance and Process
3.1 Workflow
The team will follow an Agile/Scrum-inspired workflow.
Tasks are managed via a backlog.
Development will use a feature-branch model.
Pull Requests (PRs) require at least one reviewer approval before merging to the main branch.
Continuous Integration (CI) will run automated tests on every PR.
3.2 Definition of Done (DoD)
A task is considered "Done" when:
Code is written in TypeScript.
Unit tests are written and passing (minimum 80% coverage).
Code has been reviewed and merged into the main branch.
Associated documentation (code comments, README updates) is complete.
3.3 Communication
Primary communication will be through the agreed-upon collaboration tool (e.g., Slack/Teams channel, GitHub issues).
Weekly sync meetings to review progress and plan next steps.