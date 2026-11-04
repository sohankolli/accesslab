import { useEffect, useRef } from 'react';

/**
 * A message under the source pane's header.
 *  - info: something worked or a tip ("Opened a shared page."), read out politely;
 *  - error: something was refused or failed, read out at once;
 *  - copy: the clipboard was refused, so the share link is shown to copy by hand.
 * @typedef {(
 *   {tone: 'info' | 'error', body: import('react').ReactNode} |
 *   {tone: 'copy', url: string}
 * )} Notice
 */

/** The share link in a read-only field, selected, for the user to copy. */
function CopyField({ url }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, [url]);
  return (
    <div className="notice notice--info notice--stack">
      <label htmlFor="share-link-field">
        <strong>The browser did not let AccessLab copy the link.</strong> Copy it with Ctrl+C.
      </label>
      <input
        id="share-link-field"
        ref={ref}
        type="text"
        className="notice__field"
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
      />
    </div>
  );
}

/**
 * The polite status region is always in the page, so a message put into it is
 * read out (a polite region added together with its text is often missed).
 * Alerts are read out when they appear, like the size-cap notice.
 * @param {{notice: Notice|null}} props
 */
export default function SourceNotice({ notice }) {
  return (
    <>
      <div role="status" className="src-notice">
        {notice?.tone === 'info' && (
          <div className="notice notice--info">
            <p>{notice.body}</p>
          </div>
        )}
      </div>
      {notice?.tone === 'error' && (
        <div className="notice" role="alert">
          <p>{notice.body}</p>
        </div>
      )}
      {notice?.tone === 'copy' && <CopyField url={notice.url} />}
    </>
  );
}
