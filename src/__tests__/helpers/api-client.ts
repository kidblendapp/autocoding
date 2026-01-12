/**
 * API client helper for testing Express routes
 */

import request from 'supertest';
import express, { Express } from 'express';
import app from '../../ui-server/server';

/**
 * Create a test app instance
 * This can be used to create isolated app instances for testing
 */
export function createTestApp(): Express {
  const testApp = express();
  testApp.use(express.json());
  testApp.use(express.urlencoded({ extended: true }));
  return testApp;
}

/**
 * Get a request client for the main app
 */
export function getApiClient() {
  return request(app);
}

/**
 * Get a request client for a custom app instance
 */
export function getApiClientForApp(testApp: Express) {
  return request(testApp);
}

/**
 * Helper to make API requests with better error handling
 */
export class ApiTestClient {
  private client: ReturnType<typeof request>;

  constructor(appInstance?: Express) {
    this.client = appInstance ? request(appInstance) : request(app);
  }

  async get(endpoint: string) {
    return this.client.get(endpoint);
  }

  async post(endpoint: string, data?: any) {
    return this.client.post(endpoint).send(data);
  }

  async put(endpoint: string, data?: any) {
    return this.client.put(endpoint).send(data);
  }

  async delete(endpoint: string) {
    return this.client.delete(endpoint);
  }
}
