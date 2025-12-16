/**
 * Estimate processor for validating and converting estimates based on configuration.
 * 
 * Handles Story Points validation (1,2,3,5,8 only) and Days/Hours conversion
 * to hours based on team configuration.
 */

import { logger } from '../utils/logger';
import { TeamConfig, EstimateType } from '../config/types';

/**
 * Validates and processes an estimate value based on configuration.
 * 
 * @param estimateValue - Raw estimate value from CSV (string)
 * @param config - Team configuration for estimate validation
 * @returns Processed estimate in hours, or null if invalid
 */
export function processEstimate(
  estimateValue: string | undefined,
  config: TeamConfig
): number | null {
  // Handle missing or empty estimate
  if (!estimateValue || estimateValue.trim() === '') {
    return null;
  }

  const trimmed = estimateValue.trim();

  if (config.estimateType === 'story-points') {
    return processStoryPoints(trimmed, config);
  } else {
    return processDaysHours(trimmed, config);
  }
}

/**
 * Processes Story Points estimate.
 * Validates that the value is one of the allowed values (1, 2, 3, 5, 8 by default).
 * 
 * @param value - Estimate value as string
 * @param config - Team configuration
 * @returns Story points value if valid, null otherwise
 */
function processStoryPoints(value: string, config: TeamConfig): number | null {
  const storyPoint = parseFloat(value);
  
  // Check if it's a valid number
  if (isNaN(storyPoint) || storyPoint <= 0) {
    return null;
  }

  // Check if it's a whole number
  if (!Number.isInteger(storyPoint)) {
    return null;
  }

  // Validate against allowed values
  const validPoints = config.validStoryPoints || [1, 2, 3, 5, 8];
  if (!validPoints.includes(storyPoint)) {
    return null;
  }

  // Check maximum limit (>= 13 story points is invalid per requirements)
  if (storyPoint >= 13) {
    return null;
  }

  // Story points are returned as-is (they represent relative effort)
  // Conversion to hours happens later in the scheduling engine
  return storyPoint;
}

/**
 * Processes Days/Hours estimate.
 * Converts days, weeks, or hours to hours based on configuration.
 * 
 * @param value - Estimate value as string (e.g., "4h", "2d", "1w")
 * @param config - Team configuration
 * @returns Hours value if valid, null otherwise
 */
function processDaysHours(value: string, config: TeamConfig): number | null {
  const hoursPerDay = config.hoursPerDay || 8;
  
  // Match patterns like "4h", "2d", "1w", "4.5h", "2.5d"
  const match = value.match(/^(\d+(?:\.\d+)?)\s*([hdw])$/i);
  
  if (!match) {
    // If it contains non-numeric characters (except decimal point), reject it
    if (!/^\d+(?:\.\d+)?$/.test(value.trim())) {
      return null;
    }
    // Try to parse as plain number (assume hours)
    const hours = parseFloat(value);
    if (!isNaN(hours) && hours > 0) {
      // Check maximum limit (>= 7 days = 56 hours is invalid per requirements)
      if (hours >= 7 * hoursPerDay) {
        return null;
      }
      return hours;
    }
    return null;
  }

  const amount = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  if (amount <= 0) {
    return null;
  }

  let hours: number;

  switch (unit) {
    case 'h':
      hours = amount;
      break;
    case 'd':
      hours = amount * hoursPerDay;
      break;
    case 'w':
      hours = amount * 5 * hoursPerDay; // 5 working days per week
      break;
    default:
      return null;
  }

  // Check maximum limit (>= 7 calendar days = 56 hours is invalid per requirements)
  // For weeks, we calculate working days but compare against calendar day limit
  // This allows reasonable week estimates (e.g., 2 weeks = 10 working days = 80 hours)
  // while still rejecting excessive day estimates (e.g., 7d = 56 hours)
  const maxHours = 7 * hoursPerDay; // 7 calendar days
  
  // Special handling: weeks are allowed up to 2 weeks (10 working days)
  // since they represent a different planning unit
  if (unit === 'w') {
    // Allow weeks up to 2 weeks (10 working days)
    if (amount > 2) {
      return null;
    }
  } else {
    // For hours and days, apply the 7 calendar day limit
    if (hours >= maxHours) {
      return null;
    }
  }

  return hours;
}

/**
 * Validates and processes an estimate with logging.
 * 
 * @param estimateValue - Raw estimate value from CSV
 * @param config - Team configuration
 * @param rowNumber - Row number for logging
 * @param defaultValue - Default value to use if estimate is invalid (default: 1)
 * @returns Processed estimate in hours
 */
export function validateAndProcessEstimate(
  estimateValue: string | undefined,
  config: TeamConfig,
  rowNumber: number,
  defaultValue: number = 1
): number {
  const processed = processEstimate(estimateValue, config);
  
  if (processed === null) {
    const reason = !estimateValue || estimateValue.trim() === '' 
      ? 'missing' 
      : 'invalid';
    logger.warn(
      `Estimate ${reason}, defaulting to ${defaultValue}`,
      rowNumber,
      { originalValue: estimateValue, configType: config.estimateType }
    );
    return defaultValue;
  }

  return processed;
}
