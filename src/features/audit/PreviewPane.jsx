import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { issueSelected, selectSortedIssues, simulationChanged } from './auditSlice';
import { SIMULATIONS } from '../simulate/simulations';
import { issueAt } from './overlayBoxes';
import SandboxFrame from './SandboxFrame';
import IssueOverlay from './IssueOverlay';
import Segmented from '../../components/Segmented';
import './previewPane.css';
import '../simulate/simulate.css';

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
  const simulation = useSelector((state) => state.audit.simulation);

  const handleDocument = useCallback(
    (doc) => {
      docRef.current = doc;
      setPageTitle(doc.title.trim() || 'Untitled page');
      // AccessLab's own listeners (the page's scripts still never run). A click
      // selects the issue under the pointer, and neither links nor forms may
      // navigate the frame away from the page being audited.
      doc.addEventListener(
        'click',
        (event) => {
          event.preventDefault();
          const hit = issueAt(event.target, selectSortedIssues(store.getState()));
          dispatch(issueSelected(hit?.id ?? null));
        },
        true,
      );
      doc.addEventListener('submit', (event) => event.preventDefault(), true);
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
        <label className="simulation-control">
          <span>Vision simulation</span>
          <select
            value={simulation}
            onChange={(event) => dispatch(simulationChanged(event.target.value))}
          >
            {SIMULATIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="preview-stage">
        <div
          className={`sheet sheet--${device}${previewFocused ? ' sheet--focused' : ''} simulation--${simulation}`}
        >
          <SandboxFrame
            html={html}
            css={css}
            simulation={simulation}
            onDocument={handleDocument}
            frameRef={frameRef}
          />
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
