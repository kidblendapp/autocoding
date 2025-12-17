/**
 * Unit tests for configuration loader.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';
import { loadConfigFile } from '../loader';
import { logger } from '../../utils/logger';

describe('Config Loader', () => {
  const testConfigPath = '/tmp/test-config.json';

  beforeEach(() => {
    logger.clear();
    logger.setSuppressWarnings(true);
    
    // Clean up test file if it exists
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  afterEach(() => {
    // Clean up test file
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  describe('loadConfigFile', () => {
    it('should load valid JSON configuration file', () => {
      const configContent = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        velocity: 20,
      };
      writeFileSync(testConfigPath, JSON.stringify(configContent));

      const result = loadConfigFile({ configPath: testConfigPath });
      
      expect(result.projectStartDate).toBe('2024-02-01');
      expect(result.sprintDurationDays).toBe(10);
      expect(result.velocity).toBe(20);
    });

    it('should use default path (config.json in cwd) when no path provided', () => {
      const defaultPath = resolve(process.cwd(), 'config.json');
      const configContent = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        velocity: 20,
      };
      
      // Only create file if it doesn't exist (to avoid overwriting real config)
      if (!existsSync(defaultPath)) {
        writeFileSync(defaultPath, JSON.stringify(configContent));
        
        try {
          const result = loadConfigFile();
          expect(result.projectStartDate).toBe('2024-02-01');
        } finally {
          // Clean up
          if (existsSync(defaultPath)) {
            unlinkSync(defaultPath);
          }
        }
      }
    });

    it('should throw error for non-existent file', () => {
      expect(() => {
        loadConfigFile({ configPath: '/tmp/non-existent-config.json' });
      }).toThrow('Configuration file not found');
    });

    it('should throw error for invalid JSON format', () => {
      writeFileSync(testConfigPath, '{ invalid json }');

      expect(() => {
        loadConfigFile({ configPath: testConfigPath });
      }).toThrow('Invalid JSON format');
    });

    it('should throw error for malformed JSON', () => {
      writeFileSync(testConfigPath, '{"projectStartDate": "2024-02-01",}');

      expect(() => {
        loadConfigFile({ configPath: testConfigPath });
      }).toThrow('Invalid JSON format');
    });

    it('should handle empty JSON object', () => {
      writeFileSync(testConfigPath, '{}');

      const result = loadConfigFile({ configPath: testConfigPath });
      expect(result).toEqual({});
    });

    it('should handle JSON with extra fields', () => {
      const configContent = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        velocity: 20,
        extraField: 'should be ignored',
      };
      writeFileSync(testConfigPath, JSON.stringify(configContent));

      const result = loadConfigFile({ configPath: testConfigPath });
      expect(result.projectStartDate).toBe('2024-02-01');
      expect(result.sprintDurationDays).toBe(10);
      expect(result.velocity).toBe(20);
      expect((result as any).extraField).toBe('should be ignored');
    });

    it('should resolve absolute paths correctly', () => {
      const configContent = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        velocity: 20,
      };
      writeFileSync(testConfigPath, JSON.stringify(configContent));

      const result = loadConfigFile({ configPath: testConfigPath });
      expect(result.projectStartDate).toBe('2024-02-01');
    });

    it('should resolve relative paths correctly', () => {
      const relativePath = './test-config-relative.json';
      const absolutePath = resolve(process.cwd(), relativePath);
      const configContent = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        velocity: 20,
      };
      
      try {
        writeFileSync(absolutePath, JSON.stringify(configContent));
        
        const result = loadConfigFile({ configPath: relativePath });
        expect(result.projectStartDate).toBe('2024-02-01');
      } finally {
        if (existsSync(absolutePath)) {
          unlinkSync(absolutePath);
        }
      }
    });
  });
});
