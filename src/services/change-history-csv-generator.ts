/**
 * CSV generator for change history data.
 * 
 * Creates timestamped output directories and writes change history
 * data to CSV format.
 */

import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';
import type { FieldChange } from './change-history-extractor';

/**
 * Generates a CSV file with change history data in a timestamped directory.
 * 
 * @param changes - Array of field changes to write
 * @param baseOutputDir - Base output directory (default: './output')
 * @returns Path to the generated CSV file
 * @throws Error if file cannot be written
 */
export function generateChangeHistoryCsv(
  changes: FieldChange[],
  baseOutputDir: string = './output'
): string {
  try {
    // Create timestamped directory (format: YYYYMMDD_HH)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    
    const timestampedDir = `${year}${month}${day}_${hour}`;
    const outputDir = join(baseOutputDir, timestampedDir);
    
    // Create directory if it doesn't exist
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
      logger.info(`Created output directory: ${outputDir}`);
    }
    
    // Generate CSV content
    const csvContent = generateCsvContent(changes);
    
    // Write CSV file
    const csvPath = join(outputDir, 'changes_history.csv');
    writeFileSync(csvPath, csvContent, 'utf-8');
    
    logger.info(`Change history CSV generated: ${csvPath} (${changes.length} changes)`);
    return csvPath;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to generate change history CSV: ${errorMessage}`);
    throw new Error(`Failed to write change history CSV: ${errorMessage}`);
  }
}

/**
 * Generates CSV content from field changes.
 * 
 * @param changes - Array of field changes
 * @returns CSV content as string
 */
function generateCsvContent(changes: FieldChange[]): string {
  // CSV header
  const header = 'Issue key,Field name,Value,Changed at,Changed by';
  
  // CSV rows
  const rows = changes.map(change => {
    // Escape CSV special characters (quotes, commas, newlines)
    const escapeCsv = (value: string): string => {
      if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };
    
    return [
      escapeCsv(change.issueKey),
      escapeCsv(change.fieldName),
      escapeCsv(change.value),
      escapeCsv(change.changedAt),
      escapeCsv(change.changedBy),
    ].join(',');
  });
  
  return [header, ...rows].join('\n');
}
