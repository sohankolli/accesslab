import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useLocation, useNavigate } from 'react-router';
import { MAX_PAGE_BYTES, sharedPageOpened } from './editorSlice';
import { isBookmarkletPageMessage } from './bookmarklet';

/**
 * Receive a page sent by the AccessLab bookmarklet.
 * @param {(notice: import('./SourceNotice').Notice|null) => void} onNotice
 */
export function useOpenBookmarklet(onNotice) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if (new URLSearchParams(search).get('from') !== 'bookmarklet') {
      return undefined;
    }

    let cleanedUp = false;

    function cleanBookmarkletUrl() {
      if (cleanedUp) return;
      cleanedUp = true;
      navigate({ pathname, search: '', hash }, { replace: true });
    }

    if (!window.opener) {
      cleanBookmarkletUrl();
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
      cleanBookmarkletUrl();

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

      let hostname = 'an unknown site';
      try {
        hostname = new URL(data.url).host || hostname;
      } catch {
        // Keep the fallback when the sender provides an invalid URL.
      }

      const title =
        typeof data.title === 'string' && data.title.trim() ? data.title.trim() : hostname;
      const skipped = Number.isInteger(data.skippedStylesheets) ? data.skippedStylesheets : 0;

      const skippedMessage =
        skipped > 0 ? ` ${skipped} stylesheet(s) were skipped because they could not be read.` : '';

      onNotice({
        tone: 'info',
        body: `Opened ${title} from ${hostname}.${skippedMessage}`,
      });
    }

    window.addEventListener('message', receivePage);

    const timeout = setTimeout(() => {
      if (received) return;

      waitingForPage = false;
      window.removeEventListener('message', receivePage);
      cleanBookmarkletUrl();

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
  }, [search, pathname, hash, navigate, dispatch, onNotice]);
}
