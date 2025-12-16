/**
 * Unit tests for Task model.
 */

import { describe, it, expect } from 'vitest';
import type { Task } from '../Task';

describe('Task', () => {
  it('should have required fields', () => {
    const task: Task = {
      id: 'PROJ-101',
      title: 'Test Task',
      estimate: 5,
    };

    expect(task.id).toBe('PROJ-101');
    expect(task.title).toBe('Test Task');
    expect(task.estimate).toBe(5);
  });

  it('should support optional fields', () => {
    const task: Task = {
      id: 'PROJ-102',
      title: 'Test Task with Options',
      estimate: 8,
      component: 'Backend',
      parentId: 'PROJ-100',
      issueType: 'Story',
    };

    expect(task.component).toBe('Backend');
    expect(task.parentId).toBe('PROJ-100');
    expect(task.issueType).toBe('Story');
  });
});
