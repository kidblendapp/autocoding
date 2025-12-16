/**
 * CLI command for CSV backlog ingestion.
 * 
 * Processes CSV files and converts them to Task objects with validation.
 */

import { parseCsvFile } from '../../parsers/csv-parser';
import { defaultConfig, TeamConfig } from '../../config/types';
import { logger } from '../../utils/logger';

export interface IngestOptions {
  /** Path to the CSV file */
  input: string;
  
  /** Suppress warning messages */
  quiet?: boolean;
  
  /** Team configuration for estimate validation */
  config?: TeamConfig;
}

/**
 * Executes the CSV ingestion command.
 * 
 * @param options - Command options
 * @returns Array of parsed Task objects
 * @throws Error if file cannot be processed
 */
export async function ingestCsv(options: IngestOptions): Promise<any[]> {
  if (!options.input) {
    logger.error('--input flag is required. Usage: --input <file-path>');
    throw new Error('Missing required --input flag');
  }

  try {
    const result = parseCsvFile(options.input, {
      config: options.config || defaultConfig.defaultTeam,
      suppressWarnings: options.quiet || false,
    });

    return result.tasks;
  } catch (error) {
    logger.error(`CSV ingestion failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
