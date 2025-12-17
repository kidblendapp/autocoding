/**
 * Unit tests for change history CSV generator.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, unlinkSync, rmdirSync } from 'fs';
import { join } from 'path';
import { generateChangeHistoryCsv } from '../change-history-csv-generator';
import type { FieldChange } from '../change-history-extractor';
import { logger } from '../../utils/logger';

describe('Change History CSV Generator', () => {
  const testOutputDir = '/tmp/test-change-history-output';

  beforeEach(() => {
    logger.clear();
    logger.setSuppressWarnings(true);
  });

  afterEach(() => {
    // Clean up test directory if it exists
    if (existsSync(testOutputDir)) {
      try {
        const files = require('fs').readdirSync(testOutputDir);
        for (const file of files) {
          const filePath = join(testOutputDir, file);
          if (existsSync(filePath)) {
            unlinkSync(filePath);
          }
        }
        rmdirSync(testOutputDir);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('generateChangeHistoryCsv', () => {
    it('should generate CSV file with change history data', () => {
      const changes: FieldChange[] = [
        {
          issueKey: 'PROJ-123',
          fieldName: 'Status',
          value: 'In Progress',
          changedAt: '2024-02-01T10:00:00.000Z',
          changedBy: 'John Doe',
        },
        {
          issueKey: 'PROJ-123',
          fieldName: 'Story Points',
          value: '5',
          changedAt: '2024-02-02T14:30:00.000Z',
          changedBy: 'Jane Smith',
        },
      ];

      const csvPath = generateChangeHistoryCsv(changes, testOutputDir);

      expect(existsSync(csvPath)).toBe(true);
      
      const content = readFileSync(csvPath, 'utf-8');
      const lines = content.split('\n');
      
      expect(lines[0]).toBe('Issue key,Field name,Value,Changed at,Changed by');
      expect(lines[1]).toContain('PROJ-123');
      expect(lines[1]).toContain('Status');
      expect(lines[1]).toContain('In Progress');
      expect(lines[2]).toContain('Story Points');
      expect(lines[2]).toContain('5');
    });

    it('should create timestamped directory', () => {
      const changes: FieldChange[] = [
        {
          issueKey: 'PROJ-123',
          fieldName: 'Status',
          value: 'Done',
          changedAt: '2024-02-01T10:00:00.000Z',
          changedBy: 'John Doe',
        },
      ];

      const csvPath = generateChangeHistoryCsv(changes, testOutputDir);

      // Check that directory was created with timestamp format (YYYYMMDD_HH)
      const dirPath = csvPath.substring(0, csvPath.lastIndexOf('/'));
      expect(existsSync(dirPath)).toBe(true);
      expect(dirPath).toMatch(/\d{8}_\d{2}$/);
    });

    it('should handle empty changes array', () => {
      const changes: FieldChange[] = [];

      const csvPath = generateChangeHistoryCsv(changes, testOutputDir);

      expect(existsSync(csvPath)).toBe(true);
      
      const content = readFileSync(csvPath, 'utf-8');
      const lines = content.split('\n').filter(line => line.length > 0);
      
      expect(lines[0]).toBe('Issue key,Field name,Value,Changed at,Changed by');
      expect(lines.length).toBe(1); // Only header when no changes
    });

    it('should escape CSV special characters', () => {
      const changes: FieldChange[] = [
        {
          issueKey: 'PROJ-123',
          fieldName: 'Status',
          value: 'Value with "quotes" and, commas',
          changedAt: '2024-02-01T10:00:00.000Z',
          changedBy: 'User\nWith\nNewlines',
        },
      ];

      const csvPath = generateChangeHistoryCsv(changes, testOutputDir);

      const content = readFileSync(csvPath, 'utf-8');
      const lines = content.split('\n');
      
      // Should have quotes around values with special characters
      expect(lines[1]).toContain('"');
      expect(lines[1]).toContain('Value with ""quotes""');
    });

    it('should handle all three field types', () => {
      const changes: FieldChange[] = [
        {
          issueKey: 'PROJ-123',
          fieldName: 'Status',
          value: 'Done',
          changedAt: '2024-02-01T10:00:00.000Z',
          changedBy: 'John Doe',
        },
        {
          issueKey: 'PROJ-123',
          fieldName: 'Sprint',
          value: 'Sprint 1',
          changedAt: '2024-02-02T10:00:00.000Z',
          changedBy: 'Jane Smith',
        },
        {
          issueKey: 'PROJ-123',
          fieldName: 'Story Points',
          value: '8',
          changedAt: '2024-02-03T10:00:00.000Z',
          changedBy: 'Bob Wilson',
        },
      ];

      const csvPath = generateChangeHistoryCsv(changes, testOutputDir);

      const content = readFileSync(csvPath, 'utf-8');
      const lines = content.split('\n');
      
      expect(lines.length).toBe(4); // Header + 3 data rows
      expect(content).toContain('Status');
      expect(content).toContain('Sprint');
      expect(content).toContain('Story Points');
    });

    it('should handle multiple tickets', () => {
      const changes: FieldChange[] = [
        {
          issueKey: 'PROJ-123',
          fieldName: 'Status',
          value: 'Done',
          changedAt: '2024-02-01T10:00:00.000Z',
          changedBy: 'John Doe',
        },
        {
          issueKey: 'PROJ-456',
          fieldName: 'Status',
          value: 'In Progress',
          changedAt: '2024-02-02T10:00:00.000Z',
          changedBy: 'Jane Smith',
        },
      ];

      const csvPath = generateChangeHistoryCsv(changes, testOutputDir);

      const content = readFileSync(csvPath, 'utf-8');
      
      expect(content).toContain('PROJ-123');
      expect(content).toContain('PROJ-456');
    });
  });
});
