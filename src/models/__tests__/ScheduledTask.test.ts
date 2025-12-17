/**
 * Unit tests for ScheduledTask model.
 */

import { describe, it, expect } from 'vitest';
import type { ScheduledTask } from '../ScheduledTask';

describe('ScheduledTask', () => {
  it('should extend Task with calculated dates', () => {
    const scheduledTask: ScheduledTask = {
      id: 'PROJ-101',
      title: 'Test Task',
      estimate: 5,
      calculatedStartDate: '2024-02-01',
      calculatedEndDate: '2024-02-05',
    };

    expect(scheduledTask.id).toBe('PROJ-101');
    expect(scheduledTask.title).toBe('Test Task');
    expect(scheduledTask.estimate).toBe(5);
    expect(scheduledTask.calculatedStartDate).toBe('2024-02-01');
    expect(scheduledTask.calculatedEndDate).toBe('2024-02-05');
  });

  it('should support all optional Task fields', () => {
    const scheduledTask: ScheduledTask = {
      id: 'PROJ-102',
      title: 'Test Task with Options',
      estimate: 8,
      component: 'Backend',
      parentId: 'PROJ-100',
      issueType: 'Story',
      calculatedStartDate: '2024-02-01',
      calculatedEndDate: '2024-02-09',
    };

    expect(scheduledTask.component).toBe('Backend');
    expect(scheduledTask.parentId).toBe('PROJ-100');
    expect(scheduledTask.issueType).toBe('Story');
    expect(scheduledTask.calculatedStartDate).toBe('2024-02-01');
    expect(scheduledTask.calculatedEndDate).toBe('2024-02-09');
  });

  it('should have ISO date format for calculated dates', () => {
    const scheduledTask: ScheduledTask = {
      id: 'PROJ-103',
      title: 'Test Task',
      estimate: 5,
      calculatedStartDate: '2024-02-01',
      calculatedEndDate: '2024-02-05',
    };

    // Validate ISO date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    expect(scheduledTask.calculatedStartDate).toMatch(dateRegex);
    expect(scheduledTask.calculatedEndDate).toMatch(dateRegex);
  });
});
