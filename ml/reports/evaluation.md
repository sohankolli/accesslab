# Click-only controls: evaluation report

Model version 1.0.0. This report compares three training runs on the same Tranco top-1,000 crawl:

- **Old**: the first run (`data/tranco-run-output/reports/metrics.json`). Its filter kept every positive label but dropped only the _negative_ labels from delegated pages.
- **Single split**: the corrected filter, which drops _every_ row from delegated pages, with every choice (model, seed, temperature, threshold) made on one calibration split of 20 sites holding 6 positives.
- **Cross-validated (current)**: the corrected filter, landmarks and page regions no longer candidates, and every choice made by 5-fold cross-validation grouped by website on the 115 development sites. This is the model shipped in `public/models/` (`ml/reports/metrics.json`).

The three runs use the same feature code. The label audit described below is automated and must not be mistaken for an independent manual review.

## Why the filter was changed

On a delegated page a single document-level listener handles clicks for many elements, so a `0` label there may be wrong. That was the reason for removing delegated negatives. But the old filter decided what to keep by looking at the label, and that created a shortcut:

| Raw crawl rows      | Positive | Negative |
| ------------------- | -------: | -------: |
| Delegated pages     |    8,691 |  290,172 |
| Non-delegated pages |       60 |    9,594 |

The old filter therefore kept 8,691 positives from delegated pages and only 60 from other pages, while every negative it kept came from a non-delegated page. A model could score well just by recognising the kind of page an element sits on, without learning whether the element itself is a click-only control. **The old metrics therefore overstate how well the model works and should not be cited.** The corrected filter keeps or drops a page as a whole, so the label can no longer be read off the page type.

## Why the selection method was changed

In the single-split run, every decision rested on a calibration split with only 6 positives from 2 sites. All three SIGN seeds ranked those positives no better than chance (calibration PR-AUC about 0.004, below the 0.005 share of positives), so the chosen seed was close to arbitrary, and a best-F1 threshold on that split flagged almost everything: 2,074 of 2,608 test elements, and all 11 candidates on the demo page, including `<main>`. The cross-validated run makes every choice on out-of-fold predictions for all 115 development sites (49 positives), and stops treating landmarks such as `<main>` as candidates.

## Data

| Item                    | Old                                                        | Single split                                         | Cross-validated (current)                                     |
| ----------------------- | ---------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------- |
| Page records            | 1,407: 879 used, 370 errors, 38 robots, 120 failed scripts | same                                                 | same                                                          |
| Filter                  | all positives + non-delegated negatives                    | non-delegated pages only                             | non-delegated pages only; no landmarks or page regions        |
| Contributing sites      | 450                                                        | 136                                                  | 136                                                           |
| Candidate rows          | 18,345                                                     | 9,654                                                | 9,367                                                         |
| Positives               | 8,751 (47.7%)                                              | 60 (0.62%)                                           | 55 (0.59%)                                                    |
| Sites with any positive | not recorded                                               | 13 (capcut.com alone has 32)                         | 13 (capcut.com alone has 32)                                  |
| Used for choices        | train 315 sites + calibration 68 sites                     | train 95 sites + calibration 20 sites (6 positives)  | 115 development sites in 5 folds (6,808 rows, 49 positives)   |
| Test sites              | 67 sites, 1,668 rows, 1,322 positives                      | 21 sites, 2,608 rows, 6 positives (t.me, mega.co.nz) | the same 21 sites, 2,559 rows, 6 positives (t.me, mega.co.nz) |

The cross-validated run keeps the single-split run's 21 test sites, frozen in `ml/train/test-sites.json`. The 49 fewer test rows are landmarks and page regions, none of them a positive. Every split is by website, so no site appears in more than one partition. All examples come from the Tranco crawl category; this is not a representative evaluation across industries or site types.

## Model selection (cross-validated run)

| Candidate                            | Out-of-fold PR-AUC | Threshold (50% out-of-fold precision) | Out-of-fold precision / recall |
| ------------------------------------ | -----------------: | ------------------------------------: | ------------------------------ |
| SIGN graph network, seed 0           |              0.207 |                                 0.588 | 50.0% / 18.4%                  |
| SIGN graph network, seed 1           |              0.207 |                                 0.876 | 52.9% / 18.4%                  |
| SIGN graph network, seed 2           |              0.156 |                                 0.752 | 50.0% / 14.3%                  |
| **Gradient boosting, element only**  |          **0.244** |                             **0.111** | 50.0% / 20.4%                  |
| Gradient boosting with neighbourhood |              0.240 |                                 0.141 | 52.4% / 22.4%                  |

The rule, stated in `ml/README.md` before the run: the candidate with the highest out-of-fold PR-AUC ships. Element-only gradient boosting ships, retrained on all 115 development sites, with the temperature (2.77) and threshold (0.111) set on its out-of-fold predictions. The candidates are close, and one fold holds 32 of the 49 development positives (all from capcut.com), so the choice is not clear-cut.

## Results on the held-out test websites

PR-AUC values are shown with their 95% site-bootstrap interval where one was recorded. Random guessing would give a PR-AUC of about 0.002 on the single-split and cross-validated test sets (6 positives in about 2,600 rows).

| Model                                | Old PR-AUC           | Single-split PR-AUC  | Cross-validated PR-AUC                     |
| ------------------------------------ | -------------------- | -------------------- | ------------------------------------------ |
| Rule: pointer cursor and not native  | 0.8330 (0.675–0.948) | 0.0086 (0.001–0.250) | 0.0086                                     |
| Gradient boosting, element only      | 0.9848 (0.957–0.998) | 0.5246 (0.014–1.000) | 0.5070 (0.004–1.000), shipped              |
| Gradient boosting with neighbourhood | 0.9855 (0.955–0.999) | 0.5032 (0.002–1.000) | 0.5100                                     |
| SIGN graph network                   | 0.9708 (0.915–0.997) | 0.1761 (0.003–0.793) | 0.5035 / 0.5036 / 0.5035 (seeds 0 / 1 / 2) |

| Shipped model at its threshold, on the test sites | Old                                  | Single split                     | Cross-validated (current)                     |
| ------------------------------------------------- | ------------------------------------ | -------------------------------- | --------------------------------------------- |
| Model                                             | SIGN, seed 1                         | SIGN, seed 2                     | gradient boosting, element only               |
| Threshold and its rule                            | 0.164 (90% precision on calibration) | 0.00064 (best F1 on calibration) | 0.111 (lowest with 50% out-of-fold precision) |
| Suggestions on the test elements                  | 1,405 of 1,668                       | 2,074 of 2,608                   | **10 of 2,559**                               |
| Precision (95% interval)                          | 0.8925 (0.744–0.990)                 | 0.29% (0.00%–0.52%)              | **30% (0%–100%)**: 3 of 10                    |
| Recall (95% interval)                             | 0.9486                               | 100% (100%–100%)                 | **50% (0%–100%)**: 3 of 6                     |
| Calibration error (ECE)                           | 0.0883                               | 0.0624                           | 0.0079¹                                       |
| Suggestions on `docs/click-only-demo.html`        | not measured                         | 11 of 11 candidates              | **0 of 10 candidates**                        |

¹ A low ECE is expected when almost every label is 0, and says little about how well the model ranks positives.

| Other result                               | Old             | Single split    | Cross-validated |
| ------------------------------------------ | --------------- | --------------- | --------------- |
| SIGN without class-name words (1 seed)     | 0.9688          | 0.1077          | 0.1278          |
| SIGN without neighbourhood (1 seed)        | 0.9764          | 0.4696          | 0.4608          |
| Held-out sources: SIGN / neighbourhood GBT | 0.9108 / 0.9678 | 0.3741 / 0.5029 | 0.0047 / 0.2556 |
| Held-out sources: test rows / positives    | 4,707 / 1,905   | 1,598 / 6       | 1,527 / 4       |

**How to read the cross-validated numbers.** Every test score rests on 6 positive elements from 2 websites, and every interval runs from close to 0 up to 1. The test scores were looked at only after the choice was made. They are enough to show that the model is not reliable yet, and too few to measure how good it is.

## Ship gate

| Condition                                 | Old                                    | Single split                           | Cross-validated (current)                              |
| ----------------------------------------- | -------------------------------------- | -------------------------------------- | ------------------------------------------------------ |
| Precision ≥ 0.90 at the shipped threshold | 0.8925 — Fail                          | not reached — Not met                  | 0.30 — Not met                                         |
| Graph network beats best boosting         | 0.9708 vs 0.9855 — Fail                | 0.1761 vs 0.5246 — Not met             | gradient boosting ships, so no graph network — Not met |
| Calibration error (ECE) ≤ 0.05            | 0.0883 — Fail                          | 0.0624 — Not met                       | 0.0079 — Met                                           |
| File ≤ 1 MB                               | 169,515 bytes — Pass                   | 169,515 bytes — Pass                   | 281,219 bytes — Met                                    |
| 2,000+ elements in the Web Worker ≤ 50 ms | 10 ms median for 2,664 elements — Pass | 11 ms median for 2,664 elements — Pass | 9 ms median for 2,663 elements — Met                   |

No run passes the ship gate, so `defaultOn` stays `false`.

## Errors of the current model

`ml/reports/errors.json` holds all 7 false positives and all 3 false negatives on the test sites at the shipped threshold. They have not been reviewed manually. Six of the false positives are layout wrappers on one website (booking.com), and one is a page's root `<div id="root">`, scored 0.91. The 3 misses are accordion toggles on mega.co.nz, scored 0.014. With 2 test websites holding click-only controls, these are observations, not established patterns.

## Label quality and remaining checks

- **Automated label audit:** 300 labels were sampled; 188 were judged and 112 marked unsure, and none of the 188 judged was marked wrong. Only 4 of the judged labels were positive. This was done on the old corpus and does not establish positive-label quality.
- **Manual owner review:** not completed. Do not describe the automated audit as a manual hand-check.
- **Too few trustworthy positives:** 99% of the positives found in the crawl are on delegated pages, where the negative labels cannot be trusted. Collecting more usable positives is the main blocker. Options include crawling more sites, or labelling delegated pages per element, so that those pages can be used again.

## Limitations and reproducibility

- The corpus has 136 sites, but only 13 of them contain any positive, and one site provides more than half of all positives.
- All examples come from the Tranco crawl category. Coverage of other site types and frameworks has not been established (the corpus has no Vue or Angular rows).
- The dataset and raw crawl outputs are not committed. To rebuild: run `node filter_tranco_training_data.cjs` and `node filter_tranco_snippets.cjs` from `ml/`, then `python train/train.py --data data/crawl-tranco-train` (see `ml/README.md`).
- The optional GraphSAGE comparison was not implemented.
- The model stays advisory and switched off by default until every ship gate passes and the manual label and error reviews are complete.
