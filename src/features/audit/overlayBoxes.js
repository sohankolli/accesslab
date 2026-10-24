// features/audit/overlayBoxes.js

/**
 * Issues about the whole page (<html>, or <head> content such as <title>) have
 * no box of their own to highlight; the list marks them "Whole page" instead.
 */
export const isPageLevel = (issue) =>
  issue.selector === 'html' || issue.selector.startsWith('head');

/** The element an issue points at, or null (deleted by an edit, or a bad selector). */
export function findElement(doc, selector) {
  try {
    return doc.querySelector(selector);
  } catch {
    return null;
  }
}

/**
 * Rectangles for marking issues on top of the iframe. Pass the issues in list
 * order: each box carries its issue's list number, for the pin on the preview.
 */
export function overlayBoxes(doc, issues) {
  return issues.flatMap((issue, index) => {
    if (isPageLevel(issue)) return [];
    const el = findElement(doc, issue.selector);
    if (!el || el.getClientRects().length === 0) return []; // gone, or not rendered
    const r = el.getBoundingClientRect(); // relative to the iframe's viewport
    return [
      {
        id: issue.id,
        number: index + 1,
        severity: issue.severity,
        review: Boolean(issue.needsReview),
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
      },
    ];
  });
}

/**
 * The issue for a clicked element: walk up from the click target and take the
 * first element that has an issue (issues are sorted, so the most severe wins).
 */
export function issueAt(target, issues) {
  for (
    let node = target;
    node && node.nodeType === 1 && node.tagName !== 'HTML';
    node = node.parentElement
  ) {
    const hit = issues.find((issue) => {
      if (isPageLevel(issue)) return false;
      try {
        return node.matches(issue.selector);
      } catch {
        return false;
      }
    });
    if (hit) return hit;
  }
  return null;
}
