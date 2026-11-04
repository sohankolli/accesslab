# Click-only controls: evaluation report

Model version 1.0.0. This report compares two training runs on the same Tranco top-1,000 crawl. The only difference between them is how rows from pages with delegated (document-level) click listeners were filtered:

- **Old**: the previous run (`data/tranco-run-output/reports/metrics.json`). It kept every positive label but dropped only the _negative_ labels from delegated pages.
- **New**: the corrected run (`data/tranco-run-output-fixed/reports/metrics.json`). It drops _every_ row from delegated pages, whatever its label.

Both runs used the same feature code, model settings, seeds and training script. The label audit described below is automated and must not be mistaken for an independent manual review.

## Why the filter was changed

On a delegated page a single document-level listener handles clicks for many elements, so a `0` label there may be wrong. That was the reason for removing delegated negatives. But the old filter decided what to keep by looking at the label, and that created a shortcut:

| Raw crawl rows      | Positive | Negative |
| ------------------- | -------: | -------: |
| Delegated pages     |    8,691 |  290,172 |
| Non-delegated pages |       60 |    9,594 |

The old filter therefore kept 8,691 positives from delegated pages and only 60 from other pages, while every negative it kept came from a non-delegated page. A model could score well just by recognising the kind of page an element sits on, without learning whether the element itself is a click-only control. **The old metrics therefore overstate how well the model works and should not be cited.** The corrected filter keeps or drops a page as a whole, so the label can no longer be read off the page type. This matches what `train/train.py` does by default without `--keep-delegated`.

## Data

| Item                    | Old                                                        | New                                                                     |
| ----------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| Page records            | 1,407: 879 used, 370 errors, 38 robots, 120 failed scripts | same                                                                    |
| Filter                  | all positives + non-delegated negatives                    | non-delegated pages only                                                |
| Contributing sites      | 450                                                        | 136                                                                     |
| Candidate rows          | 18,345                                                     | 9,654                                                                   |
| Positives               | 8,751 (47.7%)                                              | 60 (0.62%)                                                              |
| Sites with any positive | not recorded                                               | 13 (capcut.com alone has 32)                                            |
| Train split             | 315 sites, 12,742 rows, 6,118 positives                    | 95 sites, 5,853 rows, 48 positives                                      |
| Calibration split       | 68 sites, 3,935 rows, 1,311 positives                      | 20 sites, 1,193 rows, 6 positives (2 sites: www.gov.uk, service.gov.uk) |
| Test split              | 67 sites, 1,668 rows, 1,322 positives                      | 21 sites, 2,608 rows, 6 positives (2 sites: t.me, mega.co.nz)           |

The split is by website, so no site appears in more than one partition. All examples come from the Tranco crawl category; this is not a representative evaluation across industries or site types. The dataset and crawl outputs remain local and are not committed.

## Results on the held-out test websites

PR-AUC values are shown with their 95% site-bootstrap interval. In the new test set, random guessing would give a PR-AUC of about 0.002 (6 positives in 2,608 rows).

| Model                                | Old PR-AUC           | New PR-AUC           | Old precision / recall | New precision / recall | Old ECE | New ECE |
| ------------------------------------ | -------------------- | -------------------- | ---------------------- | ---------------------- | ------- | ------- |
| Rule: pointer cursor and not native  | 0.8330 (0.675–0.948) | 0.0086 (0.001–0.250) | 1.0000 / 0.1952        | 0.0149 / 0.5000        | —       | —       |
| Gradient boosting, element only      | 0.9848 (0.957–0.998) | 0.5246 (0.014–1.000) | 0.9079 / 0.9622        | not reached¹           | —       | —       |
| Gradient boosting with neighbourhood | 0.9855 (0.955–0.999) | 0.5032 (0.002–1.000) | 0.9045 / 0.9531        | not reached¹           | 0.0745  | 0.0024² |
| SIGN graph network (exported)        | 0.9708 (0.915–0.997) | 0.1761 (0.003–0.793) | 0.8925 / 0.9486        | not reached¹           | 0.0883  | 0.0624  |

¹ No threshold reached the 0.90 precision target on the calibration sites, which hold only 6 positives. Precision and recall at an operating threshold are therefore not reported.
² A low ECE is expected when almost every label is 0, and says little about how well the model ranks positives.

| Other result                               | Old                    | New                                 |
| ------------------------------------------ | ---------------------- | ----------------------------------- |
| SIGN test PR-AUC per seed (0, 1, 2)        | 0.9700, 0.9750, 0.9733 | 0.1761, 0.5028, 0.5042 (mean 0.394) |
| SIGN without class-name words (1 seed)     | 0.9688                 | 0.1077                              |
| SIGN without neighbourhood (1 seed)        | 0.9764                 | 0.4696                              |
| Held-out sources: SIGN / neighbourhood GBT | 0.9108 / 0.9678        | 0.3741 / 0.5029                     |
| Held-out sources: test rows / positives    | 4,707 / 1,905          | 1,598 / 6                           |
| SIGN parameters                            | 40,705                 | 40,705                              |

The shipped seed (seed 0 in the new run) was chosen on the calibration sites. Its test score of 0.18 is much lower than seeds 1 and 2 (about 0.50), which shows how much a choice made on 6 calibration positives can swing the result.

**How to read the new numbers.** Every new test score rests on 6 positive elements from 2 websites, and both intervals for the gradient-boosting models run from close to 0 up to 1.0. The new run is enough to show that the old scores were inflated, but too small to measure how good the model is. The scores are better than chance, yet none of these models, or the differences between them, are established.

## Ship gate

| Condition                                 | Old (SIGN)                             | New (SIGN)                            |
| ----------------------------------------- | -------------------------------------- | ------------------------------------- |
| Precision ≥ 0.90                          | 0.8925 — Fail                          | not reached — Not met                 |
| Beats best gradient boosting              | 0.9708 vs 0.9855 — Fail                | 0.1761 vs 0.5246 — Not met            |
| Calibration error (ECE) ≤ 0.05            | 0.0883 — Fail                          | 0.0624 — Not met                      |
| File ≤ 1 MB                               | 169,515 bytes — Pass                   | 169,515 bytes — Pass                  |
| 2,000+ elements in the Web Worker ≤ 50 ms | 10 ms median for 2,664 elements — Pass | 8 ms median for 2,664 elements — Pass |

Both runs fail the ship gate. The neighbourhood gradient-boosting fallback also fails, because it has no threshold that meets the precision target. `defaultOn` must stay `false`. The new run's model, as selected by `train.py` on the calibration split, is the one now shipped in `public/models/`.

## Errors of the new model

The new run has no calibrated operating threshold, so the error samples in `data/tranco-run-output-fixed/reports/errors.json` use the fallback threshold of 0.5: 50 sampled false positives and 3 false negatives. These samples have not been reviewed manually. The old run's samples (`data/tranco-run-output/reports/false-*-review.csv`) came from the confounded data and should not be used to find recurring error patterns.

## Label quality and remaining checks

- **Automated label audit:** 300 labels were sampled; 188 were judged and 112 marked unsure, and none of the 188 judged was marked wrong. Only 4 of the judged labels were positive. This was done on the old corpus and does not establish positive-label quality.
- **Manual owner review:** not completed. Do not describe the automated audit as a manual hand-check.
- **Too few trustworthy positives:** 99% of the positives found in the crawl are on delegated pages, where the negative labels cannot be trusted. Collecting more usable positives is the main blocker. Options include crawling more sites, or labelling delegated pages per element (for example by checking which elements the delegated handler actually responds to) so that those pages can be used again.

## Limitations and reproducibility

- The new corpus has 136 sites, but only 13 of them contain any positive, and one site provides more than half of all positives.
- All examples come from the Tranco crawl category. Coverage of other site types and frameworks has not been established (the new corpus has no Vue or Angular rows).
- The dataset and raw crawl outputs are not committed. To rebuild: run `node filter_tranco_training_data.cjs` and `node filter_tranco_snippets.cjs` from `ml/`, then `train/train.py --data data/crawl-tranco-train` (see `ml/README.md`).
- The optional GraphSAGE comparison was not implemented.
- The model stays advisory and switched off by default until every ship gate passes and the manual label and error reviews are complete.
