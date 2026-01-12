/**
 * Smoke tests for config API endpoints
 * Verifies critical config endpoints are working
 */

import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.API_URL || 'http://localhost:3001';

describe('Config API - Smoke Tests', () => {
  describe('GET /api/config/jira', () => {
    it('should respond to JIRA config endpoint', async () => {
      const response = await fetch(`${BASE_URL}/api/config/jira`);
      
      // Should return either 200 (if config exists) or 404 (if not)
      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        const data = await response.json();
        // If config exists, token should be masked
        if (data.jiraApiToken) {
          expect(data.jiraApiToken).toBe('***hidden***');
        }
      } else {
        const data = await response.json();
        expect(data.error).toContain('not found');
      }
    });

    it('should mask API token in response', async () => {
      const response = await fetch(`${BASE_URL}/api/config/jira`);
      
      if (response.status === 200) {
        const data = await response.json();
        if (data.jiraApiToken) {
          expect(data.jiraApiToken).toBe('***hidden***');
        }
      }
    });
  });

  describe('GET /api/config/schedule', () => {
    it('should respond to schedule config endpoint', async () => {
      const response = await fetch(`${BASE_URL}/api/config/schedule`);
      
      // Should return either 200 (if config exists) or 404 (if not)
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('GET /api/config/validate', () => {
    it('should validate configuration', async () => {
      const response = await fetch(`${BASE_URL}/api/config/validate`);
      
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty('valid');
      expect(typeof data.valid).toBe('boolean');
    });
  });

  describe('PUT /api/config/jira', () => {
    it('should validate required fields', async () => {
      const response = await fetch(`${BASE_URL}/api/config/jira`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jiraPath: '',  // missing required field
        }),
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Missing required fields');
    });

    it('should reject invalid JSON', async () => {
      const response = await fetch(`${BASE_URL}/api/config/jira`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      });
      
      // Should handle invalid JSON gracefully
      expect([400, 500]).toContain(response.status);
    });
  });
});
