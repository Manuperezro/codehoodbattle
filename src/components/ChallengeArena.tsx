import React, { useEffect, useState } from 'react';
import {
  Bug,
  Layers,
  Puzzle,
  Eye,
  Bot,
  Trophy,
  RotateCcw,
  Lightbulb,
  Play,
  CheckCircle2,
  AlertTriangle,
  Star,
  ArrowRight,
  Terminal,
  Sparkles,
} from 'lucide-react';
import { Challenge, EngineType, ValidationResult } from '../types/game';
import { validateChallengeSubmission } from '../utils/pythonValidator';
import { calculatePracticeStars, calculatePracticeXp } from '../utils/scoring';
import { GuidedCodeEditor } from './GuidedCodeEditor';
import { CodeBuilderEngine } from './CodeBuilderEngine';
import { PredictOutputEngine } from './PredictOutputEngine';
import { RobotProgrammerEngine } from './RobotProgrammerEngine';
import { sound } from '../utils/sound';

interface ChallengeArenaProps {
  challenge: Challenge;
  mode: 'practice' | 'championship';
  onComplete: (result: {
    code: string;
    hintsUsed: number;
    attempts: number;
    timeTakenSeconds: number;
    stars: 1 | 2 | 3;
    xpEarned: number;
  }) => void;
  onNextChallenge?: () => void;
  hasNextChallenge?: boolean;
  alreadySubmittedInRound?: boolean;
}

const ENGINE_BADGES: Record<
  EngineType,
  { label: string; color: string; icon: React.ReactNode }
> = {
  bug_hunter: {
    label: 'Bug Hunter',
    color: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    icon: <Bug className="w-4 h-4" />,
  },
  code_builder: {
    label: 'Code Builder',
    color: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    icon: <Layers className="w-4 h-4" />,
  },
  missing_code: {
    label: 'Missing Code',
    color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    icon: <Puzzle className="w-4 h-4" />,
  },
  predict_output: {
    label: 'Predict the Output',
    color: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    icon: <Eye className="w-4 h-4" />,
  },
  robot_programmer: {
    label: 'Robot Programmer',
    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    icon: <Bot className="w-4 h-4" />,
  },
  final_boss: {
    label: 'Final Boss Challenge',
    color: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    icon: <Trophy className="w-4 h-4" />,
  },
};

export const ChallengeArena: React.FC<ChallengeArenaProps> = ({
  challenge,
  mode,
  onComplete,
  onNextChallenge,
  hasNextChallenge = false,
  alreadySubmittedInRound = false,
}) => {
  const getInitialLines = (ch: Challenge): string[] => {
    if (ch.engineType === 'code_builder' && ch.shuffledBlocks) {
      return [...ch.shuffledBlocks];
    }
    if (ch.engineType === 'robot_programmer' && ch.robotConfig) {
      return [...ch.robotConfig.starterCommands];
    }
    return [...ch.initialLines];
  };

  const [lines, setLines] = useState<string[]>(() => getInitialLines(challenge));
  const [prediction, setPrediction] = useState<string>('');
  const [hintsRevealed, setHintsRevealed] = useState<number>(0);
  const [attempts, setAttempts] = useState<number>(0);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [completedOnce, setCompletedOnce] = useState<boolean>(false);

  // Reset state whenever the challenge changes
  useEffect(() => {
    setLines(getInitialLines(challenge));
    setPrediction('');
    setHintsRevealed(0);
    setAttempts(0);
    setValidation(null);
    setStartedAt(Date.now());
    setCompletedOnce(false);
  }, [challenge]);

  const handleReset = () => {
    sound.playClick();
    setLines(getInitialLines(challenge));
    setPrediction('');
    setValidation(null);
  };

  const handleRevealHint = () => {
    if (hintsRevealed < 3) {
      sound.playHint();
      setHintsRevealed((prev) => prev + 1);
    }
  };

  const handleLineChange = (lineIdx: number, newVal: string) => {
    const updated = [...lines];
    updated[lineIdx] = newVal;
    setLines(updated);
  };

  const handleCheckCode = () => {
    const submissionText =
      challenge.engineType === 'predict_output' ? prediction : lines.join('\n');

    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);

    const res = validateChallengeSubmission(challenge, submissionText);
    setValidation(res);

    if (res.isValid) {
      sound.playSuccess();
      if (!completedOnce) {
        setCompletedOnce(true);
        const elapsedSeconds = Math.max(
          1,
          Math.round((Date.now() - startedAt) / 1000)
        );
        const stars = calculatePracticeStars(hintsRevealed);
        const xpEarned = calculatePracticeXp(challenge.xpReward, hintsRevealed);
        onComplete({
          code: submissionText,
          hintsUsed: hintsRevealed,
          attempts: nextAttempts,
          timeTakenSeconds: elapsedSeconds,
          stars,
          xpEarned,
        });
      }
    } else {
      sound.playError();
    }
  };

  const badge = ENGINE_BADGES[challenge.engineType];
  const potentialStars = calculatePracticeStars(hintsRevealed);
  const isLocked = mode === 'championship' && alreadySubmittedInRound;

  return (
    <div className="space-y-5">
      {/* Challenge Header & Mission Briefing */}
      <div className="rounded-2xl border-2 border-arena-border bg-arena-card/95 p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-sky-300 font-mono text-xs font-bold border border-slate-700">
              CHALLENGE #{challenge.number}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border ${badge.color}`}
            >
              {badge.icon}
              {badge.label}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-300 text-xs font-medium border border-slate-700">
              {challenge.difficulty}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {mode === 'practice' && (
              <div
                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs"
                title="Stars awarded on completion based on hints used"
              >
                {[1, 2, 3].map((s) => (
                  <Star
                    key={s}
                    className={`w-4 h-4 ${
                      s <= potentialStars
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-slate-600'
                    }`}
                  />
                ))}
                <span className="ml-1.5 font-mono font-bold text-amber-300">
                  +{calculatePracticeXp(challenge.xpReward, hintsRevealed)} XP
                </span>
              </div>
            )}
          </div>
        </div>

        <h2 className="text-xl sm:text-2xl font-display font-bold text-white mb-2">
          {challenge.title}
        </h2>

        <p className="text-base sm:text-lg text-slate-200 leading-relaxed mb-3">
          {challenge.mission}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800/80 text-xs text-slate-300">
          <div>
            <strong className="text-sky-300">Learning Goal:</strong>{' '}
            {challenge.learningObjective}
          </div>
          {challenge.simulatedInputs && challenge.simulatedInputs.length > 0 && (
            <div className="px-2.5 py-1 rounded bg-indigo-950/80 border border-indigo-500/40 text-indigo-200 font-mono">
              Simulated User Input: <strong>{challenge.simulatedInputs.join(', ')}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Minigame Engine */}
      <div>
        {(challenge.engineType === 'bug_hunter' ||
          challenge.engineType === 'missing_code' ||
          challenge.engineType === 'final_boss') && (
          <GuidedCodeEditor
            lines={lines}
            editableLineIndices={challenge.editableLineIndices}
            onChangeLine={handleLineChange}
            disabled={isLocked}
            engineLabel={badge.label}
          />
        )}

        {challenge.engineType === 'code_builder' && (
          <CodeBuilderEngine
            blocks={lines}
            onChangeBlocks={setLines}
            disabled={isLocked}
          />
        )}

        {challenge.engineType === 'predict_output' && (
          <PredictOutputEngine
            lines={challenge.initialLines}
            prediction={prediction}
            onChangePrediction={setPrediction}
            disabled={isLocked}
            expectedLineCount={challenge.expectedOutput.split('\n').length}
          />
        )}

        {challenge.engineType === 'robot_programmer' && challenge.robotConfig && (
          <RobotProgrammerEngine
            config={challenge.robotConfig}
            lines={lines}
            onChangeLines={setLines}
            robotPath={validation?.robotPath}
            disabled={isLocked}
          />
        )}
      </div>

      {/* Control Buttons: Reset Code, Hint, Check Code */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={isLocked}
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-600 font-semibold text-sm transition focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Code
          </button>

          <button
            type="button"
            disabled={hintsRevealed >= 3 || isLocked}
            onClick={handleRevealHint}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 text-amber-300 border border-amber-500/40 font-semibold text-sm transition focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <Lightbulb className="w-4 h-4" />
            {hintsRevealed < 3
              ? `Hint (${hintsRevealed}/3 Used)`
              : 'All 3 Hints Shown'}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isLocked}
            onClick={handleCheckCode}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-400 hover:to-teal-400 disabled:opacity-50 text-slate-950 font-display font-bold text-base shadow-lg shadow-sky-500/20 transition transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-sky-300"
          >
            <Play className="w-5 h-5 fill-current" />
            Check Code
          </button>

          {validation?.isValid && hasNextChallenge && onNextChallenge && (
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                onNextChallenge();
              }}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-base shadow-lg shadow-amber-500/25 transition focus:outline-none focus:ring-2 focus:ring-amber-300"
            >
              Next Challenge
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Progressive Hints Panel (Hint 1: Question, Hint 2: Line/Rule, Hint 3: Example) */}
      {hintsRevealed > 0 && (
        <div
          className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-4 space-y-2.5"
          role="region"
          aria-label="Hints panel"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
            <Lightbulb className="w-4 h-4" /> Progressive Hints ({hintsRevealed} of 3)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {challenge.hints.slice(0, hintsRevealed).map((hintText, idx) => {
              const titles = [
                'Hint 1: Think About It',
                'Hint 2: Python Rule',
                'Hint 3: Similar Example',
              ];
              return (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-900/90 border border-amber-500/30 text-sm text-slate-200"
                >
                  <div className="text-xs font-bold text-amber-400 mb-1">
                    {titles[idx]}
                  </div>
                  <div className="whitespace-pre-line font-sans">{hintText}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Simulated Terminal Output & Feedback Panel */}
      <div
        className={`rounded-2xl border-2 p-4 shadow-xl transition ${
          !validation
            ? 'border-arena-border bg-slate-950/90'
            : validation.isValid
            ? 'border-emerald-500/70 bg-emerald-950/25'
            : 'border-amber-500/70 bg-amber-950/20'
        }`}
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-slate-800 text-xs">
          <span className="font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-sky-400" />
            Python Terminal Output (Safe Deterministic Simulator)
          </span>
          <span className="font-mono text-slate-400">
            Expected Output:{' '}
            <strong className="text-emerald-300">
              {challenge.expectedOutput.replace(/\n/g, ' ↵ ')}
            </strong>
          </span>
        </div>

        {!validation ? (
          <div className="text-sm text-slate-400 font-mono py-2">
            &gt; Edit the code above and click <strong>Check Code</strong> to test your Python program...
          </div>
        ) : (
          <div className="space-y-3">
            {/* Terminal stdout/stderr box */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-sm sm:text-base text-slate-100 whitespace-pre-wrap">
              {validation.terminalOutput || '(No output)'}
            </div>

            {/* Educational Feedback Banner */}
            <div
              className={`flex items-start justify-between gap-3 p-3.5 rounded-xl border ${
                validation.isValid
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                  : 'bg-amber-500/15 border-amber-500/40 text-amber-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {validation.isValid ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-base">
                    {validation.isValid ? 'Challenge Complete!' : 'Keep Going — Try Again!'}
                  </div>
                  <p className="text-sm sm:text-base mt-0.5">
                    {validation.feedbackMessage}
                  </p>
                </div>
              </div>

              {validation.isValid && mode === 'practice' && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950 border border-emerald-500/40 shrink-0">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="font-mono font-bold text-sm text-amber-300">
                    +{calculatePracticeXp(challenge.xpReward, hintsRevealed)} XP
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

