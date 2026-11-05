import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useLocation } from 'react-router';
import { MAX_PAGE_BYTES, sharedPageOpened } from './editorSlice';
import { isBookmarkletPageMessage } from './bookmarklet';

/**
 * Receive a page sent by the AccessLab bookmarklet.
 * @param {(notice: import('./SourceNotice').Notice|null) => void} onNotice
 */
export function useOpenBookmarklet(onNotice) {
  const dispatch = useDispatch();
  const { search } = useLocation();

  useEffect(() => {
    if (new URLSearchParams(search).get('from') !== 'bookmarklet') {
      return undefined;
    }

    if (!window.opener) {
      onNotice({
        tone: 'error',
        body: 'No page was received. Open the page you want to check and click the bookmarklet again.',
      });
      return undefined;
    }

    const opener = window.opener;
    let received = false;
    let waitingForPage = false;

    function receivePage(event) {
      if (!isBookmarkletPageMessage(event, opener, waitingForPage) || received) {
        return;
      }

      received = true;
      waitingForPage = false;
      clearTimeout(timeout);
      window.removeEventListener('message', receivePage);

      const data = event.data;
      const bytes = new TextEncoder().encode(data.html + data.css).length;

      if (bytes > MAX_PAGE_BYTES) {
        onNotice({
          tone: 'error',
          body: `This page is ${Math.ceil(bytes / 1024)} KB, and AccessLab checks pages up to ${MAX_PAGE_BYTES / 1024} KB, so your existing code was left as it was.`,
        });
        return;
      }

      dispatch(sharedPageOpened({ html: data.html, css: data.css }));

      const skipped = Number.isInteger(data.skippedStylesheets) ? data.skippedStylesheets : 0;

      if (skipped > 0) {
        onNotice({
          tone: 'info',
          body: `${skipped} stylesheet(s) from other sites could not be read.`,
        });
      }
    }

    window.addEventListener('message', receivePage);

    const timeout = setTimeout(() => {
      if (received) return;

      waitingForPage = false;
      window.removeEventListener('message', receivePage);

      onNotice({
        tone: 'error',
        body: 'No page was received. Open the page you want to check and click the bookmarklet again.',
      });
    }, 5000);

    waitingForPage = true;
    opener.postMessage({ type: 'accesslab:ready' }, '*');

    return () => {
      clearTimeout(timeout);
      waitingForPage = false;
      window.removeEventListener('message', receivePage);
    };
  }, [search, dispatch, onNotice]);
}
