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

Try it with [`docs/click-only-demo.html`](click-only-demo.html). The page has four click-only controls, yet the rules score it 100, because they cannot see click handlers that scripts attach; that is the point of the page. The current model makes no suggestions on it: none of the page's 10 candidates reaches the model's threshold.

## Status

The model is experimental and switched off by default. Its suggestions are labelled low confidence and never change the score.

- **Earlier results were inflated by label leakage.** The earlier training filter dropped rows from pages with delegated (document-level) click listeners only when their label was 0. Counting the raw crawl by page type and label showed that it kept 8,691 positives from delegated pages and only 60 from other pages, while every negative it kept came from a non-delegated page, so the page type gave the label away. The filter now drops whole delegated pages, and every number here comes from that corrected run.
- **Too few positives to measure the model.** The corpus has 9,367 candidate rows from 136 sites, but only 55 trustworthy positives from 13 sites. The 21 test sites hold 6 positives from 2 sites, so the 95% intervals cover nearly 0 to 1 and this run cannot measure how good the model is.
- **How the model and threshold were chosen.** By 5-fold cross-validation grouped by website on the 115 development sites (49 positives), never on the test sites. The candidate with the highest out-of-fold PR-AUC ships: element-only gradient boosting (0.244). Its threshold, 0.111, is the lowest with at least 50% out-of-fold precision.
- **Test results.** PR-AUC 0.507 (0.004–1.000). On the 2,559 test elements the model makes 10 suggestions, 3 of them correct: precision 30% and recall 50% (3 of 6), each with a 95% interval from 0% to 100%.
- **Ship gate.** Not met: precision ≥ 0.90 (30%) and "graph network beats gradient boosting" (a gradient-boosting model ships). Met: calibration error (0.008), size (281,219 bytes) and latency (9 ms median for 2,663 elements).

The metrics and gate results are in [`ml/reports/evaluation.md`](../ml/reports/evaluation.md). The pipeline, dataset rebuild instructions and retraining steps are in [`ml/README.md`](../ml/README.md). Feature owner: Manasvi (branch `feature/ml-clickables`).

## Limitations

- Model suggestions are experimental and off by default. The corrected Tranco corpus has only 55 trustworthy positives from 13 sites (6 in the test set, from 2 sites), too few to measure how good the model is; on the test sites, 3 of its 10 suggestions are correct. Labels can still be wrong when a handler sits on an ancestor. An automated 300-label audit judged 188 examples and marked 112 unsure; it found no wrong labels among the judged examples, but only four judged examples were positive. This is not an independent manual owner review. The model ships switched off because it misses two of the five ship gates; see [`ml/reports/evaluation.md`](../ml/reports/evaluation.md).
- Next step: label elements on delegated pages one by one, so those pages can be used again.
