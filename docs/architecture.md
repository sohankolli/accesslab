# AccessLab architecture

How the code is organised, the rules it checks and how the score is computed. For a short overview, see the [README](../README.md).

## Architecture

```
src/
  engine/      plain JavaScript, no React: rules, registry, scheduler, contrast, DOM helpers
               (accessible names, roles, focus order, linearizer), simulation filters,
               ml/ (features shared with the crawler, model worker, explanations)
  features/    one folder per feature: editor, audit (workbench), simulate, learn, report, ...
  app/         store, router, layout
  components/  shared UI (header, footer, segmented control, severity shapes)
  context/     SettingsContext: theme, motion, enabled rule packs
  services/    guarded localStorage access
tests/         Vitest + jsdom: engine fixtures, reducers, components, model
ml/            offline model pipeline: crawler, labels, training, reports (see ml/README.md)
public/models/ the shipped model and its manifest
```

- **The engine never imports React or Redux**, so it is tested on its own with jsdom and could run in a browser extension or CI tool unchanged.
- **Issues are plain data.** Each issue refers to its element by a unique CSS selector, never by a DOM node, so audit results live in Redux and survive re-audits.
- **Audits run in time slices.** Rules need the live DOM, so they run on the main thread, but the scheduler yields to the browser every ~12 ms and a newer edit aborts a stale audit.
- **One audited document.** Only the workbench's preview is audited. Simulate renders its own copy, so nothing a lens does can reach the audit.
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

**Scoring.** Each rule owns a share of the score in proportion to its severity weight (critical 10, serious 6, moderate 3, minor 1). A rule with _n_ issues loses 1 − 0.5ⁿ of its share, so the first issue costs half and one noisy rule can never drive the score to zero. Text on images or gradients is listed for manual review and is not scored.

## Milestone status

Milestones 1 (scaffold, first audit) and 2 (rule packs, contrast and fixes, all eleven core rules, overlays, sliced audits, report) are complete. Milestone 3 work so far: the Simulate page (colour-vision, low-vision and 200% text lenses, the tab-order list and the screen-reader view), the Learn guides, keyboard shortcuts, share links and file import. Still to come: CodeMirror editors.
