/**
 * Unit tests for config routes
 * Tests route handlers with mocked file system operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { Express } from 'express';
import { getApiClientForApp } from '../../../__tests__/helpers/api-client';
import { validJiraConfig, invalidJiraConfig } from '../../../__tests__/fixtures';

// Mock fs module
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();

vi.mock('fs', () => ({
  existsSync: (path: string) => mockExistsSync(path),
  readFileSync: (path: string, encoding: string) => mockReadFileSync(path, encoding),
  writeFileSync: (path: string, data: string, encoding: string) => mockWriteFileSync(path, data, encoding),
}));

// Mock logger
vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Import router after mocks are set up
import configRoutes from '../config';

describe('Config Routes - Unit Tests', () => {
  let app: Express;
  let request: ReturnType<typeof getApiClientForApp>;

  beforeEach(() => {
    // Reset mocks (resetAllMocks clears both calls and implementations)
    vi.resetAllMocks();
    
    // Create fresh app instance
    app = express();
    app.use(express.json());
    app.use('/api/config', configRoutes);
    request = getApiClientForApp(app);
  });

  describe('GET /api/config/jira', () => {
    it('should return 404 when config file does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      const response = await request.get('/api/config/jira');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    it('should mask jiraApiToken in response', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(validJiraConfig));

      const response = await request.get('/api/config/jira');

      expect(response.status).toBe(200);
      expect(response.body.jiraApiToken).toBe('***hidden***');
      expect(response.body.jiraPath).toBe(validJiraConfig.jiraPath);
      expect(response.body.jiraEmail).toBe(validJiraConfig.jiraEmail);
      expect(response.body.projectName).toBe(validJiraConfig.projectName);
    });

    it('should return 500 for malformed JSON', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('{ invalid json }');

      const response = await request.get('/api/config/jira');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to load JIRA config');
      expect(response.body.message).toContain('Invalid JSON');
    });

    it('should handle BOM in file content', async () => {
      mockExistsSync.mockReturnValue(true);
      const contentWithBOM = '\uFEFF' + JSON.stringify(validJiraConfig);
      mockReadFileSync.mockReturnValue(contentWithBOM);

      const response = await request.get('/api/config/jira');

      expect(response.status).toBe(200);
      expect(response.body.jiraPath).toBe(validJiraConfig.jiraPath);
    });

    it('should return 500 when file read fails', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const response = await request.get('/api/config/jira');

      expect(response.status).toBe(500);
      expect(response.body.message).toContain('Failed to read file');
    });
  });

  describe('PUT /api/config/jira', () => {
    it('should validate required fields', async () => {
      const response = await request.put('/api/config/jira').send({
        jiraPath: 'https://test.atlassian.net',
        // missing other required fields
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should reject invalid config data', async () => {
      const response = await request.put('/api/config/jira').send(null);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid config data');
    });

    it('should save valid config', async () => {
      const response = await request.put('/api/config/jira').send(validJiraConfig);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it('should return 500 when write fails', async () => {
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('Disk full');
      });

      const response = await request.put('/api/config/jira').send(validJiraConfig);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to save JIRA config');
    });
  });

  describe('GET /api/config/schedule', () => {
    it('should return 404 when config file does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      const response = await request.get('/api/config/schedule');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('schedule_config.json not found');
    });

    it('should return config when file exists', async () => {
      const scheduleConfig = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
      };
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(scheduleConfig));

      const response = await request.get('/api/config/schedule');

      expect(response.status).toBe(200);
      expect(response.body.projectStartDate).toBe(scheduleConfig.projectStartDate);
    });
  });

  describe('PUT /api/config/schedule', () => {
    it('should validate config is an object', async () => {
      const response = await request.put('/api/config/schedule').send(null);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid config data');
    });

    it('should save valid schedule config', async () => {
      const scheduleConfig = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
      };

      const response = await request.put('/api/config/schedule').send(scheduleConfig);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it('should normalize JQL by adding ORDER BY key ASC if missing', async () => {
      const scheduleConfig = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        jql: 'project = TEST AND issuetype = Story',
      };

      const response = await request.put('/api/config/schedule').send(scheduleConfig);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockWriteFileSync).toHaveBeenCalled();
      
      // Verify that JQL was normalized
      const writeCall = mockWriteFileSync.mock.calls[0];
      const savedConfig = JSON.parse(writeCall[1]);
      expect(savedConfig.jql).toBe('project = TEST AND issuetype = Story ORDER BY key ASC');
    });

    it('should not modify JQL if it already has ORDER BY key ASC', async () => {
      const scheduleConfig = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        jql: 'project = TEST AND issuetype = Story ORDER BY key ASC',
      };

      const response = await request.put('/api/config/schedule').send(scheduleConfig);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Verify that JQL was not modified
      const writeCall = mockWriteFileSync.mock.calls[0];
      const savedConfig = JSON.parse(writeCall[1]);
      expect(savedConfig.jql).toBe('project = TEST AND issuetype = Story ORDER BY key ASC');
    });

    it('should handle case-insensitive ORDER BY clause', async () => {
      const scheduleConfig = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        jql: 'project = TEST order by key asc',
      };

      const response = await request.put('/api/config/schedule').send(scheduleConfig);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Verify that JQL was not modified (already has ORDER BY)
      const writeCall = mockWriteFileSync.mock.calls[0];
      const savedConfig = JSON.parse(writeCall[1]);
      expect(savedConfig.jql).toBe('project = TEST order by key asc');
    });

    it('should handle empty JQL', async () => {
      const scheduleConfig = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        jql: '',
      };

      const response = await request.put('/api/config/schedule').send(scheduleConfig);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Verify that empty JQL is preserved
      const writeCall = mockWriteFileSync.mock.calls[0];
      const savedConfig = JSON.parse(writeCall[1]);
      expect(savedConfig.jql).toBe('');
    });
  });

  describe('GET /api/config/validate', () => {
    it('should return valid when both configs are valid', async () => {
      const scheduleConfig = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
      };

      mockExistsSync.mockImplementation((path: string) => {
        return path.includes('schedule_config') || path.includes('jira-config');
      });
      mockReadFileSync.mockImplementation((path: string) => {
        if (path.includes('schedule_config')) {
          return JSON.stringify(scheduleConfig);
        }
        return JSON.stringify(validJiraConfig);
      });

      const response = await request.get('/api/config/validate');

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body.errors).toBeUndefined();
    });

    it('should return errors when configs are invalid', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidJiraConfig));

      const response = await request.get('/api/config/validate');

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.length).toBeGreaterThan(0);
    });
  });
});
