import { useEffect, useRef, useState } from 'react';
import { useStore } from 'react-redux';
import { useHref } from 'react-router';
import { makeShareLink, MAX_LINK_LENGTH } from './shareLink';

const kb = (bytes) => Math.ceil(bytes / 1024);

/**
 * "Copy share link": packs the editor's code into a link and copies it. A short
 * "Link copied" is announced politely next to the button. Anything that goes
 * wrong is handed to the Workbench as a notice.
 * @param {{onNotice: (notice: import('./SourceNotice').Notice|null) => void}} props
 */
export default function ShareLinkButton({ onNotice }) {
  const store = useStore();
  const workbenchHref = useHref('/audit'); // the Workbench's path, with the app's base path
  const [status, setStatus] = useState('');
  const clearTimer = useRef(0);
  useEffect(() => () => clearTimeout(clearTimer.current), []);

  const share = async () => {
    clearTimeout(clearTimer.current);
    setStatus('');
    onNotice(null);
    const { html, css } = store.getState().editor;
    const base = new URL(workbenchHref, window.location.origin).href;
    let link;
    try {
      link = await makeShareLink({ html, css }, base);
    } catch (error) {
      onNotice({
        tone: 'error',
        body: (
          <>
            <strong>The share link could not be made.</strong> This browser could not compress the
            page ({error?.message || String(error)}). Share the .html file instead.
          </>
        ),
      });
      return;
    }
    if (!link.ok) {
      onNotice({
        tone: 'error',
        body: (
          <>
            <strong>This page is too big for a share link.</strong> It is {kb(link.bytes)} KB, and
            its link would be {link.length.toLocaleString('en')} characters; links over{' '}
            {MAX_LINK_LENGTH.toLocaleString('en')} often get cut off. Share the .html file instead.
          </>
        ),
      });
      return;
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error('The clipboard is not available here.');
      await navigator.clipboard.writeText(link.url);
    } catch {
      // Refused or unavailable: show the link so the user can copy it themselves.
      onNotice({ tone: 'copy', url: link.url });
      return;
    }
    setStatus('Link copied');
    clearTimer.current = setTimeout(() => setStatus(''), 5000);
  };

  return (
    <>
      <button type="button" className="btn btn--sm" onClick={share}>
        Copy share link
      </button>
      <span role="status" className="src-head__status">
        {status}
      </span>
    </>
  );
}
