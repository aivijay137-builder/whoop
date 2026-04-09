"""
08_create_event_log.py
Extracts escalation events (tier > 0) from the scored nightly dataset.

Input:  output/scored_nightly_data.csv
Output: output/escalation_events.csv

One row per member-date where tier > 0.
"""

import pandas as pd
from pathlib import Path

INPUT_PATH  = Path("output/scored_nightly_data.csv")
OUTPUT_PATH = Path("output/escalation_events.csv")

KEEP_COLUMNS = [
    "member_id",
    "date",
    "tier",
    "tier_reason",
    "corroboration_score_raw",
    "corroboration_score_adjusted",
    "z_hrv",
    "z_rhr",
    "z_rr",
    "z_temp",
    "z_spo2",
    "z_hrv_usable",
    "z_rhr_usable",
    "z_rr_usable",
    "z_temp_usable",
    "z_spo2_usable",
    "hrv_quality",
    "rhr_quality",
    "rr_quality",
    "temp_quality",
    "spo2_quality",
    "journal_alcohol",
    "journal_illness",
    "journal_altitude",
    "altitude_meters",
    "cycle_phase",
    "possible_overtraining",
    "notification_type",
    "notification_copy",
    "ground_truth_label",
]


def load(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, parse_dates=["date"])


def extract_events(df: pd.DataFrame) -> pd.DataFrame:
    events = df[df["tier"] > 0][KEEP_COLUMNS].copy()
    return events.sort_values(["member_id", "date"]).reset_index(drop=True)


def save(df: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)


def print_summary(df: pd.DataFrame) -> None:
    total = len(df)
    print(f"\n--- Escalation Event Log Summary ---")
    print(f"  Total events : {total:,}")
    print(f"  Members with events : {df['member_id'].nunique()}")

    print(f"\n  {'Tier':<8}  {'Events':>7}  {'Pct':>6}")
    print(f"  {'-'*8}  {'-'*7}  {'-'*6}")
    for t in sorted(df["tier"].unique()):
        n   = (df["tier"] == t).sum()
        pct = n / total * 100
        print(f"  Tier {t:<3}  {n:>7,}  {pct:>5.1f}%")

    print(f"\n  Ground truth breakdown within events:")
    print(f"  {'label':<20}  {'count':>7}  {'pct':>6}")
    print(f"  {'-'*20}  {'-'*7}  {'-'*6}")
    for label, n in df["ground_truth_label"].value_counts().items():
        pct = n / total * 100
        print(f"  {label:<20}  {n:>7,}  {pct:>5.1f}%")

    print(f"\n  Output saved : {OUTPUT_PATH}")
    print("------------------------------------\n")


def main():
    print(f"Loading {INPUT_PATH} ...")
    df = load(INPUT_PATH)

    print("Extracting escalation events ...")
    events = extract_events(df)

    save(events, OUTPUT_PATH)
    print_summary(events)


if __name__ == "__main__":
    main()
