/**
 * Smoke tests for health endpoint
 * Verifies the server is running and responding
 */

import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.API_URL || 'http://localhost:3001';

describe('Health Check - Smoke Tests', () => {
  it('should respond to health check', async () => {
    const response = await fetch(`${BASE_URL}/health`);
    
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(data.status).toBe('ok');
    expect(data).toHaveProperty('timestamp');
  });

  it('should respond within reasonable time', async () => {
    const startTime = Date.now();
    const response = await fetch(`${BASE_URL}/health`);
    const endTime = Date.now();
    
    expect(response.ok).toBe(true);
    expect(endTime - startTime).toBeLessThan(5000); // Should respond within 5 seconds
  });
});
