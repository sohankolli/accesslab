// Rules are grouped into packs (WCAG 2.2 A/AA, best practice, India GIGW, ...).
// Adding coverage = adding a pack; the engine and UI never change.
const SEVERITIES = new Set(['critical', 'serious', 'moderate', 'minor']);

/**
 * A registry of rule packs. The app uses the default instance below; tests
 * create their own so they never share state.
 */
export function createRegistry() {
  const packs = new Map();

  function registerPack({ id, title, rules } = {}) {
    if (!id || !title || !Array.isArray(rules)) {
      throw new Error(`Pack "${id ?? '?'}" needs an id, a title and a rules array`);
    }
    if (packs.has(id)) throw new Error(`Pack "${id}" is already registered`);
    const seen = new Set([...packs.values()].flatMap((p) => p.rules.map((r) => r.id)));
    for (const r of rules) {
      if (!r?.id || !r.wcag || !SEVERITIES.has(r.severity) || typeof r.check !== 'function') {
        throw new Error(
          `Rule "${r?.id ?? '?'}" in pack "${id}" is missing id, wcag, severity or check()`,
        );
      }
      if (seen.has(r.id)) throw new Error(`Rule id "${r.id}" is used twice`);
      seen.add(r.id);
    }
    packs.set(id, { id, title, rules });
  }

  /** Rules for the packs the user has switched on, in registration order. */
  const rulesFor = (enabledIds) =>
    [...packs.values()].filter((p) => enabledIds.includes(p.id)).flatMap((p) => p.rules);

  const listPacks = () =>
  [...packs.values()].map(({ id, title, rules }) => ({
    id,
    title,
    count: rules.length,
    ruleIds: rules.map((rule) => rule.id),
  }));

  return { registerPack, rulesFor, listPacks };
}

const registry = createRegistry();
export const { registerPack, rulesFor, listPacks } = registry;
