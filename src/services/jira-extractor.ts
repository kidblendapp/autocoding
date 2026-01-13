/**
 * JIRA ticket extraction service.
 * 
 * Extracts all tickets from a JIRA project using JIRA REST API.
 */

import { logger } from '../utils/logger';
import { writeFileSync } from 'fs';
import { getCustomFieldId, mergeCustomFieldMapping } from '../config/custom-field-defaults';

/**
 * Custom field mapping configuration for JIRA fields.
 */
export interface CustomFieldMapping {
  /** Custom field ID for Team (e.g., "customfield_10001") */
  team?: string;
  /** Custom field ID for Story Points (e.g., "customfield_10052") */
  storyPoints?: string;
  /** Custom field ID for Original Estimate (e.g., "customfield_10410") */
  originalEstimate?: string;
  /** Custom field ID for Epic Link (e.g., "customfield_10008") */
  epicLink?: string;
  /** Custom field ID for Sprint (e.g., "customfield_10010") */
  sprint?: string;
  /** Custom field ID for Date field (e.g., "customfield_10098") */
  dateField?: string;
  /** Custom field ID for DateTime field (e.g., "customfield_10012") */
  dateTimeField?: string;
}

export interface JiraConfig {
  jiraPath: string;
  jiraEmail: string;
  jiraApiToken: string;
  projectName: string;
  /** Custom field ID mapping for JIRA fields */
  customFieldMapping?: CustomFieldMapping;
  /** Display names for custom fields (maps field ID to human-readable name) */
  customFieldNames?: Record<string, string>;
}

export interface FieldHistory {
  value: string;
  changedAt: string;
  changedBy: string;
}

export interface Sprint {
  id: number;
  name: string;
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  state?: string;
  boardId?: number;
  goal?: string;
}

export interface JiraTicket {
  key: string;
  summary: string;
  issueType?: string;
  status?: string;
  team?: string;
  assignee?: string;
  reporter?: string;
  creator?: string;
  priority?: string;
  storyPoints?: number;
  originalEstimate?: number;
  timeEstimate?: string;
  component?: string;
  parentId?: string;
  epicLink?: string;
  created?: string;
  updated?: string;
  resolutionDate?: string;
  dueDate?: string;
  resolution?: string;
  statusCategory?: string;
  labels?: string;
  fixVersions?: string;
  versions?: string;
  sprint?: string; // Legacy: comma-separated sprint names
  sprints?: Sprint[]; // Full sprint objects
  // History fields (only populated when includeHistory is true)
  statusHistory?: FieldHistory[];
  sprintHistory?: FieldHistory[];
  originalEstimateHistory?: FieldHistory[];
  storyPointsHistory?: FieldHistory[];
}

/**
 * Creates Basic Auth header for JIRA API requests.
 * 
 * @param email - JIRA email
 * @param apiToken - JIRA API token
 * @returns Base64 encoded authorization header
 */
function createAuthHeader(email: string, apiToken: string): string {
  const credentials = Buffer.from(`${email}:${apiToken}`).toString('base64');
  return `Basic ${credentials}`;
}

/**
 * Extracts change history for specific fields from a JIRA ticket.
 * 
 * @param baseUrl - JIRA base URL
 * @param authHeader - Authorization header
 * @param ticketKey - Ticket key (e.g., "PSME-160")
 * @returns Object with history arrays for each tracked field
 */
async function getTicketHistory(
  baseUrl: string,
  authHeader: string,
  ticketKey: string,
  config: JiraConfig
): Promise<{
  statusHistory: FieldHistory[];
  sprintHistory: FieldHistory[];
  originalEstimateHistory: FieldHistory[];
  storyPointsHistory: FieldHistory[];
}> {
  const statusHistory: FieldHistory[] = [];
  const sprintHistory: FieldHistory[] = [];
  const originalEstimateHistory: FieldHistory[] = [];
  const storyPointsHistory: FieldHistory[] = [];
  
  // Get custom field IDs from config
  const sprintFieldId = getCustomFieldId('sprint', config);
  const storyPointsFieldId = getCustomFieldId('storyPoints', config);
  const originalEstimateFieldId = getCustomFieldId('originalEstimate', config);

  try {
    // Get ticket with changelog
    const apiUrl = `${baseUrl}/rest/api/3/issue/${ticketKey}?expand=changelog`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      logger.warn(`Failed to get changelog for ${ticketKey}: ${response.status}`);
      return { statusHistory, sprintHistory, originalEstimateHistory, storyPointsHistory };
    }

    const data = await response.json();
    const changelog = data.changelog;

    if (!changelog || !changelog.histories || !Array.isArray(changelog.histories)) {
      return { statusHistory, sprintHistory, originalEstimateHistory, storyPointsHistory };
    }

    // Process each history entry
    for (const history of changelog.histories) {
      const changedBy = history.author?.displayName || history.author?.emailAddress || 'Unknown';
      const changedAt = history.created;

      if (!history.items || !Array.isArray(history.items)) {
        continue;
      }

      for (const item of history.items) {
        const fieldId = item.fieldId || item.field;
        const fieldName = item.field;

        // Status history
        if (fieldId === 'status' || fieldName === 'status' || fieldName === 'Status') {
          const value = item.toString || item.to || '';
          if (value) {
            statusHistory.push({ value, changedAt, changedBy });
          }
        }
        // Sprint history
        const sprintFieldId = getCustomFieldId('sprint', config);
        if (sprintFieldId && (fieldId === sprintFieldId || fieldName === 'Sprint')) {
          const value = item.toString || item.to || '';
          if (value) {
            sprintHistory.push({ value, changedAt, changedBy });
          }
        }
        // Original Estimate history (timeoriginalestimate or custom field)
        const originalEstimateFieldId = getCustomFieldId('originalEstimate', config);
        if (fieldId === 'timeoriginalestimate' || fieldName === 'Original Estimate' || fieldName === 'timeoriginalestimate' ||
            (originalEstimateFieldId && fieldId === originalEstimateFieldId)) {
          const value = item.toString || item.to || '';
          if (value) {
            originalEstimateHistory.push({ value, changedAt, changedBy });
          }
        }
        // Story Points history
        const storyPointsFieldId = getCustomFieldId('storyPoints', config);
        if (storyPointsFieldId && (fieldId === storyPointsFieldId || fieldName === 'Story Points')) {
          const value = item.toString || item.to || '';
          if (value) {
            storyPointsHistory.push({ value, changedAt, changedBy });
          }
        }
      }
    }
  } catch (error) {
    logger.warn(`Error extracting history for ${ticketKey}: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { statusHistory, sprintHistory, originalEstimateHistory, storyPointsHistory };
}

/**
 * Builds a base JQL query using only the project name.
 * All filtering should be done via custom JQL in schedule_config.json.
 * 
 * @param config - JIRA configuration
 * @returns Base JQL query string
 */
function buildBaseJql(config: JiraConfig): string {
  return `project = ${config.projectName} ORDER BY key ASC`;
}

/**
 * Extracts all tickets from a JIRA project.
 * 
 * @param config - JIRA configuration
 * @param includeHistory - Whether to extract change history for Status, Sprint, Original Estimate, and Story Points
 * @param customJql - Optional custom JQL query. If provided, this will be used instead of building from config filters
 * @returns Array of JIRA tickets
 * @throws Error if extraction fails
 */
export async function extractJiraTickets(config: JiraConfig, includeHistory: boolean = false, customJql?: string): Promise<JiraTicket[]> {
  logger.info(`Extracting tickets from project: ${config.projectName}`);
  
  try {
    // Use custom JQL if provided, otherwise build base query from project name
    const baseJql = customJql && customJql.trim() 
      ? customJql.trim()
      : buildBaseJql(config);
    
    if (customJql && customJql.trim()) {
      logger.info(`Using custom JQL: ${baseJql}`);
    } else {
      logger.info(`Using base JQL for project: ${baseJql}`);
    }
    
    logger.info(`Executing JQL query: ${baseJql}`);
    
    // Get custom field IDs from config or defaults
    const fieldMapping = mergeCustomFieldMapping(config.customFieldMapping);
    const teamFieldId = getCustomFieldId('team', config);
    const storyPointsFieldId = getCustomFieldId('storyPoints', config);
    const originalEstimateFieldId = getCustomFieldId('originalEstimate', config);
    const epicLinkFieldId = getCustomFieldId('epicLink', config);
    const sprintFieldId = getCustomFieldId('sprint', config);
    const dateFieldId = getCustomFieldId('dateField', config);
    const dateTimeFieldId = getCustomFieldId('dateTimeField', config);
    
    // Prepare fields to fetch - comprehensive list based on PSME-160 inspection
    const fields = [
      'key',
      'summary',
      'issuetype',
      'status',
      'statusCategory',
      teamFieldId, // Team
      'assignee',
      'reporter',
      'creator',
      'priority',
      'components',
      'parent',
      'issuelinks', // Issue link relationships (for finding Feature parents)
      'labels',
      'fixVersions',
      'versions',
      'created',
      'updated',
      'resolutiondate',
      'duedate',
      'resolution',
      'timeoriginalestimate',
      'timeestimate',
      'timetracking',
      // Custom fields
      storyPointsFieldId, // Story Points
      originalEstimateFieldId, // Original Estimate
      epicLinkFieldId, // Epic Link
      sprintFieldId, // Sprint
      dateFieldId, // Date field
      dateTimeFieldId, // DateTime field
    ].filter(Boolean) as string[]; // Remove undefined values
    
    // Build API URL - using /rest/api/3/search/jql (new endpoint, but limited pagination)
    const baseUrl = config.jiraPath.replace(/\/$/, ''); // Remove trailing slash
    const apiUrl = `${baseUrl}/rest/api/3/search/jql`;
    
    // Create authorization header
    const authHeader = createAuthHeader(config.jiraEmail, config.jiraApiToken);
    
    // Fetch all tickets with pagination using last key from previous batch
    // This allows continuing past gaps in sequential key numbering
    let allIssues: any[] = [];
    const maxResults = 100; // JIRA API max is 100 per request
    let batchNumber = 0;
    let hasMore = true;
    let lastKey: string | null = null; // Track the last key from previous batch
    
    while (hasMore) {
      // Build JQL with key range for pagination
      let batchJql: string;
      if (batchNumber === 0) {
        // First batch: use base JQL query
        batchJql = baseJql;
      } else {
        // Subsequent batches: use last key from previous batch to continue
        if (!lastKey) {
          // Should not happen, but break if no last key
          hasMore = false;
          break;
        }
        
        // Build base query without ORDER BY for combining
        // All filtering should be done via custom JQL in schedule_config.json
        const baseQuery = `project = ${config.projectName}`;
        
        // Use last key to continue pagination past gaps
        batchJql = `${baseQuery} AND issueKey > "${lastKey}" ORDER BY key ASC`;
      }
      
      const requestBody: any = {
        jql: batchJql,
        maxResults: maxResults,
      };
      
      // Add fields as an array
      if (fields && fields.length > 0) {
        requestBody.fields = fields;
      }
      
      logger.info(`Fetching batch ${batchNumber + 1}${lastKey ? ` (after ${lastKey})` : ' (first batch)'}...`);
      logger.info(`JQL: ${batchJql}`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`JIRA API request failed: ${response.status} ${response.statusText}. ${errorText}`);
      }
      
      const data = await response.json();
    
      // Check for JIRA API errors
      if (data.errorMessages && data.errorMessages.length > 0) {
        throw new Error(`JIRA API error: ${data.errorMessages.join(', ')}`);
    }
    
      // Extract issues from response
      const returned = data.issues?.length || 0;
      if (data.issues && Array.isArray(data.issues)) {
        allIssues = allIssues.concat(data.issues);
        
        // Update lastKey to the last issue key in this batch
        if (returned > 0) {
          const lastIssue = data.issues[returned - 1];
          lastKey = lastIssue.key || null;
        }
      }
      
      const total = data.total || 0;
      logger.info(`Fetched ${returned} tickets (${allIssues.length} total so far${total > 0 ? `, ${total} total available` : ''})`);
      
      // Continue pagination until no tickets are returned or we got fewer than maxResults
      if (returned === 0) {
        // No results in this batch, we've reached the end
        logger.info('Empty batch encountered. Stopping pagination.');
        hasMore = false;
      } else if (returned < maxResults) {
        // Got fewer than maxResults, this is likely the last batch
        hasMore = false;
      } else {
        // Got full batch, continue to next batch
        batchNumber++;
      }
      
      // Safety limit to prevent infinite loops
      if (batchNumber >= 1000) {
        logger.warn('Reached batch limit (1000). There may be more tickets.');
        break;
      }
    }
    
    logger.info(`Found ${allIssues.length} tickets`);
    
    // Transform issues to JiraTicket format
    let tickets: JiraTicket[] = allIssues.map((issue: any) => {
      const fields = issue.fields || {};
      
      // Extract assignee name or email
      let assignee: string | undefined;
      if (fields.assignee) {
        assignee = fields.assignee.displayName || fields.assignee.emailAddress || fields.assignee.name;
      }
      
      // Extract components
      let component: string | undefined;
      if (fields.components && fields.components.length > 0) {
        component = fields.components.map((c: any) => c.name).join(', ');
      }
      
      // Extract Team
      let team: string | undefined;
      const teamFieldId = getCustomFieldId('team', config);
      if (teamFieldId) {
        const teamField = (fields as any)[teamFieldId];
        if (teamField) {
          if (Array.isArray(teamField)) {
            if (teamField.length > 0) {
              team = teamField
                .map((t: any) => t?.title || t?.name || t?.displayName || String(t))
                .join(', ');
            }
          } else if (typeof teamField === 'object') {
            team = teamField.title || teamField.name || teamField.displayName;
          } else {
            team = String(teamField);
          }
        }
      }
      
      // Extract story points
      let storyPoints: number | undefined;
      const storyPointsFieldId = getCustomFieldId('storyPoints', config);
      if (storyPointsFieldId && fields[storyPointsFieldId] !== null && fields[storyPointsFieldId] !== undefined) {
        storyPoints = Number(fields[storyPointsFieldId]);
      }
      
      // Extract original estimate (numeric value, no conversion)
      let originalEstimate: number | undefined;
      const originalEstimateFieldId = getCustomFieldId('originalEstimate', config);
      if (originalEstimateFieldId && fields[originalEstimateFieldId] !== null && fields[originalEstimateFieldId] !== undefined) {
        const value = Number(fields[originalEstimateFieldId]);
        if (!isNaN(value) && value > 0) {
          originalEstimate = value;
        }
      }
      // Fallback to timeoriginalestimate if custom field is not available
      else if (fields.timeoriginalestimate !== null && fields.timeoriginalestimate !== undefined) {
        const value = Number(fields.timeoriginalestimate);
        if (!isNaN(value) && value > 0) {
          originalEstimate = value;
        }
      }
      
      // Extract parent ID
      // Priority: Check for Feature type inwardIssue links first, then fall back to parent field
      let parentId: string | undefined;
      
      // Check for Feature type inwardIssue links (e.g., "Work item split" relationships)
      if (fields.issuelinks && Array.isArray(fields.issuelinks)) {
        for (const link of fields.issuelinks) {
          if (link.inwardIssue && link.inwardIssue.fields && link.inwardIssue.fields.issuetype) {
            const issueTypeName = link.inwardIssue.fields.issuetype.name;
            if (issueTypeName === 'Feature') {
              parentId = link.inwardIssue.key;
              break; // Use first Feature found
            }
          }
        }
      }
      
      // Fall back to parent field if no Feature link found
      if (!parentId && fields.parent) {
        parentId = fields.parent.key;
      }
      
      // Extract epic link
      let epicLink: string | undefined;
      const epicLinkFieldId = getCustomFieldId('epicLink', config);
      if (epicLinkFieldId && fields[epicLinkFieldId]) {
        const epicField = fields[epicLinkFieldId];
        if (typeof epicField === 'string') {
          epicLink = epicField;
        } else if (epicField.key) {
          epicLink = epicField.key;
        } else if (epicField.toString) {
          epicLink = epicField.toString();
        }
      }
      
      // Extract reporter
      let reporter: string | undefined;
      if (fields.reporter) {
        reporter = fields.reporter.displayName || fields.reporter.emailAddress || fields.reporter.name;
      }
      
      // Extract creator
      let creator: string | undefined;
      if (fields.creator) {
        creator = fields.creator.displayName || fields.creator.emailAddress || fields.creator.name;
      }
      
      // Extract priority
      let priority: string | undefined;
      if (fields.priority) {
        priority = fields.priority.name;
      }
      
      // Extract time estimate (in seconds, convert to hours)
      let timeEstimate: string | undefined;
      if (fields.timeestimate) {
        const hours = Math.round(fields.timeestimate / 3600);
        timeEstimate = `${hours}h`;
      }
      
      // Extract labels
      let labels: string | undefined;
      if (fields.labels && Array.isArray(fields.labels) && fields.labels.length > 0) {
        labels = fields.labels.join(', ');
      }
      
      // Extract fix versions
      let fixVersions: string | undefined;
      if (fields.fixVersions && Array.isArray(fields.fixVersions) && fields.fixVersions.length > 0) {
        fixVersions = fields.fixVersions.map((v: any) => v.name).join(', ');
      }
      
      // Extract versions
      let versions: string | undefined;
      if (fields.versions && Array.isArray(fields.versions) && fields.versions.length > 0) {
        versions = fields.versions.map((v: any) => v.name).join(', ');
      }
      
      // Extract sprint (legacy: comma-separated names)
      let sprint: string | undefined;
      let sprints: Sprint[] | undefined;
      const sprintFieldId = getCustomFieldId('sprint', config);
      if (sprintFieldId && fields[sprintFieldId] && Array.isArray(fields[sprintFieldId]) && fields[sprintFieldId].length > 0) {
        const sprintField = fields[sprintFieldId] as any[];
        sprint = sprintField.map((s: any) => s.name).join(', ');
        // Extract full sprint objects
        sprints = sprintField.map((s: any) => ({
          id: s.id,
          name: s.name || '',
          startDate: s.startDate,
          endDate: s.endDate,
          completeDate: s.completeDate,
          state: s.state,
          boardId: s.boardId,
          goal: s.goal,
        }));
      }
      
      return {
        key: issue.key,
        summary: fields.summary || '',
        issueType: fields.issuetype?.name,
        status: fields.status?.name,
        team,
        statusCategory: fields.statusCategory?.name,
        assignee,
        reporter,
        creator,
        priority,
        storyPoints,
        originalEstimate,
        timeEstimate,
        component,
        parentId,
        epicLink,
        created: fields.created,
        updated: fields.updated,
        resolutionDate: fields.resolutiondate,
        dueDate: fields.duedate,
        resolution: fields.resolution?.name,
        labels,
        fixVersions,
        versions,
        sprint,
        sprints,
      };
    });

    // If history is requested, fetch changelog for each ticket
    if (includeHistory) {
      logger.info('Extracting change history for Status, Sprint, Original Estimate, and Story Points...');
      
      // Process in batches to avoid overwhelming the API
      const batchSize = 10;
      for (let i = 0; i < tickets.length; i += batchSize) {
        const batch = tickets.slice(i, i + batchSize);
        logger.info(`Fetching history for tickets ${i + 1}-${Math.min(i + batchSize, tickets.length)} of ${tickets.length}...`);
        
        const batchPromises = batch.map(async (ticket) => {
          const history = await getTicketHistory(baseUrl, authHeader, ticket.key, config);
          return {
            ...ticket,
            statusHistory: history.statusHistory,
            sprintHistory: history.sprintHistory,
            originalEstimateHistory: history.originalEstimateHistory,
            storyPointsHistory: history.storyPointsHistory,
          };
        });
        
        const batchResults = await Promise.all(batchPromises);
        tickets = [
          ...tickets.slice(0, i),
          ...batchResults,
          ...tickets.slice(i + batchSize),
        ];
      }
      
      logger.info('Change history extraction completed');
    }
    
    logger.info(`Successfully extracted ${tickets.length} tickets`);
    return tickets;
    
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to extract JIRA tickets: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Exports JIRA tickets to CSV format.
 * 
 * @param tickets - Array of JIRA tickets
 * @param outputPath - Path to output CSV file
 * @param includeHistory - Whether to include history columns in CSV
 */
export function exportTicketsToCsv(tickets: JiraTicket[], outputPath: string, includeHistory: boolean = false): void {
  // CSV header - comprehensive list
  const headers = [
    'Issue Key',
    'Summary',
    'Issue Type',
    'Status',
    'Status Category',
    'Priority',
    'Assignee',
    'Team',
    'Reporter',
    'Creator',
    'Story Points',
    'Original Estimate',
    'Time Estimate',
    'Component',
    'Parent Id',
    'Epic Link',
    'Labels',
    'Fix Versions',
    'Versions',
    'Sprint',
    'Created',
    'Updated',
    'Resolution Date',
    'Due Date',
    'Resolution',
  ];

  // Add history columns if history is included
  if (includeHistory) {
    headers.push(
      'Status History',
      'Sprint History',
      'Original Estimate History',
      'Story Points History'
    );
  }
  
  // Build CSV content
  const rows = tickets.map((ticket) => {
    // Escape CSV values (handle quotes and commas)
    const escapeCsv = (value: string | number | undefined): string => {
      if (value === null || value === undefined) {
        return '';
      }
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    
    const row: string[] = [
      escapeCsv(ticket.key),
      escapeCsv(ticket.summary),
      escapeCsv(ticket.issueType),
      escapeCsv(ticket.status),
      escapeCsv(ticket.statusCategory),
      escapeCsv(ticket.priority),
      escapeCsv(ticket.assignee),
      escapeCsv(ticket.team),
      escapeCsv(ticket.reporter),
      escapeCsv(ticket.creator),
      escapeCsv(ticket.storyPoints),
      escapeCsv(ticket.originalEstimate),
      escapeCsv(ticket.timeEstimate),
      escapeCsv(ticket.component),
      escapeCsv(ticket.parentId),
      escapeCsv(ticket.epicLink),
      escapeCsv(ticket.labels),
      escapeCsv(ticket.fixVersions),
      escapeCsv(ticket.versions),
      escapeCsv(ticket.sprint),
      escapeCsv(ticket.created),
      escapeCsv(ticket.updated),
      escapeCsv(ticket.resolutionDate),
      escapeCsv(ticket.dueDate),
      escapeCsv(ticket.resolution),
    ];

    // Add history columns if history is included
    if (includeHistory) {
      // Format history as: "value1 (by user1 on date1); value2 (by user2 on date2)"
      const formatHistory = (history: FieldHistory[] | undefined): string => {
        if (!history || history.length === 0) {
          return '';
        }
        return history.map(h => {
          const date = new Date(h.changedAt).toLocaleDateString();
          return `${h.value} (by ${h.changedBy} on ${date})`;
        }).join('; ');
      };

      row.push(
        escapeCsv(formatHistory(ticket.statusHistory)),
        escapeCsv(formatHistory(ticket.sprintHistory)),
        escapeCsv(formatHistory(ticket.originalEstimateHistory)),
        escapeCsv(formatHistory(ticket.storyPointsHistory))
      );
    }

    return row.join(',');
  });
  
  const csvContent = [headers.join(','), ...rows].join('\n');
  
  // Write to file
  writeFileSync(outputPath, csvContent, 'utf-8');
  logger.info(`Exported ${tickets.length} tickets to ${outputPath}`);
}

/**
 * Exports unique sprints to a separate CSV file.
 * 
 * @param tickets - Array of JIRA tickets
 * @param outputPath - Path to output CSV file
 */
export function exportSprintsToCsv(tickets: JiraTicket[], outputPath: string): void {
  // Collect all unique sprints
  const sprintMap = new Map<number, Sprint>();
  
  for (const ticket of tickets) {
    if (ticket.sprints && Array.isArray(ticket.sprints)) {
      for (const sprint of ticket.sprints) {
        if (sprint.id && !sprintMap.has(sprint.id)) {
          sprintMap.set(sprint.id, sprint);
        }
      }
    }
  }
  
  const uniqueSprints = Array.from(sprintMap.values());
  
  if (uniqueSprints.length === 0) {
    logger.warn('No sprints found to export');
    return;
  }
  
  // CSV header
  const headers = [
    'Id',
    'Name',
    'Start Date',
    'End Date',
    'Complete Date',
  ];
  
  // Build CSV content
  const rows = uniqueSprints.map((sprint) => {
    // Escape CSV values (handle quotes and commas)
    const escapeCsv = (value: string | number | undefined): string => {
      if (value === null || value === undefined) {
        return '';
      }
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    
    return [
      escapeCsv(sprint.id),
      escapeCsv(sprint.name),
      escapeCsv(sprint.startDate),
      escapeCsv(sprint.endDate),
      escapeCsv(sprint.completeDate),
    ].join(',');
  });
  
  const csvContent = [headers.join(','), ...rows].join('\n');
  
  // Write to file
  writeFileSync(outputPath, csvContent, 'utf-8');
  logger.info(`Exported ${uniqueSprints.length} unique sprints to ${outputPath}`);
}

