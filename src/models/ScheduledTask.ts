/**
 * ScheduledTask interface representing a task with calculated start and end dates.
 * 
 * Extends the base Task interface with calculated schedule information.
 * 
 * @interface ScheduledTask
 */

import type { Task } from './Task';

export interface ScheduledTask extends Task {
  /** Calculated start date in ISO format (YYYY-MM-DD) */
  calculatedStartDate: string;
  
  /** Calculated end date in ISO format (YYYY-MM-DD) */
  calculatedEndDate: string;
}
