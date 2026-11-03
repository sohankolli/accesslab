"""ONNX export for scikit-learn's HistGradientBoostingClassifier (binary).

skl2onnx 1.20 cannot convert this model under scikit-learn 1.9, so the trees
are written out directly: one ai.onnx.ml TreeEnsembleRegressor that sums the
trees (the model's raw score), then the temperature and a sigmoid, so the
browser receives calibrated probabilities exactly as from the graph network.
Checked against scikit-learn's own decision_function by train.py.
"""
from __future__ import annotations

import numpy as np
import onnx
from onnx import TensorProto, helper


def export_hist_gbt(model, temperature: float, n_features: int, path: str) -> None:
    if model.n_trees_per_iteration_ != 1:
        raise ValueError("only binary classifiers are supported")
    attrs = {k: [] for k in (
        "nodes_treeids", "nodes_nodeids", "nodes_featureids", "nodes_values", "nodes_modes",
        "nodes_truenodeids", "nodes_falsenodeids", "nodes_missing_value_tracks_true",
        "target_treeids", "target_nodeids", "target_ids", "target_weights",
    )}
    for tree_id, (predictor,) in enumerate(model._predictors):
        nodes = predictor.nodes
        for node_id, node in enumerate(nodes):
            attrs["nodes_treeids"].append(tree_id)
            attrs["nodes_nodeids"].append(node_id)
            if node["is_leaf"]:
                attrs["nodes_featureids"].append(0)
                attrs["nodes_values"].append(0.0)
                attrs["nodes_modes"].append("LEAF")
                attrs["nodes_truenodeids"].append(0)
                attrs["nodes_falsenodeids"].append(0)
                attrs["nodes_missing_value_tracks_true"].append(0)
                attrs["target_treeids"].append(tree_id)
                attrs["target_nodeids"].append(node_id)
                attrs["target_ids"].append(0)
                attrs["target_weights"].append(float(node["value"]))
            else:
                if node["is_categorical"]:
                    raise ValueError("categorical splits are not supported")
                attrs["nodes_featureids"].append(int(node["feature_idx"]))
                attrs["nodes_values"].append(float(node["num_threshold"]))
                attrs["nodes_modes"].append("BRANCH_LEQ")  # x <= threshold goes left
                attrs["nodes_truenodeids"].append(int(node["left"]))
                attrs["nodes_falsenodeids"].append(int(node["right"]))
                attrs["nodes_missing_value_tracks_true"].append(int(bool(node["missing_go_to_left"])))

    baseline = float(np.ravel(model._baseline_prediction)[0])
    trees = helper.make_node(
        "TreeEnsembleRegressor", ["x"], ["raw"], domain="ai.onnx.ml",
        n_targets=1, aggregate_function="SUM", base_values=[baseline], post_transform="NONE", **attrs,
    )
    nodes = [
        trees,
        helper.make_node("Constant", [], ["t"], value=helper.make_tensor("t", TensorProto.FLOAT, [], [temperature])),
        helper.make_node("Div", ["raw", "t"], ["scaled"]),
        helper.make_node("Sigmoid", ["scaled"], ["p2"]),
        helper.make_node("Constant", [], ["shape"], value=helper.make_tensor("shape", TensorProto.INT64, [1], [-1])),
        helper.make_node("Reshape", ["p2", "shape"], ["p"]),
    ]
    graph = helper.make_graph(
        nodes, "clickables_gbt",
        [helper.make_tensor_value_info("x", TensorProto.FLOAT, ["n", n_features])],
        [helper.make_tensor_value_info("p", TensorProto.FLOAT, ["n"])],
    )
    model_proto = helper.make_model(
        graph, opset_imports=[helper.make_opsetid("", 17), helper.make_opsetid("ai.onnx.ml", 3)],
        producer_name="accesslab-ml",
    )
    model_proto.ir_version = 8
    onnx.checker.check_model(model_proto)
    onnx.save(model_proto, path)
