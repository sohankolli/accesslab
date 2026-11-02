import { useEffect } from 'react';
import { useDispatch, useStore } from 'react-redux';
import { useLocation, useNavigate } from 'react-router';
import { MAX_PAGE_BYTES, sharedPageOpened } from './editorSlice';
import { decodeShare, shareDataFromHash } from './shareLink';

/**
 * Open a share link: when the address is /audit#s=<data>, unpack the code into
 * the editor, then take the fragment out of the address so it reads /audit.
 * A link that cannot be opened is reported; it never throws.
 * @param {(notice: import('./SourceNotice').Notice|null) => void} onNotice
 */
export function useOpenSharedLink(onNotice) {
  const dispatch = useDispatch();
  const store = useStore();
  const navigate = useNavigate();
  const { pathname, search, hash } = useLocation();
  const data = shareDataFromHash(hash);

  useEffect(() => {
    if (data === null) return undefined;
    let cancelled = false; // a newer link, or leaving the page, wins
    decodeShare(data).then((result) => {
      if (cancelled) return;
      // A replace navigation is history.replaceState: no new history entry, so
      // Back does not reopen the link, and the address no longer holds the code.
      navigate({ pathname, search, hash: '' }, { replace: true });
      if (result.ok) {
        dispatch(sharedPageOpened({ html: result.html, css: result.css }));
        onNotice({ tone: 'info', body: 'Opened a shared page.' });
        return;
      }
      // A fresh tab still shows the sample. If the user had code open, it is kept.
      const shown =
        store.getState().editor.source === 'sample'
          ? 'so the sample page is shown'
          : 'so your code was left as it was';
      const body =
        result.reason === 'too-big'
          ? `This shared page is ${Math.ceil(result.bytes / 1024)} KB, and AccessLab checks pages up to ${MAX_PAGE_BYTES / 1024} KB, ${shown}.`
          : `This share link is damaged or incomplete, ${shown}.`;
      onNotice({ tone: 'error', body });
    });
    return () => {
      cancelled = true;
    };
  }, [data, pathname, search, navigate, dispatch, store, onNotice]);
}
