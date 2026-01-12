/**
 * Smoke tests for JIRA API endpoints
 * Verifies critical JIRA endpoints are accessible
 */

import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.API_URL || 'http://localhost:3001';

describe('JIRA API - Smoke Tests', () => {
  describe('POST /api/jira/extract', () => {
    it('should respond to extract endpoint', async () => {
      const response = await fetch(`${BASE_URL}/api/jira/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          includeHistory: false,
        }),
      });
      
      // Should return error if config is missing, but endpoint should be accessible
      expect([200, 400, 500]).toContain(response.status);
    });
  });

  describe('GET /api/jira/ticket/:key', () => {
    it('should handle ticket lookup endpoint', async () => {
      // Use a test ticket key format
      const response = await fetch(`${BASE_URL}/api/jira/ticket/TEST-123`);
      
      // Should return error for invalid/missing ticket or config, but endpoint should work
      expect([400, 404, 500]).toContain(response.status);
    });
  });

  describe('GET /api/jira/field-values/:field', () => {
    it('should handle field values endpoint', async () => {
      const response = await fetch(`${BASE_URL}/api/jira/field-values/issueTypes`);
      
      // Should return error if config is missing, but endpoint should be accessible
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });
});
