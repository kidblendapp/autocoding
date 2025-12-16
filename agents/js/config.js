/**
 * Configuration constants for agent scripts
 * Central location for all hardcoded values used across agent workflows
 */

// Jira Issue Types
const ISSUE_TYPES = {
    SUBTASK: 'Subtask',
    TASK: 'Task',
    STORY: 'Story',
    BUG: 'Bug'
};

// Jira Statuses
const STATUSES = {
    IN_REVIEW: 'In Review',
    IN_PROGRESS: 'In Progress',
    TODO: 'To Do',
    DONE: 'Done'
};

// Jira Priorities
const PRIORITIES = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    HIGHEST: 'Highest',
    LOWEST: 'Lowest'
};

// Labels
const LABELS = {
    AI_GENERATED: 'ai_generated',
    AI_QUESTIONS_ASKED: 'ai_questions_asked',
    AI_SOLUTION_DESIGN_CREATED: 'ai_solution_design_created',
    AI_DEVELOPED: 'ai_developed',
    SD_CORE: 'sd_core',
    SD_API: 'sd_api',
    SD_UI: 'sd_ui',
    NEEDS_API_IMPLEMENTATION: 'needs_api_implementation',
    NEEDS_CORE_IMPLEMENTATION: 'needs_core_implementation'
};

// Git Configuration
const GIT_CONFIG = {
    AUTHOR_NAME: 'AI Teammate',
    AUTHOR_EMAIL: 'agent.ai.native@gmail.com',
    DEFAULT_BASE_BRANCH: 'main',
    DEFAULT_ISSUE_TYPE_PREFIX: 'feature'
};

// Solution Design Component Prefixes (based on technical boundaries)
const MODULE_PREFIXES = {
    DATA_INGESTION: '[SD Data Ingestion]',
    SCHEDULING_ENGINE: '[SD Scheduling Engine]',
    OUTPUT_LAYER: '[SD Output Layer]',
    SCENARIO_1: '[SD Scenario 1]',
    SCENARIO_2: '[SD Scenario 2]',
    SCENARIO_3: '[SD Scenario 3]',
    // Legacy support (deprecated, but kept for backward compatibility)
    CORE: '[SD CORE]',
    API: '[SD API]',
    UI: '[SD UI]'
};

// Technical Component Configuration for Solution Design
// Based on logical boundaries from technical requirements
const SOLUTION_DESIGN_COMPONENTS = [
    { flag: 'dataIngestion', prefix: MODULE_PREFIXES.DATA_INGESTION, label: 'sd_data_ingestion', description: 'Data Ingestion Layer: Parsers (CSV/XLSX), normalization, team assignment resolution' },
    { flag: 'schedulingEngine', prefix: MODULE_PREFIXES.SCHEDULING_ENGINE, label: 'sd_scheduling_engine', description: 'Core Scheduling Engine: Models, queue management, allocation logic, calendar awareness' },
    { flag: 'outputLayer', prefix: MODULE_PREFIXES.OUTPUT_LAYER, label: 'sd_output_layer', description: 'Output Layer: JSON timeline format, visualization support' }
];

// Scenario-based Configuration (alternative decomposition approach)
const SOLUTION_DESIGN_SCENARIOS = [
    { flag: 'scenario1', prefix: MODULE_PREFIXES.SCENARIO_1, label: 'sd_scenario_1', description: 'Scenario 1: High-level estimates per team (Completed/Remaining)' },
    { flag: 'scenario2', prefix: MODULE_PREFIXES.SCENARIO_2, label: 'sd_scenario_2', description: 'Scenario 2: Partial team estimates with subtasks' },
    { flag: 'scenario3', prefix: MODULE_PREFIXES.SCENARIO_3, label: 'sd_scenario_3', description: 'Scenario 3: All estimates in subtasks' }
];

// Legacy module configuration (deprecated - kept for backward compatibility)
const SOLUTION_DESIGN_MODULES = [
    { flag: 'core', prefix: MODULE_PREFIXES.CORE, label: LABELS.SD_CORE },
    { flag: 'api', prefix: MODULE_PREFIXES.API, label: LABELS.SD_API },
    { flag: 'ui', prefix: MODULE_PREFIXES.UI, label: LABELS.SD_UI }
];

// Diagram Defaults
const DIAGRAM_DEFAULTS = {
    API_SEQUENCE: 'sequenceDiagram\n    participant Client\n    participant API\n    Client->>API: Request\n    API-->>Client: Response',
    CORE_GRAPH: 'graph TD\n    A[SD CORE Enhancement] --> B[Technical Implementation]'
};

// Diagram Formatting
const DIAGRAM_FORMAT = {
    MERMAID_WRAPPER_START: '{code:mermaid}\n',
    MERMAID_WRAPPER_END: '\n{code}'
};

// Field Names
const JIRA_FIELDS = {
    DIAGRAMS: 'Diagrams'
};

// Summary Length Constraints
const SUMMARY_MAX_LENGTH = 120;

// Export all configuration
module.exports = {
    ISSUE_TYPES,
    STATUSES,
    PRIORITIES,
    LABELS,
    GIT_CONFIG,
    MODULE_PREFIXES,
    SOLUTION_DESIGN_COMPONENTS,
    SOLUTION_DESIGN_SCENARIOS,
    SOLUTION_DESIGN_MODULES, // Legacy, deprecated
    DIAGRAM_DEFAULTS,
    DIAGRAM_FORMAT,
    JIRA_FIELDS,
    SUMMARY_MAX_LENGTH
};

