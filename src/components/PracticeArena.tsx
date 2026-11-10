import React, { useState } from 'react';
import {
  Star,
  Trophy,
  CheckCircle2,
  Play,
  ArrowLeft,
  Sparkles,
  BarChart3,
  Award,
  RotateCcw,
} from 'lucide-react';
import { CHALLENGES, WORLDS } from '../data/challenges';
import { ACHIEVEMENT_BADGES } from '../data/badges';
import {
  ChallengeProgress,
  TopicTag,
  WorldId,
} from '../types/game';
import { ChallengeArena } from './ChallengeArena';
import { sound } from '../utils/sound';

interface PracticeArenaProps {
  nickname: string;
  onChangeNickname: (name: string) => void;
  progress: Record<string, ChallengeProgress>;
  onRecordCompletion: (
    challengeId: string,
    result: {
      code: string;
      hintsUsed: number;
      attempts: number;
      stars: 1 | 2 | 3;
      xpEarned: number;
    }
  ) => void;
  onResetProgress: () => void;
}

export const PracticeArena: React.FC<PracticeArenaProps> = ({
  nickname,
  onChangeNickname,
  progress,
  onRecordCompletion,
  onResetProgress,
}) => {
  const [selectedWorldId, setSelectedWorldId] = useState<WorldId>('world-1');
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null);
  const [showResultsSummary, setShowResultsSummary] = useState<boolean>(false);

  const activeChallenge = activeChallengeId
    ? CHALLENGES.find((c) => c.id === activeChallengeId) || null
    : null;

  const worldChallenges = CHALLENGES.filter((c) => c.worldId === selectedWorldId);
  const selectedWorld = WORLDS.find((w) => w.id === selectedWorldId)!;

  // Overall stats
  const completedList = CHALLENGES.filter((c) => progress[c.id]?.completed);
  const totalCompleted = completedList.length;
  const totalStars = Object.values(progress).reduce(
    (sum, p) => sum + (p.stars || 0),
    0
  );
  const totalXp = Object.values(progress).reduce(
    (sum, p) => sum + (p.xpEarned || 0),
    0
  );
  const unlockedBadgesCount = ACHIEVEMENT_BADGES.filter((b) =>
    b.isUnlocked(progress)
  ).length;

  // Topic analysis for Student Results screen (Section 18)
  const topicStats = React.useMemo(() => {
    const topics: Record<
      TopicTag,
      { total: number; completed: number; stars: number; maxStars: number }
    > = {
      'Output & Syntax': { total: 0, completed: 0, stars: 0, maxStars: 0 },
      'Variables & Data Types': { total: 0, completed: 0, stars: 0, maxStars: 0 },
      'Input & Type Conversion': { total: 0, completed: 0, stars: 0, maxStars: 0 },
      'Arithmetic & Comparisons': { total: 0, completed: 0, stars: 0, maxStars: 0 },
      'Conditionals (if/elif/else)': { total: 0, completed: 0, stars: 0, maxStars: 0 },
      'For Loops & range()': { total: 0, completed: 0, stars: 0, maxStars: 0 },
      'Combined Problem Solving': { total: 0, completed: 0, stars: 0, maxStars: 0 },
    };

    for (const ch of CHALLENGES) {
      const bucket = topics[ch.topicTag];
      bucket.total += 1;
      bucket.maxStars += 3;
      const p = progress[ch.id];
      if (p?.completed) {
        bucket.completed += 1;
        bucket.stars += p.stars;
      }
    }

    const entries = Object.entries(topics) as Array<
      [TopicTag, { total: number; completed: number; stars: number; maxStars: number }]
    >;

    const strongest = entries
      .filter(([, v]) => v.completed > 0 && v.stars / (v.completed * 3) >= 0.8)
      .map(([k]) => k);

    const toPractise = entries
      .filter(([, v]) => v.completed < v.total || v.stars < v.total * 2)
      .map(([k]) => k);

    return { entries, strongest, toPractise };
  }, [progress]);

  // If playing a challenge
  if (activeChallenge) {
    const currentIndexInAll = CHALLENGES.findIndex(
      (c) => c.id === activeChallenge.id
    );
    const nextChallenge =
      currentIndexInAll >= 0 && currentIndexInAll < CHALLENGES.length - 1
        ? CHALLENGES[currentIndexInAll + 1]
        : null;

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setActiveChallengeId(null);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-semibold transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to {activeChallenge.worldName}
          </button>

          <div className="flex items-center gap-2 text-xs sm:text-sm font-mono text-slate-300">
            <span>Practice Mode (No Timer • Unlimited Attempts)</span>
          </div>
        </div>

        <ChallengeArena
          challenge={activeChallenge}
          mode="practice"
          hasNextChallenge={Boolean(nextChallenge)}
          onNextChallenge={() => {
            if (nextChallenge) {
              setSelectedWorldId(nextChallenge.worldId);
              setActiveChallengeId(nextChallenge.id);
            }
          }}
          onComplete={(res) => {
            onRecordCompletion(activeChallenge.id, {
              code: res.code,
              hintsUsed: res.hintsUsed,
              attempts: res.attempts,
              stars: res.stars,
              xpEarned: res.xpEarned,
            });
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Practice Stats & Student Results Toggle */}
      <div className="rounded-2xl border-2 border-arena-border bg-arena-card/90 p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-teal-300 font-semibold mb-1">
            Mode A — Independent Practice Arena
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">
            Choose a World &amp; Master Python
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            Work at your own pace with progressive hints, stars and XP. No countdown timer!
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-sky-400" />
            <div>
              <div className="text-[11px] uppercase text-slate-400">Total XP</div>
              <div className="font-mono font-bold text-lg text-sky-300">
                {totalXp} XP
              </div>
            </div>
          </div>

          <div className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
            <div>
              <div className="text-[11px] uppercase text-slate-400">Stars</div>
              <div className="font-mono font-bold text-lg text-amber-300">
                {totalStars} / 90
              </div>
            </div>
          </div>

          <div className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="text-[11px] uppercase text-slate-400">Solved</div>
              <div className="font-mono font-bold text-lg text-emerald-300">
                {totalCompleted} / 30
              </div>
            </div>
          </div>

          <div className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 flex items-center gap-2">
            <Award className="w-5 h-5 text-orange-400" />
            <div>
              <div className="text-[11px] uppercase text-slate-400">Badges</div>
              <div className="font-mono font-bold text-lg text-orange-300">
                {unlockedBadgesCount} / {ACHIEVEMENT_BADGES.length}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setShowResultsSummary((prev) => !prev);
            }}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/40 font-semibold text-sm transition"
          >
            <BarChart3 className="w-4 h-4" />
            {showResultsSummary ? 'Hide My Report' : 'My Progress Report'}
          </button>
        </div>
      </div>

      {/* Student Progress & Results Panel (Section 18) */}
      {showResultsSummary && (
        <div className="rounded-2xl border-2 border-sky-500/50 bg-slate-900/95 p-6 shadow-2xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <Award className="w-8 h-8 text-amber-400" />
              <div>
                <h2 className="text-xl font-display font-bold text-white">
                  Student Progress Report
                </h2>
                <p className="text-xs text-slate-400">
                  Saved locally in this browser • Gateway Level 2 Programming (T/618/3703)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="practice-nickname" className="text-xs text-slate-300">
                Practice Nickname:
              </label>
              <input
                id="practice-nickname"
                type="text"
                maxLength={16}
                value={nickname}
                onChange={(e) => onChangeNickname(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-sm font-mono text-sky-300 focus:outline-none focus:border-sky-400"
              />
              <button
                type="button"
                onClick={onResetProgress}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-medium transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Local Progress
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
              <h3 className="text-sm font-bold text-emerald-300 mb-2">
                Strongest Topics
              </h3>
              {topicStats.strongest.length > 0 ? (
                <ul className="space-y-1 text-sm text-slate-200 list-disc list-inside">
                  {topicStats.strongest.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">
                  Complete challenges with 2 or 3 stars to unlock your strongest topics!
                </p>
              )}
            </div>

            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30">
              <h3 className="text-sm font-bold text-amber-300 mb-2">
                Recommended Topics to Practise
              </h3>
              {topicStats.toPractise.length > 0 ? (
                <ul className="space-y-1 text-sm text-slate-200 list-disc list-inside">
                  {topicStats.toPractise.slice(0, 4).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-emerald-300">
                  Amazing! You have mastered every topic across all 7 worlds!
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {topicStats.entries.map(([topic, stat]) => (
              <div
                key={topic}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5"
              >
                <div className="font-semibold text-slate-200">{topic}</div>
                <div className="flex items-center justify-between text-slate-400 font-mono">
                  <span>
                    {stat.completed}/{stat.total} solved
                  </span>
                  <span className="text-amber-300">
                    ★ {stat.stars}/{stat.maxStars}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-teal-400"
                    style={{
                      width: `${Math.round((stat.completed / stat.total) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          {/* Achievement Badges Showcase */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-bold text-amber-300 uppercase font-mono">
              Achievement Badges ({unlockedBadgesCount}/{ACHIEVEMENT_BADGES.length} Unlocked)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {ACHIEVEMENT_BADGES.map((badge) => {
                const unlocked = badge.isUnlocked(progress);
                return (
                  <div
                    key={badge.id}
                    className={`p-3 rounded-xl border flex items-start gap-3 transition ${
                      unlocked
                        ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/10 border-amber-400/60 text-white shadow-md'
                        : 'bg-slate-950/70 border-slate-800 text-slate-500 opacity-70'
                    }`}
                  >
                    <span className="text-2xl select-none" aria-hidden="true">
                      {badge.icon}
                    </span>
                    <div>
                      <div
                        className={`text-xs font-display font-bold ${
                          unlocked ? 'text-amber-300' : 'text-slate-400'
                        }`}
                      >
                        {badge.title}
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                        {badge.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 7 World Selection Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {WORLDS.map((world) => {
          const isSelected = world.id === selectedWorldId;
          const worldSolved = world.challengeIds.filter(
            (id) => progress[id]?.completed
          ).length;
          const worldTotal = world.challengeIds.length;

          return (
            <button
              key={world.id}
              type="button"
              onClick={() => {
                sound.playClick();
                setSelectedWorldId(world.id);
              }}
              className={`text-left p-3.5 rounded-xl border-2 transition flex flex-col justify-between ${
                isSelected
                  ? 'border-sky-400 bg-sky-950/50 shadow-lg shadow-sky-500/15'
                  : 'border-arena-border bg-arena-card/70 hover:border-slate-600'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[11px] font-mono font-bold uppercase text-sky-300">
                    World {world.number}
                  </span>
                  <span className="text-xs font-mono text-emerald-300">
                    {worldSolved}/{worldTotal}
                  </span>
                </div>
                <div className="font-display font-bold text-sm text-white leading-snug">
                  {world.title.replace(/^World \d+:\s*/, '')}
                </div>
              </div>

              <div className="mt-3 w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${world.accentColor}`}
                  style={{
                    width: `${Math.round((worldSolved / worldTotal) * 100)}%`,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected World Banner & Challenges Grid */}
      <div className="rounded-2xl border-2 border-arena-border bg-arena-card/90 p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <span className="text-xs font-mono text-sky-400 uppercase">
              {selectedWorld.weekReference}
            </span>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-white">
              {selectedWorld.title} — {selectedWorld.subtitle}
            </h2>
            <p className="text-sm text-slate-300 mt-0.5">
              {selectedWorld.description}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {worldChallenges.map((ch) => {
            const p = progress[ch.id];
            const isDone = Boolean(p?.completed);
            const stars = p?.stars || 0;

            return (
              <div
                key={ch.id}
                className={`rounded-xl border-2 p-4 flex flex-col justify-between gap-4 transition ${
                  isDone
                    ? 'border-emerald-500/50 bg-emerald-950/15'
                    : 'border-slate-800 bg-slate-900/90 hover:border-sky-500/50'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded bg-slate-800 text-sky-300 font-mono text-xs font-bold">
                      #{ch.number} • {ch.difficulty}
                    </span>

                    <div className="flex items-center gap-1">
                      {[1, 2, 3].map((s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            s <= stars
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-700'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
                    {ch.title}
                    {isDone && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    )}
                  </h3>

                  <p className="text-sm text-slate-300 line-clamp-2">
                    {ch.mission}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <span className="text-xs font-mono text-amber-300">
                    Reward: {ch.xpReward} XP
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      setActiveChallengeId(ch.id);
                    }}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm transition ${
                      isDone
                        ? 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40'
                        : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                    }`}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    {isDone ? 'Play Again' : 'Start Challenge'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

