/**
 * Team estimate configuration singleton/context.
 * 
 * Provides immutable access to validated team estimate configuration throughout
 * the application. Configuration is loaded once during initialization and
 * cannot be modified afterward.
 */

import { loadTeamEstimateConfigFile, type LoadTeamEstimateConfigOptions } from './team-estimate-loader';
import { validateTeamEstimateConfig, formatTeamEstimateValidationErrors } from './team-estimate-validator';
import { logger } from '../utils/logger';
import type { TeamEstimateConfiguration } from './team-estimate-types';

/**
 * Singleton instance for team estimate configuration.
 */
class TeamEstimateConfigManager {
  private config: TeamEstimateConfiguration | null = null;
  private initialized: boolean = false;

  /**
   * Initialize the configuration from a team-estimate-config.json file.
   * 
   * This method should be called once during application startup.
   * Attempting to initialize multiple times will throw an error.
   * 
   * @param options - Configuration loading options
   * @throws Error if configuration is invalid or already initialized
   */
  initialize(options: LoadTeamEstimateConfigOptions = {}): void {
    if (this.initialized) {
      throw new Error('Team estimate configuration has already been initialized. Configuration is immutable after initialization.');
    }

    try {
      // Load and validate configuration
      const rawConfig = loadTeamEstimateConfigFile(options);
      const validationResult = validateTeamEstimateConfig(rawConfig);

      if (!validationResult.valid) {
        const errorMessage = formatTeamEstimateValidationErrors(validationResult.errors);
        logger.error(errorMessage);
        throw new Error(errorMessage);
      }

      // Store validated configuration
      this.config = validationResult.config!;
      this.initialized = true;
      
      logger.info('Team estimate configuration initialized successfully');
    } catch (error) {
      logger.error(`Failed to initialize team estimate configuration: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get the complete configuration object.
   * 
   * @returns Complete team estimate configuration
   * @throws Error if configuration has not been initialized
   */
  getConfig(): TeamEstimateConfiguration {
    this.ensureInitialized();
    return { ...this.config! }; // Return a copy to prevent modification
  }

  /**
   * Get the default preset name.
   * 
   * @returns Default preset name
   * @throws Error if configuration has not been initialized
   */
  getDefaultPreset(): string {
    this.ensureInitialized();
    return this.config!.defaultPreset;
  }

  /**
   * Get a preset by name.
   * 
   * @param presetName - Name of the preset to retrieve
   * @returns Preset configuration or undefined if not found
   * @throws Error if configuration has not been initialized
   */
  getPreset(presetName: string) {
    this.ensureInitialized();
    return this.config!.presets[presetName];
  }

  /**
   * Get all teams.
   * 
   * @returns Record of team configurations
   * @throws Error if configuration has not been initialized
   */
  getTeams() {
    this.ensureInitialized();
    return { ...this.config!.teams };
  }

  /**
   * Get a team by ID.
   * 
   * @param teamId - Team ID to retrieve
   * @returns Team configuration or undefined if not found
   * @throws Error if configuration has not been initialized
   */
  getTeam(teamId: string) {
    this.ensureInitialized();
    return this.config!.teams[teamId];
  }

  /**
   * Get estimation rules.
   * 
   * @returns Estimation rules configuration
   * @throws Error if configuration has not been initialized
   */
  getEstimationRules() {
    this.ensureInitialized();
    return { ...this.config!.estimationRules };
  }

  /**
   * Get task sequencing configuration.
   * 
   * @returns Task sequencing configuration
   * @throws Error if configuration has not been initialized
   */
  getTaskSequencing() {
    this.ensureInitialized();
    return { ...this.config!.taskSequencing };
  }

  /**
   * Get UI settings.
   * 
   * @returns UI settings configuration
   * @throws Error if configuration has not been initialized
   */
  getUISettings() {
    this.ensureInitialized();
    return { ...this.config!.uiSettings };
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
      throw new Error('Team estimate configuration has not been initialized. Call initialize() before accessing configuration.');
    }
  }
}

/**
 * Singleton instance of the team estimate configuration manager.
 * 
 * Usage:
 * ```typescript
 * import { teamEstimateConfig } from './config/team-estimate-config';
 * 
 * // Initialize during application startup
 * teamEstimateConfig.initialize({ configPath: 'team-estimate-config.json' });
 * 
 * // Access configuration values
 * const config = teamEstimateConfig.getConfig();
 * const teams = teamEstimateConfig.getTeams();
 * ```
 */
export const teamEstimateConfig = new TeamEstimateConfigManager();
