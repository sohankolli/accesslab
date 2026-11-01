// Registers the built-in rule packs. Adding a rule means adding its file and
// one entry in a pack below; the registry validates it on registration.
import { registerPack, rulesFor, listPacks } from './registry.js';
import { imgAlt, formLabel, htmlLang, pageTitle, headingOrder } from './basicRules.js';
import { colorContrast } from './colorContrast.js';
import { buttonName } from './buttonName.js';
import { linkName } from './linkName.js';
import { tabindexPositive } from './tabindexPositive.js';
import { duplicateId } from './duplicateId.js';
import { landmarkMain } from './landmarkMain.js';

registerPack({
  id: 'wcag-aa',
  title: 'WCAG 2.2 A/AA',
  rules: [imgAlt, formLabel, buttonName, linkName, colorContrast, htmlLang, pageTitle],
});

// tabindex-positive sits here rather than under WCAG: a positive tabindex is
// not a failure by itself, only a strong hint that focus order will be wrong.
registerPack({
  id: 'best-practice',
  title: 'Best practice',
  rules: [headingOrder, tabindexPositive, duplicateId, landmarkMain],
});

export { rulesFor, listPacks };

/** Every registered rule, whatever the user has switched on. */
export const ALL_PACK_IDS = listPacks().map((p) => p.id);

/** @type {import('../types.js').Rule[]} */
export const RULES = rulesFor(ALL_PACK_IDS);

/** Look up a rule's metadata (e.g. its WCAG reference) from an issue's ruleId. */
export const RULE_BY_ID = Object.fromEntries(RULES.map((rule) => [rule.id, rule]));
