# Click-only controls: evaluation report

Model version 1.0.0. Every number below comes from `metrics.json`, `bench.json` and
`label-probe.json` in this folder, which `train/train.py`, `npm run ml:bench` and
`labels/probe.mjs` wrote. Nothing was typed in by hand except the reading of the errors.

## Data

|                                           |                                                                                                                                                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source                                    | Stand-in corpus: 25 public GitHub repositories of hand-written websites, pinned commits (`corpus/sources.json`), served locally. The Tranco crawl could not run: the build machine had no access to the public web. |
| Pages crawled                             | 1,174 (113 dropped because one of their scripts failed to load, so their handlers would be missing)                                                                                                                 |
| Pages with document-level click listeners | Left out: 40,874 elements, 68 of them labelled positive. Their 0 labels cannot be trusted (event delegation).                                                                                                       |
| Used                                      | 15,006 candidate elements from 752 websites in 16 sources; 640 click-only controls (4.3%)                                                                                                                           |
| Split, by website                         | train 526 sites (457 positives) · calibration 113 sites (89) · test 113 sites (94)                                                                                                                                  |

The split is stratified by "site has a positive", and among 200 seeds the one with the most even
share of positives was kept (seed 94). The choice looked only at label counts, never at a model.

## Results on the test websites

| Model                                           | PR-AUC | Precision | Recall |
| ----------------------------------------------- | ------ | --------- | ------ |
| Rule: pointer cursor and not native             | 0.542  | 0.594     | 0.904  |
| Gradient boosting, element only                 | 0.871  | 0.755     | 0.755  |
| Gradient boosting with neighbourhood            | 0.876  | 0.930     | 0.702  |
| SIGN graph network                              | 0.936  | 0.759     | 0.904  |
| SIGN without class-name words (mean of 3 seeds) | 0.906  | –         | –      |
| SIGN without neighbourhood (mean of 3 seeds)    | 0.685  | –         | –      |

Thresholds were chosen on the calibration websites for 90% precision. Each model's precision
and recall are at its own threshold.

What this says, with the caveat that the test set holds only 94 positives:

- **Machine learning is needed.** The cursor rule finds most click-only controls, but 4 in 10 of
  its flags are wrong.
- **Context is what helps.** Without the neighbourhood views the network drops from 0.936 to
  0.685. Gradient boosting barely changes, because its trees can already combine the context
  columns.
- **Class-name words matter less than expected.** Removing them costs about 0.03.
- **The graph network is unstable on this much data.** Trained with three seeds, it scored
  0.936, 0.568 and 0.547 on the test sites (mean 0.684). The shipped seed was chosen on the
  calibration sites and happened to be the best on test, so "beats gradient boosting" holds for
  that seed only.
- **It does not transfer well.** On a stricter test that held out whole sources (2,578
  elements, 295 positives), the network scored 0.727 and gradient boosting 0.876.

## Ship gate

| Condition                                 | Graph network                           | Gradient boosting (fallback, calibrated) |
| ----------------------------------------- | --------------------------------------- | ---------------------------------------- |
| Precision ≥ 0.90                          | 0.759 **fail**                          | 0.930 pass (95% interval 0.39 to 1.00)   |
| Beats best gradient boosting              | 0.936 vs 0.876 pass (shipped seed only) | not applicable: it is the baseline       |
| Calibration error ≤ 0.05                  | 0.110 **fail**                          | 0.041 pass                               |
| File ≤ 1 MB                               | 166 KB pass                             | 323 KB pass                              |
| 2,000+ elements in the Web Worker ≤ 50 ms | 28 ms median pass                       | 15 ms median pass                        |

The graph network missed the gate. Following the spec's fallback, the calibrated
gradient-boosting model ships through the same worker and interface (temperature 3.74, threshold
0.514). The "beats gradient boosting" condition cannot hold for the baseline itself, so it is
**switched off by default**. Users can switch it on under the rule packs.

Latency was measured by `npm run ml:bench` in the app's own Web Worker on a 2,664-element page:
the median of 10 runs, in headless Chromium on a 2-vCPU cloud VM with no CPU throttling.

The ONNX file gives the same probabilities as scikit-learn to within 9 × 10⁻⁸ on every test row.
`tests/ml/modelParity.test.js` checks onnxruntime-web against 50 of those rows.

## Errors of the shipped model (read by hand)

There were 5 false positives and 28 false negatives at the shipped threshold, so all of them
were read, not 50 of each.

- **False positives.** All 5 are product and brand images with a pointer cursor on one shop
  page.
- **Game boards.** Chess squares and similar grids of plain divs, with no cursor and no
  button-like class, scored just under the threshold (0.48 against 0.51).
- **Image-only cards.** The rock, paper and scissors choices have no text and no class word to
  go on.
- **Containers.** An FAQ wrapper, a list and a `<main>` each carry one listener for their
  children. This is label noise of the delegation kind, at container level.
- **A plain div with an inline `onclick`.** It had no cursor and no button-like class, and was
  missed.

## Label quality

- **Hand-check.** Not done yet. `labels/sheet.mjs` draws the 300 random labels and
  `labels/score.mjs` scores them. This is the owner's task.
- **Automatic probe** (`labels/probe.mjs`). 287 random labelled elements were clicked in the
  live pages, and label and reaction disagreed for 13.9% (16.4% on the 73 from pages used for
  training).
- **Reading the probe's disagreements.** On the pages used for training there were 12: hover
  effects, ticking timers, a list item whose content is a button, and 2 unclear cases. None was
  clearly a missed click-only control, so 16% is a loose upper bound, not the error rate.
