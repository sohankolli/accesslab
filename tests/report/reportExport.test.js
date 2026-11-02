
import { describe, it, expect } from 'vitest';
import { exportRunJSON, exportRunCSV } from '../../src/features/report/reportExport';

const run = {
  id: '1000',
  ranAt: 1000,
  score: 90,
  counts: { critical: 1 },
  issues: [
    {
      id: 'img-alt:img:nth-of-type(1)',
      ruleId: 'img-alt',
      severity: 'critical',
      selector: 'img.hero',
      message: 'Image has no alternative text',
      impact: 'Screen-reader users cannot understand the image.',
      fix: { text: 'Add descriptive alt text.' },
    },
  ],
};

describe('report exports', () => {
  it('exports a JSON report with score, acuity and findings', () => {
    const data = JSON.parse(exportRunJSON(run));

    expect(data.run.score).toBe(90);
    expect(data.run.acuity).toBe('20/25');
    expect(data.run.issues[0].message).toBe('Image has no alternative text');
  });

  it('exports findings as CSV', () => {
    const csv = exportRunCSV(run);

    expect(csv).toContain('"Finding ID"');
    expect(csv).toContain('"img-alt"');
    expect(csv).toContain('"img.hero"');
    expect(csv).toContain('"Add descriptive alt text."');
  });

  it('escapes commas and quotes in CSV values', () => {
    const specialRun = {
      ...run,
      issues: [
        {
          ...run.issues[0],
          message: 'Missing "alt", please fix',
        },
      ],
    };

    expect(exportRunCSV(specialRun)).toContain(
      '"Missing ""alt"", please fix"',
    );
  });

  it('supports older runs without saved findings', () => {
    const oldRun = { ...run, issues: undefined };

    expect(JSON.parse(exportRunJSON(oldRun)).run.issues).toEqual([]);
    expect(exportRunCSV(oldRun)).toContain('"Eye chart reading"');
  });
});
