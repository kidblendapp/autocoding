/**
 * Task sequencing service.
 * 
 * Handles task execution order and dependencies based on configuration.
 */

import { logger } from '../utils/logger';
import type { TeamEstimateConfiguration, ExecutionMode, TaskDependency } from '../config/team-estimate-types';
import type { TeamEstimate, SequencedEstimate } from '../models/TeamEstimate';

/**
 * Applies sequencing rules to team estimates.
 * 
 * @param teamEstimates - Array of team estimates
 * @param config - Team estimate configuration
 * @param workType - Optional work type (e.g., "PSME-FE", "PSME-BE") for work type sequences
 * @returns Array of sequenced estimates
 */
export function applySequencingRules(
  teamEstimates: TeamEstimate[],
  config: TeamEstimateConfiguration,
  workType?: string
): SequencedEstimate[] {
  const sequencedEstimates: SequencedEstimate[] = [];

  // Try to get work type sequence first
  let executionOrder: TaskDependency[] | undefined;
  
  if (workType && config.taskSequencing.workTypeSequences[workType]) {
    executionOrder = config.taskSequencing.workTypeSequences[workType].executionOrder;
  }

  // If work type sequence exists, use it
  if (executionOrder && executionOrder.length > 0) {
    return applyWorkTypeSequence(teamEstimates, executionOrder, config);
  }

  // Otherwise, apply team-specific sequencing
  for (const estimate of teamEstimates) {
    const sequenced = applyTeamSequencing(estimate, config);
    sequencedEstimates.push(sequenced);
  }

  // Sort by execution order if available
  sequencedEstimates.sort((a, b) => {
    if (a.executionOrder !== undefined && b.executionOrder !== undefined) {
      return a.executionOrder - b.executionOrder;
    }
    return 0;
  });

  return sequencedEstimates;
}

/**
 * Applies work type execution sequence to estimates.
 * 
 * @param teamEstimates - Array of team estimates
 * @param executionOrder - Execution order dependencies
 * @param config - Team estimate configuration
 * @returns Array of sequenced estimates
 */
function applyWorkTypeSequence(
  teamEstimates: TeamEstimate[],
  executionOrder: TaskDependency[],
  config: TeamEstimateConfiguration
): SequencedEstimate[] {
  const sequencedEstimates: SequencedEstimate[] = [];
  const estimateMap = new Map<string, TeamEstimate>();
  
  // Create a map of team type to estimate
  for (const estimate of teamEstimates) {
    estimateMap.set(estimate.teamType, estimate);
  }

  // Apply execution order
  for (let i = 0; i < executionOrder.length; i++) {
    const dependency = executionOrder[i];
    const estimate = estimateMap.get(dependency.role);
    
    if (!estimate) {
      logger.warn(`No estimate found for role "${dependency.role}" in execution order`);
      continue;
    }

    const teamSequencing = config.taskSequencing.teamSequencing[estimate.teamType];
    const executionMode = teamSequencing?.mode || dependency.canRunInParallel ? 'parallel' : 'sequential';

    sequencedEstimates.push({
      ...estimate,
      executionMode,
      dependencies: dependency.dependencies || [],
      canRunInParallel: dependency.canRunInParallel,
      executionOrder: i,
      maxParallelTasks: teamSequencing?.maxParallelTasks,
    });
  }

  return sequencedEstimates;
}

/**
 * Applies team-specific sequencing to an estimate.
 * 
 * @param estimate - Team estimate
 * @param config - Team estimate configuration
 * @returns Sequenced estimate
 */
function applyTeamSequencing(
  estimate: TeamEstimate,
  config: TeamEstimateConfiguration
): SequencedEstimate {
  const teamSequencing = config.taskSequencing.teamSequencing[estimate.teamType];
  const executionMode = determineExecutionMode(estimate.teamType, config);
  
  const sequenced: SequencedEstimate = {
    ...estimate,
    executionMode,
    dependencies: [],
    canRunInParallel: executionMode === 'parallel' || executionMode === 'limitedParallel',
  };

  if (teamSequencing?.maxParallelTasks !== undefined) {
    sequenced.maxParallelTasks = teamSequencing.maxParallelTasks;
  }

  return sequenced;
}

/**
 * Determines execution mode for a team.
 * 
 * @param teamType - Team type
 * @param config - Team estimate configuration
 * @returns Execution mode
 */
export function determineExecutionMode(
  teamType: string,
  config: TeamEstimateConfiguration
): ExecutionMode {
  const teamSequencing = config.taskSequencing.teamSequencing[teamType];
  
  if (teamSequencing) {
    return teamSequencing.mode;
  }

  return config.taskSequencing.defaultMode;
}

/**
 * Builds a dependency graph from sequenced estimates.
 * 
 * @param sequencedEstimates - Array of sequenced estimates
 * @returns Dependency graph structure
 */
export function buildDependencyGraph(
  sequencedEstimates: SequencedEstimate[]
): Map<string, string[]> {
  const graph = new Map<string, string[]>();

  for (const estimate of sequencedEstimates) {
    const dependencies: string[] = [];
    
    for (const dep of estimate.dependencies) {
      // Find estimate with matching team type or role
      const depEstimate = sequencedEstimates.find(e => 
        e.teamType === dep || e.teamId === dep
      );
      
      if (depEstimate) {
        dependencies.push(depEstimate.teamId);
      }
    }

    graph.set(estimate.teamId, dependencies);
  }

  return graph;
}

/**
 * Validates that sequencing rules are consistent.
 * 
 * @param sequencedEstimates - Array of sequenced estimates
 * @returns True if valid, false otherwise
 */
export function validateSequencing(
  sequencedEstimates: SequencedEstimate[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for circular dependencies
  const graph = buildDependencyGraph(sequencedEstimates);
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(node: string): boolean {
    if (recursionStack.has(node)) {
      return true;
    }
    
    if (visited.has(node)) {
      return false;
    }

    visited.add(node);
    recursionStack.add(node);

    const dependencies = graph.get(node) || [];
    for (const dep of dependencies) {
      if (hasCycle(dep)) {
        return true;
      }
    }

    recursionStack.delete(node);
    return false;
  }

  for (const estimate of sequencedEstimates) {
    if (hasCycle(estimate.teamId)) {
      errors.push(`Circular dependency detected involving team ${estimate.teamId}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
