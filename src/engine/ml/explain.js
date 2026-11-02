// "Why we think so": which cues made the model flag an element.
//
// For each flagged element, the row is scored again with one group of cues
// removed (set to zero) at a time. The groups whose removal lowers the
// probability most are the ones that mattered. This is occlusion, a simple and
// honest method: it reports what the model actually responds to, not a story.
import { classWords } from './graph.js';
import { NODE_DIM, OFFSETS, TAGS, ROW_DIM, DENSE } from './nodeFeatures.js';

const dense = (name) => OFFSETS.dense + DENSE.indexOf(name);
const range = (start, end) => Array.from({ length: end - start }, (_, i) => start + i);
const view = (v, cols) => cols.map((c) => v * NODE_DIM + c);

const short = (el) => {
  const words = classWords(el).slice(0, 2).join(' ');
  return `<${el.localName}${words ? ` class="${words}"` : ''}>`;
};

/**
 * Cue groups: the row columns each one covers, and how to say it for an element.
 * Views: 0 self, 1 parent, 2 children, 3 siblings, 4 grandparent, 5 grandchildren.
 */
export const CUE_GROUPS = [
  { id: 'pointer', columns: [dense('pointer cursor')], say: () => 'pointer cursor' },
  {
    id: 'onattr',
    columns: [dense('inline on… attribute')],
    say: () => 'an inline on… event attribute',
  },
  {
    id: 'words',
    columns: range(OFFSETS.words, NODE_DIM),
    say: (el) => {
      const words = classWords(el).slice(0, 3);
      return words.length ? `class or id contains "${words.join(' ')}"` : 'its class and id words';
    },
  },
  {
    id: 'tag',
    columns: range(OFFSETS.tag, OFFSETS.tag + TAGS.length),
    say: (el) => `it is a <${el.localName}>, not a control`,
  },
  {
    id: 'look',
    columns: [dense('background colour'), dense('rounded corners')],
    say: () => 'it has a background or rounded corners, like a button',
  },
  { id: 'icon', columns: [dense('icon inside')], say: () => 'an icon inside' },
  {
    id: 'size',
    columns: [dense('text length'), dense('area'), dense('child count')],
    say: () => 'short label and small size',
  },
  { id: 'tabindex', columns: [dense('tabindex')], say: () => 'it has a tabindex' },
  { id: 'select', columns: [dense('user-select: none')], say: () => 'user-select: none' },
  {
    id: 'parent',
    columns: [...view(1, range(0, NODE_DIM)), ...view(4, range(0, NODE_DIM))],
    say: (el) =>
      el.parentElement && el.parentElement.localName !== 'body'
        ? `sits inside ${short(el.parentElement)}`
        : 'where it sits on the page',
  },
  {
    id: 'siblings',
    columns: view(3, range(0, NODE_DIM)),
    say: () => 'its neighbours look like a menu or a set of options',
  },
  {
    id: 'children',
    columns: [...view(2, range(0, NODE_DIM)), ...view(5, range(0, NODE_DIM))],
    say: () => 'what is inside it',
  },
];

/**
 * Rows to score for explaining one element: the same row once per cue group,
 * with that group's columns set to zero (only for the element's own view,
 * unless the group is a neighbourhood view).
 * @param {Float32Array} row  ROW_DIM values
 * @returns {Float32Array} CUE_GROUPS.length × ROW_DIM values
 */
export function occludedRows(row) {
  const out = new Float32Array(CUE_GROUPS.length * ROW_DIM);
  CUE_GROUPS.forEach((group, g) => {
    const base = g * ROW_DIM;
    out.set(row, base);
    for (const c of group.columns) out[base + c] = 0;
  });
  return out;
}

/**
 * The cues that mattered most, in plain words.
 * @param {Element} el
 * @param {number} p  the element's probability
 * @param {ArrayLike<number>} occluded  probabilities for occludedRows(row), in group order
 * @param {number} [top]
 * @returns {{id: string, text: string, drop: number}[]}  only cues whose removal lowers p
 */
export function topCues(el, p, occluded, top = 3) {
  return CUE_GROUPS.map((group, g) => ({ id: group.id, drop: p - occluded[g], group }))
    .filter((c) => c.drop > 0.01)
    .sort((a, b) => b.drop - a.drop)
    .slice(0, top)
    .map(({ id, drop, group }) => ({ id, text: group.say(el), drop }));
}
