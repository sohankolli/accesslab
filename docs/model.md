# Model suggestions: click-only controls

An experimental model that flags elements which look clickable but are not controls. For a short overview, see the [README](../README.md).

## What the model does

Many sites build buttons from a `<div>` or `<span>` with a click handler. A mouse user never notices, but a keyboard cannot reach them and a screen reader does not announce them (WCAG 2.1.1 and 4.1.2). The preview runs with scripts off, so those handlers never attach and the rules cannot see the problem.

A model reads what is left in the page: 92 cues per element (tag, pointer cursor, inline `on…` attributes, tabindex, background, rounded corners, size, text length, icons inside, and class-name words). It reads them for the element and for its parent, children, siblings, grandparent and grandchildren.

- **Possibly click-only.** Suggestions appear in their own group in the findings list, numbered and pinned on the preview, with a confidence: "Looks like a button but is not one (84%)".
- **Why we think so.** An open suggestion lists the cues that mattered most. These are measured by rescoring the element with one group of cues removed at a time.
- **Fix.** Use a `<button>`, or add `role="button"`, `tabindex="0"` and an Enter and Space handler. Both are shown as code you can copy.
- **Not an issue.** Hides a suggestion and keeps a record in this browser (the element's 552 numbers, no page text). The records can be exported as JSON to retrain the model.
- **Switch.** "Suggestions from the model" sits under the rule packs. Suggestions never change the score, the history or the report.
- **Model card.** The model card at `/learn/model-card` shows what the model was trained on, how it measured on websites it never saw, where it fails and when not to trust it. Every number on it is read from the model's manifest.

The model runs in a Web Worker with ONNX Runtime Web. Its WebAssembly runtime is served by the app itself (`scripts/copy-ort-wasm.mjs`, run before `dev` and `build`), and the Content Security Policy allows `'wasm-unsafe-eval'` and `worker-src 'self'`. If the model cannot load, the switch says "Model suggestions are unavailable" and everything else works as before.

Try it with [`docs/click-only-demo.html`](click-only-demo.html). The page has four click-only controls, yet the rules score it 100, because they cannot see click handlers that scripts attach; that is the point of the page. The current model makes one suggestion on it, the "Choose Team" `<div>`, which is one of the four click-only controls; the other nine candidates stay below its threshold.

## Status

The model is experimental and switched off by default. Its suggestions are labelled low confidence and never change the score.

- **Earlier results were inflated by label leakage.** An earlier training filter dropped rows from pages with delegated (document-level) click listeners only when their label was 0, so the page type gave the label away. Filters since then keep or drop a page as a whole, by page facts only, never by label.
- **Framework-page rule.** The current filter keeps non-delegated pages and delegated pages built with React, Vue or Angular, which bind handlers on each element where the labeller sees them. Other delegated pages are dropped. The corpus grew from 55 positives on 136 sites to 5,372 positives on 313 sites. **The labels on the new React, Vue and Angular pages were not hand-checked**; the earlier automated audit covered non-delegated pages only.
- **One model type, negative sampling.** Only element-only gradient boosting (the previous model's type) was trained, by 5-fold cross-validation grouped by website on 285 development sites. Inside each training fold every positive was kept with at most 10 negatives per positive. Temperature (0.621) and threshold (0.906, the lowest with at least 50% out-of-fold precision) were set on the out-of-fold predictions.
- **New held-out set.** 28 newly added sites (23 React, 4 Vue, 1 Angular), fixed before training and scored once: 31,951 elements, 922 positives. PR-AUC 0.408 (95% interval 0.169–0.610), against 0.037 (0.026–0.066) for the previous model on the same set. At the threshold the model makes 17.8 suggestions per 1,000 elements, with precision 53% (24–79%) and recall 33% (13–53%). The held-out sites are the same kind of page as most of the new training data, so this does not show how the model does on other kinds of page.
- **Ship gate.** Met: size (283,067 bytes) and latency (21 ms median for 2,663 elements). Not met: precision ≥ 0.90 (53%), calibration error ≤ 0.05 (0.116) and "graph network beats gradient boosting" (no graph network was trained). `defaultOn` stays false.

The metrics and gate results are in [`ml/reports/evaluation.md`](../ml/reports/evaluation.md). The pipeline, dataset rebuild instructions and retraining steps are in [`ml/README.md`](../ml/README.md). Feature owner: Manasvi (branch `feature/ml-clickables`).

## Limitations

- Model suggestions are experimental and off by default. The model misses three of the five ship gates; on the new held-out set about half of its suggestions are correct. See [`ml/reports/evaluation.md`](../ml/reports/evaluation.md).
- The labels on delegated React, Vue and Angular pages were not hand-checked, and handlers on an ancestor can still make a label wrong. The automated 300-label audit (188 judged, none wrong, 112 unsure, only four positive) covered non-delegated pages only and is not an independent manual review.
- Calibration is rough (ECE 0.116), so read the confidence percentages as a ranking, not a probability.
- Vue (25 sites) and Angular (3 sites) are thin, and all sites come from the Tranco top 1,000.
