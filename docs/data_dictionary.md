# Data Dictionary — `proactive_illness_ews_synthetic_nightly.csv`

100 members × 90 nightly rows each = 9,000 rows total. Date range: 01-Jan-2025 → 31-Mar-2025.

| column_name | data_type | meaning | example_value |
|---|---|---|---|
| `member_id` | string | Unique member identifier | `member_001` |
| `date` | string (`DD-MM-YYYY`) | Calendar date of the nightly recording | `14-01-2025` |
| `hrv_rmssd` | float | Heart rate variability — root mean square of successive differences (ms). Higher = better recovery. | `85.05` |
| `rhr` | float | Resting heart rate (bpm). Lower generally indicates better cardiovascular fitness. | `54.79` |
| `respiratory_rate` | float | Breaths per minute during sleep. | `15.06` |
| `skin_temp` | float | Skin temperature (°C). Elevated values can signal illness or fever. | `37.38` |
| `spo2` | float | Blood oxygen saturation (%). Normal range is ~95–100%. | `97.31` |
| `hrv_quality` | float | Signal quality score for HRV measurement (0–100). | `93.4` |
| `rhr_quality` | float | Signal quality score for RHR measurement (0–100). | `93.3` |
| `rr_quality` | float | Signal quality score for respiratory rate measurement (0–100). | `57.8` |
| `temp_quality` | float | Signal quality score for skin temperature measurement (0–100). | `85.5` |
| `spo2_quality` | float | Signal quality score for SpO₂ measurement (0–100). | `91.2` |
| `strain` | float | WHOOP strain score for the day (0–21). Reflects cardiovascular load. | `6.46` |
| `journal_alcohol` | boolean (`TRUE`/`FALSE`) | Member self-reported alcohol consumption that day. | `FALSE` |
| `journal_illness` | boolean (`TRUE`/`FALSE`) | Member self-reported feeling ill that day. | `FALSE` |
| `journal_altitude` | boolean (`TRUE`/`FALSE`) | Member self-reported being at high altitude that day. | `FALSE` |
| `altitude_meters` | float | Altitude in metres if `journal_altitude=TRUE`, otherwise 0. | `0` |
| `cycle_phase` | string | Menstrual cycle phase. `none` for members without cycle tracking. | `follicular` |
| `is_new_member` | boolean (`TRUE`/`FALSE`) | Whether the member was new (first 90-day window). | `TRUE` |
| `ground_truth_label` | string | Labelled health state for that nightly record. Used as the prediction target. | `healthy` |

## `ground_truth_label` values

| value | count | description |
|---|---|---|
| `healthy` | 8,114 | Normal baseline — no notable health event |
| `illness` | 338 | Illness episode (cold, flu, infection, etc.) |
| `overtraining` | 309 | Physiological stress from excessive training load |
| `altitude_effect` | 239 | Metric deviation explained by high altitude exposure |

## `cycle_phase` values

| value | description |
|---|---|
| `none` | Member does not use cycle tracking |
| `follicular` | Post-menstruation phase — typically higher HRV, more energy |
| `luteal` | Post-ovulation phase — typically lower HRV, higher RHR |

## Notes

- All quality scores floor at **40** (not 0) — by design, reflecting minimum sensor confidence.
- Date format is `DD-MM-YYYY`. Parse with `pd.to_datetime(df['date'], format='%d-%m-%Y')`.
- Dataset is **pre-sorted** by `member_id` then `date`.
- **Class imbalance**: `healthy` accounts for ~90% of rows. Use stratified splits and per-class metrics (F1, precision, recall) — not accuracy.
