/**
 * Estimate validation and processing utilities.
 * 
 * Handles validation and conversion of estimates based on configuration:
 * - Story Points: validates against allowed values (1, 2, 3, 5, 8)
 * - Days/Hours: converts days/weeks to hours, validates decimal values
 */

import { EstimateConfig, DEFAULT_CONFIG } from '../config/Config';
import { logger } from './logger';

/**
 * Validates and processes an estimate value based on configuration.
 * 
 * @param estimateValue - Raw estimate value from CSV (string)
 * @param config - Configuration for estimate processing
 * @param rowNumber - Row number for logging purposes
 * @returns Processed estimate in hours, or default value (1) if invalid
 */
export function processEstimate(
  estimateValue: string | undefined,
  config: EstimateConfig = DEFAULT_CONFIG,
  rowNumber?: number
): number {
  // Handle missing estimate
  if (!estimateValue || estimateValue.trim() === '') {
    logger.warn('Missing estimate, defaulting to 1', rowNumber, { estimateValue });
    return 1;
  }

  const trimmed = estimateValue.trim();

  if (config.estimateType === 'story-points') {
    return processStoryPoints(trimmed, config, rowNumber);
  } else {
    return processDaysHours(trimmed, config, rowNumber);
  }
}

/**
 * Validates and processes Story Points estimate.
 * 
 * @param value - Estimate value string
 * @param config - Configuration with valid story points
 * @param rowNumber - Row number for logging
 * @returns Story points value (converted to hours: 1 SP = 8 hours), or 1 if invalid
 */
function processStoryPoints(
  value: string,
  config: EstimateConfig,
  rowNumber?: number
): number {
  const numValue = parseFloat(value);
  
  // Check if it's a valid number
  if (isNaN(numValue) || numValue <= 0) {
    logger.warn(
      `Invalid story points estimate: "${value}", defaulting to 1`,
      rowNumber,
      { value, validStoryPoints: config.validStoryPoints }
    );
    return 1;
  }

  // Check if it's a whole number
  if (!Number.isInteger(numValue)) {
    logger.warn(
      `Story points must be whole numbers, got: "${value}", defaulting to 1`,
      rowNumber,
      { value }
    );
    return 1;
  }

  // Check if it's in the allowed list
  if (!config.validStoryPoints.includes(numValue)) {
    logger.warn(
      `Invalid story points value: ${numValue}, allowed values: ${config.validStoryPoints.join(', ')}, defaulting to 1`,
      rowNumber,
      { value: numValue, validStoryPoints: config.validStoryPoints }
    );
    return 1;
  }

  // Check maximum (>= 13 story points is invalid)
  if (numValue >= 13) {
    logger.warn(
      `Story points value too large: ${numValue} (>= 13), defaulting to 1`,
      rowNumber,
      { value: numValue }
    );
    return 1;
  }

  // Convert story points to hours (1 SP = 8 hours by default)
  return numValue * config.hoursPerDay;
}

/**
 * Validates and processes Days/Hours estimate.
 * 
 * Supports formats:
 * - "8h" or "8 h" -> 8 hours
 * - "2d" or "2 d" -> 2 days (converted to hours)
 * - "1w" or "1 w" -> 1 week (converted to hours)
 * - "4.5" -> 4.5 hours (if no unit, assumes hours)
 * 
 * @param value - Estimate value string
 * @param config - Configuration with hours per day
 * @param rowNumber - Row number for logging
 * @returns Estimate in hours, or 1 if invalid
 */
function processDaysHours(
  value: string,
  config: EstimateConfig,
  rowNumber?: number
): number {
  // Remove whitespace and convert to lowercase
  const normalized = value.replace(/\s+/g, '').toLowerCase();
  
  // Match patterns: number followed by optional unit (h, d, w)
  const match = normalized.match(/^(\d+(?:\.\d+)?)([hdw]?)$/);
  
  if (!match) {
    logger.warn(
      `Invalid days/hours estimate format: "${value}", defaulting to 1`,
      rowNumber,
      { value }
    );
    return 1;
  }

  const numericValue = parseFloat(match[1]);
  const unit = match[2] || 'h'; // Default to hours if no unit

  // Validate numeric value
  if (isNaN(numericValue) || numericValue <= 0) {
    logger.warn(
      `Invalid numeric value in estimate: "${value}", defaulting to 1`,
      rowNumber,
      { value }
    );
    return 1;
  }

  // Check maximum (>= 7 days is invalid)
  if (unit === 'd' && numericValue >= 7) {
    logger.warn(
      `Days estimate too large: ${numericValue} days (>= 7), defaulting to 1`,
      rowNumber,
      { value: numericValue, unit }
    );
    return 1;
  }

  // Convert to hours
  let hours: number;
  switch (unit) {
    case 'h':
      hours = numericValue;
      break;
    case 'd':
      hours = numericValue * config.hoursPerDay;
      break;
    case 'w':
      hours = numericValue * config.hoursPerDay * 5; // 5 working days per week
      break;
    default:
      hours = numericValue; // Default to hours
  }

  return hours;
}
