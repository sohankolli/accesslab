import { describe, it, expect } from 'vitest';
import {
  exportRunJSON,
  exportRunCSV,
  reportFilename,
} from '../../src/features/report/reportExport';

const run = {
  id: '1000',
  ranAt: new Date(2026, 10, 4, 17, 15).getTime(),
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

    expect(data.run.id).toBe('1000');
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

    expect(exportRunCSV(specialRun)).toContain('"Missing ""alt"", please fix"');
  });

  it('supports older runs without saved findings', () => {
    const oldRun = { ...run, issues: undefined };

    expect(JSON.parse(exportRunJSON(oldRun)).run.issues).toEqual([]);
    expect(exportRunCSV(oldRun)).toContain('"Eye chart reading"');
  });

  it('keeps the ID for saved runs', () => {
    const data = JSON.parse(exportRunJSON(run));

    expect(data.run).toHaveProperty('id', '1000');
  });

  it('omits the ID for live results without an ID', () => {
    const liveRun = { ...run };
    delete liveRun.id;

    const data = JSON.parse(exportRunJSON(liveRun));

    expect(data.run).not.toHaveProperty('id');
  });

  it('uses the run date and time for saved JSON filenames', () => {
    expect(reportFilename(run, 'json')).toBe('accesslab-report-2026-11-04-1715.json');
  });

  it('uses the run date and time for live CSV filenames', () => {
    const liveRun = { ...run };
    delete liveRun.id;

    expect(reportFilename(liveRun, 'csv')).toBe('accesslab-report-2026-11-04-1715.csv');
  });
});
