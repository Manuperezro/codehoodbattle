/**
 * Transparent, predictable scoring and nickname validation logic
 * Used both client-side (for Practice Mode & Demo Mode) and mirrored in Supabase Edge Functions.
 */

export function calculatePracticeStars(hintsUsed: number): 1 | 2 | 3 {
  if (hintsUsed <= 0) return 3;
  if (hintsUsed === 1) return 2;
  return 1;
}

export function calculatePracticeXp(baseXp: number, hintsUsed: number): number {
  const stars = calculatePracticeStars(hintsUsed);
  if (stars === 3) return baseXp;
  if (stars === 2) return Math.round(baseXp * 0.85);
  return Math.round(baseXp * 0.7);
}

export interface ChampionshipScoreBreakdown {
  basePoints: number;
  hintBonus: number;
  speedBonus: number;
  totalPoints: number;
}

/**
 * Live Championship scoring:
 * - Base score: 100 points for a correct solution
 * - No hints: +30 points
 * - One hint: +15 points
 * - Two or three hints: 0 points
 * - Small speed bonus: up to 20 points (never dominates accuracy)
 * - Maximum: 150 points per challenge
 * - Incorrect solutions award 0 points (no negative point deductions)
 */
export function calculateChampionshipScore(
  isCorrect: boolean,
  hintsUsed: number,
  timeTakenSeconds: number
): ChampionshipScoreBreakdown {
  if (!isCorrect) {
    return {
      basePoints: 0,
      hintBonus: 0,
      speedBonus: 0,
      totalPoints: 0,
    };
  }

  const basePoints = 100;
  let hintBonus = 0;
  if (hintsUsed <= 0) {
    hintBonus = 30;
  } else if (hintsUsed === 1) {
    hintBonus = 15;
  } else {
    hintBonus = 0;
  }

  // Speed bonus: up to 20 points. Full 20 pts if solved in <= 15s, scales down to 0 at 75s.
  const clampedTime = Math.max(0, timeTakenSeconds);
  let speedBonus = 0;
  if (clampedTime <= 15) {
    speedBonus = 20;
  } else if (clampedTime < 75) {
    speedBonus = Math.round(20 * (1 - (clampedTime - 15) / 60));
  }

  const totalPoints = Math.min(150, basePoints + hintBonus + speedBonus);

  return {
    basePoints,
    hintBonus,
    speedBonus,
    totalPoints,
  };
}

const BLOCKED_WORDS = [
  'admin',
  'teacher',
  'moderator',
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'cunt',
  'dick',
  'piss',
  'slut',
  'whore',
  'wanker',
  'twat',
  'prick',
  'bollocks',
  'bugger',
  'crap',
  'nazi',
  'racist',
  'idiot',
  'stupid',
];

export interface NicknameValidationResult {
  valid: boolean;
  reason?: string;
  cleanedNickname: string;
}

export function validateNickname(
  rawNickname: string,
  existingNicknames: string[] = []
): NicknameValidationResult {
  const cleaned = rawNickname.trim().replace(/\s+/g, ' ');

  if (cleaned.length < 3) {
    return {
      valid: false,
      reason: 'Please enter a nickname with at least 3 characters.',
      cleanedNickname: cleaned,
    };
  }

  if (cleaned.length > 16) {
    return {
      valid: false,
      reason: 'Nicknames must be 16 characters or fewer.',
      cleanedNickname: cleaned,
    };
  }

  if (!/^[a-zA-Z0-9 _-]+$/.test(cleaned)) {
    return {
      valid: false,
      reason: 'Use only letters, numbers, spaces, hyphens or underscores.',
      cleanedNickname: cleaned,
    };
  }

  // Block email-like or phone-number-like strings to protect student privacy
  if (cleaned.includes('@') || /\d{6,}/.test(cleaned)) {
    return {
      valid: false,
      reason: 'Do not use phone numbers, student IDs or email addresses in your nickname.',
      cleanedNickname: cleaned,
    };
  }

  const lower = cleaned.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const word of BLOCKED_WORDS) {
    if (lower.includes(word)) {
      return {
        valid: false,
        reason: 'Please choose a classroom-friendly coding nickname (e.g. PythonNinja).',
        cleanedNickname: cleaned,
      };
    }
  }

  const isDuplicate = existingNicknames.some(
    (n) => n.trim().toLowerCase() === cleaned.toLowerCase()
  );
  if (isDuplicate) {
    return {
      valid: false,
      reason: 'That nickname is already taken in this game lobby! Add a number or pick another.',
      cleanedNickname: cleaned,
    };
  }

  return {
    valid: true,
    cleanedNickname: cleaned,
  };
}

export function validateGamePin(rawPin: string): boolean {
  return /^\d{6}$/.test(rawPin.trim());
}

