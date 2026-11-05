"""Checks on the training pipeline's pieces. Run: python -m pytest train/tests (in ml/)."""
import sys
from pathlib import Path

import numpy as np
import torch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import data as D  # noqa: E402
import metrics as M  # noqa: E402
from models import Calibrated, SignNet, fit_temperature  # noqa: E402


def toy_sites(n_sites=60, rows=10, seed=0):
    rng = np.random.default_rng(seed)
    sites = np.repeat([f"s{i}" for i in range(n_sites)], rows)
    y = np.zeros(len(sites), np.int8)
    for i in range(0, n_sites, 3):  # a third of the sites have positives
        y[i * rows: i * rows + rng.integers(1, 4)] = 1
    return sites, y


def test_split_never_puts_a_site_in_two_parts():
    sites, y = toy_sites()
    tr, cal, te = D.split_by_site(sites, y)
    a, b, c = set(sites[tr]), set(sites[cal]), set(sites[te])
    assert not (a & b) and not (a & c) and not (b & c)
    assert len(tr) + len(cal) + len(te) == len(sites)
    assert len(a) == 42 and len(b) == 9 and len(c) == 9  # 70/15/15 of 60 sites


def test_split_is_stratified_by_positive_sites():
    sites, y = toy_sites()
    tr, cal, te = D.split_by_site(sites, y)
    for part in (cal, te):
        assert y[part].sum() > 0


def test_balanced_split_is_deterministic():
    sites, y = toy_sites()
    first, second = D.balanced_split(sites, y, tries=20), D.balanced_split(sites, y, tries=20)
    assert first[3] == second[3]
    assert all(np.array_equal(a, b) for a, b in zip(first[:3], second[:3]))


def test_mask_removes_words_or_neighbourhood_only():
    X = np.ones((2, D.ROW_DIM), np.float32)
    no_words = D.mask(X, words=False)
    assert no_words[:, D.WORDS].sum() == 0 and no_words[:, D.TAG].sum() == 2 * 16
    assert no_words[:, D.NODE_DIM + D.WORDS.start] .sum() == 0  # every view
    no_nb = D.mask(X, neighbourhood=False)
    assert no_nb[:, :D.NODE_DIM].sum() == 2 * D.NODE_DIM and no_nb[:, D.NODE_DIM:].sum() == 0
    assert X.sum() == X.size  # the input is not changed


def test_ece_is_zero_when_confidence_matches_outcomes():
    p = np.repeat([0.05, 0.95], 1000)
    y = np.concatenate([np.r_[np.ones(50), np.zeros(950)], np.r_[np.ones(950), np.zeros(50)]])
    assert M.ece(y, p) < 1e-9
    assert abs(M.ece(y, np.full_like(p, 0.9)) - 0.4) < 1e-9  # says 90%, right half the time


def test_threshold_reaches_the_precision_target():
    y = np.array([1, 1, 1, 0, 1, 0, 0, 0])
    p = np.array([0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2])
    t = M.threshold_for_precision(y, p, target=0.75, min_flagged=1)
    precision, _, _ = M.precision_recall(y, p, t)
    assert t == 0.5 and precision >= 0.75
    assert M.threshold_for_precision(np.zeros(4), np.linspace(0, 1, 4), 0.9, 1) is None


def test_sign_net_has_the_specified_size():
    net = SignNet()
    assert sum(p.numel() for p in net.parameters()) == 40705
    assert net(torch.zeros(5, D.ROW_DIM)).shape == (5,)


def test_temperature_is_folded_into_the_exported_model():
    torch.manual_seed(0)
    net = SignNet().eval()
    x = torch.randn(7, D.ROW_DIM)
    with torch.no_grad():
        expected = torch.sigmoid(net(x) / 2.5)
        assert torch.allclose(Calibrated(net, 2.5)(x), expected)


def test_temperature_scaling_softens_overconfident_logits():
    rng = np.random.default_rng(0)
    y = rng.integers(0, 2, 4000)
    z = np.where(y == 1, 1.0, -1.0) * 6 + rng.normal(0, 6, 4000)  # far too confident
    assert fit_temperature(z.astype(np.float32), y) > 2


def test_missing_threshold_values_are_marked_not_reached():
    import train as T

    entry = {"threshold": None, "precision": float("nan"), "recall": None, "pr_auc": 0.5, "tp": 3}
    T.not_reached(entry, T.THRESHOLD_KEYS)
    assert entry["threshold"] == entry["precision"] == entry["recall"] == T.NOT_REACHED
    assert entry["flagged"] == T.NOT_REACHED  # missing keys are marked too
    assert entry["pr_auc"] == 0.5 and entry["tp"] == 3  # measured values are kept
    assert "null" not in T.dump(entry) and "NaN" not in T.dump(entry)


def test_grouped_folds_keep_each_site_in_one_fold_and_spread_positives():
    sites, y = toy_sites()
    folds = D.grouped_folds(sites, y, k=5)
    assert len(folds) == 5
    seen = np.zeros(len(y), int)
    for tr, va in folds:
        assert not set(sites[tr]) & set(sites[va])
        assert y[va].sum() > 0  # every fold has click-only controls to validate on
        seen[va] += 1
    assert (seen == 1).all()  # every row is validated exactly once
    counts = [y[va].sum() for _, va in folds]
    assert max(counts) - min(counts) <= 3


def test_fill_unmeasured_leaves_no_null():
    import train as T

    out = T.fill_unmeasured({"a": None, "b": [float("nan"), 1.0], "c": {"d": None, "e": "x"}})
    assert out == {"a": "not measured", "b": ["not measured", 1.0], "c": {"d": "not measured", "e": "x"}}


def test_threshold_is_the_lowest_with_half_precision_or_none():
    import train as T

    y = np.array([1, 1, 0, 1, 0, 0, 1, 0, 0, 0])
    p = np.linspace(0.9, 0.1, 10)
    t, at = T.choose_threshold(y, p)
    # Flagging the top 7 gives 4 of 7 (57%); the top 8 gives 4 of 8 (50%), the lowest reaching 50%.
    assert t == p[7] and at["precision"] == 0.5 and at["flagged"] == 8
    t, at = T.choose_threshold(np.array([0, 0, 0, 0, 0, 1]), p[:6])
    assert t is None and at["precision"] == T.NOT_REACHED
