"""
04_apply_quality_gate.py
Suppresses z-scores where signal quality is below threshold.

Input:  output/zscore_nightly_data.csv
Output: output/quality_gated_nightly_data.csv

Rule:
  If <metric>_quality >= 70 → usable z-score = original z-score
  If <metric>_quality <  70 → usable z-score = null (suppressed)
"""

import pandas as pd
from pathlib import Path

INPUT_PATH  = Path("output/zscore_nightly_data.csv")
OUTPUT_PATH = Path("output/quality_gated_nightly_data.csv")

QUALITY_THRESHOLD = 70

# (z-score column, quality column, usable output column)
METRIC_MAP = [
    ("z_hrv",  "hrv_quality",  "z_hrv_usable"),
    ("z_rhr",  "rhr_quality",  "z_rhr_usable"),
    ("z_rr",   "rr_quality",   "z_rr_usable"),
    ("z_temp", "temp_quality", "z_temp_usable"),
    ("z_spo2", "spo2_quality", "z_spo2_usable"),
]


def load(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, parse_dates=["date"])


def apply_quality_gate(df: pd.DataFrame) -> pd.DataFrame:
    for z_col, q_col, out_col in METRIC_MAP:
        passes = df[q_col] >= QUALITY_THRESHOLD
        df[out_col] = df[z_col].where(passes)
    return df


def save(df: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)


def print_summary(df: pd.DataFrame) -> None:
    total = len(df)
    print(f"\n--- Quality Gate Summary (threshold = {QUALITY_THRESHOLD}) ---")
    print(f"  {'metric':<14}  {'suppressed':>10}  {'pct':>6}  {'usable':>8}")
    print(f"  {'-'*14}  {'-'*10}  {'-'*6}  {'-'*8}")

    for z_col, q_col, out_col in METRIC_MAP:
        suppressed = (df[q_col] < QUALITY_THRESHOLD).sum()
        usable     = total - suppressed
        pct        = suppressed / total * 100
        print(f"  {out_col:<14}  {suppressed:>10,}  {pct:>5.1f}%  {usable:>8,}")

    print(f"\n  Total rows   : {total:,}")
    print(f"  Output saved : {OUTPUT_PATH}")
    print("--------------------------------------------------\n")


def main():
    print(f"Loading {INPUT_PATH} ...")
    df = load(INPUT_PATH)

    print("Applying quality gate ...")
    df = apply_quality_gate(df)

    save(df, OUTPUT_PATH)
    print_summary(df)


if __name__ == "__main__":
    main()
