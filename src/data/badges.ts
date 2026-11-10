import { ChallengeProgress } from '../types/game';

export interface AchievementBadge {
  id: string;
  title: string;
  description: string;
  icon: string;
  isUnlocked: (progress: Record<string, ChallengeProgress>) => boolean;
}

export const ACHIEVEMENT_BADGES: AchievementBadge[] = [
  {
    id: 'badge-first-solve',
    title: 'First Bug Squashed',
    description: 'Complete your very first Python coding challenge.',
    icon: '🐞',
    isUnlocked: (progress) =>
      Object.values(progress).some((p) => p.completed),
  },
  {
    id: 'badge-hint-free',
    title: 'Hint-Free Hero',
    description: 'Earn 3 stars on at least 5 challenges without using any hints.',
    icon: '⭐',
    isUnlocked: (progress) =>
      Object.values(progress).filter((p) => p.completed && p.stars === 3)
        .length >= 5,
  },
  {
    id: 'badge-world-1',
    title: 'Python Basics Champion',
    description: 'Complete all 4 challenges in World 1: Python Basics.',
    icon: '💻',
    isUnlocked: (progress) =>
      ['ch-01', 'ch-02', 'ch-03', 'ch-04'].every(
        (id) => progress[id]?.completed
      ),
  },
  {
    id: 'badge-variables-input',
    title: 'Data & Input Detective',
    description: 'Complete all challenges in Worlds 2 and 3 (Variables & Input).',
    icon: '🔍',
    isUnlocked: (progress) =>
      [
        'ch-05',
        'ch-06',
        'ch-07',
        'ch-08',
        'ch-09',
        'ch-10',
        'ch-11',
        'ch-12',
      ].every((id) => progress[id]?.completed),
  },
  {
    id: 'badge-decisions',
    title: 'Decision Dungeon Knight',
    description: 'Conquer all 5 conditional challenges in World 5: Decision Dungeon.',
    icon: '🛡️',
    isUnlocked: (progress) =>
      ['ch-17', 'ch-18', 'ch-19', 'ch-20', 'ch-21'].every(
        (id) => progress[id]?.completed
      ),
  },
  {
    id: 'badge-loops',
    title: 'Loop Lab Scientist',
    description: 'Complete all 5 for-loop challenges in World 6: Loop Laboratory.',
    icon: '🔁',
    isUnlocked: (progress) =>
      ['ch-22', 'ch-23', 'ch-24', 'ch-25', 'ch-26'].every(
        (id) => progress[id]?.completed
      ),
  },
  {
    id: 'badge-robot',
    title: 'Robo-Py Commander',
    description: 'Guide Robo-Py safely through the laser grid in Challenge #27.',
    icon: '🤖',
    isUnlocked: (progress) => Boolean(progress['ch-27']?.completed),
  },
  {
    id: 'badge-grandmaster',
    title: 'Python Arena Grandmaster',
    description: 'Complete all 30 challenges across all 7 coding worlds!',
    icon: '🏆',
    isUnlocked: (progress) =>
      Object.values(progress).filter((p) => p.completed).length >= 30,
  },
];

