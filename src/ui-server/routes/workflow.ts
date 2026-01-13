/**
 * Workflow status API routes
 * Checks which workflow steps have been completed
 */

import express from 'express';
import { existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../../utils/logger';

const router = express.Router();

/**
 * GET /api/workflow/status
 * Check status of workflow steps
 */
router.get('/status', (req, res) => {
  try {
    const extractedCsv = join(process.cwd(), 'outputs', 'jira-export.csv');
    const decomposedCsv = join(process.cwd(), 'outputs', 'decomposed-stories.csv');
    const scheduleCsv = join(process.cwd(), 'outputs', 'jira-team-schedule.csv');
    
    const status = {
      extracted: existsSync(extractedCsv),
      decomposed: existsSync(decomposedCsv),
      scheduleGenerated: existsSync(scheduleCsv),
      extractedPath: 'outputs/jira-export.csv',
      decomposedPath: 'outputs/decomposed-stories.csv',
      schedulePath: 'outputs/jira-team-schedule.csv'
    };
    
    res.json({
      success: true,
      status
    });
  } catch (error) {
    logger.error(`Error checking workflow status: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: 'Failed to check workflow status',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
