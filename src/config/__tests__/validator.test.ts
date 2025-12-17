/**
 * Unit tests for configuration validator.
 */

import { describe, it, expect } from 'vitest';
import { validateConfig, formatValidationErrors } from '../validator';
import type { RawScheduleConfig } from '../types';

describe('Config Validator', () => {
  describe('validateConfig', () => {
    it('should validate correct configuration', () => {
      const config: RawScheduleConfig = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        velocity: 20,
      };

      const result = validateConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.config).toEqual({
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        velocity: 20,
      });
    });

    describe('required field validation', () => {
      it('should reject missing projectStartDate', () => {
        const config: RawScheduleConfig = {
          sprintDurationDays: 10,
          velocity: 20,
        };

        const result = validateConfig(config);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].field).toBe('projectStartDate');
        expect(result.errors[0].message).toContain('Missing required field');
      });

      it('should reject null projectStartDate', () => {
        const config: RawScheduleConfig = {
          projectStartDate: null,
          sprintDurationDays: 10,
          velocity: 20,
        };

        const result = validateConfig(config);
        
        expect(result.valid).toBe(false);
        expect(result.errors[0].field).toBe('projectStartDate');
      });

      it('should reject missing sprintDurationDays', () => {
        const config: RawScheduleConfig = {
          projectStartDate: '2024-02-01',
          velocity: 20,
        };

        const result = validateConfig(config);
        
        expect(result.valid).toBe(false);
        expect(result.errors[0].field).toBe('sprintDurationDays');
        expect(result.errors[0].message).toContain('Missing required field');
      });

      it('should reject null sprintDurationDays', () => {
        const config: RawScheduleConfig = {
          projectStartDate: '2024-02-01',
          sprintDurationDays: null,
          velocity: 20,
        };

        const result = validateConfig(config);
        
        expect(result.valid).toBe(false);
        expect(result.errors[0].field).toBe('sprintDurationDays');
      });

      it('should reject missing velocity', () => {
        const config: RawScheduleConfig = {
          projectStartDate: '2024-02-01',
          sprintDurationDays: 10,
        };

        const result = validateConfig(config);
        
        expect(result.valid).toBe(false);
        expect(result.errors[0].field).toBe('velocity');
        expect(result.errors[0].message).toContain('Missing required field');
      });

      it('should reject null velocity', () => {
        const config: RawScheduleConfig = {
          projectStartDate: '2024-02-01',
          sprintDurationDays: 10,
          velocity: null,
        };

        const result = validateConfig(config);
        
        expect(result.valid).toBe(false);
        expect(result.errors[0].field).toBe('velocity');
      });

      it('should report all missing fields', () => {
        const config: RawScheduleConfig = {};

        const result = validateConfig(config);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(3);
        expect(result.errors.map(e => e.field)).toContain('projectStartDate');
        expect(result.errors.map(e => e.field)).toContain('sprintDurationDays');
        expect(result.errors.map(e => e.field)).toContain('velocity');
      });
    });

    describe('projectStartDate validation', () => {
      it('should reject non-string projectStartDate', () => {
        const config: RawScheduleConfig = {
          projectStartDate: 20240201,
          sprintDurationDays: 10,
          velocity: 20,
        };

        const result = validateConfig(config);
        
        expect(result.valid).toBe(false);
        expect(result.errors[0].field).toBe('projectStartDate');
        expect(result.errors[0].message).toContain('must be a string');
      });

      it('should reject invalid date format (not ISO)', () => {
        const config: RawScheduleConfig = {
          projectStartDate: '02/01/2024',
          sprintDurationDays: 10,
          velocity: 20,
        };

        const result = validateConfig(config);
        
        expect(result.valid).toBe(false);
        expect(result.errors[0].field).toBe('projectStartDate');
        expect(result.errors[0].message).toContain('ISO format');
      });

      it('should reject invalid date format (wrong separator)', () => {
        const config: RawScheduleConfig = {
          projectStartDate: '2024.02.01',
          sprintDurationDays: 10,
          velocity: 20,
        };

        const result = validateConfig(config);
        
        expect(result.valid).toBe(false);
        expect(result.errors[0].field).toBe('projectStartDate');
      });

      it('should reject invalid date (invalid month)', () => {
        const config: RawScheduleConfig = {
          projectStartDate: '2024-13-01',
          sprintDurationDays: 10,
          velocity: 20,
        };

        const result = validateConfig(config);
        
        expect(result.valid).toBe(false);
        expect(result.errors[0].field).toBe('projectStartDate');
        expect(result.errors[0].message).toContain('not a valid date');
      });

      it('should reject invalid date (invalid day)', () => {
        const config: RawScheduleConfig = {
          projectStartDate: '2024-02-30',
          sprintDurationDays: 10,
          velocity: 20,
        };

        const result = validateConfig(config);
        
        expect(result.valid).toBe(false);
        expect(result.errors[0].field).toBe('projectStartDate');
      });

      it('should accept valid ISO date', () => {
        const config: RawScheduleConfig = {
          projectStartDate: '2024-02-01',
          sprintDurationDays: 10,
          velocity: 20,
        };

        const result = validateConfig(config);
        
        expect(result.valid).toBe(true);
        expect(result.config?.projectStartDate).toBe('2024-02-01');
      });

      it('should accept leap year date', () => {
        const config: RawScheduleConfig = {
          projectStartDate: '2024-02-29',
          sprintDurationDays: 10,
          velocity: 20,
        };

        const result = validateConfig(config);
        
        expect(result.valid).toBe(true);
      });

      it('should reject non-leap year February 29', () => {
        const config: RawScheduleConfig = {
          projectStartDate: '2023-02-29',
          sprintDurationDays: 10,
          velocity: 20,
        };

        const result = validateConfig(config);
        
        expect(result.valid).toBe(false);
        expect(result.errors[0].field).toBe('projectStartDate');
      });
    });

    describe('sprintDurationDays validation', () => {
      it('should reject non-number sprintDurationDays', () => {
        const config: RawScheduleConfig = {
          projectStartDate: '2024-02-01',
          sprintDurationDays: '10',
          velocity: 20,
        };

        const result = validateConfig(config);
        
        expect(result.valid).toBe(false);
        expect(result.errors[0].field).toBe('sprintDurationDays');
        expect(result.errors[0].message).toContain('must be a number');
      });

      it('should reject zero sprintDurationDays', () => {
        const config: RawScheduleConfig = {
          projectStartDate: '2024-02-01',
          sprintDurationDays: 0,
          velocity: 20,
        };

        const result = validateConfig(config);
        
        expect(result.valid).toBe(false);
        expect(result.errors[0].field).toBe('sprintDurationDays');
        expect(result.errors[0].message).toContain('must be a positive number');
      });

      it('should reject negative sprintDurationDays', () => {
        const config: RawScheduleConfig = {
          projectStartDate: '2024-02-01',
          sprintDurationDays: -5,
          velocity: 20,
        };

        const result = validateConfig(config);
        
        expect(result.valid).toBe(false);
        expect(result.errors[0].field).toBe('sprintDurationDays');
        expect(result.errors[0].message).toContain('must be a positive number');
      });

      it('should reject non-integer sprintDurationDays', () => {
        const config: RawScheduleConfig = {
          projectStartDate: '2024-02-01',
          sprintDurationDays: 10.5,
          velocity: 20,
        };

        const result = validateConfig(config);
        
        expect(result.valid).toBe(false);
        expect(result.errors[0].field).toBe('sprintDurationDays');
        expect(result.errors[0].message).toContain('must be an integer');
      });

      it('should accept positive integer sprintDurationDays', () => {
        const config: RawScheduleConfig = {
          projectStartDate: '2024-02-01',
          sprintDurationDays: 10,
          velocity: 20,
        };

        const result = validateConfig(config);
        
        expect(result.valid).toBe(true);
        expect(result.config?.sprintDurationDays).toBe(10);
      });
    });

    describe('velocity validation', () => {
      it('should reject non-number velocity', () => {
        const config: RawScheduleConfig = {
          projectStartDate: '2024-02-01',
          sprintDurationDays: 10,
          velocity: '20',
        };

        const result = validateConfig(config);
        
        expect(result.valid).toBe(false);
        expect(result.errors[0].field).toBe('velocity');
        expect(result.errors[0].message).toContain('must be a number');
      });

      it('should reject zero velocity', () => {
        const config: RawScheduleConfig = {
          projectStartDate: '2024-02-01',
          sprintDurationDays: 10,
          velocity: 0,
        };

        const result = validateConfig(config);
        
        expect(result.valid).toBe(false);
        expect(result.errors[0].field).toBe('velocity');
        expect(result.errors[0].message).toContain('must be a positive number');
      });

      it('should reject negative velocity', () => {
        const config: RawScheduleConfig = {
          projectStartDate: '2024-02-01',
          sprintDurationDays: 10,
          velocity: -10,
        };

        const result = validateConfig(config);
        
        expect(result.valid).toBe(false);
        expect(result.errors[0].field).toBe('velocity');
        expect(result.errors[0].message).toContain('must be a positive number');
      });

      it('should accept positive velocity (integer)', () => {
        const config: RawScheduleConfig = {
          projectStartDate: '2024-02-01',
          sprintDurationDays: 10,
          velocity: 20,
        };

        const result = validateConfig(config);
        
        expect(result.valid).toBe(true);
        expect(result.config?.velocity).toBe(20);
      });

      it('should accept positive velocity (decimal)', () => {
        const config: RawScheduleConfig = {
          projectStartDate: '2024-02-01',
          sprintDurationDays: 10,
          velocity: 20.5,
        };

        const result = validateConfig(config);
        
        expect(result.valid).toBe(true);
        expect(result.config?.velocity).toBe(20.5);
      });
    });

    describe('multiple validation errors', () => {
      it('should report all validation errors', () => {
        const config: RawScheduleConfig = {
          projectStartDate: 'invalid-date',
          sprintDurationDays: -5,
          velocity: 0,
        };

        const result = validateConfig(config);
        
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThanOrEqual(3);
        expect(result.errors.some(e => e.field === 'projectStartDate')).toBe(true);
        expect(result.errors.some(e => e.field === 'sprintDurationDays')).toBe(true);
        expect(result.errors.some(e => e.field === 'velocity')).toBe(true);
      });
    });
  });

  describe('formatValidationErrors', () => {
    it('should format single error', () => {
      const errors = [
        { field: 'projectStartDate', message: 'Missing required field' },
      ];

      const formatted = formatValidationErrors(errors);
      
      expect(formatted).toContain('Configuration validation failed');
      expect(formatted).toContain('projectStartDate');
      expect(formatted).toContain('Missing required field');
    });

    it('should format multiple errors', () => {
      const errors = [
        { field: 'projectStartDate', message: 'Missing required field' },
        { field: 'velocity', message: 'must be a positive number' },
      ];

      const formatted = formatValidationErrors(errors);
      
      expect(formatted).toContain('2 error(s)');
      expect(formatted).toContain('projectStartDate');
      expect(formatted).toContain('velocity');
    });

    it('should return empty string for no errors', () => {
      const formatted = formatValidationErrors([]);
      expect(formatted).toBe('');
    });
  });

  describe('changeHistory validation', () => {
    it('should accept valid configuration with changeHistory', () => {
      const config: RawScheduleConfig = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        velocity: 20,
        changeHistory: {
          jql: 'project = PROJ AND status = Done',
        },
      };

      const result = validateConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.config?.changeHistory).toEqual({
        jql: 'project = PROJ AND status = Done',
        fieldMapping: undefined,
      });
    });

    it('should accept changeHistory with fieldMapping', () => {
      const config: RawScheduleConfig = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        velocity: 20,
        changeHistory: {
          jql: 'project = PROJ',
          fieldMapping: {
            sprint: 'customfield_10020',
            storyPoints: 'customfield_10021',
          },
        },
      };

      const result = validateConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.config?.changeHistory?.fieldMapping).toEqual({
        sprint: 'customfield_10020',
        storyPoints: 'customfield_10021',
      });
    });

    it('should accept changeHistory with partial fieldMapping', () => {
      const config: RawScheduleConfig = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        velocity: 20,
        changeHistory: {
          jql: 'project = PROJ',
          fieldMapping: {
            sprint: 'customfield_10020',
          },
        },
      };

      const result = validateConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.config?.changeHistory?.fieldMapping).toEqual({
        sprint: 'customfield_10020',
      });
    });

    it('should reject changeHistory with missing jql', () => {
      const config: RawScheduleConfig = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        velocity: 20,
        changeHistory: {
          fieldMapping: {
            sprint: 'customfield_10020',
          },
        },
      };

      const result = validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'changeHistory.jql')).toBe(true);
    });

    it('should reject changeHistory with null jql', () => {
      const config: RawScheduleConfig = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        velocity: 20,
        changeHistory: {
          jql: null,
        },
      };

      const result = validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'changeHistory.jql')).toBe(true);
    });

    it('should reject changeHistory with empty jql', () => {
      const config: RawScheduleConfig = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        velocity: 20,
        changeHistory: {
          jql: '   ',
        },
      };

      const result = validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'changeHistory.jql' && e.message.includes('not be empty'))).toBe(true);
    });

    it('should reject changeHistory with non-string jql', () => {
      const config: RawScheduleConfig = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        velocity: 20,
        changeHistory: {
          jql: 123,
        },
      };

      const result = validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'changeHistory.jql' && e.message.includes('must be a string'))).toBe(true);
    });

    it('should reject changeHistory with non-object fieldMapping', () => {
      const config: RawScheduleConfig = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        velocity: 20,
        changeHistory: {
          jql: 'project = PROJ',
          fieldMapping: 'invalid',
        },
      };

      const result = validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'changeHistory.fieldMapping')).toBe(true);
    });

    it('should reject changeHistory with non-string fieldMapping values', () => {
      const config: RawScheduleConfig = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        velocity: 20,
        changeHistory: {
          jql: 'project = PROJ',
          fieldMapping: {
            sprint: 123,
          },
        },
      };

      const result = validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'changeHistory.fieldMapping.sprint')).toBe(true);
    });

    it('should accept configuration without changeHistory', () => {
      const config: RawScheduleConfig = {
        projectStartDate: '2024-02-01',
        sprintDurationDays: 10,
        velocity: 20,
      };

      const result = validateConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.config?.changeHistory).toBeUndefined();
    });
  });
});
