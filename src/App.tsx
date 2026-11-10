import React, { useEffect, useState } from 'react';
import {
  Terminal,
  Gamepad2,
  BookOpen,
  Monitor,
  Volume2,
  VolumeX,
  Sparkles,
  Trophy,
  Bug,
  Layers,
  Puzzle,
  Eye,
  Bot,
  ShieldCheck,
} from 'lucide-react';
import { CHALLENGES, WORLDS } from './data/challenges';
import { isSupabaseConfigured } from './lib/supabase';
import { ChallengeProgress } from './types/game';
import { PracticeArena } from './components/PracticeArena';
import { StudentChampionshipView } from './components/StudentChampionshipView';
import { TeacherDashboard } from './components/TeacherDashboard';
import { sound } from './utils/sound';

type NavView = 'home' | 'practice' | 'join' | 'teacher';

const PRACTICE_STORAGE_KEY = 'pca_practice_progress_v1';
const PRACTICE_NICKNAME_KEY = 'pca_practice_nickname_v1';

export const App: React.FC = () => {
  const [view, setView] = useState<NavView>('home');
  const [soundMuted, setSoundMuted] = useState<boolean>(() => sound.isMuted());
  const [nickname, setNickname] = useState<string>(() => {
    try {
      return localStorage.getItem(PRACTICE_NICKNAME_KEY) || 'PythonExplorer';
    } catch {
      return 'PythonExplorer';
    }
  });

  const [progress, setProgress] = useState<Record<string, ChallengeProgress>>(
    () => {
      try {
        const raw = localStorage.getItem(PRACTICE_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    }
  );

  useEffect(() => {
    try {
      localStorage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // ignore storage errors
    }
  }, [progress]);

  const handleNicknameChange = (nextName: string) => {
    setNickname(nextName);
    try {
      localStorage.setItem(PRACTICE_NICKNAME_KEY, nextName);
    } catch {
      // ignore
    }
  };

  const handleRecordPracticeCompletion = (
    challengeId: string,
    result: {
      code: string;
      hintsUsed: number;
      attempts: number;
      stars: 1 | 2 | 3;
      xpEarned: number;
    }
  ) => {
    setProgress((prev) => {
      const existing = prev[challengeId];
      const bestStars = existing
        ? (Math.max(existing.stars, result.stars) as 1 | 2 | 3)
        : result.stars;
      const bestXp = existing
        ? Math.max(existing.xpEarned, result.xpEarned)
        : result.xpEarned;

      return {
        ...prev,
        [challengeId]: {
          challengeId,
          completed: true,
          stars: bestStars,
          xpEarned: bestXp,
          hintsUsed: existing
            ? Math.min(existing.hintsUsed, result.hintsUsed)
            : result.hintsUsed,
          attempts: (existing?.attempts || 0) + result.attempts,
          bestCode: result.code,
          lastCompletedAt: new Date().toISOString(),
        },
      };
    });
  };

  const handleResetProgress = () => {
    setProgress({});
    try {
      localStorage.removeItem(PRACTICE_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const toggleSound = () => {
    const next = !soundMuted;
    sound.setMuted(next);
    setSoundMuted(next);
    if (!next) sound.playClick();
  };

  const completedCount = Object.values(progress).filter(
    (p) => p.completed
  ).length;

  return (
    <div className="min-h-screen flex flex-col bg-arena-bg text-slate-100">
      {/* Top Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-arena-border bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Brand Logo */}
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setView('home');
            }}
            className="flex items-center gap-3 text-left group focus:outline-none"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-teal-400 flex items-center justify-center shadow-lg shadow-sky-500/20 group-hover:scale-105 transition">
              <Terminal className="w-6 h-6 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="font-display font-extrabold text-lg sm:text-xl tracking-tight text-white flex items-center gap-2">
                PYTHON CODE ARENA
                <span
                  className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${
                    isSupabaseConfigured
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}
                >
                  {isSupabaseConfigured ? 'Live Cloud' : 'Demo Mode'}
                </span>
              </div>
              <div className="text-xs text-sky-300/90 hidden sm:block">
                Fix the Code. Beat the Bugs. Become a Python Champion!
              </div>
            </div>
          </button>

          {/* Navigation Links */}
          <nav
            className="flex flex-wrap items-center gap-2"
            aria-label="Main Navigation"
          >
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setView('join');
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-display font-bold text-sm transition ${
                view === 'join'
                  ? 'bg-gradient-to-r from-sky-500 to-teal-400 text-slate-950 shadow-md'
                  : 'bg-slate-900 hover:bg-slate-800 text-sky-300 border border-sky-500/40'
              }`}
            >
              <Gamepad2 className="w-4 h-4" />
              Join Game
            </button>

            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setView('practice');
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-display font-bold text-sm transition ${
                view === 'practice'
                  ? 'bg-sky-500 text-slate-950 shadow-md'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Practice Arena ({completedCount}/30)
            </button>

            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setView('teacher');
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-display font-bold text-sm transition ${
                view === 'teacher'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              <Monitor className="w-4 h-4" />
              Teacher
            </button>

            <button
              type="button"
              onClick={toggleSound}
              aria-label={soundMuted ? 'Unmute sound effects' : 'Mute sound effects'}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition"
              title={soundMuted ? 'Sound Muted (Click to unmute)' : 'Sound On (Click to mute)'}
            >
              {soundMuted ? (
                <VolumeX className="w-4 h-4 text-slate-500" />
              ) : (
                <Volume2 className="w-4 h-4 text-sky-400" />
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {view === 'home' && (
          <div className="space-y-8 py-2">
            {/* Hero Banner */}
            <div className="rounded-3xl border-2 border-sky-500/40 bg-gradient-to-br from-slate-900 via-arena-card to-sky-950/50 p-6 sm:p-10 shadow-2xl relative overflow-hidden">
              <div className="max-w-3xl space-y-5">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-300 text-xs font-mono font-bold uppercase">
                  <Sparkles className="w-4 h-4" />
                  Gateway Qualifications Level 2 • Unit T/618/3703
                </div>

                <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-white leading-tight">
                  Fix the Code. Beat the Bugs.{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-teal-300 to-amber-300">
                    Become a Python Champion!
                  </span>
                </h1>

                <p className="text-base sm:text-lg text-slate-200 leading-relaxed">
                  Welcome to <strong>Python Code Arena</strong>! Instead of multiple-choice quizzes, you will write, fix, order and debug real Python code across <strong>30 interactive challenges</strong> and <strong>7 coding worlds</strong>.
                </p>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      setView('join');
                    }}
                    className="inline-flex items-center gap-2.5 px-7 py-4 rounded-2xl bg-gradient-to-r from-sky-500 to-teal-400 hover:from-sky-400 hover:to-teal-300 text-slate-950 font-display font-extrabold text-lg shadow-xl shadow-sky-500/25 transition transform hover:-translate-y-0.5"
                  >
                    <Gamepad2 className="w-6 h-6" />
                    Join Game (Enter PIN)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      setView('practice');
                    }}
                    className="inline-flex items-center gap-2.5 px-7 py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white border-2 border-slate-600 font-display font-bold text-lg transition"
                  >
                    <BookOpen className="w-6 h-6 text-amber-400" />
                    Enter Practice Arena
                  </button>
                </div>
              </div>
            </div>

            {/* Two Game Modes Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-2xl border-2 border-teal-500/40 bg-arena-card/90 p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-lg bg-teal-500/20 text-teal-300 font-mono text-xs font-bold uppercase">
                    Mode A • Solo Learning
                  </span>
                  <BookOpen className="w-6 h-6 text-teal-400" />
                </div>
                <h2 className="text-2xl font-display font-bold text-white">
                  Practice Arena
                </h2>
                <p className="text-sm text-slate-300">
                  Practise at your own pace across 7 worlds (Weeks 1 to 7). Use 3-step progressive hints, earn stars and XP, and track your strongest Python topics with zero time pressure.
                </p>
                <button
                  type="button"
                  onClick={() => setView('practice')}
                  className="inline-flex items-center gap-2 text-sm font-bold text-teal-300 hover:text-teal-200 pt-1"
                >
                  Start Practising ({CHALLENGES.length} Challenges) →
                </button>
              </div>

              <div className="rounded-2xl border-2 border-sky-500/40 bg-arena-card/90 p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-lg bg-sky-500/20 text-sky-300 font-mono text-xs font-bold uppercase">
                    Mode B • Classroom Multiplayer
                  </span>
                  <Trophy className="w-6 h-6 text-amber-400" />
                </div>
                <h2 className="text-2xl font-display font-bold text-white">
                  Live Championship
                </h2>
                <p className="text-sm text-slate-300">
                  Join your lecturer&apos;s live classroom competition using a 6-digit Game PIN and nickname. Solve Python challenges round by round and climb the live podium!
                </p>
                <div className="flex items-center gap-4 pt-1">
                  <button
                    type="button"
                    onClick={() => setView('join')}
                    className="text-sm font-bold text-sky-300 hover:text-sky-200"
                  >
                    Student: Join with PIN →
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('teacher')}
                    className="text-sm font-bold text-amber-300 hover:text-amber-200"
                  >
                    Lecturer: Host Game →
                  </button>
                </div>
              </div>
            </div>

            {/* Six Interactive Minigame Engines Showcase */}
            <div className="space-y-3">
              <h2 className="text-xl font-display font-bold text-white">
                Six Interactive Python Coding Engines
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  {
                    icon: <Bug className="w-5 h-5 text-rose-400" />,
                    title: '1. Bug Hunter',
                    desc: 'Click directly into broken Python lines and type syntax fixes.',
                  },
                  {
                    icon: <Layers className="w-5 h-5 text-teal-400" />,
                    title: '2. Code Builder',
                    desc: 'Drag and drop or use keyboard buttons to put shuffled code in order.',
                  },
                  {
                    icon: <Puzzle className="w-5 h-5 text-amber-400" />,
                    title: '3. Missing Code',
                    desc: 'Complete missing operators, int()/float() conversions and loop variables.',
                  },
                  {
                    icon: <Eye className="w-5 h-5 text-sky-400" />,
                    title: '4. Predict the Output',
                    desc: 'Trace variables and print statements to predict exact terminal output.',
                  },
                  {
                    icon: <Bot className="w-5 h-5 text-emerald-400" />,
                    title: '5. Robot Programmer',
                    desc: 'Guide Robo-Py across a 2D obstacle grid using Python for loops.',
                  },
                  {
                    icon: <Trophy className="w-5 h-5 text-orange-400" />,
                    title: '6. Final Boss Challenges',
                    desc: 'Repair multi-line programs like Cinema Ticket Machine & Guess the Number.',
                  },
                ].map((eng) => (
                  <div
                    key={eng.title}
                    className="p-4 rounded-xl border border-arena-border bg-slate-900/80 flex items-start gap-3"
                  >
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 shrink-0">
                      {eng.icon}
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-white text-sm">
                        {eng.title}
                      </h3>
                      <p className="text-xs text-slate-300 mt-1">{eng.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 7 Worlds Curriculum Map */}
            <div className="space-y-3">
              <h2 className="text-xl font-display font-bold text-white">
                Seven Curriculum Worlds (30 Challenges)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {WORLDS.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setView('practice')}
                    className="text-left p-4 rounded-xl border border-arena-border bg-arena-card/70 hover:border-sky-500/50 transition space-y-1"
                  >
                    <div className="text-xs font-mono text-sky-300">
                      {w.weekReference}
                    </div>
                    <div className="font-display font-bold text-white text-base">
                      {w.title}
                    </div>
                    <p className="text-xs text-slate-400">
                      {w.challengeIds.length} Challenges • {w.subtitle}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'practice' && (
          <PracticeArena
            nickname={nickname}
            onChangeNickname={handleNicknameChange}
            progress={progress}
            onRecordCompletion={handleRecordPracticeCompletion}
            onResetProgress={handleResetProgress}
          />
        )}

        {view === 'join' && <StudentChampionshipView />}

        {view === 'teacher' && <TeacherDashboard />}
      </main>

      {/* Accessible Footer */}
      <footer className="border-t border-arena-border bg-slate-950/90 py-4 px-4 sm:px-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <span>
              <strong>Python Code Arena</strong> • Gateway Qualifications Level 2 Computer Programming (T/618/3703)
            </span>
          </div>
          <div>
            {isSupabaseConfigured
              ? 'Connected to Supabase Realtime Multiplayer'
              : 'Running in Local Demo Mode (Configure .env for Supabase Multiplayer)'}
          </div>
        </div>
      </footer>
    </div>
  );
};

