/**
 * Extract Figma Design References Action
 *
 * Analyzes Figma designs and matches them to Story Acceptance Criteria.
 * Generates Markdown output with design references for ticket descriptions.
 *
 * Supports three output modes:
 * - ac_driven (default): Links Figma screens under each AC
 * - screen_centric: Lists all screens with descriptions
 * - hybrid: Both inline AC links + summary section
 */

// Import helper functions
const {
    extractFigmaUrlFromText,
    extractFileId,
    extractNodeId,
    buildFigmaNodeUrl,
    getBaseUrl,
    fetchFigmaLayers,
    downloadNodeScreenshot,
    parseAcceptanceCriteria,
    buildScreenCatalog,
    formatScreenReference
} = require('./common/figmaHelpers.js');

const { LABELS } = require('./config.js');

/**
 * Build AI prompt for matching ACs to screens using Gemini multimodal
 *
 * @param {Object} storyContext - Story information (title, description, ACs)
 * @param {Object[]} screens - Screen catalog with metadata
 * @returns {string} Prompt for AI matching
 */
function buildMatchingPrompt(storyContext, screens) {
    const screenList = screens.map(function(s, i) {
        return (i + 1) + '. Screen "' + s.name + '" (ID: ' + s.id + ')' +
            (s.width ? ' - ' + s.width + 'x' + s.height : '');
    }).join('\n');

    const acList = storyContext.acs.length > 0
        ? storyContext.acs.map(function(ac) {
            return ac.id + ' - ' + ac.title + '\n' + ac.content;
        }).join('\n\n')
        : 'No explicit Acceptance Criteria found in the story.';

    return `You are a Business Analyst analyzing a software requirement and its Figma design screens.

## Task
Analyze the story context and Figma screens to create appropriate matches between Acceptance Criteria and design screens.

## Story Information
**Title:** ${storyContext.title}

**Description:**
${storyContext.description}

## Acceptance Criteria
${acList}

## Available Figma Screens
${screenList}

## Instructions
${storyContext.acs.length > 0
    ? `1. For each Acceptance Criteria, identify which Figma screen(s) are most relevant.
2. A screen can be linked to multiple ACs, and an AC can link to multiple screens.
3. Consider the screen name, visual content, and how it relates to the AC requirements.
4. If a screen doesn't match any AC, note it separately.`
    : `1. Since no explicit ACs are provided, analyze the screens and suggest appropriate Acceptance Criteria.
2. Each suggested AC should describe what the screen allows the user to do.
3. Follow the standard AC format: "AC N - Title" with bullet points for requirements.`
}

## Output Format
Return a valid JSON object with the following structure:

${storyContext.acs.length > 0
    ? `{
  "matches": [
    {
      "acId": "AC1",
      "acTitle": "Login Form",
      "screenIds": ["123:456", "123:457"],
      "confidence": "high",
      "rationale": "Brief explanation of why these screens match this AC"
    }
  ],
  "unmatchedScreens": [
    {
      "screenId": "123:458",
      "screenName": "Settings",
      "suggestedAcTitle": "Optional: suggested AC if this screen should have one"
    }
  ]
}`
    : `{
  "suggestedAcs": [
    {
      "acId": "AC1",
      "title": "User Login",
      "screenIds": ["123:456"],
      "requirements": [
        "User can enter email and password",
        "Login button triggers authentication"
      ]
    }
  ]
}`
}

**Important:**
- Return ONLY the JSON object, no additional text or formatting.
- Use the exact screen IDs provided (in colon format like "123:456").
- Be specific and accurate in your matching rationale.`;
}

/**
 * Call Gemini AI with screen images for multimodal analysis
 *
 * @param {string} prompt - Analysis prompt
 * @param {string[]} imagePaths - Paths to screen screenshot images
 * @returns {Object} Parsed AI response
 */
function analyzeWithGemini(prompt, imagePaths) {
    try {
        console.log('Calling Gemini AI with ' + imagePaths.length + ' images...');

        let response;
        if (imagePaths && imagePaths.length > 0) {
            // Use multimodal with images
            response = gemini_ai_chat_with_files({
                message: prompt,
                filePaths: imagePaths
            });
        } else {
            // Text-only fallback
            response = gemini_ai_chat({
                message: prompt
            });
        }

        console.log('Gemini response received');

        // Parse JSON from response
        let jsonStr = response;
        if (typeof response === 'string') {
            // Extract JSON from markdown code blocks if present
            const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                jsonStr = jsonMatch[1].trim();
            }
        }

        return JSON.parse(jsonStr);
    } catch (error) {
        console.error('Error in Gemini analysis:', error);
        return { matches: [], error: error.toString() };
    }
}

/**
 * Generate AC-driven Markdown output
 *
 * @param {Object[]} acs - Acceptance Criteria array
 * @param {Object[]} matches - AI matching results
 * @param {Object[]} screens - Screen catalog
 * @param {boolean} includeAttachments - Include attachment references
 * @returns {string} Markdown content
 */
function generateAcDrivenMarkdown(acs, matches, screens, includeAttachments) {
    let md = '## Acceptance Criteria with Design References\n\n';

    // Create screen lookup map
    const screenMap = {};
    screens.forEach(function(s) { screenMap[s.id] = s; });

    // Create matches lookup by AC ID
    const matchMap = {};
    if (matches && matches.matches) {
        matches.matches.forEach(function(m) {
            matchMap[m.acId] = m;
        });
    }

    acs.forEach(function(ac) {
        md += '**' + ac.id + ' - ' + ac.title + '**\n';

        // Add AC content
        if (ac.content) {
            md += ac.content + '\n';
        }

        // Add design reference
        const match = matchMap[ac.id];
        if (match && match.screenIds && match.screenIds.length > 0) {
            const screenLinks = match.screenIds.map(function(sid) {
                const screen = screenMap[sid];
                if (screen) {
                    return formatScreenReference(screen, includeAttachments);
                }
                return null;
            }).filter(Boolean).join(' | ');

            if (screenLinks) {
                md += '- :art: **Design**: ' + screenLinks + '\n';
            }
        }

        md += '\n';
    });

    // Add suggested ACs if no existing ACs were found
    if (acs.length === 0 && matches && matches.suggestedAcs) {
        matches.suggestedAcs.forEach(function(sac) {
            md += '**' + sac.acId + ' - ' + sac.title + '**\n';

            if (sac.requirements) {
                sac.requirements.forEach(function(req) {
                    md += '- [ ] ' + req + '\n';
                });
            }

            const screenLinks = sac.screenIds.map(function(sid) {
                const screen = screenMap[sid];
                if (screen) {
                    return formatScreenReference(screen, includeAttachments);
                }
                return null;
            }).filter(Boolean).join(' | ');

            if (screenLinks) {
                md += '- :art: **Design**: ' + screenLinks + '\n';
            }

            md += '\n';
        });
    }

    return md;
}

/**
 * Generate screen-centric Markdown output
 *
 * @param {Object[]} screens - Screen catalog
 * @param {Object} matches - AI matching results
 * @param {boolean} includeAttachments - Include attachment references
 * @returns {string} Markdown content
 */
function generateScreenCentricMarkdown(screens, matches, includeAttachments) {
    let md = '## Design References\n\n';
    md += '| Screen | Related ACs | Figma Link |';
    if (includeAttachments) {
        md += ' Attachment |';
    }
    md += '\n';
    md += '|--------|-------------|------------|';
    if (includeAttachments) {
        md += '------------|';
    }
    md += '\n';

    // Create reverse lookup: screen ID -> AC IDs
    const screenToAcs = {};
    if (matches && matches.matches) {
        matches.matches.forEach(function(m) {
            if (m.screenIds) {
                m.screenIds.forEach(function(sid) {
                    if (!screenToAcs[sid]) {
                        screenToAcs[sid] = [];
                    }
                    screenToAcs[sid].push(m.acId);
                });
            }
        });
    }

    screens.forEach(function(screen) {
        const relatedAcs = screenToAcs[screen.id] || [];
        const acsStr = relatedAcs.length > 0 ? relatedAcs.join(', ') : '-';

        md += '| ' + screen.name + ' | ' + acsStr + ' | [View](' + screen.nodeUrl + ') |';

        if (includeAttachments && screen.imagePath) {
            const filename = screen.imagePath.split(/[\/\\]/).pop();
            md += ' ![' + screen.name + '](' + filename + ') |';
        } else if (includeAttachments) {
            md += ' - |';
        }

        md += '\n';
    });

    return md;
}

/**
 * Generate hybrid Markdown output (both AC-driven and screen summary)
 *
 * @param {Object[]} acs - Acceptance Criteria array
 * @param {Object[]} screens - Screen catalog
 * @param {Object} matches - AI matching results
 * @param {boolean} includeAttachments - Include attachment references
 * @returns {string} Markdown content
 */
function generateHybridMarkdown(acs, screens, matches, includeAttachments) {
    let md = generateAcDrivenMarkdown(acs, matches, screens, includeAttachments);
    md += '\n---\n\n';
    md += generateScreenCentricMarkdown(screens, matches, includeAttachments);
    return md;
}

/**
 * Attach screenshots to Jira ticket
 *
 * @param {string} ticketKey - Jira ticket key
 * @param {Object[]} screens - Screen catalog with imagePath
 * @returns {Object[]} Array of attachment results
 */
function attachScreenshotsToTicket(ticketKey, screens) {
    const results = [];

    screens.forEach(function(screen) {
        if (screen.imagePath) {
            try {
                console.log('Attaching screenshot for: ' + screen.name);
                const filename = screen.imagePath.split(/[\/\\]/).pop();
                const result = jira_attach_file_to_ticket({
                    ticketKey: ticketKey,
                    name: filename,
                    path: screen.imagePath
                });
                results.push({
                    screenId: screen.id,
                    screenName: screen.name,
                    success: true,
                    result: result
                });
            } catch (error) {
                console.error('Failed to attach screenshot for ' + screen.name + ':', error);
                results.push({
                    screenId: screen.id,
                    screenName: screen.name,
                    success: false,
                    error: error.toString()
                });
            }
        }
    });

    return results;
}

/**
 * Main action function
 *
 * @param {Object} params - Action parameters
 * @returns {Object} Result object
 */
function action(params) {
    try {
        const ticket = params.ticket;
        const ticketKey = ticket.key;
        const metadata = params.metadata || {};

        // Get configuration from params
        const figmaUrlSource = params.figmaUrlSource || 'description';
        const figmaUrlField = params.figmaUrlField || null;
        const outputMode = params.outputMode || 'ac_driven';
        const attachScreenshots = params.attachScreenshots !== false; // default true

        console.log('=== Figma Design Extractor ===');
        console.log('Ticket: ' + ticketKey);
        console.log('Output mode: ' + outputMode);
        console.log('Attach screenshots: ' + attachScreenshots);

        // Step 1: Get Figma URL
        let figmaUrl = null;
        if (figmaUrlSource === 'field' && figmaUrlField) {
            // Get from custom field
            figmaUrl = ticket.fields && ticket.fields[figmaUrlField];
            console.log('Looking for Figma URL in field: ' + figmaUrlField);
        } else {
            // Extract from description (default)
            figmaUrl = extractFigmaUrlFromText(ticket.description);
            console.log('Extracted Figma URL from description');
        }

        if (!figmaUrl) {
            return {
                success: false,
                error: 'No Figma URL found in ticket',
                message: 'Could not find a Figma URL in the ticket ' +
                    (figmaUrlSource === 'field' ? 'field "' + figmaUrlField + '"' : 'description')
            };
        }

        console.log('Figma URL: ' + figmaUrl);

        // Step 2: Parse Acceptance Criteria from description
        const acs = parseAcceptanceCriteria(ticket.description || '');
        console.log('Found ' + acs.length + ' Acceptance Criteria');

        // Step 3: Fetch Figma layers (screens)
        const layersResult = fetchFigmaLayers(figmaUrl);
        const layers = layersResult.children || [];
        console.log('Found ' + layers.length + ' Figma screens/frames');

        if (layers.length === 0) {
            return {
                success: false,
                error: 'No screens found in Figma design',
                message: 'The Figma URL does not contain any visible screens or frames'
            };
        }

        // Step 4: Build screen catalog with screenshots
        console.log('Building screen catalog...');
        const screens = buildScreenCatalog(figmaUrl, layers, attachScreenshots);

        // Collect image paths for multimodal analysis
        const imagePaths = screens
            .filter(function(s) { return s.imagePath; })
            .map(function(s) { return s.imagePath; });

        // Step 5: AI Analysis - Match ACs to screens
        console.log('Analyzing designs with Gemini AI...');
        const storyContext = {
            title: ticket.summary || ticket.title || ticketKey,
            description: ticket.description || '',
            acs: acs
        };

        const prompt = buildMatchingPrompt(storyContext, screens);
        const matches = analyzeWithGemini(prompt, imagePaths);

        if (matches.error) {
            console.warn('AI analysis encountered an error: ' + matches.error);
        }

        // Step 6: Generate Markdown output
        console.log('Generating Markdown output...');
        let markdown = '';

        switch (outputMode) {
            case 'screen_centric':
                markdown = generateScreenCentricMarkdown(screens, matches, attachScreenshots);
                break;
            case 'hybrid':
                markdown = generateHybridMarkdown(acs, screens, matches, attachScreenshots);
                break;
            case 'ac_driven':
            default:
                markdown = generateAcDrivenMarkdown(acs, matches, screens, attachScreenshots);
                break;
        }

        // Step 7: Attach screenshots to ticket if enabled
        let attachmentResults = [];
        if (attachScreenshots) {
            console.log('Attaching screenshots to ticket...');
            attachmentResults = attachScreenshotsToTicket(ticketKey, screens);
        }

        // Step 8: Add label to indicate AI processing
        try {
            jira_add_label({
                key: ticketKey,
                label: LABELS.FIGMA_DESIGN_LINKED
            });
        } catch (labelError) {
            console.warn('Could not add label:', labelError);
        }

        console.log('=== Figma Design Extraction Complete ===');

        return {
            success: true,
            message: 'Successfully extracted Figma design references for ' + ticketKey,
            markdown: markdown,
            stats: {
                screensFound: screens.length,
                acsFound: acs.length,
                matchesCreated: matches.matches ? matches.matches.length : 0,
                suggestedAcs: matches.suggestedAcs ? matches.suggestedAcs.length : 0,
                screenshotsAttached: attachmentResults.filter(function(r) { return r.success; }).length
            },
            figmaUrl: figmaUrl,
            screens: screens.map(function(s) {
                return { id: s.id, name: s.name, url: s.nodeUrl };
            }),
            matches: matches
        };

    } catch (error) {
        console.error('Error in Figma Design Extractor:', error);
        return {
            success: false,
            error: error.toString(),
            message: 'Failed to extract Figma design references'
        };
    }
}
