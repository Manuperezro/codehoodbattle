export type WorldId =
  | 'world-1'
  | 'world-2'
  | 'world-3'
  | 'world-4'
  | 'world-5'
  | 'world-6'
  | 'world-7';

export type EngineType =
  | 'bug_hunter'
  | 'code_builder'
  | 'missing_code'
  | 'predict_output'
  | 'robot_programmer'
  | 'final_boss';

export type DifficultyLevel = 'Starter' | 'Core' | 'Challenge' | 'Boss';

export type TopicTag =
  | 'Output & Syntax'
  | 'Variables & Data Types'
  | 'Input & Type Conversion'
  | 'Arithmetic & Comparisons'
  | 'Conditionals (if/elif/else)'
  | 'For Loops & range()'
  | 'Combined Problem Solving';

export interface WorldMetadata {
  id: WorldId;
  number: number;
  title: string;
  subtitle: string;
  description: string;
  weekReference: string;
  accentColor: string;
  iconName: string;
  challengeIds: string[];
}

export interface ErrorFeedbackRule {
  pattern: string;
  description: string;
  message: string;
}

export interface TestCase {
  id: string;
  description: string;
  simulatedInputs?: string[];
  expectedOutput: string;
  requiredTokens?: string[];
  forbiddenTokens?: string[];
}

export interface MissingBlankSpec {
  id: string;
  lineIndex: number;
  tokenPlaceholder: string; // e.g. "____1____"
  label: string;
  acceptedAnswers: string[];
  hintOnWrong?: Record<string, string>;
}

export type RobotDirection = 'N' | 'E' | 'S' | 'W';

export interface RobotGridConfig {
  width: number;
  height: number;
  start: { x: number; y: number; dir: RobotDirection };
  goal: { x: number; y: number };
  obstacles: Array<{ x: number; y: number; label?: string }>;
  beacons?: Array<{ x: number; y: number }>;
  availableCommands: string[];
  starterCommands: string[];
  optimalLineCount?: number;
}

export interface Challenge {
  id: string;
  number: number; // 1 to 30
  title: string;
  worldId: WorldId;
  worldName: string;
  difficulty: DifficultyLevel;
  learningObjective: string;
  topicTag: TopicTag;
  engineType: EngineType;
  mission: string;
  /** Initial lines of code shown in editor or predictor */
  initialLines: string[];
  /** 0-based line indices that are editable (for bug_hunter, missing_code, final_boss) */
  editableLineIndices: number[];
  /** Shuffled blocks for code_builder */
  shuffledBlocks?: string[];
  /** Accepted block orderings (arrays of strings matching lines) */
  acceptedBlockOrders?: string[][];
  /** Specifications for missing_code blanks if structured blanks are used */
  missingBlanks?: MissingBlankSpec[];
  /** Robot grid configuration for robot_programmer */
  robotConfig?: RobotGridConfig;
  /** Canonical correct full code */
  correctSolution: string;
  /** Accepted equivalent full code variations (normalised) */
  acceptedEquivalents: string[];
  /** Expected terminal output */
  expectedOutput: string;
  /** Alternative accepted output formats (e.g. for Predict the Output) */
  acceptedOutputs?: string[];
  /** Simulated user inputs when running input() statements */
  simulatedInputs?: string[];
  /** Required concepts/tokens that must be present in the code */
  requiredTokens: string[];
  /** Test cases used by deterministic validator */
  testCases: TestCase[];
  /** Three progressive hints: [Question, Line/Rule, Example] */
  hints: [string, string, string];
  /** Supportive message on completion */
  successFeedback: string;
  /** Targeted error rules for helpful feedback */
  errorFeedbackRules: ErrorFeedbackRule[];
  /** Base XP reward in Practice Mode */
  xpReward: number;
}

export interface ValidationResult {
  isValid: boolean;
  syntaxValid: boolean;
  conceptValid: boolean;
  outputValid: boolean;
  terminalOutput: string;
  feedbackMessage: string;
  matchedErrorRule?: string;
  passedTestCases: number;
  totalTestCases: number;
  robotPath?: Array<{
    x: number;
    y: number;
    dir: RobotDirection;
    status: 'moving' | 'obstacle' | 'out_of_bounds' | 'goal';
  }>;
}

export interface ChallengeProgress {
  challengeId: string;
  completed: boolean;
  stars: 0 | 1 | 2 | 3;
  xpEarned: number;
  hintsUsed: number;
  attempts: number;
  bestCode?: string;
  lastCompletedAt?: string;
}

export interface PracticeState {
  nickname: string;
  totalXp: number;
  progress: Record<string, ChallengeProgress>;
  unlockedBadges: string[];
  soundMuted: boolean;
  reducedMotion: boolean;
}

export type SessionStatus = 'lobby' | 'active' | 'paused' | 'leaderboard' | 'completed';

export interface ChallengePack {
  id: string;
  name: string;
  description: string;
  worldIds: WorldId[];
  challengeIds: string[];
}

export interface GameSession {
  id: string;
  pin: string;
  title: string;
  teacherId: string;
  packId: string;
  challengeIds: string[];
  currentRoundIndex: number;
  status: SessionStatus;
  createdAt: string;
  roundStartedAt?: string;
}

export interface SessionPlayer {
  id: string;
  sessionId: string;
  anonymousAuthId: string;
  nickname: string;
  totalScore: number;
  challengesCompleted: number;
  currentRoundSubmitted: boolean;
  joinedAt: string;
  lastSeenAt: string;
}

export interface RoundSubmission {
  id: string;
  sessionId: string;
  playerId: string;
  nickname: string;
  challengeId: string;
  roundIndex: number;
  submittedCode: string;
  isCorrect: boolean;
  hintsUsed: number;
  timeTakenSeconds: number;
  pointsAwarded: number;
  errorCategory?: string;
  submittedAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  nickname: string;
  totalPoints: number;
  challengesCompleted: number;
  currentRoundPoints: number;
  currentRoundSubmitted: boolean;
}

