/**
 * CLI command for CSV backlog ingestion and schedule calculation.
 * 
 * Processes CSV files, converts them to Task objects with validation,
 * calculates schedules, and generates output.json.
 */

import { parseCsvFile } from '../../parsers/csv-parser';
import { defaultConfig, TeamConfig } from '../../config/types';
import { logger } from '../../utils/logger';
import { scheduleConfig } from '../../config/schedule-config';
import { calculateSchedule } from '../../calculators/schedule-calculator';
import { generateOutput } from '../../output/output-generator';
import type { ScheduledTask } from '../../models/ScheduledTask';

export interface IngestOptions {
  /** Path to the CSV file */
  input: string;
  
  /** Suppress warning messages */
  quiet?: boolean;
  
  /** Team configuration for estimate validation */
  config?: TeamConfig;
  
  /** Path to schedule configuration file (default: 'config.json') */
  scheduleConfigPath?: string;
  
  /** Path to output file (default: 'output.json') */
  output?: string;
}

/**
 * Executes the CSV ingestion and schedule calculation command.
 * 
 * @param options - Command options
 * @returns Array of scheduled tasks with calculated dates
 * @throws Error if file cannot be processed or schedule cannot be calculated
 */
export async function ingestCsv(options: IngestOptions): Promise<ScheduledTask[]> {
  if (!options.input) {
    logger.error('--input flag is required. Usage: --input <file-path>');
    throw new Error('Missing required --input flag');
  }

  try {
    // Parse CSV file
    const result = parseCsvFile(options.input, {
      config: options.config || defaultConfig.defaultTeam,
      suppressWarnings: options.quiet || false,
    });

    if (result.tasks.length === 0) {
      logger.warn('No tasks found in CSV file');
      return [];
    }

    // Initialize schedule configuration
    scheduleConfig.initialize({
      configPath: options.scheduleConfigPath,
    });

    // Calculate schedule
    const scheduledTasks = calculateSchedule(result.tasks, scheduleConfig.getConfig());

    // Generate output file
    generateOutput(scheduledTasks, options.output);

    return scheduledTasks;
  } catch (error) {
    logger.error(`CSV ingestion and schedule calculation failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
