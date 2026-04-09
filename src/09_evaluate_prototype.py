"""
09_evaluate_prototype.py
Evaluates the prototype EWS using scored nightly data and escalation events.

Inputs:  output/scored_nightly_data.csv
         output/escalation_events.csv
Outputs: output/evaluation_summary.csv
         docs/evaluation_notes.md
"""

import pandas as pd
from pathlib import Path

SCORED_PATH  = Path("output/scored_nightly_data.csv")
EVENTS_PATH  = Path("output/escalation_events.csv")
SUMMARY_PATH = Path("output/evaluation_summary.csv")
NOTES_PATH   = Path("docs/evaluation_notes.md")


def load_data() -> tuple[pd.DataFrame, pd.DataFrame]:
    scored = pd.read_csv(SCORED_PATH, parse_dates=["date"])
    events = pd.read_csv(EVENTS_PATH, parse_dates=["date"])
    scored["journal_illness"] = scored["journal_illness"].astype(bool)
    return scored, events


# ---------------------------------------------------------------------------
# Individual metric computations
# ---------------------------------------------------------------------------

def compute_tier_row_counts(scored: pd.DataFrame) -> dict:
    vc = scored["tier"].value_counts()
    return {f"rows_tier_{t}": int(vc.get(t, 0)) for t in range(4)}


def compute_event_tier_counts(events: pd.DataFrame) -> dict:
    vc = events["tier"].value_counts()
    return {f"tier_{t}_events": int(vc.get(t, 0)) for t in [1, 2, 3]}


def compute_gt_event_counts(events: pd.DataFrame) -> dict:
    vc = events["ground_truth_label"].value_counts()
    return {
        "illness_events":        int(vc.get("illness", 0)),
        "healthy_events":        int(vc.get("healthy", 0)),
        "overtraining_events":   int(vc.get("overtraining", 0)),
        "altitude_events":       int(vc.get("altitude_effect", 0)),
    }


def compute_false_positive_proxy(events: pd.DataFrame) -> float:
    total = len(events)
    if total == 0:
        return 0.0
    non_illness = (events["ground_truth_label"] != "illness").sum()
    return round(non_illness / total, 4)


def compute_member_months(scored: pd.DataFrame) -> int:
    """Count unique member_id + year-month combinations."""
    scored = scored.copy()
    scored["year_month"] = scored["date"].dt.to_period("M")
    return scored.groupby("member_id")["year_month"].nunique().sum()


def compute_member_month_false_alerts(events: pd.DataFrame, total_member_months: int) -> float:
    non_illness = (events["ground_truth_label"] != "illness").sum()
    if total_member_months == 0:
        return 0.0
    return round(non_illness / total_member_months, 4)


def compute_illness_detection(scored: pd.DataFrame, events: pd.DataFrame) -> tuple[int, int, float]:
    """
    For each journal_illness=True row, check whether that member had a
    tier >= 2 alert on the same day or within the prior 2 days.
    Returns (total_illness_rows, detected_count, detection_rate).
    """
    illness_rows = (
        scored[scored["journal_illness"]][["member_id", "date"]]
        .copy()
        .reset_index(drop=True)
    )
    total_illness = len(illness_rows)

    if total_illness == 0:
        return 0, 0, 0.0

    tier2plus = (
        events[events["tier"] >= 2][["member_id", "date"]]
        .copy()
        .rename(columns={"date": "alert_date"})
    )

    # Merge illness rows with alerts on the same member
    merged = illness_rows.merge(tier2plus, on="member_id", how="left")
    days_before = (merged["date"] - merged["alert_date"]).dt.days
    # Alert on same day (0) or up to 2 days prior (1, 2)
    in_window = (days_before >= 0) & (days_before <= 2)

    # Tag each original illness row index that had at least one alert in window
    detected_indices = merged.loc[in_window].index.unique()
    detected_count = int(illness_rows.index.isin(detected_indices).sum())
    detection_rate = round(detected_count / total_illness, 4)

    return total_illness, detected_count, detection_rate


# ---------------------------------------------------------------------------
# Assemble full summary
# ---------------------------------------------------------------------------

def build_summary(scored: pd.DataFrame, events: pd.DataFrame) -> pd.DataFrame:
    total_member_months = int(compute_member_months(scored))
    total_illness, detected, detection_rate = compute_illness_detection(scored, events)

    metrics = {
        "total_rows":            len(scored),
        "total_members":         scored["member_id"].nunique(),
        "total_escalation_events": len(events),
        **compute_event_tier_counts(events),
        **compute_gt_event_counts(events),
        "false_positive_proxy":  compute_false_positive_proxy(events),
        "total_member_months":   total_member_months,
        "member_month_false_alerts_proxy": compute_member_month_false_alerts(events, total_member_months),
        "illness_journal_rows":  total_illness,
        "illness_rows_with_prior_tier2plus_alert": detected,
        "illness_detection_rate_prior_2d_or_same_day": detection_rate,
    }

    return pd.DataFrame([{"metric": k, "value": v} for k, v in metrics.items()])


# ---------------------------------------------------------------------------
# Save outputs
# ---------------------------------------------------------------------------

def save_summary(df: pd.DataFrame) -> None:
    SUMMARY_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(SUMMARY_PATH, index=False)


def write_notes(df: pd.DataFrame) -> None:
    m = dict(zip(df["metric"], df["value"]))

    def v(key, fmt=None):
        val = m.get(key, "n/a")
        if fmt and val != "n/a":
            return format(val, fmt)
        return str(val)

    content = f"""\
# Prototype Evaluation Notes

> **Important:** This evaluation uses 100% synthetic data and is a prototype
> sanity check only. It is not clinical validation.

---

## Metric Explanations

### Overview
| Metric | Value |
|---|---|
| Total nightly rows | {v('total_rows', ',')} |
| Total members | {v('total_members')} |
| Total escalation events (tier > 0) | {v('total_escalation_events', ',')} |
| Total member-months | {v('total_member_months')} |

**Total member-months** counts unique member + calendar-month combinations.
It reflects how much exposure the system had, useful for normalising alert rates.

---

### Tier Breakdown
| Tier | Escalation Events |
|---|---|
| Tier 1 (awareness) | {v('tier_1_events', ',')} |
| Tier 2 (advisory) | {v('tier_2_events', ',')} |
| Tier 3 (health advisory) | {v('tier_3_events', ',')} |

**What it means:** shows how often the system fires at each severity level.
A healthy distribution has many Tier 1s, fewer Tier 2s, and rare Tier 3s.

---

### Ground Truth Breakdown of Escalation Events
| Label | Events |
|---|---|
| illness | {v('illness_events', ',')} |
| healthy | {v('healthy_events', ',')} |
| overtraining | {v('overtraining_events', ',')} |
| altitude_effect | {v('altitude_events', ',')} |

**What it means:** shows what was actually happening on nights the system fired.
Ideally, most events fall on illness, overtraining, or altitude nights — not healthy ones.

---

### False Positive Proxy
**Value:** {v('false_positive_proxy')}

**What it means:** the fraction of escalation events that fired on a night
labelled as anything other than illness. Higher = more noise.

**Limitation:** overtraining and altitude_effect events are biologically real —
counting them as false positives overstates the noise. This metric is an
upper bound, not a precise false positive rate.

---

### Member-Month False Alert Proxy
**Value:** {v('member_month_false_alerts_proxy')} non-illness alerts per member per month

**What it means:** normalises the alert burden per member per month. Useful for
estimating how often a real member would receive an alert that is not illness-driven.

**Limitation:** same as above — overtraining and altitude alerts may be appropriate.

---

### Illness Detection Rate
| | |
|---|---|
| Journal illness rows | {v('illness_journal_rows', ',')} |
| Rows with prior/same-day Tier 2+ alert | {v('illness_rows_with_prior_tier2plus_alert', ',')} |
| **Detection rate** | **{v('illness_detection_rate_prior_2d_or_same_day')}** |

**What it means:** of all the nights a member self-reported feeling ill,
what fraction had the system already fired a Tier 2 or Tier 3 alert on
the same day or within the prior 2 days.

**Limitation:** `journal_illness` is self-reported and may lag actual symptom
onset by 1–2 days. In synthetic data this relationship is engineered by design
and does not reflect real-world detection difficulty.

---

## Synthetic Data Caveat

This prototype was evaluated entirely on generated data. The following
limitations apply:

1. **No real biology** — biometric values and labels were simulated.
   Relationships between features and outcomes are assumed, not observed.
2. **No generalisation estimate** — the same dataset was used for rule
   design and evaluation. There is no held-out test set.
3. **Thresholds are not optimised** — tier cutoffs (0.35, 0.55, 0.75, etc.)
   were chosen by design reasoning, not data-driven tuning.
4. **Class imbalance** — ~90% of rows are labelled healthy. Aggregate
   accuracy metrics would be misleading; use per-label breakdowns.
5. **Short observation window** — 90 days per member cannot capture
   seasonal illness variation.

---

## Interpretation Guide

### Good signs
- Illness detection rate is meaningfully above zero (system fires ahead of self-reported illness)
- Tier 3 events are rare (< ~5% of escalations)
- Most non-healthy escalations land on overtraining or altitude_effect (biologically explainable)
- Member-month false alert proxy is low (< 1 per member-month)

### Warning signs
- High proportion of escalation events on healthy nights (system is too sensitive)
- Illness detection rate near zero (thresholds may be too strict)
- Tier 2 and Tier 3 counts are similar (Tier 3 should be much rarer than Tier 2)
- Member-month false alert proxy is high (alert fatigue risk)
"""

    NOTES_PATH.parent.mkdir(parents=True, exist_ok=True)
    NOTES_PATH.write_text(content, encoding="utf-8")


# ---------------------------------------------------------------------------
# Console summary
# ---------------------------------------------------------------------------

def print_console_summary(df: pd.DataFrame) -> None:
    m = dict(zip(df["metric"], df["value"]))
    print("\n--- Evaluation Summary ---")
    print(f"  Total rows                    : {m.get('total_rows'):,}")
    print(f"  Total members                 : {m.get('total_members')}")
    print(f"  Total member-months           : {m.get('total_member_months')}")
    print(f"  Total escalation events       : {m.get('total_escalation_events'):,}")
    print(f"    Tier 1                      : {m.get('tier_1_events'):,}")
    print(f"    Tier 2                      : {m.get('tier_2_events'):,}")
    print(f"    Tier 3                      : {m.get('tier_3_events'):,}")
    print(f"  GT breakdown (illness)        : {m.get('illness_events'):,}")
    print(f"  GT breakdown (healthy)        : {m.get('healthy_events'):,}")
    print(f"  GT breakdown (overtraining)   : {m.get('overtraining_events'):,}")
    print(f"  GT breakdown (altitude)       : {m.get('altitude_events'):,}")
    print(f"  False positive proxy          : {m.get('false_positive_proxy')}")
    print(f"  Member-month FP proxy         : {m.get('member_month_false_alerts_proxy')}")
    print(f"  Illness detection rate        : {m.get('illness_detection_rate_prior_2d_or_same_day')}")
    print(f"\n  Summary saved : {SUMMARY_PATH}")
    print(f"  Notes saved   : {NOTES_PATH}")
    print("--------------------------\n")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("Loading data ...")
    scored, events = load_data()

    print("Computing evaluation metrics ...")
    summary = build_summary(scored, events)

    save_summary(summary)
    write_notes(summary)
    print_console_summary(summary)


if __name__ == "__main__":
    main()
