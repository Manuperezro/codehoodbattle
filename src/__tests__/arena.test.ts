import { describe, expect, it } from 'vitest';
import { CHALLENGES, WORLDS } from '../data/challenges';
import { validateChallengeSubmission } from '../utils/pythonValidator';
import {
  calculateChampionshipScore,
  calculatePracticeStars,
  calculatePracticeXp,
  validateGamePin,
  validateNickname,
} from '../utils/scoring';

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
    // e.g. Challenge 7 (Data Type Repair) expects 60 using bonus and points
    const ch07 = CHALLENGES.find((c) => c.id === 'ch-07')!;
    const spoofed = validateChallengeSubmission(ch07, 'print(60)');
    expect(spoofed.isValid).toBe(false);
    expect(spoofed.conceptValid).toBe(false);

    // Challenge 23 (Count to Five) requires a for loop and range
    const ch23 = CHALLENGES.find((c) => c.id === 'ch-23')!;
    const spoofedLoop = validateChallengeSubmission(
      ch23,
      'print(1)\nprint(2)\nprint(3)\nprint(4)\nprint(5)'
    );
    expect(spoofedLoop.isValid).toBe(false);
  });
});

describe('Python Code Arena — Transparent Scoring System', () => {
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
    // Perfect fast solve with 0 hints -> 100 + 30 + 20 = 150
    const perfect = calculateChampionshipScore(true, 0, 10);
    expect(perfect.basePoints).toBe(100);
    expect(perfect.hintBonus).toBe(30);
    expect(perfect.speedBonus).toBe(20);
    expect(perfect.totalPoints).toBe(150);

    // 1 hint, slow solve (80s) -> 100 + 15 + 0 = 115
    const oneHintSlow = calculateChampionshipScore(true, 1, 80);
    expect(oneHintSlow.totalPoints).toBe(115);

    // 3 hints, slow solve (90s) -> 100 + 0 + 0 = 100
    const threeHintsSlow = calculateChampionshipScore(true, 3, 90);
    expect(threeHintsSlow.totalPoints).toBe(100);

    // Incorrect attempt -> 0 points (no negative score)
    const wrong = calculateChampionshipScore(false, 0, 5);
    expect(wrong.totalPoints).toBe(0);
  });
});

describe('Python Code Arena — Kahoot-Style PIN & Nickname Security Validation', () => {
  it('validates 6-digit numeric Game PINs', () => {
    expect(validateGamePin('483921')).toBe(true);
    expect(validateGamePin('12345')).toBe(false);
    expect(validateGamePin('abcdef')).toBe(false);
  });

  it('accepts friendly coding nicknames and rejects duplicates, personal data, or profanity', () => {
    const valid = validateNickname('PythonNinja', ['LoopLegend']);
    expect(valid.valid).toBe(true);

    const duplicate = validateNickname('looplegend', ['LoopLegend']);
    expect(duplicate.valid).toBe(false);

    const tooShort = validateNickname('Py', []);
    expect(tooShort.valid).toBe(false);

    const emailLike = validateNickname('sam@college.uk', []);
    expect(emailLike.valid).toBe(false);

    const studentIdLike = validateNickname('Student1234567', []);
    expect(studentIdLike.valid).toBe(false);

    const reservedOrProfane = validateNickname('AdminTeacher', []);
    expect(reservedOrProfane.valid).toBe(false);
  });
});

