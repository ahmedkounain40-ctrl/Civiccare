export interface DuplicateCandidateInput {
  id?: number;
  category: string;
  title: string;
  description: string;
  locationText: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface StoredComplaintForDup {
  id: number;
  complaint_code: string;
  category: string;
  title: string;
  description: string;
  location_text: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  created_at: string;
}

export interface DuplicateMatch {
  complaint_code: string;
  title: string;
  status: string;
  location_text: string;
  similarityScore: number;
  reasons: string[];
  created_at: string;
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'near', 'from', 'that', 'this', 'have', 'been',
  'area', 'road', 'street', 'issue', 'problem', 'please', 'there', 'here', 'very',
]);

function tokenize(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  return new Set(words);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function findPotentialDuplicates(
  target: DuplicateCandidateInput,
  existingList: StoredComplaintForDup[]
): DuplicateMatch[] {
  const targetTokens = tokenize(`${target.title} ${target.description}`);
  const targetLocTokens = tokenize(target.locationText);
  const matches: DuplicateMatch[] = [];

  for (const item of existingList) {
    if (target.id && item.id === target.id) continue;
    if (item.status === 'Rejected') continue;
    if (item.category !== target.category) continue;

    const reasons: string[] = [`Same category (${item.category})`];
    let score = 0.25;

    const itemTokens = tokenize(`${item.title} ${item.description}`);
    const textSim = jaccardSimilarity(targetTokens, itemTokens);
    if (textSim >= 0.15) {
      score += textSim * 0.45;
      reasons.push(`${Math.round(textSim * 100)}% description keyword overlap`);
    }

    const itemLocTokens = tokenize(item.location_text);
    const locSim = jaccardSimilarity(targetLocTokens, itemLocTokens);
    if (locSim >= 0.2) {
      score += locSim * 0.3;
      reasons.push(`Matching landmark or area tokens`);
    }

    let isCloseGeo = false;
    if (
      typeof target.latitude === 'number' &&
      typeof target.longitude === 'number' &&
      typeof item.latitude === 'number' &&
      typeof item.longitude === 'number'
    ) {
      const dist = haversineMeters(target.latitude, target.longitude, item.latitude, item.longitude);
      if (dist <= 400) {
        isCloseGeo = true;
        score += 0.35;
        reasons.push(`Within ${Math.round(dist)}m GPS radius`);
      }
    }

    if (textSim >= 0.2 || locSim >= 0.25 || isCloseGeo) {
      matches.push({
        complaint_code: item.complaint_code,
        title: item.title,
        status: item.status,
        location_text: item.location_text,
        similarityScore: Math.min(0.99, Number(score.toFixed(2))),
        reasons,
        created_at: item.created_at,
      });
    }
  }

  return matches.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, 4);
}
