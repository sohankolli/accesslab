import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import { lineAndColumn } from './sourceLine';

const TABS = [
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
];

const countLines = (text) => {
  let n = 1;
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) n++;
  return n;
};

/**
 * One language's code: a line-number gutter and a plain textarea (CodeMirror
 * replaces it in Milestone 3). The highlighted line is a yellow band drawn over
 * the textarea with its own copy of that line's text in dark ink, so it reads in
 * both themes; it steps aside while the caret is on that line so the caret shows.
 */
function CodePanel({ lang, label, value, onChange, active, highlight, onCaret, textareaRef }) {
  const gutterRef = useRef(null);
  const bandRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const [caretLine, setCaretLine] = useState(1);
  const lines = countLines(value);
  // Only rebuilt when the number of lines changes, not on every keystroke.
  const gutterText = useMemo(
    () => Array.from({ length: lines }, (_, i) => i + 1).join('\n'),
    [lines],
  );
  const bandText = highlight ? (value.split('\n')[highlight.line - 1] ?? '') : '';
  const showBand = highlight && !(focused && caretLine === highlight.line);

  // Keep the gutter and the band in step with the textarea's scroll position.
  const sync = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
    const band = bandRef.current;
    if (band && highlight) {
      const style = getComputedStyle(ta);
      const lineHeight = parseFloat(style.lineHeight);
      const top = parseFloat(style.paddingTop) + (highlight.line - 1) * lineHeight - ta.scrollTop;
      band.style.transform = `translateY(${top}px)`;
      band.style.height = `${lineHeight}px`;
      band.style.setProperty('--scroll-x', `${-ta.scrollLeft}px`);
    }
  }, [highlight, textareaRef]);
  useLayoutEffect(sync, [sync, showBand, active]);

  const reportCaret = useCallback(
    (ta) => {
      const pos = lineAndColumn(ta.value, ta.selectionStart);
      setCaretLine(pos.line);
      onCaret(pos);
    },
    [onCaret],
  );

  // The native selectionchange event also fires for selections made by script
  // ("Show in code"), which React's onSelect misses.
  useEffect(() => {
    const ta = textareaRef.current;
    const handler = () => reportCaret(ta);
    ta.addEventListener('selectionchange', handler);
    return () => ta.removeEventListener('selectionchange', handler);
  }, [reportCaret, textareaRef]);

  return (
    <div
      role="tabpanel"
      id={`panel-${lang}`}
      aria-labelledby={`tab-${lang}`}
      className="code"
      hidden={!active}
      style={{ '--gutter-ch': String(Math.max(2, String(lines).length)) }}
    >
      <pre className="code__gutter" ref={gutterRef} aria-hidden="true">
        {gutterText}
      </pre>
      <label htmlFor={`${lang}-input`} className="sr-only">
        {label} source
      </label>
      <textarea
        id={`${lang}-input`}
        ref={textareaRef}
        className="code__input"
        wrap="off"
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={sync}
        onSelect={(e) => reportCaret(e.currentTarget)}
        onFocus={(e) => {
          setFocused(true);
          reportCaret(e.currentTarget);
        }}
        onBlur={() => setFocused(false)}
      />
      {showBand && (
        <div className="code__band" ref={bandRef} aria-hidden="true">
          <span className="code__band-num">{highlight.line}</span>
          <span className="code__band-text">{bandText}</span>
        </div>
      )}
    </div>
  );
}

/**
 * The source pane: HTML and CSS as tabs (WAI-ARIA tabs pattern: arrow keys move
 * between them), a gutter, and a status footer with the caret position.
 * @param {{
 *   html: string, css: string,
 *   onHtmlChange: (v: string) => void, onCssChange: (v: string) => void,
 *   highlight?: {line: number}|null,  the HTML line of the selected issue
 *   controlRef?: import('react').Ref<{reveal: (start: number, end: number) => void}>,
 * }} props
 */
export default function SourceEditor({
  html,
  css,
  onHtmlChange,
  onCssChange,
  highlight = null,
  controlRef,
}) {
  const [active, setActive] = useState('html');
  const [caret, setCaret] = useState({ html: null, css: null });
  const tabRefs = useRef({});
  const htmlInput = useRef(null);
  const cssInput = useRef(null);
  const onHtmlCaret = useCallback((p) => setCaret((c) => ({ ...c, html: p })), []);
  const onCssCaret = useCallback((p) => setCaret((c) => ({ ...c, css: p })), []);

  // "Show in code": open the HTML tab, select the element's start tag, centre it.
  useImperativeHandle(
    controlRef,
    () => ({
      reveal(start, end) {
        flushSync(() => setActive('html'));
        const ta = htmlInput.current;
        if (!ta) return;
        ta.focus({ preventScroll: true });
        ta.setSelectionRange(start, end);
        const lineHeight = parseFloat(getComputedStyle(ta).lineHeight);
        const { line } = lineAndColumn(ta.value, start);
        ta.scrollTop = (line - 1) * lineHeight - ta.clientHeight / 2;
        ta.scrollLeft = 0;
      },
    }),
    [htmlInput],
  );

  const onTabKey = (event) => {
    const i = TABS.findIndex((t) => t.id === active);
    const next = {
      ArrowRight: TABS[(i + 1) % TABS.length],
      ArrowLeft: TABS[(i - 1 + TABS.length) % TABS.length],
      Home: TABS[0],
      End: TABS.at(-1),
    }[event.key];
    if (!next) return;
    event.preventDefault();
    setActive(next.id);
    tabRefs.current[next.id]?.focus();
  };

  const value = active === 'html' ? html : css;
  const lines = countLines(value);
  const pos = caret[active];

  return (
    <>
      <div className="tabs-bar">
        <div className="tabs" role="tablist" aria-label="Source code">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              ref={(el) => (tabRefs.current[tab.id] = el)}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              className="tab"
              aria-selected={active === tab.id}
              aria-controls={`panel-${tab.id}`}
              tabIndex={active === tab.id ? 0 : -1}
              onClick={() => setActive(tab.id)}
              onKeyDown={onTabKey}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <span className="tabs-bar__meta">
          {lines} {lines === 1 ? 'line' : 'lines'}
        </span>
      </div>
      <CodePanel
        lang="html"
        label="HTML"
        value={html}
        onChange={onHtmlChange}
        active={active === 'html'}
        highlight={highlight}
        onCaret={onHtmlCaret}
        textareaRef={htmlInput}
      />
      <CodePanel
        lang="css"
        label="CSS"
        value={css}
        onChange={onCssChange}
        active={active === 'css'}
        highlight={null}
        onCaret={onCssCaret}
        textareaRef={cssInput}
      />
      <div className="src-foot">
        <span>Checks again when you pause typing</span>
        <span>{`Line ${pos?.line ?? 1}, col ${pos?.column ?? 1}`}</span>
      </div>
    </>
  );
}
