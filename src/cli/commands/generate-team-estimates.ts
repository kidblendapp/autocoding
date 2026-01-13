/**
 * CLI command for team estimate generation.
 * 
 * Generates team-specific estimates from JIRA tickets or CSV files.
 */

import { writeFileSync, existsSync } from 'fs';
import { logger } from '../../utils/logger';
import { teamEstimateConfig } from '../../config/team-estimate-config';
import type { JiraTicket } from '../../services/jira-extractor';
import { extractJiraTickets } from '../../services/jira-extractor';
import { parseCsvFile } from '../../parsers/csv-parser';
import { convertTasksToJiraTickets } from '../../utils/csv-to-jira-converter';
import { processAllStoryEstimates, processEstimatesByEpic } from '../../processors/team-estimate-processor';
import type { StoryEstimateResult, EpicEstimateResult } from '../../models/TeamEstimate';

export interface GenerateTeamEstimatesOptions {
  /** Path to input CSV file (if using CSV) */
  csvInput?: string;
  
  /** JIRA configuration (if using JIRA) */
  jiraConfig?: {
    jiraPath: string;
    jiraEmail: string;
    jiraApiToken: string;
    projectName: string;
    issueTypes?: string[];
  };
  
  /** Path to team estimate config file (default: team-estimate-config.json) */
  configPath?: string;
  
  /** Path to output JSON file */
  outputJson?: string;
  
  /** Path to output CSV file */
  outputCsv?: string;
  
  /** Group by epic (default: false) */
  groupByEpic?: boolean;
  
  /** Hours per story point (default: 8) */
  hoursPerStoryPoint?: number;
  
  /** Filter to only stories (exclude subtasks from input) */
  storiesOnly?: boolean;
}

/**
 * Filters tickets to only include stories.
 * 
 * @param tickets - Array of tickets
 * @returns Array of story tickets
 */
function filterStories(tickets: JiraTicket[]): JiraTicket[] {
  return tickets.filter(ticket => {
    const issueType = ticket.issueType?.toLowerCase() || '';
    return issueType === 'story' || issueType === 'user story';
  });
}

/**
 * Exports team estimates to CSV format.
 * 
 * @param results - Array of story estimate results
 * @param outputPath - Path to output CSV file
 */
function exportToCsv(results: StoryEstimateResult[], outputPath: string): void {
  const headers = [
    'Story Key',
    'Case',
    'Team ID',
    'Team Type',
    'Team Name',
    'Estimate (hours)',
    'Calculation Method',
    'Source',
    'Matching Subtasks Count',
    'Calculation Details',
  ];

  const rows: string[][] = [];

  for (const result of results) {
    for (const estimate of result.teamEstimates) {
      rows.push([
        result.storyKey,
        result.case,
        estimate.teamId,
        estimate.teamType,
        estimate.teamName,
        String(estimate.estimate),
        estimate.calculationMethod,
        estimate.source,
        String(estimate.matchingSubtasksCount || 0),
        estimate.calculationDetails || '',
      ]);
    }
  }

  // Escape CSV values
  const escapeCsv = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(escapeCsv).join(',')),
  ].join('\n');

  writeFileSync(outputPath, csvContent, 'utf-8');
  logger.info(`Exported team estimates to CSV: ${outputPath}`);
}

/**
 * Exports epic estimates to CSV format.
 * 
 * @param results - Array of epic estimate results
 * @param outputPath - Path to output CSV file
 */
function exportEpicEstimatesToCsv(results: EpicEstimateResult[], outputPath: string): void {
  const headers = [
    'Epic Key',
    'Story Key',
    'Case',
    'Team ID',
    'Team Type',
    'Team Name',
    'Estimate (hours)',
    'Calculation Method',
    'Source',
    'Matching Subtasks Count',
  ];

  const rows: string[][] = [];

  for (const epicResult of results) {
    for (const storyResult of epicResult.storyResults) {
      for (const estimate of storyResult.teamEstimates) {
        rows.push([
          epicResult.epicKey,
          storyResult.storyKey,
          storyResult.case,
          estimate.teamId,
          estimate.teamType,
          estimate.teamName,
          String(estimate.estimate),
          estimate.calculationMethod,
          estimate.source,
          String(estimate.matchingSubtasksCount || 0),
        ]);
      }
    }
  }

  // Escape CSV values
  const escapeCsv = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(escapeCsv).join(',')),
  ].join('\n');

  writeFileSync(outputPath, csvContent, 'utf-8');
  logger.info(`Exported epic team estimates to CSV: ${outputPath}`);
}

/**
 * Generates team estimates from JIRA or CSV input.
 * 
 * @param options - Command options
 * @throws Error if generation fails
 */
export async function generateTeamEstimates(
  options: GenerateTeamEstimatesOptions = {}
): Promise<void> {
  try {
    // Initialize team estimate configuration
    const configPath = options.configPath || 'team-estimate-config.json';
    if (!existsSync(configPath)) {
      throw new Error(`Team estimate configuration file not found: ${configPath}`);
    }

    teamEstimateConfig.initialize({ configPath });
    const config = teamEstimateConfig.getConfig();

    logger.info('Team estimate configuration loaded successfully');

    // Load tickets from JIRA or CSV
    let tickets: JiraTicket[] = [];

    if (options.csvInput) {
      logger.info(`Loading tickets from CSV: ${options.csvInput}`);
      const parseResult = parseCsvFile(options.csvInput);
      tickets = convertTasksToJiraTickets(parseResult.tasks);
      logger.info(`Loaded ${tickets.length} tickets from CSV`);
    } else if (options.jiraConfig) {
      logger.info(`Extracting tickets from JIRA project: ${options.jiraConfig.projectName}`);
      tickets = await extractJiraTickets(options.jiraConfig, false);
      logger.info(`Extracted ${tickets.length} tickets from JIRA`);
    } else {
      throw new Error('Either csvInput or jiraConfig must be provided');
    }

    // Filter to stories only if requested
    if (options.storiesOnly) {
      tickets = filterStories(tickets);
      logger.info(`Filtered to ${tickets.length} stories`);
    }

    const hoursPerStoryPoint = options.hoursPerStoryPoint || 8;

    // Process estimates
    let results: StoryEstimateResult[] | EpicEstimateResult[];

    if (options.groupByEpic) {
      logger.info('Processing estimates grouped by epic');
      results = processEstimatesByEpic(tickets, tickets, config, hoursPerStoryPoint);
      logger.info(`Processed ${results.length} epics`);
    } else {
      logger.info('Processing estimates for all stories');
      results = processAllStoryEstimates(tickets, tickets, config, hoursPerStoryPoint);
      logger.info(`Processed ${results.length} stories`);
    }

    // Export to JSON
    if (options.outputJson) {
      const jsonContent = JSON.stringify(results, null, 2);
      writeFileSync(options.outputJson, jsonContent, 'utf-8');
      logger.info(`Exported team estimates to JSON: ${options.outputJson}`);
    }

    // Export to CSV
    if (options.outputCsv) {
      if (options.groupByEpic) {
        exportEpicEstimatesToCsv(results as EpicEstimateResult[], options.outputCsv);
      } else {
        exportToCsv(results as StoryEstimateResult[], options.outputCsv);
      }
    }

    // Summary
    if (options.groupByEpic) {
      const epicResults = results as EpicEstimateResult[];
      const totalStories = epicResults.reduce((sum, r) => sum + r.totalStories, 0);
      logger.info(`✅ Team estimates generated: ${epicResults.length} epics, ${totalStories} stories`);
    } else {
      const storyResults = results as StoryEstimateResult[];
      logger.info(`✅ Team estimates generated: ${storyResults.length} stories`);
    }

  } catch (error) {
    logger.error(`Team estimate generation failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
