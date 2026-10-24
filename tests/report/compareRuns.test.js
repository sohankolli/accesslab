import { describe, it, expect } from 'vitest';
import {
  compareRuns,
  describeScoreChange,
  describeCountChange,
} from '../../src/features/report/compareRuns';

describe('compareRuns', () => {
  it('compares score and every severity count, treating missing counts as 0', () => {
    const before = { score: 67, counts: { critical: 2, serious: 1, moderate: 1 } };
    const after = { score: 82, counts: { critical: 2, moderate: 1, minor: 1 } };
    expect(compareRuns(before, after)).toEqual({
      score: { before: 67, after: 82, change: 15 },
      counts: [
        { severity: 'critical', before: 2, after: 2, change: 0 },
        { severity: 'serious', before: 1, after: 0, change: -1 },
        { severity: 'moderate', before: 1, after: 1, change: 0 },
        { severity: 'minor', before: 0, after: 1, change: 1 },
      ],
    });
  });
  it('describes changes in words', () => {
    expect(describeScoreChange(15)).toBe('up 15');
    expect(describeScoreChange(-3)).toBe('down 3');
    expect(describeScoreChange(0)).toBe('no change');
    expect(describeCountChange(-2)).toBe('2 fewer');
    expect(describeCountChange(1)).toBe('1 more');
    expect(describeCountChange(0)).toBe('no change');
  });
});
