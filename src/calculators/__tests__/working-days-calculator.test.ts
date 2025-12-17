/**
 * Unit tests for Working Days Calculator.
 */

import { describe, it, expect } from 'vitest';
import { WorkingDaysCalendar } from '../working-days-calculator';

describe('WorkingDaysCalendar', () => {
  describe('isWorkingDay', () => {
    it('should identify Monday-Friday as working days', () => {
      const calendar = new WorkingDaysCalendar();
      
      // Monday, 2024-02-05
      expect(calendar.isWorkingDay('2024-02-05')).toBe(true);
      // Tuesday, 2024-02-06
      expect(calendar.isWorkingDay('2024-02-06')).toBe(true);
      // Wednesday, 2024-02-07
      expect(calendar.isWorkingDay('2024-02-07')).toBe(true);
      // Thursday, 2024-02-08
      expect(calendar.isWorkingDay('2024-02-08')).toBe(true);
      // Friday, 2024-02-09
      expect(calendar.isWorkingDay('2024-02-09')).toBe(true);
    });

    it('should identify Saturday-Sunday as non-working days', () => {
      const calendar = new WorkingDaysCalendar();
      
      // Saturday, 2024-02-10
      expect(calendar.isWorkingDay('2024-02-10')).toBe(false);
      // Sunday, 2024-02-11
      expect(calendar.isWorkingDay('2024-02-11')).toBe(false);
    });

    it('should identify configured holidays as non-working days', () => {
      const calendar = new WorkingDaysCalendar(['2024-02-05', '2024-12-25']);
      
      // Monday that is a holiday
      expect(calendar.isWorkingDay('2024-02-05')).toBe(false);
      // Christmas (Wednesday)
      expect(calendar.isWorkingDay('2024-12-25')).toBe(false);
      // Regular Monday
      expect(calendar.isWorkingDay('2024-02-12')).toBe(true);
    });

    it('should throw error for invalid date format', () => {
      const calendar = new WorkingDaysCalendar();
      
      expect(() => calendar.isWorkingDay('invalid-date')).toThrow('Invalid date format');
      expect(() => calendar.isWorkingDay('2024/02/05')).toThrow('Invalid date format');
      expect(() => calendar.isWorkingDay('2024-13-01')).toThrow('Invalid date');
    });
  });

  describe('addWorkingDays', () => {
    it('should add whole working days correctly', () => {
      const calendar = new WorkingDaysCalendar();
      
      // Monday + 2 days = Wednesday
      expect(calendar.addWorkingDays('2024-02-05', 2)).toBe('2024-02-07');
      // Monday + 5 days = Friday
      expect(calendar.addWorkingDays('2024-02-05', 5)).toBe('2024-02-09');
    });

    it('should handle fractional durations by rounding up', () => {
      const calendar = new WorkingDaysCalendar();
      
      // Monday + 2.5 days = Wednesday (rounded up from Tuesday)
      expect(calendar.addWorkingDays('2024-02-05', 2.5)).toBe('2024-02-07');
      // Monday + 0.5 days = Tuesday (rounded up)
      expect(calendar.addWorkingDays('2024-02-05', 0.5)).toBe('2024-02-06');
    });

    it('should skip weekends when adding working days', () => {
      const calendar = new WorkingDaysCalendar();
      
      // Friday + 1.5 days = Monday (skips weekend, rounded up)
      expect(calendar.addWorkingDays('2024-02-09', 1.5)).toBe('2024-02-12');
      // Friday + 2 days = Tuesday (skips weekend)
      expect(calendar.addWorkingDays('2024-02-09', 2)).toBe('2024-02-13');
    });

    it('should skip configured holidays when adding working days', () => {
      const calendar = new WorkingDaysCalendar(['2024-02-07']); // Wednesday holiday
      
      // Monday + 2 days = Thursday (skips Wednesday holiday)
      expect(calendar.addWorkingDays('2024-02-05', 2)).toBe('2024-02-08');
      // Monday + 2.5 days = Thursday (skips Wednesday holiday, rounded up)
      expect(calendar.addWorkingDays('2024-02-05', 2.5)).toBe('2024-02-08');
    });

    it('should handle zero days correctly', () => {
      const calendar = new WorkingDaysCalendar();
      
      // Zero days from Monday = Monday
      expect(calendar.addWorkingDays('2024-02-05', 0)).toBe('2024-02-05');
      // Zero days from Saturday = Monday (next working day)
      expect(calendar.addWorkingDays('2024-02-10', 0)).toBe('2024-02-12');
    });

    it('should ensure start date is a working day', () => {
      const calendar = new WorkingDaysCalendar();
      
      // Starting on Saturday, adding 1 day = Monday
      expect(calendar.addWorkingDays('2024-02-10', 1)).toBe('2024-02-12');
      // Starting on Sunday, adding 2 days = Wednesday
      expect(calendar.addWorkingDays('2024-02-11', 2)).toBe('2024-02-14');
    });

    it('should handle tasks spanning multiple weeks', () => {
      const calendar = new WorkingDaysCalendar();
      
      // Monday + 10 days = Friday of next week (skips 2 weekends)
      expect(calendar.addWorkingDays('2024-02-05', 10)).toBe('2024-02-23');
    });

    it('should throw error for negative days', () => {
      const calendar = new WorkingDaysCalendar();
      
      expect(() => calendar.addWorkingDays('2024-02-05', -1)).toThrow('Days must be non-negative');
    });

    it('should throw error for invalid date format', () => {
      const calendar = new WorkingDaysCalendar();
      
      expect(() => calendar.addWorkingDays('invalid-date', 5)).toThrow('Invalid date format');
    });
  });

  describe('nextWorkingDay', () => {
    it('should return the same date if already a working day', () => {
      const calendar = new WorkingDaysCalendar();
      
      // Monday is a working day
      expect(calendar.nextWorkingDay('2024-02-05')).toBe('2024-02-05');
      // Friday is a working day
      expect(calendar.nextWorkingDay('2024-02-09')).toBe('2024-02-09');
    });

    it('should skip weekends to find next working day', () => {
      const calendar = new WorkingDaysCalendar();
      
      // Saturday -> Monday
      expect(calendar.nextWorkingDay('2024-02-10')).toBe('2024-02-12');
      // Sunday -> Monday
      expect(calendar.nextWorkingDay('2024-02-11')).toBe('2024-02-12');
    });

    it('should skip configured holidays to find next working day', () => {
      const calendar = new WorkingDaysCalendar(['2024-02-05']); // Monday holiday
      
      // Monday holiday -> Tuesday
      expect(calendar.nextWorkingDay('2024-02-05')).toBe('2024-02-06');
      // Regular Monday -> Monday
      expect(calendar.nextWorkingDay('2024-02-12')).toBe('2024-02-12');
    });

    it('should handle consecutive holidays', () => {
      const calendar = new WorkingDaysCalendar(['2024-02-05', '2024-02-06']); // Monday and Tuesday holidays
      
      // Monday holiday -> Wednesday
      expect(calendar.nextWorkingDay('2024-02-05')).toBe('2024-02-07');
    });

    it('should throw error for invalid date format', () => {
      const calendar = new WorkingDaysCalendar();
      
      expect(() => calendar.nextWorkingDay('invalid-date')).toThrow('Invalid date format');
    });
  });

  describe('integration scenarios', () => {
    it('should handle AC1: Task with 2.5 days starting Monday completes Wednesday', () => {
      const calendar = new WorkingDaysCalendar();
      
      // Monday + 2.5 days = Wednesday (rounded up)
      const result = calendar.addWorkingDays('2024-02-05', 2.5);
      expect(result).toBe('2024-02-07'); // Wednesday
    });

    it('should handle AC2: Task starting Friday with 1.5 days completes Monday', () => {
      const calendar = new WorkingDaysCalendar();
      
      // Friday + 1.5 days = Monday (skips weekend, rounded up)
      const result = calendar.addWorkingDays('2024-02-09', 1.5);
      expect(result).toBe('2024-02-12'); // Monday
    });

    it('should handle AC3: Configuration with non-working days excludes those dates', () => {
      const calendar = new WorkingDaysCalendar(['2024-02-07', '2024-02-08']); // Wednesday and Thursday holidays
      
      // Monday + 2 days = Friday (skips Wednesday and Thursday)
      const result = calendar.addWorkingDays('2024-02-05', 2);
      expect(result).toBe('2024-02-09'); // Friday
    });

    it('should handle edge case: task starting on holiday', () => {
      const calendar = new WorkingDaysCalendar(['2024-02-05']); // Monday holiday
      
      // Starting on holiday, adding 1 day = Tuesday
      const result = calendar.addWorkingDays('2024-02-05', 1);
      expect(result).toBe('2024-02-06'); // Tuesday
    });

    it('should handle edge case: year boundary', () => {
      const calendar = new WorkingDaysCalendar();
      
      // December 30, 2024 (Monday) + 3 days = January 2, 2025 (Thursday, skipping New Year)
      // Note: New Year's Day 2025 is Wednesday, so we need to account for it
      const calendarWithHoliday = new WorkingDaysCalendar(['2025-01-01']);
      const result = calendarWithHoliday.addWorkingDays('2024-12-30', 3);
      expect(result).toBe('2025-01-03'); // Friday (skips New Year's Day)
    });

    it('should handle edge case: leap year', () => {
      const calendar = new WorkingDaysCalendar();
      
      // February 28, 2024 (Wednesday) + 1 day = February 29, 2024 (Thursday, leap year)
      expect(calendar.addWorkingDays('2024-02-28', 1)).toBe('2024-02-29');
    });
  });
});
