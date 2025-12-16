/**
 * Unit tests for CLI interface.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseArgs } from '../cli';
import { logger } from '../../utils/logger';

describe('cli', () => {
  beforeEach(() => {
    logger.clear();
  });

  describe('parseArgs', () => {
    it('should parse --input flag', () => {
      const options = parseArgs(['--input', 'test.csv']);
      expect(options.input).toBe('test.csv');
    });

    it('should parse -i shorthand', () => {
      const options = parseArgs(['-i', 'test.csv']);
      expect(options.input).toBe('test.csv');
    });

    it('should parse --config flag', () => {
      const options = parseArgs(['--input', 'test.csv', '--config', 'config.json']);
      expect(options.config).toBe('config.json');
    });

    it('should parse --suppress-warnings flag', () => {
      const options = parseArgs(['--input', 'test.csv', '--suppress-warnings']);
      expect(options.suppressWarnings).toBe(true);
    });

    it('should parse -q shorthand for suppress warnings', () => {
      const options = parseArgs(['--input', 'test.csv', '-q']);
      expect(options.suppressWarnings).toBe(true);
    });

    it('should return empty options when no args provided', () => {
      const options = parseArgs([]);
      expect(options.input).toBeUndefined();
      expect(options.config).toBeUndefined();
      expect(options.suppressWarnings).toBeUndefined();
    });

    it('should handle multiple flags', () => {
      const options = parseArgs([
        '--input',
        'test.csv',
        '--config',
        'config.json',
        '--suppress-warnings',
      ]);
      expect(options.input).toBe('test.csv');
      expect(options.config).toBe('config.json');
      expect(options.suppressWarnings).toBe(true);
    });
  });
});
