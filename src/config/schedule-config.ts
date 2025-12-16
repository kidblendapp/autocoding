/**
 * Schedule configuration singleton/context.
 * 
 * Provides immutable access to validated schedule configuration throughout
 * the application. Configuration is loaded once during initialization and
 * cannot be modified afterward.
 */

import { loadConfigFile, type LoadConfigOptions } from './loader';
import { validateConfig, formatValidationErrors } from './validator';
import { logger } from '../utils/logger';
import type { ScheduleConfig } from './types';

/**
 * Singleton instance for schedule configuration.
 */
class ScheduleConfigManager {
  private config: ScheduleConfig | null = null;
  private initialized: boolean = false;

  /**
   * Initialize the configuration from a config.json file.
   * 
   * This method should be called once during application startup.
   * Attempting to initialize multiple times will throw an error.
   * 
   * @param options - Configuration loading options
   * @throws Error if configuration is invalid or already initialized
   */
  initialize(options: LoadConfigOptions = {}): void {
    if (this.initialized) {
      throw new Error('Schedule configuration has already been initialized. Configuration is immutable after initialization.');
    }

    try {
      // Load and validate configuration
      const rawConfig = loadConfigFile(options);
      const validationResult = validateConfig(rawConfig);

      if (!validationResult.valid) {
        const errorMessage = formatValidationErrors(validationResult.errors);
        logger.error(errorMessage);
        throw new Error(errorMessage);
      }

      // Store validated configuration
      this.config = validationResult.config!;
      this.initialized = true;
      
      logger.info('Schedule configuration initialized successfully');
    } catch (error) {
      logger.error(`Failed to initialize schedule configuration: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get the project start date.
   * 
   * @returns Project start date in ISO format (YYYY-MM-DD)
   * @throws Error if configuration has not been initialized
   */
  getProjectStartDate(): string {
    this.ensureInitialized();
    return this.config!.projectStartDate;
  }

  /**
   * Get the sprint duration in days.
   * 
   * @returns Sprint duration in days
   * @throws Error if configuration has not been initialized
   */
  getSprintDurationDays(): number {
    this.ensureInitialized();
    return this.config!.sprintDurationDays;
  }

  /**
   * Get the team velocity (story points per sprint).
   * 
   * @returns Team velocity
   * @throws Error if configuration has not been initialized
   */
  getVelocity(): number {
    this.ensureInitialized();
    return this.config!.velocity;
  }

  /**
   * Get the complete configuration object.
   * 
   * @returns Complete schedule configuration
   * @throws Error if configuration has not been initialized
   */
  getConfig(): ScheduleConfig {
    this.ensureInitialized();
    return { ...this.config! }; // Return a copy to prevent modification
  }

  /**
   * Check if configuration has been initialized.
   * 
   * @returns True if configuration is initialized, false otherwise
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Reset the configuration (useful for testing).
   * 
   * @internal
   */
  reset(): void {
    this.config = null;
    this.initialized = false;
  }

  /**
   * Ensure configuration has been initialized.
   * 
   * @throws Error if configuration has not been initialized
   * @private
   */
  private ensureInitialized(): void {
    if (!this.initialized || this.config === null) {
      throw new Error('Schedule configuration has not been initialized. Call initialize() before accessing configuration.');
    }
  }
}

/**
 * Singleton instance of the schedule configuration manager.
 * 
 * Usage:
 * ```typescript
 * import { scheduleConfig } from './config/schedule-config';
 * 
 * // Initialize during application startup
 * scheduleConfig.initialize({ configPath: 'config.json' });
 * 
 * // Access configuration values
 * const startDate = scheduleConfig.getProjectStartDate();
 * const sprintDays = scheduleConfig.getSprintDurationDays();
 * const velocity = scheduleConfig.getVelocity();
 * ```
 */
export const scheduleConfig = new ScheduleConfigManager();
