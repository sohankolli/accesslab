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
   The filtering scripts create the prepared training corpus under data/crawl-tranco-train/. The filter drops every row from pages with delegated (document-level) click listeners, whatever its label, because those labels cannot be trusted. An earlier version dropped only the delegated negatives, which made the page type a stand-in for the label; see reports/evaluation.md for the effect.

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
Important audit distinction: the current reports/label-handcheck.json values describe an automated Playwright/CDP audit, not a completed independent manual owner review. The automated audit sampled 300 labels: 188 were judged, 112 were unsure, and none of the 188 judged labels was marked wrong. Only four judged examples were positive, so this does not establish the positive-label error rate. The independent manual review is still pending. 3. Train, evaluate and export
The current run was performed from the ml/ directory using the prepared Tranco corpus:
python .\train\train.py `  --data .\data\crawl-tranco-train`
--out .\data\tranco-run-output\models `  --reports .\data\tranco-run-output\reports`
--fixtures .\data\tranco-run-output\fixtures `  --corpus-note "Tranco top-1000 crawl; retained direct positive labels and non-delegated negative labels; reduced single-seed ablations"`
--keep-delegated
The training command writes its run-specific model artifacts, reports and parity fixtures under data/tranco-run-output/. The generated model/report artifacts are then used to update the committed app artifacts under ../public/models/ and the model-card notes. Do not commit the crawl data, snippets, virtual environment or run cache.

The training pipeline includes:

- Split: website-level 70/15/15 split, with no site shared between train, calibration and test.
- Baselines: cursor rule, gradient boosting on element features, and gradient boosting with neighbourhood features.
- Graph network: SIGN model training with multiple seeds and ablations for class-name cues and neighbourhood features.
- Source holdout: an additional evaluation that holds out entire sources.
- Calibration and thresholds: temperature scaling and threshold selection using calibration sites, not the test set.
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
   The current browser benchmark measured the shipped model at 10 ms median over 10 runs for 2,664 elements.
   Current Tranco experiment: results and limitations
   Dataset and split

- The top-1,000 Tranco crawl produced 1,407 page records: 879 pages were used, 370 errored, 38 were excluded by robots rules and 120 had failed scripts.
- The prepared corpus contains 18,345 candidate rows from 450 unique sites: 8,751 positives and 9,594 negatives.
- The site-disjoint split contains 315 training sites, 68 calibration sites and 67 test sites. The corresponding row counts are 12,742, 3,935 and 1,668.
- The evaluation is based on the Tranco crawl category. It should not be treated as representative performance across all industries, frameworks or types of websites.
- Labels come from automated event-listener and React-handler probing. Delegated listeners and ancestor-level interactions remain possible sources of label noise.
  Test metrics
  Model / result PR-AUC Precision Recall ECE
  Shipped SIGN model 0.9708 0.8925 0.9486 0.0883
  Neighbourhood GBT baseline 0.9855 0.9045 0.9531 0.0745

On the stricter held-out-source evaluation, SIGN achieved PR-AUC 0.9108, compared with 0.9678 for the neighbourhood GBT baseline.

The shipped SIGN test produced 1,254 true positives, 151 false positives and 68 false negatives. The false-positive and false-negative samples have been generated for review, but the requested manual inspection of up to 50 examples of each type has not been completed.
Shipping gates
The current SIGN artifact passes two of the five stated gates and fails three:

- Pass — model size: 169,515 bytes, below the 1 MB limit.
- Pass — browser latency: 10 ms median for 2,664 elements, below the 50 ms limit.
- Fail — precision: 0.8925, below the 0.90 requirement.
- Fail — baseline comparison: SIGN PR-AUC 0.9708 is below the neighbourhood GBT baseline at 0.9855.
- Fail — calibration: ECE 0.0883 is above the 0.05 requirement.
  Therefore, defaultOn must remain false. The model is advisory and must not be described as having passed the production ship gates. The committed manifest currently contains the SIGN model; the fact that its artifact is present does not mean it is approved to be enabled by default.
  Label audit and remaining work
- The automated 300-label audit judged 188 samples, left 112 unsure and marked zero of the judged samples wrong. Only four judged samples were positive. This is not a manual owner hand-check and is not sufficient to claim that labels have been independently validated.
- Manually inspect the false-positive and false-negative samples (up to 50 of each) and record the findings.
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
- Delegated negative labels were filtered during preparation of the current training corpus. Do not reuse the old 40,874-element exclusion figure from the historical stand-in experiment as a statistic for the Tranco dataset.
- The current model results are not a completed manual label audit or a production approval. Keep model suggestions switched off by default until all ship gates and the remaining manual checks are satisfied.
- The custom GBT ONNX export path is retained because the installed skl2onnx version did not directly support the project's scikit-learn gradient-boosting export. Its numerical parity should continue to be covered by the model tests.
