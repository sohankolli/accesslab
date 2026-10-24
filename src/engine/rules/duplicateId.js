// engine/rules/duplicateId.js
import { issue } from './basicRules.js';

export const duplicateId = {
  id: 'duplicate-id',
  wcag: 'Best practice (ids used by 1.3.1 and 4.1.2)',
  severity: 'moderate',
  check({ doc }) {
    const byId = new Map();
    for (const el of doc.querySelectorAll('[id]')) {
      if (!el.id.trim()) continue;
      byId.set(el.id, [...(byId.get(el.id) ?? []), el]);
    }
    // One issue per repeated value, on its second occurrence: the first one is
    // the element that <label for> and aria-labelledby actually find.
    return [...byId]
      .filter(([, els]) => els.length > 1)
      .map(([id, els]) =>
        issue(
          duplicateId,
          els[1],
          `id "${id}" is used ${els.length} times.`,
          'Give every element a unique id; <label for> and aria-labelledby only find the first one.',
        ),
      );
  },
};
