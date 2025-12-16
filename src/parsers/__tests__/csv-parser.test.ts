/**
 * Unit tests for CSV parser.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { parseCsvFile, validateFile, validateFileSize } from '../csv-parser';
import { logger } from '../../utils/logger';

describe('CSV Parser', () => {
  const testCsvPath = '/tmp/test-backlog.csv';

  beforeEach(() => {
    logger.clear();
    logger.setSuppressWarnings(true);
    
    // Clean up test file if it exists
    if (existsSync(testCsvPath)) {
      unlinkSync(testCsvPath);
    }
  });

  afterEach(() => {
    // Clean up test file
    if (existsSync(testCsvPath)) {
      unlinkSync(testCsvPath);
    }
  });

  describe('validateFile', () => {
    it('should throw error for non-existent file', () => {
      expect(() => validateFile('/tmp/non-existent.csv')).toThrow('File does not exist');
    });

    it('should not throw for existing file', () => {
      writeFileSync(testCsvPath, 'test');
      expect(() => validateFile(testCsvPath)).not.toThrow();
      unlinkSync(testCsvPath);
    });
  });

  describe('validateFileSize', () => {
    it('should throw error for file exceeding max size', () => {
      const largeContent = 'x'.repeat(1025); // 1KB + 1 byte
      writeFileSync(testCsvPath, largeContent);
      expect(() => validateFileSize(testCsvPath, 1024)).toThrow('exceeds maximum');
      unlinkSync(testCsvPath);
    });

    it('should not throw for file within size limit', () => {
      writeFileSync(testCsvPath, 'test');
      expect(() => validateFileSize(testCsvPath, 1024)).not.toThrow();
      unlinkSync(testCsvPath);
    });
  });

  describe('parseCsvFile', () => {
    it('should parse valid CSV with all required fields', () => {
      const csvContent = `Issue Key,Summary,Story Points
PROJ-101,Test Task 1,5
PROJ-102,Test Task 2,8`;
      writeFileSync(testCsvPath, csvContent);

      const result = parseCsvFile(testCsvPath);
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].id).toBe('PROJ-101');
      expect(result.tasks[0].title).toBe('Test Task 1');
      expect(result.tasks[0].estimate).toBe(5);
      expect(result.skippedRows).toBe(0);
      expect(result.totalRows).toBe(2);
    });

    it('should handle different column name variations', () => {
      const csvContent = `ID,Title,Estimate
TASK-1,Task One,3
TASK-2,Task Two,5`;
      writeFileSync(testCsvPath, csvContent);

      const result = parseCsvFile(testCsvPath);
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].id).toBe('TASK-1');
      expect(result.tasks[0].title).toBe('Task One');
    });

    it('should skip rows with missing ID', () => {
      const csvContent = `Issue Key,Summary,Story Points
,Test Task 1,5
PROJ-102,Test Task 2,8`;
      writeFileSync(testCsvPath, csvContent);

      const result = parseCsvFile(testCsvPath);
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].id).toBe('PROJ-102');
      expect(result.skippedRows).toBe(1);
    });

    it('should skip rows with missing Title', () => {
      const csvContent = `Issue Key,Summary,Story Points
PROJ-101,,5
PROJ-102,Test Task 2,8`;
      writeFileSync(testCsvPath, csvContent);

      const result = parseCsvFile(testCsvPath);
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].id).toBe('PROJ-102');
      expect(result.skippedRows).toBe(1);
    });

    it('should handle optional fields', () => {
      const csvContent = `Issue Key,Summary,Story Points,Component,Parent Id,Issue Type
PROJ-101,Test Task,5,Backend,PROJ-100,Story
PROJ-102,Another Task,8,Frontend,,Bug`;
      writeFileSync(testCsvPath, csvContent);

      const result = parseCsvFile(testCsvPath);
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].component).toBe('Backend');
      expect(result.tasks[0].parentId).toBe('PROJ-100');
      expect(result.tasks[0].issueType).toBe('Story');
      expect(result.tasks[1].component).toBe('Frontend');
      expect(result.tasks[1].parentId).toBeUndefined();
    });

    it('should handle invalid estimates and default to 1', () => {
      const csvContent = `Issue Key,Summary,Story Points
PROJ-101,Test Task,4
PROJ-102,Another Task,5`;
      writeFileSync(testCsvPath, csvContent);

      const result = parseCsvFile(testCsvPath);
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].estimate).toBe(1); // Invalid story point, defaulted
      expect(result.tasks[1].estimate).toBe(5); // Valid story point
    });

    it('should handle empty estimate and default to 1', () => {
      const csvContent = `Issue Key,Summary,Story Points
PROJ-101,Test Task,
PROJ-102,Another Task,5`;
      writeFileSync(testCsvPath, csvContent);

      const result = parseCsvFile(testCsvPath);
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].estimate).toBe(1); // Missing estimate, defaulted
      expect(result.tasks[1].estimate).toBe(5);
    });

    it('should handle Days/Hours estimates', () => {
      const csvContent = `Issue Key,Summary,Original Estimate
PROJ-101,Test Task,4h
PROJ-102,Another Task,2d`;
      writeFileSync(testCsvPath, csvContent);

      const result = parseCsvFile(testCsvPath, {
        config: {
          estimateType: 'days-hours',
          hoursPerDay: 8,
        },
      });
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].estimate).toBe(4);
      expect(result.tasks[1].estimate).toBe(16); // 2 days * 8 hours
    });

    it('should handle quoted fields', () => {
      const csvContent = `Issue Key,Summary,Story Points
PROJ-101,"Test Task, with comma",5
PROJ-102,"Another ""quoted"" Task",8`;
      writeFileSync(testCsvPath, csvContent);

      const result = parseCsvFile(testCsvPath);
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].title).toBe('Test Task, with comma');
      expect(result.tasks[1].title).toBe('Another "quoted" Task');
    });

    it('should skip empty rows', () => {
      const csvContent = `Issue Key,Summary,Story Points
PROJ-101,Test Task,5

PROJ-102,Another Task,8`;
      writeFileSync(testCsvPath, csvContent);

      const result = parseCsvFile(testCsvPath);
      expect(result.tasks).toHaveLength(2);
    });

    it('should throw error for non-existent file', () => {
      expect(() => parseCsvFile('/tmp/non-existent.csv')).toThrow();
    });

    it('should handle large files within size limit', () => {
      const header = 'Issue Key,Summary,Story Points\n';
      const rows = Array.from({ length: 1000 }, (_, i) => 
        `PROJ-${i},Task ${i},5`
      ).join('\n');
      writeFileSync(testCsvPath, header + rows);

      const result = parseCsvFile(testCsvPath);
      expect(result.tasks).toHaveLength(1000);
    });
  });
});
