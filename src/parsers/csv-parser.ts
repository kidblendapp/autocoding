/**
 * CSV parser for backlog ingestion.
 * 
 * Parses CSV files containing task details and converts them into Task objects
 * with validation and error handling.
 */

import { parse } from 'csv-parse/sync';
import { readFileSync, existsSync, accessSync, constants } from 'fs';
import { Task } from '../models/Task';
import { logger } from '../utils/logger';
import { TeamConfig, defaultConfig } from '../config/types';
import { validateAndProcessEstimate } from '../processors/estimate-processor';

export interface ParseOptions {
  /** Team configuration for estimate validation */
  config?: TeamConfig;
  
  /** Suppress warning messages */
  suppressWarnings?: boolean;
  
  /** Maximum file size in bytes (default: 10MB) */
  maxFileSize?: number;
}

export interface ParseResult {
  /** Array of successfully parsed tasks */
  tasks: Task[];
  
  /** Number of rows skipped due to validation errors */
  skippedRows: number;
  
  /** Total number of rows processed */
  totalRows: number;
}

/**
 * Validates that a file exists and is readable.
 * 
 * @param filePath - Path to the file
 * @throws Error if file doesn't exist or is not readable
 */
export function validateFile(filePath: string): void {
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
 * Validates file size to prevent memory exhaustion.
 * 
 * @param filePath - Path to the file
 * @param maxSize - Maximum file size in bytes
 * @throws Error if file exceeds maximum size
 */
export function validateFileSize(filePath: string, maxSize: number = 10 * 1024 * 1024): void {
  const stats = require('fs').statSync(filePath);
  if (stats.size > maxSize) {
    throw new Error(`File size (${stats.size} bytes) exceeds maximum allowed size (${maxSize} bytes)`);
  }
}

/**
 * Parses a CSV file and converts rows to Task objects.
 * 
 * @param filePath - Path to the CSV file
 * @param options - Parse options including configuration
 * @returns Parse result with tasks and statistics
 * @throws Error if file cannot be read or parsed
 */
export function parseCsvFile(filePath: string, options: ParseOptions = {}): ParseResult {
  const config = options.config || defaultConfig.defaultTeam;
  const maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB default

  logger.setSuppressWarnings(options.suppressWarnings || false);
  logger.clear();

  // Validate file
  try {
    validateFile(filePath);
    validateFileSize(filePath, maxFileSize);
  } catch (error) {
    logger.error(`File validation failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }

  // Read and parse CSV
  let records: Record<string, string>[];
  try {
    const fileContent = readFileSync(filePath, 'utf-8');
    records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as Record<string, string>[];
  } catch (error) {
    logger.error(`CSV parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Failed to parse CSV file: ${error instanceof Error ? error.message : String(error)}`);
  }

  const tasks: Task[] = [];
  let skippedRows = 0;
  const totalRows = records.length;

  // Process each row
  records.forEach((row, index) => {
    const rowNumber = index + 2; // +2 because row 1 is header, and index is 0-based

    // Extract required fields
    const id = extractField(row, 'ID', ['Issue Key', 'Id', 'id']);
    const title = extractField(row, 'Title', ['Summary', 'Title', 'title']);

    // Validate required fields
    if (!id || id.trim() === '') {
      logger.warn('Missing required field: ID', rowNumber, { row });
      skippedRows++;
      return;
    }

    if (!title || title.trim() === '') {
      logger.warn('Missing required field: Title', rowNumber, { row });
      skippedRows++;
      return;
    }

    // Extract optional fields
    const estimateValue = extractField(row, 'Estimate', ['Story Points', 'Original Estimate', 'Estimate', 'estimate']);
    const component = extractField(row, 'Component', ['Component', 'component']);
    const parentId = extractField(row, 'Parent Id', ['Parent Id', 'ParentId', 'parentId', 'Parent']);
    const issueType = extractField(row, 'Issue Type', ['Issue Type', 'IssueType', 'issueType']);
    const status = extractField(row, 'Status', ['Status', 'status']);
    const assignee = extractField(row, 'Assignee', ['Assignee', 'assignee', 'Assigned To']);
    const epicLink = extractField(row, 'Epic Link', ['Epic Link', 'EpicLink', 'epicLink', 'Epic']);

    // Validate and process estimate
    const estimate = validateAndProcessEstimate(estimateValue, config, rowNumber);

    // Build task object
    const task: Task = {
      id: id.trim(),
      title: title.trim(),
      estimate,
      ...(component && component.trim() !== '' && { component: component.trim() }),
      ...(parentId && parentId.trim() !== '' && { parentId: parentId.trim() }),
      ...(issueType && issueType.trim() !== '' && { issueType: issueType.trim() }),
      ...(status && status.trim() !== '' && { status: status.trim() }),
      ...(assignee && assignee.trim() !== '' && { assignee: assignee.trim() }),
      ...(epicLink && epicLink.trim() !== '' && { epicLink: epicLink.trim() }),
    };

    tasks.push(task);
  });

  // Display summary
  const summary = logger.getSummary();
  if (skippedRows > 0 || summary.warnings > 0) {
    logger.info(`Processing complete: ${tasks.length} tasks created, ${skippedRows} rows skipped out of ${totalRows} total`);
  } else {
    logger.info(`Processing complete: ${tasks.length} tasks created from ${totalRows} rows`);
  }

  return {
    tasks,
    skippedRows,
    totalRows,
  };
}

/**
 * Extracts a field from a CSV row, trying multiple possible column names.
 * 
 * @param row - CSV row object
 * @param primaryName - Primary field name to try
 * @param alternativeNames - Alternative field names to try
 * @returns Field value or undefined
 */
function extractField(
  row: Record<string, string>,
  primaryName: string,
  alternativeNames: string[] = []
): string | undefined {
  // Try primary name first
  if (row[primaryName] !== undefined) {
    return row[primaryName];
  }

  // Try alternative names
  for (const altName of alternativeNames) {
    if (row[altName] !== undefined) {
      return row[altName];
    }
  }

  return undefined;
}
