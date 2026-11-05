"""Train, compare, calibrate, evaluate and export the click-only controls model.

    python train/train.py --data data/crawl --out ../public/models --reports reports

Every number written by this script is measured here on the crawled data.
Every choice (model, epochs, temperature, threshold) is made by 5-fold
cross-validation grouped by website on the development sites (the training and
calibration sites together). The test sites are scored once, at the end.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import random
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
from sklearn.ensemble import HistGradientBoostingClassifier

import data as D
import metrics as M
from models import Calibrated, fit_sign, fit_temperature, logits

FEATURE_VERSION = "clickables-features-1"  # must match src/engine/ml/manifest.js
TARGET_PRECISION = 0.90
SEEDS = [0, 1, 2]
GATE = {"precision": 0.90, "ece": 0.05, "size_bytes": 1_000_000, "latency_ms": 50}


def parse_args():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", type=Path, default=Path("data/crawl"))
    ap.add_argument("--out", type=Path, default=Path("../public/models"))
    ap.add_argument("--reports", type=Path, default=Path("reports"))
    ap.add_argument("--fixtures", type=Path, default=Path("../tests/ml/fixtures"))
    ap.add_argument("--corpus-note", default="")
    ap.add_argument("--test-sites", type=Path, default=Path(__file__).with_name("test-sites.json"),
                    help="JSON list of the frozen test websites; missing: a fresh stratified site split")
    ap.add_argument("--keep-delegated", action="store_true",
                    help="also use pages with document-level click listeners (their 0 labels are unreliable)")
    ap.add_argument("--candidates", choices=["all", "gbt-element"], default="all",
                    help="gbt-element: train only element-only gradient boosting (no graph network, "
                         "ablations or source holdout)")
    ap.add_argument("--neg-per-pos", type=int, default=0,
                    help="inside each training fold and the final retrain, keep every positive and at most "
                         "this many negatives per positive (fixed seed); 0 keeps every row")
    ap.add_argument("--compare-onnx", type=Path, default=None,
                    help="an existing model (the shipped one) to score on the test sites with the same code")
    return ap.parse_args()


NOT_REACHED = "not reached"


def not_reached(entry: dict, keys) -> dict:
    """Mark values that need the target-precision threshold as "not reached" when no
    threshold met the target precision on the calibration sites, so the
    manifest says why they are missing instead of holding null."""
    for k in keys:
        v = entry.get(k)
        if v is None or (isinstance(v, (float, np.floating)) and not np.isfinite(v)):
            entry[k] = NOT_REACHED
    return entry


FOLDS = 5
SELECTION_RULE = ("the candidate with the highest out-of-fold PR-AUC in 5-fold cross-validation "
                  "grouped by website on the development sites; the test sites are never used to choose")
MIN_PRECISION = 0.50
THRESHOLD_RULE = ("the lowest threshold whose precision on the out-of-fold predictions is at least 50% "
                  "(with at least 5 elements flagged); if none reaches 50%, there is no threshold and no "
                  "suggestions. The test websites are never used to choose it")

# The candidates compared in cross-validation, in this order (it breaks ties).
CANDIDATES = [
    {"name": "SIGN graph network, seed 0", "kind": "sign", "seed": 0},
    {"name": "SIGN graph network, seed 1", "kind": "sign", "seed": 1},
    {"name": "SIGN graph network, seed 2", "kind": "sign", "seed": 2},
    {"name": "Gradient boosting, element only", "kind": "gbt", "cols": slice(0, D.NODE_DIM)},
    {"name": "Gradient boosting with neighbourhood", "kind": "gbt", "cols": slice(0, D.ROW_DIM)},
]


def choose_threshold(y, p):
    """The operating threshold on out-of-fold predictions, and what it gives there."""
    t = M.threshold_for_precision(y, p, MIN_PRECISION)
    if t is None:
        return None, {"precision": NOT_REACHED, "recall": NOT_REACHED, "flagged": NOT_REACHED}
    precision, recall, counts = M.precision_recall(y, p, t)
    return t, {"precision": precision, "recall": recall, "flagged": counts["flagged"]}


def fill_unmeasured(obj):
    """Replace None and NaN, at any depth, with "not measured"."""
    if isinstance(obj, dict):
        return {k: fill_unmeasured(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [fill_unmeasured(v) for v in obj]
    if obj is None or (isinstance(obj, (float, np.floating)) and not np.isfinite(obj)):
        return "not measured"
    return obj


def count_params(net) -> int:
    return int(sum(p.numel() for p in net.parameters()))

THRESHOLD_KEYS = ("threshold", "precision", "precision_ci95", "recall", "flagged", "tp", "fp", "fn")


def finite(obj):
    """JSON has no NaN or infinity: anything not measured is written as null."""
    if isinstance(obj, dict):
        return {k: finite(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [finite(v) for v in obj]
    if isinstance(obj, (float, np.floating)):
        return float(obj) if np.isfinite(obj) else None
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.bool_):
        return bool(obj)
    return obj


def dump(obj) -> str:
    return json.dumps(finite(obj), indent=1, allow_nan=False)


def rule_scores(X):
    """Baseline 0: what a developer would write. Pointer cursor and not a native control."""
    return ((X[:, D.POINTER] > 0) & (X[:, D.NATIVE] == 0)).astype(np.float32)


def fit_gbt(Xtr, ytr, Xcal, ycal):
    """Gradient boosting with a small grid, chosen on the calibration sites."""
    best = None
    for lr in (0.05, 0.1):
        for leaves in (15, 31):
            for it in (300,):
                m = HistGradientBoostingClassifier(
                    learning_rate=lr, max_leaf_nodes=leaves, max_iter=it,
                    class_weight="balanced", random_state=0,
                ).fit(Xtr, ytr)
                s = M.pr_auc(ycal, m.predict_proba(Xcal)[:, 1])
                if best is None or s > best[0]:
                    best = (s, m, {"learning_rate": lr, "max_leaf_nodes": leaves, "max_iter": it})
    return best[1], best[2], best[0]


def summarise(name, y, p, threshold, sites):
    prec, rec, counts = M.precision_recall(y, p, threshold) if threshold is not None else (float("nan"), float("nan"), {})
    out = {
        "model": name,
        "pr_auc": M.pr_auc(y, p),
        "pr_auc_ci95": M.site_bootstrap(y, p, sites, M.pr_auc),
        "threshold": threshold,
        "precision": prec,
        "recall": rec,
        **counts,
    }
    if threshold is not None:
        out["precision_ci95"] = M.site_bootstrap(
            y, p, sites, lambda yy, pp: M.precision_recall(yy, pp, threshold)[0]
        )
        out["recall_ci95"] = M.site_bootstrap(
            y, p, sites, lambda yy, pp: M.precision_recall(yy, pp, threshold)[1]
        )
    return out


def breakdown(ds, p, threshold, field):
    rows = []
    values = getattr(ds, field)
    for v in sorted(set(values.tolist())):
        sel = values == v
        if sel.sum() < 30:
            continue
        prec, rec, counts = (M.precision_recall(ds.y[sel], p[sel], threshold) if threshold is not None
                             else (float("nan"), float("nan"), {}))
        rows.append({
            field: str(v), "rows": int(sel.sum()), "positives": int(ds.y[sel].sum()),
            "sites": int(len(set(ds.site[sel].tolist()))), "pr_auc": M.pr_auc(ds.y[sel], p[sel]),
            "precision": prec, "recall": rec, **counts,
        })
    return rows


def load_snippets(path: Path):
    out = {}
    if path.exists():
        with open(path, encoding="utf-8", errors="replace") as fh:
            for line in fh:
                r = json.loads(line)
                out[f"{r['site']}|{r['page']}|{r['id']}"] = r["snippet"]
    return out


def reliability_svg(points, path: Path, title: str):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(4.2, 4.2), dpi=100)
    ax.plot([0, 1], [0, 1], color="#9aa0a6", lw=1, ls="--", label="perfect calibration")
    xs, ys, ns = zip(*points) if points else ([], [], [])
    ax.plot(xs, ys, marker="o", color="#3B2FC9", lw=1.5, label="model")
    for x, y, n in points:
        ax.annotate(str(n), (x, y), textcoords="offset points", xytext=(4, -10), fontsize=7, color="#5B6068")
    ax.set_xlabel("Predicted probability")
    ax.set_ylabel("Observed rate of click-only controls")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_title(title, fontsize=10)
    ax.legend(fontsize=8, loc="upper left")
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def main():
    args = parse_args()
    t0 = time.time()
    random.seed(0)
    np.random.seed(0)
    torch.manual_seed(0)
    torch.set_num_threads(max(1, torch.get_num_threads()))
    args.reports.mkdir(parents=True, exist_ok=True)
    args.out.mkdir(parents=True, exist_ok=True)
    args.fixtures.mkdir(parents=True, exist_ok=True)

    if args.candidates == "gbt-element":
        CANDIDATES[:] = [c for c in CANDIDATES if c["name"] == "Gradient boosting, element only"]
    full = D.load(args.data / "rows.jsonl", args.data / "rows.npz")
    pages = [json.loads(l) for l in open(args.data / "pages.jsonl")]
    # Pages that listen for clicks on the whole document (event delegation) may
    # have clickable elements labelled 0: their labels cannot be trusted, so by
    # default they are left out of training and evaluation alike.
    keep = np.ones(len(full.y), bool) if args.keep_delegated else ~full.delegated
    ds = full.take(np.flatnonzero(keep))
    # The test sites are kept apart and scored once at the end. They are frozen
    # in test-sites.json (the 21 sites of the first corrected-filter run), so
    # later changes to the data cannot move sites in or out of the test set.
    # Every other site is a development site, used for every choice.
    if args.test_sites.exists():
        test_sites = set(json.loads(args.test_sites.read_text()))
        is_test = np.isin(ds.site, sorted(test_sites))
        dev_i, te_i, split_seed = np.flatnonzero(~is_test), np.flatnonzero(is_test), "frozen"
    else:
        tr_i, cal_i, te_i, split_seed = D.balanced_split(ds.site, ds.y)
        dev_i = np.sort(np.concatenate([tr_i, cal_i]))
    dev, te = ds.take(dev_i), ds.take(te_i)
    assert not (set(dev.site) & set(te.site))
    folds = D.grouped_folds(dev.site, dev.y, k=FOLDS)
    for tr_f, va_f in folds:
        assert not (set(dev.site[tr_f]) & set(dev.site[va_f]))

    def split_stats(part):
        return {"sites": len(set(part.site.tolist())), "rows": int(len(part.y)), "positives": int(part.y.sum())}

    report = {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "feature_version": FEATURE_VERSION,
        "data": {
            "pages_crawled": len(pages),
            "pages_used": sum(p.get("status") == "ok" for p in pages),
            "pages_dropped": dict(Counter(p.get("status") for p in pages if p.get("status") != "ok")),
            "sites": len(set(ds.site.tolist())),
            "sources": len(set(ds.group.tolist())),
            "rows": int(len(ds.y)),
            "positives": int(ds.y.sum()),
            "frameworks": dict(Counter(ds.framework.tolist())),
            "categories": dict(Counter(ds.category.tolist())),
            "delegated_pages_excluded": not args.keep_delegated,
            "rows_excluded_delegated": int((~keep).sum()),
            "positives_excluded_delegated": int(full.y[~keep].sum()),
            "note": args.corpus_note,
            "splits": {"development": split_stats(dev), "test": split_stats(te)},
            "folds": [{**split_stats(dev.take(va)), "fold": f} for f, (_, va) in enumerate(folds)],
            "split_seed": split_seed,
        },
    }
    print(json.dumps(report["data"], indent=1))

    # ---- Model selection by 5-fold cross-validation grouped by site ----
    # Inside each fold, a few of the fold's training sites are held back for
    # early stopping (SIGN) and the small grid (gradient boosting), so the
    # validation fold never influences its own predictions.
    def inner_split(part, seed):
        a, b, _ = D.split_by_site(part.site, part.y, seed=seed, fractions=(0.85, 0.15, 0.0))
        return part.take(a), part.take(b)

    def sampled(part, seed):
        """The training rows used to fit: all of them, or every positive and a few negatives each."""
        return part.take(D.sample_negatives(part.y, args.neg_per_pos, seed)) if args.neg_per_pos else part

    def fit(cand, part, seed=0):
        part = sampled(part, seed)
        inner_tr, inner_va = inner_split(part, seed)
        if cand["kind"] == "sign":
            net, info = fit_sign(inner_tr.X, inner_tr.y, inner_va.X, inner_va.y, seed=cand["seed"], score=M.pr_auc)
            return net, {"best_epoch": info["best_epoch"]}
        cols = cand["cols"]
        m, params, _ = fit_gbt(inner_tr.X[:, cols], inner_tr.y, inner_va.X[:, cols], inner_va.y)
        return m, {"params": params}

    def z_of(cand, model, X):
        if cand["kind"] == "sign":
            return logits(model, X)
        return model.decision_function(X[:, cand["cols"]])

    for cand in CANDIDATES:
        cand["oof_z"] = np.zeros(len(dev.y), np.float32)
        cand["fold_info"] = []
        for f, (tr_f, va_f) in enumerate(folds):
            model, info = fit(cand, dev.take(tr_f), seed=f)
            cand["oof_z"][va_f] = z_of(cand, model, dev.X[va_f])
            cand["fold_info"].append(info)
        cand["oof_pr_auc"] = M.pr_auc(dev.y, cand["oof_z"])
        cand["temperature"] = fit_temperature(cand["oof_z"], dev.y)
        cand["oof_p"] = 1 / (1 + np.exp(-cand["oof_z"] / cand["temperature"]))
        cand["threshold"], cand["oof_at_threshold"] = choose_threshold(dev.y, cand["oof_p"])
        print("cv", cand["name"], round(cand["oof_pr_auc"], 4), "T", round(cand["temperature"], 3),
              "threshold", cand["threshold"], round(time.time() - t0), "s")

    # The rule: the highest out-of-fold PR-AUC wins (ties: the earlier candidate).
    chosen = max(CANDIDATES, key=lambda c: c["oof_pr_auc"])

    # ---- Retrain every candidate on all development sites, then score the test sites once ----
    for cand in CANDIDATES:
        if cand["kind"] == "sign":
            epochs = int(np.median([i["best_epoch"] for i in cand["fold_info"]]))
            cand["final"], _ = fit_sign(dev.X, dev.y, None, None, seed=cand["seed"], epochs=epochs, score=M.pr_auc)
            cand["final_info"] = {"epochs": epochs}
        else:
            chosen_params = Counter(json.dumps(i["params"], sort_keys=True) for i in cand["fold_info"]).most_common(1)[0][0]
            params = json.loads(chosen_params)
            fit_rows = sampled(dev, FOLDS)
            cand["final"] = HistGradientBoostingClassifier(class_weight="balanced", random_state=0, **params).fit(
                fit_rows.X[:, cand["cols"]], fit_rows.y)
            cand["final_info"] = {"params": params}
        cand["p_te"] = 1 / (1 + np.exp(-z_of(cand, cand["final"], te.X) / cand["temperature"]))
        cand["test"] = summarise(cand["name"], te.y, cand["p_te"], cand["threshold"], te.site)
        cand["test"]["ece"] = M.ece(te.y, cand["p_te"])
    print("final models done", round(time.time() - t0), "s")

    comparisons = [summarise("Rule: pointer cursor and not native", te.y, rule_scores(te.X), 0.5, te.site)]
    comparisons += [{**c["test"], "oof_pr_auc": c["oof_pr_auc"], "temperature": c["temperature"], **c["final_info"]}
                    for c in CANDIDATES]
    signs = [c for c in CANDIDATES if c["kind"] == "sign"]
    gbts = [c for c in CANDIDATES if c["kind"] == "gbt"]
    seed_runs = [{"seed": c["seed"], "oof_pr_auc": c["oof_pr_auc"], "test_pr_auc": c["test"]["pr_auc"]} for c in signs]
    seed_test = [r["test_pr_auc"] for r in seed_runs]
    extras = bool(signs)  # the ablations and the source holdout train graph networks

    # ---- Ablations of the graph network, seed 0, trained on the development sites ----
    ablations = []
    for name, kw in [] if not extras else [("SIGN without class-name words", {"words": False}),
                     ("SIGN without neighbourhood", {"neighbourhood": False})]:
        a_tr, a_va = inner_split(dev, 0)
        n, _ = fit_sign(D.mask(a_tr.X, **kw), a_tr.y, D.mask(a_va.X, **kw), a_va.y, seed=0, score=M.pr_auc)
        score = M.pr_auc(te.y, 1 / (1 + np.exp(-logits(n, D.mask(te.X, **kw)))))
        ablations.append({"model": name, "pr_auc_mean": score, "pr_auc_all_seeds": [score]})
        print(name, score)

    # ---- A stricter split: whole source repositories held out ----
    strict = {"held_out_sources": [], "test_rows": None, "test_positives": None, "sign_pr_auc": None,
              "gbt_neighbourhood_pr_auc": None, "note": "not run: only element-only gradient boosting was trained"}
    groups = np.unique(ds.group) if extras else np.array([])
    rng = np.random.default_rng(7)
    held = set() if not extras else set(rng.choice(groups, max(2, round(len(groups) * 0.2)), replace=False).tolist())
    if extras:
        g_te = np.isin(ds.group, list(held))
        g_rest = np.flatnonzero(~g_te)
        g_tr_i, g_cal_i, _ = D.split_by_site(ds.site[g_rest], ds.y[g_rest], seed=11, fractions=(0.85, 0.15, 0.0))
        gtr, gcal, gte = ds.take(g_rest[g_tr_i]), ds.take(g_rest[g_cal_i]), ds.take(np.flatnonzero(g_te))
        gnet, _ = fit_sign(gtr.X, gtr.y, gcal.X, gcal.y, seed=0, score=M.pr_auc)
        ggbt, _, _ = fit_gbt(gtr.X, gtr.y, gcal.X, gcal.y)
        strict = {
            "held_out_sources": sorted(held), "test_rows": int(len(gte.y)), "test_positives": int(gte.y.sum()),
            "sign_pr_auc": M.pr_auc(gte.y, 1 / (1 + np.exp(-logits(gnet, gte.X)))),
            "gbt_neighbourhood_pr_auc": M.pr_auc(gte.y, ggbt.predict_proba(gte.X)[:, 1]),
        }
    print("held-out sources", strict)

    # ---- Export the chosen model with its temperature folded in ----
    onnx_path = args.out / "clickables-v1.onnx"
    temperature, ship_threshold, p_ship = chosen["temperature"], chosen["threshold"], chosen["p_te"]
    if chosen["kind"] == "sign":
        graph_model = Calibrated(chosen["final"], temperature).eval()
        torch.onnx.export(
            graph_model, torch.from_numpy(te.X[:2]), str(onnx_path), input_names=["x"], output_names=["p"],
            dynamic_axes={"x": {0: "n"}, "p": {0: "n"}}, opset_version=17, dynamo=False,
        )
        reference = lambda X: graph_model(torch.from_numpy(X)).detach().numpy()
        architecture = f"SIGN-style network: 6 view encoders (92->48), head 288->48->1; {count_params(chosen['final'])} parameters"
    else:
        from export_gbt import export_hist_gbt
        gbt = chosen["final"]
        export_hist_gbt(gbt, temperature, D.ROW_DIM, str(onnx_path))  # tree feature indices are row columns
        reference = lambda X: 1 / (1 + np.exp(-gbt.decision_function(X[:, chosen["cols"]]) / temperature))
        architecture = (f"gradient-boosted trees over {len(range(D.ROW_DIM)[chosen['cols']])} features "
                        f"({gbt.n_iter_} trees, up to {chosen['final_info']['params']['max_leaf_nodes']} leaves each), "
                        "temperature-calibrated")

    import onnxruntime as ort
    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    ref_in = te.X[:50]
    ref_out = np.asarray(reference(ref_in), np.float32)
    full_parity = float(np.max(np.abs(np.asarray(reference(te.X), np.float32) - sess.run(["p"], {"x": te.X})[0])))
    (args.fixtures / "clickables-parity.json").write_text(json.dumps({
        "note": "50 test-site feature rows and the probabilities the training code gives them. "
                "tests/ml/modelParity.test.js checks onnxruntime-web gives the same.",
        "inputs": ref_in.tolist(), "outputs": ref_out.tolist(),
    }))
    # Both the new model and the existing one are scored here by the same code:
    # their ONNX files through onnxruntime, then the same measures.
    p_new_onnx = sess.run(["p"], {"x": te.X})[0]
    heldout = {"rows": int(len(te.y)), "positives": int(te.y.sum()), "sites": len(set(te.site.tolist())),
               "new": summarise(chosen["name"], te.y, p_new_onnx, ship_threshold, te.site)}
    heldout["new"]["suggestions_per_1000"] = (1000 * heldout["new"].get("flagged", 0) / len(te.y)
                                              if ship_threshold is not None else 0.0)
    if args.compare_onnx:
        old_manifest = json.loads(args.compare_onnx.with_suffix(".json").read_text())
        old_t = old_manifest.get("threshold")
        old_t = old_t if isinstance(old_t, (int, float)) else None
        old_sess = ort.InferenceSession(str(args.compare_onnx), providers=["CPUExecutionProvider"])
        p_old = old_sess.run(["p"], {"x": te.X})[0]
        heldout["shipped"] = summarise(f"existing model ({args.compare_onnx.name})", te.y, p_old, old_t, te.site)
        heldout["shipped"]["suggestions_per_1000"] = (1000 * heldout["shipped"].get("flagged", 0) / len(te.y)
                                                      if old_t is not None else 0.0)
        heldout["new_beats_shipped"] = bool(heldout["new"]["pr_auc"] > heldout["shipped"]["pr_auc"])
        np.save(args.reports / "heldout-p-shipped.npy", p_old)
    np.save(args.reports / "heldout-p-new.npy", p_new_onnx)
    print("held-out comparison", json.dumps(finite(heldout), indent=1))
    size = onnx_path.stat().st_size
    sha = hashlib.sha256(onnx_path.read_bytes()).hexdigest()

    shipped = chosen["test"]
    best_gbt_test = max(c["test"]["pr_auc"] for c in gbts)
    gate = {
        "precision": {"target": f">= {GATE['precision']}", "value": shipped["precision"],
                      "pass": bool(ship_threshold is not None and shipped["precision"] >= GATE["precision"])},
        "beats_best_gbt": (
            {"target": "PR-AUC > best gradient boosting on the test sites", "value": shipped["pr_auc"],
             "baseline": best_gbt_test, "pass": bool(shipped["pr_auc"] > best_gbt_test),
             "note": f"shipped seed {chosen['seed']}; mean over seeds {np.mean(seed_test):.3f}"}
            if chosen["kind"] == "sign" else
            {"target": "the graph network beats the best gradient-boosting baseline",
             "value": max(seed_test) if seed_test else None, "baseline": best_gbt_test, "pass": False,
             "note": ("a gradient-boosting model was chosen by out-of-fold PR-AUC, so no graph network ships"
                      if seed_test else "no graph network was trained in this run")}),
        "ece": {"target": f"<= {GATE['ece']}", "value": shipped["ece"], "pass": bool(shipped["ece"] <= GATE["ece"])},
        "size": {"target": f"<= {GATE['size_bytes']} bytes", "value": size, "pass": bool(size <= GATE["size_bytes"])},
        "latency": {"target": f"<= {GATE['latency_ms']} ms for 2,000 elements in the Web Worker", "value": None,
                    "pass": None, "note": "measured in the browser by npm run ml:bench, which fills this in"},
    }

    # ---- Breakdown and error analysis of the shipped model at its threshold ----
    breakdowns = {f: breakdown(te, p_ship, ship_threshold, f) for f in ("framework", "category")}
    snippets = load_snippets(args.data / "snippets.jsonl")
    rng = np.random.default_rng(3)
    if ship_threshold is not None:
        pred = p_ship >= ship_threshold
        fp_idx = np.flatnonzero(pred & (te.y == 0))
        fn_idx = np.flatnonzero(~pred & (te.y == 1))
    else:  # no threshold, so no suggestions and no errors to sample
        fp_idx = fn_idx = np.array([], int)
    sample = lambda idx: rng.choice(idx, min(50, len(idx)), replace=False) if len(idx) else []
    row = lambda i: {"p": float(p_ship[i]), "site": str(te.site[i]), "category": str(te.category[i]),
                     "snippet": snippets.get(str(te.key[i]), "")}
    errors = {"model": chosen["name"], "threshold": ship_threshold if ship_threshold is not None else NOT_REACHED,
              "false_positives": [row(i) for i in sample(fp_idx)],
              "false_negatives": [row(i) for i in sample(fn_idx)]}
    reliability_svg(M.reliability(te.y, p_ship), args.reports / "reliability.svg", "Reliability on test sites")

    cross_validation = {
        "folds": FOLDS, "grouped_by": "website",
        "rule": SELECTION_RULE,
        "candidates": [{"model": c["name"], "oof_pr_auc": c["oof_pr_auc"], "temperature": c["temperature"],
                        "threshold": c["threshold"], **c["oof_at_threshold"]} for c in CANDIDATES],
        "chosen": chosen["name"],
    }
    operating = {
        "rule": THRESHOLD_RULE,
        "value": ship_threshold,
        "outOfFold": chosen["oof_at_threshold"],
        "test": {k: shipped.get(k) for k in ("precision", "precision_ci95", "recall", "recall_ci95",
                                             "tp", "fp", "fn", "flagged")},
    }
    report.update({
        "cross_validation": cross_validation, "comparisons": comparisons, "ablations": ablations,
        "held_out_sources": strict, "heldout_comparison": heldout, "shipped": shipped, "operating_threshold": operating, "gate": gate,
        "breakdowns": breakdowns,
        "onnx": {"bytes": size, "sha256": sha, "max_abs_diff_reference_vs_onnxruntime": full_parity},
        "seconds": round(time.time() - t0),
    })
    (args.reports / "metrics.json").write_text(dump(report))
    (args.reports / "errors.json").write_text(dump(errors))

    manifest = {
        "name": "clickables",
        "version": "1.0.0",
        "model": "clickables-v1.onnx",
        "sha256": sha,
        "bytes": size,
        "featureVersion": FEATURE_VERSION,
        "input": {"name": "x", "dim": D.ROW_DIM},
        "output": {"name": "p"},
        "threshold": ship_threshold,
        "operatingThreshold": operating,
        "temperature": temperature,
        "shipped": "graph" if chosen["kind"] == "sign" else "gradient-boosting",
        "selection": {"rule": SELECTION_RULE, "model": chosen["name"],
                      **({"seed": chosen["seed"]} if chosen["kind"] == "sign" else {}),
                      "reason": (f"Highest out-of-fold PR-AUC ({chosen['oof_pr_auc']:.3f}) of the "
                                 f"{len(CANDIDATES)} candidates in {FOLDS}-fold cross-validation grouped by website.")},
        "crossValidation": cross_validation,
        "architecture": architecture,
        "trainedAt": report["generated"],
        "data": {k: report["data"][k] for k in ("sites", "sources", "rows", "positives", "frameworks", "categories",
                                                  "splits", "folds", "note", "rows_excluded_delegated")},
        "metrics": {
            "test": {k: shipped.get(k) for k in ("model", "pr_auc", "pr_auc_ci95", "precision", "precision_ci95",
                                                 "recall", "recall_ci95", "ece", "flagged", "tp", "fp", "fn")},
            "comparisons": [{k: c[k] for k in ("model", "pr_auc", "precision", "recall", "threshold", "oof_pr_auc")
                             if k in c} for c in comparisons],
            "ablations": [{"model": a["model"], "pr_auc": a["pr_auc_mean"]} for a in ablations],
            "heldOutSources": {k: strict[k] for k in ("sign_pr_auc", "gbt_neighbourhood_pr_auc", "test_rows", "test_positives")},
            "seeds": {"pr_auc": seed_test, "mean": float(np.mean(seed_test)) if seed_test else None,
                      "sd": float(np.std(seed_test)) if seed_test else None,
                      "runs": seed_runs, **({"shipped": chosen["seed"]} if chosen["kind"] == "sign" else {}),
                      "rule": "the seeds are candidates like the others, compared by out-of-fold PR-AUC; test scores are never used",
                      "note": "test PR-AUC of the graph network trained with each seed, in seed order"},
            "byFramework": breakdowns["framework"],
            "byCategory": breakdowns["category"],
        },
        "gate": gate,
        "defaultOn": False,  # set by npm run ml:bench once latency is measured and every condition passes
    }
    # Values that need a threshold say "not reached" when no threshold met the rule.
    if ship_threshold is None:
        not_reached(manifest, ("threshold",))
        not_reached(manifest["operatingThreshold"], ("value",))
        not_reached(manifest["operatingThreshold"]["test"], THRESHOLD_KEYS + ("recall_ci95",))
        not_reached(manifest["metrics"]["test"], THRESHOLD_KEYS + ("recall_ci95",))
        not_reached(manifest["gate"]["precision"], ("value",))
        for r in manifest["metrics"]["byFramework"] + manifest["metrics"]["byCategory"]:
            not_reached(r, THRESHOLD_KEYS)
    for c in manifest["metrics"]["comparisons"] + manifest["crossValidation"]["candidates"]:
        if c.get("threshold") is None:
            not_reached(c, THRESHOLD_KEYS)
    # Anything else left unmeasured (for example precision when a threshold
    # flags nothing on the test sites) says so instead of holding null.
    for key in ("metrics", "operatingThreshold", "crossValidation"):
        manifest[key] = fill_unmeasured(manifest[key])
    manifest["gate"]["precision"] = fill_unmeasured(manifest["gate"]["precision"])
    manifest["gate"]["beats_best_gbt"] = fill_unmeasured(manifest["gate"]["beats_best_gbt"])
    if not extras:  # no graph network: leave out the sections that only describe one
        for key in ("seeds", "ablations", "heldOutSources"):
            manifest["metrics"].pop(key)
    (args.out / "clickables-v1.json").write_text(dump(manifest) + "\n")
    print(json.dumps({"chosen": chosen["name"], "shipped": shipped, "gate": gate}, indent=1, default=float))
    print("finished in", round(time.time() - t0), "s")


if __name__ == "__main__":
    main()
