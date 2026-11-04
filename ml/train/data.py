"""Loading the crawled dataset and splitting it by website.

Elements from one website look alike, so a split by row would let a model
memorise sites and overstate accuracy. Every split here is by site: 70% of
sites for training, 15% for calibration and model selection, 15% for the final
test, which is opened once.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np

NODE_DIM = 92
VIEWS = 6
ROW_DIM = NODE_DIM * VIEWS
# Inside one view: 16 tag slots, 12 style/structure values, 64 class-word buckets.
TAG = slice(0, 16)
DENSE = slice(16, 28)
WORDS = slice(28, 92)
NATIVE, POINTER = 16, 16 + 3


@dataclass
class Dataset:
    X: np.ndarray          # (n, 552) float32
    y: np.ndarray          # (n,) int8, 1 = click-only control
    site: np.ndarray       # (n,) site name, used only for splitting
    group: np.ndarray      # (n,) source repository or domain
    category: np.ndarray   # (n,) kind of site
    framework: np.ndarray  # (n,) react / vue / angular / jquery / other
    delegated: np.ndarray  # (n,) bool: page has document-level click listeners
    key: np.ndarray        # (n,) "site|page|id", to find the element again for error analysis

    def take(self, idx: np.ndarray) -> "Dataset":
        return Dataset(*(getattr(self, f)[idx] for f in self.__dataclass_fields__))


def load(rows_path: Path, cache: Path | None = None) -> Dataset:
    """Read rows.jsonl (slow, once) and cache it as a compressed .npz."""
    if cache and cache.exists() and cache.stat().st_mtime > rows_path.stat().st_mtime:
        z = np.load(cache, allow_pickle=False)
        return Dataset(*(z[f] for f in Dataset.__dataclass_fields__))
    X, y, site, group, category, framework, delegated, key = [], [], [], [], [], [], [], []
    with open(rows_path) as fh:
        for line in fh:
            r = json.loads(line)
            if len(r["x"]) != ROW_DIM:
                raise ValueError(f"row has {len(r['x'])} values, expected {ROW_DIM}")
            X.append(r["x"])
            y.append(r["label"])
            site.append(r["site"])
            group.append(r["group"])
            category.append(r["category"])
            framework.append(r["framework"])
            delegated.append(bool(r["delegated"]))
            key.append(f"{r['site']}|{r['page']}|{r['id']}")
    ds = Dataset(
        np.asarray(X, np.float32), np.asarray(y, np.int8), np.asarray(site), np.asarray(group),
        np.asarray(category), np.asarray(framework), np.asarray(delegated), np.asarray(key),
    )
    if cache:
        np.savez_compressed(cache, **{f: getattr(ds, f) for f in Dataset.__dataclass_fields__})
    return ds


def split_by_site(sites: np.ndarray, y: np.ndarray | None = None, seed: int = 359,
                  fractions=(0.70, 0.15, 0.15)):
    """Index arrays (train, calibration, test), with no website in two splits.

    With labels, the split is stratified: sites that have at least one
    click-only control and sites that have none are each divided 70/15/15, so
    every split gets its share of positive sites. Sites still never cross splits.
    """
    unique = np.unique(sites)
    if y is None:
        strata = [unique]
    else:
        positive_sites = set(np.unique(sites[y == 1]).tolist())
        strata = [np.array([s for s in unique if s in positive_sites]),
                  np.array([s for s in unique if s not in positive_sites])]
    rng = np.random.default_rng(seed)
    parts = ([], [], [])
    for stratum in strata:
        stratum = stratum.copy()
        rng.shuffle(stratum)
        n_train = round(len(stratum) * fractions[0])
        n_cal = round(len(stratum) * fractions[1])
        parts[0].extend(stratum[:n_train])
        parts[1].extend(stratum[n_train:n_train + n_cal])
        parts[2].extend(stratum[n_train + n_cal:])
    return tuple(np.flatnonzero(np.isin(sites, p)) for p in parts)


def grouped_folds(sites: np.ndarray, y: np.ndarray, k: int = 5, seed: int = 359):
    """k cross-validation folds grouped by website: no site is in two folds.

    Sites with click-only controls are dealt out first, largest first, each to
    the fold with the fewest positives so far, so every fold gets its share;
    the other sites are shuffled and dealt round-robin. Only label counts are
    looked at, never any model's results. Returns [(train_idx, val_idx)] * k.
    """
    rng = np.random.default_rng(seed)
    unique = np.unique(sites)
    pos = {s: int(y[sites == s].sum()) for s in unique}
    positive_sites = [s for s in unique if pos[s] > 0]
    rng.shuffle(positive_sites)
    positive_sites.sort(key=lambda s: -pos[s])  # stable: ties keep the shuffled order
    other = [s for s in unique if pos[s] == 0]
    rng.shuffle(other)
    fold_of, load = {}, [0] * k
    for s in positive_sites:
        f = min(range(k), key=lambda i: (load[i], i))
        fold_of[s], load[f] = f, load[f] + pos[s]
    for i, s in enumerate(other):
        fold_of[s] = i % k
    folds = np.array([fold_of[s] for s in sites])
    return [(np.flatnonzero(folds != f), np.flatnonzero(folds == f)) for f in range(k)]


def balanced_split(sites: np.ndarray, y: np.ndarray, tries: int = 200, fractions=(0.70, 0.15, 0.15)):
    """The stratified site split whose share of positives is closest to `fractions`.

    A few sites hold dozens of click-only controls each (game boards, keyboards),
    so one random split can leave the test set with very few positives. This
    tries `tries` seeds and keeps the one with the most even positives. It looks
    only at label counts, never at any model's results, so it cannot favour a model.
    Returns (train, calibration, test, seed).
    """
    total = y.sum()
    best = None
    for seed in range(tries):
        parts = split_by_site(sites, y, seed=seed, fractions=fractions)
        gap = sum(abs(y[p].sum() / total - f) for p, f in zip(parts, fractions))
        if best is None or gap < best[0]:
            best = (gap, parts, seed)
    return (*best[1], best[2])


def mask(X: np.ndarray, *, words: bool = True, neighbourhood: bool = True) -> np.ndarray:
    """Copy of X with a signal removed, for ablations: class-name words, or all views but self."""
    X = X.copy()
    if not words:
        for v in range(VIEWS):
            X[:, v * NODE_DIM + WORDS.start: v * NODE_DIM + WORDS.stop] = 0
    if not neighbourhood:
        X[:, NODE_DIM:] = 0
    return X
