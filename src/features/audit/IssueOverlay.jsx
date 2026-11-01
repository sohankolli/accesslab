import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { overlayBoxes } from './overlayBoxes';
import { selectSortedIssues } from './auditSlice';

/** Space between an element and its dashed mark, as in the mockup. */
const PAD = 5;
/** How far a pin may hang outside the preview frame (half a pin plus its halo). */
const PIN_OUT = 14;

/**
 * Inspection marks drawn over the preview iframe: a dashed outline in the
 * severity colour around each element with an issue, and a numbered pin at its
 * top-left, the same number as in the findings list. The selected mark gets a
 * solid border and a yellow ring. Purely visual (aria-hidden): the list carries
 * the same information for everyone. Clicks go through to the preview, where
 * Workbench's listener selects issues.
 */
export default function IssueOverlay({ frameRef }) {
  const issues = useSelector(selectSortedIssues);
  const selectedId = useSelector((state) => state.audit.selectedIssueId);
  const [layout, setLayout] = useState(null);

  useEffect(() => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    const win = doc?.defaultView;
    if (!frame || !win || !issues.length) return undefined;

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

  if (!layout || !issues.length) return null;
  const { width, height } = layout.frame;
  // Draw the selected mark last, so its ring sits on top of its neighbours.
  const boxes = [...layout.boxes].sort((a, b) => (a.id === selectedId) - (b.id === selectedId));
  const tone = (box) => (box.review ? 'review' : box.severity);

  return (
    <div className="marks" style={layout.frame} aria-hidden="true">
      {/* Outlines are clipped to the frame; pins may hang just outside it. */}
      <div className="marks__outlines">
        {boxes.map((box) => (
          <div
            key={box.id}
            className={`mark mark--${tone(box)}${box.id === selectedId ? ' is-selected' : ''}`}
            style={{
              top: box.top - PAD,
              left: box.left - PAD,
              width: box.width + 2 * PAD,
              height: box.height + 2 * PAD,
            }}
          />
        ))}
      </div>
      {boxes
        .filter((box) => {
          // A pin is shown while its corner is inside the visible frame.
          const x = box.left - PAD;
          const y = box.top - PAD;
          return x > -PIN_OUT && y > -PIN_OUT && x < width && y < height;
        })
        .map((box) => (
          <span
            key={box.id}
            className={`pin pin--${tone(box)}${box.id === selectedId ? ' is-selected' : ''}`}
            style={{
              top: Math.max(-PIN_OUT + 2, box.top - PAD - 13),
              left: Math.max(-PIN_OUT + 2, box.left - PAD - 13),
            }}
          >
            {box.number}
          </span>
        ))}
    </div>
  );
}
