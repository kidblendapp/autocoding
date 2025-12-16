/**
 * Task interface representing a work item in the Gantt Schedule Calculation System.
 * 
 * Core fields are required, while optional fields provide additional metadata
 * for scheduling and team assignment.
 * 
 * @interface Task
 */
export interface Task {
  /** Unique identifier for the task (e.g., "PROJ-101") */
  id: string;
  
  /** Human-readable title/description of the task */
  title: string;
  
  /** Estimated effort in hours (converted from Story Points or Days/Hours) */
  estimate: number;
  
  /** Optional component name for team assignment (e.g., "UI", "Backend") */
  component?: string;
  
  /** Optional parent task ID for hierarchical relationships */
  parentId?: string;
  
  /** Optional issue type (e.g., "Story", "Bug", "Task", "Sub-task") */
  issueType?: string;
}
