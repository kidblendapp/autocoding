/**
 * Unit tests for output generator.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'fs';
import { generateOutput } from '../output-generator';
import type { ScheduledTask } from '../../models/ScheduledTask';
import { logger } from '../../utils/logger';

describe('Output Generator', () => {
  const testOutputPath = '/tmp/test-output.json';

  beforeEach(() => {
    logger.clear();
    logger.setSuppressWarnings(true);
    
    // Clean up test file if it exists
    if (existsSync(testOutputPath)) {
      unlinkSync(testOutputPath);
    }
  });

  afterEach(() => {
    // Clean up test file
    if (existsSync(testOutputPath)) {
      unlinkSync(testOutputPath);
    }
  });

  describe('generateOutput', () => {
    it('should generate output.json with scheduled tasks', () => {
      const scheduledTasks: ScheduledTask[] = [
        {
          id: 'TASK-1',
          title: 'Task 1',
          estimate: 5,
          calculatedStartDate: '2024-02-01',
          calculatedEndDate: '2024-02-05',
        },
        {
          id: 'TASK-2',
          title: 'Task 2',
          estimate: 8,
          calculatedStartDate: '2024-02-05',
          calculatedEndDate: '2024-02-13',
        },
      ];

      generateOutput(scheduledTasks, testOutputPath);

      expect(existsSync(testOutputPath)).toBe(true);
      
      const content = readFileSync(testOutputPath, 'utf-8');
      const parsed = JSON.parse(content);
      
      expect(parsed).toHaveLength(2);
      expect(parsed[0].id).toBe('TASK-1');
      expect(parsed[0].calculatedStartDate).toBe('2024-02-01');
      expect(parsed[0].calculatedEndDate).toBe('2024-02-05');
      expect(parsed[1].id).toBe('TASK-2');
      expect(parsed[1].calculatedStartDate).toBe('2024-02-05');
      expect(parsed[1].calculatedEndDate).toBe('2024-02-13');
    });

    it('should preserve all task fields in output', () => {
      const scheduledTasks: ScheduledTask[] = [
        {
          id: 'TASK-1',
          title: 'Task with All Fields',
          estimate: 5,
          component: 'Backend',
          parentId: 'EPIC-1',
          issueType: 'Story',
          calculatedStartDate: '2024-02-01',
          calculatedEndDate: '2024-02-05',
        },
      ];

      generateOutput(scheduledTasks, testOutputPath);

      const content = readFileSync(testOutputPath, 'utf-8');
      const parsed = JSON.parse(content);
      
      expect(parsed[0].id).toBe('TASK-1');
      expect(parsed[0].title).toBe('Task with All Fields');
      expect(parsed[0].estimate).toBe(5);
      expect(parsed[0].component).toBe('Backend');
      expect(parsed[0].parentId).toBe('EPIC-1');
      expect(parsed[0].issueType).toBe('Story');
      expect(parsed[0].calculatedStartDate).toBe('2024-02-01');
      expect(parsed[0].calculatedEndDate).toBe('2024-02-05');
    });

    it('should use default output path when not specified', () => {
      const scheduledTasks: ScheduledTask[] = [
        {
          id: 'TASK-1',
          title: 'Task 1',
          estimate: 5,
          calculatedStartDate: '2024-02-01',
          calculatedEndDate: '2024-02-05',
        },
      ];

      // Use a safe test path
      const defaultPath = '/tmp/default-output.json';
      if (existsSync(defaultPath)) {
        unlinkSync(defaultPath);
      }

      generateOutput(scheduledTasks, defaultPath);

      expect(existsSync(defaultPath)).toBe(true);
      
      if (existsSync(defaultPath)) {
        unlinkSync(defaultPath);
      }
    });

    it('should handle empty task array', () => {
      generateOutput([], testOutputPath);

      expect(existsSync(testOutputPath)).toBe(true);
      
      const content = readFileSync(testOutputPath, 'utf-8');
      const parsed = JSON.parse(content);
      
      expect(parsed).toEqual([]);
    });

    it('should format JSON with proper indentation', () => {
      const scheduledTasks: ScheduledTask[] = [
        {
          id: 'TASK-1',
          title: 'Task 1',
          estimate: 5,
          calculatedStartDate: '2024-02-01',
          calculatedEndDate: '2024-02-05',
        },
      ];

      generateOutput(scheduledTasks, testOutputPath);

      const content = readFileSync(testOutputPath, 'utf-8');
      
      // Should have proper formatting (2-space indentation)
      expect(content).toContain('  "id"');
      expect(content).toContain('  "calculatedStartDate"');
    });
  });
});
