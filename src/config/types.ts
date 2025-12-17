/**
 * Configuration types for estimate validation and processing.
 */

export type EstimateType = 'story-points' | 'days-hours';

export interface TeamConfig {
  /** Type of estimation used by the team */
  estimateType: EstimateType;
  
  /** Hours per day for conversion (default: 8) */
  hoursPerDay?: number;
  
  /** Valid story point values (only used when estimateType is 'story-points') */
  validStoryPoints?: number[];
}

export interface AppConfig {
  /** Default team configuration */
  defaultTeam: TeamConfig;
  
  /** Team-specific configurations */
  teams?: Record<string, TeamConfig>;
}

/**
 * Default configuration with standard values.
 */
export const defaultConfig: AppConfig = {
  defaultTeam: {
    estimateType: 'story-points',
    hoursPerDay: 8,
    validStoryPoints: [1, 2, 3, 5, 8],
  },
};

/**
 * Change history field mapping configuration.
 */
export interface ChangeHistoryFieldMapping {
  /** Custom field code for Sprint field (e.g., "customfield_10020") */
  sprint?: string;
  
  /** Custom field code for Story Points field (e.g., "customfield_10021") */
  storyPoints?: string;
}

/**
 * Change history extraction configuration.
 */
export interface ChangeHistoryConfig {
  /** JQL query to select tickets for change history extraction */
  jql: string;
  
  /** Optional field mapping for custom fields */
  fieldMapping?: ChangeHistoryFieldMapping;
}

/**
 * Schedule configuration for Gantt schedule calculations.
 * 
 * This configuration defines team velocity and project timeline parameters
 * that are used by the scheduler component for accurate schedule calculations.
 */
export interface ScheduleConfig {
  /** 
   * Project start date in ISO format (YYYY-MM-DD).
   * Example: "2024-02-01"
   */
  projectStartDate: string;
  
  /** 
   * Sprint duration in days. Must be a positive number.
   * Example: 10
   */
  sprintDurationDays: number;
  
  /** 
   * Team velocity (story points per sprint). Must be a positive number.
   * Example: 20
   */
  velocity: number;
  
  /** 
   * Optional array of non-working days (holidays) in ISO format (YYYY-MM-DD).
   * Weekends (Saturday, Sunday) are automatically excluded.
   * Example: ["2024-12-25", "2024-01-01"]
   */
  nonWorkingDays?: string[];
  
  /** 
   * Optional change history extraction configuration.
   * If provided, change history will be extracted and exported to CSV.
   */
  changeHistory?: ChangeHistoryConfig;
}

/**
 * Raw configuration object as read from config.json file.
 * This type represents the unvalidated structure before validation.
 */
export interface RawScheduleConfig {
  projectStartDate?: unknown;
  sprintDurationDays?: unknown;
  velocity?: unknown;
  nonWorkingDays?: unknown;
  changeHistory?: {
    jql?: unknown;
    fieldMapping?: {
      sprint?: unknown;
      storyPoints?: unknown;
    };
  };
}
