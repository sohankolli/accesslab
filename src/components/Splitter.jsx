// A "window splitter" (WAI-ARIA APG pattern): a focusable separator whose value
// is the width of the pane it controls, as a percentage of the workbench.
// Arrow keys move it 2% (Shift: 10%), Home/End jump to the limits, and a
// pointer can drag it.

/**
 * @param {{
 *   label: string, controls: string, value: number, min: number, max: number,
 *   onChange: (value: number) => void, edge: 'start'|'end',
 *   containerRef: {current: HTMLElement|null},
 * }} props
 *   edge: 'start' when the controlled pane is left of the splitter (it grows as
 *   the splitter moves right), 'end' when it is right of it.
 */
export default function Splitter({
  label,
  controls,
  value,
  min,
  max,
  onChange,
  edge,
  containerRef,
}) {
  const clamp = (v) => Math.min(max, Math.max(min, v));
  const direction = edge === 'start' ? 1 : -1; // moving right grows a start pane

  function onKeyDown(event) {
    const step = event.shiftKey ? 10 : 2;
    const next = {
      ArrowRight: value + step * direction,
      ArrowLeft: value - step * direction,
      Home: min,
      End: max,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onChange(clamp(next));
  }

  function onPointerDown(event) {
    const container = containerRef.current;
    if (!container) return;
    event.currentTarget.setPointerCapture(event.pointerId); // keep receiving moves over the iframe
    const rect = container.getBoundingClientRect();
    const move = (e) => {
      const fromLeft = ((e.clientX - rect.left) / rect.width) * 100;
      onChange(clamp(edge === 'start' ? fromLeft : 100 - fromLeft));
    };
    const target = event.currentTarget;
    const stop = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', stop);
      target.removeEventListener('pointercancel', stop);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', stop);
    target.addEventListener('pointercancel', stop);
  }

  /* A focusable separator is an interactive widget (the APG window splitter),
     but jsx-a11y classes every "separator" as non-interactive. */
  /* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
  return (
    <div
      className="splitter"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-controls={controls}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={`${Math.round(value)}% of the width`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
    />
  );
  /* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
}
