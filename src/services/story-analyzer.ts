/**
 * Story analyzer service.
 * 
 * Analyzes stories to determine estimation case and extract subtasks.
 */

import type { JiraTicket } from './jira-extractor';

export type EstimationCase = 'case1' | 'case2' | 'case3';

/**
 * Analyzes a story to determine which estimation case applies.
 * 
 * Case 1: Story has estimate, no subtasks OR subtasks without estimates
 * Case 2: Story has estimate AND subtasks with estimates
 * Case 3: Story has no estimate OR zero estimate, subtasks have estimates
 * 
 * @param story - Story ticket to analyze
 * @param subtasks - Array of subtasks for this story
 * @returns Estimation case identifier
 */
export function determineEstimationCase(
  story: JiraTicket,
  subtasks: JiraTicket[]
): EstimationCase {
  const hasStoryEstimate = hasStoryEstimateValue(story);
  const hasSubtaskEstimates = hasSubtaskEstimatesValue(subtasks);

  // Case 3: No story estimate, but subtasks have estimates
  if (!hasStoryEstimate && hasSubtaskEstimates) {
    return 'case3';
  }

  // Case 2: Story has estimate AND subtasks have estimates
  if (hasStoryEstimate && hasSubtaskEstimates) {
    return 'case2';
  }

  // Case 1: Story has estimate, but no subtasks OR subtasks without estimates
  if (hasStoryEstimate) {
    return 'case1';
  }

  // Default to case1 if no clear case (shouldn't happen in practice)
  return 'case1';
}

/**
 * Extracts subtasks for a story from all tickets.
 * 
 * @param story - Story ticket
 * @param allTickets - All tickets from JIRA/CSV
 * @returns Array of subtasks for this story
 */
export function extractSubtasks(
  story: JiraTicket,
  allTickets: JiraTicket[]
): JiraTicket[] {
  const storyKey = story.key;
  
  return allTickets.filter(ticket => {
    // Check if ticket is a subtask of this story
    return ticket.parentId === storyKey || 
           (ticket.issueType === 'Sub-task' && ticket.parentId === storyKey);
  });
}

/**
 * Checks if a story has an estimate value.
 * 
 * @param story - Story ticket
 * @returns True if story has a valid estimate
 */
export function hasStoryEstimateValue(story: JiraTicket): boolean {
  // Check story points
  if (story.storyPoints !== undefined && story.storyPoints !== null && story.storyPoints > 0) {
    return true;
  }

  // Check original estimate (in hours)
  if (story.originalEstimate !== undefined && story.originalEstimate !== null && story.originalEstimate > 0) {
    return true;
  }

  return false;
}

/**
 * Checks if any subtasks have estimates.
 * 
 * @param subtasks - Array of subtask tickets
 * @returns True if at least one subtask has a valid estimate
 */
export function hasSubtaskEstimatesValue(subtasks: JiraTicket[]): boolean {
  if (!subtasks || subtasks.length === 0) {
    return false;
  }

  return subtasks.some(subtask => {
    // Check story points
    if (subtask.storyPoints !== undefined && subtask.storyPoints !== null && subtask.storyPoints > 0) {
      return true;
    }

    // Check original estimate
    if (subtask.originalEstimate !== undefined && subtask.originalEstimate !== null && subtask.originalEstimate > 0) {
      return true;
    }

    return false;
  });
}

/**
 * Gets the story estimate value in hours.
 * 
 * @param story - Story ticket
 * @param hoursPerStoryPoint - Conversion factor for story points to hours (default: 8)
 * @returns Estimate in hours, or undefined if no estimate
 */
export function getStoryEstimateInHours(
  story: JiraTicket,
  hoursPerStoryPoint: number = 8
): number | undefined {
  // Prefer original estimate (already in hours)
  if (story.originalEstimate !== undefined && story.originalEstimate !== null && story.originalEstimate > 0) {
    return story.originalEstimate;
  }

  // Convert story points to hours
  if (story.storyPoints !== undefined && story.storyPoints !== null && story.storyPoints > 0) {
    return story.storyPoints * hoursPerStoryPoint;
  }

  return undefined;
}

/**
 * Gets the subtask estimate value in hours.
 * 
 * @param subtask - Subtask ticket
 * @param hoursPerStoryPoint - Conversion factor for story points to hours (default: 8)
 * @returns Estimate in hours, or undefined if no estimate
 */
export function getSubtaskEstimateInHours(
  subtask: JiraTicket,
  hoursPerStoryPoint: number = 8
): number | undefined {
  // Prefer original estimate (already in hours)
  if (subtask.originalEstimate !== undefined && subtask.originalEstimate !== null && subtask.originalEstimate > 0) {
    return subtask.originalEstimate;
  }

  // Convert story points to hours
  if (subtask.storyPoints !== undefined && subtask.storyPoints !== null && subtask.storyPoints > 0) {
    return subtask.storyPoints * hoursPerStoryPoint;
  }

  return undefined;
}
