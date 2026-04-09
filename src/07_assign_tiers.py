"""
07_assign_tiers.py
Assigns escalation tiers based on adjusted corroboration score and temporal rules.

Input:  output/adjusted_nightly_data.csv
Output: output/scored_nightly_data.csv

Tier logic (higher tiers override lower):
  Tier 0 — learning_mode is True
  Tier 1 — score >= 0.35 AND num_metrics_gt_1_5 >= 2
  Tier 2 — (score >= 0.55 for 2 consecutive nights)
            OR (score >= 0.75 AND num_metrics_gt_1_5 >= 3 on single night)
  Tier 3 — score >= 0.75 for 3 consecutive nights AND non-decreasing trend
"""

import pandas as pd
import numpy as np
from pathlib import Path

INPUT_PATH  = Path("output/adjusted_nightly_data.csv")
OUTPUT_PATH = Path("output/scored_nightly_data.csv")

NOTIFICATION_COPY = {
    0: "",
    1: "In-app awareness only",
    2: "Your body may be responding to something — consider prioritizing rest, hydration, and sleep tonight.",
    3: "Multiple metrics have trended away from your baseline for 3+ days. Consider discussing with a healthcare provider if you experience symptoms.",
}

NOTIFICATION_TYPE = {
    0: "none",
    1: "in_app",
    2: "in_app_advisory",
    3: "in_app_health_advisory",
}


def load(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, parse_dates=["date"])
    return df.sort_values(["member_id", "date"]).reset_index(drop=True)


# ---------------------------------------------------------------------------
# Per-member lagged columns
# ---------------------------------------------------------------------------

def add_lagged_scores(df: pd.DataFrame) -> pd.DataFrame:
    """Add prior-night score columns within each member group."""
    grp = df.groupby("member_id")["corroboration_score_adjusted"]
    df["_score_lag1"] = grp.shift(1)
    df["_score_lag2"] = grp.shift(2)
    return df


# ---------------------------------------------------------------------------
# Tier conditions
# ---------------------------------------------------------------------------

def is_tier1(df: pd.DataFrame) -> pd.Series:
    return (
        (df["corroboration_score_adjusted"] >= 0.35) &
        (df["num_metrics_gt_1_5"] >= 2)
    )


def is_tier2(df: pd.DataFrame) -> pd.Series:
    score = df["corroboration_score_adjusted"]

    # 2a: score >= 0.55 for 2 consecutive nights
    consec_2 = (score >= 0.55) & (df["_score_lag1"] >= 0.55)

    # 2b: single night score >= 0.75 with 3+ metrics above 1.5σ
    single_high = (score >= 0.75) & (df["num_metrics_gt_1_5"] >= 3)

    return consec_2 | single_high


def is_tier3(df: pd.DataFrame) -> pd.Series:
    score = df["corroboration_score_adjusted"]

    # 3 consecutive nights all >= 0.75
    consec_3 = (
        (score >= 0.75) &
        (df["_score_lag1"] >= 0.75) &
        (df["_score_lag2"] >= 0.75)
    )

    # Monotonically non-decreasing across those 3 nights (lag2 <= lag1 <= current)
    non_decreasing = (
        (df["_score_lag1"] >= df["_score_lag2"]) &
        (score >= df["_score_lag1"])
    )

    return consec_3 & non_decreasing


# ---------------------------------------------------------------------------
# Tier reason strings
# ---------------------------------------------------------------------------

def build_tier_reason(df: pd.DataFrame, tier: pd.Series) -> pd.Series:
    score = df["corroboration_score_adjusted"].round(3)
    n15   = df["num_metrics_gt_1_5"]

    reasons = pd.Series("", index=df.index)

    mask0 = tier == 0
    reasons[mask0] = "Learning mode — baseline not yet established"

    mask1 = tier == 1
    reasons[mask1] = (
        "Score " + score[mask1].astype(str) +
        " >= 0.35 with " + n15[mask1].astype(str) + " metrics > 1.5σ"
    )

    # Tier 2: distinguish 2a vs 2b for the reason string
    score_raw = df["corroboration_score_adjusted"]
    consec_2  = (score_raw >= 0.55) & (df["_score_lag1"] >= 0.55)
    single_h  = (score_raw >= 0.75) & (df["num_metrics_gt_1_5"] >= 3)

    mask2a = (tier == 2) & consec_2
    mask2b = (tier == 2) & ~consec_2 & single_h
    reasons[mask2a] = (
        "Score >= 0.55 for 2 consecutive nights (prev=" +
        df["_score_lag1"][mask2a].round(3).astype(str) +
        ", curr=" + score[mask2a].astype(str) + ")"
    )
    reasons[mask2b] = (
        "Single-night score " + score[mask2b].astype(str) +
        " >= 0.75 with " + n15[mask2b].astype(str) + " metrics > 1.5σ"
    )

    mask3 = tier == 3
    reasons[mask3] = (
        "Score >= 0.75 for 3 consecutive nights (non-decreasing): " +
        df["_score_lag2"][mask3].round(3).astype(str) + " → " +
        df["_score_lag1"][mask3].round(3).astype(str) + " → " +
        score[mask3].astype(str)
    )

    return reasons


# ---------------------------------------------------------------------------
# Assign tiers
# ---------------------------------------------------------------------------

def assign_tiers(df: pd.DataFrame) -> pd.DataFrame:
    df = add_lagged_scores(df)

    tier = pd.Series(0, index=df.index, dtype=int)

    # Apply in ascending order — higher tiers override
    tier[is_tier1(df)] = 1
    tier[is_tier2(df)] = 2
    tier[is_tier3(df)] = 3

    # Learning mode always wins — force back to 0
    tier[df["learning_mode"].astype(bool)] = 0

    df["tier"]              = tier
    df["tier_reason"]       = build_tier_reason(df, tier)
    df["notification_type"] = tier.map(NOTIFICATION_TYPE)
    df["notification_copy"] = tier.map(NOTIFICATION_COPY)

    # Drop temp lag columns
    df = df.drop(columns=["_score_lag1", "_score_lag2"])
    return df


# ---------------------------------------------------------------------------
# Save + summary
# ---------------------------------------------------------------------------

def save(df: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)


def print_summary(df: pd.DataFrame) -> None:
    total = len(df)
    print("\n--- Tier Assignment Summary ---")
    print(f"  {'Tier':<8}  {'Rows':>7}  {'Pct':>6}  Notification type")
    print(f"  {'-'*8}  {'-'*7}  {'-'*6}  {'-'*24}")
    for t in sorted(df["tier"].unique()):
        rows = (df["tier"] == t).sum()
        pct  = rows / total * 100
        ntype = NOTIFICATION_TYPE[t]
        print(f"  Tier {t:<3}  {rows:>7,}  {pct:>5.1f}%  {ntype}")

    print(f"\n  Total rows   : {total:,}")
    print(f"  Output saved : {OUTPUT_PATH}")
    print("-------------------------------\n")


def main():
    print(f"Loading {INPUT_PATH} ...")
    df = load(INPUT_PATH)

    print("Assigning tiers ...")
    df = assign_tiers(df)

    save(df, OUTPUT_PATH)
    print_summary(df)


if __name__ == "__main__":
    main()
