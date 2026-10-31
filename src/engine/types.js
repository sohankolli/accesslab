// Shared JSDoc types. Editors such as VS Code check them without a TypeScript build step.

/**
 * @typedef {'critical'|'serious'|'moderate'|'minor'} Severity
 *
 * @typedef {Object} Rule
 * @property {string}   id          e.g. 'img-alt'
 * @property {string}   wcag        e.g. '1.1.1 Non-text Content'
 * @property {Severity} severity
 * @property {(ctx: {doc: Document, win: Window}) => Issue[]} check
 *
 * @typedef {Object} Fix
 * @property {string}  text         short advice; `backticks` mark code
 * @property {string} [css]         optional CSS rule the user can apply in one click
 * @property {string} [color]       the suggested colour, when css changes a colour
 *
 * @typedef {Object} ContrastData
 * @property {string} fg            measured text colour (hex)
 * @property {string} bg            measured background colour (hex)
 * @property {number} ratio         measured ratio, two decimals
 * @property {number} needed        4.5 or 3
 *
 * @typedef {Object} Issue
 * @property {string}   id          ruleId + ':' + selector (stable across re-audits)
 * @property {string}   ruleId
 * @property {Severity} severity
 * @property {string}   selector    unique CSS path to the element
 * @property {string}   snippet     first 120 characters of outerHTML
 * @property {string}   message     plain title, e.g. 'The image has no text alternative'
 * @property {string}   impact      who it affects, in one sentence
 * @property {Fix}      fix
 * @property {{tag: string, nth: number}} source  the element is the nth <tag> in the document
 * @property {ContrastData} [contrast]  colour-contrast issues only
 * @property {boolean} [needsReview] true when a human must check (not scored)
 *
 * @typedef {Object} AuditResult
 * @property {number}  ranAt        epoch milliseconds
 * @property {number}  score        0–100
 * @property {Issue[]} issues
 * @property {Object<string, number>} timings   rule id → milliseconds
 * @property {{ruleId: string, error: string}[]} errors
 */

// Types only: this export makes the file a module so other files can import the types.
export {};
