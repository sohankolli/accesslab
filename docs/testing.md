# Testing AccessLab

What the test suite covers and how CI runs it. For a short overview, see the [README](../README.md).

## The test suite

`npm test -- --run` runs the whole suite: unit tests for the contrast maths, a passing and a failing fixture for every rule, registry validation, scheduler slicing and cancellation, focus order, the screen-reader linearizer, the simulation filters, reducers, and React Testing Library tests for the workbench, the issue list, settings, shortcuts and the rule that a lens never changes the audit. The model has tests for:

- the 92 features and the neighbourhood views;
- parity between the app and the crawler's copy of the feature code;
- the explanations;
- the model runner with the real model, including a version mismatch and a missing file;
- ONNX Runtime Web against the training code on 50 stored rows;
- the interface: suggestions never change the score, "Not an issue" persists, and fallback when the model is unavailable.

## The model pipeline and CI

The pipeline has its own tests in `ml/` (`npm test` for the labeller and the Chromium/jsdom feature parity, `python -m pytest train/tests`). CI (GitHub Actions) runs lint, a Prettier format check, the tests and the production build on every pull request.
