/**
 * Fetch Subtasks and Blocking Issues to Input Folder Pre-Action
 * Fetches all child tickets (subtasks) and blocking issues (via "is blocked by" links)
 * and writes them to the input folder before AI processing begins.
 * This ensures subtasks and blocking issues are always available
 * even if ticketContextDepth doesn't work as expected.
 * 
 * Also checks for WIP label and stops processing if found.
 */

/**
 * Format ticket data as markdown for input folder
 * 
 * @param {Object} ticket - Jira ticket object
 * @returns {string} Formatted markdown content
 */
function formatTicketAsMarkdown(ticket) {
    if (!ticket || !ticket.key) {
        return '';
    }
    
    const fields = ticket.fields || {};
    const key = ticket.key;
    const summary = fields.summary || 'No summary';
    const description = fields.description || 'No description';
    const status = fields.status ? fields.status.name : 'Unknown';
    const labels = fields.labels || [];
    const diagrams = fields.Diagrams || fields.diagrams || '';
    
    let markdown = `# ${key}: ${summary}\n\n`;
    markdown += `**Status:** ${status}\n`;
    
    if (labels.length > 0) {
        markdown += `**Labels:** ${labels.join(', ')}\n`;
    }
    
    markdown += `\n## Description\n\n${description}\n\n`;
    
    // Add Diagrams field if available
    if (diagrams) {
        markdown += `## Diagrams\n\n${diagrams}\n\n`;
    }
    
    // Add comments if available (with author)
    if (fields.comment && fields.comment.comments && fields.comment.comments.length > 0) {
        markdown += `## Comments\n\n`;
        fields.comment.comments.forEach(function(comment) {
            const author = comment.author ? comment.author.displayName : 'Unknown';
            const body = comment.body || '';
            markdown += `### ${author}${comment.created ? ' (' + comment.created + ')' : ''}\n\n${body}\n\n`;
        });
    }
    
    return markdown;
}

/**
 * Check for WIP label
 * 
 * @param {Object} params - Parameters from Teammate job
 * @returns {boolean} true to continue, false to stop
 */
function checkWipLabel(params) {
    try {
        const ticket = params.ticket;
        const metadata = params.metadata;
        
        if (!ticket || !metadata || !metadata.contextId) {
            return true; // Continue if no contextId
        }
        
        const wipLabel = metadata.contextId + '_wip';
        const ticketKey = ticket.key;
        const labels = ticket.fields && ticket.fields.labels ? ticket.fields.labels : [];
        
        if (labels.includes(wipLabel)) {
            console.log('⏸️  Ticket ' + ticketKey + ' has WIP label "' + wipLabel + '" - skipping processing');
            
            try {
                jira_post_comment({
                    key: ticketKey,
                    comment: 'h3. *Processing Skipped*\n\n' +
                            'This ticket has the *' + wipLabel + '* label indicating work is in progress.\n' +
                            'Processing will be skipped until the label is removed.\n\n' +
                            '_Remove the label to allow automated processing._'
                });
            } catch (commentError) {
                console.warn('Failed to post skip comment:', commentError);
            }
            
            return false; // Stop processing
        }
        
        return true; // Continue processing
    } catch (error) {
        console.warn('Error in WIP label check:', error);
        return true; // Continue on error
    }
}

/**
 * Fetch subtasks and write to input folder
 * 
 * @param {Object} params - Parameters from Teammate job
 * @returns {boolean} true to continue processing, false to stop
 */
function action(params) {
    try {
        // First check WIP label
        if (!checkWipLabel(params)) {
            return false; // Stop processing if WIP label found
        }
        
        const ticket = params.ticket;
        if (!ticket || !ticket.key) {
            console.log('No ticket key found, skipping subtask fetch');
            return true; // Continue processing
        }
        
        const parentKey = ticket.key;
        console.log('Fetching subtasks and blocking issues for ticket: ' + parentKey);
        
        // Search for all subtasks using JQL
        let subtasks = [];
        try {
            const searchResult = jira_search_by_jql({
                jql: 'parent = ' + parentKey,
                fields: ['key', 'summary', 'description', 'status', 'labels', 'Diagrams', 'comment']
            });
            
            if (searchResult && searchResult.issues) {
                subtasks = searchResult.issues;
            } else if (searchResult && Array.isArray(searchResult)) {
                // Handle case where result is directly an array
                subtasks = searchResult;
            }
        } catch (error) {
            console.warn('Failed to fetch subtasks via JQL search:', error);
            // Continue processing even if subtask fetch fails
        }
        
        // Fetch blocking issues (issues that this ticket is blocked by)
        let blockingIssueKeys = [];
        try {
            // Get full ticket with issue links to find blocking issues
            const fullTicket = jira_get_ticket({
                key: parentKey,
                fields: ['issuelinks']
            });
            
            if (fullTicket && fullTicket.fields && fullTicket.fields.issuelinks) {
                const issueLinks = fullTicket.fields.issuelinks || [];
                
                // Find "is blocked by" links (inward links)
                // In Jira API: if link has inwardIssue and type.inward = "is blocked by", 
                // then the current ticket is blocked by inwardIssue
                issueLinks.forEach(function(link) {
                    if (link.inwardIssue && link.type && link.type.inward) {
                        // Check if this is an "is blocked by" relationship
                        if (link.type.inward.toLowerCase().includes('blocked by') || 
                            link.type.inward === 'is blocked by') {
                            blockingIssueKeys.push(link.inwardIssue.key);
                        }
                    }
                });
                
                if (blockingIssueKeys.length > 0) {
                    console.log('Found ' + blockingIssueKeys.length + ' blocking issue key(s): ' + blockingIssueKeys.join(', '));
                }
            }
        } catch (error) {
            console.warn('Failed to fetch blocking issue links:', error);
            // Continue processing even if blocking issue fetch fails
        }
        
        // Fetch full details of blocking issues
        let blockingIssues = [];
        if (blockingIssueKeys.length > 0) {
            try {
                const blockingKeys = blockingIssueKeys.join(', ');
                const blockingSearchResult = jira_search_by_jql({
                    jql: 'key IN (' + blockingKeys + ')',
                    fields: ['key', 'summary', 'description', 'status', 'labels', 'Diagrams', 'comment']
                });
                
                if (blockingSearchResult && blockingSearchResult.issues) {
                    blockingIssues = blockingSearchResult.issues;
                } else if (blockingSearchResult && Array.isArray(blockingSearchResult)) {
                    blockingIssues = blockingSearchResult;
                }
                
                if (blockingIssues.length > 0) {
                    console.log('Successfully fetched ' + blockingIssues.length + ' blocking issue(s)');
                }
            } catch (error) {
                console.warn('Failed to fetch blocking issue details:', error);
                // Continue processing even if blocking issue fetch fails
            }
        }
        
        // Combine subtasks and blocking issues
        const allRelatedIssues = subtasks.concat(blockingIssues);
        
        if (allRelatedIssues.length === 0) {
            console.log('No subtasks or blocking issues found for ' + parentKey);
            return true; // Continue processing
        }
        
        console.log('Found ' + subtasks.length + ' subtask(s) and ' + blockingIssues.length + ' blocking issue(s) for ' + parentKey);
        
        // Write each related issue to input folder
        let writtenCount = 0;
        allRelatedIssues.forEach(function(relatedIssue) {
            try {
                const issueKey = relatedIssue.key;
                const filename = 'input/' + issueKey + '.md';
                const content = formatTicketAsMarkdown(relatedIssue);
                
                if (content) {
                    file_write({
                        path: filename,
                        content: content
                    });
                    writtenCount++;
                    const issueType = subtasks.some(function(st) { return st.key === issueKey; }) ? 'subtask' : 'blocking issue';
                    console.log('✅ Written ' + issueType + ' ' + issueKey + ' to ' + filename);
                } else {
                    console.warn('Skipping ' + issueKey + ' - no content to write');
                }
            } catch (writeError) {
                console.error('Failed to write ' + relatedIssue.key + ':', writeError);
            }
        });
        
        console.log('Successfully wrote ' + writtenCount + ' related issue(s) to input folder');
        return true; // Continue processing
        
    } catch (error) {
        console.error('❌ Error in fetchSubtasksToInput:', error);
        // On error, continue processing to avoid blocking legitimate workflows
        console.warn('Continuing with processing despite error in subtask fetch');
        return true;
    }
}

