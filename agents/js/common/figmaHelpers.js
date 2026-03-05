/**
 * Figma Helper Functions
 * Utilities for Figma URL parsing, screen extraction, and design analysis
 */

/**
 * Extract Figma URL from text content (description, comments, etc.)
 * Supports various Figma URL formats:
 * - https://www.figma.com/design/FILE_ID/Name?node-id=123-456
 * - https://www.figma.com/file/FILE_ID/Name?node-id=123-456
 * - https://figma.com/design/FILE_ID/Name
 *
 * @param {string} text - Text to search for Figma URLs
 * @returns {string|null} First Figma URL found or null
 */
function extractFigmaUrlFromText(text) {
    if (!text || typeof text !== 'string') {
        return null;
    }

    // Regex to match Figma URLs
    const figmaUrlPattern = /https?:\/\/(?:www\.)?figma\.com\/(?:design|file)\/[A-Za-z0-9]+\/[^\s\)\]\}\"\'<>]+/gi;
    const matches = text.match(figmaUrlPattern);

    if (matches && matches.length > 0) {
        // Clean up the URL (remove trailing punctuation)
        let url = matches[0].replace(/[,;:.!?]+$/, '');
        return url;
    }

    return null;
}

/**
 * Extract all Figma URLs from text
 *
 * @param {string} text - Text to search for Figma URLs
 * @returns {string[]} Array of Figma URLs found
 */
function extractAllFigmaUrls(text) {
    if (!text || typeof text !== 'string') {
        return [];
    }

    const figmaUrlPattern = /https?:\/\/(?:www\.)?figma\.com\/(?:design|file)\/[A-Za-z0-9]+\/[^\s\)\]\}\"\'<>]+/gi;
    const matches = text.match(figmaUrlPattern);

    if (!matches) {
        return [];
    }

    // Clean up URLs and remove duplicates
    const cleanedUrls = matches.map(function(url) {
        return url.replace(/[,;:.!?]+$/, '');
    });

    return Array.from(new Set(cleanedUrls));
}

/**
 * Extract file ID from Figma URL
 *
 * @param {string} url - Figma URL
 * @returns {string|null} File ID or null
 */
function extractFileId(url) {
    if (!url) return null;

    const match = url.match(/figma\.com\/(?:design|file)\/([A-Za-z0-9]+)/i);
    return match ? match[1] : null;
}

/**
 * Extract node ID from Figma URL
 *
 * @param {string} url - Figma URL with node-id parameter
 * @returns {string|null} Node ID in colon format (e.g., "123:456") or null
 */
function extractNodeId(url) {
    if (!url) return null;

    const match = url.match(/node-id=([0-9]+-[0-9]+)/i);
    if (match) {
        // Convert dash format to colon format: 123-456 -> 123:456
        return match[1].replace('-', ':');
    }
    return null;
}

/**
 * Build Figma URL with specific node ID
 *
 * @param {string} baseUrl - Base Figma URL
 * @param {string} nodeId - Node ID (can be in colon or dash format)
 * @returns {string} Complete Figma URL with node-id parameter
 */
function buildFigmaNodeUrl(baseUrl, nodeId) {
    if (!baseUrl || !nodeId) return baseUrl;

    // Ensure node ID is in dash format for URL
    const urlNodeId = nodeId.replace(':', '-');

    // Remove existing node-id if present
    let cleanUrl = baseUrl.replace(/[?&]node-id=[^&]+/gi, '');

    // Add node-id parameter
    const separator = cleanUrl.includes('?') ? '&' : '?';
    return cleanUrl + separator + 'node-id=' + urlNodeId;
}

/**
 * Get base URL without node-id parameter
 *
 * @param {string} url - Figma URL
 * @returns {string} URL without node-id parameter
 */
function getBaseUrl(url) {
    if (!url) return url;
    return url.replace(/[?&]node-id=[^&]+/gi, '').replace(/[?&]$/, '');
}

/**
 * Fetch Figma layers (screens) from a design URL
 * Uses the figma_get_layers MCP tool
 *
 * @param {string} figmaUrl - Figma design URL
 * @returns {Object} Layers result with children array
 */
function fetchFigmaLayers(figmaUrl) {
    try {
        console.log('Fetching Figma layers from: ' + figmaUrl);
        const result = figma_get_layers({ href: figmaUrl });

        if (typeof result === 'string') {
            return JSON.parse(result);
        }
        return result;
    } catch (error) {
        console.error('Error fetching Figma layers:', error);
        return { children: [] };
    }
}

/**
 * Download screenshot of a Figma node
 * Uses the figma_download_node_image MCP tool
 *
 * @param {string} figmaUrl - Base Figma URL
 * @param {string} nodeId - Node ID to download
 * @param {string} format - Image format ('png' or 'jpg')
 * @param {number} scale - Scale factor (1, 2, or 4)
 * @returns {string|null} File path of downloaded image or null
 */
function downloadNodeScreenshot(figmaUrl, nodeId, format, scale) {
    try {
        format = format || 'png';
        scale = scale || 2;

        console.log('Downloading screenshot for node: ' + nodeId);
        const result = figma_download_node_image({
            href: figmaUrl,
            nodeId: nodeId,
            format: format,
            scale: scale
        });

        // Result should be file path
        if (typeof result === 'string') {
            return result;
        }
        if (result && result.path) {
            return result.path;
        }
        return result;
    } catch (error) {
        console.error('Error downloading node screenshot:', error);
        return null;
    }
}

/**
 * Parse Acceptance Criteria from story description
 * Looks for patterns like "AC 1 -", "AC1:", "Acceptance Criteria:", etc.
 *
 * @param {string} description - Story description text
 * @returns {Object[]} Array of AC objects with {id, title, content}
 */
function parseAcceptanceCriteria(description) {
    if (!description || typeof description !== 'string') {
        return [];
    }

    const acs = [];

    // Pattern 1: "AC 1 - Title" or "AC1 - Title" or "AC 1: Title"
    const acPattern = /(?:^|\n)\s*(?:\*\*)?AC\s*(\d+)\s*[-:]\s*(.+?)(?:\*\*)?(?=\n|$)/gi;

    let match;
    while ((match = acPattern.exec(description)) !== null) {
        const acNumber = match[1];
        const acTitle = match[2].trim();

        // Find content after this AC until next AC or section
        const startPos = match.index + match[0].length;
        const nextAcMatch = description.slice(startPos).match(/\n\s*(?:\*\*)?AC\s*\d+\s*[-:]/i);
        const nextSectionMatch = description.slice(startPos).match(/\n\s*(?:\*+|\#+)\s*(?:Business Rules|Out of Scope|Technical)/i);

        let endPos = description.length;
        if (nextAcMatch) {
            endPos = Math.min(endPos, startPos + nextAcMatch.index);
        }
        if (nextSectionMatch) {
            endPos = Math.min(endPos, startPos + nextSectionMatch.index);
        }

        const acContent = description.slice(startPos, endPos).trim();

        acs.push({
            id: 'AC' + acNumber,
            number: parseInt(acNumber),
            title: acTitle,
            content: acContent,
            fullText: 'AC ' + acNumber + ' - ' + acTitle + '\n' + acContent
        });
    }

    // Sort by AC number
    acs.sort(function(a, b) { return a.number - b.number; });

    return acs;
}

/**
 * Build screen catalog from Figma layers
 * Downloads screenshots and builds metadata for each screen
 *
 * @param {string} figmaUrl - Base Figma URL
 * @param {Object[]} layers - Array of layer objects from figma_get_layers
 * @param {boolean} downloadImages - Whether to download screenshot images
 * @returns {Object[]} Array of screen objects with metadata
 */
function buildScreenCatalog(figmaUrl, layers, downloadImages) {
    if (!layers || !Array.isArray(layers)) {
        return [];
    }

    downloadImages = downloadImages !== false; // default true

    const screens = [];
    const baseUrl = getBaseUrl(figmaUrl);

    layers.forEach(function(layer, index) {
        const screen = {
            id: layer.id,
            name: layer.name || 'Screen ' + (index + 1),
            type: layer.type || 'FRAME',
            width: layer.width,
            height: layer.height,
            nodeUrl: buildFigmaNodeUrl(baseUrl, layer.id),
            imagePath: null
        };

        // Download screenshot if requested
        if (downloadImages) {
            screen.imagePath = downloadNodeScreenshot(baseUrl, layer.id, 'png', 2);
        }

        screens.push(screen);
    });

    return screens;
}

/**
 * Format screen reference as Markdown
 *
 * @param {Object} screen - Screen object from buildScreenCatalog
 * @param {boolean} includeAttachment - Whether to include attachment reference
 * @returns {string} Markdown formatted screen reference
 */
function formatScreenReference(screen, includeAttachment) {
    let md = '[' + screen.name + '](' + screen.nodeUrl + ')';

    if (includeAttachment && screen.imagePath) {
        const filename = screen.imagePath.split(/[\/\\]/).pop();
        md += ' | [View attachment](' + filename + ')';
    }

    return md;
}

/**
 * Generate design references section in Markdown
 *
 * @param {Object[]} screens - Array of screen objects
 * @param {Object[]} matches - Array of {acId, screenIds} matching results
 * @param {string} mode - Output mode: 'ac_driven', 'screen_centric', 'hybrid'
 * @returns {string} Markdown formatted design references
 */
function generateDesignReferencesMarkdown(screens, matches, mode) {
    mode = mode || 'ac_driven';

    let md = '';

    if (mode === 'screen_centric' || mode === 'hybrid') {
        md += '## Design References\n\n';
        md += '| Screen | Description | Figma Link |\n';
        md += '|--------|-------------|------------|\n';

        screens.forEach(function(screen) {
            const linkedAcs = matches
                .filter(function(m) { return m.screenIds && m.screenIds.includes(screen.id); })
                .map(function(m) { return m.acId; })
                .join(', ');

            md += '| ' + screen.name + ' | ' + (linkedAcs || '-') + ' | [View](' + screen.nodeUrl + ') |\n';
        });

        md += '\n';
    }

    return md;
}

// Export functions for use by other modules
module.exports = {
    extractFigmaUrlFromText,
    extractAllFigmaUrls,
    extractFileId,
    extractNodeId,
    buildFigmaNodeUrl,
    getBaseUrl,
    fetchFigmaLayers,
    downloadNodeScreenshot,
    parseAcceptanceCriteria,
    buildScreenCatalog,
    formatScreenReference,
    generateDesignReferencesMarkdown
};
