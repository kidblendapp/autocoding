/**
 * Configuration validator for team estimate configuration.
 * 
 * Validates that all required fields are present, correctly typed, and meet
 * business rules (valid coefficients, team definitions, matching rules).
 */

import type { 
  TeamEstimateConfiguration,
  TeamCoefficient,
  CoefficientMethod,
  EstimationRule,
  ExecutionMode,
  TeamEstimateConfig,
  EstimatePreset,
  SubtaskMatchCriteria,
  HybridEstimationConfig,
} from './team-estimate-types';

export interface TeamEstimateValidationError {
  /** Field name that failed validation */
  field: string;
  /** Error message describing the validation failure */
  message: string;
}

export interface TeamEstimateValidationResult {
  /** Whether the configuration is valid */
  valid: boolean;
  /** Array of validation errors (empty if valid) */
  errors: TeamEstimateValidationError[];
  /** Validated configuration object (only present if valid) */
  config?: TeamEstimateConfiguration;
}

/**
 * Validates a team estimate configuration object.
 * 
 * @param rawConfig - Raw configuration object from JSON file
 * @returns Validation result with errors or validated config
 */
export function validateTeamEstimateConfig(
  rawConfig: unknown
): TeamEstimateValidationResult {
  const errors: TeamEstimateValidationError[] = [];

  // Check if config is an object
  if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
    errors.push({
      field: 'root',
      message: 'Configuration must be an object',
    });
    return { valid: false, errors };
  }

  const config = rawConfig as Record<string, unknown>;

  // Validate version
  if (!config.version || typeof config.version !== 'string') {
    errors.push({
      field: 'version',
      message: 'Missing or invalid required field: version',
    });
  }

  // Validate defaultPreset
  if (!config.defaultPreset || typeof config.defaultPreset !== 'string') {
    errors.push({
      field: 'defaultPreset',
      message: 'Missing or invalid required field: defaultPreset',
    });
  }

  // Validate presets
  if (!config.presets || typeof config.presets !== 'object' || Array.isArray(config.presets)) {
    errors.push({
      field: 'presets',
      message: 'Missing or invalid required field: presets',
    });
  } else {
    const presets = config.presets as Record<string, unknown>;
    const defaultPreset = config.defaultPreset as string;
    
    if (defaultPreset && !presets[defaultPreset]) {
      errors.push({
        field: 'defaultPreset',
        message: `Default preset "${defaultPreset}" not found in presets`,
      });
    }

    // Validate each preset
    for (const [presetKey, preset] of Object.entries(presets)) {
      validatePreset(preset, presetKey, errors);
    }
  }

  // Validate teams
  if (!config.teams || typeof config.teams !== 'object' || Array.isArray(config.teams)) {
    errors.push({
      field: 'teams',
      message: 'Missing or invalid required field: teams',
    });
  } else {
    const teams = config.teams as Record<string, unknown>;
    
    if (Object.keys(teams).length === 0) {
      errors.push({
        field: 'teams',
        message: 'At least one team must be defined',
      });
    }

    // Validate each team
    for (const [teamKey, team] of Object.entries(teams)) {
      validateTeam(team, teamKey, errors);
    }
  }

  // Validate estimationRules
  if (!config.estimationRules || typeof config.estimationRules !== 'object' || Array.isArray(config.estimationRules)) {
    errors.push({
      field: 'estimationRules',
      message: 'Missing or invalid required field: estimationRules',
    });
  } else {
    const rules = config.estimationRules as Record<string, unknown>;
    
    // Validate case1_storyOnly
    if (rules.case1_storyOnly) {
      validateEstimationRule(rules.case1_storyOnly, 'estimationRules.case1_storyOnly', errors, 'coefficients');
    } else {
      errors.push({
        field: 'estimationRules.case1_storyOnly',
        message: 'Missing required estimation rule: case1_storyOnly',
      });
    }

    // Validate case2_hybrid
    if (rules.case2_hybrid) {
      validateEstimationRule(rules.case2_hybrid, 'estimationRules.case2_hybrid', errors, 'hybrid');
    } else {
      errors.push({
        field: 'estimationRules.case2_hybrid',
        message: 'Missing required estimation rule: case2_hybrid',
      });
    }

    // Validate case3_subtasksOnly
    if (rules.case3_subtasksOnly) {
      validateEstimationRule(rules.case3_subtasksOnly, 'estimationRules.case3_subtasksOnly', errors, 'subtasks');
    } else {
      errors.push({
        field: 'estimationRules.case3_subtasksOnly',
        message: 'Missing required estimation rule: case3_subtasksOnly',
      });
    }
  }

  // Validate taskSequencing
  if (!config.taskSequencing || typeof config.taskSequencing !== 'object' || Array.isArray(config.taskSequencing)) {
    errors.push({
      field: 'taskSequencing',
      message: 'Missing or invalid required field: taskSequencing',
    });
  } else {
    validateTaskSequencing(config.taskSequencing as Record<string, unknown>, errors);
  }

  // Validate uiSettings
  if (!config.uiSettings || typeof config.uiSettings !== 'object' || Array.isArray(config.uiSettings)) {
    errors.push({
      field: 'uiSettings',
      message: 'Missing or invalid required field: uiSettings',
    });
  } else {
    validateUISettings(config.uiSettings as Record<string, unknown>, errors);
  }

  // If there are errors, return them
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // All validations passed, return validated config
  return {
    valid: true,
    errors: [],
    config: rawConfig as TeamEstimateConfiguration,
  };
}

/**
 * Validates a preset configuration.
 */
function validatePreset(
  preset: unknown,
  presetKey: string,
  errors: TeamEstimateValidationError[]
): void {
  if (!preset || typeof preset !== 'object' || Array.isArray(preset)) {
    errors.push({
      field: `presets.${presetKey}`,
      message: 'Preset must be an object',
    });
    return;
  }

  const presetObj = preset as Record<string, unknown>;

  if (!presetObj.name || typeof presetObj.name !== 'string') {
    errors.push({
      field: `presets.${presetKey}.name`,
      message: 'Preset name is required',
    });
  }

  if (!presetObj.teamCoefficients || typeof presetObj.teamCoefficients !== 'object' || Array.isArray(presetObj.teamCoefficients)) {
    errors.push({
      field: `presets.${presetKey}.teamCoefficients`,
      message: 'Preset teamCoefficients must be an object',
    });
  } else {
    const coefficients = presetObj.teamCoefficients as Record<string, unknown>;
    for (const [teamType, coefficient] of Object.entries(coefficients)) {
      validateCoefficient(coefficient, `presets.${presetKey}.teamCoefficients.${teamType}`, errors);
    }
  }
}

/**
 * Validates a team configuration.
 */
function validateTeam(
  team: unknown,
  teamKey: string,
  errors: TeamEstimateValidationError[]
): void {
  if (!team || typeof team !== 'object' || Array.isArray(team)) {
    errors.push({
      field: `teams.${teamKey}`,
      message: 'Team must be an object',
    });
    return;
  }

  const teamObj = team as Record<string, unknown>;

  if (!teamObj.id || typeof teamObj.id !== 'string') {
    errors.push({
      field: `teams.${teamKey}.id`,
      message: 'Team id is required',
    });
  }

  if (!teamObj.name || typeof teamObj.name !== 'string') {
    errors.push({
      field: `teams.${teamKey}.name`,
      message: 'Team name is required',
    });
  }

  if (!teamObj.type || typeof teamObj.type !== 'string') {
    errors.push({
      field: `teams.${teamKey}.type`,
      message: 'Team type is required',
    });
  }

  if (teamObj.velocity === undefined || typeof teamObj.velocity !== 'number' || teamObj.velocity <= 0) {
    errors.push({
      field: `teams.${teamKey}.velocity`,
      message: 'Team velocity must be a positive number',
    });
  }

  if (!teamObj.defaultCoefficient) {
    errors.push({
      field: `teams.${teamKey}.defaultCoefficient`,
      message: 'Team defaultCoefficient is required',
    });
  } else {
    validateCoefficient(teamObj.defaultCoefficient, `teams.${teamKey}.defaultCoefficient`, errors);
  }
}

/**
 * Validates a coefficient configuration.
 */
function validateCoefficient(
  coefficient: unknown,
  fieldPath: string,
  errors: TeamEstimateValidationError[]
): void {
  if (!coefficient || typeof coefficient !== 'object' || Array.isArray(coefficient)) {
    errors.push({
      field: fieldPath,
      message: 'Coefficient must be an object',
    });
    return;
  }

  const coeffObj = coefficient as Record<string, unknown>;

  if (!coeffObj.method || (coeffObj.method !== 'percentage' && coeffObj.method !== 'hoursPerPoint')) {
    errors.push({
      field: `${fieldPath}.method`,
      message: 'Coefficient method must be "percentage" or "hoursPerPoint"',
    });
  }

  if (coeffObj.value === undefined || typeof coeffObj.value !== 'number' || coeffObj.value < 0) {
    errors.push({
      field: `${fieldPath}.value`,
      message: 'Coefficient value must be a non-negative number',
    });
  } else {
    const method = coeffObj.method as CoefficientMethod;
    const value = coeffObj.value as number;
    
    if (method === 'percentage' && value > 1.0) {
      errors.push({
        field: `${fieldPath}.value`,
        message: 'Percentage coefficient value must be between 0.0 and 1.0',
      });
    }
  }
}

/**
 * Validates an estimation rule.
 */
function validateEstimationRule(
  rule: unknown,
  fieldPath: string,
  errors: TeamEstimateValidationError[],
  expectedMethod: 'coefficients' | 'hybrid' | 'subtasks'
): void {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
    errors.push({
      field: fieldPath,
      message: 'Estimation rule must be an object',
    });
    return;
  }

  const ruleObj = rule as Record<string, unknown>;

  if (!ruleObj.name || typeof ruleObj.name !== 'string') {
    errors.push({
      field: `${fieldPath}.name`,
      message: 'Estimation rule name is required',
    });
  }

  if (ruleObj.calculationMethod !== expectedMethod) {
    errors.push({
      field: `${fieldPath}.calculationMethod`,
      message: `Estimation rule calculationMethod must be "${expectedMethod}"`,
    });
  }

  if (expectedMethod === 'coefficients' && ruleObj.teamCoefficients) {
    const coefficients = ruleObj.teamCoefficients as Record<string, unknown>;
    for (const [teamType, coefficient] of Object.entries(coefficients)) {
      validateCoefficient(coefficient, `${fieldPath}.teamCoefficients.${teamType}`, errors);
    }
  }

  if ((expectedMethod === 'hybrid' || expectedMethod === 'subtasks') && ruleObj.subtaskMatching) {
    const matching = ruleObj.subtaskMatching as Record<string, unknown>;
    for (const [teamType, matchConfig] of Object.entries(matching)) {
      if (expectedMethod === 'hybrid') {
        validateHybridEstimationConfig(matchConfig, `${fieldPath}.subtaskMatching.${teamType}`, errors);
      } else {
        validateSubtaskMatchCriteria(matchConfig, `${fieldPath}.subtaskMatching.${teamType}`, errors);
      }
    }
  }
}

/**
 * Validates hybrid estimation config.
 */
function validateHybridEstimationConfig(
  config: unknown,
  fieldPath: string,
  errors: TeamEstimateValidationError[]
): void {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    errors.push({
      field: fieldPath,
      message: 'Hybrid estimation config must be an object',
    });
    return;
  }

  const configObj = config as Record<string, unknown>;

  if (!configObj.matchCriteria) {
    errors.push({
      field: `${fieldPath}.matchCriteria`,
      message: 'matchCriteria is required',
    });
  } else {
    validateSubtaskMatchCriteria(configObj.matchCriteria, `${fieldPath}.matchCriteria`, errors);
  }

  if (configObj.fallbackToCoefficient !== undefined && typeof configObj.fallbackToCoefficient !== 'boolean') {
    errors.push({
      field: `${fieldPath}.fallbackToCoefficient`,
      message: 'fallbackToCoefficient must be a boolean',
    });
  }

  if (configObj.fallbackCoefficient) {
    validateCoefficient(configObj.fallbackCoefficient, `${fieldPath}.fallbackCoefficient`, errors);
  }
}

/**
 * Validates subtask match criteria.
 */
function validateSubtaskMatchCriteria(
  criteria: unknown,
  fieldPath: string,
  errors: TeamEstimateValidationError[]
): void {
  if (!criteria || typeof criteria !== 'object' || Array.isArray(criteria)) {
    errors.push({
      field: fieldPath,
      message: 'Subtask match criteria must be an object',
    });
    return;
  }

  const criteriaObj = criteria as Record<string, unknown>;

  if (criteriaObj.components !== undefined) {
    if (!Array.isArray(criteriaObj.components)) {
      errors.push({
        field: `${fieldPath}.components`,
        message: 'components must be an array',
      });
    }
  }

  if (criteriaObj.labels !== undefined) {
    if (!Array.isArray(criteriaObj.labels)) {
      errors.push({
        field: `${fieldPath}.labels`,
        message: 'labels must be an array',
      });
    }
  }

  if (criteriaObj.summaryTags !== undefined) {
    if (!Array.isArray(criteriaObj.summaryTags)) {
      errors.push({
        field: `${fieldPath}.summaryTags`,
        message: 'summaryTags must be an array',
      });
    }
  }

  if (criteriaObj.issueTypes !== undefined) {
    if (!Array.isArray(criteriaObj.issueTypes)) {
      errors.push({
        field: `${fieldPath}.issueTypes`,
        message: 'issueTypes must be an array',
      });
    }
  }
}

/**
 * Validates task sequencing configuration.
 */
function validateTaskSequencing(
  sequencing: Record<string, unknown>,
  errors: TeamEstimateValidationError[]
): void {
  if (!sequencing.defaultMode || 
      (sequencing.defaultMode !== 'sequential' && 
       sequencing.defaultMode !== 'parallel' && 
       sequencing.defaultMode !== 'limitedParallel')) {
    errors.push({
      field: 'taskSequencing.defaultMode',
      message: 'defaultMode must be "sequential", "parallel", or "limitedParallel"',
    });
  }

  if (!sequencing.executionModes || typeof sequencing.executionModes !== 'object' || Array.isArray(sequencing.executionModes)) {
    errors.push({
      field: 'taskSequencing.executionModes',
      message: 'executionModes must be an object',
    });
  }

  if (!sequencing.teamSequencing || typeof sequencing.teamSequencing !== 'object' || Array.isArray(sequencing.teamSequencing)) {
    errors.push({
      field: 'taskSequencing.teamSequencing',
      message: 'teamSequencing must be an object',
    });
  }

  if (!sequencing.dependencyRules || typeof sequencing.dependencyRules !== 'object' || Array.isArray(sequencing.dependencyRules)) {
    errors.push({
      field: 'taskSequencing.dependencyRules',
      message: 'dependencyRules must be an object',
    });
  }
}

/**
 * Validates UI settings configuration.
 */
function validateUISettings(
  uiSettings: Record<string, unknown>,
  errors: TeamEstimateValidationError[]
): void {
  if (uiSettings.presetsVisible !== undefined && typeof uiSettings.presetsVisible !== 'boolean') {
    errors.push({
      field: 'uiSettings.presetsVisible',
      message: 'presetsVisible must be a boolean',
    });
  }

  if (uiSettings.allowCustomCoefficients !== undefined && typeof uiSettings.allowCustomCoefficients !== 'boolean') {
    errors.push({
      field: 'uiSettings.allowCustomCoefficients',
      message: 'allowCustomCoefficients must be a boolean',
    });
  }

  if (!uiSettings.validation || typeof uiSettings.validation !== 'object' || Array.isArray(uiSettings.validation)) {
    errors.push({
      field: 'uiSettings.validation',
      message: 'validation must be an object',
    });
  }

  if (!uiSettings.displayOptions || typeof uiSettings.displayOptions !== 'object' || Array.isArray(uiSettings.displayOptions)) {
    errors.push({
      field: 'uiSettings.displayOptions',
      message: 'displayOptions must be an object',
    });
  }
}

/**
 * Formats validation errors into a user-friendly error message.
 * 
 * @param errors - Array of validation errors
 * @returns Formatted error message string
 */
export function formatTeamEstimateValidationErrors(
  errors: TeamEstimateValidationError[]
): string {
  if (errors.length === 0) {
    return '';
  }

  if (errors.length === 1) {
    return `Team estimate configuration validation failed: ${errors[0].field} - ${errors[0].message}`;
  }

  const errorMessages = errors.map(err => `  - ${err.field}: ${err.message}`).join('\n');
  return `Team estimate configuration validation failed with ${errors.length} error(s):\n${errorMessages}`;
}
