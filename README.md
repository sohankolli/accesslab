# AccessLab

**An in-browser accessibility testing workbench.** Paste a page's HTML and CSS, identify accessibility barriers, understand why they matter, apply suggested fixes, and explore how different users may experience the page.

AccessLab is a course project for DS359 Full Stack Development I at IIIT Dharwad. Its audit engine is written in plain JavaScript, while the interface is a React single-page application using Redux Toolkit and React Router.

## Features

- **Live accessibility audit.** An HTML/CSS editor feeds a sandboxed preview. After editing pauses, the page is re-rendered and audited.
- **Readable findings.** Each finding explains the accessibility issue, who it affects, the relevant WCAG criterion, and possible fixes.
- **Rule packs.** Eleven core accessibility rules are organized into switchable packs.
- **Colour contrast analysis.** Calculates WCAG relative luminance and contrast ratios and suggests passing colour alternatives.
- **Issue overlays.** Findings are highlighted on the preview with numbered markers corresponding to the issue list.
- **Score and history.** Displays an accessibility score, changes between runs, and reports comparing previous audit runs.
- **Accessibility simulator.** Provides visual approximations for protanopia, deuteranopia, tritanopia, low vision and 200% zoom.
- **Keyboard tab-order view.** Displays an approximate ordering of visible focusable elements, accounting for positive tabindex values.
- **Screen-reader view.** Provides a simplified outline of headings, controls and images. It is an educational representation, not a real screen-reader transcript.
- **Learn section.** Provides rule-specific explanations, examples of accessibility problems and suggested improvements.
- **Keyboard shortcuts.** Includes keyboard-accessible navigation and shortcut help.
- **Accessible interface.** Uses Atkinson Hyperlegible fonts, light/dark/system themes, keyboard-resizable panes and accessible interface controls.
- **Safe preview.** Audited pages run in a sandboxed iframe. Page JavaScript is disabled, and links and forms are prevented from navigating or submitting within the preview.

## Getting started

Requires Node.js 22.

```bash
npm install
npm run dev
```

Open the local Vite URL, normally `http://localhost:5173`.

## Available scripts

| Script | Description |
|---|---|
| `npm run dev` | Starts the Vite development server |
| `npm run build` | Creates a production build in `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm run lint` | Runs ESLint |
| `npm test` | Runs Vitest in watch mode |
| `npm test -- --run` | Runs all tests once |
| `npm run coverage` | Runs tests with coverage reporting |

## Architecture

```text
src/
  engine/      Plain JavaScript accessibility rules, registry, scheduler,
               contrast calculations and DOM helpers
  features/    Feature modules such as editor, audit, simulate, learn and report
  app/         Application store, router and layout
  components/  Shared interface components
  context/     Application settings and preferences
  services/    Browser storage helpers
tests/         Vitest and React Testing Library tests
```

### Design principles

- The audit engine does not depend on React or Redux.
- Audit findings are represented as data rather than stored DOM nodes.
- Audits run in time slices so the interface remains responsive.
- A newer audit can cancel an older one.
- There is no backend; history and preferences are stored locally in the browser.

## Rule catalogue

The core rule catalogue includes:

| Rule | Purpose |
|---|---|
| `img-alt` | Checks images for missing alternative text |
| `form-label` | Checks form controls for accessible labels |
| `button-name` | Checks buttons for accessible names |
| `link-name` | Checks links for accessible names |
| `color-contrast` | Checks text contrast against WCAG thresholds |
| `html-lang` | Checks the language declaration on full pages |
| `page-title` | Checks for a meaningful page title |
| `heading-order` | Detects skipped heading levels |
| `tabindex-positive` | Detects positive tabindex values |
| `duplicate-id` | Detects repeated HTML IDs |
| `landmark-main` | Checks for a main landmark on full pages |

The rules are linked to their relevant WCAG 2.2 criteria or best-practice guidance.

## Testing

Run the complete test suite with:

```bash
npm test -- --run
```

Run linting and the production build with:

```bash
npm run lint
npm run build
```

The test suite includes engine tests, accessibility rule tests, DOM helper tests, scheduler tests, component tests and application state tests.

## Limitations

- Automated checks detect only part of accessibility problems. Human review and testing with users are still necessary.
- Meaningful alternative text, reading order and caption quality require human judgment.
- The accessible-name computation implements a documented subset of the W3C algorithm.
- Colour-vision and low-vision simulations are illustrative approximations, not clinical simulations.
- The screen-reader view is a simplified educational outline and does not reproduce actual assistive technology output.
- The keyboard tab-order view is an approximation; actual browser focus behavior can vary.
- Scripts in audited pages do not run, so JavaScript-generated content is not included in the preview audit.
- Live websites cannot be audited directly by URL because browsers restrict cross-origin access.

## Project status

The project includes the accessibility workbench, rule catalogue, audit engine, reporting, learning guides and simulation features. These features are intended to help developers understand and improve common accessibility barriers.