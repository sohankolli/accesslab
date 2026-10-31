// A stable, unique selector for an element, e.g. "body > main:nth-of-type(1) > img:nth-of-type(2)".
export function cssPath(el) {
  const doc = el.ownerDocument;
  // defaultView is null for documents created without a window
  // (e.g. DOMParser), so guard it as well as CSS.escape.
  const esc = doc.defaultView?.CSS?.escape ?? ((s) => s);
  if (el.id && [...doc.querySelectorAll('[id]')].filter((n) => n.id === el.id).length === 1) {
    return `#${esc(el.id)}`;
  }
  const parts = [];
  for (
    let node = el;
    node && node.nodeType === 1 && node.tagName !== 'HTML';
    node = node.parentElement
  ) {
    const tag = node.tagName.toLowerCase();
    if (tag === 'body') {
      parts.unshift('body');
      break;
    }
    const sameTag = [...node.parentElement.children].filter((c) => c.tagName === node.tagName);
    parts.unshift(sameTag.length > 1 ? `${tag}:nth-of-type(${sameTag.indexOf(node) + 1})` : tag);
  }
  return parts.join(' > ') || 'html';
}
