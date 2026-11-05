"""Train, compare, calibrate, evaluate and export the click-only controls model.

    python train/train.py --data data/crawl --out ../public/models --reports reports

Every number written by this script is measured here on the crawled data. The
test sites are scored once, after every choice (model, epochs, temperature,
threshold) has been made on the training and calibration sites.
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
    ap.add_argument("--keep-delegated", action="store_true",
                    help="also use pages with document-level click listeners (their 0 labels are unreliable)")
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


OPERATING_RULE = ("the threshold with the best F1 on the calibration websites; "
                  "the test websites are never used to choose it")

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
    return out


def breakdown(ds, p, threshold, field):
    rows = []
    values = getattr(ds, field)
    for v in sorted(set(values.tolist())):
        sel = values == v
        if sel.sum() < 30:
            continue
        prec, rec, counts = M.precision_recall(ds.y[sel], p[sel], threshold)
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

    full = D.load(args.data / "rows.jsonl", args.data / "rows.npz")
    pages = [json.loads(l) for l in open(args.data / "pages.jsonl")]
    # Pages that listen for clicks on the whole document (event delegation) may
    # have clickable elements labelled 0: their labels cannot be trusted, so by
    # default they are left out of training and evaluation alike.
    keep = np.ones(len(full.y), bool) if args.keep_delegated else ~full.delegated
    ds = full.take(np.flatnonzero(keep))
    tr_i, cal_i, te_i, split_seed = D.balanced_split(ds.site, ds.y)
    tr, cal, te = ds.take(tr_i), ds.take(cal_i), ds.take(te_i)
    assert not (set(tr.site) & set(cal.site)) and not (set(tr.site) & set(te.site)) and not (set(cal.site) & set(te.site))

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
            "splits": {"train": split_stats(tr), "calibration": split_stats(cal), "test": split_stats(te)},
            "split_seed": split_seed,
        },
    }
    print(json.dumps(report["data"], indent=1))

    # ---- Baselines, each with a precision-first threshold chosen on calibration sites ----
    comparisons = []
    p_rule_cal, p_rule = rule_scores(cal.X), rule_scores(te.X)
    comparisons.append(summarise("Rule: pointer cursor and not native", te.y, p_rule, 0.5, te.site))

    gbt_el, gbt_el_params, _ = fit_gbt(tr.X[:, :D.NODE_DIM], tr.y, cal.X[:, :D.NODE_DIM], cal.y)
    p_el_cal = gbt_el.predict_proba(cal.X[:, :D.NODE_DIM])[:, 1]
    p_el = gbt_el.predict_proba(te.X[:, :D.NODE_DIM])[:, 1]
    t_el = M.threshold_for_precision(cal.y, p_el_cal, TARGET_PRECISION)
    comparisons.append({**summarise("Gradient boosting, element only", te.y, p_el, t_el, te.site), "params": gbt_el_params})

    gbt_nb, gbt_nb_params, _ = fit_gbt(tr.X, tr.y, cal.X, cal.y)
    p_nb_cal = gbt_nb.predict_proba(cal.X)[:, 1]
    p_nb = gbt_nb.predict_proba(te.X)[:, 1]
    t_nb = M.threshold_for_precision(cal.y, p_nb_cal, TARGET_PRECISION)
    comparisons.append({**summarise("Gradient boosting with neighbourhood", te.y, p_nb, t_nb, te.site), "params": gbt_nb_params})
    print("baselines done", round(time.time() - t0), "s")

    # ---- The spec's fallback: the best baseline, calibrated the same way, against the same gate ----
    z_cal_g, z_te_g = gbt_nb.decision_function(cal.X), gbt_nb.decision_function(te.X)
    t_g = fit_temperature(z_cal_g.astype(np.float32), cal.y)
    p_cal_g = 1 / (1 + np.exp(-z_cal_g / t_g))
    p_te_g = 1 / (1 + np.exp(-z_te_g / t_g))
    thr_g = M.threshold_for_precision(cal.y, p_cal_g, TARGET_PRECISION)
    prec_g, rec_g, _ = M.precision_recall(te.y, p_te_g, thr_g) if thr_g is not None else (float("nan"), float("nan"), {})
    fallback = {
        "model": "Gradient boosting with neighbourhood, temperature-calibrated",
        "threshold": thr_g, "precision": prec_g, "recall": rec_g, "ece": M.ece(te.y, p_te_g),
        "pr_auc": M.pr_auc(te.y, p_te_g),
    }
    fallback["passes_precision_and_calibration"] = bool(
        thr_g is not None and prec_g >= GATE["precision"] and fallback["ece"] <= GATE["ece"]
    )
    print("fallback", fallback)

    # ---- The graph network: three seeds, the one best on calibration sites is shipped ----
    runs = []
    for seed in SEEDS:
        net, info = fit_sign(tr.X, tr.y, cal.X, cal.y, seed=seed, score=M.pr_auc)
        runs.append((info["best_val"], seed, net, info))
        print("sign seed", seed, info)
    runs.sort(key=lambda r: -r[0])
    _, ship_seed, net, ship_info = runs[0]
    # In seed order (0, 1, 2), not in the order they were ranked.
    by_seed = sorted(runs, key=lambda r: r[1])
    seed_test = [M.pr_auc(te.y, 1 / (1 + np.exp(-logits(r[2], te.X)))) for r in by_seed]
    seed_runs = [{"seed": r[1], "calibration_pr_auc": r[0], "test_pr_auc": t} for r, t in zip(by_seed, seed_test)]

    temperature = fit_temperature(logits(net, cal.X), cal.y)
    p_cal = 1 / (1 + np.exp(-logits(net, cal.X) / temperature))
    threshold = M.threshold_for_precision(cal.y, p_cal, TARGET_PRECISION)
    p_te = 1 / (1 + np.exp(-logits(net, te.X) / temperature))
    sign = summarise("SIGN graph network", te.y, p_te, threshold, te.site)
    sign.update({
        "seed": ship_seed, "temperature": temperature, **ship_info,
        "pr_auc_all_seeds": seed_test,
        "ece": M.ece(te.y, p_te), "ece_uncalibrated": M.ece(te.y, 1 / (1 + np.exp(-logits(net, te.X)))),
        "params": int(sum(p.numel() for p in net.parameters())),
    })
    comparisons.append(sign)

    # ---- Ablations: one seed each to fit the time budget ----
    ablations = []
    for name, kw in [("SIGN without class-name words", {"words": False}),
                     ("SIGN without neighbourhood", {"neighbourhood": False})]:
        Xtr, Xcal, Xte = D.mask(tr.X, **kw), D.mask(cal.X, **kw), D.mask(te.X, **kw)
        scores = []
        for seed in SEEDS[:1]:
            n, _ = fit_sign(Xtr, tr.y, Xcal, cal.y, seed=seed, score=M.pr_auc)
            scores.append(M.pr_auc(te.y, 1 / (1 + np.exp(-logits(n, Xte)))))
        ablations.append({"model": name, "pr_auc_mean": float(np.mean(scores)), "pr_auc_all_seeds": scores})
        print(name, scores)

    # ---- A stricter split: whole source repositories held out ----
    groups = np.unique(ds.group)
    rng = np.random.default_rng(7)
    held = set(rng.choice(groups, max(2, round(len(groups) * 0.2)), replace=False).tolist())
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

    # ---- The ship decision (spec section 5): the graph network if it passes the
    # gate, otherwise the best baseline if it passes on the same terms ----
    best_gbt = max(comparisons[1:3], key=lambda c: c["pr_auc"])
    graph_gate = {
        "precision": {"target": f">= {GATE['precision']}", "value": sign["precision"],
                      "pass": bool(threshold is not None and sign["precision"] >= GATE["precision"])},
        "beats_best_gbt": {"target": f"PR-AUC > {best_gbt['model']}", "value": sign["pr_auc"],
                           "baseline": best_gbt["pr_auc"], "pass": bool(sign["pr_auc"] > best_gbt["pr_auc"]),
                           "note": f"shipped seed {ship_seed}; mean over seeds {np.mean(seed_test):.3f}"},
        "ece": {"target": f"<= {GATE['ece']}", "value": sign["ece"], "pass": bool(sign["ece"] <= GATE["ece"])},
    }
    graph_ok = all(g["pass"] for g in graph_gate.values())
    use_fallback = not graph_ok and fallback["passes_precision_and_calibration"]

    artifacts = args.out / "artifacts"
    artifacts.mkdir(exist_ok=True)
    graph_path = (artifacts if use_fallback else args.out) / ("clickables-graph.onnx" if use_fallback else "clickables-v1.onnx")
    graph_model = Calibrated(net, temperature).eval()
    torch.onnx.export(
        graph_model, torch.from_numpy(te.X[:2]), str(graph_path), input_names=["x"], output_names=["p"],
        dynamic_axes={"x": {0: "n"}, "p": {0: "n"}}, opset_version=17, dynamo=False,
    )
    graph_gate["size"] = {"target": f"<= {GATE['size_bytes']} bytes", "value": graph_path.stat().st_size,
                          "pass": bool(graph_path.stat().st_size <= GATE["size_bytes"])}

    onnx_path = args.out / "clickables-v1.onnx"
    if use_fallback:
        from export_gbt import export_hist_gbt
        export_hist_gbt(gbt_nb, t_g, D.ROW_DIM, str(onnx_path))
        p_ship, ship_threshold, ship_temperature = p_te_g, thr_g, t_g
        p_ship_cal = p_cal_g
        reference = lambda X: 1 / (1 + np.exp(-gbt_nb.decision_function(X) / t_g))
        ship_name = "Gradient boosting with neighbourhood (fallback)"
        architecture = (f"gradient-boosted trees over the 552 neighbourhood features ({gbt_nb.n_iter_} trees, "
                        f"up to {gbt_nb_params['max_leaf_nodes']} leaves each), temperature-calibrated")
    else:
        p_ship, ship_threshold, ship_temperature = p_te, threshold, temperature
        p_ship_cal = p_cal
        reference = lambda X: graph_model(torch.from_numpy(X)).detach().numpy()
        ship_name = "SIGN graph network"
        architecture = f"SIGN-style network: 6 view encoders (92->48), head 288->48->1; {sign['params']} parameters"

    import onnxruntime as ort
    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    ref_in = te.X[:50]
    ref_out = np.asarray(reference(ref_in), np.float32)
    parity = float(np.max(np.abs(ref_out - sess.run(["p"], {"x": te.X})[0][:50])))
    full_parity = float(np.max(np.abs(np.asarray(reference(te.X), np.float32) - sess.run(["p"], {"x": te.X})[0])))
    (args.fixtures / "clickables-parity.json").write_text(json.dumps({
        "note": "50 test-site feature rows and the probabilities the training code gives them. "
                "tests/ml/modelParity.test.js checks onnxruntime-web gives the same.",
        "inputs": ref_in.tolist(), "outputs": ref_out.tolist(),
    }))
    size = onnx_path.stat().st_size
    sha = hashlib.sha256(onnx_path.read_bytes()).hexdigest()

    shipped = summarise(ship_name, te.y, p_ship, ship_threshold, te.site)
    shipped["ece"] = M.ece(te.y, p_ship)
    gate = {
        "precision": {"target": f">= {GATE['precision']}", "value": shipped["precision"],
                      "pass": bool(ship_threshold is not None and shipped["precision"] >= GATE["precision"])},
        "beats_best_gbt": graph_gate["beats_best_gbt"] if not use_fallback else {
            "target": "the graph network beats the best gradient-boosting baseline and passes the gate",
            "value": sign["pr_auc"], "baseline": best_gbt["pr_auc"], "pass": False,
            "note": "the graph network missed the gate, so the baseline itself is shipped as the spec's fallback"},
        "ece": {"target": f"<= {GATE['ece']}", "value": shipped["ece"], "pass": bool(shipped["ece"] <= GATE["ece"])},
        "size": {"target": f"<= {GATE['size_bytes']} bytes", "value": size, "pass": bool(size <= GATE["size_bytes"])},
        "latency": {"target": f"<= {GATE['latency_ms']} ms for 2,000 elements in the Web Worker", "value": None,
                    "pass": None, "note": "measured in the browser by npm run ml:bench, which fills this in"},
    }

    # ---- Operating threshold: where the app makes suggestions. Chosen by one
    # fixed rule on the calibration sites only, apart from the ship gate. ----
    op_t, op_f1, op_cal_p, op_cal_r = M.threshold_for_f1(cal.y, p_ship_cal)
    if op_t is None:  # no click-only control on the calibration sites
        raise SystemExit("the calibration split has no positives, so no operating threshold can be chosen")
    op_p, op_r, op_counts = M.precision_recall(te.y, p_ship, op_t)
    operating = {
        "rule": OPERATING_RULE,
        "value": op_t,
        "calibration": {"f1": op_f1, "precision": op_cal_p, "recall": op_cal_r},
        "test": {
            "precision": op_p,
            "precision_ci95": M.site_bootstrap(te.y, p_ship, te.site, lambda yy, pp: M.precision_recall(yy, pp, op_t)[0]),
            "recall": op_r,
            "recall_ci95": M.site_bootstrap(te.y, p_ship, te.site, lambda yy, pp: M.precision_recall(yy, pp, op_t)[1]),
            **op_counts,
        },
    }
    print("operating threshold", operating)

    # ---- Breakdown and error analysis of the shipped model at the operating threshold ----
    t_use = op_t
    breakdowns = {f: breakdown(te, p_ship, t_use, f) for f in ("framework", "category")}
    snippets = load_snippets(args.data / "snippets.jsonl")
    pred = p_ship >= t_use
    rng = np.random.default_rng(3)
    fp_idx = np.flatnonzero(pred & (te.y == 0))
    fn_idx = np.flatnonzero(~pred & (te.y == 1))
    sample = lambda idx: rng.choice(idx, min(50, len(idx)), replace=False) if len(idx) else []
    row = lambda i: {"p": float(p_ship[i]), "site": str(te.site[i]), "category": str(te.category[i]),
                     "snippet": snippets.get(str(te.key[i]), "")}
    errors = {"model": ship_name, "threshold": t_use,
              "false_positives": [row(i) for i in sample(fp_idx)],
              "false_negatives": [row(i) for i in sample(fn_idx)]}
    reliability_svg(M.reliability(te.y, p_ship), args.reports / "reliability.svg", "Reliability on test sites")

    report.update({
        "comparisons": comparisons, "ablations": ablations, "held_out_sources": strict, "fallback": fallback,
        "shipped": shipped, "operating_threshold": operating, "graph_network_gate": graph_gate, "gate": gate,
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
        "temperature": ship_temperature,
        "shipped": "fallback" if use_fallback else "graph",
        "selection": {"model": ship_name, **({} if use_fallback else {"seed": ship_seed}), "reason": (
            "The graph network missed the ship gate and the gradient-boosting fallback passed precision and "
            "calibration, so the fallback ships." if use_fallback else
            "The graph network passed the ship gate." if graph_ok else
            "The graph network missed the ship gate. The gradient-boosting fallback ships only if it passes "
            "precision and calibration, and it did not, so the graph network ships, switched off by default.")},
        "architecture": architecture,
        "trainedAt": report["generated"],
        "data": {k: report["data"][k] for k in ("sites", "sources", "rows", "positives", "frameworks", "categories",
                                                  "splits", "note", "rows_excluded_delegated")},
        "metrics": {
            "test": {k: shipped.get(k) for k in ("model", "pr_auc", "pr_auc_ci95", "precision", "precision_ci95", "recall",
                                             "ece", "flagged", "tp", "fp", "fn")},
            "comparisons": [{k: c.get(k) for k in ("model", "pr_auc", "precision", "recall", "threshold")} for c in comparisons],
            "ablations": [{"model": a["model"], "pr_auc": a["pr_auc_mean"]} for a in ablations],
            "heldOutSources": {k: strict[k] for k in ("sign_pr_auc", "gbt_neighbourhood_pr_auc", "test_rows", "test_positives")},
            "seeds": {"pr_auc": seed_test, "mean": float(np.mean(seed_test)), "sd": float(np.std(seed_test)),
                      "runs": seed_runs, "shipped": ship_seed,
                      "rule": "the seed with the highest PR-AUC on the calibration websites; test scores are never used",
                      "note": "test PR-AUC of the graph network trained with each seed, in seed order"},
            "graphNetwork": {"gate": graph_gate, "precision": sign["precision"], "recall": sign["recall"], "ece": sign["ece"]},
            "byFramework": breakdowns["framework"],
            "byCategory": breakdowns["category"],
        },
        "gate": gate,
        "defaultOn": False,  # set by npm run ml:bench once latency is measured and every condition passes
    }
    # A model with no threshold that reaches the target precision has no
    # operating point: say so in every value that depends on one.
    if ship_threshold is None:
        not_reached(manifest, ("threshold",))
        not_reached(manifest["metrics"]["test"], THRESHOLD_KEYS)
        not_reached(manifest["gate"]["precision"], ("value",))
    for c in manifest["metrics"]["comparisons"]:
        if c.get("threshold") is None:
            not_reached(c, THRESHOLD_KEYS)
    if threshold is None:
        not_reached(manifest["metrics"]["graphNetwork"], ("precision", "recall"))
        not_reached(manifest["metrics"]["graphNetwork"]["gate"]["precision"], ("value",))
    (args.out / "clickables-v1.json").write_text(dump(manifest) + "\n")
    if use_fallback:  # the graph network, ready for the benchmark and for comparison
        graph_manifest = {**manifest, "model": "clickables-graph.onnx",
                          "threshold": NOT_REACHED if threshold is None else threshold,
                          "temperature": temperature, "shipped": "graph"}
        (artifacts / "clickables-graph.json").write_text(dump(graph_manifest) + "\n")
    print(json.dumps({"shipped": shipped, "gate": gate, "graph_gate": graph_gate}, indent=1, default=float))
    print("finished in", round(time.time() - t0), "s")


if __name__ == "__main__":
    main()
