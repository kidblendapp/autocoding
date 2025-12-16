/**
 * Fetch Subtasks to Input Folder Pre-Action
 * Fetches all child tickets (subtasks) and writes them to the input folder
 * before AI processing begins. This ensures subtasks are always available
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
        console.log('Fetching subtasks for parent ticket: ' + parentKey);
        
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
        
        if (subtasks.length === 0) {
            console.log('No subtasks found for ' + parentKey);
            return true; // Continue processing
        }
        
        console.log('Found ' + subtasks.length + ' subtask(s) for ' + parentKey);
        
        // Write each subtask to input folder
        let writtenCount = 0;
        subtasks.forEach(function(subtask) {
            try {
                const subtaskKey = subtask.key;
                const filename = 'input/' + subtaskKey + '.md';
                const content = formatTicketAsMarkdown(subtask);
                
                if (content) {
                    file_write({
                        path: filename,
                        content: content
                    });
                    writtenCount++;
                    console.log('✅ Written subtask ' + subtaskKey + ' to ' + filename);
                } else {
                    console.warn('Skipping subtask ' + subtaskKey + ' - no content to write');
                }
            } catch (writeError) {
                console.error('Failed to write subtask ' + subtask.key + ':', writeError);
            }
        });
        
        console.log('Successfully wrote ' + writtenCount + ' subtask(s) to input folder');
        return true; // Continue processing
        
    } catch (error) {
        console.error('❌ Error in fetchSubtasksToInput:', error);
        // On error, continue processing to avoid blocking legitimate workflows
        console.warn('Continuing with processing despite error in subtask fetch');
        return true;
    }
}

