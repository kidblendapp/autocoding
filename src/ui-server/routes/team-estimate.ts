/**
 * Team estimate configuration API routes
 * Handles loading and saving of team-estimate-config.json
 */

import express from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../../utils/logger';

const router = express.Router();

const TEAM_ESTIMATE_CONFIG_PATH = join(process.cwd(), 'team-estimate-config.json');

/**
 * GET /api/config/team-estimate
 * Load team-estimate-config.json
 */
router.get('/', (req, res) => {
  try {
    if (!existsSync(TEAM_ESTIMATE_CONFIG_PATH)) {
      return res.status(404).json({ error: 'team-estimate-config.json not found' });
    }
    
    const config = JSON.parse(readFileSync(TEAM_ESTIMATE_CONFIG_PATH, 'utf-8'));
    res.json(config);
  } catch (error) {
    logger.error(`Error loading team estimate config: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: 'Failed to load team estimate config',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * PUT /api/config/team-estimate
 * Save team-estimate-config.json
 */
router.put('/', (req, res) => {
  try {
    const config = req.body;
    
    // Basic validation
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'Invalid config data' });
    }
    
    writeFileSync(TEAM_ESTIMATE_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    logger.info('Team estimate config saved successfully');
    res.json({ success: true, message: 'Team estimate config saved successfully' });
  } catch (error) {
    logger.error(`Error saving team estimate config: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: 'Failed to save team estimate config',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
