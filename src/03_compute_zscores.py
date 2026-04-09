"""
03_compute_zscores.py
Computes directional z-scores for illness-related deviation per metric.

Input:  output/baseline_nightly_data.csv
Output: output/zscore_nightly_data.csv

Direction convention (worse = higher z-score):
  HRV   → lower than baseline is worse  (baseline - value)
  RHR   → higher than baseline is worse (value - baseline)
  RR    → higher than baseline is worse (value - baseline)
  Temp  → higher than baseline is worse (value - baseline)
  SpO2  → lower than baseline is worse  (baseline - value)

Z-scores are floored at 0 (only flag adverse deviations).
Z-score is null if std is 0 or null (insufficient signal).
"""

import pandas as pd
import numpy as np
from pathlib import Path

INPUT_PATH  = Path("output/baseline_nightly_data.csv")
OUTPUT_PATH = Path("output/zscore_nightly_data.csv")


def load(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, parse_dates=["date"])


def safe_zscore(numerator: pd.Series, std: pd.Series) -> pd.Series:
    """Divide numerator by std, returning NaN where std is 0 or null."""
    invalid = std.isna() | (std == 0)
    z = numerator / std.where(~invalid)
    return z.where(~invalid)


def compute_zscores(df: pd.DataFrame) -> pd.DataFrame:
    df["z_hrv"] = safe_zscore(
        df["baseline_hrv_rmssd"] - df["hrv_rmssd"],
        df["std_hrv_rmssd"],
    ).clip(lower=0)

    df["z_rhr"] = safe_zscore(
        df["rhr"] - df["baseline_rhr"],
        df["std_rhr"],
    ).clip(lower=0)

    df["z_rr"] = safe_zscore(
        df["respiratory_rate"] - df["baseline_respiratory_rate"],
        df["std_respiratory_rate"],
    ).clip(lower=0)

    df["z_temp"] = safe_zscore(
        df["skin_temp"] - df["baseline_skin_temp"],
        df["std_skin_temp"],
    ).clip(lower=0)

    df["z_spo2"] = safe_zscore(
        df["baseline_spo2"] - df["spo2"],
        df["std_spo2"],
    ).clip(lower=0)

    return df


def save(df: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)


def print_summary(df: pd.DataFrame) -> None:
    z_cols = ["z_hrv", "z_rhr", "z_rr", "z_temp", "z_spo2"]

    print("\n--- Z-Score Summary ---")
    print(f"  {'column':<10}  {'non-null':>8}  {'null':>6}  {'mean':>6}  {'p50':>6}  {'p95':>6}  {'max':>7}")
    print(f"  {'-'*10}  {'-'*8}  {'-'*6}  {'-'*6}  {'-'*6}  {'-'*6}  {'-'*7}")

    for col in z_cols:
        s = df[col]
        non_null = s.notna().sum()
        null     = s.isna().sum()
        print(
            f"  {col:<10}  {non_null:>8,}  {null:>6,}  "
            f"{s.mean():>6.2f}  {s.median():>6.2f}  "
            f"{s.quantile(0.95):>6.2f}  {s.max():>7.2f}"
        )

    print(f"\n  Output saved : {OUTPUT_PATH}")
    print("-----------------------\n")


def main():
    print(f"Loading {INPUT_PATH} ...")
    df = load(INPUT_PATH)

    print("Computing directional z-scores ...")
    df = compute_zscores(df)

    save(df, OUTPUT_PATH)
    print_summary(df)


if __name__ == "__main__":
    main()
