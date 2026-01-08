/**
 * Type definitions for team estimate generation configuration.
 * 
 * Supports three estimation cases:
 * 1. Story-level estimate only (derive using coefficients)
 * 2. Hybrid (story + subtasks)
 * 3. Subtasks only
 */

/**
 * Method for calculating team estimates from story estimates.
 */
export type CoefficientMethod = 'percentage' | 'hoursPerPoint';

/**
 * Coefficient configuration for deriving team estimates.
 */
export interface TeamCoefficient {
  /** Method used to calculate the estimate */
  method: CoefficientMethod;
  
  /** 
   * Value for the coefficient:
   * - For 'percentage': value between 0.0 and 1.0
   * - For 'hoursPerPoint': hours per story point (e.g., 2.0 means 2 hours per SP)
   */
  value: number;
  
  /** Optional description for UI display */
  description?: string;
  
  /** Whether this overrides the team's default coefficient */
  overrideDefault?: boolean;
}

/**
 * Criteria for matching subtasks to teams.
 */
export interface SubtaskMatchCriteria {
  /** Component names to match */
  components?: string[];
  
  /** Labels to match */
  labels?: string[];
  
  /** Summary tags/patterns to match (e.g., "[BA]", "[FE]") */
  summaryTags?: string[];
  
  /** Issue types to match */
  issueTypes?: string[];
}

/**
 * Configuration for hybrid estimation (Case 2).
 */
export interface HybridEstimationConfig {
  /** Criteria for matching subtasks to this team */
  matchCriteria: SubtaskMatchCriteria;
  
  /** Whether to fall back to coefficient if no subtasks match */
  fallbackToCoefficient: boolean;
  
  /** Coefficient to use as fallback */
  fallbackCoefficient?: TeamCoefficient;
}

/**
 * Configuration for story estimate usage in hybrid mode.
 */
export interface StoryEstimateUsage {
  /** Apply story estimate to teams without matching subtasks */
  applyToTeamsWithoutSubtasks: boolean;
  
  /** Use story estimate as validation for subtask sum */
  applyAsValidation: boolean;
  
  /** Tolerance for validation (e.g., 0.20 = 20% difference allowed) */
  validationTolerance?: number;
}

/**
 * Configuration for handling missing estimates in subtasks.
 */
export interface MissingEstimateHandling {
  /** Default value to use when estimate is missing */
  defaultValue: number;
  
  /** Whether to warn when estimate is missing */
  warnOnMissing: boolean;
  
  /** Whether to skip subtask entirely if estimate is missing */
  skipSubtask: boolean;
}

/**
 * Estimation rule configuration.
 */
export interface EstimationRule {
  /** Rule name */
  name: string;
  
  /** Rule description */
  description: string;
  
  /** Whether this rule is enabled */
  enabled: boolean;
  
  /** Calculation method for this rule */
  calculationMethod: 'coefficients' | 'hybrid' | 'subtasks';
  
  /** Team coefficients (for Case 1) */
  teamCoefficients?: Record<string, TeamCoefficient>;
  
  /** Subtask matching configuration (for Case 2 and Case 3) */
  subtaskMatching?: Record<string, HybridEstimationConfig | SubtaskMatchCriteria>;
  
  /** Story estimate usage (for Case 2) */
  storyEstimateUsage?: StoryEstimateUsage;
  
  /** Missing estimate handling (for Case 3) */
  missingEstimateHandling?: MissingEstimateHandling;
}

/**
 * Team configuration with estimate generation support.
 */
export interface TeamEstimateConfig {
  /** Team ID */
  id: string;
  
  /** Team name */
  name: string;
  
  /** Team type (BA, Dev, QA, etc.) */
  type: string;
  
  /** Team velocity */
  velocity: number;
  
  /** Velocity period (sprint, week, etc.) */
  velocityPeriod: string;
  
  /** Whether to include in schedule */
  includeInSchedule: boolean;
  
  /** Default coefficient for this team */
  defaultCoefficient: TeamCoefficient;
}

/**
 * Execution mode for task sequencing.
 */
export type ExecutionMode = 'sequential' | 'parallel' | 'limitedParallel';

/**
 * Execution mode configuration.
 */
export interface ExecutionModeConfig {
  /** Mode name */
  name: string;
  
  /** Mode description */
  description: string;
  
  /** Parallelism level: number or "unlimited" */
  parallelism: number | 'unlimited';
}

/**
 * Task dependency configuration.
 */
export interface TaskDependency {
  /** Role or task ID this depends on */
  role: string;
  
  /** Team ID */
  teamId: string;
  
  /** List of dependencies (role names or task IDs) */
  dependencies: string[];
  
  /** Whether this task can run in parallel with others */
  canRunInParallel: boolean;
}

/**
 * Team sequencing configuration.
 */
export interface TeamSequencingConfig {
  /** Execution mode for this team */
  mode: ExecutionMode;
  
  /** Description */
  description?: string;
  
  /** Maximum parallel tasks (for limitedParallel mode) */
  maxParallelTasks?: number;
}

/**
 * Dependency rule configuration.
 */
export interface DependencyRule {
  /** Rule name */
  name: string;
  
  /** Rule description */
  description: string;
  
  /** Whether this rule is enabled */
  enabled: boolean;
  
  /** Completion threshold for soft dependencies (0.0-1.0) */
  completionThreshold?: number;
}

/**
 * Preset configuration.
 */
export interface EstimatePreset {
  /** Preset name */
  name: string;
  
  /** Preset description */
  description: string;
  
  /** Team coefficients for this preset */
  teamCoefficients: Record<string, TeamCoefficient>;
}

/**
 * UI validation settings.
 */
export interface UIValidationSettings {
  /** Validate that coefficient sum is reasonable */
  validateCoefficientSum: boolean;
  
  /** Tolerance for coefficient sum validation */
  coefficientSumTolerance: number;
  
  /** Warn on over-estimation */
  warnOnOverEstimation: boolean;
  
  /** Threshold for over-estimation warning */
  overEstimationThreshold: number;
}

/**
 * UI display options.
 */
export interface UIDisplayOptions {
  /** Show estimate breakdown */
  showEstimateBreakdown: boolean;
  
  /** Show calculation method */
  showCalculationMethod: boolean;
  
  /** Show sequencing diagram */
  showSequencingDiagram: boolean;
  
  /** Show team timeline */
  showTeamTimeline: boolean;
}

/**
 * UI settings configuration.
 */
export interface UISettings {
  /** Whether presets are visible in UI */
  presetsVisible: boolean;
  
  /** Allow custom coefficients */
  allowCustomCoefficients: boolean;
  
  /** Allow custom sequencing */
  allowCustomSequencing: boolean;
  
  /** Validation settings */
  validation: UIValidationSettings;
  
  /** Display options */
  displayOptions: UIDisplayOptions;
}

/**
 * Complete team estimate configuration.
 */
export interface TeamEstimateConfiguration {
  /** Schema version */
  $schema?: string;
  
  /** Configuration version */
  version: string;
  
  /** Configuration description */
  description?: string;
  
  /** Predefined presets */
  presets: Record<string, EstimatePreset>;
  
  /** Default preset to use */
  defaultPreset: string;
  
  /** Team definitions */
  teams: Record<string, TeamEstimateConfig>;
  
  /** Estimation rules for each case */
  estimationRules: {
    case1_storyOnly: EstimationRule;
    case2_hybrid: EstimationRule;
    case3_subtasksOnly: EstimationRule;
  };
  
  /** Task sequencing configuration */
  taskSequencing: {
    /** Default execution mode */
    defaultMode: ExecutionMode;
    
    /** Execution mode definitions */
    executionModes: Record<ExecutionMode, ExecutionModeConfig>;
    
    /** Team-specific sequencing */
    teamSequencing: Record<string, TeamSequencingConfig>;
    
    /** Work type execution sequences */
    workTypeSequences: Record<string, {
      executionOrder: TaskDependency[];
    }>;
    
    /** Dependency rules */
    dependencyRules: {
      strict: DependencyRule;
      soft: DependencyRule;
    };
  };
  
  /** UI settings */
  uiSettings: UISettings;
}
