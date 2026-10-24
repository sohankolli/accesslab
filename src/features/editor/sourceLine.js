// features/editor/sourceLine.js
// Find an element's start tag in the HTML source, so selecting an issue can
// highlight its line in the editor. Issues say which element they are about as
// "the nth <tag> in the document" (engine/rules/basicRules.js); this scans the
// source for start tags the way the HTML parser would, and counts.

// Elements whose content is raw text: a "<p>" inside them is not a tag.
// (<noscript> is not here: scripts never run in the preview, so it parses as HTML.)
const RAW_TEXT = new Set([
  'script',
  'style',
  'textarea',
  'title',
  'xmp',
  'iframe',
  'noembed',
  'noframes',
]);

/** The index just past the `>` that ends a tag starting at `from`, skipping quoted values. */
function endOfTag(src, from) {
  let quote = null;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '>') {
      return i + 1;
    }
  }
  return src.length;
}

/**
 * Every start tag in the source, in order: [{ tag, start, end }], where start
 * is the index of `<` and end is just past `>`. Comments, doctypes, end tags
 * and the contents of raw-text elements are skipped.
 * @param {string} src
 */
export function startTags(src) {
  const tags = [];
  let i = 0;
  while ((i = src.indexOf('<', i)) !== -1) {
    if (src.startsWith('<!--', i)) {
      const close = src.indexOf('-->', i + 4);
      i = close === -1 ? src.length : close + 3;
      continue;
    }
    const name = /^<([a-zA-Z][^\s/>]*)/.exec(src.slice(i, i + 64));
    if (!name) {
      // </end>, <!doctype>, <?xml ?> or a stray "<": move past it.
      i = /^<[/!?]/.test(src.slice(i, i + 2)) ? endOfTag(src, i + 1) : i + 1;
      continue;
    }
    const tag = name[1].toLowerCase();
    const end = endOfTag(src, i + name[0].length);
    tags.push({ tag, start: i, end });
    i = end;
    if (RAW_TEXT.has(tag)) {
      const close = src.toLowerCase().indexOf(`</${tag}`, i);
      i = close === -1 ? src.length : close;
    }
  }
  return tags;
}

/** 1-based line and column of a string index. */
export function lineAndColumn(src, index) {
  let line = 1;
  let lineStart = 0;
  for (let i = src.indexOf('\n'); i !== -1 && i < index; i = src.indexOf('\n', i + 1)) {
    line++;
    lineStart = i + 1;
  }
  return { line, column: index - lineStart + 1 };
}

/**
 * Where the nth <tag> starts in the source, or null when the source does not
 * contain it (for example a <body> the parser added on its own).
 * @param {string} src HTML source
 * @param {{tag: string, nth: number}} [ref] from issue.source
 * @returns {{line: number, column: number, start: number, end: number}|null}
 */
export function sourceLineOf(src, ref) {
  if (!ref || ref.nth < 0) return null;
  const match = startTags(src).filter((t) => t.tag === ref.tag)[ref.nth];
  return match ? { ...lineAndColumn(src, match.start), start: match.start, end: match.end } : null;
}
