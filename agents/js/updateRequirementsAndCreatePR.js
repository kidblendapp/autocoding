/**
 * Update Requirements and Create PR Action
 * Extracts business and technical requirements, updates JIRA tickets, updates documentation files, and creates a PR
 */

// Import common helper functions
const { extractTicketKey } = require('./common/jiraHelpers.js');
const { GIT_CONFIG, LABELS } = require('./config.js');

/**
 * Generate unique branch name with collision detection
 * Appends _1, _2, _3 etc. if branch already exists locally or remotely
 */
function generateUniqueBranchName(branchPrefix, ticketKey) {
    const baseBranchName = branchPrefix + '/' + ticketKey;

    // Check if base branch exists locally or remotely
    try {
        // Fetch latest remote branches without pulling
        try {
            cli_execute_command({
                command: 'git fetch origin --prune'
            });
        } catch (fetchError) {
            console.warn('Could not fetch remote branches:', fetchError);
        }

        // Check local branches
        const localBranches = cli_execute_command({
            command: 'git branch --list "*' + baseBranchName + '*"'
        }) || '';

        // Check remote branches
        const remoteBranches = cli_execute_command({
            command: 'git branch --remotes --list "origin/' + baseBranchName + '*"'
        }) || '';

        const allBranches = localBranches + '\n' + remoteBranches;

        // If no branches exist with this base name, use it
        if (!allBranches.trim() || allBranches.trim() === '\n') {
            return baseBranchName;
        }

        // Try with suffixes _1, _2, _3, etc.
        for (let i = 1; i <= 10; i++) {
            const candidateName = baseBranchName + '_' + i;
            if (allBranches.indexOf(candidateName) === -1) {
                return candidateName;
            }
        }

        // Fallback: use timestamp suffix if too many collisions
        const timestamp = Date.now();
        return baseBranchName + '_' + timestamp;

    } catch (error) {
        console.warn('Error checking existing branches, using base name:', error);
        return baseBranchName;
    }
}

/**
 * Configure git author for AI Teammate commits
 *
 * @returns {boolean} True if successful
 */
function configureGitAuthor() {
    try {
        cli_execute_command({
            command: 'git config user.name "' + GIT_CONFIG.AUTHOR_NAME + '"'
        });

        cli_execute_command({
            command: 'git config user.email "' + GIT_CONFIG.AUTHOR_EMAIL + '"'
        });

        console.log('✅ Configured git author as AI Teammate');
        return true;

    } catch (error) {
        console.error('Failed to configure git author:', error);
        return false;
    }
}

/**
 * Read AI-generated requirements files
 *
 * @returns {Object} Object with businessRequirements and technicalRequirements content
 */
function readAIRequirements() {
    let businessRequirements = '';
    let technicalRequirements = '';

    try {
        businessRequirements = file_read({
            path: 'outputs/business_requirements.md'
        }) || '';
        console.log('✅ Read business requirements (' + businessRequirements.length + ' characters)');
    } catch (error) {
        console.error('Failed to read outputs/business_requirements.md:', error);
        throw new Error('Business requirements file not found');
    }

    try {
        technicalRequirements = file_read({
            path: 'outputs/technical_requirements.md'
        }) || '';
        console.log('✅ Read technical requirements (' + technicalRequirements.length + ' characters)');
    } catch (error) {
        console.error('Failed to read outputs/technical_requirements.md:', error);
        throw new Error('Technical requirements file not found');
    }

    if (!businessRequirements.trim() && !technicalRequirements.trim()) {
        throw new Error('Both requirements files are empty');
    }

    return {
        businessRequirements: businessRequirements.trim(),
        technicalRequirements: technicalRequirements.trim()
    };
}

/**
 * Fetch all subtasks for a parent ticket
 *
 * @param {string} parentKey - Parent ticket key
 * @returns {Array} Array of subtask objects
 */
function fetchSubtasks(parentKey) {
    let subtasks = [];
    try {
        const searchResult = jira_search_by_jql({
            jql: 'parent = ' + parentKey,
            fields: ['key', 'summary', 'description', 'status', 'labels', 'Diagrams']
        });

        if (searchResult && searchResult.issues) {
            subtasks = searchResult.issues;
        } else if (searchResult && Array.isArray(searchResult)) {
            subtasks = searchResult;
        }

        console.log('✅ Fetched ' + subtasks.length + ' subtask(s) for ' + parentKey);
    } catch (error) {
        console.warn('Failed to fetch subtasks:', error);
        // Continue with empty array
    }

    return subtasks;
}

/**
 * Extract minimal technical requirements from solution design subtask description
 * Removes business context and keeps only technical implementation details
 *
 * @param {string} description - Full subtask description
 * @returns {string} Minimal technical requirements
 */
function extractMinimalTechRequirements(description) {
    if (!description) {
        return '';
    }

    // Remove common business context markers
    let techReqs = description;

    // Try to extract technical sections
    const techMarkers = [
        /##?\s*Technical\s+Requirements?/i,
        /##?\s*Implementation\s+Details?/i,
        /##?\s*Architecture/i,
        /##?\s*Technology\s+Stack/i,
        /##?\s*Technical\s+Approach/i
    ];

    let foundTechSection = false;
    for (let i = 0; i < techMarkers.length; i++) {
        const match = techReqs.match(techMarkers[i]);
        if (match) {
            // Extract from this section onwards
            const startIdx = match.index;
            techReqs = techReqs.substring(startIdx);
            foundTechSection = true;
            break;
        }
    }

    // If no technical section found, use the whole description but clean it
    if (!foundTechSection) {
        // Remove business-related phrases
        techReqs = techReqs.replace(/For\s+business\s+context[^]*$/i, '');
        techReqs = techReqs.replace(/Business\s+requirements?[^]*$/i, '');
        techReqs = techReqs.replace(/User\s+stories?[^]*$/i, '');
    }

    return techReqs.trim();
}

/**
 * Update story ticket with business requirements
 * Preserves existing user requirements section
 *
 * @param {string} ticketKey - Story ticket key
 * @param {string} currentDescription - Current ticket description
 * @param {string} businessRequirements - Business requirements to add
 * @returns {boolean} True if successful
 */
function updateStoryWithBusinessRequirements(ticketKey, currentDescription, businessRequirements) {
    try {
        // Preserve existing user requirements section if present
        let updatedDescription = currentDescription || '';

        // Check if business requirements section already exists
        const hasBusinessSection = /##?\s*Business\s+Requirements?/i.test(updatedDescription);

        if (hasBusinessSection) {
            // Replace existing business requirements section
            updatedDescription = updatedDescription.replace(
                /##?\s*Business\s+Requirements?[^]*(?=\n##|$)/i,
                '\n\n' + businessRequirements
            );
        } else {
            // Append business requirements section
            if (updatedDescription && !updatedDescription.endsWith('\n')) {
                updatedDescription += '\n';
            }
            updatedDescription += '\n\n## Business Requirements\n\n' + businessRequirements;
        }

        jira_update_description({
            key: ticketKey,
            description: updatedDescription
        });

        console.log('✅ Updated story ' + ticketKey + ' with business requirements');
        return true;
    } catch (error) {
        console.error('Failed to update story with business requirements:', error);
        return false;
    }
}

/**
 * Update subtask with minimal technical requirements
 * Adds reference to parent story for business context
 *
 * @param {string} subtaskKey - Subtask ticket key
 * @param {string} parentKey - Parent story ticket key
 * @param {string} currentDescription - Current subtask description
 * @param {string} technicalRequirements - Technical requirements to add
 * @returns {boolean} True if successful
 */
function updateSubtaskWithTechRequirements(subtaskKey, parentKey, currentDescription, technicalRequirements) {
    try {
        // Extract minimal tech requirements from the full technical requirements
        // For subtasks, we want only the relevant portion
        const minimalTechReqs = extractMinimalTechRequirements(technicalRequirements);

        if (!minimalTechReqs) {
            console.warn('No technical requirements extracted for subtask ' + subtaskKey);
            return false;
        }

        // Build new description with tech requirements and reference to parent
        const parentLink = '[' + parentKey + '|https://kidblendapp.atlassian.net/browse/' + parentKey + '|smart-link]';
        const updatedDescription = 'h2. Technical Requirements\n\n' + minimalTechReqs +
            '\n\nh3. Business Context\n\n' +
            'For business requirements and user stories, see parent story: ' + parentLink;

        jira_update_description({
            key: subtaskKey,
            description: updatedDescription
        });

        console.log('✅ Updated subtask ' + subtaskKey + ' with technical requirements');
        return true;
    } catch (error) {
        console.error('Failed to update subtask ' + subtaskKey + ':', error);
        return false;
    }
}

/**
 * Update documentation files with new requirements
 *
 * @param {string} businessRequirements - Business requirements content
 * @param {string} technicalRequirements - Technical requirements content
 * @returns {boolean} True if successful
 */
function updateDocumentationFiles(businessRequirements, technicalRequirements) {
    try {
        // Update business requirements file
        if (businessRequirements) {
            file_write({
                path: 'docs/business-requirements.md',
                content: businessRequirements
            });
            console.log('✅ Updated docs/business-requirements.md');
        }

        // Update technical requirements file
        if (technicalRequirements) {
            file_write({
                path: 'docs/technical-requirements.md',
                content: technicalRequirements
            });
            console.log('✅ Updated docs/technical-requirements.md');
        }

        return true;
    } catch (error) {
        console.error('Failed to update documentation files:', error);
        return false;
    }
}

/**
 * Perform git operations: create branch, stage, commit, and push
 *
 * @param {string} branchName - Branch name
 * @param {string} commitMessage - Commit message
 * @returns {Object} Result with success status and branch name
 */
function performGitOperations(branchName, commitMessage) {
    try {
        // Check if branch already exists locally and delete it
        console.log('Checking if branch exists locally:', branchName);
        try {
            const localBranches = cli_execute_command({
                command: 'git branch --list "' + branchName + '"'
            }) || '';

            if (localBranches.trim()) {
                console.log('Branch exists locally, deleting it first...');
                // Switch to base branch first
                cli_execute_command({
                    command: 'git checkout ' + GIT_CONFIG.DEFAULT_BASE_BRANCH
                });
                // Delete local branch
                cli_execute_command({
                    command: 'git branch -D ' + branchName
                });
            }
        } catch (checkError) {
            console.warn('Error checking/deleting existing local branch:', checkError);
        }

        // Create and checkout new branch
        console.log('Creating branch:', branchName);
        cli_execute_command({
            command: 'git checkout -b ' + branchName
        });

        // Stage only documentation files
        console.log('Staging documentation files...');
        cli_execute_command({
            command: 'git add docs/business-requirements.md docs/technical-requirements.md'
        });

        // Check if there are changes to commit
        const statusOutput = cli_execute_command({
            command: 'git status --porcelain'
        });

        if (!statusOutput || !statusOutput.trim()) {
            console.warn('No changes to commit');
            return {
                success: false,
                error: 'No changes were made to documentation files'
            };
        }

        // Commit changes
        console.log('Committing changes...');
        cli_execute_command({
            command: 'git commit -m "' + commitMessage.replace(/"/g, '\\"') + '"'
        });

        // Push to remote
        console.log('Pushing to remote...');
        try {
            cli_execute_command({
                command: 'git push -u origin ' + branchName
            });
        } catch (pushError) {
            // If push fails, try with force (in case branch exists remotely)
            console.log('Normal push failed, attempting force push...');
            cli_execute_command({
                command: 'git push -u origin ' + branchName + ' --force'
            });
        }

        // Verify branch is pushed
        console.log('Verifying branch is pushed to remote...');
        const remoteBranches = cli_execute_command({
            command: 'git ls-remote --heads origin ' + branchName
        }) || '';

        if (!remoteBranches.trim()) {
            throw new Error('Branch was not successfully pushed to remote');
        }

        console.log('✅ Git operations completed successfully');
        return {
            success: true,
            branchName: branchName
        };

    } catch (error) {
        console.error('Git operations failed:', error);
        return {
            success: false,
            error: error.toString()
        };
    }
}

/**
 * Create Pull Request using GitHub CLI
 *
 * @param {string} title - PR title
 * @param {string} branchName - Branch name
 * @param {string} ticketKey - JIRA ticket key
 * @returns {Object} Result with success status and PR URL
 */
function createPullRequest(title, branchName, ticketKey) {
    try {
        console.log('Creating Pull Request...');

        // Escape special characters in title
        const escapedTitle = title.replace(/"/g, '\\"').replace(/\n/g, ' ');

        // Create PR body with ticket reference
        const prBody = '## Requirements Documentation Update\n\n' +
            'This PR updates the requirements documentation based on JIRA ticket ' + ticketKey + '.\n\n' +
            '### Changes\n\n' +
            '* Updated `docs/business-requirements.md` with business requirements from story ticket\n' +
            '* Updated `docs/technical-requirements.md` with technical requirements from solution design subtasks\n\n' +
            '### Related Ticket\n\n' +
            'JIRA: [' + ticketKey + '|https://kidblendapp.atlassian.net/browse/' + ticketKey + '|smart-link]';

        // Write PR body to temp file
        const bodyFilePath = 'outputs/pr_body.md';
        file_write({
            path: bodyFilePath,
            content: prBody
        });

        // Create PR using gh CLI
        const output = cli_execute_command({
            command: 'gh pr create --title "' + escapedTitle + '" --body-file "' + bodyFilePath + '" --base ' + GIT_CONFIG.DEFAULT_BASE_BRANCH + ' --head ' + branchName
        }) || '';

        // Extract PR URL from output
        const urlMatch = output.match(/https:\/\/github\.com\/[^\s]+/);
        const prUrl = urlMatch ? urlMatch[0] : null;

        if (!prUrl) {
            console.warn('PR created but could not extract URL from output:', output);
        }

        console.log('✅ Pull Request created:', prUrl || '(URL not found in output)');

        return {
            success: true,
            prUrl: prUrl,
            output: output
        };

    } catch (error) {
        console.error('Failed to create Pull Request:', error);
        return {
            success: false,
            error: error.toString()
        };
    }
}

/**
 * Post comment to Jira ticket with PR details
 *
 * @param {string} ticketKey - Ticket key
 * @param {string} prUrl - Pull Request URL
 * @param {string} branchName - Git branch name
 */
function postPRCommentToJira(ticketKey, prUrl, branchName) {
    try {
        let comment = 'h3. *Requirements Updated*\n\n';
        comment += '*Branch:* {code}' + branchName + '{code}\n';

        if (prUrl) {
            comment += '*Pull Request:* ' + prUrl + '\n';
        } else {
            comment += '*Pull Request:* Created (check GitHub for URL)\n';
        }

        comment += '\nBusiness and technical requirements have been extracted and updated in JIRA tickets and documentation files.';

        jira_post_comment({
            key: ticketKey,
            comment: comment
        });

        console.log('✅ Posted PR comment to', ticketKey);

    } catch (error) {
        console.error('Failed to post comment to Jira:', error);
    }
}

/**
 * Post error comment to Jira ticket
 *
 * @param {string} ticketKey - Ticket key
 * @param {string} stage - Stage where error occurred
 * @param {string} errorMessage - Error message
 */
function postErrorCommentToJira(ticketKey, stage, errorMessage) {
    try {
        let comment = 'h3. *Requirements Update Error*\n\n';
        comment += '*Stage:* ' + stage + '\n';
        comment += '*Error:* {code}' + errorMessage + '{code}\n\n';
        comment += 'Please check the logs for more details and retry the workflow if needed.';

        jira_post_comment({
            key: ticketKey,
            comment: comment
        });

        console.log('Posted error comment to', ticketKey);

    } catch (error) {
        console.error('Failed to post error comment to Jira:', error);
    }
}

/**
 * Remove AI_requirements_update label
 *
 * @param {string} ticketKey - Ticket key
 */
function removeAIRequirementsUpdateLabel(ticketKey) {
    try {
        jira_remove_label({
            key: ticketKey,
            label: 'AI_requirements_update'
        });
        console.log('Removed AI_requirements_update label from ' + ticketKey);
    } catch (labelError) {
        console.warn('Failed to remove AI_requirements_update label:', labelError);
    }
}

/**
 * Main action function - orchestrates the entire workflow
 *
 * @param {Object} params - Parameters from Teammate job
 * @param {Object} params.ticket - Jira ticket object
 * @param {string} params.initiator - Initiator account ID
 * @returns {Object} Result object with success status
 */
function action(params) {
    let ticketKey = null;
    try {
        ticketKey = params.ticket.key;
        const ticketSummary = params.ticket.fields.summary;
        const ticketDescription = params.ticket.fields.description || '';

        console.log('Processing requirements update workflow for ticket:', ticketKey);
        console.log('Ticket summary:', ticketSummary);

        // Read AI-generated requirements
        let requirements;
        try {
            requirements = readAIRequirements();
        } catch (error) {
            console.error('Failed to read AI requirements:', error);
            postErrorCommentToJira(ticketKey, 'Requirements Reading', error.toString());
            removeAIRequirementsUpdateLabel(ticketKey);
            return {
                success: false,
                error: 'Failed to read AI requirements: ' + error.toString()
            };
        }

        // Fetch subtasks
        const subtasks = fetchSubtasks(ticketKey);

        // Filter solution design subtasks (those with SD labels or prefixes)
        const solutionDesignSubtasks = subtasks.filter(function(subtask) {
            const labels = subtask.fields.labels || [];
            const summary = subtask.fields.summary || '';
            return labels.some(function(label) {
                return label.indexOf('sd_') === 0 || label.indexOf('SD_') === 0;
            }) || summary.indexOf('[SD') === 0;
        });

        console.log('Found ' + solutionDesignSubtasks.length + ' solution design subtask(s)');

        // Update story with business requirements
        if (requirements.businessRequirements) {
            updateStoryWithBusinessRequirements(ticketKey, ticketDescription, requirements.businessRequirements);
        }

        // Update subtasks with minimal technical requirements
        let updatedSubtasks = 0;
        if (solutionDesignSubtasks.length > 0) {
            solutionDesignSubtasks.forEach(function(subtask) {
                const subtaskKey = subtask.key;
                const subtaskDescription = subtask.fields.description || '';
                if (updateSubtaskWithTechRequirements(subtaskKey, ticketKey, subtaskDescription, requirements.technicalRequirements)) {
                    updatedSubtasks++;
                }
            });
            console.log('Updated ' + updatedSubtasks + ' subtask(s) with technical requirements');
        } else {
            console.log('No solution design subtasks found - skipping subtask updates');
        }

        // Update documentation files
        if (!updateDocumentationFiles(requirements.businessRequirements, requirements.technicalRequirements)) {
            const error = 'Failed to update documentation files';
            postErrorCommentToJira(ticketKey, 'Documentation Update', error);
            removeAIRequirementsUpdateLabel(ticketKey);
            return {
                success: false,
                error: error
            };
        }

        // Configure git author
        if (!configureGitAuthor()) {
            const error = 'Failed to configure git author';
            postErrorCommentToJira(ticketKey, 'Git Configuration', error);
            removeAIRequirementsUpdateLabel(ticketKey);
            return {
                success: false,
                error: error
            };
        }

        // Generate unique branch name
        const branchPrefix = 'requirements';
        const branchName = generateUniqueBranchName(branchPrefix, ticketKey);
        console.log('Using branch name:', branchName);

        // Prepare commit message
        const commitMessage = 'docs: Update requirements from ' + ticketKey;

        // Perform git operations
        const gitResult = performGitOperations(branchName, commitMessage);
        if (!gitResult.success) {
            postErrorCommentToJira(ticketKey, 'Git Operations', gitResult.error);
            removeAIRequirementsUpdateLabel(ticketKey);
            return {
                success: false,
                error: 'Git operations failed: ' + gitResult.error
            };
        }

        // Create Pull Request
        const prTitle = 'docs: Update requirements - ' + ticketKey + ' ' + ticketSummary;
        const prResult = createPullRequest(prTitle, branchName, ticketKey);

        if (!prResult.success) {
            postErrorCommentToJira(ticketKey, 'Pull Request Creation', prResult.error);
            removeAIRequirementsUpdateLabel(ticketKey);
            return {
                success: false,
                error: 'PR creation failed: ' + prResult.error
            };
        }

        // Post comment with PR details
        postPRCommentToJira(ticketKey, prResult.prUrl, branchName);

        // Add label to indicate requirements updated
        try {
            jira_add_label({
                key: ticketKey,
                label: LABELS.AI_REQUIREMENTS_UPDATED || 'ai_requirements_updated'
            });
        } catch (error) {
            console.warn('Failed to add ai_requirements_updated label:', error);
        }

        // Remove WIP label if configured
        const wipLabel = params.metadata && params.metadata.contextId
            ? params.metadata.contextId + '_wip'
            : null;
        if (wipLabel) {
            try {
                jira_remove_label({
                    key: ticketKey,
                    label: wipLabel
                });
                console.log('Removed WIP label "' + wipLabel + '" from ' + ticketKey);
            } catch (labelError) {
                console.warn('Failed to remove WIP label "' + wipLabel + '":', labelError);
            }
        }

        // Remove AI_requirements_update label after processing
        removeAIRequirementsUpdateLabel(ticketKey);

        console.log('✅ Requirements update workflow completed successfully');

        return {
            success: true,
            message: 'Ticket ' + ticketKey + ' requirements updated, documentation files updated, and PR created',
            branchName: branchName,
            prUrl: prResult.prUrl,
            updatedSubtasks: updatedSubtasks
        };

    } catch (error) {
        console.error('❌ Error in requirements update workflow:', error);

        // Try to post error comment to ticket
        try {
            if (params && params.ticket && params.ticket.key) {
                postErrorCommentToJira(params.ticket.key, 'Workflow Execution', error.toString());
            }
        } catch (commentError) {
            console.error('Failed to post error comment:', commentError);
        }

        // Remove AI_requirements_update label even on error
        if (ticketKey) {
            removeAIRequirementsUpdateLabel(ticketKey);
        }

        return {
            success: false,
            error: error.toString()
        };
    }
}

