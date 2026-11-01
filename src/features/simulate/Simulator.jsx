import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import { buildDocument } from '../audit/SandboxFrame';
import { simulationChanged } from '../audit/auditSlice';
import IssueOverlay from '../audit/IssueOverlay';
import { guardPreview } from '../audit/previewGuard';
import { linearize } from '../../engine/dom/linearize';
import { focusOrder } from '../../engine/dom/focusOrder';
import { accessibleName } from '../../engine/dom/accessibleName';
import { roleOf } from '../../engine/dom/roles';
import { applySimulation } from '../../engine/simulate/filters';
import { SIMULATIONS } from './simulations';
import './simulate.css';

/**
 * The page's keyboard stops, in tab order, as plain data for the list.
 * @param {Document} doc
 */
function tabStops(doc) {
  return focusOrder(doc).map((element, index) => ({
    order: index + 1,
    role: roleOf(element) || element.tagName.toLowerCase(),
    name: accessibleName(element) || '(no name)',
    state: [
      element.getAttribute('aria-expanded') === 'true' ? 'expanded' : '',
      element.getAttribute('aria-checked') !== null
        ? `checked: ${element.getAttribute('aria-checked')}`
        : '',
    ]
      .filter(Boolean)
      .join(', '),
  }));
}

/**
 * The Simulate page: the workbench's current page in a separate preview frame,
 * seen through a lens, with keyboard and screen-reader views of it.
 */
export default function Simulator() {
  const dispatch = useDispatch();
  const html = useSelector((state) => state.editor.html);
  const css = useSelector((state) => state.editor.css);
  const simulation = useSelector((state) => state.audit.simulation);

  const frameRef = useRef(null);
  const [activeView, setActiveView] = useState('preview');
  const [lines, setLines] = useState([]); // the screen-reader view, in page order
  const [stops, setStops] = useState([]); // the keyboard tab order
  const [previewReady, setPreviewReady] = useState(false);
  const [loads, setLoads] = useState(0); // counts loaded documents, so the marks re-measure

  // The page itself, without any lens: lenses are applied to the loaded copy below.
  const srcDoc = useMemo(() => buildDocument(html, css), [html, css]);

  const handlePreviewLoad = useCallback(() => {
    const document = frameRef.current?.contentDocument;

    if (!document?.body) {
      setLines([]);
      setStops([]);
      setPreviewReady(false);
      return;
    }

    guardPreview(document); // links and forms may not navigate the preview away

    setLines(linearize(document));
    setStops(tabStops(document));
    setPreviewReady(true);
    setLoads((n) => n + 1);
  }, []);

  // Switching lens restyles the loaded copy in place: no reload, no audit.
  // This copy is never audited, so the lens cannot change the score or history.
  useEffect(() => {
    const document = frameRef.current?.contentDocument;
    if (previewReady && document?.body) applySimulation(document, simulation);
  }, [simulation, previewReady, loads]);

  return (
    <div className="page simulate-page">
      <title>Simulate – AccessLab</title>

      <header className="page__header">
        <div>
          <h1 className="page__title">Simulate</h1>
          <p className="page__lead">
            Explore visual, keyboard and screen-reader accessibility using your current workbench
            page.
          </p>
        </div>

        <Link to="/audit" className="btn">
          Back to workbench
        </Link>
      </header>

      <section className="card simulate-controls" aria-labelledby="simulation-heading">
        <h2 id="simulation-heading">Simulation settings</h2>

        <label className="field">
          <span className="field__label">Visual simulation</span>
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

        <p className="simulate-note">
          Visual simulations are illustrative approximations. They do not reproduce every person's
          experience or replace testing with users.
        </p>
      </section>

      <div className="simulate-tabs" role="group" aria-label="Simulation view">
        {[
          ['preview', 'Visual preview'],
          ['tab-order', 'Keyboard tab order'],
          ['screen-reader', 'Screen-reader view'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`btn${activeView === value ? ' btn--primary' : ''}`}
            aria-pressed={activeView === value}
            onClick={() => setActiveView(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeView === 'preview' && (
        <section className="card simulate-panel" aria-labelledby="preview-title">
          <h2 id="preview-title">Your page preview</h2>

          <div className="simulate-preview-scroll">
            <iframe
              ref={frameRef}
              title="Simulated page preview"
              className="simulate-frame"
              /* Same rule as the audit frame: allow-same-origin lets AccessLab
                 read and restyle the copy; allow-scripts must never be added. */
              sandbox="allow-same-origin"
              srcDoc={srcDoc}
              onLoad={handlePreviewLoad}
            />
            <IssueOverlay frameRef={frameRef} refreshKey={`${loads}:${simulation}`} />
          </div>

          <p className="simulate-note">
            The preview updates when the HTML or CSS in the workbench changes. Page scripts remain
            disabled. This is a separate copy of the page: lenses never change the audit, the score
            or the history.
          </p>
        </section>
      )}

      {activeView === 'tab-order' && (
        <section className="card simulate-panel" aria-labelledby="tab-title">
          <h2 id="tab-title">Keyboard tab order</h2>
          <p className="simulate-note">
            An approximate list of visible focusable elements in keyboard tab order. Elements with
            positive tabindex values appear first in ascending order, followed by elements in DOM
            order. Actual browser behavior may vary.
          </p>

          {!previewReady ? (
            <p>The preview has not finished loading. Open Visual preview first.</p>
          ) : stops.length === 0 ? (
            <p>No focusable elements were found.</p>
          ) : (
            <ol className="simulate-list">
              {stops.map((stop) => (
                <li key={stop.order}>
                  <span className="simulate-number">{stop.order}</span>
                  <span>
                    <strong>{stop.name}</strong>
                    <span className="simulate-meta">
                      {stop.role}
                      {stop.state ? ` · ${stop.state}` : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {activeView === 'screen-reader' && (
        <section className="card simulate-panel" aria-labelledby="reader-title">
          <h2 id="reader-title">Screen-reader view</h2>
          <p className="simulate-note">
            What a screen reader reads in browse mode, in page order: landmarks as they start and
            end, headings with their level, links, buttons and fields as &ldquo;role, name&rdquo;,
            and the text between them. Hidden content and decorative images are skipped. A
            simplified model, not a real screen reader&rsquo;s speech.
          </p>

          {!previewReady ? (
            <p>The preview has not finished loading. Open Visual preview first.</p>
          ) : lines.length === 0 ? (
            <p>The page has no content a screen reader would read.</p>
          ) : (
            <ol className="simulate-list simulate-list--reader">
              {lines.map((line, index) => (
                <li
                  key={index}
                  className={`simulate-line simulate-line--${line.role}${line.missing ? ' simulate-line--missing' : ''}`}
                >
                  {line.text}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}
