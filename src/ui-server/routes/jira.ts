/**
 * JIRA operations API routes
 * Handles JIRA ticket extraction and field inspection
 */

import express from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../../utils/logger';
import { extractJiraTickets, type JiraConfig } from '../../services/jira-extractor';

const router = express.Router();

const JIRA_CONFIG_PATH = join(process.cwd(), 'jira-config.json');
const SCHEDULE_CONFIG_PATH = join(process.cwd(), 'schedule_config.json');

/**
 * Load JIRA configuration
 */
function loadJiraConfig(): JiraConfig {
  if (!existsSync(JIRA_CONFIG_PATH)) {
    throw new Error('jira-config.json not found');
  }
  
  const config = JSON.parse(readFileSync(JIRA_CONFIG_PATH, 'utf-8'));
  
  if (!config.jiraPath || !config.jiraEmail || !config.jiraApiToken || !config.projectName) {
    throw new Error('Missing required JIRA config fields');
  }
  
  return config;
}

/**
 * Load schedule configuration to get JQL
 */
function loadScheduleConfig(): { jql?: string } {
  if (!existsSync(SCHEDULE_CONFIG_PATH)) {
    return {};
  }
  
  try {
    const config = JSON.parse(readFileSync(SCHEDULE_CONFIG_PATH, 'utf-8'));
    return { jql: config.jql };
  } catch (error) {
    logger.warn(`Failed to load schedule config: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}

/**
 * Build JQL query for ticket search
 */
function buildJql(jiraConfig: JiraConfig, customJql?: string): string {
  if (customJql && customJql.trim()) {
    return customJql.trim();
  }
  return `project = ${jiraConfig.projectName}`;
}

/**
 * POST /api/jira/extract
 * Extract all tickets from JIRA
 */
router.post('/extract', async (req, res) => {
  try {
    const { includeHistory = false } = req.body;
    
    const config = loadJiraConfig();
    
    logger.info('Starting JIRA ticket extraction...');
    const tickets = await extractJiraTickets(config, includeHistory);
    
    logger.info(`Extracted ${tickets.length} tickets`);
    
    res.json({
      success: true,
      ticketCount: tickets.length,
      tickets: tickets.slice(0, 100), // Return first 100 for preview
      message: `Successfully extracted ${tickets.length} tickets`
    });
  } catch (error) {
    logger.error(`Error extracting JIRA tickets: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: 'Failed to extract JIRA tickets',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/jira/ticket/:key
 * Get all fields for a specific ticket (for custom field inspection)
 */
router.get('/ticket/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const config = loadJiraConfig();
    
    // Use JIRA REST API to get ticket with all fields
    const authHeader = Buffer.from(`${config.jiraEmail}:${config.jiraApiToken}`).toString('base64');
    const url = `${config.jiraPath}/rest/api/3/issue/${key}?expand=names`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`JIRA API error: ${response.status} ${errorText}`);
    }
    
    const issue = await response.json();
    
    res.json({
      success: true,
      key: issue.key,
      fields: issue.fields,
      fieldNames: issue.names || {},
      summary: issue.fields?.summary
    });
  } catch (error) {
    logger.error(`Error fetching ticket ${req.params.key}: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: 'Failed to fetch ticket',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/jira/ticket/:key/fields
 * Get raw field structure for custom field configuration
 */
router.get('/ticket/:key/fields', async (req, res) => {
  try {
    const { key } = req.params;
    const config = loadJiraConfig();
    
    // Get ticket with all fields and field metadata
    const authHeader = Buffer.from(`${config.jiraEmail}:${config.jiraApiToken}`).toString('base64');
    const url = `${config.jiraPath}/rest/api/3/issue/${key}?expand=names,schema`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`JIRA API error: ${response.status} ${errorText}`);
    }
    
    const issue = await response.json();
    
    // Extract custom fields
    const customFields: Record<string, any> = {};
    const fieldNames = issue.names || {};
    
    for (const [fieldId, fieldValue] of Object.entries(issue.fields || {})) {
      if (fieldId.startsWith('customfield_')) {
        customFields[fieldId] = {
          id: fieldId,
          name: fieldNames[fieldId] || fieldId,
          value: fieldValue,
          type: typeof fieldValue
        };
      }
    }
    
    res.json({
      success: true,
      key: issue.key,
      allFields: issue.fields,
      fieldNames: fieldNames,
      customFields: customFields,
      schema: issue.schema || {}
    });
  } catch (error) {
    logger.error(`Error fetching ticket fields ${req.params.key}: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: 'Failed to fetch ticket fields',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/jira/field-values/:field
 * Extract possible values for a field (issue types, fix versions, link types)
 */
router.get('/field-values/:field', async (req, res) => {
  try {
    const { field } = req.params;
    const config = loadJiraConfig();
    
    const authHeader = Buffer.from(`${config.jiraEmail}:${config.jiraApiToken}`).toString('base64');
    let values: string[] = [];
    
    if (field === 'issueTypes') {
      // Query actual tickets using project/JQL to get unique issue types
      const scheduleConfig = loadScheduleConfig();
      const jql = buildJql(config, scheduleConfig.jql);
      
      const baseUrl = config.jiraPath.replace(/\/$/, '');
      const url = `${baseUrl}/rest/api/3/search/jql`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jql: jql,
          maxResults: 1000,
          fields: ['issuetype']
        })
      });
      
      if (!response.ok) {
        throw new Error(`JIRA API error: ${response.status}`);
      }
      
      const searchResult = await response.json();
      const issueTypeSet = new Set<string>();
      if (searchResult.issues) {
        searchResult.issues.forEach((issue: any) => {
          if (issue.fields?.issuetype?.name) {
            issueTypeSet.add(issue.fields.issuetype.name);
          }
        });
      }
      values = Array.from(issueTypeSet);
    } else if (field === 'fixVersions') {
      // Get fix versions from project
      const url = `${config.jiraPath}/rest/api/3/project/${config.projectName}/versions`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`JIRA API error: ${response.status}`);
      }
      
      const versions = await response.json();
      values = versions.map((v: any) => v.name || v.id).filter(Boolean);
    } else if (field === 'linkTypes') {
      // Get issue link types
      const url = `${config.jiraPath}/rest/api/3/issueLinkType`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`JIRA API error: ${response.status}`);
      }
      
      const linkTypes = await response.json();
      // Extract both inward and outward link type names
      const allTypes = new Set<string>();
      if (linkTypes.issueLinkTypes) {
        linkTypes.issueLinkTypes.forEach((lt: any) => {
          if (lt.inward) allTypes.add(lt.inward);
          if (lt.outward) allTypes.add(lt.outward);
        });
      }
      values = Array.from(allTypes);
    } else if (field === 'teams' || field === 'components' || field === 'statuses') {
      // Query actual tickets to extract teams, components, or statuses
      const scheduleConfig = loadScheduleConfig();
      const jql = buildJql(config, scheduleConfig.jql);
      
      const fieldsToFetch = field === 'teams' 
        ? ['customfield_10001'] 
        : field === 'components' 
        ? ['components'] 
        : ['status'];
      const baseUrl = config.jiraPath.replace(/\/$/, '');
      const url = `${baseUrl}/rest/api/3/search/jql`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jql: jql,
          maxResults: 1000,
          fields: fieldsToFetch
        })
      });
      
      if (!response.ok) {
        throw new Error(`JIRA API error: ${response.status}`);
      }
      
      const searchResult = await response.json();
      const valueSet = new Set<string>();
      
      if (searchResult.issues) {
        searchResult.issues.forEach((issue: any) => {
          if (field === 'teams') {
            // Extract from Team field - check customfield_10001 first (the actual field ID)
            const teamValue = issue.fields?.customfield_10001 || issue.fields?.Team || issue.fields?.customfield_Team || issue.fields?.team;
            if (teamValue) {
              if (typeof teamValue === 'string') {
                valueSet.add(teamValue);
              } else if (Array.isArray(teamValue)) {
                teamValue.forEach((v: any) => {
                  if (typeof v === 'string') valueSet.add(v);
                  else if (v?.name) valueSet.add(v.name);
                });
              } else if (teamValue?.name) {
                valueSet.add(teamValue.name);
              }
            }
          } else if (field === 'components') {
            if (issue.fields?.components && Array.isArray(issue.fields.components)) {
              issue.fields.components.forEach((comp: any) => {
                if (comp?.name) valueSet.add(comp.name);
              });
            }
          } else if (field === 'statuses') {
            if (issue.fields?.status?.name) {
              valueSet.add(issue.fields.status.name);
            }
          }
        });
      }
      values = Array.from(valueSet);
    } else {
      return res.status(400).json({ error: `Unknown field: ${field}` });
    }
    
    res.json({
      success: true,
      field,
      values: values.sort()
    });
  } catch (error) {
    logger.error(`Error extracting field values for ${req.params.field}: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: 'Failed to extract field values',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/jira/extract-all-fields
 * Extract all field values at once (issue types, fix versions, link types, teams, components, statuses)
 */
router.post('/extract-all-fields', async (req, res) => {
  try {
    const config = loadJiraConfig();
    const scheduleConfig = loadScheduleConfig();
    const jql = buildJql(config, scheduleConfig.jql);
    
    // Check if project changed - clear old values if so
    const extractedValuesPath = join(process.cwd(), 'extracted-values.json');
    if (existsSync(extractedValuesPath)) {
      try {
        const existingValues = JSON.parse(readFileSync(extractedValuesPath, 'utf-8'));
        if (existingValues.projectName && existingValues.projectName !== config.projectName) {
          // Project changed, clear old values
          writeFileSync(extractedValuesPath, JSON.stringify({}, null, 2), 'utf-8');
          logger.info(`Project changed from ${existingValues.projectName} to ${config.projectName}, cleared extracted values`);
        }
      } catch (error) {
        // Ignore errors reading existing file
      }
    }
    
    const authHeader = Buffer.from(`${config.jiraEmail}:${config.jiraApiToken}`).toString('base64');
    
    const baseUrl = config.jiraPath.replace(/\/$/, '');
    
    // Extract all values in parallel
    const [issueTypesResult, fixVersionsResult, linkTypesResult, ticketsResult] = await Promise.all([
      // Issue types from actual tickets
      fetch(`${baseUrl}/rest/api/3/search/jql`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jql: jql,
          maxResults: 1000,
          fields: ['issuetype']
        })
      }),
      // Fix versions from project
      fetch(`${baseUrl}/rest/api/3/project/${config.projectName}/versions`, {
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Accept': 'application/json'
        }
      }),
      // Link types
      fetch(`${baseUrl}/rest/api/3/issueLinkType`, {
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Accept': 'application/json'
        }
      }),
      // All tickets for teams, components, statuses
      // Use customfield_10001 for Team field (as used in jira-extractor.ts)
      fetch(`${baseUrl}/rest/api/3/search/jql`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jql: jql,
          maxResults: 1000,
          fields: ['customfield_10001', 'components', 'status']
        })
      })
    ]);
    
    // Check each response individually and provide detailed error messages
    const errors: string[] = [];
    if (!issueTypesResult.ok) {
      const errorData = await issueTypesResult.json().catch(() => ({}));
      errors.push(`Issue types: ${errorData.errorMessages?.join(', ') || issueTypesResult.statusText || 'Unknown error'}`);
    }
    if (!fixVersionsResult.ok) {
      const errorData = await fixVersionsResult.json().catch(() => ({}));
      errors.push(`Fix versions: ${errorData.errorMessages?.join(', ') || fixVersionsResult.statusText || 'Unknown error'}`);
    }
    if (!linkTypesResult.ok) {
      const errorData = await linkTypesResult.json().catch(() => ({}));
      errors.push(`Link types: ${errorData.errorMessages?.join(', ') || linkTypesResult.statusText || 'Unknown error'}`);
    }
    if (!ticketsResult.ok) {
      const errorData = await ticketsResult.json().catch(() => ({}));
      errors.push(`Tickets: ${errorData.errorMessages?.join(', ') || ticketsResult.statusText || 'Unknown error'}`);
    }
    
    if (errors.length > 0) {
      throw new Error(`Failed to fetch data from JIRA: ${errors.join('; ')}`);
    }
    
    // Process issue types
    const issueTypesData = await issueTypesResult.json();
    const issueTypeSet = new Set<string>();
    if (issueTypesData.issues) {
      issueTypesData.issues.forEach((issue: any) => {
        if (issue.fields?.issuetype?.name) {
          issueTypeSet.add(issue.fields.issuetype.name);
        }
      });
    }
    const issueTypes = Array.from(issueTypeSet).sort();
    
    // Process fix versions
    const fixVersionsData = await fixVersionsResult.json();
    const fixVersions = fixVersionsData.map((v: any) => v.name || v.id).filter(Boolean).sort();
    
    // Process link types
    const linkTypesData = await linkTypesResult.json();
    const linkTypeSet = new Set<string>();
    if (linkTypesData.issueLinkTypes) {
      linkTypesData.issueLinkTypes.forEach((lt: any) => {
        if (lt.inward) linkTypeSet.add(lt.inward);
        if (lt.outward) linkTypeSet.add(lt.outward);
      });
    }
    const linkTypes = Array.from(linkTypeSet).sort();
    
    // Process teams, components, statuses from tickets
    const ticketsData = await ticketsResult.json();
    const teamsSet = new Set<string>();
    const componentsSet = new Set<string>();
    const statusesSet = new Set<string>();
    
    if (ticketsData.issues) {
      ticketsData.issues.forEach((issue: any) => {
        // Teams - check customfield_10001 first (the actual field ID)
        const teamValue = issue.fields?.customfield_10001 || issue.fields?.Team || issue.fields?.customfield_Team || issue.fields?.team;
        if (teamValue) {
          if (typeof teamValue === 'string') {
            teamsSet.add(teamValue);
          } else if (Array.isArray(teamValue)) {
            teamValue.forEach((v: any) => {
              if (typeof v === 'string') teamsSet.add(v);
              else if (v?.name) teamsSet.add(v.name);
            });
          } else if (teamValue?.name) {
            teamsSet.add(teamValue.name);
          }
        }
        
        // Components
        if (issue.fields?.components && Array.isArray(issue.fields.components)) {
          issue.fields.components.forEach((comp: any) => {
            if (comp?.name) componentsSet.add(comp.name);
          });
        }
        
        // Statuses
        if (issue.fields?.status?.name) {
          statusesSet.add(issue.fields.status.name);
        }
      });
    }
    
    const teams = Array.from(teamsSet).sort();
    const components = Array.from(componentsSet).sort();
    const statuses = Array.from(statusesSet).sort();
    
    // Store extracted values
    const extractedValues = {
      issueTypes,
      fixVersions,
      linkTypes,
      teams,
      components,
      statuses,
      lastExtracted: new Date().toISOString(),
      projectName: config.projectName
    };
    
    // Save to extracted-values.json (reuse path declared at top of function)
    writeFileSync(extractedValuesPath, JSON.stringify(extractedValues, null, 2), 'utf-8');
    
    logger.info(`Extracted all field values for project ${config.projectName}`);
    
    res.json({
      success: true,
      ...extractedValues,
      message: 'All field values extracted and saved successfully'
    });
  } catch (error) {
    logger.error(`Error extracting all fields: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: 'Failed to extract all fields',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
