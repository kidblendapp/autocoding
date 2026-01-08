/**
 * Team estimate result model.
 * 
 * Represents the calculated estimate for a specific team for a story.
 */

import type { ExecutionMode } from '../config/team-estimate-types';

/**
 * Team estimate result.
 */
export interface TeamEstimate {
  /** Team ID */
  teamId: string;
  
  /** Team type (BA, Dev, QA, etc.) */
  teamType: string;
  
  /** Team name */
  teamName: string;
  
  /** Estimate in hours */
  estimate: number;
  
  /** Calculation method used */
  calculationMethod: 'coefficients' | 'hybrid' | 'subtasks';
  
  /** Source of the estimate */
  source: 'story' | 'subtasks' | 'hybrid';
  
  /** Story key this estimate is for */
  storyKey: string;
  
  /** Optional: Number of matching subtasks (for hybrid/subtasks cases) */
  matchingSubtasksCount?: number;
  
  /** Optional: Details about how the estimate was calculated */
  calculationDetails?: string;
}

/**
 * Sequenced estimate with execution order information.
 */
export interface SequencedEstimate extends TeamEstimate {
  /** Execution mode for this team */
  executionMode: ExecutionMode;
  
  /** Dependencies (team types or task IDs this depends on) */
  dependencies: string[];
  
  /** Whether this task can run in parallel with others */
  canRunInParallel: boolean;
  
  /** Optional: Maximum parallel tasks (for limitedParallel mode) */
  maxParallelTasks?: number;
  
  /** Optional: Execution order index */
  executionOrder?: number;
}

/**
 * Result of processing estimates for a story.
 */
export interface StoryEstimateResult {
  /** Story key */
  storyKey: string;
  
  /** Estimation case used (1, 2, or 3) */
  case: 'case1' | 'case2' | 'case3';
  
  /** Team estimates */
  teamEstimates: TeamEstimate[];
  
  /** Optional: Sequenced estimates */
  sequencedEstimates?: SequencedEstimate[];
  
  /** Story-level estimate (if available) */
  storyEstimate?: {
    storyPoints?: number;
    hours?: number;
  };
  
  /** Number of subtasks found */
  subtasksCount: number;
  
  /** Number of subtasks with estimates */
  subtasksWithEstimatesCount: number;
}

/**
 * Result of processing estimates for an epic.
 */
export interface EpicEstimateResult {
  /** Epic key */
  epicKey: string;
  
  /** Story estimate results */
  storyResults: StoryEstimateResult[];
  
  /** Aggregated team estimates across all stories */
  aggregatedTeamEstimates: TeamEstimate[];
  
  /** Total story count */
  totalStories: number;
}
