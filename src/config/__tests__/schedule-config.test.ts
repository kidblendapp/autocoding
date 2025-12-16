/**
 * Unit tests for schedule configuration singleton.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { scheduleConfig } from '../schedule-config';
import { logger } from '../../utils/logger';

describe('Schedule Config Singleton', () => {
  const testConfigPath = '/tmp/test-schedule-config.json';

  beforeEach(() => {
    logger.clear();
    logger.setSuppressWarnings(true);
    scheduleConfig.reset();
    
    // Clean up test file if it exists
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  afterEach(() => {
    scheduleConfig.reset();
    // Clean up test file
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  describe('initialize', () => {
    it('should initialize with valid configuration', () => {
      const configContent = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        velocity: 20,
      };
      writeFileSync(testConfigPath, JSON.stringify(configContent));

      scheduleConfig.initialize({ configPath: testConfigPath });

      expect(scheduleConfig.isInitialized()).toBe(true);
      expect(scheduleConfig.getProjectStartDate()).toBe('2024-02-01');
      expect(scheduleConfig.getSprintDurationDays()).toBe(10);
      expect(scheduleConfig.getVelocity()).toBe(20);
    });

    it('should throw error when initializing twice', () => {
      const configContent = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        velocity: 20,
      };
      writeFileSync(testConfigPath, JSON.stringify(configContent));

      scheduleConfig.initialize({ configPath: testConfigPath });

      expect(() => {
        scheduleConfig.initialize({ configPath: testConfigPath });
      }).toThrow('already been initialized');
    });

    it('should throw error for invalid configuration', () => {
      const configContent = {
        projectStartDate: 'invalid-date',
        sprintDurationDays: 10,
        velocity: 20,
      };
      writeFileSync(testConfigPath, JSON.stringify(configContent));

      expect(() => {
        scheduleConfig.initialize({ configPath: testConfigPath });
      }).toThrow('Configuration validation failed');
    });

    it('should throw error for missing configuration file', () => {
      expect(() => {
        scheduleConfig.initialize({ configPath: '/tmp/non-existent.json' });
      }).toThrow('Configuration file not found');
    });

    it('should use default path when no configPath provided', () => {
      const defaultPath = 'config.json';
      const configContent = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        velocity: 20,
      };
      
      // Only test if config.json doesn't exist (to avoid overwriting real config)
      if (!existsSync(defaultPath)) {
        try {
          writeFileSync(defaultPath, JSON.stringify(configContent));
          
          scheduleConfig.initialize();
          
          expect(scheduleConfig.isInitialized()).toBe(true);
        } finally {
          if (existsSync(defaultPath)) {
            unlinkSync(defaultPath);
          }
        }
      }
    });
  });

  describe('getProjectStartDate', () => {
    it('should return project start date after initialization', () => {
      const configContent = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        velocity: 20,
      };
      writeFileSync(testConfigPath, JSON.stringify(configContent));

      scheduleConfig.initialize({ configPath: testConfigPath });

      expect(scheduleConfig.getProjectStartDate()).toBe('2024-02-01');
    });

    it('should throw error if not initialized', () => {
      expect(() => {
        scheduleConfig.getProjectStartDate();
      }).toThrow('has not been initialized');
    });
  });

  describe('getSprintDurationDays', () => {
    it('should return sprint duration days after initialization', () => {
      const configContent = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        velocity: 20,
      };
      writeFileSync(testConfigPath, JSON.stringify(configContent));

      scheduleConfig.initialize({ configPath: testConfigPath });

      expect(scheduleConfig.getSprintDurationDays()).toBe(10);
    });

    it('should throw error if not initialized', () => {
      expect(() => {
        scheduleConfig.getSprintDurationDays();
      }).toThrow('has not been initialized');
    });
  });

  describe('getVelocity', () => {
    it('should return velocity after initialization', () => {
      const configContent = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        velocity: 20,
      };
      writeFileSync(testConfigPath, JSON.stringify(configContent));

      scheduleConfig.initialize({ configPath: testConfigPath });

      expect(scheduleConfig.getVelocity()).toBe(20);
    });

    it('should throw error if not initialized', () => {
      expect(() => {
        scheduleConfig.getVelocity();
      }).toThrow('has not been initialized');
    });
  });

  describe('getConfig', () => {
    it('should return complete configuration after initialization', () => {
      const configContent = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        velocity: 20,
      };
      writeFileSync(testConfigPath, JSON.stringify(configContent));

      scheduleConfig.initialize({ configPath: testConfigPath });

      const config = scheduleConfig.getConfig();
      expect(config).toEqual({
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        velocity: 20,
      });
    });

    it('should return a copy that cannot modify original', () => {
      const configContent = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        velocity: 20,
      };
      writeFileSync(testConfigPath, JSON.stringify(configContent));

      scheduleConfig.initialize({ configPath: testConfigPath });

      const config = scheduleConfig.getConfig();
      (config as any).projectStartDate = '2025-01-01';

      // Original should not be modified
      expect(scheduleConfig.getProjectStartDate()).toBe('2024-02-01');
    });

    it('should throw error if not initialized', () => {
      expect(() => {
        scheduleConfig.getConfig();
      }).toThrow('has not been initialized');
    });
  });

  describe('isInitialized', () => {
    it('should return false before initialization', () => {
      expect(scheduleConfig.isInitialized()).toBe(false);
    });

    it('should return true after initialization', () => {
      const configContent = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        velocity: 20,
      };
      writeFileSync(testConfigPath, JSON.stringify(configContent));

      scheduleConfig.initialize({ configPath: testConfigPath });

      expect(scheduleConfig.isInitialized()).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset configuration state', () => {
      const configContent = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        velocity: 20,
      };
      writeFileSync(testConfigPath, JSON.stringify(configContent));

      scheduleConfig.initialize({ configPath: testConfigPath });
      expect(scheduleConfig.isInitialized()).toBe(true);

      scheduleConfig.reset();
      expect(scheduleConfig.isInitialized()).toBe(false);

      expect(() => {
        scheduleConfig.getProjectStartDate();
      }).toThrow('has not been initialized');
    });
  });
});
