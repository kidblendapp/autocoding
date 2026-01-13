/**
 * Story management API routes
 * Handles story decomposition, estimation, and dependency management
 */

import express from 'express';
import { logger } from '../../utils/logger';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';
import { processStoryEstimates } from '../../processors/team-estimate-processor';
import type { JiraTicket } from '../../services/jira-extractor';
import { teamEstimateConfig } from '../../config/team-estimate-config';
import type { TeamEstimateConfiguration } from '../../config/team-estimate-types';
import type { StoryEstimateResult } from '../../models/TeamEstimate';

const router = express.Router();
const DEPENDENCIES_FILE = join(process.cwd(), 'dependencies.json');

/**
 * Exports decomposed story results to CSV format
 */
function exportDecomposedStoriesToCsv(
  results: (StoryEstimateResult & { storySummary?: string })[],
  outputPath: string
): void {
  const headers = [
    'Story Key',
    'Story Summary',
    'Case',
    'Team ID',
    'Team Name',
    'Role',
    'Estimate (hours)',
    'Execution Order',
    'Statuses',
    'Execution Team',
  ];

  const rows: string[][] = [];

  for (const result of results) {
    if ('error' in result) {
      // Skip error results
      continue;
    }
    
    for (const estimate of result.sequencedEstimates || result.teamEstimates) {
      // Handle both TeamEstimate and SequencedEstimate types
      const sequencedEstimate = estimate as any; // Type assertion to access optional properties
      rows.push([
        result.storyKey,
        result.storySummary || '',
        result.case,
        estimate.teamId,
        estimate.teamName,
        sequencedEstimate.role || '',
        String(estimate.estimate),
        sequencedEstimate.executionOrder ? String(sequencedEstimate.executionOrder) : '',
        Array.isArray(sequencedEstimate.statuses) ? sequencedEstimate.statuses.join('; ') : '',
        sequencedEstimate.executionTeam || '',
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
  logger.info(`Exported ${rows.length} decomposed story estimates to CSV: ${outputPath}`);
}

/**
 * Helper function to parse CSV and convert to JiraTicket format
 */
function parseCsvToTickets(csvPath: string): JiraTicket[] {
  const csvContent = readFileSync(csvPath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as any[];
  
  return records.map((row): JiraTicket => {
    // Try multiple possible column name variations
    const getValue = (keys: string[]) => {
      for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
          return row[key];
        }
      }
      return undefined;
    };
    
    const storyPointsStr = getValue(['Story Points', 'StoryPoints', 'storyPoints']);
    const originalEstimateStr = getValue(['Original Estimate', 'OriginalEstimate', 'originalEstimate']);
    
    return {
      key: getValue(['Issue Key', 'Key', 'issueKey']) || '',
      summary: getValue(['Summary', 'summary']) || '',
      issueType: getValue(['Issue Type', 'IssueType', 'issueType']) || '',
      status: getValue(['Status', 'status']) || '',
      team: getValue(['Jira Team', 'Team', 'team']) || '',
      assignee: getValue(['Assignee', 'assignee']) || '',
      reporter: getValue(['Reporter', 'reporter']) || '',
      priority: getValue(['Priority', 'priority']) || '',
      storyPoints: storyPointsStr ? parseFloat(String(storyPointsStr)) : undefined,
      originalEstimate: originalEstimateStr ? parseFloat(String(originalEstimateStr)) : undefined,
      component: getValue(['Component', 'component']) || '',
      parentId: getValue(['Parent Id', 'ParentId', 'parentId']) || '',
      epicLink: getValue(['Epic Link', 'EpicLink', 'epicLink']) || '',
      created: getValue(['Created', 'created']) || '',
      updated: getValue(['Updated', 'updated']) || '',
      labels: getValue(['Labels', 'labels']) || '',
      fixVersions: getValue(['Fix Versions', 'FixVersions', 'fixVersions']) || '',
    };
  }).filter(ticket => ticket.key);
}

/**
 * POST /api/stories/decompose
 * Decompose and estimate stories according to config
 */
router.post('/decompose', async (req, res) => {
  try {
    const { inputFile, hoursPerStoryPoint = 8 } = req.body;
    
    if (!inputFile) {
      return res.status(400).json({ error: 'inputFile is required' });
    }
    
    const csvPath = join(process.cwd(), inputFile);
    if (!existsSync(csvPath)) {
      return res.status(404).json({ error: `CSV file not found: ${inputFile}` });
    }
    
    // Load team estimate config
    teamEstimateConfig.initialize();
    const config: TeamEstimateConfiguration = teamEstimateConfig.getConfig();
    
    // Load schedule config to get estimateType and planning filters
    const scheduleConfigPath = join(process.cwd(), 'schedule_config.json');
    let estimateType: 'storyPoints' | 'hours' = 'storyPoints';
    let planningIssueTypes: string[] | undefined;
    let planningFixVersions: string[] | undefined;
    
    if (existsSync(scheduleConfigPath)) {
      try {
        const scheduleConfig = JSON.parse(readFileSync(scheduleConfigPath, 'utf-8'));
        if (scheduleConfig.estimateType === 'hours' || scheduleConfig.estimateType === 'storyPoints') {
          estimateType = scheduleConfig.estimateType;
        }
        // Use planning settings
        planningIssueTypes = scheduleConfig.planningIssueTypes;
        planningFixVersions = scheduleConfig.planningFixVersions;
      } catch (error) {
        logger.warn(`Failed to load schedule config: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Parse CSV to tickets
    const allTickets = parseCsvToTickets(csvPath);
    
    // Apply planning filters if specified
    let filteredTickets = allTickets;
    if (planningIssueTypes && planningIssueTypes.length > 0) {
      filteredTickets = filteredTickets.filter(t => 
        t.issueType && planningIssueTypes!.includes(t.issueType)
      );
      logger.info(`Filtered to ${filteredTickets.length} tickets matching planning issue types: ${planningIssueTypes.join(', ')}`);
    }
    if (planningFixVersions && planningFixVersions.length > 0) {
      filteredTickets = filteredTickets.filter(t => {
        if (!t.fixVersions) return false;
        const ticketFixVersions = t.fixVersions.split(',').map(v => v.trim());
        return planningFixVersions!.some(fv => ticketFixVersions.includes(fv));
      });
      logger.info(`Filtered to ${filteredTickets.length} tickets matching planning fix versions: ${planningFixVersions.join(', ')}`);
    }
    
    const stories = filteredTickets.filter(t => 
      t.issueType?.toLowerCase().includes('story') || 
      t.issueType?.toLowerCase().includes('task')
    );
    
    logger.info(`Processing ${stories.length} stories from ${inputFile} with estimateType: ${estimateType}`);
    
    // Process each story
    const results: (StoryEstimateResult & { storySummary?: string })[] = stories.map(story => {
      try {
        const result = processStoryEstimates(
          story,
          allTickets,
          config,
          hoursPerStoryPoint,
          estimateType
        );
        // Add story summary to result for frontend display
        return {
          ...result,
          storySummary: story.summary || '',
        };
      } catch (error) {
        logger.error(`Error processing story ${story.key}: ${error instanceof Error ? error.message : String(error)}`);
        return {
          storyKey: story.key,
          storySummary: story.summary || '',
          case: 'error' as const,
          teamEstimates: [],
          sequencedEstimates: [],
          error: error instanceof Error ? error.message : String(error)
        } as any;
      }
    });
    
    // Save results to CSV
    const outputsDir = join(process.cwd(), 'outputs');
    try {
      mkdirSync(outputsDir, { recursive: true });
    } catch (err) {
      // Directory might already exist, ignore
    }
    
    const csvOutputPath = join(outputsDir, 'decomposed-stories.csv');
    exportDecomposedStoriesToCsv(results, csvOutputPath);
    logger.info(`Saved decomposed stories to ${csvOutputPath}`);
    
    res.json({
      success: true,
      message: `Successfully processed ${results.length} stories`,
      results,
      totalStories: results.length,
      successfulStories: results.filter(r => !('error' in r)).length,
      outputPath: 'outputs/decomposed-stories.csv'
    });
  } catch (error) {
    logger.error(`Error decomposing stories: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: 'Failed to decompose stories',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Load dependencies from file
 */
function loadDependencies(): Record<string, any> {
  if (!existsSync(DEPENDENCIES_FILE)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(DEPENDENCIES_FILE, 'utf-8'));
  } catch (error) {
    logger.warn(`Error loading dependencies: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}

/**
 * Save dependencies to file
 */
function saveDependencies(dependencies: Record<string, any>) {
  writeFileSync(DEPENDENCIES_FILE, JSON.stringify(dependencies, null, 2), 'utf-8');
}

/**
 * POST /api/stories/dependencies
 * Manage dependencies (blocks/has to be done before links)
 */
router.post('/dependencies', (req, res) => {
  try {
    const { storyKey, dependencies } = req.body;
    
    if (!storyKey) {
      return res.status(400).json({ error: 'storyKey is required' });
    }
    
    const allDependencies = loadDependencies();
    allDependencies[storyKey] = dependencies || [];
    saveDependencies(allDependencies);
    
    logger.info(`Updated dependencies for ${storyKey}`);
    
    res.json({
      success: true,
      message: 'Dependencies saved successfully',
      dependencies: allDependencies[storyKey]
    });
  } catch (error) {
    logger.error(`Error managing dependencies: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: 'Failed to manage dependencies',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/stories/dependencies
 * Get all dependencies
 */
router.get('/dependencies', (req, res) => {
  try {
    const dependencies = loadDependencies();
    res.json({
      success: true,
      dependencies
    });
  } catch (error) {
    logger.error(`Error fetching dependencies: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: 'Failed to fetch dependencies',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/stories/:key/dependencies
 * Get dependencies for a story
 */
router.get('/:key/dependencies', (req, res) => {
  try {
    const { key } = req.params;
    const allDependencies = loadDependencies();
    const storyDeps = allDependencies[key] || [];
    
    // Separate by type
    const blocks = storyDeps.filter((d: any) => d.type === 'blocks').map((d: any) => d.target);
    const blockedBy = storyDeps.filter((d: any) => d.type === 'blockedBy').map((d: any) => d.target);
    const precedes = storyDeps.filter((d: any) => d.type === 'precedes').map((d: any) => d.target);
    
    res.json({
      success: true,
      storyKey: key,
      dependencies: storyDeps,
      blocks,
      blockedBy,
      precedes
    });
  } catch (error) {
    logger.error(`Error fetching dependencies for ${req.params.key}: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: 'Failed to fetch dependencies',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
