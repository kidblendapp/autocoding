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
import { WorkingDaysCalendar } from './working-days-calculator';

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
 * @deprecated Use WorkingDaysCalendar.addWorkingDays() instead for working days calculation.
 * This function is kept for backward compatibility but should not be used in new code.
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
 * - First task uses project start date (adjusted to next working day if needed)
 * - Subsequent tasks use the previous task's end date as their start date
 * - Duration is calculated using: (Estimate / Velocity) * SprintDuration
 * - End date is calculated using working days (excluding weekends and holidays)
 * - Fractional durations are rounded up to the next working day
 * 
 * @param tasks - Array of tasks to schedule (in CSV order)
 * @param config - Schedule configuration (project start date, sprint duration, velocity, optional non-working days)
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

  // Determine effective start date: use projectReschedulingDate if provided, otherwise projectStartDate
  const effectiveStartDate = config.projectReschedulingDate || config.projectStartDate;

  // Validate effective start date
  const parsedStartDate = new Date(effectiveStartDate);
  if (isNaN(parsedStartDate.getTime())) {
    throw new Error(`Invalid project start date: ${effectiveStartDate}. Expected ISO format (YYYY-MM-DD).`);
  }

  // Initialize working days calendar
  const workingDaysCalendar = new WorkingDaysCalendar(config.nonWorkingDays || []);

  // Ensure effective start date is a working day
  let currentDate = workingDaysCalendar.nextWorkingDay(effectiveStartDate);

  const scheduledTasks: ScheduledTask[] = [];

  // Status groups for BA and QA effort calculation
  const BA_STATUSES = new Set<string>([
    'To Do',
    'IN ANALYSIS',
    'On Hold / Blocked',
    'Review In Progress',
  ]);

  const QA_STATUSES = new Set<string>([
    'READY FOR QA',
    'TEST IN PROGRESS',
    'READY TO DEPLOY',
    'ACCEPTANCE BLOCKED',
    'BA ACCEPTANCE',
    'READY FOR DEV',
    'In Progress',
    'Blocked',
    'TO REVIEW',
    'CODE REVIEW',
    'PO APPROVED',
    'To Do',
    'IN ANALYSIS',
    'On Hold / Blocked',
    'Review In Progress',
  ]);

  // Process tasks sequentially
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];

    // Validate task estimate
    if (task.estimate < 0) {
      logger.warn(`Task ${task.id} has negative estimate (${task.estimate}), using 0`, i + 1);
    }

    // Calculate duration (preserves fractional values)
    const duration = calculateDuration(
      Math.max(0, task.estimate),
      config.velocity,
      config.sprintDurationDays
    );

    // Derive BA/QA effort shares for qualifying Story tasks
    let baEstimate: number | undefined;
    let qaEstimate: number | undefined;

    if (task.issueType === 'Story' && task.status && task.estimate > 0) {
      if (BA_STATUSES.has(task.status)) {
        baEstimate = +(task.estimate * 0.25);
      }

      if (QA_STATUSES.has(task.status)) {
        qaEstimate = +(task.estimate * 0.30);
      }
    }

    // Determine start date (ensure it's a working day)
    // For first task, use effective start date (adjusted to working day)
    // For subsequent tasks, use previous task's end date (which is already a working day)
    const startDate = i === 0 
      ? workingDaysCalendar.nextWorkingDay(effectiveStartDate)
      : workingDaysCalendar.nextWorkingDay(currentDate);

    // Calculate end date using working days
    const endDate = workingDaysCalendar.addWorkingDays(startDate, duration);

    // Create scheduled task
    const scheduledTask: ScheduledTask = {
      ...task,
      ...(baEstimate !== undefined && { baEstimate }),
      ...(qaEstimate !== undefined && { qaEstimate }),
      calculatedStartDate: startDate,
      calculatedEndDate: endDate,
    };

    scheduledTasks.push(scheduledTask);

    // Update current date for next task (use end date as base)
    // Next task starts on the same day as this task ends (per requirements)
    currentDate = endDate;
  }

  logger.info(`Schedule calculation complete: ${scheduledTasks.length} tasks scheduled`);
  
  return scheduledTasks;
}
