export const TIER_CONFIG = {
  0: {
    label: 'Normal',
    color: 'var(--tier-0)',
    bg: 'var(--tier-0-bg)',
    message:
      'All your signals are close to your personal baseline. You look well-rested and recovered.',
    messageShort: 'All signals close to baseline',
  },
  1: {
    label: 'Awareness',
    color: 'var(--tier-1)',
    bg: 'var(--tier-1-bg)',
    message:
      'A few of your signals have moved slightly from your personal baseline. Worth keeping an eye on tonight.',
    messageShort: 'A few signals have shifted',
  },
  2: {
    label: 'Advisory',
    color: 'var(--tier-2)',
    bg: 'var(--tier-2-bg)',
    message:
      'Your body may be responding to something. Multiple signals have shifted from your baseline over the past two nights. Consider prioritizing rest, hydration, and an early night.',
    messageShort: 'Multiple signals shifted',
  },
  3: {
    label: 'Guidance',
    color: 'var(--tier-3)',
    bg: 'var(--tier-3-bg)',
    message:
      'Multiple signals have moved away from your personal baseline for three or more nights, with a continuing trend. Consider speaking with a healthcare provider if you notice symptoms.',
    messageShort: 'Sustained multi-day deviation',
  },
};

export function getTierColor(tier) {
  if (tier === null || tier === undefined) return 'var(--text-muted)';
  const config = TIER_CONFIG[tier];
  return config ? config.color : 'var(--text-muted)';
}

export function getTierBg(tier) {
  if (tier === null || tier === undefined) return 'transparent';
  const config = TIER_CONFIG[tier];
  return config ? config.bg : 'transparent';
}

export function getTierLabel(tier) {
  if (tier === null || tier === undefined) return '—';
  const config = TIER_CONFIG[tier];
  return config ? config.label : '—';
}

export function formatDelta(current, baseline, metric) {
  if (current === null || current === undefined || baseline === null || baseline === undefined) {
    return { pct: 0, direction: 'neutral', displayText: '—' };
  }

  const diff = current - baseline;
  const pct = Math.abs((diff / baseline) * 100);

  // Determine if worsening: HRV and SpO2 worsen when lower; RHR, RR, Temp worsen when higher
  const worsensWhenLower = metric === 'hrv' || metric === 'spo2';
  const worsensWhenHigher = metric === 'rhr' || metric === 'rr' || metric === 'temp';

  let direction;
  let isBad;

  if (Math.abs(diff) < 0.01) {
    direction = 'neutral';
    isBad = false;
  } else if (diff > 0) {
    direction = 'up';
    isBad = worsensWhenHigher;
  } else {
    direction = 'down';
    isBad = worsensWhenLower;
  }

  const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';
  const sign = diff > 0 ? '+' : '';
  const displayText = `${arrow} ${sign}${pct.toFixed(1)}%`;

  return { pct, direction, displayText, isBad };
}

export function formatMetricValue(value, metric) {
  if (value === null || value === undefined) return '—';
  switch (metric) {
    case 'hrv':
      return `${value.toFixed(0)} ms`;
    case 'rhr':
      return `${value.toFixed(0)} bpm`;
    case 'rr':
      return `${value.toFixed(1)} br/m`;
    case 'temp':
      return `${value.toFixed(1)} °C`;
    case 'spo2':
      return `${value.toFixed(1)} %`;
    default:
      return `${value}`;
  }
}
