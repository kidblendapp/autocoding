/**
 * Standalone script to extract JIRA tickets with estimates.
 * 
 * Usage: npx ts-node extract-jira-estimates.ts
 */

import { extractJiraTickets, exportTicketsToCsv, exportSprintsToCsv, type JiraConfig } from './src/services/jira-extractor';
import { logger } from './src/utils/logger';
import { existsSync, readFileSync } from 'fs';

/**
 * Loads JIRA configuration from a JSON file.
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
 * Main execution function.
 */
async function main() {
  try {
    // Check for --history flag
    const includeHistory = process.argv.includes('--history');
    
    console.log('Starting JIRA extraction...');
    if (includeHistory) {
      console.log('Change history extraction enabled for Status, Sprint, Original Estimate, and Story Points');
    }
    
    // Load config from jira-config.json
    const configPath = 'jira-config.json';
    const jiraConfig = loadJiraConfig(configPath);
    
    console.log(`Extracting all tickets from project: ${jiraConfig.projectName}`);
    logger.info(`Extracting tickets from project: ${jiraConfig.projectName}`);
    
    // Extract all tickets from JIRA
    const tickets = await extractJiraTickets(jiraConfig, includeHistory);
    
    console.log(`Extracted ${tickets.length} tickets`);
    
    if (tickets.length === 0) {
      logger.warn('No tickets found in project');
      console.log('No tickets found in project');
      process.exit(0);
    }
    
    // Export to CSV
    const outputPath = 'outputs/jira-export.csv';
    exportTicketsToCsv(tickets, outputPath, includeHistory);
    
    // Export sprints to separate CSV
    const sprintsOutputPath = 'outputs/jira-export-sprints.csv';
    exportSprintsToCsv(tickets, sprintsOutputPath);
    
    console.log(`\n✅ Successfully extracted ${tickets.length} tickets from project ${jiraConfig.projectName}`);
    console.log(`📄 Exported to: ${outputPath}`);
    console.log(`📄 Sprints exported to: ${sprintsOutputPath}`);
    logger.info(`\n✅ Successfully extracted ${tickets.length} tickets from project ${jiraConfig.projectName}`);
    logger.info(`📄 Exported to: ${outputPath}`);
    logger.info(`📄 Sprints exported to: ${sprintsOutputPath}`);
    
    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ JIRA extraction failed: ${errorMessage}`);
    logger.error(`JIRA extraction failed: ${errorMessage}`);
    process.exit(1);
  }
}

// Run the script
main();

