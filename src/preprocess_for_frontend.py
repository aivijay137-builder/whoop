"""
preprocess_for_frontend.py
Runs the full EWS pipeline on the nightly CSV and outputs
frontend/public/data/members.json for the React dashboard.

Steps implemented:
  1. Load CSV with pandas, parse dates (DD-MM-YYYY)
  2. Compute 30-night rolling baselines (median + std, shifted by 1)
  3. Flag first 14 nights per member as learning_mode
  4. Compute directional z-scores (floored at 0, positive = adverse)
  5. Quality-gate: quality < 70 → z-score set to NaN
  6. Compute weighted corroboration score
  7. Flag confounders (alcohol, altitude, luteal, overtraining)
  8. Adjust corroboration score for confounders
  9. Assign tiers (with 2- and 3-night lag)
 10. Build per-member JSON: today + 7-day history + confounder note
"""

import json
import math
import pandas as pd
import numpy as np
from pathlib import Path

CSV_PATH    = Path("data/proactive_illness_ews_synthetic_nightly.csv")
OUTPUT_PATH = Path("frontend/public/data/members.json")

WINDOW          = 30
LEARNING_DAYS   = 14
QUALITY_THRESHOLD = 70

METRICS = ["hrv_rmssd", "rhr", "respiratory_rate", "skin_temp", "spo2"]

Z_THRESHOLD  = 1.0
Z_SCALE      = 2.0
METRIC_WEIGHTS = {
    "hrv_rmssd": 0.35,
    "rhr":       0.25,
    "respiratory_rate": 0.20,
    "skin_temp": 0.15,
    "spo2":      0.05,
}

ALTITUDE_CUTOFF     = 1500
STRAIN_HIGH         = 15
OVERTRAINING_WINDOW = 3


# ── 1. Load ──────────────────────────────────────────────────────────────────

def load(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, parse_dates=["date"], dayfirst=True)
    return df.sort_values(["member_id", "date"]).reset_index(drop=True)


# ── 2. Baselines ─────────────────────────────────────────────────────────────

def compute_baselines(df: pd.DataFrame) -> pd.DataFrame:
    for metric in METRICS:
        shifted = df.groupby("member_id")[metric].shift(1)
        grp     = shifted.groupby(df["member_id"])
        df[f"baseline_{metric}"] = grp.transform(
            lambda s: s.rolling(window=WINDOW, min_periods=1).median()
        )
        df[f"std_{metric}"] = grp.transform(
            lambda s: s.rolling(window=WINDOW, min_periods=2).std()
        )
    return df


# ── 3. Learning mode ──────────────────────────────────────────────────────────

def add_learning_mode(df: pd.DataFrame) -> pd.DataFrame:
    df["learning_mode"] = df.groupby("member_id").cumcount() < LEARNING_DAYS
    return df


# ── 4. Z-scores (directional, floored at 0) ───────────────────────────────────

def safe_z(numerator: pd.Series, std: pd.Series) -> pd.Series:
    invalid = std.isna() | (std == 0)
    return (numerator / std.where(~invalid)).where(~invalid)


def compute_zscores(df: pd.DataFrame) -> pd.DataFrame:
    df["z_hrv"]  = safe_z(df["baseline_hrv_rmssd"] - df["hrv_rmssd"],        df["std_hrv_rmssd"]).clip(lower=0)
    df["z_rhr"]  = safe_z(df["rhr"]               - df["baseline_rhr"],       df["std_rhr"]).clip(lower=0)
    df["z_rr"]   = safe_z(df["respiratory_rate"]  - df["baseline_respiratory_rate"], df["std_respiratory_rate"]).clip(lower=0)
    df["z_temp"] = safe_z(df["skin_temp"]         - df["baseline_skin_temp"], df["std_skin_temp"]).clip(lower=0)
    df["z_spo2"] = safe_z(df["baseline_spo2"]     - df["spo2"],               df["std_spo2"]).clip(lower=0)
    return df


# ── 5. Quality gate ───────────────────────────────────────────────────────────

QUALITY_MAP = [
    ("z_hrv",  "hrv_quality"),
    ("z_rhr",  "rhr_quality"),
    ("z_rr",   "rr_quality"),
    ("z_temp", "temp_quality"),
    ("z_spo2", "spo2_quality"),
]

def apply_quality_gate(df: pd.DataFrame) -> pd.DataFrame:
    for z_col, q_col in QUALITY_MAP:
        passes = df[q_col] >= QUALITY_THRESHOLD
        df[f"{z_col}_usable"] = df[z_col].where(passes)
    return df


# ── 6. Corroboration score ────────────────────────────────────────────────────

USABLE_WEIGHTS = [
    ("z_hrv_usable",  0.35),
    ("z_rhr_usable",  0.25),
    ("z_rr_usable",   0.20),
    ("z_temp_usable", 0.15),
    ("z_spo2_usable", 0.05),
]

def compute_corroboration(df: pd.DataFrame) -> pd.DataFrame:
    score = pd.Series(0.0, index=df.index)
    for col, weight in USABLE_WEIGHTS:
        z      = df[col]
        active = z > Z_THRESHOLD
        contrib = weight * (z / Z_SCALE).clip(upper=1.0)
        score  += contrib.where(active, other=0.0).fillna(0.0)
    df["corroboration_score"] = score

    usable_cols = [col for col, _ in USABLE_WEIGHTS]
    flags = pd.DataFrame({col: df[col] > 1.5 for col in usable_cols})
    df["num_metrics_gt_1_5"] = flags.sum(axis=1)
    return df


# ── 7. Confounder flags ───────────────────────────────────────────────────────

def flag_confounders(df: pd.DataFrame) -> pd.DataFrame:
    df["alcohol_flag"]  = df["journal_alcohol"].astype(str).str.upper() == "TRUE"
    df["altitude_flag"] = (
        df["journal_altitude"].astype(str).str.upper() == "TRUE"
    ) | (df["altitude_meters"] >= ALTITUDE_CUTOFF)
    df["luteal_flag"]   = df["cycle_phase"] == "luteal"

    grp = df.groupby("member_id")["strain"]
    prior = pd.DataFrame({
        "d1": grp.shift(1) >= STRAIN_HIGH,
        "d2": grp.shift(2) >= STRAIN_HIGH,
        "d3": grp.shift(3) >= STRAIN_HIGH,
    })
    df["possible_overtraining"] = prior.all(axis=1)
    return df


# ── 8. Score adjustment ───────────────────────────────────────────────────────

SPO2_WEIGHT = 0.05

def adjust_scores(df: pd.DataFrame) -> pd.DataFrame:
    df["corroboration_score_raw"] = df["corroboration_score"]
    adj = df["corroboration_score"].copy()

    # Altitude: remove SpO2 contribution
    z_spo2 = df["z_spo2_usable"]
    spo2_contrib = (SPO2_WEIGHT * (z_spo2 / Z_SCALE).clip(upper=1.0)).where(
        z_spo2 > Z_THRESHOLD, other=0.0
    ).fillna(0.0)
    adj = adj.where(~df["altitude_flag"], adj - spo2_contrib)

    adj = adj.where(~df["alcohol_flag"],  adj * 0.75)
    adj = adj.where(~df["luteal_flag"],   adj * 0.90)
    adj = adj.where(~df["possible_overtraining"], adj * 0.80)

    df["corroboration_score_adjusted"] = adj.clip(lower=0.0)
    return df


# ── 9. Tier assignment ────────────────────────────────────────────────────────

def assign_tiers(df: pd.DataFrame) -> pd.DataFrame:
    grp   = df.groupby("member_id")["corroboration_score_adjusted"]
    lag1  = grp.shift(1)
    lag2  = grp.shift(2)
    score = df["corroboration_score_adjusted"]
    n15   = df["num_metrics_gt_1_5"]

    tier1 = (score >= 0.35) & (n15 >= 2)
    tier2 = ((score >= 0.55) & (lag1 >= 0.55)) | ((score >= 0.75) & (n15 >= 3))
    tier3 = (score >= 0.75) & (lag1 >= 0.75) & (lag2 >= 0.75) & (lag1 >= lag2) & (score >= lag1)

    tier = pd.Series(0, index=df.index, dtype=int)
    tier[tier1] = 1
    tier[tier2] = 2
    tier[tier3] = 3
    tier[df["learning_mode"].astype(bool)] = 0

    df["tier"] = tier
    return df


# ── 10. Build per-member output ───────────────────────────────────────────────

def nan_to_none(v):
    """Convert NaN / inf to None for JSON serialisation."""
    if v is None:
        return None
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v


CONFOUNDER_MESSAGES = {
    "alcohol": (
        "You logged alcohol last night. This can temporarily affect HRV, resting "
        "heart rate, and body temperature — your score has been adjusted to account for this."
    ),
    "altitude": (
        "Altitude or travel was logged. SpO₂ has been excluded from your score to "
        "account for environmental effects."
    ),
    "luteal": (
        "Your cycle phase may be contributing to mild signal shifts. "
        "Your score has been adjusted accordingly."
    ),
    "overtraining": (
        "Your recent training load is elevated. Your score has been adjusted to "
        "account for possible overtraining effects."
    ),
}


def build_confounder(row) -> dict | None:
    if row.get("alcohol_flag"):
        return {"type": "alcohol", "message": CONFOUNDER_MESSAGES["alcohol"]}
    if row.get("altitude_flag"):
        return {"type": "altitude", "message": CONFOUNDER_MESSAGES["altitude"]}
    if row.get("luteal_flag"):
        return {"type": "luteal", "message": CONFOUNDER_MESSAGES["luteal"]}
    if row.get("possible_overtraining"):
        return {"type": "overtraining", "message": CONFOUNDER_MESSAGES["overtraining"]}
    return None


def build_today(row: pd.Series) -> dict:
    lm = bool(row.get("learning_mode", False))
    idx = row.get("_row_index", 0)  # 0-based position within member

    return {
        "date":   row["date"].strftime("%Y-%m-%d") if pd.notna(row["date"]) else None,
        "tier":   int(row["tier"]),
        "learning_mode": lm,
        "corroboration_score_adjusted": nan_to_none(row.get("corroboration_score_adjusted")),
        "hrv_rmssd":        nan_to_none(row.get("hrv_rmssd")),
        "rhr":              nan_to_none(row.get("rhr")),
        "respiratory_rate": nan_to_none(row.get("respiratory_rate")),
        "skin_temp":        nan_to_none(row.get("skin_temp")),
        "spo2":             nan_to_none(row.get("spo2")),
        "baseline_hrv_rmssd":        nan_to_none(row.get("baseline_hrv_rmssd")),
        "baseline_rhr":              nan_to_none(row.get("baseline_rhr")),
        "baseline_respiratory_rate": nan_to_none(row.get("baseline_respiratory_rate")),
        "baseline_skin_temp":        nan_to_none(row.get("baseline_skin_temp")),
        "baseline_spo2":             nan_to_none(row.get("baseline_spo2")),
        "z_hrv":  nan_to_none(row.get("z_hrv")),
        "z_rhr":  nan_to_none(row.get("z_rhr")),
        "z_rr":   nan_to_none(row.get("z_rr")),
        "z_temp": nan_to_none(row.get("z_temp")),
        "z_spo2": nan_to_none(row.get("z_spo2")),
        "hrv_quality":  nan_to_none(row.get("hrv_quality")),
        "rhr_quality":  nan_to_none(row.get("rhr_quality")),
        "rr_quality":   nan_to_none(row.get("rr_quality")),
        "temp_quality": nan_to_none(row.get("temp_quality")),
        "spo2_quality": nan_to_none(row.get("spo2_quality")),
        "journal_alcohol":  bool(row.get("alcohol_flag", False)),
        "journal_illness":  str(row.get("journal_illness", "FALSE")).upper() == "TRUE",
        "journal_altitude": bool(row.get("altitude_flag", False)),
        "cycle_phase": row.get("cycle_phase") if str(row.get("cycle_phase", "")) not in ("nan", "", "None") else None,
        "strain": nan_to_none(row.get("strain")),
        "possible_overtraining": bool(row.get("possible_overtraining", False)),
        "daysIntoLearning": int(idx) if lm else None,
        "totalLearningDays": LEARNING_DAYS,
    }


def build_history_entry(row: pd.Series) -> dict:
    return {
        "date":  row["date"].strftime("%Y-%m-%d") if pd.notna(row["date"]) else None,
        "score": nan_to_none(row.get("corroboration_score_adjusted")),
        "tier":  int(row["tier"]),
    }


def build_member_json(member_df: pd.DataFrame) -> dict:
    member_df = member_df.reset_index(drop=True)
    member_df["_row_index"] = member_df.index  # position within member

    latest_row = member_df.iloc[-1]
    history7   = member_df.tail(7)

    today     = build_today(latest_row)
    history   = [build_history_entry(r) for _, r in history7.iterrows()]
    confounder = build_confounder(latest_row.to_dict())

    member_id = latest_row["member_id"]
    return {
        "member": {
            "id": member_id,
            "name": member_id.replace("_", " ").title(),
            "initials": "".join(p[0].upper() for p in member_id.split("_") if p),
        },
        "today":     today,
        "history":   history,
        "confounder": confounder,
    }


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print(f"Loading {CSV_PATH} ...")
    df = load(CSV_PATH)
    print(f"  {len(df):,} rows, {df['member_id'].nunique()} members")

    print("Computing baselines ...")
    df = compute_baselines(df)

    print("Flagging learning mode ...")
    df = add_learning_mode(df)

    print("Computing z-scores ...")
    df = compute_zscores(df)

    print("Applying quality gate ...")
    df = apply_quality_gate(df)

    print("Computing corroboration scores ...")
    df = compute_corroboration(df)

    print("Flagging confounders ...")
    df = flag_confounders(df)

    print("Adjusting scores for confounders ...")
    df = adjust_scores(df)

    print("Assigning tiers ...")
    df = assign_tiers(df)

    print("Building per-member JSON ...")
    member_ids = sorted(df["member_id"].unique().tolist())
    members    = {}
    for mid in member_ids:
        members[mid] = build_member_json(df[df["member_id"] == mid])

    output = {
        "memberIds": member_ids,
        "members":   members,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nDone! {len(member_ids)} members written to {OUTPUT_PATH}")
    tiers = {mid: members[mid]["today"]["tier"] for mid in member_ids}
    from collections import Counter
    print("  Tier distribution (latest day):", dict(Counter(tiers.values())))


if __name__ == "__main__":
    main()
