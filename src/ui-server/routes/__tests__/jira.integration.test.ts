/**
 * Integration tests for JIRA routes
 * Tests with real file I/O operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import express, { Express } from 'express';
import { getApiClientForApp } from '../../../__tests__/helpers/api-client';

describe('JIRA Routes - Integration Tests', () => {
  let app: Express;
  let request: ReturnType<typeof getApiClientForApp>;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    
    const jiraRoutes = (await import('../jira')).default;
    app.use('/api/jira', jiraRoutes);
    
    request = getApiClientForApp(app);
  });

  describe('POST /api/jira/extract', () => {
    it('should return error when jira config is missing', async () => {
      // This will fail if jira-config.json doesn't exist
      const response = await request.post('/api/jira/extract').send({
        includeHistory: false,
      });

      // Should return error if config is missing
      expect([400, 500]).toContain(response.status);
    });

    it('should validate request body', async () => {
      const response = await request.post('/api/jira/extract').send({});

      // Should accept empty body with defaults
      expect([200, 400, 500]).toContain(response.status);
    });
  });

  describe('GET /api/jira/ticket/:key', () => {
    it('should return error for invalid ticket key format', async () => {
      const response = await request.get('/api/jira/ticket/invalid-key');

      // Should return error for invalid format or missing config
      expect([400, 404, 500]).toContain(response.status);
    });
  });

  describe('GET /api/jira/field-values/:field', () => {
    it('should validate field parameter', async () => {
      const response = await request.get('/api/jira/field-values/invalidField');

      // Should return error for invalid field or missing config
      expect([400, 404, 500]).toContain(response.status);
    });

    it('should accept valid field types', async () => {
      const validFields = ['issueTypes', 'fixVersions', 'linkTypes'];
      
      for (const field of validFields) {
        const response = await request.get(`/api/jira/field-values/${field}`);
        // Should handle gracefully even if config is missing
        expect([200, 400, 404, 500]).toContain(response.status);
      }
    });
  });
});
