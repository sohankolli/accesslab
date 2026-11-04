// The copyable fix for a click-only control. Plain text, so it can be copied as is.

const classOf = (snippet) => /\sclass="([^"]*)"/.exec(snippet)?.[1];

/**
 * @param {{tag: string, snippet: string}} finding
 * @returns {{button: string, keep: string}}  use a <button>; or keep the element and make it work
 */
export function fixSnippets({ tag, snippet }) {
  const cls = classOf(snippet);
  const attr = cls ? ` class="${cls}"` : '';
  return {
    button: `<button type="button"${attr}>…</button>`,
    keep: [
      `<${tag}${attr} role="button" tabindex="0">…</${tag}>`,
      '',
      '// Enter and Space must do what a click does, as on a real button.',
      "el.addEventListener('keydown', (event) => {",
      "  if (event.key === 'Enter' || event.key === ' ') {",
      '    event.preventDefault();',
      '    el.click();',
      '  }',
      '});',
    ].join('\n'),
  };
}
