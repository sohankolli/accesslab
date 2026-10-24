// engine/rules/index.js
// Registers the built-in rule packs. Adding a rule means adding its file and
// one entry in a pack below; the registry validates it on registration.
import { registerPack, rulesFor, listPacks } from './registry.js';
import { imgAlt, formLabel, htmlLang, pageTitle, headingOrder } from './basicRules.js';
import { colorContrast } from './colorContrast.js';

registerPack({
  id: 'wcag-aa',
  title: 'WCAG 2.2 A/AA',
  rules: [imgAlt, formLabel, colorContrast, htmlLang, pageTitle],
});

registerPack({
  id: 'best-practice',
  title: 'Best practices',
  rules: [headingOrder],
});

export { rulesFor, listPacks };

/** Every registered rule, whatever the user has switched on. */
export const ALL_PACK_IDS = listPacks().map((p) => p.id);

/** @type {import('../types.js').Rule[]} */
export const RULES = rulesFor(ALL_PACK_IDS);

/** Look up a rule's metadata (e.g. its WCAG reference) from an issue's ruleId. */
export const RULE_BY_ID = Object.fromEntries(RULES.map((rule) => [rule.id, rule]));
