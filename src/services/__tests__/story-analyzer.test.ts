/**
 * Unit tests for story analyzer service.
 */

import { describe, it, expect } from 'vitest';
import {
  determineEstimationCase,
  extractSubtasks,
  hasStoryEstimateValue,
  hasSubtaskEstimatesValue,
  getStoryEstimateInHours,
  getSubtaskEstimateInHours,
} from '../story-analyzer';
import type { JiraTicket } from '../jira-extractor';

describe('story-analyzer', () => {
  describe('hasStoryEstimateValue', () => {
    it('should return true when story has story points', () => {
      const story: JiraTicket = {
        key: 'STORY-1',
        summary: 'Test story',
        storyPoints: 5,
      };
      expect(hasStoryEstimateValue(story)).toBe(true);
    });

    it('should return true when story has original estimate', () => {
      const story: JiraTicket = {
        key: 'STORY-1',
        summary: 'Test story',
        originalEstimate: 40,
      };
      expect(hasStoryEstimateValue(story)).toBe(true);
    });

    it('should return false when story has no estimate', () => {
      const story: JiraTicket = {
        key: 'STORY-1',
        summary: 'Test story',
      };
      expect(hasStoryEstimateValue(story)).toBe(false);
    });

    it('should return false when story points is zero', () => {
      const story: JiraTicket = {
        key: 'STORY-1',
        summary: 'Test story',
        storyPoints: 0,
      };
      expect(hasStoryEstimateValue(story)).toBe(false);
    });
  });

  describe('hasSubtaskEstimatesValue', () => {
    it('should return true when at least one subtask has estimate', () => {
      const subtasks: JiraTicket[] = [
        { key: 'SUB-1', summary: 'Subtask 1', storyPoints: 2 },
        { key: 'SUB-2', summary: 'Subtask 2' },
      ];
      expect(hasSubtaskEstimatesValue(subtasks)).toBe(true);
    });

    it('should return false when no subtasks have estimates', () => {
      const subtasks: JiraTicket[] = [
        { key: 'SUB-1', summary: 'Subtask 1' },
        { key: 'SUB-2', summary: 'Subtask 2' },
      ];
      expect(hasSubtaskEstimatesValue(subtasks)).toBe(false);
    });

    it('should return false when subtasks array is empty', () => {
      expect(hasSubtaskEstimatesValue([])).toBe(false);
    });
  });

  describe('determineEstimationCase', () => {
    it('should return case1 when story has estimate but no subtasks', () => {
      const story: JiraTicket = {
        key: 'STORY-1',
        summary: 'Test story',
        storyPoints: 5,
      };
      expect(determineEstimationCase(story, [])).toBe('case1');
    });

    it('should return case1 when story has estimate but subtasks have no estimates', () => {
      const story: JiraTicket = {
        key: 'STORY-1',
        summary: 'Test story',
        storyPoints: 5,
      };
      const subtasks: JiraTicket[] = [
        { key: 'SUB-1', summary: 'Subtask 1', parentId: 'STORY-1' },
      ];
      expect(determineEstimationCase(story, subtasks)).toBe('case1');
    });

    it('should return case2 when story has estimate and subtasks have estimates', () => {
      const story: JiraTicket = {
        key: 'STORY-1',
        summary: 'Test story',
        storyPoints: 5,
      };
      const subtasks: JiraTicket[] = [
        { key: 'SUB-1', summary: 'Subtask 1', parentId: 'STORY-1', storyPoints: 2 },
      ];
      expect(determineEstimationCase(story, subtasks)).toBe('case2');
    });

    it('should return case3 when story has no estimate but subtasks have estimates', () => {
      const story: JiraTicket = {
        key: 'STORY-1',
        summary: 'Test story',
      };
      const subtasks: JiraTicket[] = [
        { key: 'SUB-1', summary: 'Subtask 1', parentId: 'STORY-1', storyPoints: 2 },
      ];
      expect(determineEstimationCase(story, subtasks)).toBe('case3');
    });
  });

  describe('extractSubtasks', () => {
    it('should extract subtasks by parentId', () => {
      const story: JiraTicket = {
        key: 'STORY-1',
        summary: 'Test story',
      };
      const allTickets: JiraTicket[] = [
        story,
        { key: 'SUB-1', summary: 'Subtask 1', parentId: 'STORY-1' },
        { key: 'SUB-2', summary: 'Subtask 2', parentId: 'STORY-1' },
        { key: 'STORY-2', summary: 'Other story' },
      ];
      const subtasks = extractSubtasks(story, allTickets);
      expect(subtasks).toHaveLength(2);
      expect(subtasks[0].key).toBe('SUB-1');
      expect(subtasks[1].key).toBe('SUB-2');
    });

    it('should return empty array when no subtasks found', () => {
      const story: JiraTicket = {
        key: 'STORY-1',
        summary: 'Test story',
      };
      const allTickets: JiraTicket[] = [story];
      const subtasks = extractSubtasks(story, allTickets);
      expect(subtasks).toHaveLength(0);
    });
  });

  describe('getStoryEstimateInHours', () => {
    it('should return original estimate when available', () => {
      const story: JiraTicket = {
        key: 'STORY-1',
        summary: 'Test story',
        originalEstimate: 40,
        storyPoints: 5,
      };
      expect(getStoryEstimateInHours(story, 8)).toBe(40);
    });

    it('should convert story points to hours', () => {
      const story: JiraTicket = {
        key: 'STORY-1',
        summary: 'Test story',
        storyPoints: 5,
      };
      expect(getStoryEstimateInHours(story, 8)).toBe(40);
    });

    it('should return undefined when no estimate', () => {
      const story: JiraTicket = {
        key: 'STORY-1',
        summary: 'Test story',
      };
      expect(getStoryEstimateInHours(story, 8)).toBeUndefined();
    });
  });

  describe('getSubtaskEstimateInHours', () => {
    it('should return original estimate when available', () => {
      const subtask: JiraTicket = {
        key: 'SUB-1',
        summary: 'Subtask',
        originalEstimate: 8,
        storyPoints: 1,
      };
      expect(getSubtaskEstimateInHours(subtask, 8)).toBe(8);
    });

    it('should convert story points to hours', () => {
      const subtask: JiraTicket = {
        key: 'SUB-1',
        summary: 'Subtask',
        storyPoints: 2,
      };
      expect(getSubtaskEstimateInHours(subtask, 8)).toBe(16);
    });

    it('should return undefined when no estimate', () => {
      const subtask: JiraTicket = {
        key: 'SUB-1',
        summary: 'Subtask',
      };
      expect(getSubtaskEstimateInHours(subtask, 8)).toBeUndefined();
    });
  });
});
