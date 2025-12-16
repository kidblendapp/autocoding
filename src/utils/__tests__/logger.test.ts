/**
 * Unit tests for structured logger.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { logger } from '../logger';

describe('StructuredLogger', () => {
  beforeEach(() => {
    logger.clear();
  });

  it('should log warnings', () => {
    logger.warn('Test warning', 1);
    const entries = logger.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe('warn');
    expect(entries[0].message).toBe('Test warning');
    expect(entries[0].rowNumber).toBe(1);
  });

  it('should log errors', () => {
    logger.error('Test error', { code: 'ERR001' });
    const entries = logger.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe('error');
    expect(entries[0].message).toBe('Test error');
    expect(entries[0].details).toEqual({ code: 'ERR001' });
  });

  it('should log info messages', () => {
    logger.info('Test info');
    const entries = logger.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe('info');
    expect(entries[0].message).toBe('Test info');
  });

  it('should provide summary statistics', () => {
    logger.warn('Warning 1');
    logger.warn('Warning 2');
    logger.error('Error 1');
    logger.info('Info 1');

    const summary = logger.getSummary();
    expect(summary.warnings).toBe(2);
    expect(summary.errors).toBe(1);
    expect(summary.total).toBe(4);
  });

  it('should suppress warnings when enabled', () => {
    logger.setSuppressWarnings(true);
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    logger.warn('Suppressed warning');
    
    const entries = logger.getEntries();
    expect(entries).toHaveLength(1);
    expect(consoleSpy).not.toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });
});
