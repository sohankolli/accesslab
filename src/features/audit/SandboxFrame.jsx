import { useMemo, useRef } from 'react';

/** Wrap the user's HTML and CSS into one document for the iframe's srcdoc. */
export function buildDocument(html, css, simulation = 'none') {
  const zoomStyle =
    simulation === 'zoom-200'
      ? '<style>html { font-size: 200% !important; }</style>'
      : '';

  const style =
    `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>` +
    zoomStyle;

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

/** @param {{html: string, css: string, simulation?: string, onDocument: (doc: Document) => void, frameRef?: {current: HTMLIFrameElement|null}}} props */
export default function SandboxFrame({
  html,
  css,
  simulation = 'none',
  onDocument,
  frameRef: outerRef,
}) {
  const ownRef = useRef(null);
  const frameRef = outerRef ?? ownRef;

  const srcDoc = useMemo(
    () => buildDocument(html, css, simulation),
    [html, css, simulation],
  );

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
