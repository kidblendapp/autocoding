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
}

/**
 * Raw configuration object as read from config.json file.
 * This type represents the unvalidated structure before validation.
 */
export interface RawScheduleConfig {
  projectStartDate?: unknown;
  sprintDurationDays?: unknown;
  velocity?: unknown;
}
