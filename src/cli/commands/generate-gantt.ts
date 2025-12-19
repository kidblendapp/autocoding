/**
 * CLI command for Gantt chart generation.
 * 
 * Transforms CSV schedule data into an interactive HTML Gantt chart visualization.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { transformScheduleToGanttData } from '../../visualization/gantt-generator';
import { logger } from '../../utils/logger';

const execAsync = promisify(exec);

export interface GenerateGanttOptions {
  /** Path to CSV schedule file (default: outputs/jira-team-schedule.csv) */
  input?: string;
  
  /** Path to output HTML file (default: outputs/gantt-chart.html) */
  output?: string;
  
  /** Open in browser after generation */
  open?: boolean;
}

/**
 * Opens a file in the default system browser.
 * 
 * @param filePath - Path to HTML file to open
 * @throws Error if browser cannot be opened
 */
async function openBrowser(filePath: string): Promise<void> {
  const platform = process.platform;
  let command: string;

  // Normalize path for Windows
  const normalizedPath = filePath.replace(/\//g, '\\');

  if (platform === 'win32') {
    // Windows
    command = `start "" "${normalizedPath}"`;
  } else if (platform === 'darwin') {
    // macOS
    command = `open "${filePath}"`;
  } else {
    // Linux and others
    command = `xdg-open "${filePath}"`;
  }

  try {
    await execAsync(command);
    logger.info(`Opened Gantt chart in browser: ${filePath}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to open browser automatically: ${errorMsg}`);
    logger.info(`Please open the file manually: ${filePath}`);
  }
}

/**
 * Generates HTML Gantt chart from CSV schedule data.
 * 
 * @param options - Command options
 * @throws Error if generation fails
 */
export async function generateGantt(options: GenerateGanttOptions = {}): Promise<void> {
  const inputPath = options.input || 'outputs/jira-team-schedule.csv';
  const outputPath = options.output || 'outputs/gantt-chart.html';

  try {
    // Validate input file exists
    if (!existsSync(inputPath)) {
      throw new Error(`Input CSV file not found: ${inputPath}`);
    }

    logger.info(`Reading schedule data from ${inputPath}`);

    // Transform CSV to Gantt data
    const ganttData = transformScheduleToGanttData(inputPath);

    if (ganttData.items.length === 0) {
      logger.warn('No schedule items found in CSV file');
      return;
    }

    logger.info(`Generated ${ganttData.items.length} Gantt items across ${ganttData.groups.length} groups`);

    // Read HTML template
    // Try both compiled path (dist/visualization/) and source path (src/visualization/)
    const compiledTemplatePath = join(__dirname, '../../visualization/gantt-viewer.html');
    const sourceTemplatePath = join(process.cwd(), 'src/visualization/gantt-viewer.html');
    
    let templatePath: string;
    if (existsSync(compiledTemplatePath)) {
      templatePath = compiledTemplatePath;
    } else if (existsSync(sourceTemplatePath)) {
      templatePath = sourceTemplatePath;
    } else {
      throw new Error(`HTML template not found. Tried: ${compiledTemplatePath} and ${sourceTemplatePath}`);
    }

    let htmlTemplate = readFileSync(templatePath, 'utf-8');

    // Convert Date objects to ISO strings for JSON serialization
    const serializableData = {
      items: ganttData.items.map(item => ({
        ...item,
        start: item.start.toISOString(),
        end: item.end.toISOString(),
      })),
      groups: ganttData.groups,
    };

    // Embed Gantt data as JSON in the HTML template
    const jsonData = JSON.stringify(serializableData, null, 2);
    htmlTemplate = htmlTemplate.replace('{{GANTT_DATA}}', jsonData);

    // Write HTML file
    writeFileSync(outputPath, htmlTemplate, 'utf-8');
    logger.info(`✅ Gantt chart generated: ${outputPath}`);

    // Open in browser if requested
    if (options.open) {
      await openBrowser(outputPath);
    } else {
      logger.info(`Open the file in your browser to view: ${outputPath}`);
    }

  } catch (error) {
    logger.error(`Gantt chart generation failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

