/**
 * Output generator for scheduled tasks.
 * 
 * Writes scheduled tasks to output.json file in JSON format.
 */

import { writeFileSync } from 'fs';
import type { ScheduledTask } from '../models/ScheduledTask';
import { logger } from '../utils/logger';

/**
 * Generates output.json file with scheduled tasks.
 * 
 * @param scheduledTasks - Array of scheduled tasks to write
 * @param outputPath - Path to output file (default: 'output.json')
 * @throws Error if file cannot be written
 */
export function generateOutput(
  scheduledTasks: ScheduledTask[],
  outputPath: string = 'output.json'
): void {
  try {
    const output = JSON.stringify(scheduledTasks, null, 2);
    writeFileSync(outputPath, output, 'utf-8');
    logger.info(`Output file generated: ${outputPath} (${scheduledTasks.length} tasks)`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to generate output file: ${errorMessage}`);
    throw new Error(`Failed to write output file ${outputPath}: ${errorMessage}`);
  }
}
