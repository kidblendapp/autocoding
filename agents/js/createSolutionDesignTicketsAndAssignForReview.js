/**
 * Create Solution Design Tickets and Assign For Review Action
 * Creates solution design subtasks based on AI module analysis and assigns parent ticket for review
 */

// Import common helper functions
const { assignForReview, extractTicketKey } = require('./common/jiraHelpers.js');
const { ISSUE_TYPES, PRIORITIES, LABELS, SOLUTION_DESIGN_COMPONENTS, SOLUTION_DESIGN_SCENARIOS, SOLUTION_DESIGN_MODULES } = require('./config.js');

/**
 * Parse AI response for component/scenario analysis
 * Supports both new component-based approach and legacy core/api/ui approach
 * 
 * @param {Object|string} response - AI response (should be JSON object)
 * @returns {Object} Parsed analysis or null if invalid
 */
function parseModuleAnalysisResponse(response) {
    // Handle string responses (parse JSON)
    if (typeof response === 'string') {
        try {
            response = JSON.parse(response);
        } catch (error) {
            console.error('Invalid JSON from AI:', error);
            return null;
        }
    }
    
    // Validate expected structure
    if (!response || typeof response !== 'object') {
        console.warn('AI response is not an object, got:', typeof response);
        return null;
    }
    
    // Check for new component-based approach (preferred)
    const hasComponents = SOLUTION_DESIGN_COMPONENTS.some(comp => typeof response[comp.flag] === 'boolean');
    const hasScenarios = SOLUTION_DESIGN_SCENARIOS.some(scenario => typeof response[scenario.flag] === 'boolean');
    
    // Check for legacy core/api/ui approach (backward compatibility)
    const hasLegacyModules = typeof response.core === 'boolean' || 
                             typeof response.api === 'boolean' || 
                             typeof response.ui === 'boolean';
    
    // Validate required fields - must have description and at least one decomposition approach
    if (typeof response.description !== 'string') {
        console.error('AI response missing required description field:', response);
        return null;
    }
    
    // If no decomposition flags found, assume single solution design (no subtasks needed)
    if (!hasComponents && !hasScenarios && !hasLegacyModules) {
        console.log('No decomposition flags found - treating as single solution design');
        return {
            description: response.description,
            decompositionType: 'none',
            components: [],
            scenarios: [],
            legacyModules: []
        };
    }
    
    // Validate component flags if present
    if (hasComponents) {
        for (const comp of SOLUTION_DESIGN_COMPONENTS) {
            if (response[comp.flag] !== undefined && typeof response[comp.flag] !== 'boolean') {
                console.error('Invalid component flag type for ' + comp.flag + ':', response[comp.flag]);
                return null;
            }
        }
    }
    
    // Validate scenario flags if present
    if (hasScenarios) {
        for (const scenario of SOLUTION_DESIGN_SCENARIOS) {
            if (response[scenario.flag] !== undefined && typeof response[scenario.flag] !== 'boolean') {
                console.error('Invalid scenario flag type for ' + scenario.flag + ':', response[scenario.flag]);
                return null;
            }
        }
    }
    
    // Validate legacy module flags if present
    if (hasLegacyModules) {
        if ((response.core !== undefined && typeof response.core !== 'boolean') ||
            (response.api !== undefined && typeof response.api !== 'boolean') ||
            (response.ui !== undefined && typeof response.ui !== 'boolean')) {
            console.error('Invalid legacy module flag types:', response);
            return null;
        }
    }
    
    return {
        description: response.description,
        decompositionType: hasComponents ? 'components' : (hasScenarios ? 'scenarios' : 'legacy'),
        components: hasComponents ? SOLUTION_DESIGN_COMPONENTS.filter(comp => response[comp.flag] === true) : [],
        scenarios: hasScenarios ? SOLUTION_DESIGN_SCENARIOS.filter(scenario => response[scenario.flag] === true) : [],
        legacyModules: hasLegacyModules ? SOLUTION_DESIGN_MODULES.filter(mod => response[mod.flag] === true) : []
    };
}

/**
 * Create solution design subtasks based on component/scenario analysis
 * 
 * @param {Object} moduleAnalysis - Parsed analysis from AI
 * @param {string} parentKey - Parent ticket key
 * @param {string} parentSummary - Parent ticket summary for naming
 * @returns {Array} Array of created ticket information
 */
function createSolutionDesignTickets(moduleAnalysis, parentKey, parentSummary) {
    const projectKey = parentKey.split('-')[0];
    const createdTickets = [];
    
    // Determine which decomposition approach to use
    let itemsToCreate = [];
    
    if (moduleAnalysis.decompositionType === 'components' && moduleAnalysis.components.length > 0) {
        itemsToCreate = moduleAnalysis.components.map(comp => ({
            flag: comp.flag,
            prefix: comp.prefix,
            label: comp.label,
            description: comp.description
        }));
    } else if (moduleAnalysis.decompositionType === 'scenarios' && moduleAnalysis.scenarios.length > 0) {
        itemsToCreate = moduleAnalysis.scenarios.map(scenario => ({
            flag: scenario.flag,
            prefix: scenario.prefix,
            label: scenario.label,
            description: scenario.description
        }));
    } else if (moduleAnalysis.decompositionType === 'legacy' && moduleAnalysis.legacyModules.length > 0) {
        itemsToCreate = moduleAnalysis.legacyModules.map(mod => ({
            flag: mod.flag,
            prefix: mod.prefix,
            label: mod.label,
            description: 'Legacy module type'
        }));
    }
    
    // If no decomposition needed, return empty array
    if (itemsToCreate.length === 0) {
        console.log('No subtasks to create - solution design is single unit');
        return [];
    }
    
    // Create subtasks for each component/scenario
    itemsToCreate.forEach(function(item) {
        const summary = item.prefix + ' ' + parentSummary;
        const description = 'Details are in [' + parentKey + '|https://dmtools.atlassian.net/browse/' + parentKey + '|smart-link] \n\n' +
                           '*Component/Scenario:* ' + item.description + '\n\n' +
                           '*Analysis:* ' + moduleAnalysis.description;
        
        try {
            // Create subtask using the dedicated parent method
            const result = jira_create_ticket_with_parent({
                project: projectKey,
                issueType: ISSUE_TYPES.SUBTASK,
                summary: summary,
                description: description,
                parentKey: parentKey
            });
            
            const createdKey = extractTicketKey(result);
            
            if (createdKey) {
                // Set priority using dedicated method
                try {
                    jira_set_priority({
                        key: createdKey,
                        priority: PRIORITIES.MEDIUM
                    });
                } catch (priorityError) {
                    console.warn('Failed to set priority on ' + createdKey + ':', priorityError);
                }
                
                // Add component/scenario-specific label
                try {
                    jira_add_label({
                        key: createdKey,
                        label: item.label
                    });
                } catch (labelError) {
                    console.warn('Failed to add label ' + item.label + ' to ' + createdKey + ':', labelError);
                }
            }
            
            createdTickets.push({
                component: item.flag,
                summary: summary,
                key: createdKey,
                success: true
            });
            
            console.log('Created ' + item.prefix + ' subtask: ' + (createdKey || '(unknown key)'));
            
        } catch (error) {
            console.error('Failed to create ' + item.prefix + ' subtask:', error);
            createdTickets.push({
                component: item.flag,
                summary: summary,
                error: error.toString(),
                success: false
            });
        }
    });
    
    return createdTickets;
}

/**
 * Post a summary comment to the parent ticket
 * 
 * @param {string} parentKey - Parent ticket key
 * @param {Object} moduleAnalysis - Module analysis results
 * @param {Array} createdTickets - Array of created tickets
 */
function postSummaryComment(parentKey, moduleAnalysis, createdTickets) {
    try {
        const successfulTickets = createdTickets.filter(function(ticket) { return ticket.success; });
        const failedTickets = createdTickets.filter(function(ticket) { return !ticket.success; });
        
        let comment = 'h3. *Solution Design Analysis Results*\n\n';
        comment += '*Analysis:* ' + moduleAnalysis.description + '\n\n';
        
        // Show decomposition type and components/scenarios
        if (moduleAnalysis.decompositionType === 'none') {
            comment += '*Decomposition:* Single solution design (no subtasks created)\n\n';
        } else if (moduleAnalysis.decompositionType === 'components') {
            comment += '*Decomposition Type:* Technical Components\n';
            comment += '*Components Requiring Implementation:*\n';
            moduleAnalysis.components.forEach(function(comp) {
                comment += '* *' + comp.description + '*\n';
            });
            comment += '\n';
        } else if (moduleAnalysis.decompositionType === 'scenarios') {
            comment += '*Decomposition Type:* Implementation Scenarios\n';
            comment += '*Scenarios Requiring Implementation:*\n';
            moduleAnalysis.scenarios.forEach(function(scenario) {
                comment += '* *' + scenario.description + '*\n';
            });
            comment += '\n';
        } else if (moduleAnalysis.decompositionType === 'legacy') {
            comment += '*Decomposition Type:* Legacy Modules\n';
            comment += '*Modules Requiring Implementation:*\n';
            moduleAnalysis.legacyModules.forEach(function(mod) {
                comment += '* *' + mod.flag.toUpperCase() + '*\n';
            });
            comment += '\n';
        }
        
        if (successfulTickets.length > 0) {
            comment += '*Created Solution Design Tickets:*\n';
            successfulTickets.forEach(function(ticket) {
                comment += '* [' + ticket.key + '|https://dmtools.atlassian.net/browse/' + ticket.key + '] - ' + ticket.summary + '\n';
            });
            comment += '\n';
        }
        
        if (failedTickets.length > 0) {
            comment += '*Failed to Create:*\n';
            failedTickets.forEach(function(ticket) {
                comment += '* ' + ticket.summary + ' - Error: ' + ticket.error + '\n';
            });
            comment += '\n';
        }
        
        if (successfulTickets.length > 0) {
            comment += '*Total Created:* ' + successfulTickets.length + ' solution design subtask(s)';
        } else {
            comment += '*Note:* Solution design is a single unit, no subtasks created.';
        }
        
        jira_post_comment({
            key: parentKey,
            comment: comment
        });
        
        console.log('Posted summary comment to ' + parentKey);
        
    } catch (error) {
        console.error('Failed to post summary comment:', error);
    }
}

function action(params) {
    try {
        const ticketKey = params.ticket.key;
        const ticketSummary = params.ticket.fields.summary;
        const initiatorId = params.initiator;
        // Dynamically generate WIP label from contextId
        const wipLabel = params.metadata && params.metadata.contextId 
            ? params.metadata.contextId + '_wip' 
            : null;

        console.log("Processing solution design creation for ticket:", ticketKey);
        
        // Parse AI module analysis response
        const moduleAnalysis = parseModuleAnalysisResponse(params.response);
        if (!moduleAnalysis) {
            const errorMsg = 'Invalid AI response format for module analysis';
            console.error(errorMsg);
            
            // Post error comment to ticket
            try {
                jira_post_comment({
                    key: ticketKey,
                    comment: '*Error:* ' + errorMsg + '. Please check logs for details and retry the workflow.'
                });
            } catch (commentError) {
                console.error('Failed to post error comment:', commentError);
            }
            
            return {
                success: false,
                error: errorMsg
            };
        }

        // Create solution design tickets based on analysis
        const createdTickets = createSolutionDesignTickets(moduleAnalysis, ticketKey, ticketSummary);
        
        // Post summary comment with analysis results
        postSummaryComment(ticketKey, moduleAnalysis, createdTickets);

        // Add solution design label
        try {
            jira_add_label({
                key: ticketKey,
                label: LABELS.AI_SOLUTION_DESIGN_CREATED
            });
        } catch (labelError) {
            console.warn('Failed to add ai_solution_design_created label:', labelError);
        }

        // Use common assignForReview function for post-processing
        const assignResult = assignForReview(ticketKey, initiatorId, wipLabel);
        
        if (!assignResult.success) {
            return assignResult;
        }
        
        const successfulTickets = createdTickets.filter(function(ticket) { return ticket.success; });
        
        return {
            success: true,
            message: `Ticket ${ticketKey} assigned, moved to In Review, created ${successfulTickets.length} solution design subtasks`,
            moduleAnalysis: moduleAnalysis,
            createdTickets: createdTickets
        };
        
    } catch (error) {
        console.error("❌ Error:", error);
        
        // Try to post error comment to ticket
        try {
            if (params && params.ticket && params.ticket.key) {
                jira_post_comment({
                    key: params.ticket.key,
                    comment: '*Workflow Error:* ' + error.toString() + '. Please check server logs for details.'
                });
            }
        } catch (commentError) {
            console.error('Failed to post error comment:', commentError);
        }
        
        return {
            success: false,
            error: error.toString()
        };
    }
}

