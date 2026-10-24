// features/audit/acuity.js
// The score read as eye-chart acuity: a high score "reads at 20/20", a poor one
// at 20/200. Plain functions, no React, so they are easy to test.

/** [lowest score, acuity] from best to worst. Anything below 30 reads at 20/200. */
const STEPS = [
  [95, '20/20'],
  [85, '20/25'],
  [75, '20/30'],
  [65, '20/40'],
  [55, '20/50'],
  [45, '20/70'],
  [30, '20/100'],
];

/**
 * The Snellen lines from the top (largest letters, 20/200) to the bottom
 * (smallest, 20/20), as drawn in the findings pane.
 */
export const SNELLEN_LINES = [
  { acuity: '20/200', letters: 'E', size: 40 },
  { acuity: '20/100', letters: 'F P', size: 28 },
  { acuity: '20/70', letters: 'T O Z', size: 21 },
  { acuity: '20/50', letters: 'L P E D', size: 16 },
  { acuity: '20/40', letters: 'P E C F D', size: 13 },
  { acuity: '20/30', letters: 'E D F C Z P', size: 11 },
  { acuity: '20/25', letters: 'F E L O P Z D', size: 9 },
  { acuity: '20/20', letters: 'D E F P O T E C', size: 8 },
];

/**
 * @param {number} score 0–100
 * @returns {string} e.g. '20/30'
 */
export function acuityFor(score) {
  return STEPS.find(([min]) => score >= min)?.[1] ?? '20/200';
}

/** Index into SNELLEN_LINES of the line a score reaches. */
export const snellenLineFor = (score) =>
  SNELLEN_LINES.findIndex((line) => line.acuity === acuityFor(score));

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

/** "Four things get in the way." / "One thing gets in the way." / "Nothing gets in the way." */
export function inTheWay(count) {
  if (count === 0) return 'Nothing gets in the way.';
  if (count === 1) return 'One thing gets in the way.';
  return `${WORDS[count] ?? count} things get in the way.`;
}

/** The change since the previous check, in words, so it never relies on colour. */
export function describeDelta(score, previousScore) {
  if (previousScore == null) return 'First check of this page';
  const diff = score - previousScore;
  if (diff === 0) return 'No change since the last check';
  return `${diff > 0 ? 'Up' : 'Down'} ${Math.abs(diff)} since the last check`;
}
