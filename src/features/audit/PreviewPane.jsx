import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useStore } from 'react-redux';
import { issueSelected } from './auditSlice';
import { selectMarkedFindings } from './clickablesSlice';
import { issueAt } from './overlayBoxes';
import { guardPreview } from './previewGuard';
import SandboxFrame from './SandboxFrame';
import IssueOverlay from './IssueOverlay';
import Segmented from '../../components/Segmented';
import './previewPane.css';

const DEVICES = [
  { value: 'mobile', label: 'Phone' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'desktop', label: 'Desktop' },
];

/**
 * The preview pane: the audited page in the sandboxed iframe, at a chosen
 * width, with inspection marks over it. Clicking a marked element selects its
 * issue.
 * @param {{
 *   html: string, css: string,  the code to show (debounced)
 *   frameRef: {current: HTMLIFrameElement|null},
 *   docRef: {current: Document|null},  set to the preview's live document
 *   onDocument: (doc: Document) => void,  called when a new document has loaded
 * }} props
 */
export default function PreviewPane({ html, css, frameRef, docRef, onDocument }) {
  const dispatch = useDispatch();
  const store = useStore();
  const [pageTitle, setPageTitle] = useState('Preview');
  const [previewFocused, setPreviewFocused] = useState(false);
  const [frameSize, setFrameSize] = useState(null);
  const [device, setDevice] = useState('desktop');

  const handleDocument = useCallback(
    (doc) => {
      docRef.current = doc;
      setPageTitle(doc.title.trim() || 'Untitled page');
      // Links and forms may not navigate away; a click selects the issue under the pointer.
      guardPreview(doc, (event) => {
        const hit = issueAt(event.target, selectMarkedFindings(store.getState()));
        dispatch(issueSelected(hit?.id ?? null));
      });
      // Show a focus ring on the device frame while keyboard focus is inside the preview.
      doc.defaultView.addEventListener('focus', () => setPreviewFocused(true));
      doc.defaultView.addEventListener('blur', () => setPreviewFocused(false));
      onDocument(doc);
    },
    [docRef, onDocument, dispatch, store],
  );

  // The preview's size in CSS pixels, shown under it.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const observer = new ResizeObserver(() =>
      setFrameSize({ width: frame.clientWidth, height: frame.clientHeight }),
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, [frameRef]);

  return (
    <section id="pane-preview" className="pane pane--preview" aria-labelledby="preview-heading">
      <div className="lb-head">
        <h2 id="preview-heading" className="lb-head__title">
          {pageTitle} <span>as rendered, scripts off</span>
        </h2>
        <Segmented
          legend="Preview width"
          name="device"
          value={device}
          onChange={setDevice}
          options={DEVICES}
        />
      </div>
      <div className="preview-stage">
        <div className={`sheet sheet--${device}${previewFocused ? ' sheet--focused' : ''}`}>
          <SandboxFrame html={html} css={css} onDocument={handleDocument} frameRef={frameRef} />
        </div>
        <IssueOverlay frameRef={frameRef} />
      </div>
      <div className="lb-foot">
        <span>Click a marked element to open its finding</span>
        {frameSize && (
          <span>
            {frameSize.width} × {frameSize.height} <span className="sr-only">pixels</span>
          </span>
        )}
      </div>
    </section>
  );
}
