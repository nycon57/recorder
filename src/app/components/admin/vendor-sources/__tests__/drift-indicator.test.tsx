/**
 * DriftIndicator — color threshold and rendering tests.
 *
 * TRIB-152
 */

import { describe, expect, test } from '@jest/globals';

import { getDriftLevel } from '../drift-indicator';

describe('getDriftLevel', () => {
  test('returns healthy when days < 50% of target', () => {
    expect(getDriftLevel(3, 14)).toBe('healthy');
    expect(getDriftLevel(0, 14)).toBe('healthy');
    expect(getDriftLevel(6, 14)).toBe('healthy');  // exactly 42.8%
  });

  test('returns warning when days is 50-100% of target', () => {
    expect(getDriftLevel(7, 14)).toBe('warning');   // exactly 50%
    expect(getDriftLevel(10, 14)).toBe('warning');  // 71%
    expect(getDriftLevel(14, 14)).toBe('warning');  // exactly 100%
  });

  test('returns critical when days > 100% of target', () => {
    expect(getDriftLevel(15, 14)).toBe('critical'); // 107%
    expect(getDriftLevel(30, 14)).toBe('critical');
  });

  test('returns critical when daysSinceSuccess is null (never synced)', () => {
    expect(getDriftLevel(null, 14)).toBe('critical');
  });

  test('returns critical when targetDays is null (unparseable freshness_target)', () => {
    expect(getDriftLevel(5, null)).toBe('critical');
  });

  test('returns critical when both are null', () => {
    expect(getDriftLevel(null, null)).toBe('critical');
  });
});
