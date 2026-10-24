// features/audit/IssueOverlay.jsx
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { overlayBoxes } from './overlayBoxes';

/** Height of a severity label; boxes nearer the top than this show it inside. */
const LABEL_ROOM = 18;

const LABEL = { critical: 'Critical', serious: 'Serious', moderate: 'Moderate', minor: 'Minor' };

/**
 * Boxes drawn over the preview iframe, one per issue. Purely visual
 * (aria-hidden): the issue list carries the same information for everyone.
 * Clicks go through to the preview, where Workbench's listener selects issues.
 */
export default function IssueOverlay({ frameRef }) {
  const issues = useSelector((state) => state.audit.result?.issues);
  const selectedId = useSelector((state) => state.audit.selectedIssueId);
  const [layout, setLayout] = useState(null);

  useEffect(() => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    const win = doc?.defaultView;
    if (!frame || !win || !issues) return undefined;

    // At most one layout read per frame, however many scroll events arrive.
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setLayout({
          frame: {
            top: frame.offsetTop + frame.clientTop,
            left: frame.offsetLeft + frame.clientLeft,
            width: frame.clientWidth,
            height: frame.clientHeight,
          },
          boxes: overlayBoxes(doc, issues),
        });
      });
    };

    measure();
    doc.addEventListener('scroll', measure, { capture: true, passive: true }); // page and inner scrollers
    win.addEventListener('resize', measure);
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => {
      cancelAnimationFrame(raf);
      doc.removeEventListener('scroll', measure, { capture: true });
      win.removeEventListener('resize', measure);
      observer.disconnect();
    };
  }, [frameRef, issues]);

  if (!layout) return null;
  return (
    <div
      className={`issue-overlay${selectedId ? ' issue-overlay--has-selection' : ''}`}
      style={layout.frame}
      aria-hidden="true"
    >
      {layout.boxes.map((box) => (
        <div
          key={box.id}
          className={[
            'issue-box',
            `issue-box--${box.severity}`,
            box.id === selectedId && 'issue-box--selected',
            box.top < LABEL_ROOM && 'issue-box--label-inside', // no room above: label goes inside
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
        >
          <span className="issue-box__label">{LABEL[box.severity]}</span>
        </div>
      ))}
    </div>
  );
}
