"""Choose the held-out sites for the framework-pages run.

    python train/heldout.py --data data/crawl-tranco-train --out train/heldout-sites.json

Candidates are the newly included sites: sites whose rows all come from
delegated React, Vue or Angular pages, so the shipped model (trained on
non-delegated pages only) never saw them. About 15% of them are drawn per
framework (at least one per framework), with a fixed seed. Only page facts are
read here, never labels or model output.
"""
from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

FRACTION = 0.15
SEED = 20261106


def choose(site_framework: dict[str, str], fraction: float = FRACTION, seed: int = SEED) -> list[str]:
    rng = np.random.default_rng(seed)
    by_fw = defaultdict(list)
    for s, fw in site_framework.items():
        by_fw[fw].append(s)
    picked = []
    for fw in sorted(by_fw):
        sites = sorted(by_fw[fw])
        n = max(1, round(len(sites) * fraction))
        picked += rng.choice(sites, n, replace=False).tolist()
    return sorted(picked)


def new_site_frameworks(rows_path: Path) -> dict[str, str]:
    """Site -> framework of its delegated pages, for sites with no non-delegated rows."""
    used_before, fw = set(), defaultdict(Counter)
    with open(rows_path) as fh:
        for line in fh:
            # The page facts sit before the feature vector; skip parsing 552 numbers.
            r = json.loads(line[: line.index(',"x":')] + "}") if ',"x":' in line else json.loads(line)
            if r["delegated"]:
                fw[r["site"]][r["framework"]] += 1
            else:
                used_before.add(r["site"])
    return {s: c.most_common(1)[0][0] for s, c in fw.items() if s not in used_before}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, default=Path("data/crawl-tranco-train"))
    ap.add_argument("--out", type=Path, default=Path(__file__).with_name("heldout-sites.json"))
    args = ap.parse_args()
    site_fw = new_site_frameworks(args.data / "rows.jsonl")
    picked = choose(site_fw)
    args.out.write_text(json.dumps(picked, indent=2) + "\n")
    print("candidates per framework", dict(Counter(site_fw.values())))
    print("held out per framework", dict(Counter(site_fw[s] for s in picked)))


if __name__ == "__main__":
    main()
