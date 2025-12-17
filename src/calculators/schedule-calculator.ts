/**
 * Schedule calculator for basic linear schedule calculation.
 * 
 * Processes tasks sequentially and calculates start and end dates based on
 * estimates, velocity, and sprint duration.
 */

import type { Task } from '../models/Task';
import type { ScheduledTask } from '../models/ScheduledTask';
import type { ScheduleConfig } from '../config/types';
import { logger } from '../utils/logger';

/**
 * Calculates the duration in days for a task based on estimate, velocity, and sprint duration.
 * 
 * Formula: Duration = (Estimate / Velocity) * SprintDuration
 * 
 * @param estimate - Task estimate (story points or hours)
 * @param velocity - Team velocity (story points per sprint)
 * @param sprintDurationDays - Sprint duration in days
 * @returns Duration in days (can be fractional)
 * @throws Error if velocity is zero or negative
 */
export function calculateDuration(
  estimate: number,
  velocity: number,
  sprintDurationDays: number
): number {
  if (velocity <= 0) {
    throw new Error(`Velocity must be greater than zero. Received: ${velocity}`);
  }

  if (sprintDurationDays <= 0) {
    throw new Error(`Sprint duration must be greater than zero. Received: ${sprintDurationDays}`);
  }

  if (estimate < 0) {
    throw new Error(`Estimate must be non-negative. Received: ${estimate}`);
  }

  return (estimate / velocity) * sprintDurationDays;
}

/**
 * Adds a specified number of days to a date.
 * 
 * All days are treated as working days (no weekend/holiday skipping).
 * 
 * @param startDate - Start date in ISO format (YYYY-MM-DD)
 * @param days - Number of days to add (can be fractional)
 * @returns End date in ISO format (YYYY-MM-DD)
 * @throws Error if startDate is invalid
 */
export function addDays(startDate: string, days: number): string {
  const date = new Date(startDate);
  
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${startDate}. Expected ISO format (YYYY-MM-DD)`);
  }

  // Add days (including fractional days)
  date.setDate(date.getDate() + Math.round(days));
  
  // Format as YYYY-MM-DD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Calculates the schedule for a list of tasks sequentially.
 * 
 * Tasks are processed in order:
 * - First task uses project start date
 * - Subsequent tasks use the previous task's end date as their start date
 * - Duration is calculated using: (Estimate / Velocity) * SprintDuration
 * - End date is calculated as: Start Date + Duration
 * 
 * @param tasks - Array of tasks to schedule (in CSV order)
 * @param config - Schedule configuration (project start date, sprint duration, velocity)
 * @returns Array of scheduled tasks with calculated start and end dates
 * @throws Error if configuration is invalid or tasks cannot be scheduled
 */
export function calculateSchedule(
  tasks: Task[],
  config: ScheduleConfig
): ScheduledTask[] {
  if (tasks.length === 0) {
    logger.warn('No tasks to schedule');
    return [];
  }

  // Validate configuration
  if (config.velocity <= 0) {
    throw new Error(`Invalid velocity: ${config.velocity}. Velocity must be greater than zero.`);
  }

  if (config.sprintDurationDays <= 0) {
    throw new Error(`Invalid sprint duration: ${config.sprintDurationDays}. Sprint duration must be greater than zero.`);
  }

  // Validate project start date
  const projectStartDate = new Date(config.projectStartDate);
  if (isNaN(projectStartDate.getTime())) {
    throw new Error(`Invalid project start date: ${config.projectStartDate}. Expected ISO format (YYYY-MM-DD).`);
  }

  const scheduledTasks: ScheduledTask[] = [];
  let currentDate = config.projectStartDate;

  // Process tasks sequentially
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];

    // Validate task estimate
    if (task.estimate < 0) {
      logger.warn(`Task ${task.id} has negative estimate (${task.estimate}), using 0`, i + 1);
    }

    // Calculate duration
    const duration = calculateDuration(
      Math.max(0, task.estimate),
      config.velocity,
      config.sprintDurationDays
    );

    // Determine start date
    const startDate = i === 0 ? config.projectStartDate : currentDate;

    // Calculate end date
    const endDate = addDays(startDate, duration);

    // Create scheduled task
    const scheduledTask: ScheduledTask = {
      ...task,
      calculatedStartDate: startDate,
      calculatedEndDate: endDate,
    };

    scheduledTasks.push(scheduledTask);

    // Update current date for next task
    currentDate = endDate;
  }

  logger.info(`Schedule calculation complete: ${scheduledTasks.length} tasks scheduled`);
  
  return scheduledTasks;
}
