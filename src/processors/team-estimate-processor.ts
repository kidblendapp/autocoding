/**
 * Team estimate processor.
 * 
 * Main processor integrating all components for end-to-end estimate generation.
 */

import { logger } from '../utils/logger';
import type { JiraTicket } from '../services/jira-extractor';
import type { TeamEstimateConfiguration } from '../config/team-estimate-types';
import type { TeamEstimate, StoryEstimateResult, EpicEstimateResult } from '../models/TeamEstimate';
import { determineEstimationCase, extractSubtasks, getStoryEstimateInHours } from '../services/story-analyzer';
import { calculateCase1, calculateCase2, calculateCase3 } from '../calculators/team-estimate-calculator';
import { applySequencingRules } from '../services/task-sequencer';

/**
 * Processes team estimates for a single story.
 * 
 * @param story - Story ticket
 * @param allTickets - All tickets from JIRA/CSV
 * @param config - Team estimate configuration
 * @param hoursPerStoryPoint - Conversion factor for story points to hours (default: 8)
 * @returns Story estimate result
 */
export function processStoryEstimates(
  story: JiraTicket,
  allTickets: JiraTicket[],
  config: TeamEstimateConfiguration,
  hoursPerStoryPoint: number = 8
): StoryEstimateResult {
  // Extract subtasks
  const subtasks = extractSubtasks(story, allTickets);
  
  // Determine estimation case
  const caseType = determineEstimationCase(story, subtasks);
  
  logger.info(`Processing story ${story.key}: Case ${caseType}, ${subtasks.length} subtasks`);

  // Calculate team estimates based on case
  let teamEstimates: TeamEstimate[] = [];

  switch (caseType) {
    case 'case1':
      teamEstimates = calculateCase1(story, config, hoursPerStoryPoint);
      break;
    case 'case2':
      teamEstimates = calculateCase2(story, subtasks, config, hoursPerStoryPoint);
      break;
    case 'case3':
      teamEstimates = calculateCase3(story, subtasks, config, hoursPerStoryPoint);
      break;
  }

  // Apply sequencing rules
  const sequencedEstimates = applySequencingRules(teamEstimates, config);

  // Get story estimate info
  const storyEstimateHours = getStoryEstimateInHours(story, hoursPerStoryPoint);
  const storyEstimate = storyEstimateHours ? {
    storyPoints: story.storyPoints,
    hours: storyEstimateHours,
  } : undefined;

  // Count subtasks with estimates
  const subtasksWithEstimatesCount = subtasks.filter(subtask => {
    return (subtask.storyPoints !== undefined && subtask.storyPoints !== null && subtask.storyPoints > 0) ||
           (subtask.originalEstimate !== undefined && subtask.originalEstimate !== null && subtask.originalEstimate > 0);
  }).length;

  return {
    storyKey: story.key,
    case: caseType,
    teamEstimates,
    sequencedEstimates,
    storyEstimate,
    subtasksCount: subtasks.length,
    subtasksWithEstimatesCount,
  };
}

/**
 * Processes team estimates for an epic (multiple stories).
 * 
 * @param epicKey - Epic key
 * @param stories - Array of story tickets belonging to the epic
 * @param allTickets - All tickets from JIRA/CSV
 * @param config - Team estimate configuration
 * @param hoursPerStoryPoint - Conversion factor for story points to hours (default: 8)
 * @returns Epic estimate result
 */
export function processEpicEstimates(
  epicKey: string,
  stories: JiraTicket[],
  allTickets: JiraTicket[],
  config: TeamEstimateConfiguration,
  hoursPerStoryPoint: number = 8
): EpicEstimateResult {
  logger.info(`Processing epic ${epicKey}: ${stories.length} stories`);

  const storyResults: StoryEstimateResult[] = [];
  const teamEstimateMap = new Map<string, TeamEstimate>();

  // Process each story
  for (const story of stories) {
    const storyResult = processStoryEstimates(story, allTickets, config, hoursPerStoryPoint);
    storyResults.push(storyResult);

    // Aggregate team estimates
    for (const estimate of storyResult.teamEstimates) {
      const existing = teamEstimateMap.get(estimate.teamId);
      
      if (existing) {
        // Sum estimates for the same team
        existing.estimate += estimate.estimate;
      } else {
        // Create new aggregated estimate
        teamEstimateMap.set(estimate.teamId, {
          ...estimate,
          storyKey: epicKey, // Use epic key for aggregated estimate
          calculationDetails: `Aggregated from ${storyResults.length} stories`,
        });
      }
    }
  }

  const aggregatedTeamEstimates = Array.from(teamEstimateMap.values());

  return {
    epicKey,
    storyResults,
    aggregatedTeamEstimates,
    totalStories: stories.length,
  };
}

/**
 * Processes team estimates for all stories in a collection.
 * 
 * @param stories - Array of story tickets
 * @param allTickets - All tickets from JIRA/CSV
 * @param config - Team estimate configuration
 * @param hoursPerStoryPoint - Conversion factor for story points to hours (default: 8)
 * @returns Array of story estimate results
 */
export function processAllStoryEstimates(
  stories: JiraTicket[],
  allTickets: JiraTicket[],
  config: TeamEstimateConfiguration,
  hoursPerStoryPoint: number = 8
): StoryEstimateResult[] {
  const results: StoryEstimateResult[] = [];

  for (const story of stories) {
    try {
      const result = processStoryEstimates(story, allTickets, config, hoursPerStoryPoint);
      results.push(result);
    } catch (error) {
      logger.error(`Failed to process story ${story.key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return results;
}

/**
 * Groups stories by epic.
 * 
 * @param stories - Array of story tickets
 * @returns Map of epic key to story array
 */
export function groupStoriesByEpic(stories: JiraTicket[]): Map<string, JiraTicket[]> {
  const epicMap = new Map<string, JiraTicket[]>();

  for (const story of stories) {
    const epicKey = story.epicLink || 'UNASSIGNED';
    
    if (!epicMap.has(epicKey)) {
      epicMap.set(epicKey, []);
    }
    
    epicMap.get(epicKey)!.push(story);
  }

  return epicMap;
}

/**
 * Processes team estimates grouped by epic.
 * 
 * @param stories - Array of story tickets
 * @param allTickets - All tickets from JIRA/CSV
 * @param config - Team estimate configuration
 * @param hoursPerStoryPoint - Conversion factor for story points to hours (default: 8)
 * @returns Array of epic estimate results
 */
export function processEstimatesByEpic(
  stories: JiraTicket[],
  allTickets: JiraTicket[],
  config: TeamEstimateConfiguration,
  hoursPerStoryPoint: number = 8
): EpicEstimateResult[] {
  const epicMap = groupStoriesByEpic(stories);
  const results: EpicEstimateResult[] = [];

  for (const [epicKey, epicStories] of epicMap.entries()) {
    if (epicKey === 'UNASSIGNED') {
      // Process unassigned stories individually
      for (const story of epicStories) {
        const storyResult = processStoryEstimates(story, allTickets, config, hoursPerStoryPoint);
        // Convert to epic result format
        results.push({
          epicKey: story.key,
          storyResults: [storyResult],
          aggregatedTeamEstimates: storyResult.teamEstimates,
          totalStories: 1,
        });
      }
    } else {
      try {
        const epicResult = processEpicEstimates(epicKey, epicStories, allTickets, config, hoursPerStoryPoint);
        results.push(epicResult);
      } catch (error) {
        logger.error(`Failed to process epic ${epicKey}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  return results;
}
