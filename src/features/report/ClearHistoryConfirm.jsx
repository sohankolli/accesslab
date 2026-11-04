import { useEffect, useRef } from 'react';

const plural = (n, word) => `${n} ${n === 1 ? word : `${word}s`}`;

/**
 * Asks, inside the page (not window.confirm), whether to clear this page's runs
 * or every page's. Focus moves to the question when it opens, so a screen reader
 * reads it first and a held Enter cannot press a clear button by accident.
 * Esc or Cancel closes it; the Report then returns focus to "Clear history".
 * @param {{
 *   id: string,  the panel's id, for the button's aria-controls
 *   pageName: string, pageRuns: number, allRuns: number,
 *   onClearPage: () => void, onClearAll: () => void, onCancel: () => void,
 * }} props
 */
export default function ClearHistoryConfirm({
  id,
  pageName,
  pageRuns,
  allRuns,
  onClearPage,
  onClearAll,
  onCancel,
}) {
  const panelRef = useRef(null);
  // The latest onCancel, so the listener below is added once, on open.
  const cancelRef = useRef(onCancel);
  useEffect(() => {
    cancelRef.current = onCancel;
  });

  useEffect(() => {
    const panel = panelRef.current;
    panel.focus();
    // Esc anywhere in the panel cancels.
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      cancelRef.current();
    };
    panel.addEventListener('keydown', onKeyDown);
    return () => panel.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div
      id={id}
      ref={panelRef}
      className="clear-confirm"
      role="group"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-text`}
      tabIndex={-1}
    >
      <h2 id={`${id}-title`} className="clear-confirm__title">
        Clear history?
      </h2>
      <p id={`${id}-text`}>
        Clear the {plural(pageRuns, 'run')} of {pageName}, or all {plural(allRuns, 'run')} of every
        page? This cannot be undone.
      </p>
      <div className="clear-confirm__actions">
        <button type="button" className="btn" onClick={onClearPage}>
          Clear this page
        </button>
        <button type="button" className="btn" onClick={onClearAll}>
          Clear all pages
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
