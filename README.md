# AccessLab

**An in-browser accessibility testing workbench.** Paste a page's HTML and CSS, see which
accessibility barriers it contains and why, apply suggested fixes, and watch the score improve,
all in the browser, with no server.

AccessLab is a course project for DS359 Full Stack Development I at IIIT Dharwad. Its audit
engine is plain JavaScript written for the project (WCAG contrast maths, an accessible-name
resolver, a rule registry and a time-sliced scheduler), and the interface is a React single-page
app with Redux Toolkit and React Router.

## Features

- **Live audit.** HTML and CSS editors feed a sandboxed preview; 400 ms after you stop typing
  the page is re-rendered and re-audited.
- **Eleven core rules** in two switchable packs (see the catalogue below), each linked to its
  WCAG 2.2 success criterion.
- **Colour contrast with fixes.** Real WCAG relative-luminance maths, background resolution
  through translucent layers, and the nearest passing colour (same hue) as a one-click CSS fix.
- **Issue overlays.** Every issue is outlined on the preview, labelled by severity. Select an
  issue to scroll to it, or click an element in the preview to find its issue.
- **Score and history.** A weighted 0–100 score, the change since the last run, and a report
  page comparing any two of the last 20 runs.
- **Safe by design.** The audited page runs in an `<iframe sandbox="allow-same-origin">`: its
  own JavaScript never runs, and links or forms inside it cannot navigate the frame.

## Getting started

Requires Node.js 22.

```bash
npm install
npm run dev        # http://localhost:5173, then open "Audit"
```

| Script             | What it does                                    |
| ------------------ | ----------------------------------------------- |
| `npm run dev`      | Vite dev server with hot reload                 |
| `npm run build`    | Production build into `dist/`                   |
| `npm run preview`  | Serve the production build locally              |
| `npm run lint`     | ESLint, including `eslint-plugin-jsx-a11y`      |
| `npm test`         | Vitest in watch mode (`npm test -- --run` once) |
| `npm run coverage` | Tests with a coverage report                    |

## Architecture

```
src/
  engine/      plain JavaScript, no React: rules, registry, scheduler, contrast, DOM helpers
  features/    one folder per feature: editor, audit (workbench), report, ...
  app/         store, router, layout
  components/  shared UI (header, footer, score badge)
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
- **No backend.** History and preferences are kept in `localStorage`.

## Rule catalogue

| Rule                | Checks                                                  | WCAG 2.2                 | Severity | Pack           |
| ------------------- | ------------------------------------------------------- | ------------------------ | -------- | -------------- |
| `img-alt`           | `<img>` without an `alt` attribute                      | 1.1.1 Non-text Content   | Critical | WCAG 2.2 A/AA  |
| `form-label`        | Field with no label, or named only by placeholder/title | 1.3.1, 4.1.2             | Critical | WCAG 2.2 A/AA  |
| `button-name`       | Button with no accessible name                          | 4.1.2 Name, Role, Value  | Critical | WCAG 2.2 A/AA  |
| `link-name`         | Link with no accessible name (e.g. an icon-only link)   | 2.4.4 Link Purpose       | Serious  | WCAG 2.2 A/AA  |
| `color-contrast`    | Text below 4.5:1, or below 3:1 for large text           | 1.4.3 Contrast (Minimum) | Serious  | WCAG 2.2 A/AA  |
| `html-lang`         | `<html>` without `lang` (full pages only)               | 3.1.1 Language of Page   | Serious  | WCAG 2.2 A/AA  |
| `page-title`        | Missing or empty `<title>` (full pages only)            | 2.4.2 Page Titled        | Serious  | WCAG 2.2 A/AA  |
| `heading-order`     | Heading level skipped, e.g. h1 → h3                     | 1.3.1 (best practice)    | Moderate | Best practices |
| `tabindex-positive` | `tabindex` greater than 0                               | 2.4.3 (best practice)    | Moderate | Best practices |
| `duplicate-id`      | Repeated `id` values                                    | Best practice            | Moderate | Best practices |
| `landmark-main`     | No single `<main>` landmark (full pages only)           | Best practice (2.4.1)    | Minor    | Best practices |

**Scoring.** Each rule owns a share of the score in proportion to its severity weight
(critical 10, serious 6, moderate 3, minor 1). A rule with _n_ issues loses 1 − 0.5ⁿ of its
share, so the first issue costs half and one noisy rule can never drive the score to zero.
Text on images or gradients is listed for manual review and is not scored.

## Testing

`npm test -- --run` runs the whole suite: unit tests for the contrast maths, a passing and a
failing fixture for every rule, registry validation, scheduler slicing and cancellation,
reducers, and React Testing Library tests for the issue list and settings. CI (GitHub Actions)
runs lint, tests and the production build on every pull request.

## Limitations

- Automated checks find only part of the real accessibility problems; meaningful alt text,
  sensible reading order and caption quality still need a person.
- The accessible-name computation is a documented subset of the W3C algorithm.
- Contrast ignores `opacity` and text shadows, and flags text over images or gradients for
  review rather than guessing.
- Scripts in the audited page never run, so pages that build their content with JavaScript are
  audited in their initial state.
- Live websites cannot be audited by URL: browsers block reading other sites (CORS).

## Status

Milestones 1 (scaffold, first audit) and 2 (rule packs, contrast and fixes, all eleven core
rules, overlays, sliced audits, report) are complete. Next: CodeMirror editors, the tab-order
map, the screen-reader view and colour-vision simulations.
