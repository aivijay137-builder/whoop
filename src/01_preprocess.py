"""
01_preprocess.py
Cleans and validates the raw nightly WHOOP data.

Input:  data/proactive_illness_ews_synthetic_nightly.csv
Output: output/cleaned_nightly_data.csv
"""

import pandas as pd
from pathlib import Path

INPUT_PATH  = Path("data/proactive_illness_ews_synthetic_nightly.csv")
OUTPUT_PATH = Path("output/cleaned_nightly_data.csv")

BOOL_COLUMNS = [
    "journal_alcohol",
    "journal_illness",
    "journal_altitude",
    "is_new_member",
]

QUALITY_COLUMNS = [
    "hrv_quality",
    "rhr_quality",
    "rr_quality",
    "temp_quality",
    "spo2_quality",
]


def load(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    df["date"] = pd.to_datetime(df["date"], format="%d-%m-%Y")
    return df


def sort(df: pd.DataFrame) -> pd.DataFrame:
    return df.sort_values(["member_id", "date"]).reset_index(drop=True)


def cast_booleans(df: pd.DataFrame) -> pd.DataFrame:
    for col in BOOL_COLUMNS:
        df[col] = df[col].map({"TRUE": True, "FALSE": False, True: True, False: False}).astype(bool)
    return df


def drop_duplicates(df: pd.DataFrame) -> pd.DataFrame:
    before = len(df)
    df = df.drop_duplicates()
    removed = before - len(df)
    if removed:
        print(f"  [duplicates] Removed {removed} exact duplicate row(s).")
    return df


def validate(df: pd.DataFrame) -> None:
    errors = []

    null_ids = df["member_id"].isnull().sum()
    if null_ids:
        errors.append(f"member_id has {null_ids} null value(s).")

    null_dates = df["date"].isnull().sum()
    if null_dates:
        errors.append(f"date has {null_dates} null value(s).")

    for col in QUALITY_COLUMNS:
        out_of_range = df[(df[col] < 0) | (df[col] > 100)][col]
        if not out_of_range.empty:
            errors.append(f"{col} has {len(out_of_range)} value(s) outside [0, 100].")

    if errors:
        print("  [validation] FAILED:")
        for e in errors:
            print(f"    - {e}")
        raise ValueError("Validation failed. See errors above.")

    print("  [validation] All checks passed.")


def save(df: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)


def print_summary(input_df: pd.DataFrame, output_df: pd.DataFrame) -> None:
    print("\n--- Run Summary ---")
    print(f"  Input rows   : {len(input_df):,}")
    print(f"  Output rows  : {len(output_df):,}")
    print(f"  Date range   : {output_df['date'].min().date()} → {output_df['date'].max().date()}")
    print(f"  Members      : {output_df['member_id'].nunique()}")
    print(f"  Output saved : {OUTPUT_PATH}")
    print("-------------------\n")


def main():
    print(f"Loading {INPUT_PATH} ...")
    raw = load(INPUT_PATH)

    df = drop_duplicates(raw.copy())
    df = sort(df)
    df = cast_booleans(df)
    validate(df)
    save(df, OUTPUT_PATH)

    print_summary(raw, df)


if __name__ == "__main__":
    main()
