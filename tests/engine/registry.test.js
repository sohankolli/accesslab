import { describe, it, expect } from 'vitest';
import { createRegistry } from '../../src/engine/rules/registry';
import { listPacks, rulesFor, RULES } from '../../src/engine/rules';

const rule = (id, extra = {}) => ({
  id,
  wcag: '1.1.1',
  severity: 'minor',
  check: () => [],
  ...extra,
});

describe('rule registry', () => {
  it('lists packs with rule counts and returns rules for enabled packs in registration order', () => {
    const reg = createRegistry();
    reg.registerPack({ id: 'a', title: 'Pack A', rules: [rule('a1'), rule('a2')] });
    reg.registerPack({ id: 'b', title: 'Pack B', rules: [rule('b1')] });
    expect(reg.listPacks()).toEqual([
      { id: 'a', title: 'Pack A', count: 2 },
      { id: 'b', title: 'Pack B', count: 1 },
    ]);
    expect(reg.rulesFor(['b', 'a']).map((r) => r.id)).toEqual(['a1', 'a2', 'b1']);
    expect(reg.rulesFor(['b']).map((r) => r.id)).toEqual(['b1']);
    expect(reg.rulesFor([])).toEqual([]);
  });

  it('rejects a duplicate pack id', () => {
    const reg = createRegistry();
    reg.registerPack({ id: 'a', title: 'A', rules: [] });
    expect(() => reg.registerPack({ id: 'a', title: 'A again', rules: [] })).toThrow(
      'Pack "a" is already registered',
    );
  });

  it('rejects a rule id used twice, in one pack or across packs', () => {
    const reg = createRegistry();
    expect(() => reg.registerPack({ id: 'a', title: 'A', rules: [rule('x'), rule('x')] })).toThrow(
      'Rule id "x" is used twice',
    );
    reg.registerPack({ id: 'b', title: 'B', rules: [rule('y')] });
    expect(() => reg.registerPack({ id: 'c', title: 'C', rules: [rule('y')] })).toThrow(
      'Rule id "y" is used twice',
    );
  });

  it.each([
    ['no id', rule(undefined)],
    ['no wcag reference', rule('r', { wcag: '' })],
    ['an unknown severity', rule('r', { severity: 'urgent' })],
    ['no check() function', rule('r', { check: 'nope' })],
    ['not an object', null],
  ])('rejects a malformed rule with %s', (_, bad) => {
    const reg = createRegistry();
    expect(() => reg.registerPack({ id: 'p', title: 'P', rules: [bad] })).toThrow(
      /missing id, wcag, severity or check\(\)/,
    );
    expect(reg.listPacks()).toEqual([]); // nothing half-registered
  });

  it('rejects a malformed pack', () => {
    const reg = createRegistry();
    expect(() => reg.registerPack({ id: 'p', rules: [] })).toThrow(/needs an id, a title/);
    expect(() => reg.registerPack({ id: 'p', title: 'P' })).toThrow(/rules array/);
  });
});

describe('built-in packs', () => {
  it('registers WCAG 2.2 A/AA and best-practice packs covering all eleven rules', () => {
    expect(listPacks()).toEqual([
      { id: 'wcag-aa', title: 'WCAG 2.2 A/AA', count: 7 },
      { id: 'best-practice', title: 'Best practices', count: 4 },
    ]);
    expect(rulesFor(['best-practice']).map((r) => r.id)).toEqual([
      'heading-order',
      'tabindex-positive',
      'duplicate-id',
      'landmark-main',
    ]);
    expect(RULES).toHaveLength(11);
  });
});
