import { beforeEach, describe, expect, it } from 'vitest';
import { CHALLENGES, WORLDS } from '../data/challenges';
import { ACHIEVEMENT_BADGES } from '../data/badges';
import {
  createNewDemoSession,
  getSavedRejoinTicket,
  joinChampionshipWithPin,
  submitChampionshipRoundCode,
  updateDemoSessionStatus,
} from '../services/championshipService';
import { ChallengeProgress } from '../types/game';
import { validateChallengeSubmission } from '../utils/pythonValidator';
import {
  calculateChampionshipScore,
  calculatePracticeStars,
  calculatePracticeXp,
  validateGamePin,
  validateNickname,
} from '../utils/scoring';

// Simple in-memory localStorage mock for Node/Vitest environment
const memoryStorage: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => (key in memoryStorage ? memoryStorage[key] : null),
  setItem: (key: string, val: string) => {
    memoryStorage[key] = String(val);
  },
  removeItem: (key: string) => {
    delete memoryStorage[key];
  },
  clear: () => {
    for (const k of Object.keys(memoryStorage)) delete memoryStorage[k];
  },
  key: (i: number) => Object.keys(memoryStorage)[i] || null,
  get length() {
    return Object.keys(memoryStorage).length;
  },
};

describe('Python Code Arena — Curriculum & 30 Challenges Integrity', () => {
  it('defines exactly 7 worlds and 30 challenges in sequence', () => {
    expect(WORLDS.length).toBe(7);
    expect(CHALLENGES.length).toBe(30);

    CHALLENGES.forEach((ch, idx) => {
      expect(ch.number).toBe(idx + 1);
      expect(ch.id).toBe(`ch-${String(idx + 1).padStart(2, '0')}`);
      expect(ch.hints.length).toBe(3);
      expect(ch.title.length).toBeGreaterThan(2);
      expect(ch.learningObjective.length).toBeGreaterThan(5);
      expect(ch.mission.length).toBeGreaterThan(10);
      expect(ch.testCases.length).toBeGreaterThanOrEqual(1);
      expect(ch.xpReward).toBeGreaterThanOrEqual(100);
    });
  });

  it('validates the canonical correctSolution for all 30 challenges', () => {
    for (const challenge of CHALLENGES) {
      const result = validateChallengeSubmission(
        challenge,
        challenge.correctSolution
      );
      expect(
        result.isValid,
        `Challenge ${challenge.id} (${challenge.title}) failed canonical solution: ${result.feedbackMessage}`
      ).toBe(true);
      expect(result.passedTestCases).toBe(challenge.testCases.length);
    }
  });

  it('validates all acceptedEquivalents (e.g. single quotes, spacing, block orders) across all 30 challenges', () => {
    for (const challenge of CHALLENGES) {
      for (const eqCode of challenge.acceptedEquivalents) {
        const result = validateChallengeSubmission(challenge, eqCode);
        expect(
          result.isValid,
          `Challenge ${challenge.id} failed equivalent solution:\n${eqCode}\nReason: ${result.feedbackMessage}`
        ).toBe(true);
      }
    }
  });

  it('rejects broken initial code on Bug Hunter, Missing Code, Code Builder, and Final Boss challenges', () => {
    for (const challenge of CHALLENGES) {
      if (challenge.engineType === 'predict_output') {
        const emptyPred = validateChallengeSubmission(challenge, '');
        expect(emptyPred.isValid).toBe(false);
        continue;
      }

      const initialJoined =
        challenge.engineType === 'code_builder' && challenge.shuffledBlocks
          ? challenge.shuffledBlocks.join('\n')
          : challenge.engineType === 'robot_programmer' && challenge.robotConfig
          ? challenge.robotConfig.starterCommands.join('\n')
          : challenge.initialLines.join('\n');

      const result = validateChallengeSubmission(challenge, initialJoined);
      expect(
        result.isValid,
        `Challenge ${challenge.id} (${challenge.title}) unexpectedly passed with unmodified initial code`
      ).toBe(false);
    }
  });

  it('rejects attempts that delete required concepts and hardcode output', () => {
    const ch07 = CHALLENGES.find((c) => c.id === 'ch-07')!;
    const spoofed = validateChallengeSubmission(ch07, 'print(60)');
    expect(spoofed.isValid).toBe(false);
    expect(spoofed.conceptValid).toBe(false);

    const ch23 = CHALLENGES.find((c) => c.id === 'ch-23')!;
    const spoofedLoop = validateChallengeSubmission(
      ch23,
      'print(1)\nprint(2)\nprint(3)\nprint(4)\nprint(5)'
    );
    expect(spoofedLoop.isValid).toBe(false);
  });

  it('provides targeted error-specific feedback for common beginner mistakes', () => {
    // Unclosed quotes in Challenge 1
    const ch01 = CHALLENGES.find((c) => c.id === 'ch-01')!;
    const res01 = validateChallengeSubmission(ch01, 'print("Hello World)');
    expect(res01.isValid).toBe(false);
    expect(res01.matchedErrorRule).toBe('missing_quote');

    // Capital Print in Challenge 2
    const ch02 = CHALLENGES.find((c) => c.id === 'ch-02')!;
    const res02 = validateChallengeSubmission(
      ch02,
      'print("Arena Ready")\nPrint("Start Game")'
    );
    expect(res02.isValid).toBe(false);
    expect(res02.matchedErrorRule).toBe('uppercase_print');

    // Missing colon in Challenge 17
    const ch17 = CHALLENGES.find((c) => c.id === 'ch-17')!;
    const res17 = validateChallengeSubmission(
      ch17,
      'score = 85\nif score >= 50\n    print("Pass")'
    );
    expect(res17.isValid).toBe(false);
    expect(res17.matchedErrorRule).toBe('missing_colon');

    // Single = in if condition in Challenge 19
    const ch19 = CHALLENGES.find((c) => c.id === 'ch-19')!;
    const res19 = validateChallengeSubmission(
      ch19,
      'pin = 1234\nif pin = 1234:\n    print("Unlocked")'
    );
    expect(res19.isValid).toBe(false);
    expect(res19.matchedErrorRule).toBe('single_equals_in_if');

    // Robot hitting laser barrier in Challenge 27
    const ch27 = CHALLENGES.find((c) => c.id === 'ch-27')!;
    const res27 = validateChallengeSubmission(ch27, 'move_down()');
    expect(res27.isValid).toBe(false);
    expect(res27.matchedErrorRule).toBe('hit_obstacle');
  });
});

describe('Python Code Arena — Transparent Scoring & Badges System', () => {
  it('awards 3 stars for 0 hints, 2 stars for 1 hint, and 1 star for 2 or 3 hints in Practice Mode', () => {
    expect(calculatePracticeStars(0)).toBe(3);
    expect(calculatePracticeStars(1)).toBe(2);
    expect(calculatePracticeStars(2)).toBe(1);
    expect(calculatePracticeStars(3)).toBe(1);

    expect(calculatePracticeXp(100, 0)).toBe(100);
    expect(calculatePracticeXp(100, 1)).toBe(85);
    expect(calculatePracticeXp(100, 2)).toBe(70);
  });

  it('calculates Live Championship scores between 0 and 150 without negative penalties', () => {
    const perfect = calculateChampionshipScore(true, 0, 10);
    expect(perfect.basePoints).toBe(100);
    expect(perfect.hintBonus).toBe(30);
    expect(perfect.speedBonus).toBe(20);
    expect(perfect.totalPoints).toBe(150);

    const oneHintSlow = calculateChampionshipScore(true, 1, 80);
    expect(oneHintSlow.totalPoints).toBe(115);

    const threeHintsSlow = calculateChampionshipScore(true, 3, 90);
    expect(threeHintsSlow.totalPoints).toBe(100);

    const wrong = calculateChampionshipScore(false, 0, 5);
    expect(wrong.totalPoints).toBe(0);
  });

  it('unlocks achievement badges as challenges are completed', () => {
    const emptyProgress: Record<string, ChallengeProgress> = {};
    expect(ACHIEVEMENT_BADGES[0].isUnlocked(emptyProgress)).toBe(false);

    const world1Done: Record<string, ChallengeProgress> = {
      'ch-01': { challengeId: 'ch-01', completed: true, stars: 3, xpEarned: 100, hintsUsed: 0, attempts: 1 },
      'ch-02': { challengeId: 'ch-02', completed: true, stars: 3, xpEarned: 100, hintsUsed: 0, attempts: 1 },
      'ch-03': { challengeId: 'ch-03', completed: true, stars: 3, xpEarned: 100, hintsUsed: 0, attempts: 1 },
      'ch-04': { challengeId: 'ch-04', completed: true, stars: 3, xpEarned: 100, hintsUsed: 0, attempts: 1 },
    };

    const firstSolveBadge = ACHIEVEMENT_BADGES.find((b) => b.id === 'badge-first-solve')!;
    const world1Badge = ACHIEVEMENT_BADGES.find((b) => b.id === 'badge-world-1')!;
    expect(firstSolveBadge.isUnlocked(world1Done)).toBe(true);
    expect(world1Badge.isUnlocked(world1Done)).toBe(true);
  });
});

describe('Python Code Arena — Kahoot-Style PIN, Session Flow & Duplicate Protection', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it('validates 6-digit numeric Game PINs and filters nicknames', () => {
    expect(validateGamePin('483921')).toBe(true);
    expect(validateGamePin('12345')).toBe(false);
    expect(validateGamePin('abcdef')).toBe(false);

    expect(validateNickname('PythonNinja', ['LoopLegend']).valid).toBe(true);
    expect(validateNickname('looplegend', ['LoopLegend']).valid).toBe(false);
    expect(validateNickname('Py', []).valid).toBe(false);
    expect(validateNickname('sam@college.uk', []).valid).toBe(false);
    expect(validateNickname('Student1234567', []).valid).toBe(false);
    expect(validateNickname('AdminTeacher', []).valid).toBe(false);
  });

  it('supports creating a session, joining by PIN, rejoining, and blocking duplicate points', async () => {
    const created = createNewDemoSession({
      title: 'Unit Test Cup',
      packId: 'pack-quick-arcade',
      challengeCount: 4,
    });
    expect(created.session.pin).toMatch(/^\d{6}$/);

    // Invalid PIN is rejected
    const badPinRes = await joinChampionshipWithPin('000000', 'CoderOne');
    expect(badPinRes.ok).toBe(false);

    // Valid PIN joins lobby
    const joinRes = await joinChampionshipWithPin(created.session.pin, 'CoderOne');
    expect(joinRes.ok).toBe(true);
    expect(joinRes.player?.nickname).toBe('CoderOne');

    // Rejoin ticket is saved
    const ticket = getSavedRejoinTicket();
    expect(ticket?.nickname).toBe('CoderOne');

    // Start round 1
    updateDemoSessionStatus('active', 0);

    // First correct submission awards points
    const firstChallengeId = created.session.challengeIds[0];
    const firstCh = CHALLENGES.find((c) => c.id === firstChallengeId)!;
    const sub1 = await submitChampionshipRoundCode({
      sessionId: created.session.id,
      playerId: joinRes.player!.id,
      nickname: 'CoderOne',
      challengeId: firstCh.id,
      roundIndex: 0,
      submittedCode: firstCh.correctSolution,
      hintsUsed: 0,
      timeTakenSeconds: 10,
    });
    expect(sub1.ok).toBe(true);
    expect(sub1.pointsAwarded).toBe(150);

    // Duplicate submission in the same round awards 0 extra points
    const sub2 = await submitChampionshipRoundCode({
      sessionId: created.session.id,
      playerId: joinRes.player!.id,
      nickname: 'CoderOne',
      challengeId: firstCh.id,
      roundIndex: 0,
      submittedCode: firstCh.correctSolution,
      hintsUsed: 0,
      timeTakenSeconds: 12,
    });
    expect(sub2.ok).toBe(true);
    expect(sub2.alreadySubmitted).toBe(true);
    expect(sub2.pointsAwarded).toBe(0);
  });
});
