"""Evaluation measures. Positives are rare, so precision-recall comes first."""
from __future__ import annotations

import numpy as np
from sklearn.metrics import average_precision_score


def pr_auc(y, p) -> float:
    """Area under the precision-recall curve (average precision)."""
    return float(average_precision_score(y, p)) if np.any(y) else float("nan")


def precision_recall(y, p, threshold: float):
    pred = p >= threshold
    tp = int(np.sum(pred & (y == 1)))
    fp = int(np.sum(pred & (y == 0)))
    fn = int(np.sum(~pred & (y == 1)))
    precision = tp / (tp + fp) if tp + fp else float("nan")
    recall = tp / (tp + fn) if tp + fn else float("nan")
    return precision, recall, {"tp": tp, "fp": fp, "fn": fn, "flagged": tp + fp}


def ece(y, p, bins: int = 10) -> float:
    """Expected calibration error: |accuracy - confidence| per bin, weighted by bin size."""
    y, p = np.asarray(y, float), np.asarray(p, float)
    idx = np.clip((p * bins).astype(int), 0, bins - 1)
    total = 0.0
    for b in range(bins):
        sel = idx == b
        if sel.any():
            total += abs(y[sel].mean() - p[sel].mean()) * sel.mean()
    return float(total)


def reliability(y, p, bins: int = 10):
    """Per-bin (mean confidence, observed rate, count), for the reliability diagram."""
    y, p = np.asarray(y, float), np.asarray(p, float)
    idx = np.clip((p * bins).astype(int), 0, bins - 1)
    return [
        (float(p[idx == b].mean()), float(y[idx == b].mean()), int((idx == b).sum()))
        for b in range(bins) if (idx == b).any()
    ]


def threshold_for_precision(y, p, target: float = 0.90, min_flagged: int = 5):
    """The lowest threshold whose precision is at least `target` on these rows, or None."""
    order = np.argsort(-p)
    ys, ps = np.asarray(y)[order], p[order]
    tp = np.cumsum(ys == 1)
    flagged = np.arange(1, len(ys) + 1)
    precision = tp / flagged
    best = None
    for k in range(min_flagged - 1, len(ys)):
        # Only cut between distinct scores, so ties are not split.
        if k + 1 < len(ys) and ps[k + 1] == ps[k]:
            continue
        if precision[k] >= target:
            best = float(ps[k])
    return best


def site_bootstrap(y, p, sites, stat, n: int = 300, seed: int = 0):
    """95% interval for stat(y, p), resampling whole sites (rows of a site move together)."""
    rng = np.random.default_rng(seed)
    unique, inverse = np.unique(sites, return_inverse=True)
    rows_of = [np.flatnonzero(inverse == i) for i in range(len(unique))]
    values = []
    for _ in range(n):
        pick = rng.integers(0, len(unique), len(unique))
        idx = np.concatenate([rows_of[i] for i in pick])
        v = stat(y[idx], p[idx])
        if np.isfinite(v):
            values.append(v)
    return (float(np.percentile(values, 2.5)), float(np.percentile(values, 97.5))) if values else (None, None)
