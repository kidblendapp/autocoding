/**
 * Simple Assign For Review Action
 * Assigns ticket to initiator and moves to "In Review" status
 */

// Import common Jira helper functions
const { assignForReview } = require('./common/jiraHelpers.js');

function action(params) {
    try {
        const ticketKey = params.ticket.key;
        const initiatorId = params.initiator;
        // Dynamically generate WIP label from contextId
        const wipLabel = params.metadata && params.metadata.contextId 
            ? params.metadata.contextId + '_wip' 
            : null;
        
        // Use common assignForReview function
        const assignResult = assignForReview(ticketKey, initiatorId, wipLabel);
        
        // Remove AI_description label after successful update
        if (assignResult && assignResult.success) {
            try {
                jira_remove_label({
                    key: ticketKey,
                    label: 'AI_description'
                });
                console.log('✅ Removed AI_description label from ' + ticketKey);
            } catch (labelError) {
                console.warn('Failed to remove AI_description label:', labelError);
            }
        } else {
            console.log('Skipping AI_description label removal - assignment was not successful');
        }
        
        return assignResult;
        
    } catch (error) {
        console.error("❌ Error:", error);
        return {
            success: false,
            error: error.toString()
        };
    }
}

