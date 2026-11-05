/**
 * Build the bookmarklet users can drag to their bookmarks bar.
 * @param {string} appOrigin The AccessLab website origin.
 */
export function makeBookmarkletUrl(appOrigin) {
  const origin = new URL(appOrigin).origin;

  const code = `(() => {
    const accessLabOrigin = ${JSON.stringify(origin)};
    let sent = false;

    function receiveReady(event) {
      if (
        event.source !== workbench ||
        event.origin !== accessLabOrigin ||
        event.data?.type !== 'accesslab:ready' ||
        sent
      ) {
        return;
      }

      sent = true;
      window.removeEventListener('message', receiveReady);

      let css = '';
      let skippedStylesheets = 0;

      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            css += rule.cssText + '\\n';
          }
        } catch {
          skippedStylesheets += 1;
        }
      }

      workbench.postMessage(
        {
          type: 'accesslab:page',
          html: document.documentElement.outerHTML,
          css,
          url: location.href,
          title: document.title,
          skippedStylesheets,
        },
        accessLabOrigin
      );
    }

    const workbenchUrl = new URL('/audit?from=bookmarklet', accessLabOrigin).href;

    window.addEventListener('message', receiveReady);

    const workbench = window.open(workbenchUrl, '_blank');

    if (!workbench) {
      window.removeEventListener('message', receiveReady);
      window.alert('AccessLab could not open. Please allow pop-ups and try again.');
      return;
    }

    setTimeout(() => {
      window.removeEventListener('message', receiveReady);
    }, 10000);
  })();`;

  return `javascript:${code}`;
}

/**
 * Check whether a message is a valid page payload from the expected opener.
 * @param {MessageEvent} event
 * @param {Window} opener
 * @param {boolean} waitingForPage
 */
export function isBookmarkletPageMessage(event, opener, waitingForPage) {
  return Boolean(
    waitingForPage &&
    event.source === opener &&
    event.data?.type === 'accesslab:page' &&
    typeof event.data.html === 'string' &&
    typeof event.data.css === 'string',
  );
}
