/**
 * Gantt chart generation API routes
 * Handles Excel and HTML Gantt chart generation
 */

import express from 'express';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../../utils/logger';
import { generateGantt } from '../../cli/commands/generate-gantt';
import type { GroupingLevel } from '../../visualization/gantt-generator';

const router = express.Router();

const OUTPUTS_DIR = join(process.cwd(), 'outputs');

/**
 * POST /api/gantt/excel
 * Generate Excel Gantt chart
 */
router.post('/excel', async (req, res) => {
  try {
    const { inputFile } = req.body;
    
    // TODO: Integrate with existing generate-team-schedule-xlsx.ts logic
    // For now, return a placeholder response
    
    logger.info('Excel Gantt generation requested');
    
    res.json({
      success: true,
      message: 'Excel Gantt generation not yet implemented',
      filePath: null
    });
  } catch (error) {
    logger.error(`Error generating Excel Gantt: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: 'Failed to generate Excel Gantt',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/gantt/html
 * Generate HTML Gantt chart
 */
router.post('/html', async (req, res) => {
  try {
    const { inputFile, outputFile, groupingLevels } = req.body;
    
    const inputPath = inputFile || join(OUTPUTS_DIR, 'jira-team-schedule.csv');
    const outputPath = outputFile || join(OUTPUTS_DIR, 'gantt-chart.html');
    
    if (!existsSync(inputPath)) {
      return res.status(404).json({ 
        error: 'Input file not found',
        inputPath 
      });
    }
    
    // Use existing generateGantt function
    await generateGantt({
      input: inputPath,
      output: outputPath,
      open: false,
      groupingLevels: groupingLevels as GroupingLevel[] | undefined
    });
    
    logger.info(`HTML Gantt chart generated: ${outputPath}`);
    
    res.json({
      success: true,
      message: 'HTML Gantt chart generated successfully',
      filePath: outputPath
    });
  } catch (error) {
    logger.error(`Error generating HTML Gantt: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: 'Failed to generate HTML Gantt',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/gantt/preview
 * Get Gantt data for preview
 */
router.get('/preview', async (req, res) => {
  try {
    const { inputFile } = req.query;
    
    const inputPath = inputFile as string || join(OUTPUTS_DIR, 'jira-team-schedule.csv');
    
    if (!existsSync(inputPath)) {
      return res.status(404).json({ 
        error: 'Input file not found',
        inputPath 
      });
    }
    
    // TODO: Parse CSV and return Gantt data structure
    // For now, return a placeholder response
    
    logger.info('Gantt preview requested');
    
    res.json({
      success: true,
      message: 'Gantt preview not yet implemented',
      items: [],
      groups: []
    });
  } catch (error) {
    logger.error(`Error generating Gantt preview: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: 'Failed to generate Gantt preview',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
