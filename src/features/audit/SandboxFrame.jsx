// features/audit/SandboxFrame.jsx
import { useMemo, useRef } from 'react';

/** Wrap the user's HTML and CSS into one document for the iframe's srcdoc. */
export function buildDocument(html, css) {
  const style = `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`;
  if (/<html[\s>]/i.test(html)) {
    // A full page: inject the CSS into its <head>. A function replacement
    // avoids special "$&" patterns in user CSS being interpreted.
    if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, () => `${style}</head>`);
    // No </head>: put the style straight after the opening <html> tag, where the
    // parser opens an implied <head>. Prepending it to the whole page would put
    // it before any <!doctype> and switch the page into quirks mode.
    return html.replace(/<html(?:\s[^>]*)?>/i, (tag) => `${tag}${style}`);
  }
  // A fragment: mark it so page-level rules (lang, title) are skipped.
  return (
    `<!doctype html><html data-al-fragment><head><meta charset="utf-8">${style}</head>` +
    `<body>${html}</body></html>`
  );
}

/** @param {{html: string, css: string, onDocument: (doc: Document) => void, frameRef?: {current: HTMLIFrameElement|null}}} props */
export default function SandboxFrame({ html, css, onDocument, frameRef: outerRef }) {
  const ownRef = useRef(null);
  const frameRef = outerRef ?? ownRef; // the workbench passes its own ref so the overlay can measure the frame
  const srcDoc = useMemo(() => buildDocument(html, css), [html, css]);

  return (
    <iframe
      ref={frameRef}
      title="Page being audited"
      className="sandbox-frame"
      /* allow-same-origin lets AccessLab read the DOM; leaving out
         allow-scripts means the page's own JavaScript never runs.
         Never combine the two flags. */
      sandbox="allow-same-origin"
      srcDoc={srcDoc}
      onLoad={() => onDocument(frameRef.current.contentDocument)}
    />
  );
}
