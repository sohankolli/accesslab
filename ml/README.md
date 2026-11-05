ml/: the click-only controls model, offline
This folder builds the model behind AccessLab's “Possibly click-only” suggestions: elements that appear clickable but are not keyboard-accessible native controls. It covers crawling, label generation, training, evaluation and export. Nothing in this folder is served directly to users; the app loads the model artifacts written under public/models/.

The feature is specified in AccessLab: click-only controls, feature and model specification (v1.0). This README describes the pipeline and the current Tranco-derived experiment. Measured results are also recorded in [`reports/evaluation.md`](reports/evaluation.md).
Layout
ml/
crawler/ two-pass labeller (Playwright + DevTools Protocol), crawl CLI, robots.txt, Tranco list
corpus/ historical stand-in corpus tools (pinned GitHub sources and CDN stand-ins)
labels/ manual hand-check sheet/scoring and automated click-probe/audit tools
train/ data loading and site split, models, training/evaluation/export, model-card generation
reports/ measured results and audit reports
data/ crawl output and caches (never committed)
The feature code is not here. src/engine/ml/nodeFeatures.js and graph.js are the app's files. The crawler injects the same feature code into pages so training and the app compute the features consistently.
Setup
Node.js 22 and Python 3.12 were used for the current Windows development run. The pipeline also requires the Python packages listed in train/requirements.txt and Playwright Chromium.
cd ml
npm install
npx playwright install chromium
python -m venv .venv
Activate the virtual environment before installing the requirements. On Windows PowerShell:
.\.venv\Scripts\Activate.ps1
python -m pip install -r .\train\requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu
On Linux/macOS, activate it with source .venv/bin/activate instead.
Run it

1. Crawl and prepare the Tranco data
   Download a Tranco list from https://tranco-list.eu/ as tranco.csv, then run these commands from the ml/ directory:
   node crawler/tranco.mjs tranco.csv --limit 1000
   node crawler/crawl.mjs --sites data/sites.json --out data/crawl-tranco --concurrency 2
   node filter_tranco_training_data.cjs
   node filter_tranco_snippets.cjs
   The filtering scripts create the prepared training corpus under data/crawl-tranco-train/. The filter drops every row from pages with delegated (document-level) click listeners, whatever its label, because those labels cannot be trusted. It also drops landmarks and page regions (`<main>`, `<header>`, `<footer>`, `<nav>`, `<aside>`, `<form>`, `<search>`, `<section>` and the matching roles), which stopped being candidates after this crawl; it uses the app's own rule (`isLandmarkMarkup` in src/engine/ml/nodeFeatures.js) on each element's stored start tag. An earlier version dropped only the delegated negatives, which made the page type a stand-in for the label; see reports/evaluation.md for the effect.

The historical GitHub stand-in commands remain available for older experiments, but that corpus was not used for the current model:
node corpus/fetch.mjs --root data/corpus
node corpus/discover.mjs --root data/corpus
node crawler/crawl.mjs --sites data/sites.json --corpus data/corpus --out data/crawl
Each page is loaded twice:

1. Scripts on: candidate elements are labelled positive when Chrome reports a relevant event listener through DOMDebugger.getEventListeners, or React reports an onClick-style prop. Otherwise they are labelled negative.
2. Scripts off: the page is loaded as AccessLab's sandboxed preview sees it, and the app's feature code computes 552 numeric features per candidate (92 features across six element/neighbourhood views).
   The two passes are joined by element number.

The crawler is designed to keep collection limited:

- It visits public pages, obeys robots.txt, and crawls one page at a time per site.
- It does not log in or submit forms.
- rows.jsonl contains numeric features and labels.
- snippets.jsonl contains the start of each element's HTML and is retained locally for review and error analysis.
- Pages where scripts failed to load are excluded from model training because their event handlers may be missing.
- Crawl output can be stopped and resumed.

2. Review the labels
   The manual review workflow is:
   node labels/sheet.mjs

# Open labels/review/handcheck.csv, inspect each page and element,

# test with a mouse and keyboard, then enter correct, wrong or unsure.

node labels/score.mjs
node labels/probe.mjs
Important audit distinction: the current reports/label-handcheck.json values describe an automated Playwright/CDP audit, not a completed independent manual owner review. The sheet from `node labels/sheet.mjs` (300 random labels) was filled in by `node labels/audit.mjs`, which re-checks each element in the live page through the DevTools Protocol (its own listeners and React handlers, its ancestors' and any document-level listeners) and marks it correct, wrong or unsure; `node labels/score.mjs` then counted the verdicts. The automated audit sampled 300 labels: 188 were judged, 112 were unsure, and none of the 188 judged labels was marked wrong. Only four judged examples were positive, so this does not establish the positive-label error rate. The result is about label accuracy, so it still holds after the filter change (filtering removes rows, it does not change labels), but it does not fix the small number of positives. The independent manual review is still pending.

3. Train, evaluate and export
   The current run was performed from the ml/ directory using the prepared Tranco corpus:

```
python train/train.py --data data/crawl-tranco-train \
  --out data/tranco-run-output-fixed/models \
  --reports data/tranco-run-output-fixed/reports \
  --fixtures data/tranco-run-output-fixed/fixtures \
  --corpus-note "Tranco top-1,000 crawl. Every row from pages with document-level (delegated) click listeners was removed, whatever its label."
```

The training command writes its run-specific model artifacts, reports and parity fixtures under data/tranco-run-output-fixed/. The model, manifest and parity fixture train.py selected are then copied to ../public/models/ and ../tests/ml/fixtures/, `python train/card.py --out ../public/models --reports reports` adds the model-card notes, and `npm run ml:bench` measures latency. Do not commit the crawl data, snippets, virtual environment or run cache.

The training pipeline includes:

- Split: website-level 70/15/15 split, with no site shared between train, calibration and test. The test sites are kept apart and scored once, at the end. The training and calibration sites together are the development sites.
- Candidates: SIGN graph network with seeds 0, 1 and 2, gradient boosting on element features, and gradient boosting with neighbourhood features. The cursor rule is reported for comparison only.
- Model selection rule (fixed before running): 5-fold cross-validation grouped by website on the development sites, so no site is in both the training and the validation part of a fold. Every candidate gives out-of-fold predictions; the shipped model is the candidate with the highest out-of-fold PR-AUC (ties go to the earlier candidate in the list above). The test set is never used to choose. Inside each fold, a few training sites are held back for early stopping (SIGN) and the small grid (gradient boosting), so a validation fold never influences its own predictions.
- Calibration: temperature scaling fitted on the chosen model's out-of-fold predictions. The chosen model is then retrained on all development sites for shipping (SIGN for the median best epoch across folds; gradient boosting with the grid setting chosen most often).
- Threshold rule (fixed before running): on the chosen model's calibrated out-of-fold predictions, the lowest threshold whose precision is at least 50%, with at least 5 elements flagged. If no threshold reaches 50%, the model ships with the threshold "not reached": when switched on, the Workbench says "The model is not accurate enough yet to make suggestions" and makes none. The bar is not lowered to get suggestions.
- Ablations: SIGN without class-name cues and without neighbourhood features, one seed each.
- Source holdout: an additional evaluation that holds out entire sources.
- Test: PR-AUC, site-bootstrap intervals, precision, recall, ECE, reliability data and error samples.
- Export and parity: ONNX export and a 50-row fixture for comparing the training model with the browser runtime.

4. Tests and browser benchmark
   Run the Python tests from ml/:
   python -m pytest .\train\tests -q
   Run the application tests, lint, build and browser benchmark from the repository root:
   cd ..
   npm test -- --run
   npm run lint
   npm run build
   npm run ml:bench
   The current browser benchmark measured the shipped model at 11 ms median over 10 runs for 2,664 elements, in headless Google Chrome 151 on a 12th Gen Intel Core i7-1255U (12 logical cores).

## Current Tranco experiment: results and limitations

**Read this first.** The model is experimental and switched off by default. Its suggestions are advisory and never change the score.

### Earlier results were inflated by label leakage

An earlier version of `filter_tranco_training_data.cjs` dropped rows from delegated pages only when their label was 0, and kept every positive. Counting the raw crawl by page type and label showed what that did: it kept 8,691 positives from delegated pages and only 60 from other pages, while every negative it kept came from a non-delegated page. The page type almost gave the label away, so the earlier scores measured that shortcut, not the model. The filter now drops whole delegated pages, whatever their labels, and every number below comes from that corrected run. The earlier numbers appear only in the "old" column of [`reports/evaluation.md`](reports/evaluation.md).

### Dataset and split

- The top-1,000 Tranco crawl produced 1,407 page records: 879 pages were used, 370 errored, 38 were excluded by robots rules and 120 had failed scripts.
- The prepared corpus contains 9,654 candidate rows from 136 sites. Only **60 are positives, from 13 sites**; one site (capcut.com) has 32 of them.
- The site-disjoint split has 95 training sites (5,853 rows, 48 positives), 20 calibration sites (1,193 rows, 6 positives from 2 sites) and 21 test sites (2,608 rows, **6 positives from 2 sites**).
- All examples come from the Tranco crawl category. They are not representative of all industries, frameworks or types of websites.
- Labels come from automated event-listener and React-handler probing. Handlers on ancestors remain a possible source of label noise.

### Test metrics

With 6 test positives from 2 sites, the 95% site-bootstrap intervals cover nearly the whole range from 0 to 1. **This run cannot measure how good the model is.**

| Model                                | PR-AUC (95% interval) | Precision   | Recall      | ECE   |
| ------------------------------------ | --------------------- | ----------- | ----------- | ----- |
| Shipped SIGN graph network           | 0.176 (0.003–0.793)   | not reached | not reached | 0.062 |
| Gradient boosting, element only      | 0.525 (0.014–1.000)   | not reached | not reached | –     |
| Gradient boosting with neighbourhood | 0.503 (0.002–1.000)   | not reached | not reached | –     |
| Rule: pointer cursor and not native  | 0.009 (0.001–0.250)   | 1.5%        | 50.0%       | –     |

No threshold reached 90% precision on the 6 calibration positives, so precision and recall at a target-precision threshold are "not reached" and the precision gate is not met. Separately from the ship gate, the app makes suggestions at an operating threshold chosen by one fixed rule: the threshold with the best F1 on the calibration websites (the test websites are never used to choose it). That threshold is 0.00064, because the model ranks the calibration positives no better than chance, so the best F1 comes from flagging almost everything. On the test websites it flags 2,074 of 2,608 elements: precision 0.3% (95% interval 0.0% to 0.5%) and recall 100% (6 of 6; 95% interval 100% to 100%). Every suggestion is labelled low confidence. The shipped model is the SIGN graph network trained with seed 2. The pipeline ships it because the gradient-boosting fallback, which replaces it only when it passes precision and calibration, has no threshold that reaches 90% precision. Seed 2 was chosen as the seed with the highest PR-AUC on the calibration sites (0.0039; all three seeds were below the 0.005 share of positives there), and it is the weakest of the three on the test sites: PR-AUC 0.176, against 0.504 for seed 0 and 0.503 for seed 1. Seeds are not switched by test score. On the stricter held-out-source evaluation (1,598 rows, 6 positives), SIGN scored PR-AUC 0.374 and the neighbourhood baseline 0.503.

### Shipping gates

The shipped SIGN artifact passes two of the five gates:

- Not met: precision ≥ 0.90. No threshold reached it ("not reached").
- Not met: beats the best gradient-boosting baseline (0.176 vs 0.525 PR-AUC).
- Not met: calibration error ≤ 0.05 (0.062).
- Met: model size, 169,515 bytes, below the 1 MB limit.
- Met: browser latency, 11 ms median for 2,664 elements, below the 50 ms limit.

`defaultOn` therefore stays false. The fallback baseline was not shipped, because it also has no threshold that reaches the precision target.

### Label audit and remaining work

- The automated 300-label audit judged 188 samples, left 112 unsure and marked zero of the judged samples wrong. Only four judged samples were positive. This is not a manual owner hand-check and is not sufficient to claim that labels have been independently validated.
- Collect more trustworthy positives. This is the main blocker: 99% of the positives found in the crawl are on delegated pages.
- Next step: label elements on delegated pages one by one, so those pages can be used again.
- Manually inspect the false-positive and false-negative samples in data/tranco-run-output-fixed/reports/errors.json, taken at the operating threshold, and record the findings.
- Evaluate additional site types and sources before making claims about broader generalisation.
- The optional GraphSAGE comparison was not implemented.
- The dataset and raw snippets are not committed or published as a release. Rebuild them using the crawl and preparation steps above.
  The model files
- public/models/clickables-v1.onnx is the model artifact loaded by the app. It accepts x (n × 552) and returns p (n), a calibrated probability.
- public/models/clickables-v1.json is its manifest. It records the feature version, threshold, measured metrics, gate results, model-card fields and defaultOn value.
- public/models/clickables-v1-reliability.svg is the reliability diagram used by the model card.
- Intermediate training artifacts and datasets under ml/data/ are local outputs and are not committed.
  The app refuses a manifest whose featureVersion or input size differs from its own feature code. Change FEATURE_VERSION in both train/train.py and src/engine/ml/manifest.js whenever a feature changes.
  Historical implementation notes
- The GitHub stand-in corpus was used in an earlier experiment only. It is not the source of the current Tranco-trained results.
- Every row from delegated pages is removed during preparation of the current training corpus. Do not reuse the old 40,874-element exclusion figure from the historical stand-in experiment as a statistic for the Tranco dataset.
- The current model results are not a completed manual label audit or a production approval. Keep model suggestions switched off by default until all ship gates and the remaining manual checks are satisfied.
- The custom GBT ONNX export path is retained because the installed skl2onnx version did not directly support the project's scikit-learn gradient-boosting export. Its numerical parity should continue to be covered by the model tests.
