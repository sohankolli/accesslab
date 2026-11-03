# ml/: the click-only controls model, offline

This folder builds the model behind AccessLab's "Possibly click-only" suggestions: elements a
mouse can click but a keyboard cannot reach and a screen reader does not announce. It covers the
crawler, the labels, training, evaluation and export. Nothing here ships to users. The app only
loads what this pipeline writes to `public/models/`.

The feature is specified in _AccessLab: click-only controls, feature and model specification_
(v1.0). This README explains how to run each step and says where the delivered build differs
from the plan. Measured results are in [`reports/evaluation.md`](reports/evaluation.md).

## Layout

```
ml/
  crawler/   two-pass labeller (Playwright + DevTools Protocol), crawl CLI, robots.txt, Tranco list
  corpus/    the stand-in corpus: pinned GitHub sources, fetch, site discovery, CDN stand-ins
  labels/    hand-check sheet and scoring, automatic click probe
  train/     data loading and site split, models, training/evaluation/export, model card notes
  reports/   measured results (committed): metrics.json, evaluation.md, errors.json, ...
  data/      crawl output and caches (never committed)
```

The feature code is not here. `src/engine/ml/nodeFeatures.js` and `graph.js` are the app's own
files. The crawler injects them into every page it labels, so training and the app compute
features with the same code.

## Setup

Node 20+ and Python 3.11+.

```bash
cd ml
npm install                      # Playwright for the crawler
npx playwright install chromium  # or set CHROMIUM_PATH to an existing Chromium
python -m venv .venv && . .venv/bin/activate
pip install -r train/requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu
```

## Run it

### 1. Data

The plan uses the Tranco list of popular sites:

```bash
# download a list from https://tranco-list.eu/ as tranco.csv, then
node crawler/tranco.mjs tranco.csv --limit 1000      # -> data/sites.json
node crawler/crawl.mjs --sites data/sites.json --out data/crawl --concurrency 2
```

Or use the stand-in corpus, which is what this build was trained on:

```bash
node corpus/fetch.mjs --root data/corpus             # sparse clones at pinned commits + CDN libraries
node corpus/discover.mjs --root data/corpus          # -> data/sites.json (1,063 sites)
node crawler/crawl.mjs --sites data/sites.json --corpus data/corpus --out data/crawl
```

Each page is loaded twice:

1. **Scripts on.** Every candidate element is labelled 1 if Chrome reports a `click`,
   `mousedown`, `pointerdown` or `keydown` listener on it (`DOMDebugger.getEventListeners`) or
   React reports an `onClick`-style prop. Otherwise it is labelled 0.
2. **Scripts off.** The same DOM is reloaded at the same address, as AccessLab's sandboxed
   preview sees it, and the app's feature code computes 552 numbers per candidate.

The two passes are joined by element number.

The crawler respects the site and keeps data minimal:

- Public sites: robots.txt is obeyed, one page at a time per site, no logins or form
  submissions.
- `rows.jsonl` holds numbers only.
- `snippets.jsonl`, the start of each element's HTML, is kept locally for hand-checking and
  error analysis only.
- Pages where a script failed to load are dropped, because their handlers would be missing.
- The crawl can be stopped and resumed.

### 2. Check the labels

```bash
node labels/sheet.mjs            # labels/review/handcheck.csv: 300 random labels
# open each page, try the element with a mouse and a keyboard, fill the verdict column:
# correct, wrong or unsure
node labels/score.mjs            # reports/label-handcheck.json: error rate with a 95% interval
node labels/probe.mjs            # reports/label-probe.json: automatic click test (an upper bound)
```

### 3. Train, evaluate, export

```bash
python train/train.py --data data/crawl --out ../public/models --reports reports \
  --fixtures ../tests/ml/fixtures --corpus-note "$(cat data/corpus-note.txt)"
python train/card.py              # adds reports/model-card-notes.json to the manifest
cd .. && npm run build && npm run ml:bench   # latency in the app's Web Worker; sets defaultOn
```

`train.py` does all of the following on one fixed split:

- **Split.** Splits by website, 70/15/15, stratified.
- **Baselines.** Trains the three baselines: the cursor rule, gradient boosting on the element
  alone, and gradient boosting with the neighbourhood.
- **Graph network.** Trains the SIGN network with three seeds and two ablations (no class-name
  words, no neighbourhood).
- **Stricter split.** Runs an extra evaluation that holds out whole sources.
- **Calibration and thresholds.** Calibrates with temperature scaling and picks
  precision-first thresholds, both on the calibration sites.
- **Test.** Evaluates once on the test sites: PR-AUC with site-bootstrap intervals, precision
  and recall, ECE, a reliability diagram, a breakdown by framework and kind of site, and samples
  of the errors.
- **Ship decision.** Applies the ship gate, chooses the model to ship (the graph network if it
  passes, otherwise the calibrated baseline, as the spec's fallback says) and exports it to
  ONNX with the temperature folded in.
- **Outputs.** Writes the manifest, the reports and the 50-row parity fixture.

It takes about four minutes on two CPU cores.

```bash
python -m pytest train/tests      # split, masking, metrics, model size, temperature folding
npm test                          # labeller and Chromium/jsdom feature parity (needs Chromium)
```

## The model files

- `public/models/clickables-v1.onnx` is the shipped model, which takes `x` (n × 552) and returns
  `p` (n), a calibrated probability.
- `public/models/clickables-v1.json` is its manifest:
  - the feature version, the threshold and the measured metrics;
  - both gates;
  - the hand-written model card notes;
  - `defaultOn`, which is true only if every gate condition passed.
- `train/artifacts/clickables-graph.onnx` is the graph network, kept for comparison when it is
  not the shipped model. It is not committed: rerunning `train.py` recreates it.

The app refuses a manifest whose `featureVersion` or input size differs from its own feature
code. Change `FEATURE_VERSION` in both `train/train.py` and `src/engine/ml/manifest.js` whenever
a feature changes.

## What differs from the plan, and why

- **No Tranco crawl.** The build machine could reach only GitHub and package registries, not
  the public web. The same crawler ran on 25 GitHub repositories of real, hand-written sites
  instead. These are mostly small JavaScript projects and teaching examples, with almost no
  React and no commercial sites. The Tranco commands above are implemented, but they have not
  been run. Retrain on Tranco before trusting the numbers for production sites.
- **Delegated pages left out.** 40,874 elements on pages with a document-level click listener
  were excluded, because their 0 labels cannot be trusted. Most of them came from one source,
  the W3C ARIA examples.
- **The graph network did not pass the gate.** Its precision was 0.76 and its calibration error
  0.11, so the calibrated gradient-boosting baseline ships, switched off by default. Training is
  also unstable across seeds: PR-AUC on the test sites was 0.94, 0.57 and 0.55.
- **No 50 + 50 error sample.** The shipped model made only 5 false positives and 28 false
  negatives on the test sites, and all of them were read.
- **No hand-check yet.** The 300-label hand-check is a person's job. The tools are ready, and
  the model card says it is not done.
- **No GraphSAGE.** The optional GraphSAGE comparison was not done.
- **Dataset not published.** It is not committed or published as a release file. Rebuild it
  with the commands above. The corpus is pinned, so the rebuild is the same.
- **Custom tree export.** skl2onnx 1.20 cannot convert scikit-learn 1.9's gradient boosting, so
  `train/export_gbt.py` writes the trees as an ONNX `TreeEnsembleRegressor`. It matches
  scikit-learn to within 10⁻⁷.
