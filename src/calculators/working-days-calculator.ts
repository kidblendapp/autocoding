/**
 * Working Days Calculator for schedule calculations.
 * 
 * Provides working day arithmetic that excludes weekends (Saturday, Sunday)
 * and configurable non-working days (holidays) from date calculations.
 * Supports fractional durations with proper rounding up to next working day.
 */

/**
 * Working Days Calendar class that manages working day calculations.
 * 
 * Defaults to Monday-Friday as working days, excluding weekends.
 * Supports additional non-working days (holidays) from configuration.
 */
export class WorkingDaysCalendar {
  private nonWorkingDays: Set<string>;

  /**
   * Creates a new WorkingDaysCalendar instance.
   * 
   * @param nonWorkingDays - Optional array of non-working days in ISO format (YYYY-MM-DD).
   *                         Defaults to weekends only (Saturday, Sunday) if not provided.
   */
  constructor(nonWorkingDays: string[] = []) {
    this.nonWorkingDays = new Set(nonWorkingDays);
  }

  /**
   * Checks if a given date is a working day.
   * 
   * Working days are Monday through Friday, excluding:
   * - Weekends (Saturday, Sunday)
   * - Configured non-working days (holidays)
   * 
   * @param date - Date string in ISO format (YYYY-MM-DD)
   * @returns True if the date is a working day, false otherwise
   * @throws Error if date format is invalid
   */
  isWorkingDay(date: string): boolean {
    const dateObj = this.parseDate(date);
    const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Check if it's a weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }
    
    // Check if it's a configured non-working day
    if (this.nonWorkingDays.has(date)) {
      return false;
    }
    
    return true;
  }

  /**
   * Adds a specified number of working days to a start date.
   * 
   * Handles fractional durations by rounding up to the next working day.
   * Skips weekends and configured holidays during calculation.
   * 
   * Examples:
   * - Monday + 2.5 days → Wednesday (rounded up)
   * - Friday + 1.5 days → Monday (skips weekend, rounded up)
   * 
   * @param startDate - Start date in ISO format (YYYY-MM-DD)
   * @param days - Number of working days to add (can be fractional)
   * @returns End date in ISO format (YYYY-MM-DD), always a working day
   * @throws Error if startDate format is invalid
   */
  addWorkingDays(startDate: string, days: number): string {
    if (days < 0) {
      throw new Error(`Days must be non-negative. Received: ${days}`);
    }

    // Ensure start date is a working day
    const workingStartDate = this.nextWorkingDay(startDate);

    if (days === 0) {
      // If zero days, return the working start date
      return workingStartDate;
    }

    let currentDate = this.parseDate(workingStartDate);
    let workingDaysAdded = 0;
    const targetWorkingDays = Math.ceil(days); // Round up fractional days

    // Add working days one by one, skipping non-working days
    while (workingDaysAdded < targetWorkingDays) {
      const dateStr = this.formatDate(currentDate);
      
      if (this.isWorkingDay(dateStr)) {
        workingDaysAdded++;
      }
      
      // If we've reached the target, we're done
      if (workingDaysAdded >= targetWorkingDays) {
        break;
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Ensure the result is a working day (in case we ended on a non-working day)
    const resultDateStr = this.formatDate(currentDate);
    if (!this.isWorkingDay(resultDateStr)) {
      return this.nextWorkingDay(resultDateStr);
    }

    return resultDateStr;
  }

  /**
   * Finds the next working day from a given date.
   * 
   * If the given date is already a working day, returns the same date.
   * Otherwise, returns the next working day (skipping weekends and holidays).
   * 
   * @param date - Date string in ISO format (YYYY-MM-DD)
   * @returns Next working day in ISO format (YYYY-MM-DD)
   * @throws Error if date format is invalid
   */
  nextWorkingDay(date: string): string {
    let currentDate = this.parseDate(date);
    const maxIterations = 14; // Prevent infinite loops (max 2 weeks)
    let iterations = 0;

    while (iterations < maxIterations) {
      const dateStr = this.formatDate(currentDate);
      
      if (this.isWorkingDay(dateStr)) {
        return dateStr;
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
      iterations++;
    }

    throw new Error(`Unable to find next working day from ${date} after ${maxIterations} iterations`);
  }

  /**
   * Parses an ISO date string into a Date object.
   * 
   * @param dateStr - Date string in ISO format (YYYY-MM-DD)
   * @returns Date object
   * @throws Error if date format is invalid
   * @private
   */
  private parseDate(dateStr: string): Date {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!isoDateRegex.test(dateStr)) {
      throw new Error(`Invalid date format: ${dateStr}. Expected ISO format (YYYY-MM-DD)`);
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date: ${dateStr}`);
    }

    // Verify the date string matches the parsed date (prevents dates like "2024-13-45")
    const [year, month, day] = dateStr.split('-').map(Number);
    const expectedDate = new Date(year, month - 1, day);
    if (
      expectedDate.getFullYear() !== year ||
      expectedDate.getMonth() !== month - 1 ||
      expectedDate.getDate() !== day
    ) {
      throw new Error(`Invalid date: ${dateStr}`);
    }

    return date;
  }

  /**
   * Formats a Date object to ISO date string (YYYY-MM-DD).
   * 
   * @param date - Date object
   * @returns Date string in ISO format (YYYY-MM-DD)
   * @private
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
