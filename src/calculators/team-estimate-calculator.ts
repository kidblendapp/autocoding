/**
 * Team estimate calculator.
 * 
 * Core calculation engine for all three estimation cases:
 * - Case 1: Story-level estimate only (apply coefficients)
 * - Case 2: Hybrid (story + subtasks)
 * - Case 3: Subtasks only (aggregate subtask estimates)
 */

import { logger } from '../utils/logger';
import type { JiraTicket } from '../services/jira-extractor';
import type { TeamEstimateConfiguration, TeamCoefficient, HybridEstimationConfig, EstimationRule } from '../config/team-estimate-types';
import type { TeamEstimate } from '../models/TeamEstimate';
import { getStoryEstimateInHours, getSubtaskEstimateInHours } from '../services/story-analyzer';
import { matchSubtask, filterMatchingSubtasks } from '../services/subtask-matcher';

/**
 * Calculates team estimates for Case 1 (story-level estimate only).
 * 
 * Applies team-specific coefficients to the story estimate.
 * 
 * @param story - Story ticket
 * @param config - Team estimate configuration
 * @param hoursPerStoryPoint - Conversion factor for story points to hours (default: 8)
 * @returns Array of team estimates
 */
export function calculateCase1(
  story: JiraTicket,
  config: TeamEstimateConfiguration,
  hoursPerStoryPoint: number = 8
): TeamEstimate[] {
  const rule = config.estimationRules.case1_storyOnly;
  
  if (!rule.enabled) {
    logger.warn(`Case 1 estimation rule is disabled for story ${story.key}`);
    return [];
  }

  if (!rule.teamCoefficients || Object.keys(rule.teamCoefficients).length === 0) {
    logger.warn(`No team coefficients defined for Case 1 for story ${story.key}`);
    return [];
  }

  const storyEstimateHours = getStoryEstimateInHours(story, hoursPerStoryPoint);
  
  if (!storyEstimateHours || storyEstimateHours <= 0) {
    logger.warn(`Story ${story.key} has no valid estimate for Case 1 calculation`);
    return [];
  }

  const teamEstimates: TeamEstimate[] = [];

  for (const [teamType, coefficient] of Object.entries(rule.teamCoefficients)) {
    // Find team by type
    const team = findTeamByType(config, teamType);
    
    if (!team) {
      logger.warn(`Team type "${teamType}" not found in configuration for story ${story.key}`);
      continue;
    }

    const teamEstimate = applyCoefficient(storyEstimateHours, coefficient, story.storyPoints);
    
    teamEstimates.push({
      teamId: team.id,
      teamType: team.type,
      teamName: team.name,
      estimate: teamEstimate,
      calculationMethod: 'coefficients',
      source: 'story',
      storyKey: story.key,
      calculationDetails: `Applied ${coefficient.method} coefficient (${coefficient.value}) to story estimate`,
    });
  }

  return teamEstimates;
}

/**
 * Calculates team estimates for Case 2 (hybrid: story + subtasks).
 * 
 * For teams with matching subtasks: use subtask sum
 * For teams without matching subtasks: use story estimate with coefficient
 * 
 * @param story - Story ticket
 * @param subtasks - Array of subtask tickets
 * @param config - Team estimate configuration
 * @param hoursPerStoryPoint - Conversion factor for story points to hours (default: 8)
 * @returns Array of team estimates
 */
export function calculateCase2(
  story: JiraTicket,
  subtasks: JiraTicket[],
  config: TeamEstimateConfiguration,
  hoursPerStoryPoint: number = 8
): TeamEstimate[] {
  const rule = config.estimationRules.case2_hybrid;
  
  if (!rule.enabled) {
    logger.warn(`Case 2 estimation rule is disabled for story ${story.key}`);
    return [];
  }

  if (!rule.subtaskMatching || Object.keys(rule.subtaskMatching).length === 0) {
    logger.warn(`No subtask matching configuration for Case 2 for story ${story.key}`);
    return [];
  }

  const storyEstimateHours = getStoryEstimateInHours(story, hoursPerStoryPoint);
  const storyEstimateUsage = rule.storyEstimateUsage;
  
  const teamEstimates: TeamEstimate[] = [];

  for (const [teamType, matchingConfig] of Object.entries(rule.subtaskMatching)) {
    // Find team by type
    const team = findTeamByType(config, teamType);
    
    if (!team) {
      logger.warn(`Team type "${teamType}" not found in configuration for story ${story.key}`);
      continue;
    }

    // Determine if this is HybridEstimationConfig or SubtaskMatchCriteria
    let matchCriteria;
    let fallbackToCoefficient = false;
    let fallbackCoefficient: TeamCoefficient | undefined;

    if ('matchCriteria' in matchingConfig) {
      // HybridEstimationConfig
      const hybridConfig = matchingConfig as HybridEstimationConfig;
      matchCriteria = hybridConfig.matchCriteria;
      fallbackToCoefficient = hybridConfig.fallbackToCoefficient;
      fallbackCoefficient = hybridConfig.fallbackCoefficient;
    } else {
      // SubtaskMatchCriteria
      matchCriteria = matchingConfig;
      fallbackToCoefficient = true;
      fallbackCoefficient = team.defaultCoefficient;
    }

    // Find matching subtasks
    const matchingSubtasks = filterMatchingSubtasks(subtasks, matchCriteria);
    
    let teamEstimate: number;
    let source: 'story' | 'subtasks' | 'hybrid';
    let calculationDetails: string;
    let matchingSubtasksCount = matchingSubtasks.length;

    if (matchingSubtasks.length > 0) {
      // Calculate from subtasks
      const subtaskSum = matchingSubtasks.reduce((sum, subtask) => {
        const estimate = getSubtaskEstimateInHours(subtask, hoursPerStoryPoint);
        return sum + (estimate || 0);
      }, 0);

      teamEstimate = subtaskSum;
      source = 'subtasks';
      calculationDetails = `Sum of ${matchingSubtasks.length} matching subtask estimates`;
    } else if (fallbackToCoefficient && fallbackCoefficient && storyEstimateHours) {
      // Fall back to coefficient
      teamEstimate = applyCoefficient(storyEstimateHours, fallbackCoefficient, story.storyPoints);
      source = 'story';
      calculationDetails = `No matching subtasks, applied fallback coefficient (${fallbackCoefficient.method}, ${fallbackCoefficient.value})`;
    } else if (storyEstimateUsage?.applyToTeamsWithoutSubtasks && storyEstimateHours) {
      // Apply story estimate to teams without subtasks
      const coefficient = fallbackCoefficient || team.defaultCoefficient;
      teamEstimate = applyCoefficient(storyEstimateHours, coefficient, story.storyPoints);
      source = 'story';
      calculationDetails = `No matching subtasks, applied story estimate with coefficient`;
    } else {
      // No estimate available
      logger.warn(`No estimate available for team ${teamType} in story ${story.key}`);
      continue;
    }

    teamEstimates.push({
      teamId: team.id,
      teamType: team.type,
      teamName: team.name,
      estimate: teamEstimate,
      calculationMethod: 'hybrid',
      source,
      storyKey: story.key,
      matchingSubtasksCount,
      calculationDetails,
    });
  }

  return teamEstimates;
}

/**
 * Calculates team estimates for Case 3 (subtasks only).
 * 
 * Aggregates estimates from matching subtasks per team.
 * 
 * @param story - Story ticket
 * @param subtasks - Array of subtask tickets
 * @param config - Team estimate configuration
 * @param hoursPerStoryPoint - Conversion factor for story points to hours (default: 8)
 * @returns Array of team estimates
 */
export function calculateCase3(
  story: JiraTicket,
  subtasks: JiraTicket[],
  config: TeamEstimateConfiguration,
  hoursPerStoryPoint: number = 8
): TeamEstimate[] {
  const rule = config.estimationRules.case3_subtasksOnly;
  
  if (!rule.enabled) {
    logger.warn(`Case 3 estimation rule is disabled for story ${story.key}`);
    return [];
  }

  if (!rule.subtaskMatching || Object.keys(rule.subtaskMatching).length === 0) {
    logger.warn(`No subtask matching configuration for Case 3 for story ${story.key}`);
    return [];
  }

  const missingEstimateHandling = rule.missingEstimateHandling;
  const defaultValue = missingEstimateHandling?.defaultValue || 0;
  const warnOnMissing = missingEstimateHandling?.warnOnMissing ?? true;
  const skipSubtask = missingEstimateHandling?.skipSubtask ?? false;

  const teamEstimates: TeamEstimate[] = [];

  for (const [teamType, matchingConfig] of Object.entries(rule.subtaskMatching)) {
    // Find team by type
    const team = findTeamByType(config, teamType);
    
    if (!team) {
      logger.warn(`Team type "${teamType}" not found in configuration for story ${story.key}`);
      continue;
    }

    // Extract match criteria (Case 3 uses SubtaskMatchCriteria directly)
    const matchCriteria = matchingConfig as any; // Will be SubtaskMatchCriteria

    // Find matching subtasks
    const matchingSubtasks = filterMatchingSubtasks(subtasks, matchCriteria);
    
    if (matchingSubtasks.length === 0) {
      logger.warn(`No matching subtasks found for team ${teamType} in story ${story.key}`);
      continue;
    }

    // Calculate sum of subtask estimates
    let totalEstimate = 0;
    let validSubtasksCount = 0;
    let missingEstimatesCount = 0;

    for (const subtask of matchingSubtasks) {
      const estimate = getSubtaskEstimateInHours(subtask, hoursPerStoryPoint);
      
      if (estimate !== undefined && estimate > 0) {
        totalEstimate += estimate;
        validSubtasksCount++;
      } else {
        missingEstimatesCount++;
        
        if (warnOnMissing) {
          logger.warn(`Subtask ${subtask.key} has no estimate, using default value ${defaultValue}`);
        }
        
        if (!skipSubtask) {
          totalEstimate += defaultValue;
        }
      }
    }

    if (validSubtasksCount === 0 && skipSubtask) {
      logger.warn(`No valid subtask estimates for team ${teamType} in story ${story.key}`);
      continue;
    }

    teamEstimates.push({
      teamId: team.id,
      teamType: team.type,
      teamName: team.name,
      estimate: totalEstimate,
      calculationMethod: 'subtasks',
      source: 'subtasks',
      storyKey: story.key,
      matchingSubtasksCount: matchingSubtasks.length,
      calculationDetails: `Sum of ${validSubtasksCount} subtask estimates${missingEstimatesCount > 0 ? ` (${missingEstimatesCount} missing)` : ''}`,
    });
  }

  return teamEstimates;
}

/**
 * Applies a coefficient to an estimate value.
 * 
 * @param estimateHours - Estimate in hours
 * @param coefficient - Coefficient configuration
 * @param storyPoints - Optional story points (for hoursPerPoint method)
 * @returns Calculated team estimate in hours
 */
export function applyCoefficient(
  estimateHours: number,
  coefficient: TeamCoefficient,
  storyPoints?: number
): number {
  if (coefficient.method === 'percentage') {
    return estimateHours * coefficient.value;
  } else if (coefficient.method === 'hoursPerPoint') {
    // For hoursPerPoint, we need story points
    if (storyPoints === undefined || storyPoints === null || storyPoints <= 0) {
      logger.warn('hoursPerPoint coefficient requires story points, falling back to percentage calculation');
      return estimateHours * coefficient.value;
    }
    return storyPoints * coefficient.value;
  }
  
  throw new Error(`Unknown coefficient method: ${coefficient.method}`);
}

/**
 * Finds a team by type in the configuration.
 * 
 * @param config - Team estimate configuration
 * @param teamType - Team type to find (e.g., "BA", "Dev", "QA")
 * @returns Team configuration or undefined if not found
 */
function findTeamByType(
  config: TeamEstimateConfiguration,
  teamType: string
): TeamEstimateConfiguration['teams'][string] | undefined {
  for (const team of Object.values(config.teams)) {
    if (team.type === teamType) {
      return team;
    }
  }
  return undefined;
}
