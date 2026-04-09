"""
02_compute_baselines.py
Computes rolling personal baselines (median + std) for each member.

Input:  output/cleaned_nightly_data.csv
Output: output/baseline_nightly_data.csv

Baseline logic (v1):
- 30-night rolling window, prior nights only (shift(1) applied).
- Rolling median  → baseline_<metric>
- Rolling std dev → std_<metric>
- First 14 rows per member are flagged as learning_mode = True.
"""

import pandas as pd
from pathlib import Path

INPUT_PATH  = Path("output/cleaned_nightly_data.csv")
OUTPUT_PATH = Path("output/baseline_nightly_data.csv")

METRICS = [
    "hrv_rmssd",
    "rhr",
    "respiratory_rate",
    "skin_temp",
    "spo2",
]

WINDOW       = 30
LEARNING_DAYS = 14


def load(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, parse_dates=["date"])
    return df.sort_values(["member_id", "date"]).reset_index(drop=True)


def compute_baselines(df: pd.DataFrame) -> pd.DataFrame:
    baseline_cols = {}

    for metric in METRICS:
        # Shift by 1 so current night does not leak into its own baseline
        shifted = df.groupby("member_id")[metric].shift(1)

        # Rolling window applied to the shifted series (grouped by member)
        grouped = shifted.groupby(df["member_id"])

        baseline_cols[f"baseline_{metric}"] = grouped.transform(
            lambda s: s.rolling(window=WINDOW, min_periods=1).median()
        )
        baseline_cols[f"std_{metric}"] = grouped.transform(
            lambda s: s.rolling(window=WINDOW, min_periods=2).std()
        )

    baselines = pd.DataFrame(baseline_cols, index=df.index)
    return pd.concat([df, baselines], axis=1)


def add_learning_mode(df: pd.DataFrame) -> pd.DataFrame:
    row_num = df.groupby("member_id").cumcount()  # 0-indexed
    df["learning_mode"] = row_num < LEARNING_DAYS
    return df


def save(df: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)


def print_summary(df: pd.DataFrame) -> None:
    total = len(df)
    non_null = df["baseline_hrv_rmssd"].notna().sum()
    learning = df["learning_mode"].sum()

    print("\n--- Run Summary ---")
    print(f"  Total rows            : {total:,}")
    print(f"  Rows with baselines   : {non_null:,}  ({non_null / total * 100:.1f}%)")
    print(f"  Rows in learning_mode : {int(learning):,}  ({learning / total * 100:.1f}%)")
    print(f"  Members               : {df['member_id'].nunique()}")
    print(f"  Baseline window       : {WINDOW} nights (prior only)")
    print(f"  Learning period       : first {LEARNING_DAYS} nights per member")
    print(f"  Output saved          : {OUTPUT_PATH}")
    print("-------------------\n")


def main():
    print(f"Loading {INPUT_PATH} ...")
    df = load(INPUT_PATH)

    print("Computing rolling baselines ...")
    df = compute_baselines(df)

    print("Flagging learning mode ...")
    df = add_learning_mode(df)

    save(df, OUTPUT_PATH)
    print_summary(df)


if __name__ == "__main__":
    main()
