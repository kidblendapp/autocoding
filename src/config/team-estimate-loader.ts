/**
 * Configuration file loader for team estimate configuration.
 * 
 * Handles reading and parsing team-estimate-config.json files from the file system.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { logger } from '../utils/logger';
import type { TeamEstimateConfiguration } from './team-estimate-types';

export interface LoadTeamEstimateConfigOptions {
  /** 
   * Path to the team-estimate-config.json file. 
   * If not provided, defaults to 'team-estimate-config.json' in the current working directory.
   */
  configPath?: string;
}

/**
 * Loads and parses the team estimate configuration file.
 * 
 * @param options - Configuration loading options
 * @returns Parsed configuration object (not yet validated)
 * @throws Error if file cannot be read or parsed
 */
export function loadTeamEstimateConfigFile(
  options: LoadTeamEstimateConfigOptions = {}
): TeamEstimateConfiguration {
  const configPath = options.configPath 
    ? resolve(options.configPath)
    : resolve(process.cwd(), 'team-estimate-config.json');

  // Check if file exists
  if (!existsSync(configPath)) {
    const errorMessage = `Team estimate configuration file not found: ${configPath}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  try {
    // Read and parse JSON file
    const fileContent = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(fileContent) as TeamEstimateConfiguration;
    
    logger.info(`Team estimate configuration loaded successfully from: ${configPath}`);
    return config;
  } catch (error) {
    if (error instanceof SyntaxError) {
      const errorMessage = `Invalid JSON format in team estimate configuration file: ${configPath}. ${error.message}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    
    if (error instanceof Error && error.message.includes('ENOENT')) {
      const errorMessage = `Team estimate configuration file not found: ${configPath}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    
    const errorMessage = `Failed to load team estimate configuration file: ${configPath}. ${error instanceof Error ? error.message : String(error)}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }
}
