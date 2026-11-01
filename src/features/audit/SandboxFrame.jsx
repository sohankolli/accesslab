import { useMemo, useRef } from 'react';

/** Wrap the user's HTML and CSS into one document for the iframe's srcdoc. */
export function buildDocument(html, css) {
  const style = `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`;

  if (/<html[\s>]/i.test(html)) {
    // A full page: inject the CSS into its <head>.
    if (/<\/head>/i.test(html)) {
      return html.replace(/<\/head>/i, () => `${style}</head>`);
    }

    return html.replace(/<html(?:\s[^>]*)?>/i, (tag) => `${tag}${style}`);
  }

  // A fragment: mark it so page-level rules are skipped.
  return (
    `<!doctype html><html data-al-fragment><head><meta charset="utf-8">${style}</head>` +
    `<body>${html}</body></html>`
  );
}

/** @param {{html: string, css: string, onDocument: (doc: Document) => void, frameRef?: {current: HTMLIFrameElement|null}}} props */
export default function SandboxFrame({ html, css, onDocument, frameRef: outerRef }) {
  const ownRef = useRef(null);
  const frameRef = outerRef ?? ownRef;
  const srcDoc = useMemo(() => buildDocument(html, css), [html, css]);

  return (
    <iframe
      ref={frameRef}
      title="Page being audited"
      className="sandbox-frame"
      sandbox="allow-same-origin"
      srcDoc={srcDoc}
      onLoad={() => onDocument(frameRef.current.contentDocument)}
    />
  );
}
