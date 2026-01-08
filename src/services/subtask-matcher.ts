/**
 * Subtask matching engine.
 * 
 * Matches subtasks to teams using configurable criteria (component, label, summary tag, issue type).
 */

import type { JiraTicket } from './jira-extractor';
import type { SubtaskMatchCriteria } from '../config/team-estimate-types';

/**
 * Matches a subtask against criteria using OR logic (matches if ANY criteria matches).
 * 
 * @param subtask - Subtask ticket to match
 * @param criteria - Matching criteria
 * @returns True if subtask matches any criteria
 */
export function matchSubtask(
  subtask: JiraTicket,
  criteria: SubtaskMatchCriteria
): boolean {
  // If no criteria specified, don't match
  if (!criteria || Object.keys(criteria).length === 0) {
    return false;
  }

  // Component matching
  if (criteria.components && criteria.components.length > 0) {
    if (matchByComponent(subtask, criteria.components)) {
      return true;
    }
  }

  // Label matching
  if (criteria.labels && criteria.labels.length > 0) {
    if (matchByLabel(subtask, criteria.labels)) {
      return true;
    }
  }

  // Summary tag matching
  if (criteria.summaryTags && criteria.summaryTags.length > 0) {
    if (matchBySummaryTag(subtask, criteria.summaryTags)) {
      return true;
    }
  }

  // Issue type matching
  if (criteria.issueTypes && criteria.issueTypes.length > 0) {
    if (matchByIssueType(subtask, criteria.issueTypes)) {
      return true;
    }
  }

  return false;
}

/**
 * Matches subtask by component name.
 * 
 * @param subtask - Subtask ticket
 * @param components - Array of component names to match
 * @returns True if subtask component matches any in the list
 */
export function matchByComponent(
  subtask: JiraTicket,
  components: string[]
): boolean {
  if (!subtask.component || !components || components.length === 0) {
    return false;
  }

  // Component can be comma-separated, so split and check each
  const subtaskComponents = subtask.component.split(',').map(c => c.trim());
  
  return components.some(criteriaComponent => {
    return subtaskComponents.some(subtaskComponent => 
      subtaskComponent.toLowerCase() === criteriaComponent.toLowerCase()
    );
  });
}

/**
 * Matches subtask by label.
 * 
 * @param subtask - Subtask ticket
 * @param labels - Array of labels to match
 * @returns True if subtask has any matching label
 */
export function matchByLabel(
  subtask: JiraTicket,
  labels: string[]
): boolean {
  if (!subtask.labels || !labels || labels.length === 0) {
    return false;
  }

  // Labels are comma-separated, so split and check each
  const subtaskLabels = subtask.labels.split(',').map(l => l.trim());
  
  return labels.some(criteriaLabel => {
    return subtaskLabels.some(subtaskLabel => 
      subtaskLabel.toLowerCase() === criteriaLabel.toLowerCase()
    );
  });
}

/**
 * Matches subtask by summary tag (e.g., [BA], [FE]).
 * 
 * Supports both exact tag matching and regex patterns.
 * 
 * @param subtask - Subtask ticket
 * @param tags - Array of tags or patterns to match
 * @returns True if subtask summary contains any matching tag
 */
export function matchBySummaryTag(
  subtask: JiraTicket,
  tags: string[]
): boolean {
  if (!subtask.summary || !tags || tags.length === 0) {
    return false;
  }

  const summary = subtask.summary;

  return tags.some(tag => {
    // Try exact tag match first (e.g., "[BA]")
    if (summary.includes(tag)) {
      return true;
    }

    // Try regex pattern if tag contains regex characters
    try {
      const regex = new RegExp(tag, 'i');
      if (regex.test(summary)) {
        return true;
      }
    } catch (e) {
      // Invalid regex, skip
    }

    return false;
  });
}

/**
 * Matches subtask by issue type.
 * 
 * @param subtask - Subtask ticket
 * @param issueTypes - Array of issue types to match
 * @returns True if subtask issue type matches any in the list
 */
export function matchByIssueType(
  subtask: JiraTicket,
  issueTypes: string[]
): boolean {
  if (!subtask.issueType || !issueTypes || issueTypes.length === 0) {
    return false;
  }

  return issueTypes.some(type => 
    subtask.issueType?.toLowerCase() === type.toLowerCase()
  );
}

/**
 * Filters subtasks that match the given criteria.
 * 
 * @param subtasks - Array of subtask tickets
 * @param criteria - Matching criteria
 * @returns Array of matching subtasks
 */
export function filterMatchingSubtasks(
  subtasks: JiraTicket[],
  criteria: SubtaskMatchCriteria
): JiraTicket[] {
  return subtasks.filter(subtask => matchSubtask(subtask, criteria));
}
