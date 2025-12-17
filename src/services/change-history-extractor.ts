/**
 * Change history extractor service.
 * 
 * Extracts change history for Status, Sprint, and Story Points fields
 * from Jira tickets and exports to CSV format.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import type { ChangeHistoryConfig } from '../config/types';

const execAsync = promisify(exec);

/**
 * Represents a single field change in a ticket's changelog.
 */
export interface FieldChange {
  /** Issue key (e.g., "PROJ-123") */
  issueKey: string;
  
  /** Field name (e.g., "Status", "Sprint", "Story Points") */
  fieldName: string;
  
  /** New value after the change */
  value: string;
  
  /** Timestamp when the change occurred (ISO 8601 format) */
  changedAt: string;
  
  /** Display name of the user who made the change */
  changedBy: string;
}

/**
 * Jira ticket information from JQL search.
 */
interface TicketInfo {
  key: string;
}

/**
 * Jira changelog entry structure.
 */
interface ChangelogEntry {
  id: string;
  author: {
    displayName: string;
    accountId?: string;
  };
  created: string;
  items: Array<{
    field: string;
    fieldtype: string;
    fieldId?: string;
    from?: string | null;
    fromString?: string | null;
    to?: string | null;
    toString?: string | null;
  }>;
}

/**
 * Jira issue response with changelog.
 */
interface JiraIssueResponse {
  key: string;
  changelog?: {
    histories?: ChangelogEntry[];
  };
  error?: boolean;
  message?: string;
}

/**
 * Extracts change history for configured fields from Jira tickets.
 * 
 * @param config - Change history configuration
 * @returns Array of field changes
 * @throws Error if extraction fails
 */
export async function extractChangeHistory(
  config: ChangeHistoryConfig
): Promise<FieldChange[]> {
  logger.info('Starting change history extraction...');
  
  try {
    // Step 1: Execute JQL query to get ticket keys
    const ticketKeys = await executeJqlQuery(config.jql);
    logger.info(`Found ${ticketKeys.length} tickets for change history extraction`);
    
    if (ticketKeys.length === 0) {
      logger.warn('No tickets found matching JQL query');
      return [];
    }
    
    // Step 2: Get changelog for each ticket
    const allChanges: FieldChange[] = [];
    
    // Process tickets in batches to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < ticketKeys.length; i += batchSize) {
      const batch = ticketKeys.slice(i, i + batchSize);
      logger.info(`Processing tickets ${i + 1}-${Math.min(i + batchSize, ticketKeys.length)} of ${ticketKeys.length}`);
      
      const batchPromises = batch.map(ticketKey => 
        getTicketChangelog(ticketKey, config.fieldMapping)
      );
      
      const batchResults = await Promise.all(batchPromises);
      allChanges.push(...batchResults.flat());
    }
    
    logger.info(`Extracted ${allChanges.length} field changes from ${ticketKeys.length} tickets`);
    return allChanges;
  } catch (error) {
    logger.error(`Change history extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Executes a JQL query and returns matching ticket keys.
 * 
 * @param jql - JQL query string
 * @returns Array of ticket keys
 * @throws Error if query execution fails
 */
async function executeJqlQuery(jql: string): Promise<string[]> {
  try {
    // Use dmtools to execute JQL query
    const command = `dmtools jira_search_by_jql --data '${JSON.stringify({ searchQueryJQL: jql, fields: ['key'] })}'`;
    
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large result sets
    });
    
    if (stderr && !stderr.includes('warning')) {
      logger.warn(`JQL query stderr: ${stderr}`);
    }
    
    // Parse JSON response
    const response = JSON.parse(stdout);
    
    // Check for error response
    if (response.error) {
      throw new Error(response.message || 'JQL query execution failed');
    }
    
    // Extract ticket keys from response
    // Response format: { issues: [{ key: "PROJ-123", ... }, ...] }
    if (Array.isArray(response)) {
      return response.map((issue: TicketInfo) => issue.key);
    } else if (response.issues && Array.isArray(response.issues)) {
      return response.issues.map((issue: TicketInfo) => issue.key);
    } else if (response.key) {
      // Single ticket response
      return [response.key];
    } else {
      logger.warn('Unexpected JQL response format');
      return [];
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Command failed')) {
      throw new Error(`Failed to execute JQL query: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Gets changelog for a specific ticket and filters for relevant fields.
 * 
 * @param ticketKey - Ticket key (e.g., "PROJ-123")
 * @param fieldMapping - Optional field mapping for custom fields
 * @returns Array of field changes for this ticket
 */
async function getTicketChangelog(
  ticketKey: string,
  fieldMapping?: ChangeHistoryConfig['fieldMapping']
): Promise<FieldChange[]> {
  try {
    // Use dmtools to get ticket with changelog
    // Note: We'll use jira_get_ticket and then get changelog separately if needed
    // First, try to get ticket with expand=changelog
    const command = `dmtools jira_get_ticket --data '${JSON.stringify({ key: ticketKey, expand: 'changelog' })}'`;
    
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 5 * 1024 * 1024, // 5MB buffer
    });
    
    if (stderr && !stderr.includes('warning')) {
      logger.warn(`Changelog extraction stderr for ${ticketKey}: ${stderr}`);
    }
    
    const response: JiraIssueResponse = JSON.parse(stdout);
    
    // Check for error response
    if (response.error) {
      logger.warn(`Failed to get changelog for ${ticketKey}: ${response.message || 'Unknown error'}`);
      return [];
    }
    
    // Extract changelog entries
    const changelog = response.changelog;
    if (!changelog || !changelog.histories || changelog.histories.length === 0) {
      return [];
    }
    
    // Filter and transform changelog entries
    const fieldChanges: FieldChange[] = [];
    
    // Define field identifiers we're interested in
    const statusFieldId = 'status';
    const sprintFieldId = fieldMapping?.sprint || 'customfield_10020'; // Default Sprint field
    const storyPointsFieldId = fieldMapping?.storyPoints || 'customfield_10021'; // Default Story Points field
    
    for (const history of changelog.histories) {
      const changedBy = history.author?.displayName || 'Unknown';
      const changedAt = history.created;
      
      for (const item of history.items) {
        const fieldId = item.fieldId || item.field;
        let fieldName: string | null = null;
        let value: string | null = null;
        
        // Check if this is a field we're interested in
        if (fieldId === statusFieldId || item.field === 'status' || item.field === 'Status') {
          fieldName = 'Status';
          value = item.toString || item.to || '';
        } else if (fieldId === sprintFieldId || item.field === sprintFieldId || item.field === 'Sprint') {
          fieldName = 'Sprint';
          value = item.toString || item.to || '';
        } else if (fieldId === storyPointsFieldId || item.field === storyPointsFieldId || item.field === 'Story Points') {
          fieldName = 'Story Points';
          value = item.toString || item.to || '';
        }
        
        if (fieldName && value !== null) {
          fieldChanges.push({
            issueKey: ticketKey,
            fieldName,
            value,
            changedAt,
            changedBy,
          });
        }
      }
    }
    
    return fieldChanges;
  } catch (error) {
    logger.warn(`Failed to get changelog for ${ticketKey}: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}
