/**
 * TypeScript interfaces for configuration files
 */

/**
 * Custom field mapping configuration for JIRA fields.
 * Maps logical field names to JIRA custom field IDs.
 */
export interface CustomFieldMapping {
  /** Custom field ID for Team (e.g., "customfield_10001") */
  team?: string;
  /** Custom field ID for Story Points (e.g., "customfield_10052") */
  storyPoints?: string;
  /** Custom field ID for Original Estimate (e.g., "customfield_10410") */
  originalEstimate?: string;
  /** Custom field ID for Epic Link (e.g., "customfield_10008") */
  epicLink?: string;
  /** Custom field ID for Sprint (e.g., "customfield_10010") */
  sprint?: string;
  /** Custom field ID for Date field (e.g., "customfield_10098") */
  dateField?: string;
  /** Custom field ID for DateTime field (e.g., "customfield_10012") */
  dateTimeField?: string;
}

export interface JiraConfig {
  jiraPath: string;
  jiraEmail: string;
  jiraApiToken: string;
  projectName: string;
  /** Custom field ID mapping for JIRA fields */
  customFieldMapping?: CustomFieldMapping;
  /** Display names for custom fields (maps field ID to human-readable name) */
  customFieldNames?: Record<string, string>;
}

export interface TeamConfig {
  name: string;
  includeInSchedule: boolean;
  velocity: number;
  velocityPeriod: 'sprint' | 'day' | 'week';
  members: string[];
  matchRules: {
    issueTypes: string[];
    jiraTeam: string[];
    components: string[];
    labels: string[];
    summaryText: string[];
    statuses: string[];
  };
}

export interface WorkTypeSequence {
  role: string;
  estimateMethod: 'percentage' | 'subtasks';
  percentage?: number;
  subtaskMatch?: {
    titleTags?: string[];
    components?: string[];
    labels?: string[];
  };
  statuses: string[];
  executionTeam: string;
}

export type GroupingLevel = 'fixVersion' | 'epic' | 'sprint' | 'team';

export interface ScheduleConfig {
  projectStartDate: string;
  projectReschedulingDate?: string;
  sprintDurationDays: number;
  /** Issue types to use for planning operations (decomposition and schedule generation) */
  planningIssueTypes?: string[];
  /** Fix versions to use for planning operations (decomposition and schedule generation) */
  planningFixVersions?: string[];
  /** @deprecated Use ganttGroupingLevels instead */
  ganttGrouping?: 'epicSprint' | 'sprintTeam' | 'sprintEpic' | 'epicTeam' | 'teamSprint' | 'teamEpic';
  ganttGroupingLevels?: GroupingLevel[];
  jql?: string;
  predecessorLinkTypes?: string[];
  estimateType?: 'storyPoints' | 'hours';
  nonWorkingDays?: string[];
  teams: Record<string, TeamConfig>;
  workTypes?: Record<string, { name: string }>;
  workTypeSequences?: Record<string, WorkTypeSequence[]>;
}

/**
 * Extracted field values from JIRA (stored in extracted-values.json)
 */
export interface ExtractedValues {
  issueTypes?: string[];
  fixVersions?: string[];
  linkTypes?: string[];
  teams?: string[];
  components?: string[];
  statuses?: string[];
  lastExtracted?: string;
  projectName?: string;
}
