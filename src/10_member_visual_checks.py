"""
10_member_visual_checks.py
Generates multi-panel time-series charts for 5 representative members.

Input:  output/scored_nightly_data.csv
Output: output/member_charts/member_<member_id>_<scenario>.png
"""

import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from pathlib import Path

INPUT_PATH = Path("output/scored_nightly_data.csv")
OUTPUT_DIR = Path("output/member_charts")

# Metric panels: (observed_col, baseline_col, y_label, line_color)
METRIC_PANELS = [
    ("hrv_rmssd",        "baseline_hrv_rmssd",        "HRV RMSSD (ms)",    "#1f77b4"),
    ("rhr",              "baseline_rhr",               "RHR (bpm)",         "#d62728"),
    ("respiratory_rate", "baseline_respiratory_rate",  "Resp. Rate (br/m)", "#2ca02c"),
    ("skin_temp",        "baseline_skin_temp",         "Skin Temp (°C)",    "#ff7f0e"),
    ("spo2",             "baseline_spo2",              "SpO₂ (%)",          "#9467bd"),
]

TIER_COLORS = {0: "#f0f0f0", 1: "#fff3b0", 2: "#ffd580", 3: "#ff6b6b"}

JOURNAL_STYLES = {
    "journal_illness":  dict(color="#d62728", ls="--", lw=1.2, label="illness"),
    "journal_alcohol":  dict(color="#7b2d8b", ls=":",  lw=1.0, label="alcohol"),
    "journal_altitude": dict(color="#8c564b", ls="-.", lw=1.0, label="altitude"),
}


# ---------------------------------------------------------------------------
# Member selection
# ---------------------------------------------------------------------------

SCENARIOS = [
    {
        "label": "illness",
        "description": "illness episode with Tier 2/3 alert",
        "mask": lambda df: (
            df.groupby("member_id").apply(
                lambda g: (g["ground_truth_label"] == "illness").any() and (g["tier"] >= 2).any()
            )
        ),
    },
    {
        "label": "alcohol",
        "description": "one or more alcohol-reported nights",
        "mask": lambda df: (
            df.groupby("member_id")["journal_alcohol"].any()
        ),
    },
    {
        "label": "altitude",
        "description": "altitude_effect ground truth label",
        "mask": lambda df: (
            df.groupby("member_id").apply(
                lambda g: (g["ground_truth_label"] == "altitude_effect").any()
            )
        ),
    },
    {
        "label": "overtraining",
        "description": "overtraining ground truth label",
        "mask": lambda df: (
            df.groupby("member_id").apply(
                lambda g: (g["ground_truth_label"] == "overtraining").any()
            )
        ),
    },
    {
        "label": "learning_mode",
        "description": "first 14 days mostly in learning_mode with tier 0",
        "mask": lambda df: (
            df.groupby("member_id").apply(
                lambda g: (
                    g.sort_values("date").head(14)["learning_mode"].astype(bool).sum() >= 10
                )
            )
        ),
    },
]


def select_members(df: pd.DataFrame) -> list[dict]:
    used = set()
    selections = []

    for scenario in SCENARIOS:
        qualifying = scenario["mask"](df)
        # qualifying is a boolean Series indexed by member_id
        candidates = qualifying[qualifying & ~qualifying.index.isin(used)].index.tolist()

        if candidates:
            chosen = candidates[0]
            note = f"Exact match — {scenario['description']}"
        else:
            # Fallback: pick any unused member
            all_members = df["member_id"].unique().tolist()
            fallback = [m for m in all_members if m not in used]
            if not fallback:
                print(f"  [warn] No member available for scenario '{scenario['label']}', skipping.")
                continue
            chosen = fallback[0]
            note = f"Fallback (no exact match for: {scenario['description']})"

        used.add(chosen)
        selections.append({
            "member_id":  chosen,
            "label":      scenario["label"],
            "note":       note,
            "out_file":   OUTPUT_DIR / f"member_{chosen}_{scenario['label']}.png",
        })

    return selections


# ---------------------------------------------------------------------------
# Chart builder
# ---------------------------------------------------------------------------

def draw_tier_background(ax: plt.Axes, dates: pd.Series, tiers: pd.Series) -> None:
    for date, tier in zip(dates, tiers):
        color = TIER_COLORS.get(int(tier), "#f0f0f0")
        ax.axvspan(
            date - pd.Timedelta(hours=12),
            date + pd.Timedelta(hours=12),
            color=color, alpha=0.55, linewidth=0,
        )


def draw_journal_markers(ax: plt.Axes, mdf: pd.DataFrame) -> None:
    for col, style in JOURNAL_STYLES.items():
        if col not in mdf.columns:
            continue
        flagged_dates = mdf.loc[mdf[col].astype(bool), "date"]
        for date in flagged_dates:
            ax.axvline(date, **{k: v for k, v in style.items() if k != "label"}, alpha=0.8)


def format_date_axis(ax: plt.Axes) -> None:
    ax.xaxis.set_major_locator(mdates.WeekdayLocator(byweekday=mdates.MO, interval=2))
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%d %b"))
    plt.setp(ax.get_xticklabels(), rotation=30, ha="right", fontsize=7)


def plot_member(member_id: str, label: str, df: pd.DataFrame, out_path: Path) -> None:
    mdf = df[df["member_id"] == member_id].sort_values("date").reset_index(drop=True)

    n_panels = len(METRIC_PANELS) + 2  # 5 metrics + score + tier
    fig, axes = plt.subplots(
        n_panels, 1,
        figsize=(13, n_panels * 2.0),
        sharex=True,
        gridspec_kw={"hspace": 0.06, "height_ratios": [2, 2, 2, 2, 2, 2.5, 1.5]},
    )

    fig.suptitle(
        f"{member_id}  ·  Scenario: {label}",
        fontsize=12, fontweight="bold", y=1.002,
    )

    # --- Metric panels (0–4) ---
    for ax, (obs_col, base_col, ylabel, color) in zip(axes[:5], METRIC_PANELS):
        draw_tier_background(ax, mdf["date"], mdf["tier"])

        if obs_col in mdf.columns:
            ax.plot(mdf["date"], mdf[obs_col], color=color, lw=1.5, label="Observed")
        if base_col in mdf.columns:
            ax.plot(mdf["date"], mdf[base_col], color="black", lw=1.0,
                    ls="--", alpha=0.55, label="Baseline")

        draw_journal_markers(ax, mdf)
        ax.set_ylabel(ylabel, fontsize=8)
        ax.tick_params(axis="y", labelsize=7)
        ax.grid(axis="y", lw=0.3, alpha=0.4)
        ax.legend(fontsize=7, loc="upper right", framealpha=0.5)

    # --- Corroboration score panel (5) ---
    ax_score = axes[5]
    draw_tier_background(ax_score, mdf["date"], mdf["tier"])
    ax_score.plot(mdf["date"], mdf["corroboration_score_adjusted"],
                  color="#393b79", lw=1.5, label="Corroboration score")
    for thresh, tier_label, col in [
        (0.35, "T1 ≥0.35", "#bcbd22"),
        (0.55, "T2 ≥0.55", "#ff7f0e"),
        (0.75, "T3 ≥0.75", "#d62728"),
    ]:
        ax_score.axhline(thresh, color=col, lw=0.8, ls="--", alpha=0.75, label=tier_label)

    draw_journal_markers(ax_score, mdf)
    ax_score.set_ylabel("Corroboration\nScore", fontsize=8)
    ax_score.set_ylim(-0.02, 1.05)
    ax_score.tick_params(axis="y", labelsize=7)
    ax_score.grid(axis="y", lw=0.3, alpha=0.4)
    ax_score.legend(fontsize=7, loc="upper right", framealpha=0.5, ncol=2)

    # --- Tier panel (6) ---
    ax_tier = axes[6]
    ax_tier.step(mdf["date"], mdf["tier"], where="mid", color="#636363", lw=1.2)
    ax_tier.fill_between(mdf["date"], mdf["tier"], step="mid",
                          color="#636363", alpha=0.15)
    ax_tier.set_ylabel("Tier", fontsize=8)
    ax_tier.set_yticks([0, 1, 2, 3])
    ax_tier.set_ylim(-0.2, 3.6)
    ax_tier.tick_params(axis="y", labelsize=7)
    ax_tier.grid(axis="y", lw=0.3, alpha=0.4)

    # --- X-axis formatting (bottom panel only) ---
    format_date_axis(ax_tier)

    # --- Shared legend for journal markers and tier background ---
    legend_patches = [
        plt.Rectangle((0, 0), 1, 1, fc=TIER_COLORS[1], alpha=0.7, label="Tier 1"),
        plt.Rectangle((0, 0), 1, 1, fc=TIER_COLORS[2], alpha=0.7, label="Tier 2"),
        plt.Rectangle((0, 0), 1, 1, fc=TIER_COLORS[3], alpha=0.7, label="Tier 3"),
        plt.Line2D([0], [0], color="#d62728", ls="--", lw=1.2, label="Journal: illness"),
        plt.Line2D([0], [0], color="#7b2d8b", ls=":",  lw=1.0, label="Journal: alcohol"),
        plt.Line2D([0], [0], color="#8c564b", ls="-.", lw=1.0, label="Journal: altitude"),
    ]
    fig.legend(
        handles=legend_patches, loc="lower center", ncol=6,
        fontsize=8, framealpha=0.85, bbox_to_anchor=(0.5, -0.025),
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(out_path, dpi=120, bbox_inches="tight")
    plt.close(fig)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print(f"Loading {INPUT_PATH} ...")
    df = pd.read_csv(INPUT_PATH, parse_dates=["date"])

    for col in ["journal_illness", "journal_alcohol", "journal_altitude", "learning_mode"]:
        df[col] = df[col].astype(bool)

    print("\nSelecting members ...")
    selections = select_members(df)

    if not selections:
        print("No members selected. Exiting.")
        return

    print(f"\nGenerating {len(selections)} chart(s) ...\n")
    for s in selections:
        plot_member(s["member_id"], s["label"], df, s["out_file"])

    print("\n--- Selected Members ---")
    print(f"  {'Member':<14}  {'Scenario':<14}  {'Selection note'}")
    print(f"  {'-'*14}  {'-'*14}  {'-'*45}")
    for s in selections:
        print(f"  {s['member_id']:<14}  {s['label']:<14}  {s['note']}")
        print(f"  {'':14}  {'':14}  → {s['out_file']}")

    print(f"\n  Charts saved to: {OUTPUT_DIR}/")
    print("------------------------\n")


if __name__ == "__main__":
    main()
