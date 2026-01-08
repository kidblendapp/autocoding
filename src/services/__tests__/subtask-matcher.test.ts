/**
 * Unit tests for subtask matcher service.
 */

import { describe, it, expect } from 'vitest';
import {
  matchSubtask,
  matchByComponent,
  matchByLabel,
  matchBySummaryTag,
  matchByIssueType,
  filterMatchingSubtasks,
} from '../subtask-matcher';
import type { JiraTicket } from '../jira-extractor';
import type { SubtaskMatchCriteria } from '../../config/team-estimate-types';

describe('subtask-matcher', () => {
  const createSubtask = (overrides: Partial<JiraTicket> = {}): JiraTicket => ({
    key: 'SUB-1',
    summary: 'Test subtask',
    ...overrides,
  });

  describe('matchByComponent', () => {
    it('should match when component is in the list', () => {
      const subtask = createSubtask({ component: 'FE' });
      expect(matchByComponent(subtask, ['FE', 'BE'])).toBe(true);
    });

    it('should match when component is comma-separated', () => {
      const subtask = createSubtask({ component: 'FE, UI' });
      expect(matchByComponent(subtask, ['FE'])).toBe(true);
    });

    it('should not match when component is not in the list', () => {
      const subtask = createSubtask({ component: 'Data' });
      expect(matchByComponent(subtask, ['FE', 'BE'])).toBe(false);
    });

    it('should be case-insensitive', () => {
      const subtask = createSubtask({ component: 'fe' });
      expect(matchByComponent(subtask, ['FE'])).toBe(true);
    });
  });

  describe('matchByLabel', () => {
    it('should match when label is in the list', () => {
      const subtask = createSubtask({ labels: 'BA, Analysis' });
      expect(matchByLabel(subtask, ['BA'])).toBe(true);
    });

    it('should not match when label is not in the list', () => {
      const subtask = createSubtask({ labels: 'Dev' });
      expect(matchByLabel(subtask, ['BA', 'QA'])).toBe(false);
    });

    it('should be case-insensitive', () => {
      const subtask = createSubtask({ labels: 'ba' });
      expect(matchByLabel(subtask, ['BA'])).toBe(true);
    });
  });

  describe('matchBySummaryTag', () => {
    it('should match when summary contains tag', () => {
      const subtask = createSubtask({ summary: '[BA] Analyze requirements' });
      expect(matchBySummaryTag(subtask, ['[BA]'])).toBe(true);
    });

    it('should match multiple tags', () => {
      const subtask = createSubtask({ summary: '[FE] Implement UI' });
      expect(matchBySummaryTag(subtask, ['[BA]', '[FE]'])).toBe(true);
    });

    it('should not match when tag is not present', () => {
      const subtask = createSubtask({ summary: 'Implement feature' });
      expect(matchBySummaryTag(subtask, ['[BA]'])).toBe(false);
    });
  });

  describe('matchByIssueType', () => {
    it('should match when issue type is in the list', () => {
      const subtask = createSubtask({ issueType: 'Sub-task' });
      expect(matchByIssueType(subtask, ['Sub-task', 'Task'])).toBe(true);
    });

    it('should not match when issue type is not in the list', () => {
      const subtask = createSubtask({ issueType: 'Bug' });
      expect(matchByIssueType(subtask, ['Sub-task', 'Task'])).toBe(false);
    });

    it('should be case-insensitive', () => {
      const subtask = createSubtask({ issueType: 'sub-task' });
      expect(matchByIssueType(subtask, ['Sub-task'])).toBe(true);
    });
  });

  describe('matchSubtask', () => {
    it('should match when ANY criteria matches (OR logic)', () => {
      const subtask = createSubtask({
        component: 'FE',
        labels: 'Dev',
      });
      const criteria: SubtaskMatchCriteria = {
        components: ['BE'],
        labels: ['Dev'],
      };
      expect(matchSubtask(subtask, criteria)).toBe(true);
    });

    it('should not match when no criteria matches', () => {
      const subtask = createSubtask({
        component: 'Data',
        labels: 'Other',
      });
      const criteria: SubtaskMatchCriteria = {
        components: ['FE', 'BE'],
        labels: ['BA', 'QA'],
      };
      expect(matchSubtask(subtask, criteria)).toBe(false);
    });

    it('should return false when no criteria provided', () => {
      const subtask = createSubtask();
      const criteria: SubtaskMatchCriteria = {};
      expect(matchSubtask(subtask, criteria)).toBe(false);
    });
  });

  describe('filterMatchingSubtasks', () => {
    it('should filter subtasks that match criteria', () => {
      const subtasks: JiraTicket[] = [
        createSubtask({ key: 'SUB-1', component: 'FE' }),
        createSubtask({ key: 'SUB-2', component: 'BE' }),
        createSubtask({ key: 'SUB-3', component: 'Data' }),
      ];
      const criteria: SubtaskMatchCriteria = {
        components: ['FE', 'BE'],
      };
      const matching = filterMatchingSubtasks(subtasks, criteria);
      expect(matching).toHaveLength(2);
      expect(matching[0].key).toBe('SUB-1');
      expect(matching[1].key).toBe('SUB-2');
    });

    it('should return empty array when no matches', () => {
      const subtasks: JiraTicket[] = [
        createSubtask({ key: 'SUB-1', component: 'Data' }),
      ];
      const criteria: SubtaskMatchCriteria = {
        components: ['FE'],
      };
      const matching = filterMatchingSubtasks(subtasks, criteria);
      expect(matching).toHaveLength(0);
    });
  });
});
