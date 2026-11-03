import { useRef } from 'react';

/**
 * A row of tabs (WAI-ARIA tabs pattern). Only the chosen tab is in the Tab
 * order; the arrow keys move between tabs and Home/End jump to the ends, and
 * moving also selects ("automatic activation").
 *
 * Each tab gets the id `tab-<id>` and controls the element `panel-<id>`, so the
 * page renders one `role="tabpanel"` per tab with `id="panel-<id>"` and
 * `aria-labelledby="tab-<id>"`. Used by the Workbench's HTML/CSS tabs and the
 * Simulate page's three views.
 * @param {{
 *   tabs: {id: string, label: string}[],
 *   active: string,
 *   onChange: (id: string) => void,
 *   label: string,  the tab list's accessible name
 * }} props
 */
export default function TabList({ tabs, active, onChange, label }) {
  const tabRefs = useRef({});

  const onKeyDown = (event) => {
    const i = tabs.findIndex((t) => t.id === active);
    const next = {
      ArrowRight: tabs[(i + 1) % tabs.length],
      ArrowLeft: tabs[(i - 1 + tabs.length) % tabs.length],
      Home: tabs[0],
      End: tabs.at(-1),
    }[event.key];
    if (!next) return;
    event.preventDefault();
    onChange(next.id);
    tabRefs.current[next.id]?.focus();
  };

  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          ref={(el) => {
            tabRefs.current[tab.id] = el;
          }}
          type="button"
          role="tab"
          id={`tab-${tab.id}`}
          className="tab"
          aria-selected={active === tab.id}
          aria-controls={`panel-${tab.id}`}
          tabIndex={active === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={onKeyDown}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
