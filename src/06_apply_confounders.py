"""
06_apply_confounders.py
Applies version-1 confounder adjustments to the corroboration score.

Input:  output/corroboration_nightly_data.csv
Output: output/adjusted_nightly_data.csv

Confounders applied (in order):
  1. Altitude  — removes SpO2 contribution, recomputes base score
  2. Alcohol   — reduces adjusted score by 25%
  3. Luteal    — reduces adjusted score by 10%
  4. Overtraining — reduces adjusted score by 20%
     (triggered when prior 3 consecutive nights all had strain >= 15)

Original score preserved in corroboration_score_raw.
Final output in corroboration_score_adjusted.
"""

import pandas as pd
import numpy as np
from pathlib import Path

INPUT_PATH  = Path("output/corroboration_nightly_data.csv")
OUTPUT_PATH = Path("output/adjusted_nightly_data.csv")

SPO2_WEIGHT     = 0.05
Z_THRESHOLD     = 1.0
Z_SCALE         = 2.0
ALTITUDE_CUTOFF = 1500
STRAIN_HIGH     = 15
OVERTRAINING_WINDOW = 3


def load(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, parse_dates=["date"])
    return df.sort_values(["member_id", "date"]).reset_index(drop=True)


# ---------------------------------------------------------------------------
# Flag helpers
# ---------------------------------------------------------------------------

def flag_alcohol(df: pd.DataFrame) -> pd.DataFrame:
    df["alcohol_flag"] = df["journal_alcohol"].astype(bool)
    return df


def flag_altitude(df: pd.DataFrame) -> pd.DataFrame:
    df["altitude_flag"] = (
        df["journal_altitude"].astype(bool) |
        (df["altitude_meters"] >= ALTITUDE_CUTOFF)
    )
    return df


def flag_luteal(df: pd.DataFrame) -> pd.DataFrame:
    df["luteal_flag"] = df["cycle_phase"] == "luteal"
    return df


def flag_overtraining(df: pd.DataFrame) -> pd.DataFrame:
    """True if the previous 3 consecutive nights all had strain >= STRAIN_HIGH."""
    grp = df.groupby("member_id")["strain"]
    high = (df["strain"] >= STRAIN_HIGH)

    # Shift 1/2/3 within each member group
    prior = pd.DataFrame({
        "d1": grp.shift(1) >= STRAIN_HIGH,
        "d2": grp.shift(2) >= STRAIN_HIGH,
        "d3": grp.shift(3) >= STRAIN_HIGH,
    })
    df["possible_overtraining"] = prior.all(axis=1)
    return df


# ---------------------------------------------------------------------------
# Score adjustments
# ---------------------------------------------------------------------------

def _spo2_contribution(df: pd.DataFrame) -> pd.Series:
    """Recompute the SpO2 contribution that was added in script 05."""
    z = df["z_spo2_usable"]
    active = z > Z_THRESHOLD
    return (SPO2_WEIGHT * (z / Z_SCALE).clip(upper=1.0)).where(active, other=0.0).fillna(0.0)


def adjust_scores(df: pd.DataFrame) -> pd.DataFrame:
    df["corroboration_score_raw"] = df["corroboration_score"]
    adjusted = df["corroboration_score"].copy()

    # 1. Altitude — remove SpO2 contribution and null out adjusted_z_spo2
    df["adjusted_z_spo2"] = df["z_spo2_usable"].where(~df["altitude_flag"])
    spo2_contribution = _spo2_contribution(df)
    adjusted = adjusted.where(~df["altitude_flag"], adjusted - spo2_contribution)

    # 2. Alcohol — 25% reduction
    adjusted = adjusted.where(~df["alcohol_flag"], adjusted * 0.75)

    # 3. Luteal — 10% reduction
    adjusted = adjusted.where(~df["luteal_flag"], adjusted * 0.90)

    # 4. Overtraining — 20% reduction
    adjusted = adjusted.where(~df["possible_overtraining"], adjusted * 0.80)

    df["corroboration_score_adjusted"] = adjusted.clip(lower=0.0)
    return df


# ---------------------------------------------------------------------------
# Save + summary
# ---------------------------------------------------------------------------

def save(df: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)


def print_summary(df: pd.DataFrame) -> None:
    total = len(df)
    flags = [
        ("alcohol_flag",        "Alcohol"),
        ("altitude_flag",       "Altitude"),
        ("luteal_flag",         "Luteal phase"),
        ("possible_overtraining", "Possible overtraining"),
    ]

    print("\n--- Confounder Flag Summary ---")
    for col, label in flags:
        n = df[col].sum()
        print(f"  {label:<24}: {int(n):>5,} rows  ({n / total * 100:.1f}%)")

    raw = df["corroboration_score_raw"]
    adj = df["corroboration_score_adjusted"]
    print(f"\n  {'':30} {'raw':>7}  {'adjusted':>9}")
    print(f"  {'mean corroboration_score':<30} {raw.mean():>7.4f}  {adj.mean():>9.4f}")
    print(f"  {'p95  corroboration_score':<30} {raw.quantile(0.95):>7.4f}  {adj.quantile(0.95):>9.4f}")
    print(f"  {'max  corroboration_score':<30} {raw.max():>7.4f}  {adj.max():>9.4f}")

    print(f"\n  Output saved : {OUTPUT_PATH}")
    print("--------------------------------\n")


def main():
    print(f"Loading {INPUT_PATH} ...")
    df = load(INPUT_PATH)

    print("Flagging confounders ...")
    df = flag_alcohol(df)
    df = flag_altitude(df)
    df = flag_luteal(df)
    df = flag_overtraining(df)

    print("Applying score adjustments ...")
    df = adjust_scores(df)

    save(df, OUTPUT_PATH)
    print_summary(df)


if __name__ == "__main__":
    main()
