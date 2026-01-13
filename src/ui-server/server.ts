/**
 * Express server for Schedule Configuration UI Tool
 * Provides REST API endpoints for configuration management, JIRA operations,
 * story management, and Gantt chart generation.
 */

import express from 'express';
import cors from 'cors';
import { logger } from '../utils/logger';
import configRoutes from './routes/config';
import jiraRoutes from './routes/jira';
import storiesRoutes from './routes/stories';
import ganttRoutes from './routes/gantt';
import teamEstimateRoutes from './routes/team-estimate';
import scheduleRoutes from './routes/schedule';
import workflowRoutes from './routes/workflow';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/config', configRoutes);
app.use('/api/config/team-estimate', teamEstimateRoutes);
app.use('/api/jira', jiraRoutes);
app.use('/api/stories', storiesRoutes);
app.use('/api/gantt', ganttRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/workflow', workflowRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(`Error: ${err.message}`, { stack: err.stack });
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`UI Server running on http://localhost:${PORT}`);
  });
}

export default app;
