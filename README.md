# AccessLab

**An in-browser accessibility testing workbench.** Paste a page's HTML and CSS, see which
accessibility barriers it contains and why, apply suggested fixes, watch the score improve, and
experience the page the way people with disabilities do, all in the browser, with no server.

AccessLab is a course project for DS359 Full Stack Development I at IIIT Dharwad. Its audit
engine is plain JavaScript written for the project (WCAG contrast maths, an accessible-name
resolver, a rule registry and a time-sliced scheduler), and the interface is a React single-page
app with Redux Toolkit and React Router.

## Features

- **Live audit.** An HTML/CSS editor (tabs, line numbers, caret position) feeds a sandboxed
  preview; 400 ms after you stop typing the page is re-rendered and checked again. Code that
  would make the page larger than 500 KB is refused.
- **Findings people can read.** Each finding has a plain title and says who it affects
  ("Screen reader users hear "image" and nothing else."), with the element, the rule, a link to
  the WCAG criterion and the fix. The score is also read as eye-chart acuity: 77 "reads at
  20/30".
- **Eleven core rules** in two switchable packs (see the catalogue below), each linked to its
  WCAG 2.2 success criterion.
- **Colour contrast with fixes.** Real WCAG relative-luminance maths, background resolution
  through translucent layers, and the nearest passing colour (same hue) as a one-click CSS fix.
- **Numbered marks.** Every finding is outlined on the preview with a numbered pin that matches
  its number in the list. Opening a finding scrolls the preview to it and highlights its source
  line in yellow; clicking an element in the preview opens its finding.
- **Score and history.** A weighted 0–100 score, the change since the last run, and a report
  page comparing any two of the last 20 runs.
- **Simulate, Learn and keyboard shortcuts**: see their sections below.
- **Built to its own standard.** Set in Atkinson Hyperlegible (self-hosted); light, dark and
  system themes; every text colour passes WCAG AA in both (checked by a test with the engine's
  own contrast maths); 44 px touch targets; keyboard-resizable panes; and AccessLab scores 100
  when its own engine audits its pages. The visual spec is
  [`docs/design/direction.html`](docs/design/direction.html), with side-by-side fidelity
  checks in [`docs/design/fidelity/`](docs/design/fidelity/).
- **Safe by design.** The audited page runs in an `<iframe sandbox="allow-same-origin">`: its
  own JavaScript never runs, and links or forms inside it cannot navigate the frame.

## Screenshots

|                                  | Light                                                                       | Dark                                                                      |
| -------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Workbench with issues            | ![Workbench, light theme](docs/screenshots/workbench-issues-light.png)      | ![Workbench, dark theme](docs/screenshots/workbench-issues-dark.png)      |
| An issue selected in the preview | ![Selected issue, light](docs/screenshots/workbench-selected-light.png)     | ![Selected issue, dark](docs/screenshots/workbench-selected-dark.png)     |
| No issues                        | ![Score 100, light](docs/screenshots/workbench-clean-light.png)             | ![Score 100, dark](docs/screenshots/workbench-clean-dark.png)             |
| Report                           | ![Report, light](docs/screenshots/report-light.png)                         | ![Report, dark](docs/screenshots/report-dark.png)                         |
| Home                             | ![Home, light](docs/screenshots/home-light.png)                             | ![Home, dark](docs/screenshots/home-dark.png)                             |
| Phone                            | ![Workbench on a phone, light](docs/screenshots/workbench-mobile-light.png) | ![Workbench on a phone, dark](docs/screenshots/workbench-mobile-dark.png) |

## Simulate

The Simulate page shows the workbench's current page in its own preview frame, a separate copy
that is never audited. Choosing a lens restyles only that copy, so a lens can never change the
audit, the score or the history. The workbench's numbered marks are drawn on the copy too, and
stay on their elements under every lens.

- **Colour vision.** Protanopia, deuteranopia and tritanopia use the matrices of Machado,
  Oliveira and Fernandes (2009) at full severity, applied as an SVG `feColorMatrix` filter.
- **Low vision.** A `blur(2px) contrast(0.8)` filter: small and low-contrast text fails first.
- **200% text size.** Doubles the root font size. Text sized in `px` does not grow, which is
  exactly what this lens reveals.
- **Keyboard tab order.** The page's focusable elements in the order Tab visits them: positive
  `tabindex` values first, then document order.
- **Screen-reader view.** What a screen reader reads in browse mode, in page order: landmarks as
  they start and end, headings with their level, links, buttons and fields as "role, name", and
  the text between them. Hidden content and decorative images (`alt=""`) are skipped, and
  anything without a name reads "(no name)".

These are teaching aids, not clinical simulations or real assistive-technology output.

## Learn

The Learn page lists a guide for each of the eleven rules, grouped by pack. Each guide
(`/learn/<rule-id>`) explains why the rule matters, how to fix it, and shows an example that
needs fixing next to an improved one.

## Keyboard shortcuts

Press <kbd>?</kbd> anywhere outside a text field for the shortcut help; <kbd>Esc</kbd> closes
it. Shortcuts are ignored while you type in a field or the editor.

| Keys                  | Action                             |
| --------------------- | ---------------------------------- |
| `Alt` + `Shift` + `H` | Go to Home                         |
| `Alt` + `Shift` + `W` | Go to the Workbench                |
| `Alt` + `Shift` + `S` | Go to Simulate (the vision lenses) |
| `Alt` + `Shift` + `R` | Go to the Report                   |
| `Alt` + `Shift` + `L` | Go to Learn                        |
| `?`                   | Open the shortcut help             |
| `Esc`                 | Close the shortcut help            |

## Getting started

Requires Node.js 22.

```bash
npm install
npm run dev        # http://localhost:5173, then open "Workbench"
```

| Script                 | What it does                                    |
| ---------------------- | ----------------------------------------------- |
| `npm run dev`          | Vite dev server with hot reload                 |
| `npm run build`        | Production build into `dist/`                   |
| `npm run preview`      | Serve the production build locally              |
| `npm run lint`         | ESLint, including `eslint-plugin-jsx-a11y`      |
| `npm run format`       | Format every file with Prettier                 |
| `npm run format:check` | Check formatting without changing files (CI)    |
| `npm test`             | Vitest in watch mode (`npm test -- --run` once) |
| `npm run coverage`     | Tests with a coverage report                    |

## Architecture

```
src/
  engine/      plain JavaScript, no React: rules, registry, scheduler, contrast, DOM helpers
               (accessible names, roles, focus order, linearizer), simulation filters
  features/    one folder per feature: editor, audit (workbench), simulate, learn, report, ...
  app/         store, router, layout
  components/  shared UI (header, footer, segmented control, severity shapes)
  context/     SettingsContext: theme, motion, enabled rule packs
  services/    guarded localStorage access
tests/         Vitest + jsdom: engine fixtures, reducers, components
```

- **The engine never imports React or Redux**, so it is tested on its own with jsdom and could
  run in a browser extension or CI tool unchanged.
- **Issues are plain data.** Each issue refers to its element by a unique CSS selector, never by
  a DOM node, so audit results live in Redux and survive re-audits.
- **Audits run in time slices.** Rules need the live DOM, so they run on the main thread, but
  the scheduler yields to the browser every ~12 ms and a newer edit aborts a stale audit.
- **One audited document.** Only the workbench's preview is audited. Simulate renders its own
  copy, so nothing a lens does can reach the audit.
- **No backend.** History and preferences are kept in `localStorage`.

## Rule catalogue

| Rule                | Checks                                                  | WCAG 2.2                 | Severity | Pack          |
| ------------------- | ------------------------------------------------------- | ------------------------ | -------- | ------------- |
| `img-alt`           | `<img>` without an `alt` attribute                      | 1.1.1 Non-text Content   | Critical | WCAG 2.2 A/AA |
| `form-label`        | Field with no label, or named only by placeholder/title | 1.3.1, 4.1.2             | Critical | WCAG 2.2 A/AA |
| `button-name`       | Button with no accessible name                          | 4.1.2 Name, Role, Value  | Critical | WCAG 2.2 A/AA |
| `link-name`         | Link with no accessible name (e.g. an icon-only link)   | 2.4.4 Link Purpose       | Serious  | WCAG 2.2 A/AA |
| `color-contrast`    | Text below 4.5:1, or below 3:1 for large text           | 1.4.3 Contrast (Minimum) | Serious  | WCAG 2.2 A/AA |
| `html-lang`         | `<html>` without `lang` (full pages only)               | 3.1.1 Language of Page   | Serious  | WCAG 2.2 A/AA |
| `page-title`        | Missing or empty `<title>` (full pages only)            | 2.4.2 Page Titled        | Serious  | WCAG 2.2 A/AA |
| `heading-order`     | Heading level skipped, e.g. h1 → h3                     | 1.3.1 (best practice)    | Moderate | Best practice |
| `tabindex-positive` | `tabindex` greater than 0                               | 2.4.3 (best practice)    | Moderate | Best practice |
| `duplicate-id`      | Repeated `id` values                                    | Best practice            | Moderate | Best practice |
| `landmark-main`     | No single `<main>` landmark (full pages only)           | Best practice (2.4.1)    | Minor    | Best practice |

**Scoring.** Each rule owns a share of the score in proportion to its severity weight
(critical 10, serious 6, moderate 3, minor 1). A rule with _n_ issues loses 1 − 0.5ⁿ of its
share, so the first issue costs half and one noisy rule can never drive the score to zero.
Text on images or gradients is listed for manual review and is not scored.

## Testing

`npm test -- --run` runs the whole suite: unit tests for the contrast maths, a passing and a
failing fixture for every rule, registry validation, scheduler slicing and cancellation, focus
order, the screen-reader linearizer, the simulation filters, reducers, and React Testing
Library tests for the workbench, the issue list, settings, shortcuts and the rule that a lens
never changes the audit. CI (GitHub Actions) runs lint, a Prettier format check, the tests and the
production build on every pull request.

## Limitations

- Automated checks find only part of the real accessibility problems; meaningful alt text,
  sensible reading order and caption quality still need a person.
- The accessible-name computation is a documented subset of the W3C algorithm.
- Contrast ignores `opacity` and text shadows, and flags text over images or gradients for
  review rather than guessing.
- The simulations, tab order and screen-reader view are approximations for learning, not a
  replacement for testing with disabled people and real assistive technology.
- Scripts in the audited page never run, so pages that build their content with JavaScript are
  audited in their initial state.
- Live websites cannot be audited by URL: browsers block reading other sites (CORS).

## Status

Milestones 1 (scaffold, first audit) and 2 (rule packs, contrast and fixes, all eleven core
rules, overlays, sliced audits, report) are complete. Milestone 3 work so far: the Simulate page
(colour-vision, low-vision and 200% text lenses, the tab-order list and the screen-reader view),
the Learn guides and keyboard shortcuts. Still to come: CodeMirror editors, share links and
GitHub import.
