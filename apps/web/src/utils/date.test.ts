import { describe, it, expect, vi, afterEach } from 'vitest';

import { getCurrentMonth, shiftMonth } from './date';

describe('getCurrentMonth', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns current month in YYYY-MM format', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 15)); // March 2026
    expect(getCurrentMonth()).toBe('2026-03');
    vi.useRealTimers();
  });

  it('pads single-digit months with zero', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1)); // January 2026
    expect(getCurrentMonth()).toBe('2026-01');
    vi.useRealTimers();
  });

  it('handles December correctly', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 31)); // December 2026
    expect(getCurrentMonth()).toBe('2026-12');
    vi.useRealTimers();
  });
});

describe('shiftMonth', () => {
  it('shifts forward by 1 month', () => {
    expect(shiftMonth('2026-03', 1)).toBe('2026-04');
  });

  it('shifts backward by 1 month', () => {
    expect(shiftMonth('2026-03', -1)).toBe('2026-02');
  });

  it('rolls over to next year', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('rolls back to previous year', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('shifts by multiple months', () => {
    expect(shiftMonth('2026-03', 3)).toBe('2026-06');
  });

  it('shifts backward by multiple months across year boundary', () => {
    expect(shiftMonth('2026-02', -3)).toBe('2025-11');
  });
});
