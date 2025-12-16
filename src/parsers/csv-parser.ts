/**
 * CSV Parser for backlog ingestion.
 * 
 * Parses CSV files containing task details and converts them into structured Task objects.
 * Handles validation, estimate processing, and error reporting.
 */

import { parse } from 'csv-parse/sync';
import { readFileSync, existsSync, accessSync, constants } from 'fs';
import { Task } from '../models/Task';
import { EstimateConfig, DEFAULT_CONFIG } from '../config/Config';
import { logger } from '../utils/logger';
import { processEstimate } from '../utils/estimate-processor';

export interface CsvRow {
  [key: string]: string | undefined;
}

export interface ParseResult {
  tasks: Task[];
  skipped: number;
  total: number;
}

/**
 * Validates that a file exists and is readable.
 * 
 * @param filePath - Path to the file
 * @throws Error if file doesn't exist or is not readable
 */
export function validateFile(filePath: string): void {
  if (!filePath || filePath.trim() === '') {
    throw new Error('File path is required');
  }

  if (!existsSync(filePath)) {
    throw new Error(`File does not exist: ${filePath}`);
  }

  try {
    accessSync(filePath, constants.R_OK);
  } catch (error) {
    throw new Error(`File is not readable: ${filePath}`);
  }
}

/**
 * Parses a CSV file and converts rows to Task objects.
 * 
 * @param filePath - Path to the CSV file
 * @param config - Configuration for estimate processing
 * @param suppressWarnings - If true, warnings are not displayed (but still logged)
 * @returns ParseResult containing tasks array and statistics
 * @throws Error if file cannot be read or parsed
 */
export function parseCsvFile(
  filePath: string,
  config: EstimateConfig = DEFAULT_CONFIG,
  suppressWarnings: boolean = false
): ParseResult {
  logger.setSuppressWarnings(suppressWarnings);
  logger.clear();

  // Validate file
  validateFile(filePath);

  // Read and parse CSV file
  let records: CsvRow[];
  try {
    const fileContent = readFileSync(filePath, 'utf-8');
    records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as CsvRow[];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to parse CSV file: ${errorMessage}`, { filePath, error });
    throw new Error(`CSV parsing failed: ${errorMessage}`);
  }

  const tasks: Task[] = [];
  let skipped = 0;
  const total = records.length;

  // Process each row
  records.forEach((row, index) => {
    const rowNumber = index + 2; // +2 because: 1 for header row, 1 for 0-based index

    try {
      const task = processRow(row, config, rowNumber);
      if (task) {
        tasks.push(task);
      } else {
        skipped++;
      }
    } catch (error) {
      skipped++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`Error processing row: ${errorMessage}`, rowNumber, { row, error });
    }
  });

  // Display summary
  if (skipped > 0) {
    logger.info(`Skipped ${skipped} row(s) out of ${total} total`);
  } else {
    logger.info(`Successfully processed all ${total} row(s)`);
  }

  return {
    tasks,
    skipped,
    total,
  };
}

/**
 * Processes a single CSV row and converts it to a Task object.
 * 
 * @param row - CSV row data
 * @param config - Configuration for estimate processing
 * @param rowNumber - Row number for logging
 * @returns Task object if valid, null if row should be skipped
 */
function processRow(
  row: CsvRow,
  config: EstimateConfig,
  rowNumber: number
): Task | null {
  // Normalize column names (case-insensitive matching)
  const id = findColumnValue(row, ['Issue Key', 'ID', 'Id', 'id', 'issue-key', 'issue_key']);
  const title = findColumnValue(row, ['Summary', 'Title', 'title', 'summary']);
  const estimate = findColumnValue(row, ['Story Points', 'Original Estimate', 'Estimate', 'estimate', 'story-points', 'story_points', 'original-estimate', 'original_estimate']);
  const component = findColumnValue(row, ['Component', 'component']);
  const parentId = findColumnValue(row, ['Parent Id', 'Parent ID', 'ParentId', 'parent-id', 'parent_id', 'parentId']);
  const issueType = findColumnValue(row, ['Issue Type', 'IssueType', 'issue-type', 'issue_type', 'issueType']);

  // Validate required fields
  if (!id || id.trim() === '') {
    logger.warn('Row skipped: missing required field "ID"', rowNumber, { row });
    return null;
  }

  if (!title || title.trim() === '') {
    logger.warn('Row skipped: missing required field "Title"', rowNumber, { row, id });
    return null;
  }

  // Process estimate
  const processedEstimate = processEstimate(estimate, config, rowNumber);

  // Build Task object
  const task: Task = {
    id: id.trim(),
    title: title.trim(),
    estimate: processedEstimate,
  };

  // Add optional fields if present
  if (component && component.trim() !== '') {
    task.component = component.trim();
  }

  if (parentId && parentId.trim() !== '') {
    task.parentId = parentId.trim();
  }

  if (issueType && issueType.trim() !== '') {
    task.issueType = issueType.trim();
  }

  return task;
}

/**
 * Finds a column value by trying multiple possible column names (case-insensitive).
 * 
 * @param row - CSV row data
 * @param possibleNames - Array of possible column names to try
 * @returns Column value if found, undefined otherwise
 */
function findColumnValue(row: CsvRow, possibleNames: string[]): string | undefined {
  // First try exact match (case-sensitive)
  for (const name of possibleNames) {
    if (row[name] !== undefined) {
      return row[name];
    }
  }

  // Then try case-insensitive match
  const rowKeys = Object.keys(row);
  for (const name of possibleNames) {
    const found = rowKeys.find(key => key.toLowerCase() === name.toLowerCase());
    if (found) {
      return row[found];
    }
  }

  return undefined;
}
