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
import { extractChangeHistory } from '../../services/change-history-extractor';
import { generateChangeHistoryCsv } from '../../services/change-history-csv-generator';
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

    const config = scheduleConfig.getConfig();

    // Extract change history if configured (run in parallel with schedule calculation)
    const changeHistoryPromise = config.changeHistory
      ? extractChangeHistory(config.changeHistory)
          .then(changes => {
            if (changes.length > 0) {
              generateChangeHistoryCsv(changes);
            } else {
              logger.info('No change history data to export');
            }
          })
          .catch(error => {
            // Log error but don't fail the entire command
            logger.error(`Change history extraction failed: ${error instanceof Error ? error.message : String(error)}`);
            logger.warn('Continuing with schedule calculation despite change history extraction error');
          })
      : Promise.resolve();

    // Calculate schedule
    const scheduledTasks = calculateSchedule(result.tasks, config);

    // Generate output file
    generateOutput(scheduledTasks, options.output);

    // Wait for change history extraction to complete (if it was started)
    await changeHistoryPromise;

    return scheduledTasks;
  } catch (error) {
    logger.error(`CSV ingestion and schedule calculation failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
