/**
 * Configuration validator for schedule configuration.
 * 
 * Validates that all required fields are present, correctly typed, and meet
 * business rules (positive numbers, valid ISO date format).
 */

import type { ScheduleConfig, RawScheduleConfig } from './types';

export interface ValidationError {
  /** Field name that failed validation */
  field: string;
  /** Error message describing the validation failure */
  message: string;
}

export interface ValidationResult {
  /** Whether the configuration is valid */
  valid: boolean;
  /** Array of validation errors (empty if valid) */
  errors: ValidationError[];
  /** Validated configuration object (only present if valid) */
  config?: ScheduleConfig;
}

/**
 * Validates a raw configuration object.
 * 
 * Performs the following validations:
 * - Checks for presence of all required fields
 * - Validates projectStartDate is a valid ISO date string (YYYY-MM-DD)
 * - Validates sprintDurationDays is a positive number
 * - Validates velocity is a positive number
 * 
 * @param rawConfig - Raw configuration object from JSON file
 * @returns Validation result with errors or validated config
 */
export function validateConfig(rawConfig: RawScheduleConfig): ValidationResult {
  const errors: ValidationError[] = [];

  // Check for required fields
  if (rawConfig.projectStartDate === undefined || rawConfig.projectStartDate === null) {
    errors.push({
      field: 'projectStartDate',
      message: 'Missing required field: projectStartDate',
    });
  }

  if (rawConfig.sprintDurationDays === undefined || rawConfig.sprintDurationDays === null) {
    errors.push({
      field: 'sprintDurationDays',
      message: 'Missing required field: sprintDurationDays',
    });
  }

  if (rawConfig.velocity === undefined || rawConfig.velocity === null) {
    errors.push({
      field: 'velocity',
      message: 'Missing required field: velocity',
    });
  }

  // If any required fields are missing, return early
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Validate projectStartDate format (ISO date: YYYY-MM-DD)
  const projectStartDate = rawConfig.projectStartDate;
  if (typeof projectStartDate !== 'string') {
    errors.push({
      field: 'projectStartDate',
      message: 'projectStartDate must be a string in ISO format (YYYY-MM-DD)',
    });
  } else {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!isoDateRegex.test(projectStartDate)) {
      errors.push({
        field: 'projectStartDate',
        message: 'projectStartDate must be in ISO format: YYYY-MM-DD (e.g., "2024-01-01")',
      });
    } else {
      // Validate that it's a valid date
      const date = new Date(projectStartDate);
      if (isNaN(date.getTime())) {
        errors.push({
          field: 'projectStartDate',
          message: `projectStartDate is not a valid date: ${projectStartDate}`,
        });
      } else {
        // Check if the date string matches the parsed date (prevents dates like "2024-13-45")
        const [year, month, day] = projectStartDate.split('-').map(Number);
        const expectedDate = new Date(year, month - 1, day);
        if (
          expectedDate.getFullYear() !== year ||
          expectedDate.getMonth() !== month - 1 ||
          expectedDate.getDate() !== day
        ) {
          errors.push({
            field: 'projectStartDate',
            message: `projectStartDate is not a valid date: ${projectStartDate}`,
          });
        }
      }
    }
  }

  // Validate sprintDurationDays is a positive number
  const sprintDurationDays = rawConfig.sprintDurationDays;
  if (typeof sprintDurationDays !== 'number') {
    errors.push({
      field: 'sprintDurationDays',
      message: 'sprintDurationDays must be a number',
    });
  } else if (sprintDurationDays <= 0) {
    errors.push({
      field: 'sprintDurationDays',
      message: 'sprintDurationDays must be a positive number (> 0)',
    });
  } else if (!Number.isInteger(sprintDurationDays)) {
    errors.push({
      field: 'sprintDurationDays',
      message: 'sprintDurationDays must be an integer',
    });
  }

  // Validate velocity is a positive number
  const velocity = rawConfig.velocity;
  if (typeof velocity !== 'number') {
    errors.push({
      field: 'velocity',
      message: 'velocity must be a number',
    });
  } else if (velocity <= 0) {
    errors.push({
      field: 'velocity',
      message: 'velocity must be a positive number (> 0)',
    });
  }

  // Validate optional changeHistory configuration
  let changeHistory: ScheduleConfig['changeHistory'] = undefined;
  if (rawConfig.changeHistory !== undefined && rawConfig.changeHistory !== null) {
    if (typeof rawConfig.changeHistory !== 'object' || Array.isArray(rawConfig.changeHistory)) {
      errors.push({
        field: 'changeHistory',
        message: 'changeHistory must be an object',
      });
    } else {
      const changeHistoryObj = rawConfig.changeHistory;
      
      // Validate jql is present and is a string
      if (changeHistoryObj.jql === undefined || changeHistoryObj.jql === null) {
        errors.push({
          field: 'changeHistory.jql',
          message: 'changeHistory.jql is required when changeHistory is provided',
        });
      } else if (typeof changeHistoryObj.jql !== 'string') {
        errors.push({
          field: 'changeHistory.jql',
          message: 'changeHistory.jql must be a string',
        });
      } else if (changeHistoryObj.jql.trim().length === 0) {
        errors.push({
          field: 'changeHistory.jql',
          message: 'changeHistory.jql must not be empty',
        });
      } else {
        // Validate optional fieldMapping
        let fieldMapping: NonNullable<ScheduleConfig['changeHistory']>['fieldMapping'] = undefined;
        if (changeHistoryObj.fieldMapping !== undefined && changeHistoryObj.fieldMapping !== null) {
          if (typeof changeHistoryObj.fieldMapping !== 'object' || Array.isArray(changeHistoryObj.fieldMapping)) {
            errors.push({
              field: 'changeHistory.fieldMapping',
              message: 'changeHistory.fieldMapping must be an object',
            });
          } else {
            const fieldMappingObj = changeHistoryObj.fieldMapping;
            const mapping: { sprint?: string; storyPoints?: string } = {};
            
            if (fieldMappingObj.sprint !== undefined && fieldMappingObj.sprint !== null) {
              if (typeof fieldMappingObj.sprint !== 'string') {
                errors.push({
                  field: 'changeHistory.fieldMapping.sprint',
                  message: 'changeHistory.fieldMapping.sprint must be a string',
                });
              } else {
                mapping.sprint = fieldMappingObj.sprint;
              }
            }
            
            if (fieldMappingObj.storyPoints !== undefined && fieldMappingObj.storyPoints !== null) {
              if (typeof fieldMappingObj.storyPoints !== 'string') {
                errors.push({
                  field: 'changeHistory.fieldMapping.storyPoints',
                  message: 'changeHistory.fieldMapping.storyPoints must be a string',
                });
              } else {
                mapping.storyPoints = fieldMappingObj.storyPoints;
              }
            }
            
            if (Object.keys(mapping).length > 0) {
              fieldMapping = mapping;
            }
          }
        }
        
        if (!errors.some(e => e.field.startsWith('changeHistory'))) {
          changeHistory = {
            jql: changeHistoryObj.jql as string,
            fieldMapping: fieldMapping,
          };
        }
      }
    }
  }

  // If there are errors, return them
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // All validations passed, return validated config
  return {
    valid: true,
    errors: [],
    config: {
      projectStartDate: projectStartDate as string,
      sprintDurationDays: sprintDurationDays as number,
      velocity: velocity as number,
      changeHistory: changeHistory,
    },
  };
}

/**
 * Formats validation errors into a user-friendly error message.
 * 
 * @param errors - Array of validation errors
 * @returns Formatted error message string
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) {
    return '';
  }

  if (errors.length === 1) {
    return `Configuration validation failed: ${errors[0].field} - ${errors[0].message}`;
  }

  const errorMessages = errors.map(err => `  - ${err.field}: ${err.message}`).join('\n');
  return `Configuration validation failed with ${errors.length} error(s):\n${errorMessages}`;
}
