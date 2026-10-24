import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { runRulesSliced } from '../../src/engine/scheduler';
import { runAudit, toAuditResult } from '../../src/engine/runAudit';
import { RULES } from '../../src/engine/rules';
import { SAMPLE_HTML, SAMPLE_CSS } from '../../src/features/editor/samplePage';
import { buildDocument } from '../../src/features/audit/SandboxFrame';

const doc = () => new JSDOM('<p>Hi</p>').window.document;
const rule = (id, check = () => []) => ({ id, wcag: 'x', severity: 'minor', check });

describe('runRulesSliced', () => {
  it('yields to the browser whenever a slice exceeds its budget', async () => {
    const yieldFn = vi.fn(() => Promise.resolve());
    const rules = [rule('a'), rule('b'), rule('c')];
    // A budget below zero is always exceeded: one yield after every rule.
    await runRulesSliced(doc(), rules, { budgetMs: -1, yieldFn });
    expect(yieldFn).toHaveBeenCalledTimes(3);
  });

  it('does not yield while under budget', async () => {
    const yieldFn = vi.fn(() => Promise.resolve());
    await runRulesSliced(doc(), [rule('a'), rule('b')], { budgetMs: 10_000, yieldFn });
    expect(yieldFn).not.toHaveBeenCalled();
  });

  it('rejects with an AbortError and runs nothing if already aborted', async () => {
    const check = vi.fn(() => []);
    const controller = new AbortController();
    controller.abort();
    await expect(
      runRulesSliced(doc(), [rule('a', check)], { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(check).not.toHaveBeenCalled();
  });

  it('stops at the next rule when aborted during a yield', async () => {
    const controller = new AbortController();
    const second = vi.fn(() => []);
    const yieldFn = () => {
      controller.abort(); // a newer audit started while we were yielding
      return Promise.resolve();
    };
    await expect(
      runRulesSliced(doc(), [rule('a'), rule('b', second)], {
        budgetMs: -1,
        yieldFn,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(second).not.toHaveBeenCalled();
  });

  it('isolates a crashing rule', async () => {
    const results = await runRulesSliced(doc(), [
      rule('broken', () => {
        throw new Error('boom');
      }),
      rule('fine'),
    ]);
    expect(results.map((r) => [r.rule.id, r.error])).toEqual([
      ['broken', 'boom'],
      ['fine', undefined],
    ]);
  });

  it('gives the same result as the synchronous runAudit', async () => {
    const page = new JSDOM(buildDocument(SAMPLE_HTML, SAMPLE_CSS)).window.document;
    const sliced = toAuditResult(await runRulesSliced(page, RULES, { budgetMs: -1 }));
    const sync = runAudit(page, RULES);
    expect(sliced.score).toBe(sync.score);
    expect(sliced.issues).toEqual(sync.issues);
    expect(Object.keys(sliced.timings)).toEqual(Object.keys(sync.timings));
  });
});
