// Which page a saved run belongs to. Plain functions, no React, so they are easy to test.
//
// A page is named by its <title>, otherwise the opened file's name, otherwise
// "Untitled page". The key comes from that name, not from the code, so it stays
// the same while the user edits the page.

/** Runs saved before pages were recorded have no page: they share this group. */
export const EARLIER_KEY = 'earlier';
export const EARLIER_NAME = 'Earlier checks';

const MAX_NAME = 120; // keeps a very long <title> from bloating the saved history

/**
 * @param {{title?: string|null, fileName?: string|null}} from
 * @returns {string} the page's name, tidied: single spaces, at most MAX_NAME characters
 */
export function pageNameFor({ title, fileName }) {
  const tidy = (s) => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
  return tidy(title) || tidy(fileName) || 'Untitled page';
}

/**
 * The key of a page name. Case is ignored, so "Menu" and "menu" are one page.
 * The "page:" prefix means no title can ever collide with EARLIER_KEY.
 */
export const pageKeyFor = (name) => `page:${name.toLowerCase()}`;

/**
 * @param {{title?: string|null, fileName?: string|null}} from
 * @returns {{key: string, name: string}} what is saved with a run
 */
export function pageOf(from) {
  const name = pageNameFor(from);
  return { key: pageKeyFor(name), name };
}

/** @param {{page?: {key: string}}} run */
export const pageKeyOf = (run) => run.page?.key ?? EARLIER_KEY;

/**
 * Runs grouped by page, the page checked most recently first.
 * @template {{page?: {key: string, name: string}}} R
 * @param {R[]} runs newest first, as stored
 * @returns {{key: string, name: string, runs: R[]}[]} each group's runs newest first
 */
export function groupByPage(runs) {
  const groups = new Map();
  for (const run of runs) {
    const key = pageKeyOf(run);
    if (!groups.has(key)) {
      // The newest run names the page (its title may have changed case since).
      groups.set(key, { key, name: run.page?.name ?? EARLIER_NAME, runs: [] });
    }
    groups.get(key).runs.push(run);
  }
  return [...groups.values()];
}

/**
 * The run of the same page saved just before `current`, or undefined.
 * Runs without a page are never "the same page" as anything.
 * @template {{ranAt: number, page?: {key: string}}} R
 * @param {R[]} runs newest first
 * @param {{ranAt: number, page?: {key: string}}} current
 */
export function previousRunOfPage(runs, current) {
  if (!current?.page) return undefined;
  return runs.find((run) => run.ranAt < current.ranAt && run.page?.key === current.page.key);
}
