/**
 * Unit tests for estimate processor.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { processEstimate } from '../estimate-processor';
import { EstimateConfig, DEFAULT_CONFIG } from '../../config/Config';
import { logger } from '../logger';

describe('estimate-processor', () => {
  beforeEach(() => {
    logger.clear();
  });

  describe('processEstimate - Story Points', () => {
    const storyPointsConfig: EstimateConfig = {
      estimateType: 'story-points',
      hoursPerDay: 8,
      validStoryPoints: [1, 2, 3, 5, 8],
    };

    it('should process valid story points', () => {
      expect(processEstimate('1', storyPointsConfig)).toBe(8);
      expect(processEstimate('2', storyPointsConfig)).toBe(16);
      expect(processEstimate('3', storyPointsConfig)).toBe(24);
      expect(processEstimate('5', storyPointsConfig)).toBe(40);
      expect(processEstimate('8', storyPointsConfig)).toBe(64);
    });

    it('should default to 1 for missing estimate', () => {
      expect(processEstimate(undefined, storyPointsConfig)).toBe(1);
      expect(processEstimate('', storyPointsConfig)).toBe(1);
      expect(processEstimate('   ', storyPointsConfig)).toBe(1);
    });

    it('should reject invalid story points values', () => {
      expect(processEstimate('4', storyPointsConfig)).toBe(1);
      expect(processEstimate('6', storyPointsConfig)).toBe(1);
      expect(processEstimate('7', storyPointsConfig)).toBe(1);
      expect(processEstimate('9', storyPointsConfig)).toBe(1);
      expect(processEstimate('13', storyPointsConfig)).toBe(1);
      expect(processEstimate('20', storyPointsConfig)).toBe(1);
    });

    it('should reject non-integer story points', () => {
      expect(processEstimate('1.5', storyPointsConfig)).toBe(1);
      expect(processEstimate('2.0', storyPointsConfig)).toBe(1);
    });

    it('should reject negative or zero values', () => {
      expect(processEstimate('0', storyPointsConfig)).toBe(1);
      expect(processEstimate('-1', storyPointsConfig)).toBe(1);
    });

    it('should reject non-numeric values', () => {
      expect(processEstimate('abc', storyPointsConfig)).toBe(1);
      expect(processEstimate('invalid', storyPointsConfig)).toBe(1);
    });
  });

  describe('processEstimate - Days/Hours', () => {
    const daysHoursConfig: EstimateConfig = {
      estimateType: 'days-hours',
      hoursPerDay: 8,
      validStoryPoints: [],
    };

    it('should process hours format', () => {
      expect(processEstimate('8h', daysHoursConfig)).toBe(8);
      expect(processEstimate('4.5h', daysHoursConfig)).toBe(4.5);
      expect(processEstimate('8 h', daysHoursConfig)).toBe(8);
      expect(processEstimate('8', daysHoursConfig)).toBe(8); // Default to hours
    });

    it('should process days format', () => {
      expect(processEstimate('1d', daysHoursConfig)).toBe(8);
      expect(processEstimate('2d', daysHoursConfig)).toBe(16);
      expect(processEstimate('1.5d', daysHoursConfig)).toBe(12);
      expect(processEstimate('1 d', daysHoursConfig)).toBe(8);
    });

    it('should process weeks format', () => {
      expect(processEstimate('1w', daysHoursConfig)).toBe(40); // 5 days * 8 hours
      expect(processEstimate('2w', daysHoursConfig)).toBe(80);
      expect(processEstimate('1 w', daysHoursConfig)).toBe(40);
    });

    it('should default to 1 for missing estimate', () => {
      expect(processEstimate(undefined, daysHoursConfig)).toBe(1);
      expect(processEstimate('', daysHoursConfig)).toBe(1);
    });

    it('should reject days >= 7', () => {
      expect(processEstimate('7d', daysHoursConfig)).toBe(1);
      expect(processEstimate('10d', daysHoursConfig)).toBe(1);
    });

    it('should reject invalid formats', () => {
      expect(processEstimate('abc', daysHoursConfig)).toBe(1);
      expect(processEstimate('invalid', daysHoursConfig)).toBe(1);
      expect(processEstimate('x', daysHoursConfig)).toBe(1);
    });

    it('should handle custom hoursPerDay', () => {
      const customConfig: EstimateConfig = {
        estimateType: 'days-hours',
        hoursPerDay: 6,
        validStoryPoints: [],
      };
      expect(processEstimate('1d', customConfig)).toBe(6);
      expect(processEstimate('1w', customConfig)).toBe(30); // 5 days * 6 hours
    });
  });

  describe('processEstimate - Default config', () => {
    it('should use default config when not provided', () => {
      expect(processEstimate('1')).toBe(8); // Story points default
      expect(processEstimate('2')).toBe(16);
    });
  });
});
