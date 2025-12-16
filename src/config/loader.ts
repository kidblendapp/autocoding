/**
 * Configuration file loader for schedule configuration.
 * 
 * Handles reading and parsing config.json files from the file system.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { logger } from '../utils/logger';
import type { RawScheduleConfig } from './types';

export interface LoadConfigOptions {
  /** 
   * Path to the config.json file. 
   * If not provided, defaults to 'config.json' in the current working directory.
   */
  configPath?: string;
}

/**
 * Loads and parses the configuration file.
 * 
 * @param options - Configuration loading options
 * @returns Parsed configuration object (not yet validated)
 * @throws Error if file cannot be read or parsed
 */
export function loadConfigFile(options: LoadConfigOptions = {}): RawScheduleConfig {
  const configPath = options.configPath 
    ? resolve(options.configPath)
    : resolve(process.cwd(), 'config.json');

  // Check if file exists
  if (!existsSync(configPath)) {
    const errorMessage = `Configuration file not found: ${configPath}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  try {
    // Read and parse JSON file
    const fileContent = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(fileContent) as RawScheduleConfig;
    
    logger.info(`Configuration loaded successfully from: ${configPath}`);
    return config;
  } catch (error) {
    if (error instanceof SyntaxError) {
      const errorMessage = `Invalid JSON format in configuration file: ${configPath}. ${error.message}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    
    if (error instanceof Error && error.message.includes('ENOENT')) {
      const errorMessage = `Configuration file not found: ${configPath}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    
    const errorMessage = `Failed to load configuration file: ${configPath}. ${error instanceof Error ? error.message : String(error)}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }
}
