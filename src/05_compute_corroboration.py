"""
05_compute_corroboration.py
Computes the weighted multi-metric corroboration score per row.

Input:  output/quality_gated_nightly_data.csv
Output: output/corroboration_nightly_data.csv

Scoring:
  A metric only contributes if its usable z-score > 1.0.
  Contribution = weight * min(z / 2.0, 1.0)
  corroboration_score = sum of all metric contributions

Weights:
  HRV = 0.35 | RHR = 0.25 | RR = 0.20 | Temp = 0.15 | SpO2 = 0.05
"""

import pandas as pd
import numpy as np
from pathlib import Path

INPUT_PATH  = Path("output/quality_gated_nightly_data.csv")
OUTPUT_PATH = Path("output/corroboration_nightly_data.csv")

Z_THRESHOLD = 1.0
Z_SCALE     = 2.0

# (usable z-score column, weight)
METRICS = [
    ("z_hrv_usable",  0.35),
    ("z_rhr_usable",  0.25),
    ("z_rr_usable",   0.20),
    ("z_temp_usable", 0.15),
    ("z_spo2_usable", 0.05),
]


def load(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, parse_dates=["date"])


def compute_corroboration(df: pd.DataFrame) -> pd.DataFrame:
    score = pd.Series(0.0, index=df.index)

    for col, weight in METRICS:
        z = df[col]
        active = z > Z_THRESHOLD          # NaN evaluates to False — safe
        contribution = weight * (z / Z_SCALE).clip(upper=1.0)
        score += contribution.where(active, other=0.0).fillna(0.0)

    df["corroboration_score"] = score
    return df


def compute_metric_counts(df: pd.DataFrame) -> pd.DataFrame:
    usable_cols = [col for col, _ in METRICS]

    def count_above(threshold: float) -> pd.Series:
        flags = pd.DataFrame({col: df[col] > threshold for col in usable_cols})
        return flags.sum(axis=1)  # NaN > threshold = False, so safe

    df["num_metrics_gt_1"]   = count_above(1.0)
    df["num_metrics_gt_1_5"] = count_above(1.5)
    df["num_metrics_gt_2"]   = count_above(2.0)
    return df


def save(df: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)


def print_summary(df: pd.DataFrame) -> None:
    s = df["corroboration_score"]

    print("\n--- Corroboration Score Summary ---")
    print(f"  {'stat':<6}  {'value':>8}")
    print(f"  {'-'*6}  {'-'*8}")
    for label, val in [
        ("mean",  s.mean()),
        ("p50",   s.median()),
        ("p75",   s.quantile(0.75)),
        ("p90",   s.quantile(0.90)),
        ("p95",   s.quantile(0.95)),
        ("p99",   s.quantile(0.99)),
        ("max",   s.max()),
    ]:
        print(f"  {label:<6}  {val:>8.4f}")

    print()
    print(f"  Score > 0.10 : {(s > 0.10).sum():,} rows")
    print(f"  Score > 0.25 : {(s > 0.25).sum():,} rows")
    print(f"  Score > 0.50 : {(s > 0.50).sum():,} rows")

    print()
    for col in ["num_metrics_gt_1", "num_metrics_gt_1_5", "num_metrics_gt_2"]:
        vc = df[col].value_counts().sort_index()
        print(f"  {col}: {dict(vc)}")

    print(f"\n  Output saved : {OUTPUT_PATH}")
    print("-----------------------------------\n")


def main():
    print(f"Loading {INPUT_PATH} ...")
    df = load(INPUT_PATH)

    print("Computing corroboration scores ...")
    df = compute_corroboration(df)

    print("Computing metric count helpers ...")
    df = compute_metric_counts(df)

    save(df, OUTPUT_PATH)
    print_summary(df)


if __name__ == "__main__":
    main()
