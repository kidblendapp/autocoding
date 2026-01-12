/**
 * File utility helpers for tests
 */

import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Create a temporary config file with the provided data
 */
export function createTempConfig(data: object, filename?: string): string {
  const tempPath = join(
    tmpdir(),
    filename || `test-config-${Date.now()}-${Math.random().toString(36).substring(7)}.json`
  );
  writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  return tempPath;
}

/**
 * Clean up temporary files
 */
export function cleanupTempFiles(paths: string[]): void {
  paths.forEach(p => {
    try {
      if (existsSync(p)) {
        unlinkSync(p);
      }
    } catch (error) {
      // Ignore cleanup errors
      console.warn(`Failed to cleanup file ${p}:`, error);
    }
  });
}

/**
 * Create a temporary directory
 */
export function createTempDir(prefix = 'test-'): string {
  const tempDir = join(tmpdir(), `${prefix}${Date.now()}-${Math.random().toString(36).substring(7)}`);
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

/**
 * Create a config file in a specific directory
 */
export function createConfigInDir(dir: string, filename: string, data: object): string {
  const filePath = join(dir, filename);
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return filePath;
}
