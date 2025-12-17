/**
 * Unit tests for schedule calculator.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { calculateDuration, addDays, calculateSchedule } from '../schedule-calculator';
import type { Task } from '../../models/Task';
import type { ScheduleConfig } from '../../config/types';
import { logger } from '../../utils/logger';

describe('Schedule Calculator', () => {
  beforeEach(() => {
    logger.clear();
    logger.setSuppressWarnings(true);
  });

  describe('calculateDuration', () => {
    it('should calculate duration correctly: (Estimate / Velocity) * SprintDuration', () => {
      // AC2: Estimate = 5, Velocity = 10/week, SprintDuration = 7 days
      // Expected: (5/10) * 7 = 3.5 days
      const duration = calculateDuration(5, 10, 7);
      expect(duration).toBe(3.5);
    });

    it('should handle fractional results', () => {
      const duration = calculateDuration(1, 3, 10);
      expect(duration).toBeCloseTo(3.333333, 5);
    });

    it('should handle whole number results', () => {
      const duration = calculateDuration(10, 10, 7);
      expect(duration).toBe(7);
    });

    it('should handle large estimates', () => {
      const duration = calculateDuration(100, 20, 14);
      expect(duration).toBe(70);
    });

    it('should handle zero estimate', () => {
      const duration = calculateDuration(0, 10, 7);
      expect(duration).toBe(0);
    });

    it('should throw error for zero velocity', () => {
      expect(() => calculateDuration(5, 0, 7)).toThrow('Velocity must be greater than zero');
    });

    it('should throw error for negative velocity', () => {
      expect(() => calculateDuration(5, -10, 7)).toThrow('Velocity must be greater than zero');
    });

    it('should throw error for zero sprint duration', () => {
      expect(() => calculateDuration(5, 10, 0)).toThrow('Sprint duration must be greater than zero');
    });

    it('should throw error for negative sprint duration', () => {
      expect(() => calculateDuration(5, 10, -7)).toThrow('Sprint duration must be greater than zero');
    });

    it('should throw error for negative estimate', () => {
      expect(() => calculateDuration(-5, 10, 7)).toThrow('Estimate must be non-negative');
    });
  });

  describe('addDays', () => {
    it('should add days to a date correctly', () => {
      const result = addDays('2024-02-01', 3);
      expect(result).toBe('2024-02-04');
    });

    it('should handle fractional days by rounding', () => {
      const result = addDays('2024-02-01', 3.5);
      expect(result).toBe('2024-02-05'); // Rounded to 4 days
    });

    it('should handle month boundaries', () => {
      const result = addDays('2024-01-30', 5);
      expect(result).toBe('2024-02-04');
    });

    it('should handle year boundaries', () => {
      const result = addDays('2023-12-30', 5);
      expect(result).toBe('2024-01-04');
    });

    it('should handle leap years', () => {
      const result = addDays('2024-02-28', 1);
      expect(result).toBe('2024-02-29');
    });

    it('should handle adding zero days', () => {
      const result = addDays('2024-02-01', 0);
      expect(result).toBe('2024-02-01');
    });

    it('should throw error for invalid date format', () => {
      expect(() => addDays('invalid-date', 5)).toThrow('Invalid date format');
    });

    it('should throw error for malformed date', () => {
      expect(() => addDays('2024-13-01', 5)).toThrow('Invalid date format');
    });
  });

  describe('calculateSchedule', () => {
    const validConfig: ScheduleConfig = {
      projectStartDate: '2024-02-01',
      sprintDurationDays: 7,
      velocity: 10,
    };

    it('should calculate schedule for single task', () => {
      const tasks: Task[] = [
        {
          id: 'TASK-1',
          title: 'Task 1',
          estimate: 5,
        },
      ];

      const scheduled = calculateSchedule(tasks, validConfig);

      expect(scheduled).toHaveLength(1);
      expect(scheduled[0].id).toBe('TASK-1');
      expect(scheduled[0].calculatedStartDate).toBe('2024-02-01'); // Thursday
      // Duration: (5/10) * 7 = 3.5 days, rounded up to 4 working days
      // Thu + 4 working days = Thu, Fri, Mon, Tue = Tuesday 2024-02-06
      expect(scheduled[0].calculatedEndDate).toBe('2024-02-06');
    });

    it('should use project start date for first task', () => {
      const tasks: Task[] = [
        {
          id: 'TASK-1',
          title: 'First Task',
          estimate: 10,
        },
      ];

      const config: ScheduleConfig = {
        projectStartDate: '2024-03-15',
        sprintDurationDays: 10,
        velocity: 20,
      };

      const scheduled = calculateSchedule(tasks, config);

      expect(scheduled[0].calculatedStartDate).toBe('2024-03-15');
    });

    it('should use previous task end date for subsequent tasks', () => {
      const tasks: Task[] = [
        {
          id: 'TASK-1',
          title: 'Task 1',
          estimate: 5,
        },
        {
          id: 'TASK-2',
          title: 'Task 2',
          estimate: 8,
        },
      ];

      const scheduled = calculateSchedule(tasks, validConfig);

      expect(scheduled).toHaveLength(2);
      expect(scheduled[0].calculatedStartDate).toBe('2024-02-01');
      expect(scheduled[1].calculatedStartDate).toBe(scheduled[0].calculatedEndDate);
    });

    it('should process tasks sequentially in order', () => {
      const tasks: Task[] = [
        {
          id: 'TASK-1',
          title: 'Task 1',
          estimate: 5,
        },
        {
          id: 'TASK-2',
          title: 'Task 2',
          estimate: 10,
        },
        {
          id: 'TASK-3',
          title: 'Task 3',
          estimate: 3,
        },
      ];

      const scheduled = calculateSchedule(tasks, validConfig);

      expect(scheduled).toHaveLength(3);
      
      // Task 1: (5/10) * 7 = 3.5 days, rounded up to 4 working days
      // Thu 2024-02-01 + 4 working days = Thu, Fri, Mon, Tue = Tue 2024-02-06
      expect(scheduled[0].calculatedStartDate).toBe('2024-02-01');
      expect(scheduled[0].calculatedEndDate).toBe('2024-02-06');
      
      // Task 2: starts when Task 1 ends (Tue), (10/10) * 7 = 7 working days
      // Tue + 7 working days = Tue, Wed, Thu, Fri, Mon, Tue, Wed = Wed 2024-02-14
      expect(scheduled[1].calculatedStartDate).toBe('2024-02-06');
      expect(scheduled[1].calculatedEndDate).toBe('2024-02-14');
      
      // Task 3: starts when Task 2 ends (Wed), (3/10) * 7 = 2.1 days, rounded up to 3 working days
      // Wed + 3 working days = Wed, Thu, Fri = Fri 2024-02-16
      expect(scheduled[2].calculatedStartDate).toBe('2024-02-14');
      expect(scheduled[2].calculatedEndDate).toBe('2024-02-16');
    });

    it('should preserve all original task fields', () => {
      const tasks: Task[] = [
        {
          id: 'TASK-1',
          title: 'Task with Options',
          estimate: 5,
          component: 'Backend',
          parentId: 'EPIC-1',
          issueType: 'Story',
        },
      ];

      const scheduled = calculateSchedule(tasks, validConfig);

      expect(scheduled[0].id).toBe('TASK-1');
      expect(scheduled[0].title).toBe('Task with Options');
      expect(scheduled[0].estimate).toBe(5);
      expect(scheduled[0].component).toBe('Backend');
      expect(scheduled[0].parentId).toBe('EPIC-1');
      expect(scheduled[0].issueType).toBe('Story');
      expect(scheduled[0].calculatedStartDate).toBeDefined();
      expect(scheduled[0].calculatedEndDate).toBeDefined();
    });

    it('should handle zero estimate tasks', () => {
      const tasks: Task[] = [
        {
          id: 'TASK-1',
          title: 'Zero Estimate Task',
          estimate: 0,
        },
      ];

      const scheduled = calculateSchedule(tasks, validConfig);

      expect(scheduled[0].calculatedStartDate).toBe('2024-02-01'); // Thursday
      expect(scheduled[0].calculatedEndDate).toBe('2024-02-01'); // 0 days duration, same day
    });

    it('should handle tasks with negative estimates by using 0', () => {
      const tasks: Task[] = [
        {
          id: 'TASK-1',
          title: 'Negative Estimate Task',
          estimate: -5,
        },
      ];

      const scheduled = calculateSchedule(tasks, validConfig);

      expect(scheduled[0].calculatedStartDate).toBe('2024-02-01'); // Thursday
      expect(scheduled[0].calculatedEndDate).toBe('2024-02-01'); // 0 days duration, same day
    });

    it('should return empty array for empty task list', () => {
      const scheduled = calculateSchedule([], validConfig);
      expect(scheduled).toHaveLength(0);
    });

    it('should throw error for zero velocity', () => {
      const tasks: Task[] = [
        {
          id: 'TASK-1',
          title: 'Task 1',
          estimate: 5,
        },
      ];

      const invalidConfig: ScheduleConfig = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 7,
        velocity: 0,
      };

      expect(() => calculateSchedule(tasks, invalidConfig)).toThrow('Invalid velocity');
    });

    it('should throw error for zero sprint duration', () => {
      const tasks: Task[] = [
        {
          id: 'TASK-1',
          title: 'Task 1',
          estimate: 5,
        },
      ];

      const invalidConfig: ScheduleConfig = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 0,
        velocity: 10,
      };

      expect(() => calculateSchedule(tasks, invalidConfig)).toThrow('Invalid sprint duration');
    });

    it('should throw error for invalid project start date', () => {
      const tasks: Task[] = [
        {
          id: 'TASK-1',
          title: 'Task 1',
          estimate: 5,
        },
      ];

      const invalidConfig: ScheduleConfig = {
        projectStartDate: 'invalid-date',
        sprintDurationDays: 7,
        velocity: 10,
      };

      expect(() => calculateSchedule(tasks, invalidConfig)).toThrow('Invalid project start date');
    });

    it('should handle AC2 scenario: Estimate=5, Velocity=10, SprintDuration=7', () => {
      const tasks: Task[] = [
        {
          id: 'TASK-1',
          title: 'AC2 Test Task',
          estimate: 5,
        },
      ];

      const config: ScheduleConfig = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 7,
        velocity: 10,
      };

      const scheduled = calculateSchedule(tasks, config);

      // Duration = (5/10) * 7 = 3.5 days, rounded up to 4 working days
      // Start: 2024-02-01 (Thursday)
      // End: Thu + 4 working days = Thu, Fri, Mon, Tue = 2024-02-06 (Tuesday)
      expect(scheduled[0].calculatedStartDate).toBe('2024-02-01');
      expect(scheduled[0].calculatedEndDate).toBe('2024-02-06');
    });

    it('should handle multiple tasks with different estimates', () => {
      const tasks: Task[] = [
        {
          id: 'TASK-1',
          title: 'Small Task',
          estimate: 2,
        },
        {
          id: 'TASK-2',
          title: 'Medium Task',
          estimate: 5,
        },
        {
          id: 'TASK-3',
          title: 'Large Task',
          estimate: 13,
        },
      ];

      const config: ScheduleConfig = {
        projectStartDate: '2024-01-01',
        sprintDurationDays: 10,
        velocity: 10,
      };

      const scheduled = calculateSchedule(tasks, config);

      // Task 1: (2/10) * 10 = 2 working days
      // Mon 2024-01-01 + 2 working days = Mon, Tue = Tue 2024-01-02
      expect(scheduled[0].calculatedStartDate).toBe('2024-01-01');
      expect(scheduled[0].calculatedEndDate).toBe('2024-01-02');
      
      // Task 2: starts when Task 1 ends (Tue), (5/10) * 10 = 5 working days
      // Tue + 5 working days = Tue, Wed, Thu, Fri, Mon = Mon 2024-01-08
      expect(scheduled[1].calculatedStartDate).toBe('2024-01-02');
      expect(scheduled[1].calculatedEndDate).toBe('2024-01-08');
      
      // Task 3: starts when Task 2 ends (Mon), (13/10) * 10 = 13 working days
      // Mon + 13 working days = Mon, Tue, Wed, Thu, Fri, Mon, Tue, Wed, Thu, Fri, Mon, Tue, Wed = Wed 2024-01-24
      expect(scheduled[2].calculatedStartDate).toBe('2024-01-08');
      expect(scheduled[2].calculatedEndDate).toBe('2024-01-24');
    });

    describe('working days functionality', () => {
      it('should handle AC1: Task with 2.5 days starting Monday completes Wednesday', () => {
        const tasks: Task[] = [
          {
            id: 'TASK-1',
            title: 'AC1 Test Task',
            estimate: 5,
          },
        ];

        const config: ScheduleConfig = {
          projectStartDate: '2024-02-05', // Monday
          sprintDurationDays: 7,
          velocity: 10,
        };

        const scheduled = calculateSchedule(tasks, config);

        // Duration = (5/10) * 7 = 3.5 days, but let's test 2.5 days scenario
        // Actually, let's create a scenario that gives us 2.5 days
        // Estimate = 5, Velocity = 14, SprintDuration = 7 gives us (5/14) * 7 = 2.5 days
        const config2: ScheduleConfig = {
          projectStartDate: '2024-02-05', // Monday
          sprintDurationDays: 7,
          velocity: 14,
        };

        const scheduled2 = calculateSchedule(tasks, config2);

        // Duration = (5/14) * 7 = 2.5 days, rounded up to 3 working days
        // Mon + 3 working days = Mon, Tue, Wed = Wed 2024-02-07
        expect(scheduled2[0].calculatedStartDate).toBe('2024-02-05'); // Monday
        expect(scheduled2[0].calculatedEndDate).toBe('2024-02-07'); // Wednesday
      });

      it('should handle AC2: Task starting Friday with 1.5 days completes Monday', () => {
        const tasks: Task[] = [
          {
            id: 'TASK-1',
            title: 'AC2 Test Task',
            estimate: 3,
          },
        ];

        const config: ScheduleConfig = {
          projectStartDate: '2024-02-09', // Friday
          sprintDurationDays: 7,
          velocity: 14, // (3/14) * 7 = 1.5 days
        };

        const scheduled = calculateSchedule(tasks, config);

        // Duration = 1.5 days, rounded up to 2 working days
        // Fri + 2 working days = Fri, Mon (skips weekend) = Mon 2024-02-12
        expect(scheduled[0].calculatedStartDate).toBe('2024-02-09'); // Friday
        expect(scheduled[0].calculatedEndDate).toBe('2024-02-12'); // Monday
      });

      it('should handle AC3: Configuration with non-working days excludes those dates', () => {
        const tasks: Task[] = [
          {
            id: 'TASK-1',
            title: 'AC3 Test Task',
            estimate: 5,
          },
        ];

        const config: ScheduleConfig = {
          projectStartDate: '2024-02-05', // Monday
          sprintDurationDays: 7,
          velocity: 10,
          nonWorkingDays: ['2024-02-07', '2024-02-08'], // Wednesday and Thursday holidays
        };

        const scheduled = calculateSchedule(tasks, config);

        // Duration = (5/10) * 7 = 3.5 days, rounded up to 4 working days
        // Mon + 4 working days = Mon, Tue, Fri, Mon (skips Wed, Thu holidays) = Mon 2024-02-12
        expect(scheduled[0].calculatedStartDate).toBe('2024-02-05'); // Monday
        expect(scheduled[0].calculatedEndDate).toBe('2024-02-12'); // Monday (skipped Wed, Thu)
      });

      it('should handle AC4: Sequential tasks properly chain with no gaps', () => {
        const tasks: Task[] = [
          {
            id: 'TASK-1',
            title: 'Task 1',
            estimate: 5,
          },
          {
            id: 'TASK-2',
            title: 'Task 2',
            estimate: 5,
          },
        ];

        const config: ScheduleConfig = {
          projectStartDate: '2024-02-05', // Monday
          sprintDurationDays: 7,
          velocity: 14, // (5/14) * 7 = 2.5 days per task
        };

        const scheduled = calculateSchedule(tasks, config);

        // Task 1: Mon + 2.5 days (rounded to 3) = Mon, Tue, Wed = Wed 2024-02-07
        expect(scheduled[0].calculatedStartDate).toBe('2024-02-05'); // Monday
        expect(scheduled[0].calculatedEndDate).toBe('2024-02-07'); // Wednesday

        // Task 2: starts when Task 1 ends (Wed), Wed + 2.5 days (rounded to 3) = Wed, Thu, Fri = Fri 2024-02-09
        expect(scheduled[1].calculatedStartDate).toBe('2024-02-07'); // Wednesday (same as Task 1 end)
        expect(scheduled[1].calculatedEndDate).toBe('2024-02-09'); // Friday
      });

      it('should handle project start date on weekend', () => {
        const tasks: Task[] = [
          {
            id: 'TASK-1',
            title: 'Weekend Start Task',
            estimate: 5,
          },
        ];

        const config: ScheduleConfig = {
          projectStartDate: '2024-02-10', // Saturday
          sprintDurationDays: 7,
          velocity: 10,
        };

        const scheduled = calculateSchedule(tasks, config);

        // Should start on next working day (Monday)
        expect(scheduled[0].calculatedStartDate).toBe('2024-02-12'); // Monday
      });

      it('should handle project start date on holiday', () => {
        const tasks: Task[] = [
          {
            id: 'TASK-1',
            title: 'Holiday Start Task',
            estimate: 5,
          },
        ];

        const config: ScheduleConfig = {
          projectStartDate: '2024-02-05', // Monday (will be a holiday)
          sprintDurationDays: 7,
          velocity: 10,
          nonWorkingDays: ['2024-02-05'], // Monday is a holiday
        };

        const scheduled = calculateSchedule(tasks, config);

        // Should start on next working day (Tuesday)
        expect(scheduled[0].calculatedStartDate).toBe('2024-02-06'); // Tuesday
      });
    });
  });
});
