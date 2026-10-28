
import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import { buildDocument } from '../audit/SandboxFrame';
import { simulationChanged } from '../audit/auditSlice';
import './simulate.css';

const SIMULATIONS = [
  { value: 'none', label: 'Normal vision' },
  { value: 'protanopia', label: 'Protanopia approximation' },
  { value: 'deuteranopia', label: 'Deuteranopia approximation' },
  { value: 'tritanopia', label: 'Tritanopia approximation' },
  { value: 'low-vision', label: 'Low-vision approximation' },
  { value: 'zoom-200', label: '200% preview zoom' },
];

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'summary',
];

function accessibleName(element) {
  const labelledBy = element.getAttribute('aria-labelledby');

  if (labelledBy) {
    const name = labelledBy
      .split(/\s+/)
      .map((id) => element.ownerDocument.getElementById(id)?.textContent?.trim())
      .filter(Boolean)
      .join(' ');

    if (name) return name;
  }

  const ariaLabel = element.getAttribute('aria-label')?.trim();
  if (ariaLabel) return ariaLabel;

  if (element.labels?.length) {
    const label = [...element.labels]
      .map((item) => item.textContent.trim())
      .filter(Boolean)
      .join(' ');

    if (label) return label;
  }

  if (element.tagName === 'IMG') {
    return element.getAttribute('alt') || 'Image without alt text';
  }

  if (['INPUT', 'BUTTON'].includes(element.tagName)) {
    if (element.value) return element.value;
  }

  return element.innerText?.trim() ||
    element.textContent?.trim() ||
    'Unnamed element';
}

function readPage(document) {
  const visible = (element) => {
    if (element.closest('[hidden], [inert], [aria-hidden="true"]')) {
      return false;
    }

    const style = document.defaultView.getComputedStyle(element);

    return style.display !== 'none' && style.visibility !== 'hidden';
  };

  const focusable = [...document.querySelectorAll(FOCUSABLE.join(','))]
    .filter(visible)
    .map((element, index) => ({
      id: `focus-${index}`,
      order: index + 1,
      role: element.getAttribute('role') || element.tagName.toLowerCase(),
      name: accessibleName(element),
      state: [
        element.disabled ? 'disabled' : '',
        element.getAttribute('aria-expanded') === 'true' ? 'expanded' : '',
        element.getAttribute('aria-checked') !== null
          ? `checked: ${element.getAttribute('aria-checked')}`
          : '',
      ].filter(Boolean).join(', '),
    }));

  const headings = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')]
    .filter(visible)
    .map((element, index) => ({
      id: `heading-${index}`,
      order: null,
      role: `${element.tagName.toLowerCase()} heading`,
      name: accessibleName(element),
      state: '',
    }));

  const images = [...document.querySelectorAll('img')]
    .filter(visible)
    .map((element, index) => ({
      id: `image-${index}`,
      order: null,
      role: 'image',
      name: accessibleName(element),
      state: '',
    }));

  return [...headings, ...focusable, ...images];
}

export default function Simulator() {
  const dispatch = useDispatch();
  const html = useSelector((state) => state.editor.html);
  const css = useSelector((state) => state.editor.css);
  const simulation = useSelector((state) => state.audit.simulation);

  const frameRef = useRef(null);
  const [activeView, setActiveView] = useState('preview');
  const [elements, setElements] = useState([]);
  const [previewReady, setPreviewReady] = useState(false);

  const srcDoc = useMemo(() => buildDocument(html, css), [html, css]);

  const handlePreviewLoad = useCallback(() => {
    const document = frameRef.current?.contentDocument;

    if (!document?.body) {
      setElements([]);
      setPreviewReady(false);
      return;
    }

    setElements(readPage(document));
    setPreviewReady(true);
  }, []);

  const previewClass = `simulate-frame simulate-frame--${simulation}`;

  return (
    <main className="page simulate-page">
      <title>Simulate – AccessLab</title>

      <header className="page__header">
        <div>
          <h1 className="page__title">Simulate</h1>
          <p className="page__lead">
            Explore visual, keyboard and screen-reader accessibility
            using your current workbench page.
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
            onChange={(event) =>
              dispatch(simulationChanged(event.target.value))
            }
          >
            {SIMULATIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <p className="simulate-note">
          Visual simulations are illustrative approximations. They do not
          reproduce every person's experience or replace testing with users.
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
              className={previewClass}
              sandbox="allow-same-origin"
              srcDoc={srcDoc}
              onLoad={handlePreviewLoad}
            />
          </div>

          <p className="simulate-note">
            The preview updates when the HTML or CSS in the workbench changes.
            Page scripts remain disabled.
          </p>
        </section>
      )}

      {activeView === 'tab-order' && (
        <section className="card simulate-panel" aria-labelledby="tab-title">
          <h2 id="tab-title">Keyboard tab order</h2>
          <p className="simulate-note">
            An approximate list of visible focusable elements in DOM order.
            Actual keyboard navigation can differ due to browser behavior
            and positive tabindex values.
          </p>

          {!previewReady ? (
            <p>The preview has not finished loading. Open Visual preview first.</p>
          ) : elements.filter((element) => element.order !== null).length === 0 ? (
            <p>No focusable elements were found.</p>
          ) : (
            <ol className="simulate-list">
              {elements.filter((element) => element.order !== null).map((element) => (
                <li key={element.id}>
                  <span className="simulate-number">{element.order}</span>
                  <span>
                    <strong>{element.name}</strong>
                    <span className="simulate-meta">
                      {element.role}
                      {element.state ? ` · ${element.state}` : ''}
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
            A simplified outline of headings, controls and images. This is
            not a real screen-reader speech transcript.
          </p>

          {!previewReady ? (
            <p>The preview has not finished loading. Open Visual preview first.</p>
          ) : elements.length === 0 ? (
            <p>No headings, controls or images were found.</p>
          ) : (
            <ul className="simulate-list">
              {elements.map((element) => (
                <li key={element.id}>
                  <span className="simulate-role">{element.role}</span>
                  <span>
                    <strong>{element.name}</strong>
                    {element.state && (
                      <span className="simulate-meta">{element.state}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
