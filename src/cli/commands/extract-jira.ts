/**
 * CLI command for JIRA ticket extraction.
 * 
 * Extracts all tickets from a JIRA project and exports them to CSV format.
 * Prompts for JIRA credentials if not provided via config.
 */

import { promptJiraConfig } from '../../utils/prompts';
import { extractJiraTickets, exportTicketsToCsv, exportSprintsToCsv, type JiraConfig } from '../../services/jira-extractor';
import { logger } from '../../utils/logger';
import { existsSync, readFileSync } from 'fs';

export interface ExtractJiraOptions {
  /** Path to JIRA config file (optional) */
  config?: string;
  
  /** Path to output CSV file (default: 'jira-export.csv') */
  output?: string;
  
  /** JIRA configuration (optional, will prompt if not provided) */
  jiraConfig?: JiraConfig;
  
  /** Whether to extract change history for Status, Sprint, Original Estimate, and Story Points */
  includeHistory?: boolean;
}

interface ScheduleConfig {
  // Schedule config interface - fields not used in this command
}

/**
 * Loads JIRA configuration from a JSON file.
 * 
 * @param configPath - Path to config file
 * @returns JIRA configuration object
 */
function loadJiraConfig(configPath: string): JiraConfig {
  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }
  
  try {
    const configContent = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    
    if (!config.jiraPath || !config.jiraEmail || !config.jiraApiToken || !config.projectName) {
      throw new Error('Config file must contain jiraPath, jiraEmail, jiraApiToken, and projectName');
    }
    
    return {
      jiraPath: config.jiraPath,
      jiraEmail: config.jiraEmail,
      jiraApiToken: config.jiraApiToken,
      projectName: config.projectName,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in config file: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Loads schedule configuration from schedule_config.json if it exists.
 */
function loadScheduleConfig(): ScheduleConfig | null {
  const scheduleConfigPath = 'schedule_config.json';
  if (!existsSync(scheduleConfigPath)) {
    return null;
  }
  
  try {
    const configContent = readFileSync(scheduleConfigPath, 'utf-8');
    const config = JSON.parse(configContent) as ScheduleConfig;
    return config;
  } catch (error) {
    logger.warn(`Failed to load schedule config: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Executes the JIRA ticket extraction command.
 * 
 * @param options - Command options
 * @returns Array of extracted tickets
 * @throws Error if extraction fails
 */
export async function extractJira(options: ExtractJiraOptions = {}): Promise<void> {
  let jiraConfig: JiraConfig;
  
  // Load config from file or prompt user
  if (options.jiraConfig) {
    jiraConfig = options.jiraConfig;
  } else if (options.config) {
    jiraConfig = loadJiraConfig(options.config);
  } else {
    // No config provided, prompt user
    jiraConfig = await promptJiraConfig();
  }
  
  // Load schedule config to get JQL (if any)
  const scheduleConfig = loadScheduleConfig();
  const customJql = scheduleConfig?.jql;
  
  try {
    // Extract tickets from JIRA using JQL from schedule config if available
    const tickets = await extractJiraTickets(jiraConfig, options.includeHistory || false, customJql);
    
    if (tickets.length === 0) {
      logger.warn('No tickets found in project');
      return;
    }
    
    // Export to CSV
    const outputPath = options.output || 'outputs/jira-export.csv';
    exportTicketsToCsv(tickets, outputPath, options.includeHistory || false);
    
    // Export sprints to separate CSV
    const sprintsOutputPath = options.output 
      ? options.output.replace('.csv', '-sprints.csv')
      : 'outputs/jira-export-sprints.csv';
    exportSprintsToCsv(tickets, sprintsOutputPath);
    
    logger.info(`\n✅ Successfully extracted ${tickets.length} tickets from project ${jiraConfig.projectName}`);
    logger.info(`📄 Exported to: ${outputPath}`);
    logger.info(`📄 Sprints exported to: ${sprintsOutputPath}`);
    
  } catch (error) {
    logger.error(`JIRA extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}


