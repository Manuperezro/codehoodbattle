import React, { useEffect, useState } from 'react';
import {
  Gamepad2,
  Sparkles,
  CheckCircle2,
  Clock,
  ShieldCheck,
  LogOut,
  Play,
  ArrowRight,
  PauseCircle,
  Trophy,
  RefreshCw,
} from 'lucide-react';
import { CHALLENGES } from '../data/challenges';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  buildLeaderboardEntries,
  getOrCreateDemoSession,
  getSavedRejoinTicket,
  joinChampionshipWithPin,
  saveRejoinTicket,
  submitChampionshipRoundCode,
  updateDemoSessionStatus,
} from '../services/championshipService';
import {
  GameSession,
  RoundSubmission,
  SessionPlayer,
} from '../types/game';
import { ChallengeArena } from './ChallengeArena';
import { LiveLeaderboard } from './LiveLeaderboard';
import { sound } from '../utils/sound';

export const StudentChampionshipView: React.FC = () => {
  const [pinInput, setPinInput] = useState<string>('');
  const [nicknameInput, setNicknameInput] = useState<string>('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState<boolean>(false);

  const [session, setSession] = useState<GameSession | null>(null);
  const [player, setPlayer] = useState<SessionPlayer | null>(null);
  const [allPlayers, setAllPlayers] = useState<SessionPlayer[]>([]);
  const [submissions, setSubmissions] = useState<RoundSubmission[]>([]);
  const [lastRoundScore, setLastRoundScore] = useState<number | null>(null);

  const savedTicket = getSavedRejoinTicket();

  // Synchronise state in Demo Mode or via Supabase Realtime
  const refreshSessionState = async (activeSessionId: string, activePlayerId: string) => {
    if (isSupabaseConfigured && supabase) {
      const { data: sData } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('id', activeSessionId)
        .maybeSingle();

      const { data: pData } = await supabase
        .from('session_players')
        .select('*')
        .eq('session_id', activeSessionId);

      if (sData) {
        setSession({
          id: sData.id,
          pin: sData.pin,
          title: sData.title,
          teacherId: sData.teacher_id,
          packId: sData.pack_id,
          challengeIds: sData.challenge_ids,
          currentRoundIndex: sData.current_round_index,
          status: sData.status,
          createdAt: sData.created_at,
        });
      }
      if (pData) {
        const mapped: SessionPlayer[] = pData.map((row) => ({
          id: row.id,
          sessionId: row.session_id,
          anonymousAuthId: row.anonymous_auth_id,
          nickname: row.nickname,
          totalScore: row.total_score,
          challengesCompleted: row.challenges_completed,
          currentRoundSubmitted: row.current_round_submitted,
          joinedAt: row.joined_at,
          lastSeenAt: row.last_seen_at,
        }));
        setAllPlayers(mapped);
        const me = mapped.find((p) => p.id === activePlayerId);
        if (me) setPlayer(me);
      }
      return;
    }

    // Demo Mode sync
    const demo = getOrCreateDemoSession();
    if (demo.session.id === activeSessionId) {
      setSession(demo.session);
      setAllPlayers(demo.players);
      setSubmissions(demo.submissions);
      const me = demo.players.find((p) => p.id === activePlayerId);
      if (me) setPlayer(me);
    }
  };

  useEffect(() => {
    if (!session || !player) return;

    if (isSupabaseConfigured && supabase) {
      const sb = supabase;
      const channel = sb
        .channel(`session-${session.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'game_sessions',
            filter: `id=eq.${session.id}`,
          },
          () => {
            refreshSessionState(session.id, player.id);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'session_players',
            filter: `session_id=eq.${session.id}`,
          },
          () => {
            refreshSessionState(session.id, player.id);
          }
        )
        .subscribe();

      return () => {
        sb.removeChannel(channel);
      };
    }

    // Listen to localStorage changes across tabs in Demo Mode
    const handleStorage = () => {
      refreshSessionState(session.id, player.id);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [session?.id, player?.id]);

  // Clear lastRoundScore when round index advances
  useEffect(() => {
    setLastRoundScore(null);
  }, [session?.currentRoundIndex]);

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    setIsJoining(true);

    const res = await joinChampionshipWithPin(pinInput, nicknameInput);
    setIsJoining(false);

    if (!res.ok || !res.session || !res.player) {
      sound.playError();
      setJoinError(res.error || 'Unable to join game.');
      return;
    }

    sound.playSuccess();
    setSession(res.session);
    setPlayer(res.player);
    await refreshSessionState(res.session.id, res.player.id);
  };

  const handleRejoinSaved = async () => {
    if (!savedTicket) return;
    setJoinError(null);
    setIsJoining(true);
    const res = await joinChampionshipWithPin(
      savedTicket.pin,
      savedTicket.nickname
    );
    setIsJoining(false);
    if (res.ok && res.session && res.player) {
      sound.playSuccess();
      setSession(res.session);
      setPlayer(res.player);
      await refreshSessionState(res.session.id, res.player.id);
    } else {
      saveRejoinTicket(null);
      setJoinError('Previous session has ended. Please join with a new PIN.');
    }
  };

  const handleLeaveSession = () => {
    sound.playClick();
    setSession(null);
    setPlayer(null);
  };

  // 1. Not joined yet -> Render Kahoot-style Join Screen
  if (!session || !player) {
    const demoInfo = !isSupabaseConfigured ? getOrCreateDemoSession() : null;

    return (
      <div className="max-w-lg mx-auto space-y-6 py-4">
        <div className="rounded-3xl border-2 border-sky-500/50 bg-arena-card/95 p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-teal-400 flex items-center justify-center mx-auto shadow-lg shadow-sky-500/25">
              <Gamepad2 className="w-9 h-9 text-slate-950" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">
              Join Live Championship
            </h1>
            <p className="text-sm text-slate-300">
              Enter the 6-digit Game PIN shown on your teacher&apos;s screen and pick a coding nickname!
            </p>
          </div>

          {/* Rejoin Banner if student has an active session in this browser */}
          {savedTicket && (
            <div className="p-4 rounded-2xl bg-teal-950/50 border border-teal-500/40 flex items-center justify-between gap-3">
              <div className="text-xs sm:text-sm text-teal-200">
                <div className="font-bold">Rejoin Active Game?</div>
                <div>
                  PIN: <span className="font-mono font-bold">{savedTicket.pin}</span> •{' '}
                  Nickname: <span className="font-bold">{savedTicket.nickname}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRejoinSaved}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shrink-0 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Rejoin
              </button>
            </div>
          )}

          {/* Demo Mode helper pill */}
          {!isSupabaseConfigured && demoInfo && (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-between gap-2 text-xs text-amber-200">
              <div>
                <strong>Demo Mode Ready!</strong> Active Demo PIN:{' '}
                <code className="px-1.5 py-0.5 rounded bg-slate-900 font-mono font-bold text-amber-300">
                  {demoInfo.session.pin}
                </code>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPinInput(demoInfo.session.pin);
                  if (!nicknameInput) setNicknameInput('PythonNinja');
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-200 font-semibold shrink-0 transition"
              >
                Fill Demo PIN
              </button>
            </div>
          )}

          <form onSubmit={handleJoinSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="game-pin-input"
                className="block text-xs font-mono uppercase tracking-wider text-sky-300 font-bold mb-1.5"
              >
                1. Six-Digit Game PIN
              </label>
              <input
                id="game-pin-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={pinInput}
                onChange={(e) =>
                  setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="483921"
                required
                className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border-2 border-slate-700 focus:border-sky-400 text-center font-mono text-2xl tracking-[0.25em] font-bold text-white placeholder-slate-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="student-nickname-input"
                className="block text-xs font-mono uppercase tracking-wider text-sky-300 font-bold mb-1.5"
              >
                2. Coding Nickname (3–16 characters)
              </label>
              <input
                id="student-nickname-input"
                type="text"
                maxLength={16}
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                placeholder="PythonNinja"
                required
                className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border-2 border-slate-700 focus:border-sky-400 text-center font-display text-xl font-bold text-white placeholder-slate-600 focus:outline-none"
              />
            </div>

            {joinError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-sm text-center"
              >
                {joinError}
              </div>
            )}

            <button
              type="submit"
              disabled={isJoining}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-sky-500 to-teal-400 hover:from-sky-400 hover:to-teal-300 text-slate-950 font-display font-extrabold text-lg shadow-lg shadow-sky-500/25 transition transform active:scale-98 focus:outline-none focus:ring-2 focus:ring-sky-300"
            >
              {isJoining ? 'Joining Arena...' : 'Join Championship'}
            </button>
          </form>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-2 border-t border-slate-800">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Privacy First: Never enter your real name, email address or student ID.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Classroom Waiting Lobby (Section 16)
  if (session.status === 'lobby') {
    return (
      <div className="max-w-2xl mx-auto py-6 space-y-6 text-center">
        <div className="rounded-3xl border-2 border-teal-500/50 bg-arena-card/95 p-8 shadow-2xl space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-mono text-sm font-bold">
            <Sparkles className="w-4 h-4" />
            GAME PIN: {session.pin}
          </div>

          <div className="space-y-2">
            <h1 className="text-4xl sm:text-5xl font-display font-extrabold text-white">
              You&apos;re in!
            </h1>
            <p className="text-xl text-sky-300 font-medium">
              Waiting for your teacher to start...
            </p>
          </div>

          {/* Player Card */}
          <div className="max-w-xs mx-auto p-5 rounded-2xl bg-slate-900 border-2 border-sky-400/60 shadow-lg">
            <div className="text-xs font-mono uppercase text-slate-400">
              Your Championship Nickname
            </div>
            <div className="text-2xl font-display font-bold text-white mt-1">
              {player.nickname}
            </div>
          </div>

          {/* Connected Players in Lobby */}
          <div className="space-y-2 pt-2">
            <div className="text-xs font-mono uppercase text-slate-400">
              Coders in Lobby ({allPlayers.length})
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {allPlayers.map((p) => (
                <span
                  key={p.id}
                  className={`px-3 py-1.5 rounded-xl font-display text-sm font-semibold border ${
                    p.id === player.id
                      ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                      : 'bg-slate-900 border-slate-700 text-slate-300'
                  }`}
                >
                  {p.nickname}
                </span>
              ))}
            </div>
          </div>

          {/* Demo Mode Self-Start convenience control */}
          {!isSupabaseConfigured && (
            <div className="pt-4 border-t border-slate-800 space-y-2">
              <p className="text-xs text-amber-300">
                Testing in Local Demo Mode? You can start the championship from the Teacher Dashboard or click below:
              </p>
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  const next = updateDemoSessionStatus('active', 0);
                  setSession(next.session);
                  setAllPlayers(next.players);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm transition"
              >
                <Play className="w-4 h-4 fill-current" />
                Start Round 1 (Demo Mode Shortcut)
              </button>
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              onClick={handleLeaveSession}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
            >
              <LogOut className="w-3.5 h-3.5" /> Leave Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Paused state
  if (session.status === 'paused') {
    return (
      <div className="max-w-xl mx-auto py-10 text-center">
        <div className="rounded-3xl border-2 border-amber-500/50 bg-arena-card p-8 space-y-4">
          <PauseCircle className="w-14 h-14 text-amber-400 mx-auto" />
          <h2 className="text-2xl font-display font-bold text-white">
            Game Paused by Teacher
          </h2>
          <p className="text-slate-300">
            Eyes to the front! Your teacher will resume the championship shortly.
          </p>
          {!isSupabaseConfigured && (
            <button
              type="button"
              onClick={() => {
                const next = updateDemoSessionStatus('active');
                setSession(next.session);
              }}
              className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-sm"
            >
              Resume Game (Demo Shortcut)
            </button>
          )}
        </div>
      </div>
    );
  }

  const totalRounds = session.challengeIds.length;
  const currentChallengeId =
    session.challengeIds[session.currentRoundIndex] || session.challengeIds[0];
  const currentChallenge =
    CHALLENGES.find((c) => c.id === currentChallengeId) || CHALLENGES[0];

  const leaderboardEntries = buildLeaderboardEntries(
    allPlayers,
    submissions,
    session.currentRoundIndex
  );

  // 4. Between-Round Leaderboard or Final Podium
  if (session.status === 'leaderboard' || session.status === 'completed') {
    const isFinal = session.status === 'completed';
    const hasMoreRounds = session.currentRoundIndex < totalRounds - 1;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-mono text-slate-300">
            Playing as <strong className="text-sky-300">{player.nickname}</strong> • PIN:{' '}
            <strong className="text-amber-300">{session.pin}</strong>
          </div>

          {!isSupabaseConfigured && (
            <div className="flex items-center gap-2">
              {!isFinal && hasMoreRounds && (
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    const next = updateDemoSessionStatus(
                      'active',
                      session.currentRoundIndex + 1
                    );
                    setSession(next.session);
                    setAllPlayers(next.players);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition"
                >
                  Next Round (Demo Shortcut) <ArrowRight className="w-4 h-4" />
                </button>
              )}
              {!isFinal && !hasMoreRounds && (
                <button
                  type="button"
                  onClick={() => {
                    sound.playSuccess();
                    const next = updateDemoSessionStatus('completed');
                    setSession(next.session);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition"
                >
                  <Trophy className="w-4 h-4" /> Show Final Podium
                </button>
              )}
            </div>
          )}
        </div>

        <LiveLeaderboard
          entries={leaderboardEntries}
          currentRound={session.currentRoundIndex + 1}
          totalRounds={totalRounds}
          isDemoMode={!isSupabaseConfigured}
          isFinalPodium={isFinal}
          highlightPlayerId={player.id}
        />

        <div className="text-center pt-4">
          <button
            type="button"
            onClick={handleLeaveSession}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold"
          >
            <LogOut className="w-4 h-4" /> Exit Championship
          </button>
        </div>
      </div>
    );
  }

  // 5. Active Round Coding Screen
  return (
    <div className="space-y-5">
      {/* Championship Round Status Bar */}
      <div className="rounded-2xl border-2 border-sky-500/40 bg-slate-900/95 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-lg bg-sky-500/20 border border-sky-400/40 text-sky-300 font-mono text-xs font-bold">
            ROUND {session.currentRoundIndex + 1} OF {totalRounds}
          </span>
          <span className="text-sm font-display font-bold text-white">
            {session.title}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="font-mono text-slate-300">
            Coder: <strong className="text-sky-300">{player.nickname}</strong>
          </div>
          <div className="font-mono text-amber-300 font-bold">
            Total Score: {player.totalScore} pts
          </div>
        </div>
      </div>

      {/* Submitted Waiting Banner for Current Round */}
      {player.currentRoundSubmitted && (
        <div className="rounded-2xl border-2 border-emerald-500/60 bg-emerald-950/30 p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
            <div>
              <h3 className="text-lg font-display font-bold text-white">
                Answer Submitted! {lastRoundScore !== null && `(+${lastRoundScore} pts)`}
              </h3>
              <p className="text-sm text-emerald-200 flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Waiting for your teacher to reveal the round leaderboard...
              </p>
            </div>
          </div>

          {!isSupabaseConfigured && (
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                const next = updateDemoSessionStatus('leaderboard');
                setSession(next.session);
                setAllPlayers(next.players);
                setSubmissions(next.submissions);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm transition"
            >
              <Trophy className="w-4 h-4" /> View Round Leaderboard (Demo Shortcut)
            </button>
          )}
        </div>
      )}

      <ChallengeArena
        challenge={currentChallenge}
        mode="championship"
        alreadySubmittedInRound={player.currentRoundSubmitted}
        onComplete={async (res) => {
          const subRes = await submitChampionshipRoundCode({
            sessionId: session.id,
            playerId: player.id,
            nickname: player.nickname,
            challengeId: currentChallenge.id,
            roundIndex: session.currentRoundIndex,
            submittedCode: res.code,
            hintsUsed: res.hintsUsed,
            timeTakenSeconds: res.timeTakenSeconds,
          });
          if (subRes.ok) {
            setLastRoundScore(subRes.pointsAwarded);
            await refreshSessionState(session.id, player.id);
          }
        }}
      />
    </div>
  );
};
