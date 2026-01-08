/**
 * Utility to convert CSV Task objects to JiraTicket format for team estimate processing.
 */

import type { Task } from '../models/Task';
import type { JiraTicket } from '../services/jira-extractor';

/**
 * Converts a Task from CSV to JiraTicket format.
 * 
 * @param task - Task from CSV parser
 * @returns JiraTicket object
 */
export function convertTaskToJiraTicket(task: Task): JiraTicket {
  // Extract story points and original estimate from task.estimate
  // If estimate is a whole number <= 13, assume it's story points
  // Otherwise, assume it's hours
  let storyPoints: number | undefined;
  let originalEstimate: number | undefined;

  if (Number.isInteger(task.estimate) && task.estimate <= 13) {
    // Likely story points
    storyPoints = task.estimate;
  } else {
    // Likely hours
    originalEstimate = task.estimate;
  }

  const ticket: JiraTicket = {
    key: task.id,
    summary: task.title,
    issueType: task.issueType,
    status: task.status,
    assignee: task.assignee,
    component: task.component,
    parentId: task.parentId,
    epicLink: task.epicLink,
    storyPoints,
    originalEstimate,
  };

  return ticket;
}

/**
 * Converts an array of Tasks to JiraTicket format.
 * 
 * @param tasks - Array of tasks from CSV parser
 * @returns Array of JiraTicket objects
 */
export function convertTasksToJiraTickets(tasks: Task[]): JiraTicket[] {
  return tasks.map(convertTaskToJiraTicket);
}
