// engine/rules/index.js
// The rule registry. Adding a rule means adding its file and one entry here.
import { imgAlt, formLabel, htmlLang, pageTitle, headingOrder } from './basicRules.js';

/** @type {import('../types.js').Rule[]} */
export const RULES = [imgAlt, formLabel, htmlLang, pageTitle, headingOrder];

/** Look up a rule's metadata (e.g. its WCAG reference) from an issue's ruleId. */
export const RULE_BY_ID = Object.fromEntries(RULES.map((rule) => [rule.id, rule]));
