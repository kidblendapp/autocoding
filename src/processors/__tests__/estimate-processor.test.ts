/**
 * Unit tests for estimate processor.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { processEstimate, validateAndProcessEstimate } from '../estimate-processor';
import { TeamConfig } from '../../config/types';
import { logger } from '../../utils/logger';

describe('EstimateProcessor', () => {
  beforeEach(() => {
    logger.clear();
    logger.setSuppressWarnings(true);
  });

  describe('Story Points processing', () => {
    const storyPointsConfig: TeamConfig = {
      estimateType: 'story-points',
      validStoryPoints: [1, 2, 3, 5, 8],
    };

    it('should accept valid story points', () => {
      expect(processEstimate('1', storyPointsConfig)).toBe(1);
      expect(processEstimate('2', storyPointsConfig)).toBe(2);
      expect(processEstimate('3', storyPointsConfig)).toBe(3);
      expect(processEstimate('5', storyPointsConfig)).toBe(5);
      expect(processEstimate('8', storyPointsConfig)).toBe(8);
    });

    it('should reject invalid story points', () => {
      expect(processEstimate('4', storyPointsConfig)).toBeNull();
      expect(processEstimate('6', storyPointsConfig)).toBeNull();
      expect(processEstimate('7', storyPointsConfig)).toBeNull();
      expect(processEstimate('9', storyPointsConfig)).toBeNull();
      expect(processEstimate('13', storyPointsConfig)).toBeNull();
      expect(processEstimate('20', storyPointsConfig)).toBeNull();
    });

    it('should reject non-integer story points', () => {
      expect(processEstimate('1.5', storyPointsConfig)).toBeNull();
      expect(processEstimate('2.5', storyPointsConfig)).toBeNull();
    });

    it('should reject negative or zero story points', () => {
      expect(processEstimate('0', storyPointsConfig)).toBeNull();
      expect(processEstimate('-1', storyPointsConfig)).toBeNull();
    });

    it('should reject non-numeric values', () => {
      expect(processEstimate('abc', storyPointsConfig)).toBeNull();
      expect(processEstimate('', storyPointsConfig)).toBeNull();
    });
  });

  describe('Days/Hours processing', () => {
    const daysHoursConfig: TeamConfig = {
      estimateType: 'days-hours',
      hoursPerDay: 8,
    };

    it('should convert hours correctly', () => {
      expect(processEstimate('4h', daysHoursConfig)).toBe(4);
      expect(processEstimate('8h', daysHoursConfig)).toBe(8);
      expect(processEstimate('4.5h', daysHoursConfig)).toBe(4.5);
    });

    it('should convert days correctly', () => {
      expect(processEstimate('1d', daysHoursConfig)).toBe(8);
      expect(processEstimate('2d', daysHoursConfig)).toBe(16);
      expect(processEstimate('2.5d', daysHoursConfig)).toBe(20);
    });

    it('should convert weeks correctly', () => {
      expect(processEstimate('1w', daysHoursConfig)).toBe(40); // 5 days * 8 hours
      expect(processEstimate('2w', daysHoursConfig)).toBe(80);
    });

    it('should accept plain numbers as hours', () => {
      expect(processEstimate('4', daysHoursConfig)).toBe(4);
      expect(processEstimate('8.5', daysHoursConfig)).toBe(8.5);
    });

    it('should reject values >= 7 days (56 hours)', () => {
      expect(processEstimate('7d', daysHoursConfig)).toBeNull();
      expect(processEstimate('56h', daysHoursConfig)).toBeNull();
      expect(processEstimate('60h', daysHoursConfig)).toBeNull();
    });

    it('should reject invalid formats', () => {
      expect(processEstimate('abc', daysHoursConfig)).toBeNull();
      expect(processEstimate('4x', daysHoursConfig)).toBeNull();
      expect(processEstimate('', daysHoursConfig)).toBeNull();
    });

    it('should reject negative or zero values', () => {
      expect(processEstimate('0h', daysHoursConfig)).toBeNull();
      expect(processEstimate('-1h', daysHoursConfig)).toBeNull();
    });

    it('should use custom hoursPerDay', () => {
      const customConfig: TeamConfig = {
        estimateType: 'days-hours',
        hoursPerDay: 6,
      };
      expect(processEstimate('1d', customConfig)).toBe(6);
      expect(processEstimate('2d', customConfig)).toBe(12);
    });
  });

  describe('validateAndProcessEstimate', () => {
    const config: TeamConfig = {
      estimateType: 'story-points',
      validStoryPoints: [1, 2, 3, 5, 8],
    };

    it('should return processed estimate for valid values', () => {
      expect(validateAndProcessEstimate('5', config, 1)).toBe(5);
    });

    it('should default to 1 for invalid values', () => {
      expect(validateAndProcessEstimate('4', config, 1)).toBe(1);
      expect(validateAndProcessEstimate('', config, 1)).toBe(1);
      expect(validateAndProcessEstimate(undefined, config, 1)).toBe(1);
    });

    it('should use custom default value', () => {
      expect(validateAndProcessEstimate('4', config, 1, 2)).toBe(2);
    });

    it('should log warnings for invalid estimates', () => {
      logger.clear();
      validateAndProcessEstimate('4', config, 5);
      const entries = logger.getEntries();
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[0].level).toBe('warn');
    });
  });
});
