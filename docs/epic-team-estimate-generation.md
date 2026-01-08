# Epic: Multi-Team Estimate Generation for Story Decomposition

## Overview

This epic focuses on enhancing the Gantt Schedule Calculation System to support comprehensive team-level estimate generation for user stories. The system will handle three distinct scenarios for work estimation and decomposition, enabling accurate planning and scheduling across multiple teams involved in story execution.

## Business Context

When decomposing epics into user stories, it's essential to generate accurate estimates for each team involved in the story's execution. Different stories may have different levels of decomposition:

- Some stories have all work planned at the story level without subtask breakdown
- Some stories have partial decomposition with some work estimated at story level and some in subtasks
- Some stories are fully decomposed with all work estimated in subtasks

The system must handle all these cases and provide team-specific estimates that can be used for scheduling and capacity planning.

## Goals

1. **Support Multiple Estimation Scenarios**: Handle three distinct cases of work decomposition and estimation
2. **Team-Specific Estimates**: Generate separate estimates for each team involved in story execution
3. **Flexible Task Sequencing**: Support both sequential and parallel task execution patterns
4. **Configuration-Driven**: Provide flexible configuration system ready for UI implementation with predefined presets

## User Stories

### US-1: Story-Level Estimate Distribution (Case 1)

**As a** project manager,  
**I want** to derive team-specific estimates from a story-level estimate using predefined coefficients,  
**So that** I can plan work distribution when stories are not yet decomposed into subtasks.

**Acceptance Criteria:**
- System accepts a story-level estimate (story points or hours)
- System applies team-specific coefficients from configuration to derive estimates for each team
- Coefficients can be defined as percentages (e.g., BA: 25%, Dev: 50%, QA: 25%)
- Coefficients can be defined as fixed hours per story point (e.g., BA: 2h/SP, Dev: 4h/SP, QA: 2h/SP)
- System outputs team estimates in hours for scheduling purposes
- Configuration supports multiple team types (BA, Dev, QA, etc.)

**Technical Notes:**
- Estimate derivation formula: `teamEstimate = storyEstimate × coefficient`
- Coefficients can be percentage-based (0.0-1.0) or hours-per-point based
- Default coefficients should be configurable per team type

### US-2: Hybrid Estimate Calculation (Case 2)

**As a** project manager,  
**I want** to combine story-level estimates with subtask estimates,  
**So that** I can handle stories where some work is planned at story level and some is already decomposed.

**Acceptance Criteria:**
- System identifies which teams have work estimated in subtasks
- System identifies which teams have work estimated at story level
- For teams with subtask estimates: Use sum of subtask estimates (in hours)
- For teams without subtask estimates: Derive from story-level estimate using coefficients
- System handles cases where subtask estimates partially cover team work
- System outputs combined estimates per team
- Configuration allows mapping subtasks to teams (by component, label, summary pattern, etc.)

**Technical Notes:**
- Subtask matching uses configurable criteria (component, label, summary tags)
- Story-level estimate is used as fallback for teams without subtask coverage
- Formula: `teamEstimate = subtaskSum OR (storyEstimate × coefficient)`

### US-3: Subtask-Only Estimate Aggregation (Case 3)

**As a** project manager,  
**I want** to aggregate estimates from subtasks when all work is decomposed,  
**So that** I can use detailed subtask estimates for accurate team planning.

**Acceptance Criteria:**
- System identifies that story has no story-level estimate or estimate is zero
- System groups subtasks by team using configurable matching rules
- System sums subtask estimates (in hours) per team
- System outputs team estimates based solely on subtask aggregation
- System handles subtasks with missing estimates (warns but continues)
- Configuration supports flexible subtask-to-team mapping

**Technical Notes:**
- Subtask matching criteria: component, label, summary tags, issue type
- Aggregation formula: `teamEstimate = SUM(subtaskEstimates)`
- Missing subtask estimates default to 0 or configurable default

### US-4: Task Sequencing and Parallel Execution

**As a** project manager,  
**I want** to specify whether tasks can be executed in parallel or must be sequential,  
**So that** I can accurately model dependencies and optimize scheduling.

**Acceptance Criteria:**
- Configuration supports defining task execution order (sequential or parallel)
- Sequential tasks: Each task starts after the previous one completes
- Parallel tasks: Tasks can start simultaneously (subject to team capacity)
- System supports mixed scenarios (some sequential, some parallel)
- Configuration allows defining task groups that execute in parallel
- System calculates schedules respecting sequencing constraints
- Configuration supports dependency chains (Task B depends on Task A)

**Technical Notes:**
- Task sequencing defined in configuration per work type or per story
- Parallel execution respects team capacity constraints
- Dependencies can be explicit (task IDs) or implicit (team-based)

### US-5: Configuration System with UI Presets

**As a** system administrator,  
**I want** a flexible configuration system with predefined presets,  
**So that** I can quickly configure common scenarios and customize for specific needs.

**Acceptance Criteria:**
- Configuration file supports all three estimation cases
- Configuration includes predefined presets for common team structures
- Presets cover typical scenarios (e.g., "Standard Agile", "Multi-Team", "Fully Decomposed")
- Configuration structure is JSON-based and UI-friendly
- Configuration supports team coefficient definitions
- Configuration supports subtask matching rules
- Configuration supports task sequencing rules
- System validates configuration on load and provides clear error messages

**Technical Notes:**
- Configuration schema should be well-documented
- Presets should be easily extendable
- Configuration should support both file-based and programmatic setup
- Consider using JSON Schema for validation

## Technical Requirements

### Configuration Structure

The configuration system must support:

1. **Team Definitions**
   - Team ID, name, velocity
   - Team type (BA, Dev, QA, etc.)
   - Default coefficients for estimate derivation

2. **Estimation Coefficients**
   - Percentage-based coefficients (0.0-1.0)
   - Hours-per-story-point coefficients
   - Per-team-type defaults
   - Per-work-type overrides

3. **Subtask Matching Rules**
   - Component-based matching
   - Label-based matching
   - Summary pattern matching (regex or tags)
   - Issue type filtering

4. **Task Sequencing**
   - Sequential execution definition
   - Parallel execution groups
   - Dependency chains
   - Team capacity constraints

5. **Presets**
   - Predefined team structures
   - Predefined coefficient sets
   - Predefined sequencing patterns

### Data Flow

1. **Input**: Story with optional estimate and optional subtasks with estimates
2. **Processing**:
   - Determine estimation case (1, 2, or 3)
   - Apply appropriate calculation logic
   - Generate team-specific estimates
   - Apply sequencing rules
3. **Output**: Team estimates with sequencing information

### Integration Points

- **CSV Ingestion**: Must work with existing CSV parser
- **JIRA Integration**: Must work with existing JIRA extractor
- **Schedule Calculator**: Must integrate with existing schedule calculation engine
- **Configuration System**: Must extend existing configuration management

## Out of Scope

- Real-time collaboration features
- Advanced dependency resolution algorithms
- Automatic task decomposition
- Machine learning-based estimation

## Success Criteria

1. System correctly handles all three estimation cases
2. Team estimates are accurately calculated and validated
3. Configuration system is flexible and UI-ready
4. Presets cover common use cases
5. Integration with existing system components is seamless
6. Documentation is comprehensive and clear

## Dependencies

- Existing CSV ingestion subsystem
- Existing JIRA extraction subsystem
- Existing schedule calculation subsystem
- Existing configuration management subsystem

## Related Documentation

- [Technical Requirements](./solution/technical-requirements.md)
- [Schedule Calculation Subsystem](./solution/subsystems/schedule-calculation.md)
- [Configuration Subsystem](./solution/subsystems/configuration.md)
