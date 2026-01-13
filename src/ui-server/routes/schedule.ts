/**
 * Schedule generation API routes
 * Handles team schedule generation from decomposed stories
 */

import express from 'express';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { logger } from '../../utils/logger';

const router = express.Router();

/**
 * POST /api/schedule/generate
 * Generate team schedule from decomposed stories
 */
router.post('/generate', async (req, res) => {
  try {
    const { inputFile } = req.body;
    
    // Default to jira-export CSV (schedule generation works with extracted tickets, not decomposed)
    const csvPath = inputFile 
      ? join(process.cwd(), inputFile)
      : join(process.cwd(), 'outputs', 'jira-export.csv');
    
    if (!existsSync(csvPath)) {
      return res.status(404).json({ 
        error: `Input file not found: ${csvPath}. Please run extraction first.` 
      });
    }
    
    // Load schedule config
    const scheduleConfigPath = join(process.cwd(), 'schedule_config.json');
    if (!existsSync(scheduleConfigPath)) {
      return res.status(400).json({ 
        error: 'schedule_config.json not found. Please configure project settings first.' 
      });
    }
    
    const scheduleConfig = JSON.parse(readFileSync(scheduleConfigPath, 'utf-8'));
    
    // Import the schedule generation function
    // Note: This is a simplified version that calls the main function from generate-team-schedule-from-jira.ts
    // In a real implementation, you might want to refactor that script to export a function
    
    // For now, we'll use a child process to run the script
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    // Set environment variable to use the decomposed CSV
    process.env.INPUT_CSV_PATH = csvPath;
    
    // Run the schedule generation script
    const scriptPath = join(process.cwd(), 'generate-team-schedule-from-jira.ts');
    
    try {
      // Use tsx to run the TypeScript file
      const { stdout, stderr } = await execAsync(`npx tsx ${scriptPath}`, {
        cwd: process.cwd(),
        env: { ...process.env, INPUT_CSV_PATH: csvPath }
      });
      
      if (stderr && !stderr.includes('warning')) {
        logger.warn(`Schedule generation stderr: ${stderr}`);
      }
      
      const outputPath = join(process.cwd(), 'outputs', 'jira-team-schedule.csv');
      
      if (!existsSync(outputPath)) {
        throw new Error('Schedule generation completed but output file was not created');
      }
      
      res.json({
        success: true,
        message: 'Schedule generated successfully',
        outputPath: 'outputs/jira-team-schedule.csv'
      });
    } catch (execError: any) {
      logger.error(`Error running schedule generation: ${execError.message}`);
      throw new Error(`Schedule generation failed: ${execError.message}`);
    }
    
  } catch (error) {
    logger.error(`Error generating schedule: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: 'Failed to generate schedule',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
