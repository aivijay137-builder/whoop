/**
 * preprocess_for_frontend.mjs
 * Replicates the full EWS pipeline (scripts 01-09) using Node.js built-ins.
 * Reads data/proactive_illness_ews_synthetic_nightly.csv
 * Outputs frontend/public/data/members.json
 *
 * Pipeline steps:
 *   1. Load & parse CSV (dates: DD-MM-YYYY)
 *   2. Sort by member_id + date
 *   3. 30-night rolling baseline (median + std, shifted by 1 — prior nights only)
 *   4. Flag learning_mode (first 14 nights per member)
 *   5. Directional z-scores (floored at 0; positive = adverse)
 *   6. Quality gate (quality < 70 → z = null)
 *   7. Weighted corroboration score
 *   8. Confounder flags (alcohol, altitude, luteal, overtraining)
 *   9. Confounder score adjustments
 *  10. Tier assignment (with 2- and 3-night lags)
 *  11. Build per-member JSON (today + 7-day history + confounder note)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const CSV_PATH  = resolve(ROOT, 'data', 'proactive_illness_ews_synthetic_nightly.csv');
const OUT_PATH  = resolve(ROOT, 'frontend', 'public', 'data', 'members.json');

// ── Constants ────────────────────────────────────────────────────────────────
const WINDOW           = 30;
const LEARNING_DAYS    = 14;
const Q_THRESHOLD      = 70;
const Z_THRESHOLD      = 1.0;
const Z_SCALE          = 2.0;
const ALTITUDE_CUTOFF  = 1500;
const STRAIN_HIGH      = 15;

const METRIC_WEIGHTS = {
  hrv_rmssd:        0.35,
  rhr:              0.25,
  respiratory_rate: 0.20,
  skin_temp:        0.15,
  spo2:             0.05,
};

const CONFOUNDER_MESSAGES = {
  alcohol:      'You logged alcohol last night. This can temporarily affect HRV, resting heart rate, and body temperature — your score has been adjusted to account for this.',
  altitude:     'Altitude or travel was logged. SpO₂ has been excluded from your score to account for environmental effects.',
  luteal:       'Your cycle phase may be contributing to mild signal shifts. Your score has been adjusted accordingly.',
  overtraining: 'Your recent training load is elevated. Your score has been adjusted to account for possible overtraining effects.',
};


// ── 1. CSV parser ────────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines  = text.trim().split('\n');
  const header = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    const row  = {};
    header.forEach((h, i) => { row[h] = (vals[i] ?? '').trim(); });

    // Parse date DD-MM-YYYY → Date object
    const [d, m, y] = row.date.split('-').map(Number);
    row._date = new Date(y, m - 1, d);

    // Parse numerics
    for (const k of [
      'hrv_rmssd','rhr','respiratory_rate','skin_temp','spo2',
      'hrv_quality','rhr_quality','rr_quality','temp_quality','spo2_quality',
      'strain','altitude_meters',
    ]) {
      row[k] = row[k] === '' || row[k] === 'NA' ? null : parseFloat(row[k]);
    }

    // Parse booleans
    for (const k of ['journal_alcohol','journal_illness','journal_altitude','is_new_member']) {
      row[k] = row[k].toUpperCase() === 'TRUE';
    }

    return row;
  });
}


// ── 2. Sort ──────────────────────────────────────────────────────────────────

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    if (a.member_id < b.member_id) return -1;
    if (a.member_id > b.member_id) return  1;
    return a._date - b._date;
  });
}


// ── 3. Rolling baseline (median + std) per member, shifted by 1 ──────────────

function median(arr) {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

function stddev(arr) {
  if (arr.length < 2) return NaN;
  const mu = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, x) => s + (x - mu) ** 2, 0) / (arr.length - 1));
}

function computeBaselines(memberRows) {
  const metrics = Object.keys(METRIC_WEIGHTS);
  for (let i = 0; i < memberRows.length; i++) {
    const row = memberRows[i];
    // Shifted window: prior nights [0, i-1], up to WINDOW nights
    const start  = Math.max(0, i - WINDOW);
    const window = memberRows.slice(start, i);  // excludes current night

    for (const metric of metrics) {
      const vals = window.map(r => r[metric]).filter(v => v != null);
      row[`baseline_${metric}`] = vals.length >= 1 ? median(vals) : null;
      row[`std_${metric}`]      = vals.length >= 2 ? stddev(vals)  : null;
    }
  }
}


// ── 4. Learning mode ──────────────────────────────────────────────────────────

function addLearningMode(memberRows) {
  memberRows.forEach((row, i) => { row.learning_mode = i < LEARNING_DAYS; });
}


// ── 5. Z-scores ───────────────────────────────────────────────────────────────

function safeZ(numerator, std) {
  if (std == null || std === 0) return null;
  return Math.max(0, numerator / std);
}

function computeZScores(row) {
  row.z_hrv  = safeZ((row.baseline_hrv_rmssd ?? NaN) - row.hrv_rmssd,        row.std_hrv_rmssd);
  row.z_rhr  = safeZ(row.rhr               - (row.baseline_rhr ?? NaN),       row.std_rhr);
  row.z_rr   = safeZ(row.respiratory_rate  - (row.baseline_respiratory_rate ?? NaN), row.std_respiratory_rate);
  row.z_temp = safeZ(row.skin_temp         - (row.baseline_skin_temp ?? NaN), row.std_skin_temp);
  row.z_spo2 = safeZ((row.baseline_spo2 ?? NaN) - row.spo2,                   row.std_spo2);
}


// ── 6. Quality gate ───────────────────────────────────────────────────────────

const QUALITY_MAP = [
  ['z_hrv',  'hrv_quality'],
  ['z_rhr',  'rhr_quality'],
  ['z_rr',   'rr_quality'],
  ['z_temp', 'temp_quality'],
  ['z_spo2', 'spo2_quality'],
];

function applyQualityGate(row) {
  for (const [zCol, qCol] of QUALITY_MAP) {
    const passes = (row[qCol] ?? 0) >= Q_THRESHOLD;
    row[`${zCol}_usable`] = passes ? row[zCol] : null;
  }
}


// ── 7. Corroboration score ────────────────────────────────────────────────────

function computeCorroboration(row) {
  let score = 0;
  let metricsGt1_5 = 0;

  for (const [metric, weight] of Object.entries(METRIC_WEIGHTS)) {
    const zKey = `z_${metric === 'hrv_rmssd' ? 'hrv' : metric === 'respiratory_rate' ? 'rr' : metric === 'skin_temp' ? 'temp' : metric}_usable`;
    const z = row[zKey];
    if (z != null && z > Z_THRESHOLD) {
      score += weight * Math.min(z / Z_SCALE, 1.0);
    }
    if (z != null && z > 1.5) metricsGt1_5++;
  }

  row.corroboration_score   = score;
  row.num_metrics_gt_1_5    = metricsGt1_5;
}


// ── 8. Confounder flags ───────────────────────────────────────────────────────

function flagConfounders(memberRows) {
  memberRows.forEach((row, i) => {
    row.alcohol_flag  = row.journal_alcohol === true;
    row.altitude_flag = row.journal_altitude === true || (row.altitude_meters ?? 0) >= ALTITUDE_CUTOFF;
    row.luteal_flag   = row.cycle_phase === 'luteal';

    // Overtraining: prior 3 consecutive nights all had strain >= STRAIN_HIGH
    if (i >= 3) {
      row.possible_overtraining = (
        (memberRows[i-1].strain ?? 0) >= STRAIN_HIGH &&
        (memberRows[i-2].strain ?? 0) >= STRAIN_HIGH &&
        (memberRows[i-3].strain ?? 0) >= STRAIN_HIGH
      );
    } else {
      row.possible_overtraining = false;
    }
  });
}


// ── 9. Score adjustment ───────────────────────────────────────────────────────

function adjustScore(row) {
  let adj = row.corroboration_score;

  if (row.altitude_flag) {
    const z = row.z_spo2_usable;
    const spo2contrib = (z != null && z > Z_THRESHOLD) ? METRIC_WEIGHTS.spo2 * Math.min(z / Z_SCALE, 1.0) : 0;
    adj -= spo2contrib;
  }
  if (row.alcohol_flag)          adj *= 0.75;
  if (row.luteal_flag)           adj *= 0.90;
  if (row.possible_overtraining) adj *= 0.80;

  row.corroboration_score_adjusted = Math.max(0, adj);
}


// ── 10. Tier assignment ───────────────────────────────────────────────────────

function assignTiers(memberRows) {
  for (let i = 0; i < memberRows.length; i++) {
    const row   = memberRows[i];
    const score = row.corroboration_score_adjusted;
    const lag1  = i >= 1 ? memberRows[i-1].corroboration_score_adjusted : null;
    const lag2  = i >= 2 ? memberRows[i-2].corroboration_score_adjusted : null;
    const n15   = row.num_metrics_gt_1_5;

    let tier = 0;

    if ((score >= 0.35) && (n15 >= 2)) tier = 1;

    const consec2   = (score >= 0.55) && (lag1 != null) && (lag1 >= 0.55);
    const singleHigh = (score >= 0.75) && (n15 >= 3);
    if (consec2 || singleHigh) tier = 2;

    if (
      (score >= 0.75) &&
      (lag1  != null) && (lag1  >= 0.75) &&
      (lag2  != null) && (lag2  >= 0.75) &&
      (lag1 >= lag2) && (score >= lag1)
    ) tier = 3;

    if (row.learning_mode) tier = 0;

    row.tier = tier;
  }
}


// ── 11. Build JSON output ─────────────────────────────────────────────────────

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nn(v) {
  // null-guard: return null for NaN / undefined
  if (v === undefined || v === null) return null;
  if (typeof v === 'number' && !isFinite(v)) return null;
  return v;
}

function buildConfounder(row) {
  if (row.alcohol_flag)          return { type: 'alcohol',      message: CONFOUNDER_MESSAGES.alcohol };
  if (row.altitude_flag)         return { type: 'altitude',     message: CONFOUNDER_MESSAGES.altitude };
  if (row.luteal_flag)           return { type: 'luteal',       message: CONFOUNDER_MESSAGES.luteal };
  if (row.possible_overtraining) return { type: 'overtraining', message: CONFOUNDER_MESSAGES.overtraining };
  return null;
}

function buildToday(row, rowIndex) {
  const lm = row.learning_mode;
  return {
    date:   fmtDate(row._date),
    tier:   row.tier,
    learning_mode: lm,
    corroboration_score_adjusted: nn(row.corroboration_score_adjusted),
    hrv_rmssd:        nn(row.hrv_rmssd),
    rhr:              nn(row.rhr),
    respiratory_rate: nn(row.respiratory_rate),
    skin_temp:        nn(row.skin_temp),
    spo2:             nn(row.spo2),
    baseline_hrv_rmssd:        nn(row.baseline_hrv_rmssd),
    baseline_rhr:              nn(row.baseline_rhr),
    baseline_respiratory_rate: nn(row.baseline_respiratory_rate),
    baseline_skin_temp:        nn(row.baseline_skin_temp),
    baseline_spo2:             nn(row.baseline_spo2),
    z_hrv:  nn(row.z_hrv),
    z_rhr:  nn(row.z_rhr),
    z_rr:   nn(row.z_rr),
    z_temp: nn(row.z_temp),
    z_spo2: nn(row.z_spo2),
    hrv_quality:  nn(row.hrv_quality),
    rhr_quality:  nn(row.rhr_quality),
    rr_quality:   nn(row.rr_quality),
    temp_quality: nn(row.temp_quality),
    spo2_quality: nn(row.spo2_quality),
    journal_alcohol:  !!row.alcohol_flag,
    journal_illness:  !!row.journal_illness,
    journal_altitude: !!row.altitude_flag,
    cycle_phase: (row.cycle_phase && row.cycle_phase !== 'none' && row.cycle_phase !== '') ? row.cycle_phase : null,
    strain: nn(row.strain),
    possible_overtraining: !!row.possible_overtraining,
    daysIntoLearning: lm ? rowIndex : null,
    totalLearningDays: LEARNING_DAYS,
  };
}

function buildHistoryEntry(row) {
  return {
    date:  fmtDate(row._date),
    score: nn(row.corroboration_score_adjusted),
    tier:  row.tier,
  };
}

function buildMember(memberId, memberRows) {
  const latest   = memberRows[memberRows.length - 1];
  const rowIndex = memberRows.length - 1;
  const history7 = memberRows.slice(-7);

  return {
    member: {
      id:       memberId,
      name:     memberId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      initials: memberId.split('_').map(p => p[0]?.toUpperCase() ?? '').join(''),
    },
    today:      buildToday(latest, rowIndex),
    history:    history7.map(buildHistoryEntry),
    confounder: buildConfounder(latest),
  };
}


// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`Loading ${CSV_PATH} ...`);
const text = readFileSync(CSV_PATH, 'utf8');
let rows   = parseCSV(text);
rows       = sortRows(rows);
console.log(`  ${rows.length} rows loaded`);

// Group by member
const byMember = {};
for (const row of rows) {
  if (!byMember[row.member_id]) byMember[row.member_id] = [];
  byMember[row.member_id].push(row);
}
const memberIds = Object.keys(byMember).sort();
console.log(`  ${memberIds.length} members`);

// Run pipeline per member
for (const mid of memberIds) {
  const memberRows = byMember[mid];
  computeBaselines(memberRows);
  addLearningMode(memberRows);
  memberRows.forEach(r => { computeZScores(r); applyQualityGate(r); computeCorroboration(r); });
  flagConfounders(memberRows);
  memberRows.forEach(r => adjustScore(r));
  assignTiers(memberRows);
}

// Build output
const members = {};
for (const mid of memberIds) {
  members[mid] = buildMember(mid, byMember[mid]);
}

const output = { memberIds, members };

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));

// Print tier distribution
const tierDist = {};
for (const mid of memberIds) {
  const t = members[mid].today.tier;
  tierDist[t] = (tierDist[t] ?? 0) + 1;
}
console.log(`\nDone! Written to ${OUT_PATH}`);
console.log('Tier distribution (latest day):', tierDist);
