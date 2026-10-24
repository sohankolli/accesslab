import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { computeScore, runAudit } from '../../src/engine/runAudit';
import { RULES } from '../../src/engine/rules';

const result = (severity, n) => ({
  rule: { severity },
  issues: Array.from({ length: n }, () => ({})),
});

describe('computeScore', () => {
  it('reproduces the worked example in Table 8 (score 81)', () => {
    const results = [
      result('critical', 1), // img-alt
      result('serious', 2), // color-contrast
      result('moderate', 3), // heading-order
      // the other eight core rules, no issues: 2 critical, 3 serious, 2 moderate, 1 minor
      result('critical', 0),
      result('critical', 0),
      result('serious', 0),
      result('serious', 0),
      result('serious', 0),
      result('moderate', 0),
      result('moderate', 0),
      result('minor', 0),
    ];
    expect(computeScore(results)).toBe(81);
  });

  it('is 100 with no issues and never reaches 0 from one noisy rule', () => {
    expect(computeScore([result('critical', 0)])).toBe(100);
    expect(computeScore([result('critical', 50), result('minor', 0)])).toBeGreaterThan(0);
  });

  it('does not penalise needsReview items', () => {
    const r = { rule: { severity: 'serious' }, issues: [{ needsReview: true }] };
    expect(computeScore([r])).toBe(100);
  });
});

describe('runAudit', () => {
  it('isolates a crashing rule and still runs the others', () => {
    const doc = new JSDOM('<img src="a.png">').window.document;
    const broken = {
      id: 'broken',
      severity: 'minor',
      check() {
        throw new Error('boom');
      },
    };
    const audit = runAudit(doc, [broken, ...RULES]);
    expect(audit.errors).toEqual([{ ruleId: 'broken', error: 'boom' }]);
    expect(audit.issues.map((i) => i.ruleId)).toContain('img-alt');
    expect(Object.keys(audit.timings)).toEqual(['broken', ...RULES.map((r) => r.id)]);
  });

  it('returns plain, serialisable data', () => {
    const doc = new JSDOM('<img src="a.png"><h1>A</h1><h3>B</h3>').window.document;
    const audit = runAudit(doc, RULES);
    expect(JSON.parse(JSON.stringify(audit))).toEqual(audit);
  });
});
