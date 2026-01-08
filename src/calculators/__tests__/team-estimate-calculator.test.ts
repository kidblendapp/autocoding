/**
 * Unit tests for team estimate calculator.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { calculateCase1, calculateCase2, calculateCase3, applyCoefficient } from '../team-estimate-calculator';
import type { JiraTicket } from '../../services/jira-extractor';
import type { TeamEstimateConfiguration } from '../../config/team-estimate-types';

describe('team-estimate-calculator', () => {
  let mockConfig: TeamEstimateConfiguration;

  beforeEach(() => {
    mockConfig = {
      version: '1.0.0',
      defaultPreset: 'standard-agile',
      presets: {},
      teams: {
        'team-ba': {
          id: 'team-ba',
          name: 'BA Team',
          type: 'BA',
          velocity: 30,
          velocityPeriod: 'sprint',
          includeInSchedule: false,
          defaultCoefficient: {
            method: 'percentage',
            value: 0.25,
          },
        },
        'team-dev': {
          id: 'team-dev',
          name: 'Dev Team',
          type: 'Dev',
          velocity: 20,
          velocityPeriod: 'sprint',
          includeInSchedule: true,
          defaultCoefficient: {
            method: 'percentage',
            value: 0.50,
          },
        },
      },
      estimationRules: {
        case1_storyOnly: {
          name: 'Case 1',
          description: 'Story only',
          enabled: true,
          calculationMethod: 'coefficients',
          teamCoefficients: {
            BA: {
              method: 'percentage',
              value: 0.25,
            },
            Dev: {
              method: 'percentage',
              value: 0.50,
            },
          },
        },
        case2_hybrid: {
          name: 'Case 2',
          description: 'Hybrid',
          enabled: true,
          calculationMethod: 'hybrid',
          subtaskMatching: {
            BA: {
              matchCriteria: {
                labels: ['BA'],
              },
              fallbackToCoefficient: true,
              fallbackCoefficient: {
                method: 'percentage',
                value: 0.25,
              },
            },
          },
        },
        case3_subtasksOnly: {
          name: 'Case 3',
          description: 'Subtasks only',
          enabled: true,
          calculationMethod: 'subtasks',
          subtaskMatching: {
            BA: {
              components: [],
              labels: ['BA'],
            },
          },
        },
      },
      taskSequencing: {
        defaultMode: 'sequential',
        executionModes: {
          sequential: {
            name: 'Sequential',
            description: 'Sequential execution',
            parallelism: 1,
          },
          parallel: {
            name: 'Parallel',
            description: 'Parallel execution',
            parallelism: 'unlimited',
          },
          limitedParallel: {
            name: 'Limited Parallel',
            description: 'Limited parallel execution',
            parallelism: 3,
          },
        },
        teamSequencing: {},
        workTypeSequences: {},
        dependencyRules: {
          strict: {
            name: 'Strict',
            description: 'Strict dependencies',
            enabled: true,
          },
          soft: {
            name: 'Soft',
            description: 'Soft dependencies',
            enabled: false,
          },
        },
      },
      uiSettings: {
        presetsVisible: true,
        allowCustomCoefficients: true,
        allowCustomSequencing: true,
        validation: {
          validateCoefficientSum: true,
          coefficientSumTolerance: 0.05,
          warnOnOverEstimation: true,
          overEstimationThreshold: 1.2,
        },
        displayOptions: {
          showEstimateBreakdown: true,
          showCalculationMethod: true,
          showSequencingDiagram: true,
          showTeamTimeline: true,
        },
      },
    };
  });

  describe('applyCoefficient', () => {
    it('should apply percentage coefficient', () => {
      const result = applyCoefficient(40, { method: 'percentage', value: 0.25 }, 5);
      expect(result).toBe(10);
    });

    it('should apply hoursPerPoint coefficient', () => {
      const result = applyCoefficient(40, { method: 'hoursPerPoint', value: 2 }, 5);
      expect(result).toBe(10); // 5 story points * 2 hours per point
    });
  });

  describe('calculateCase1', () => {
    it('should calculate team estimates using coefficients', () => {
      const story: JiraTicket = {
        key: 'STORY-1',
        summary: 'Test story',
        storyPoints: 5,
      };
      const estimates = calculateCase1(story, mockConfig, 8);
      expect(estimates).toHaveLength(2);
      expect(estimates[0].teamType).toBe('BA');
      expect(estimates[0].estimate).toBe(10); // 40 hours * 0.25
      expect(estimates[1].teamType).toBe('Dev');
      expect(estimates[1].estimate).toBe(20); // 40 hours * 0.50
    });

    it('should return empty array when rule is disabled', () => {
      mockConfig.estimationRules.case1_storyOnly.enabled = false;
      const story: JiraTicket = {
        key: 'STORY-1',
        summary: 'Test story',
        storyPoints: 5,
      };
      const estimates = calculateCase1(story, mockConfig, 8);
      expect(estimates).toHaveLength(0);
    });
  });

  describe('calculateCase2', () => {
    it('should use subtask estimates when available', () => {
      const story: JiraTicket = {
        key: 'STORY-1',
        summary: 'Test story',
        storyPoints: 5,
      };
      const subtasks: JiraTicket[] = [
        {
          key: 'SUB-1',
          summary: 'BA task',
          parentId: 'STORY-1',
          labels: 'BA',
          originalEstimate: 8,
        },
      ];
      const estimates = calculateCase2(story, subtasks, mockConfig, 8);
      expect(estimates).toHaveLength(1);
      expect(estimates[0].estimate).toBe(8); // From subtask
      expect(estimates[0].source).toBe('subtasks');
    });

    it('should fall back to coefficient when no matching subtasks', () => {
      const story: JiraTicket = {
        key: 'STORY-1',
        summary: 'Test story',
        storyPoints: 5,
      };
      const subtasks: JiraTicket[] = [
        {
          key: 'SUB-1',
          summary: 'Other task',
          parentId: 'STORY-1',
          labels: 'Other',
        },
      ];
      const estimates = calculateCase2(story, subtasks, mockConfig, 8);
      expect(estimates).toHaveLength(1);
      expect(estimates[0].estimate).toBe(10); // From coefficient fallback
      expect(estimates[0].source).toBe('story');
    });
  });

  describe('calculateCase3', () => {
    it('should aggregate subtask estimates', () => {
      const story: JiraTicket = {
        key: 'STORY-1',
        summary: 'Test story',
      };
      const subtasks: JiraTicket[] = [
        {
          key: 'SUB-1',
          summary: 'BA task 1',
          parentId: 'STORY-1',
          labels: 'BA',
          originalEstimate: 4,
        },
        {
          key: 'SUB-2',
          summary: 'BA task 2',
          parentId: 'STORY-1',
          labels: 'BA',
          originalEstimate: 6,
        },
      ];
      mockConfig.estimationRules.case3_subtasksOnly.subtaskMatching = {
        BA: {
          labels: ['BA'],
        },
      };
      const estimates = calculateCase3(story, subtasks, mockConfig, 8);
      expect(estimates).toHaveLength(1);
      expect(estimates[0].estimate).toBe(10); // 4 + 6
      expect(estimates[0].source).toBe('subtasks');
    });
  });
});
