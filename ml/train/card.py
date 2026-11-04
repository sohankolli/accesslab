"""Adds the hand-written model card notes (reports/model-card-notes.json) to the
manifest and publishes the reliability diagram next to the model.

    python train/card.py --out ../public/models --reports reports
"""
import argparse
import json
import shutil
from pathlib import Path

ap = argparse.ArgumentParser(description=__doc__)
ap.add_argument("--out", type=Path, default=Path("../public/models"))
ap.add_argument("--reports", type=Path, default=Path("reports"))
args = ap.parse_args()

manifest_path = args.out / "clickables-v1.json"
manifest = json.loads(manifest_path.read_text())
notes = json.loads((args.reports / "model-card-notes.json").read_text())
manifest["card"] = {k: notes[k] for k in ("summary", "failurePatterns", "limitations")}
probe = args.reports / "label-probe.json"
if probe.exists():
    manifest["card"]["labelProbe"] = json.loads(probe.read_text())["summary"]
    if notes.get("labelProbeReading"):
        manifest["card"]["labelProbe"]["reading"] = notes["labelProbeReading"]
audit = args.reports / "label-handcheck.json"
manifest["card"].pop("automatedLabelAudit", None)  # older name of labelHandCheck
if audit.exists():
    manifest["card"]["labelHandCheck"] = {
        **json.loads(audit.read_text()),
        "method": notes["labelHandCheckMethod"],
        "reading": notes["labelHandCheckReading"],
    }
manifest_path.write_text(json.dumps(manifest, indent=1) + "\n")
shutil.copyfile(args.reports / "reliability.svg", args.out / "clickables-v1-reliability.svg")
print("model card notes added to", manifest_path)
