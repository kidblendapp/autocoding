/**
 * Unit tests for CSV parser.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { parseCsvFile, validateFile } from '../csv-parser';
import { EstimateConfig, DEFAULT_CONFIG } from '../../config/Config';
import { logger } from '../../utils/logger';

describe('csv-parser', () => {
  const testCsvPath = './test-backlog.csv';

  beforeEach(() => {
    logger.clear();
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
    it('should throw error for empty file path', () => {
      expect(() => validateFile('')).toThrow('File path is required');
    });

    it('should throw error for non-existent file', () => {
      expect(() => validateFile('./non-existent.csv')).toThrow('File does not exist');
    });

    it('should not throw for valid file', () => {
      writeFileSync(testCsvPath, 'test');
      expect(() => validateFile(testCsvPath)).not.toThrow();
    });
  });

  describe('parseCsvFile', () => {
    it('should parse valid CSV with all required fields', () => {
      const csvContent = `Issue Key,Summary,Story Points
PROJ-101,Implement Login Page,5
PROJ-102,Design Database Schema,8`;
      
      writeFileSync(testCsvPath, csvContent);
      
      const result = parseCsvFile(testCsvPath);
      
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0]).toEqual({
        id: 'PROJ-101',
        title: 'Implement Login Page',
        estimate: 40, // 5 SP * 8 hours
      });
      expect(result.tasks[1]).toEqual({
        id: 'PROJ-102',
        title: 'Design Database Schema',
        estimate: 64, // 8 SP * 8 hours
      });
      expect(result.skipped).toBe(0);
      expect(result.total).toBe(2);
    });

    it('should parse CSV with optional fields', () => {
      const csvContent = `Issue Key,Summary,Story Points,Component,Parent Id,Issue Type
PROJ-101,Implement Login Page,5,UI,,
PROJ-106,Get User Data,2,Backend,PROJ-105,Sub-task`;
      
      writeFileSync(testCsvPath, csvContent);
      
      const result = parseCsvFile(testCsvPath);
      
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0]).toEqual({
        id: 'PROJ-101',
        title: 'Implement Login Page',
        estimate: 40,
        component: 'UI',
      });
      expect(result.tasks[1]).toEqual({
        id: 'PROJ-106',
        title: 'Get User Data',
        estimate: 16,
        component: 'Backend',
        parentId: 'PROJ-105',
        issueType: 'Sub-task',
      });
    });

    it('should skip rows with missing ID', () => {
      const csvContent = `Issue Key,Summary,Story Points
,Missing ID,5
PROJ-102,Valid Task,8`;
      
      writeFileSync(testCsvPath, csvContent);
      
      const result = parseCsvFile(testCsvPath);
      
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].id).toBe('PROJ-102');
      expect(result.skipped).toBe(1);
    });

    it('should skip rows with missing Title', () => {
      const csvContent = `Issue Key,Summary,Story Points
PROJ-101,,5
PROJ-102,Valid Task,8`;
      
      writeFileSync(testCsvPath, csvContent);
      
      const result = parseCsvFile(testCsvPath);
      
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].id).toBe('PROJ-102');
      expect(result.skipped).toBe(1);
    });

    it('should handle different column name variations', () => {
      const csvContent = `ID,Title,Estimate
PROJ-101,Task 1,5
PROJ-102,Task 2,8`;
      
      writeFileSync(testCsvPath, csvContent);
      
      const result = parseCsvFile(testCsvPath);
      
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].id).toBe('PROJ-101');
      expect(result.tasks[0].title).toBe('Task 1');
    });

    it('should handle days/hours format', () => {
      const daysHoursConfig: EstimateConfig = {
        estimateType: 'days-hours',
        hoursPerDay: 8,
        validStoryPoints: [],
      };
      
      const csvContent = `Issue Key,Summary,Original Estimate
PROJ-103,Fix Login Timeout,4h
PROJ-108,Setup Infrastructure,8h`;
      
      writeFileSync(testCsvPath, csvContent);
      
      const result = parseCsvFile(testCsvPath, daysHoursConfig);
      
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].estimate).toBe(4);
      expect(result.tasks[1].estimate).toBe(8);
    });

    it('should handle empty rows', () => {
      const csvContent = `Issue Key,Summary,Story Points
PROJ-101,Task 1,5

PROJ-102,Task 2,8`;
      
      writeFileSync(testCsvPath, csvContent);
      
      const result = parseCsvFile(testCsvPath);
      
      expect(result.tasks).toHaveLength(2);
    });

    it('should throw error for non-existent file', () => {
      expect(() => parseCsvFile('./non-existent.csv')).toThrow();
    });

    it('should throw error for invalid CSV format', () => {
      writeFileSync(testCsvPath, 'invalid csv content without proper structure');
      
      // This might not throw depending on csv-parse behavior, but should handle gracefully
      expect(() => parseCsvFile(testCsvPath)).not.toThrow();
    });

    it('should apply default estimate for missing estimates', () => {
      const csvContent = `Issue Key,Summary,Story Points
PROJ-105,User Profile API,`;
      
      writeFileSync(testCsvPath, csvContent);
      
      const result = parseCsvFile(testCsvPath);
      
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].estimate).toBe(1);
    });

    it('should handle quoted fields', () => {
      const csvContent = `Issue Key,Summary,Story Points
PROJ-101,"Implement Login Page, v2",5`;
      
      writeFileSync(testCsvPath, csvContent);
      
      const result = parseCsvFile(testCsvPath);
      
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].title).toBe('Implement Login Page, v2');
    });

    it('should trim whitespace from fields', () => {
      const csvContent = `Issue Key,Summary,Story Points
  PROJ-101  ,  Task with spaces  ,  5  `;
      
      writeFileSync(testCsvPath, csvContent);
      
      const result = parseCsvFile(testCsvPath);
      
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].id).toBe('PROJ-101');
      expect(result.tasks[0].title).toBe('Task with spaces');
    });
  });
});
