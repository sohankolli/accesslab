// Opening a file from the user's computer. The file is read in the browser with
// File.text(); nothing is uploaded. Its text then goes into the editor through
// the same actions as typing (htmlChanged / cssChanged), so the same size cap
// applies and the preview renders it with scripts off, like pasted code.
import { MAX_PAGE_BYTES } from './editorSlice';

/** What the file picker offers. */
export const ACCEPT = '.html,.htm,.css';

/** Which tab a file belongs in, from its name, or null for any other type. */
export function langOfFile(name) {
  const ext = /\.([^.]+)$/.exec(name)?.[1]?.toLowerCase();
  if (ext === 'html' || ext === 'htm') return 'html';
  if (ext === 'css') return 'css';
  return null;
}

/**
 * False when the text is clearly not a text file: a NUL character, or the
 * replacement character File.text() puts where bytes are not valid UTF-8
 * (an image renamed to .html, or a file saved in another encoding).
 */
export const looksLikeText = (text) => !text.includes('\0') && !text.includes('�');

/**
 * Read a file the user picked or dropped.
 * @param {File} file
 * @returns {Promise<
 *   {ok: true, lang: 'html'|'css', text: string} |
 *   {ok: false, reason: 'type'} |
 *   {ok: false, reason: 'too-big', lang: 'html'|'css', bytes: number} |
 *   {ok: false, reason: 'not-text'} |
 *   {ok: false, reason: 'read', message: string}
 * >}
 */
export async function readPageFile(file) {
  const lang = langOfFile(file.name);
  if (!lang) return { ok: false, reason: 'type' };
  // Bigger than the whole cap on its own: refused without reading it.
  if (file.size > MAX_PAGE_BYTES) return { ok: false, reason: 'too-big', lang, bytes: file.size };
  let text;
  try {
    text = await file.text();
  } catch (error) {
    return { ok: false, reason: 'read', message: error?.message || String(error) };
  }
  if (!looksLikeText(text)) return { ok: false, reason: 'not-text' };
  return { ok: true, lang, text };
}

/**
 * Stylesheets the page links by a path on its own site (href="style.css" or
 * "/css/site.css"). The preview cannot load them: they live next to the file on
 * the user's computer, not on AccessLab's site. Parsing with DOMParser runs no
 * scripts and loads nothing.
 * @param {string} html
 * @returns {string[]} the hrefs
 */
export function relativeStylesheets(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return [...doc.querySelectorAll('link[href]')]
    .filter((link) => link.relList.contains('stylesheet'))
    .map((link) => link.getAttribute('href').trim())
    .filter((href) => href && !/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(href));
}
