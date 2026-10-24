import { describe, it, expect } from 'vitest';
import {
  acuityFor,
  snellenLineFor,
  SNELLEN_LINES,
  inTheWay,
  describeDelta,
} from '../../src/features/audit/acuity';

describe('acuityFor', () => {
  it.each([
    [100, '20/20'],
    [95, '20/20'],
    [94, '20/25'],
    [85, '20/25'],
    [84, '20/30'],
    [77, '20/30'],
    [75, '20/30'],
    [74, '20/40'],
    [65, '20/40'],
    [64, '20/50'],
    [55, '20/50'],
    [54, '20/70'],
    [45, '20/70'],
    [44, '20/100'],
    [30, '20/100'],
    [29, '20/200'],
    [0, '20/200'],
  ])('score %i reads at %s', (score, acuity) => {
    expect(acuityFor(score)).toBe(acuity);
  });
});

describe('snellenLineFor', () => {
  it('points at the chart line with the same acuity', () => {
    expect(SNELLEN_LINES[snellenLineFor(77)].acuity).toBe('20/30');
    expect(snellenLineFor(0)).toBe(0); // the big E
    expect(snellenLineFor(100)).toBe(SNELLEN_LINES.length - 1);
  });
  it('draws smaller letters on every lower line', () => {
    const sizes = SNELLEN_LINES.map((l) => l.size);
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
  });
});

describe('inTheWay', () => {
  it('counts issues in words', () => {
    expect(inTheWay(0)).toBe('Nothing gets in the way.');
    expect(inTheWay(1)).toBe('One thing gets in the way.');
    expect(inTheWay(4)).toBe('Four things get in the way.');
    expect(inTheWay(23)).toBe('23 things get in the way.');
  });
});

describe('describeDelta', () => {
  it('describes the change since the last check in words', () => {
    expect(describeDelta(77, null)).toBe('First check of this page');
    expect(describeDelta(82, 77)).toBe('Up 5 since the last check');
    expect(describeDelta(70, 77)).toBe('Down 7 since the last check');
    expect(describeDelta(77, 77)).toBe('No change since the last check');
  });
});
