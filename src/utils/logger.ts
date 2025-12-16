/**
 * Structured logger for CSV processing warnings and errors.
 * 
 * Provides consistent logging format for validation issues, estimate defaults,
 * and processing statistics.
 */

export interface LogEntry {
  level: 'warn' | 'error' | 'info';
  message: string;
  rowNumber?: number;
  details?: Record<string, unknown>;
}

class StructuredLogger {
  private entries: LogEntry[] = [];
  private suppressWarnings: boolean = false;

  /**
   * Set whether to suppress warning messages.
   * @param suppress - If true, warnings will not be displayed
   */
  setSuppressWarnings(suppress: boolean): void {
    this.suppressWarnings = suppress;
  }

  /**
   * Log a warning message.
   * @param message - Warning message
   * @param rowNumber - Optional row number where the issue occurred
   * @param details - Optional additional details
   */
  warn(message: string, rowNumber?: number, details?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level: 'warn',
      message,
      rowNumber,
      details,
    };
    this.entries.push(entry);
    
    if (!this.suppressWarnings) {
      const rowInfo = rowNumber !== undefined ? ` [Row ${rowNumber}]` : '';
      console.warn(`⚠️  ${message}${rowInfo}`);
      if (details) {
        console.warn('   Details:', details);
      }
    }
  }

  /**
   * Log an error message.
   * @param message - Error message
   * @param details - Optional additional details
   */
  error(message: string, details?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level: 'error',
      message,
      details,
    };
    this.entries.push(entry);
    
    console.error(`❌ ${message}`);
    if (details) {
      console.error('   Details:', details);
    }
  }

  /**
   * Log an info message.
   * @param message - Info message
   */
  info(message: string): void {
    const entry: LogEntry = {
      level: 'info',
      message,
    };
    this.entries.push(entry);
    
    console.log(`ℹ️  ${message}`);
  }

  /**
   * Get all log entries.
   * @returns Array of log entries
   */
  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  /**
   * Get count of warnings.
   * @returns Number of warning entries
   */
  getWarningCount(): number {
    return this.entries.filter(e => e.level === 'warn').length;
  }

  /**
   * Get count of errors.
   * @returns Number of error entries
   */
  getErrorCount(): number {
    return this.entries.filter(e => e.level === 'error').length;
  }

  /**
   * Clear all log entries.
   */
  clear(): void {
    this.entries = [];
  }
}

export const logger = new StructuredLogger();
