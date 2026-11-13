export interface PriorityInput {
  category: string;
  severity: string;
  title: string;
  description: string;
  locationText: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface PriorityResult {
  score: number;
  level: 'Standard' | 'Elevated' | 'Urgent';
  factors: string[];
}

const CATEGORY_WEIGHTS: Record<string, number> = {
  'Water Leakage': 30,
  'Drainage Problem': 28,
  'Pothole/Damaged Road': 26,
  'Streetlight Failure': 22,
  'Garbage Accumulation': 20,
  'Other': 15,
};

const SEVERITY_WEIGHTS: Record<string, number> = {
  High: 35,
  Medium: 20,
  Low: 8,
};

const SAFETY_KEYWORDS: Array<{ pattern: RegExp; label: string; points: number }> = [
  { pattern: /\b(school|college|hospital|clinic|ambulance)\b/i, label: 'Near school or medical zone', points: 12 },
  { pattern: /\b(main road|highway|junction|intersection|bus stop|metro)\b/i, label: 'High-traffic corridor', points: 10 },
  { pattern: /\b(accident|hazard|injury|fall|deep|dangerous|collapse)\b/i, label: 'Direct safety hazard reported', points: 10 },
  { pattern: /\b(flood|overflow|stagnant|sewage|spark|wire|electric|dark)\b/i, label: 'Active utility or health risk', points: 8 },
];

export function calculateRuleBasedPriority(input: PriorityInput): PriorityResult {
  const factors: string[] = [];
  let score = 0;

  const catWeight = CATEGORY_WEIGHTS[input.category] ?? 15;
  score += catWeight;
  factors.push(`Category baseline (${input.category}): +${catWeight} pts`);

  const sevWeight = SEVERITY_WEIGHTS[input.severity] ?? 20;
  score += sevWeight;
  factors.push(`Severity rating (${input.severity}): +${sevWeight} pts`);

  const combinedText = `${input.title} ${input.description} ${input.locationText}`;
  let keywordBonus = 0;
  for (const rule of SAFETY_KEYWORDS) {
    if (rule.pattern.test(combinedText)) {
      const allowed = Math.min(rule.points, 25 - keywordBonus);
      if (allowed > 0) {
        keywordBonus += allowed;
        factors.push(`${rule.label}: +${allowed} pts`);
      }
    }
  }
  score += keywordBonus;

  if (
    typeof input.latitude === 'number' &&
    !Number.isNaN(input.latitude) &&
    typeof input.longitude === 'number' &&
    !Number.isNaN(input.longitude)
  ) {
    score += 10;
    factors.push('Verified GPS coordinates attached: +10 pts');
  }

  const boundedScore = Math.max(0, Math.min(100, score));
  let level: 'Standard' | 'Elevated' | 'Urgent' = 'Standard';
  if (boundedScore >= 70) {
    level = 'Urgent';
  } else if (boundedScore >= 48) {
    level = 'Elevated';
  }

  return {
    score: boundedScore,
    level,
    factors,
  };
}
