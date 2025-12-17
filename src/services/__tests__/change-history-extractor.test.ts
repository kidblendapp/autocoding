/**
 * Unit tests for change history extractor.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { extractChangeHistory } from '../change-history-extractor';
import type { ChangeHistoryConfig } from '../../config/types';
import { logger } from '../../utils/logger';

// Use vi.hoisted to create the mock before it's used in mocks
const { mockExecAsync } = vi.hoisted(() => {
  return {
    mockExecAsync: vi.fn(),
  };
});

// Mock child_process and util modules
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('util', () => ({
  promisify: vi.fn(() => mockExecAsync),
}));

describe('Change History Extractor', () => {
  beforeEach(() => {
    logger.clear();
    logger.setSuppressWarnings(true);
    vi.clearAllMocks();
  });

  describe('extractChangeHistory', () => {
    it('should extract change history for tickets matching JQL query', async () => {
      const config: ChangeHistoryConfig = {
        jql: 'project = PROJ AND status = Done',
      };

      // Mock JQL query response
      const jqlResponse = JSON.stringify([
        { key: 'PROJ-123' },
        { key: 'PROJ-456' },
      ]);

      // Mock changelog responses
      const changelogResponse1 = JSON.stringify({
        key: 'PROJ-123',
        changelog: {
          histories: [
            {
              id: '1',
              author: { displayName: 'John Doe' },
              created: '2024-02-01T10:00:00.000Z',
              items: [
                {
                  field: 'status',
                  fieldtype: 'jira',
                  fromString: 'To Do',
                  toString: 'In Progress',
                },
              ],
            },
          ],
        },
      });

      const changelogResponse2 = JSON.stringify({
        key: 'PROJ-456',
        changelog: {
          histories: [
            {
              id: '2',
              author: { displayName: 'Jane Smith' },
              created: '2024-02-02T14:30:00.000Z',
              items: [
                {
                  field: 'status',
                  fieldtype: 'jira',
                  fromString: 'In Progress',
                  toString: 'Done',
                },
              ],
            },
          ],
        },
      });

      // Mock execAsync calls
      mockExecAsync
        .mockResolvedValueOnce({ stdout: jqlResponse, stderr: '' })
        .mockResolvedValueOnce({ stdout: changelogResponse1, stderr: '' })
        .mockResolvedValueOnce({ stdout: changelogResponse2, stderr: '' });

      const changes = await extractChangeHistory(config);

      expect(changes.length).toBeGreaterThan(0);
      expect(changes.some(c => c.issueKey === 'PROJ-123')).toBe(true);
      expect(changes.some(c => c.issueKey === 'PROJ-456')).toBe(true);
    });

    it('should handle empty JQL query results', async () => {
      const config: ChangeHistoryConfig = {
        jql: 'project = NONEXISTENT',
      };

      // Mock empty JQL response
      mockExecAsync.mockResolvedValueOnce({ stdout: JSON.stringify([]), stderr: '' });

      const changes = await extractChangeHistory(config);

      expect(changes).toEqual([]);
    });

    it('should filter for Status, Sprint, and Story Points fields only', async () => {
      const config: ChangeHistoryConfig = {
        jql: 'project = PROJ',
      };

      const jqlResponse = JSON.stringify([{ key: 'PROJ-123' }]);

      const changelogResponse = JSON.stringify({
        key: 'PROJ-123',
        changelog: {
          histories: [
            {
              id: '1',
              author: { displayName: 'John Doe' },
              created: '2024-02-01T10:00:00.000Z',
              items: [
                {
                  field: 'status',
                  fieldtype: 'jira',
                  fromString: 'To Do',
                  toString: 'In Progress',
                },
                {
                  field: 'summary',
                  fieldtype: 'jira',
                  fromString: 'Old Summary',
                  toString: 'New Summary',
                },
                {
                  field: 'customfield_10021',
                  fieldtype: 'custom',
                  fromString: '3',
                  toString: '5',
                },
              ],
            },
          ],
        },
      });

      mockExecAsync
        .mockResolvedValueOnce({ stdout: jqlResponse, stderr: '' })
        .mockResolvedValueOnce({ stdout: changelogResponse, stderr: '' });

      const changes = await extractChangeHistory(config);

      // Should only include Status and Story Points, not summary
      expect(changes.length).toBe(2);
      expect(changes.some(c => c.fieldName === 'Status')).toBe(true);
      expect(changes.some(c => c.fieldName === 'Story Points')).toBe(true);
      expect(changes.every(c => c.fieldName !== 'summary')).toBe(true);
    });

    it('should handle tickets with no changelog', async () => {
      const config: ChangeHistoryConfig = {
        jql: 'project = PROJ',
      };

      const jqlResponse = JSON.stringify([{ key: 'PROJ-123' }]);

      const changelogResponse = JSON.stringify({
        key: 'PROJ-123',
        changelog: {
          histories: [],
        },
      });

      mockExecAsync
        .mockResolvedValueOnce({ stdout: jqlResponse, stderr: '' })
        .mockResolvedValueOnce({ stdout: changelogResponse, stderr: '' });

      const changes = await extractChangeHistory(config);

      expect(changes).toEqual([]);
    });

    it('should handle API errors gracefully', async () => {
      const config: ChangeHistoryConfig = {
        jql: 'project = PROJ',
      };

      mockExecAsync.mockRejectedValueOnce(new Error('API error'));

      await expect(extractChangeHistory(config)).rejects.toThrow();
    });

    it('should use custom field mapping when provided', async () => {
      const config: ChangeHistoryConfig = {
        jql: 'project = PROJ',
        fieldMapping: {
          sprint: 'customfield_10020',
          storyPoints: 'customfield_10022',
        },
      };

      const jqlResponse = JSON.stringify([{ key: 'PROJ-123' }]);

      const changelogResponse = JSON.stringify({
        key: 'PROJ-123',
        changelog: {
          histories: [
            {
              id: '1',
              author: { displayName: 'John Doe' },
              created: '2024-02-01T10:00:00.000Z',
              items: [
                {
                  field: 'customfield_10020',
                  fieldId: 'customfield_10020',
                  fieldtype: 'custom',
                  fromString: null,
                  toString: 'Sprint 1',
                },
                {
                  field: 'customfield_10022',
                  fieldId: 'customfield_10022',
                  fieldtype: 'custom',
                  fromString: '3',
                  toString: '5',
                },
              ],
            },
          ],
        },
      });

      mockExecAsync
        .mockResolvedValueOnce({ stdout: jqlResponse, stderr: '' })
        .mockResolvedValueOnce({ stdout: changelogResponse, stderr: '' });

      const changes = await extractChangeHistory(config);

      expect(changes.length).toBe(2);
      expect(changes.some(c => c.fieldName === 'Sprint')).toBe(true);
      expect(changes.some(c => c.fieldName === 'Story Points')).toBe(true);
    });
  });
});
