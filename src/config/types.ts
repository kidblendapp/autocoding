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
