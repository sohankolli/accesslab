Click-only controls: evaluation report
Model version 1.0.0. This report describes the current Tranco-derived training run. Dataset counts and model metrics are from the current training outputs and model manifest; browser latency is from bench.json. The label audit is automated and must not be mistaken for an independent manual review.
Data
Item	Current Tranco experiment
Source	Tranco top-1,000 crawl. The current model was not trained on the historical GitHub stand-in corpus.
Page records	1,407 total: 879 successful pages used, 370 errors, 38 robots exclusions and 120 pages with failed scripts.
Contributing sites	450 unique sites in the prepared training corpus.
Candidate elements	18,345 total: 8,751 positive and 9,594 negative labels.
Label filtering	All direct positive labels and only non-delegated negative labels were retained. Delegated negatives were filtered during preparation of the training corpus.
Site-disjoint split	Training: 315 sites, 12,742 rows and 6,118 positives; calibration: 68 sites, 3,935 rows and 1,311 positives; test: 67 sites, 1,668 rows and 1,322 positives.


The split is by website, so a site does not appear in more than one partition. All examples in this experiment come from the Tranco crawl category; this is not a representative evaluation across industry or site types. The dataset and intermediate crawl outputs remain local and are not committed.
Results on the held-out test websites
Model	PR-AUC	Precision	Recall	ECE
Gradient boosting with neighbourhood (best GBT baseline)	0.9855	0.9045	0.9531	0.0745
Gradient boosting, element only	0.9848	0.9079	0.9622	Not reported here
SIGN graph network (exported model, seed 1)	0.9708	0.8925	0.9486	0.0883


The SIGN model's PR-AUC 95% site-bootstrap interval is 0.9151–0.9966. The selected SIGN model has 40,705 parameters. The current run also evaluated ablations: removing class-name features produced PR-AUC 0.9688, and removing neighbourhood features produced PR-AUC 0.9764. These ablations used one seed each, so they should be treated as indicative rather than a full seed comparison.

On the stricter held-out-source evaluation, SIGN achieved PR-AUC 0.9108 and the neighbourhood GBT baseline achieved 0.9678. This indicates that performance is weaker when evaluation sources are held out.
Ship gate
Condition	SIGN graph network (exported model)	Result
Precision ≥ 0.90	0.8925	Fail
Beats best gradient boosting	0.9708 vs 0.9855 PR-AUC	Fail
Calibration error (ECE) ≤ 0.05	0.0883	Fail
File ≤ 1 MB	169,515 bytes	Pass
2,000+ elements in the Web Worker ≤ 50 ms	10 ms median for 2,664 elements	Pass


The current exported ONNX model is the SIGN graph network, but it does not pass the ship gate. The manifest correctly keeps defaultOn: false. Do not enable suggestions by default or describe the model as production-ready. The neighbourhood GBT baseline performs better on PR-AUC and passes the precision threshold, but its ECE is 0.0745, which is above the 0.05 calibration requirement; it therefore does not make all gates pass either.

Latency was measured by npm run ml:bench in the app's Web Worker on a 2,664-element page. The median was 10 ms across 10 runs in headless Chromium.

The ONNX reference and ONNX Runtime outputs differed by at most 1.788139 × 10⁻⁷ in the parity check. tests/ml/modelParity.test.js checks browser-runtime parity against the stored 50-row fixture.
Errors of the current exported model
At the reported operating threshold, the SIGN model produced 151 false positives and 68 false negatives on the test split. The review samples are available locally at:
- data/tranco-run-output/reports/false-positives-review.csv
- data/tranco-run-output/reports/false-negatives-review.csv
These error samples have not yet been manually reviewed. No conclusions about recurring false-positive or false-negative patterns should be drawn until that review is completed.
Label quality and remaining checks
- Automated label audit: 300 labels were sampled. The automated audit judged 188 and marked 112 unsure; it found zero wrong labels among the 188 judged. Only 4 positive labels were judged (184 negatives), so this result is not enough to establish positive-label quality.
- Manual owner review: An independent human review of the sampled labels has not been completed. Do not describe the automated audit as a manual hand-check.
- Error review: Manually inspect up to 50 false positives and 50 false negatives, record the recurring failure patterns, and update the model-card limitations.
- Label noise: Labels come from automated event-listener and React-handler probing. Delegated event handlers and ancestor-level interactions can still create label noise. Filtering delegated negatives during corpus preparation reduces one known source but does not prove all remaining labels are correct.
Limitations and reproducibility
- The current experiment contains 450 contributing sites, but its examples are all from the Tranco crawl category. Broader site-type and framework coverage has not been established.
- The crawl recorded 370 errors, 38 robots exclusions and 120 failed-script pages. The results describe the prepared usable corpus, not every site in the original Tranco list.
- The dataset and raw crawl outputs are not committed. Follow ml/README.md to rebuild the crawl, prepare the filtered training corpus and retrain.
- The optional GraphSAGE comparison was not implemented.
- The custom GBT ONNX export path is retained for baseline evaluation; numerical parity should continue to be covered by the model tests.
- The model remains advisory and switched off by default until all ship gates pass and the outstanding manual label and error reviews are completed.