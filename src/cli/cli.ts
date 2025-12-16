/**
 * CLI interface for CSV Backlog Ingestion.
 * 
 * Handles command-line arguments and orchestrates CSV parsing.
 */

import { parseCsvFile, ParseResult } from '../parsers/csv-parser';
import { EstimateConfig, DEFAULT_CONFIG } from '../config/Config';
import { logger } from '../utils/logger';

export interface CliOptions {
  input?: string;
  config?: string;
  suppressWarnings?: boolean;
}

/**
 * Parses command-line arguments.
 * 
 * @param args - Command-line arguments (typically process.argv.slice(2))
 * @returns Parsed CLI options
 */
export function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--input' || arg === '-i') {
      options.input = args[++i];
    } else if (arg === '--config' || arg === '-c') {
      options.config = args[++i];
    } else if (arg === '--suppress-warnings' || arg === '-q') {
      options.suppressWarnings = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

/**
 * Loads configuration from file or uses defaults.
 * 
 * @param configPath - Optional path to configuration file
 * @returns EstimateConfig
 */
function loadConfig(configPath?: string): EstimateConfig {
  if (!configPath) {
    return DEFAULT_CONFIG;
  }

  try {
    const fs = require('fs');
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    
    return {
      estimateType: config.estimateType || DEFAULT_CONFIG.estimateType,
      hoursPerDay: config.hoursPerDay || DEFAULT_CONFIG.hoursPerDay,
      validStoryPoints: config.validStoryPoints || DEFAULT_CONFIG.validStoryPoints,
    };
  } catch (error) {
    logger.warn(`Failed to load config file: ${configPath}, using defaults`);
    return DEFAULT_CONFIG;
  }
}

/**
 * Main CLI entry point.
 * 
 * @param args - Command-line arguments
 * @returns ParseResult or null if error occurred
 */
export function runCli(args: string[]): ParseResult | null {
  const options = parseArgs(args);

  // Validate required --input flag
  if (!options.input) {
    logger.error('Missing required --input flag');
    console.error('\nUsage: node dist/index.js --input <file-path> [options]');
    console.error('\nOptions:');
    console.error('  --input, -i <path>     Path to CSV file (required)');
    console.error('  --config, -c <path>    Path to configuration file (optional)');
    console.error('  --suppress-warnings, -q Suppress warning messages (optional)');
    console.error('  --help, -h             Show this help message');
    process.exit(1);
  }

  const config = loadConfig(options.config);

  try {
    const result = parseCsvFile(options.input, config, options.suppressWarnings || false);
    
    // Output results as JSON
    console.log('\n=== Parse Results ===');
    console.log(JSON.stringify(result.tasks, null, 2));
    
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`CSV ingestion failed: ${errorMessage}`);
    process.exit(1);
  }
}

/**
 * Prints help message.
 */
function printHelp(): void {
  console.log(`
CSV Backlog Ingestion Tool

Usage: node dist/index.js --input <file-path> [options]

Options:
  --input, -i <path>           Path to CSV file (required)
  --config, -c <path>          Path to configuration file (optional)
  --suppress-warnings, -q      Suppress warning messages (optional)
  --help, -h                   Show this help message

Examples:
  node dist/index.js --input examples/backlog.csv
  node dist/index.js --input examples/backlog.csv --suppress-warnings
  node dist/index.js --input examples/backlog.csv --config team-config.json

CSV Format:
  Required columns: Issue Key (or ID), Summary (or Title)
  Optional columns: Story Points, Original Estimate, Component, Parent Id, Issue Type

Estimate Formats:
  Story Points: 1, 2, 3, 5, or 8
  Days/Hours: "8h", "2d", "1w", or decimal hours (e.g., "4.5")
`);
}
