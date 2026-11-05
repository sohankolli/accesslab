**AccessLab**

**An in-browser accessibility testing workbench.** Paste a page's HTML and CSS, see which accessibility barriers it contains and why, apply suggested fixes, watch the score improve, and experience the page the way people with disabilities do, all in the browser, with no server.

AccessLab is a course project for DS359 Full Stack Development I at IIIT Dharwad. Its audit engine is plain JavaScript written for the project (WCAG contrast maths, an accessible-name resolver, a rule registry and a time-sliced scheduler), and the interface is a React single-page app with Redux Toolkit and React Router.

## What it does

- **Workbench and rule packs.** An HTML/CSS editor feeds a sandboxed preview that is checked again 400 ms after you stop typing. Eleven core rules in two switchable packs (WCAG 2.2 A/AA and Best practice) each link to their WCAG 2.2 success criterion. Every finding says who it affects, is numbered on the preview, and highlights its source line.
- **One-click fixes.** A colour-contrast finding offers the nearest passing colour (same hue) as a CSS fix you apply with one click.
- **Share links.** "Copy share link" packs the HTML and CSS into the link's URL fragment, which browsers never send to a server, so sharing uploads nothing.
- **File import.** "Open file", or dropping a file on the editor, loads an `.html`, `.htm` or `.css` file. The file is read in the browser.
- **Bookmarklet.** Drag **Check with AccessLab** from the home page to your bookmarks bar, then click it on any website to send that page's HTML and readable CSS to the workbench.
- **Simulate.** Colour-vision, low-vision and 200% text lenses, the keyboard tab order and a screen-reader view, shown on a separate copy of the page that is never audited.
- **Report.** A weighted 0–100 score with its trend and history, kept by page (the "Page" select shows one page at a time), a before-and-after comparison of any two of a page's last 20 runs (20 per page, 100 overall), and downloads of a run as JSON, CSV or a printable PDF.
- **Saved in your browser.** Your code, history and settings are kept in this browser, so a refresh shows the same page, score and history.
- **Learn.** A guide for each of the eleven rules: why it matters, how to fix it, and an example next to an improved one.
- **Keyboard shortcuts.** Press <kbd>?</kbd> outside a text field to see them, for example <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>W</kbd> for the Workbench.
- **Model suggestions (experimental).** A trained model can flag elements that look clickable but are not controls, which the rules cannot see. It is off by default and never changes the score.

AccessLab is built to its own standard: light, dark and system themes, every text colour passes WCAG AA, 44 px touch targets, and it scores 100 when its own engine audits its pages. The audited page runs in an `<iframe sandbox="allow-same-origin">`, so its own JavaScript never runs.

More detail: [user guide](docs/guide.md) (every feature, Simulate, Learn, keyboard shortcuts, checking a live page), [architecture and rule catalogue](docs/architecture.md), [model suggestions](docs/model.md) and [testing](docs/testing.md).

|                                  | Light                                                                       | Dark                                                                      |
| -------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Workbench with issues            | ![Workbench, light theme](docs/screenshots/workbench-issues-light.png)      | ![Workbench, dark theme](docs/screenshots/workbench-issues-dark.png)      |
| An issue selected in the preview | ![Selected issue, light](docs/screenshots/workbench-selected-light.png)     | ![Selected issue, dark](docs/screenshots/workbench-selected-dark.png)     |
| No issues                        | ![Score 100, light](docs/screenshots/workbench-clean-light.png)             | ![Score 100, dark](docs/screenshots/workbench-clean-dark.png)             |
| Report                           | ![Report, light](docs/screenshots/report-light.png)                         | ![Report, dark](docs/screenshots/report-dark.png)                         |
| Home                             | ![Home, light](docs/screenshots/home-light.png)                             | ![Home, dark](docs/screenshots/home-dark.png)                             |
| Phone                            | ![Workbench on a phone, light](docs/screenshots/workbench-mobile-light.png) | ![Workbench on a phone, dark](docs/screenshots/workbench-mobile-dark.png) |

## How to run it

**Live:** https://accesslab-tau.vercel.app (share links and the bookmarklet work from this address on any device; when run locally they point to localhost).

AccessLab runs locally. You need Node.js 22 (the version is in [`.nvmrc`](.nvmrc), so `nvm use` picks it up).

```bash
npm ci             # install the exact versions in package-lock.json
npm run dev        # http://localhost:5173, then open "Workbench"
npm test -- --run  # run the test suite once
npm run lint       # ESLint, including eslint-plugin-jsx-a11y
npm run build      # production build into dist/
npm run preview    # serve the production build locally
```

To run the demo, build the app and serve the build with `npm run build && npm run preview`, then open the address it prints.

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
| `npm run ml:bench`     | Time the model in the built app's Web Worker    |
| `npm run bench:typing` | Typing benchmark in headless Chrome             |

The optional model pipeline (crawling, labelling, training) has its own instructions in [`ml/README.md`](ml/README.md).

## What does not work yet

- **Model suggestions are experimental and off by default.** The corpus has only 55 trustworthy positives from 13 sites (6 in the test set, from 2 sites), too few to measure how good the model is; on the test sites, 3 of its 10 suggestions are correct, and it misses two of the five ship gates. See the model card (`/learn/model-card` in the app), [`docs/model.md`](docs/model.md) and [`ml/reports/evaluation.md`](ml/reports/evaluation.md).
- **Untitled pages share one history.** Pages without a `<title>` or file name are all saved under "Untitled page".
- **The bookmarklet has limits.** Cross-origin stylesheets cannot be read because of browser security restrictions, so they are skipped. Some websites restrict bookmarklets through their security policies, and the bookmarklet needs pop-ups allowed to open AccessLab. Pages larger than 500 KB are rejected.
- **Page scripts are not run in the preview**, so pages that build their content with JavaScript are audited in their initial state.
- **Automated checks find only part of the real accessibility problems.** Meaningful alt text, sensible reading order and caption quality still need a person.
- **Contrast has limits.** It ignores `opacity` and text shadows, and flags text over images or gradients for review rather than guessing.
- **The accessible-name computation is a documented subset** of the W3C algorithm.
- **The simulations, tab order and screen-reader view are approximations** for learning, not a replacement for testing with disabled people and real assistive technology.
- **No CodeMirror editors.** They are still to come; the editor is a plain text area with a line-number gutter.
- **Live websites cannot be fetched directly by URL** because of browser security restrictions. Use the Check with AccessLab bookmarklet to transfer the current page instead.

## Who did what

AccessLab was built by three people. The areas below are taken from the git history.

- **sohankolli**: the project scaffold (Vite, React, ESLint with jsx-a11y, Prettier, Vitest), routes and layout, the Redux store, storage service and settings context; the audit engine (contrast maths, DOM helpers, the rule registry and packs, all eleven core rules, the time-sliced scheduler); the workbench (sandboxed preview, live audit, numbered issue overlays, Apply fix, findings pane and score); the tabbed source editor, the 500 KB limit, share links and file import; the first report (history and before-and-after comparison); the design system (tokens, themes, Atkinson Hyperlegible, resizable panes) and the home page; the colour-vision matrices, the screen-reader view and the separate Simulate copy; CI, the Vercel config, the typing benchmark, the README and screenshots; and merging the team's pull requests.
- **mogalemanasvi-lang**: the click-only controls model, end to end: the crawler and corpus, labelling and the label hand-check, the 92 features and neighbourhood views, training, calibration, the ship gate and export, the Web Worker that runs the model with ONNX Runtime Web, model suggestions in the workbench and the model card page; the corrected training filter and cross-validated model selection; history by page (recording the page with each run, comparing with the same page, the Report's page select and the clear-history choice); and reviewing and merging Sohan's pull requests (share links and file import, and the follow-up fixes).
- **shrujanaaa**: the first Simulate page, the Learn guides and the keyboard shortcuts, with fixes from the Milestone 3 and 4 review; report downloads (JSON, CSV and a printable report to save as PDF), the fix that names report downloads by date and time, and the fix for a flaky share-link test; and the bookmarklet for checking live pages.
