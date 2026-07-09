#!/usr/bin/env python3
"""Trains the softmax-regression genre classifier and exports it as JSON.

The exported file matches src-tauri/src/ai/trained_classifier.rs's
`TrainedModel` struct exactly: a feature mean/std for z-scoring plus one
weight row + bias per class. That keeps the "model" to a dozen floats per
genre - a real micro-model, not a marketing term - so the Rust app can
run inference with a plain dot product and no ML runtime dependency.

Usage:
    python train.py --features features.csv --out genre_classifier.json
"""

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from features import FEATURE_NAMES


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--features", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--test-size", type=float, default=0.2)
    args = parser.parse_args()

    df = pd.read_csv(args.features)
    x = df[FEATURE_NAMES].to_numpy(dtype=np.float64)
    y = df["genre"].to_numpy()

    x_train, x_test, y_train, y_test = train_test_split(
        x, y, test_size=args.test_size, random_state=0, stratify=y
    )

    scaler = StandardScaler().fit(x_train)
    x_train_scaled = scaler.transform(x_train)
    x_test_scaled = scaler.transform(x_test)

    clf = LogisticRegression(max_iter=2000)
    clf.fit(x_train_scaled, y_train)

    if len(clf.classes_) == 2:
        # sklearn collapses binary logistic regression to a single weight
        # row; duplicate/negate it so the exported model always has one
        # row per class, matching what the Rust softmax expects.
        coef = np.vstack([-clf.coef_[0], clf.coef_[0]])
        intercept = np.array([-clf.intercept_[0], clf.intercept_[0]])
    else:
        coef = clf.coef_
        intercept = clf.intercept_

    train_acc = clf.score(x_train_scaled, y_train)
    test_acc = clf.score(x_test_scaled, y_test)
    print(f"train accuracy: {train_acc:.3f}")
    print(f"test accuracy:  {test_acc:.3f}")

    model = {
        "classes": list(clf.classes_),
        "feature_mean": scaler.mean_.tolist(),
        "feature_std": scaler.scale_.tolist(),
        "weights": coef.tolist(),
        "biases": intercept.tolist(),
    }

    args.out.write_text(json.dumps(model, indent=2))
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
