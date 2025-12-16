/**
 * Configuration interface for estimate processing.
 * 
 * Determines how estimates are validated and converted based on team workflow.
 */
export interface EstimateConfig {
  /** Type of estimate: 'story-points' or 'days-hours' */
  estimateType: 'story-points' | 'days-hours';
  
  /** Hours per day for conversion (default: 8) */
  hoursPerDay: number;
  
  /** Valid story point values (only used when estimateType is 'story-points') */
  validStoryPoints: number[];
}

/**
 * Default configuration for estimate processing.
 */
export const DEFAULT_CONFIG: EstimateConfig = {
  estimateType: 'story-points',
  hoursPerDay: 8,
  validStoryPoints: [1, 2, 3, 5, 8],
};
