/**
 * Configuration API routes
 * Handles loading and saving of schedule_config.json and jira-config.json
 */

import express from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../../utils/logger';

const router = express.Router();

const SCHEDULE_CONFIG_PATH = join(process.cwd(), 'schedule_config.json');
const JIRA_CONFIG_PATH = join(process.cwd(), 'jira-config.json');
const EXTRACTED_VALUES_PATH = join(process.cwd(), 'extracted-values.json');

/**
 * Extracted field values from JIRA (stored in extracted-values.json)
 */
export interface ExtractedValues {
  issueTypes?: string[];
  fixVersions?: string[];
  linkTypes?: string[];
  teams?: string[];
  components?: string[];
  statuses?: string[];
  lastExtracted?: string;
  projectName?: string;
}

/**
 * Normalizes JQL by ensuring it ends with "ORDER BY key ASC" for proper pagination.
 * @param jql - JQL query string (optional)
 * @returns Normalized JQL with ORDER BY clause, or undefined if input was empty/undefined
 */
function normalizeJql(jql?: string): string | undefined {
  // Return as-is if undefined, null, or empty
  if (jql === undefined || jql === null) {
    return jql;
  }
  
  const trimmed = jql.trim();
  if (trimmed.length === 0) {
    return jql; // Return original (empty string)
  }
  
  const orderByPattern = /ORDER\s+BY\s+key\s+ASC$/i;
  
  if (orderByPattern.test(trimmed)) {
    return trimmed; // Already has ORDER BY clause
  }
  
  // Append ORDER BY clause
  const normalized = `${trimmed} ORDER BY key ASC`;
  logger.info(`JQL normalized: added "ORDER BY key ASC" to query`);
  return normalized;
}

/**
 * Converts old ganttGrouping format to new ganttGroupingLevels format.
 */
function migrateGroupingConfig(config: any): any {
  if (config.ganttGrouping && !config.ganttGroupingLevels) {
    const mapping: Record<string, string[]> = {
      'epicSprint': ['epic', 'sprint'],
      'sprintTeam': ['sprint', 'team'],
      'sprintEpic': ['sprint', 'epic'],
      'epicTeam': ['epic', 'team'],
      'teamSprint': ['team', 'sprint'],
      'teamEpic': ['team', 'epic'],
    };
    
    const levels = mapping[config.ganttGrouping];
    if (levels) {
      config.ganttGroupingLevels = levels;
      logger.info(`Migrated ganttGrouping "${config.ganttGrouping}" to ganttGroupingLevels: ${levels.join(', ')}`);
    }
  }
  return config;
}

/**
 * GET /api/config/schedule
 * Load schedule_config.json
 */
router.get('/schedule', (req, res) => {
  try {
    if (!existsSync(SCHEDULE_CONFIG_PATH)) {
      return res.status(404).json({ error: 'schedule_config.json not found' });
    }
    
    const config = JSON.parse(readFileSync(SCHEDULE_CONFIG_PATH, 'utf-8'));
    const migratedConfig = migrateGroupingConfig(config);
    res.json(migratedConfig);
  } catch (error) {
    logger.error(`Error loading schedule config: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: 'Failed to load schedule config',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * PUT /api/config/schedule
 * Save schedule_config.json
 */
router.put('/schedule', (req, res) => {
  try {
    const config = req.body;
    
    // Basic validation
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'Invalid config data' });
    }
    
    // Normalize JQL before saving
    if (config.jql !== undefined) {
      const originalJql = config.jql;
      config.jql = normalizeJql(config.jql);
      if (originalJql !== config.jql && config.jql) {
        logger.info('JQL was automatically normalized to include "ORDER BY key ASC"');
      }
    }
    
    writeFileSync(SCHEDULE_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    logger.info('Schedule config saved successfully');
    res.json({ success: true, message: 'Schedule config saved successfully' });
  } catch (error) {
    logger.error(`Error saving schedule config: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: 'Failed to save schedule config',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/config/jira
 * Load jira-config.json
 */
router.get('/jira', (req, res) => {
  try {
    // Log the path being checked for debugging
    logger.info(`Loading JIRA config from: ${JIRA_CONFIG_PATH}`);
    logger.info(`Current working directory: ${process.cwd()}`);
    
    if (!existsSync(JIRA_CONFIG_PATH)) {
      logger.error(`JIRA config file not found at: ${JIRA_CONFIG_PATH}`);
      return res.status(404).json({ 
        error: 'jira-config.json not found',
        path: JIRA_CONFIG_PATH,
        cwd: process.cwd()
      });
    }
    
    // Read file with error handling
    let fileContent: string;
    try {
      fileContent = readFileSync(JIRA_CONFIG_PATH, 'utf-8');
      // Remove BOM if present
      if (fileContent.charCodeAt(0) === 0xFEFF) {
        fileContent = fileContent.slice(1);
      }
    } catch (readError) {
      logger.error(`Error reading JIRA config file: ${readError instanceof Error ? readError.message : String(readError)}`);
      throw new Error(`Failed to read file: ${readError instanceof Error ? readError.message : String(readError)}`);
    }
    
    // Parse JSON with better error handling
    let config: any;
    try {
      config = JSON.parse(fileContent);
    } catch (parseError) {
      logger.error(`Error parsing JIRA config JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      throw new Error(`Invalid JSON in config file: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }
    
    // Validate required fields
    if (!config || typeof config !== 'object') {
      throw new Error('Config file does not contain a valid object');
    }
    
    // Don't expose API token in response for security - mask it
    const safeConfig = {
      ...config,
      jiraApiToken: config.jiraApiToken ? '***hidden***' : undefined
    };
    res.json(safeConfig);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error(`Error loading JIRA config: ${errorMessage}`, { stack: errorStack, path: JIRA_CONFIG_PATH });
    res.status(500).json({ 
      error: 'Failed to load JIRA config',
      message: errorMessage,
      path: JIRA_CONFIG_PATH,
      cwd: process.cwd()
    });
  }
});

/**
 * PUT /api/config/jira
 * Save jira-config.json
 */
router.put('/jira', (req, res) => {
  try {
    const config = req.body;
    
    // Basic validation
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'Invalid config data' });
    }
    
    if (!config.jiraPath || !config.jiraEmail || !config.jiraApiToken || !config.projectName) {
      return res.status(400).json({ 
        error: 'Missing required fields: jiraPath, jiraEmail, jiraApiToken, projectName' 
      });
    }
    
    writeFileSync(JIRA_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    logger.info('JIRA config saved successfully');
    res.json({ success: true, message: 'JIRA config saved successfully' });
  } catch (error) {
    logger.error(`Error saving JIRA config: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: 'Failed to save JIRA config',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/config/validate
 * Validate configuration
 */
router.get('/validate', (req, res) => {
  try {
    const errors: string[] = [];
    
    // Validate schedule config
    if (existsSync(SCHEDULE_CONFIG_PATH)) {
      try {
        const scheduleConfig = JSON.parse(readFileSync(SCHEDULE_CONFIG_PATH, 'utf-8'));
        if (!scheduleConfig.projectStartDate) {
          errors.push('schedule_config.json: missing projectStartDate');
        }
        if (!scheduleConfig.sprintDurationDays || scheduleConfig.sprintDurationDays <= 0) {
          errors.push('schedule_config.json: invalid sprintDurationDays');
        }
      } catch (e) {
        errors.push(`schedule_config.json: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    
    // Validate JIRA config
    if (existsSync(JIRA_CONFIG_PATH)) {
      try {
        const jiraConfig = JSON.parse(readFileSync(JIRA_CONFIG_PATH, 'utf-8'));
        if (!jiraConfig.jiraPath || !jiraConfig.jiraEmail || !jiraConfig.jiraApiToken || !jiraConfig.projectName) {
          errors.push('jira-config.json: missing required fields');
        }
      } catch (e) {
        errors.push(`jira-config.json: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    
    res.json({
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    logger.error(`Error validating config: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: 'Failed to validate config',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/config/extracted-values
 * Get previously extracted field values from extracted-values.json
 */
router.get('/extracted-values', (req, res) => {
  try {
    if (!existsSync(EXTRACTED_VALUES_PATH)) {
      return res.status(404).json({ error: 'extracted-values.json not found' });
    }
    
    const values = JSON.parse(readFileSync(EXTRACTED_VALUES_PATH, 'utf-8'));
    res.json(values);
  } catch (error) {
    logger.error(`Error loading extracted values: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: 'Failed to load extracted values',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * PUT /api/config/extracted-values
 * Store extracted field values to extracted-values.json
 */
router.put('/extracted-values', (req, res) => {
  try {
    const values: ExtractedValues = req.body;
    
    // Basic validation
    if (!values || typeof values !== 'object') {
      return res.status(400).json({ error: 'Invalid extracted values data' });
    }
    
    writeFileSync(EXTRACTED_VALUES_PATH, JSON.stringify(values, null, 2), 'utf-8');
    logger.info('Extracted values saved successfully');
    res.json({ success: true, message: 'Extracted values saved successfully' });
  } catch (error) {
    logger.error(`Error saving extracted values: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: 'Failed to save extracted values',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * DELETE /api/config/extracted-values
 * Clear extracted values (when project changes)
 */
router.delete('/extracted-values', (req, res) => {
  try {
    if (existsSync(EXTRACTED_VALUES_PATH)) {
      writeFileSync(EXTRACTED_VALUES_PATH, JSON.stringify({}, null, 2), 'utf-8');
      logger.info('Extracted values cleared successfully');
    }
    res.json({ success: true, message: 'Extracted values cleared successfully' });
  } catch (error) {
    logger.error(`Error clearing extracted values: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: 'Failed to clear extracted values',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
