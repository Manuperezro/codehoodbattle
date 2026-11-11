import React, { useEffect, useState } from 'react';
import {
  Shield,
  PlusCircle,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Trophy,
  Trash2,
  Users,
  BarChart3,
  CheckCircle2,
  LogOut,
  Info,
  KeyRound,
  RefreshCw,
  Monitor,
  Eye,
  EyeOff,
  Clock,
  Code2,
  Terminal,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import { CHALLENGES, CHALLENGE_PACKS } from '../data/challenges';
import {
  isSupabaseConfigured,
  notifySessionRoundChange,
  teacherSupabase as supabase,
} from '../lib/supabase';
import {
  buildLeaderboardEntries,
  createNewDemoSession,
  generateSixDigitPin,
  getOrCreateDemoSession,
  simulateDemoClassroomRoundSubmissions,
  updateDemoSessionStatus,
} from '../services/championshipService';
import {
  GameSession,
  RoundSubmission,
  SessionPlayer,
  TopicTag,
} from '../types/game';
import { LiveLeaderboard } from './LiveLeaderboard';
import { HighlightedPythonLine } from './SyntaxHighlighter';
import { sound } from '../utils/sound';

function formatTimer(seconds: number): string {
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const secs = Math.floor(Math.max(0, seconds) % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const TeacherDashboard: React.FC = () => {
  // Auth state when Supabase is configured
  const [teacherEmail, setTeacherEmail] = useState<string>('');
  const [teacherPassword, setTeacherPassword] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [unregisteredUuid, setUnregisteredUuid] = useState<string | null>(null);
  const [isTeacherAuthenticated, setIsTeacherAuthenticated] = useState<boolean>(
    !isSupabaseConfigured
  );
  const [verifiedTeacherId, setVerifiedTeacherId] = useState<string | null>(
    !isSupabaseConfigured ? 'demo-teacher-id' : null
  );

  // Championship configuration state
  const [newTitle, setNewTitle] = useState<string>('Level 2 Python Arena Cup');
  const [selectedPackId, setSelectedPackId] = useState<string>(
    CHALLENGE_PACKS[3].id
  );
  const [challengeCount, setChallengeCount] = useState<number>(8);

  // Active session state
  const [session, setSession] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<SessionPlayer[]>([]);
  const [submissions, setSubmissions] = useState<RoundSubmission[]>([]);
  const [activeTab, setActiveTab] = useState<'control' | 'analytics'>('control');

  // Teacher Question, Solution & Student Answers visibility toggles
  const [showCorrectAnswer, setShowCorrectAnswer] = useState<boolean>(false);
  const [showStudentCode, setShowStudentCode] = useState<boolean>(false);

  // Round Timer & Countdown state
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [countdownTarget, setCountdownTarget] = useState<number | null>(90); // default 90s per round, or null for count-up only
  const [autoPauseOnZero, setAutoPauseOnZero] = useState<boolean>(false);

  const selectedPack =
    CHALLENGE_PACKS.find((p) => p.id === selectedPackId) || CHALLENGE_PACKS[0];

  // Reset answer reveal and elapsed timer when round changes
  useEffect(() => {
    setShowCorrectAnswer(false);
    setElapsedSeconds(0);
  }, [session?.currentRoundIndex, session?.id]);

  // Tick timer every second when session is 'active'
  useEffect(() => {
    if (!session || session.status !== 'active') return;
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        if (
          countdownTarget !== null &&
          autoPauseOnZero &&
          next >= countdownTarget
        ) {
          handleSessionControl('leaderboard');
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [session?.status, session?.currentRoundIndex, countdownTarget, autoPauseOnZero]);

  const loadCloudSessionDetails = async (
    sessionId: string,
    roundIdxOverride?: number
  ) => {
    if (!supabase) return;
    const { data: sData } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    const activeRoundIdx =
      typeof roundIdxOverride === 'number'
        ? roundIdxOverride
        : sData
        ? sData.current_round_index
        : session?.currentRoundIndex || 0;

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

    const { data: pRows } = await supabase
      .from('session_players')
      .select('*')
      .eq('session_id', sessionId);

    const playerMap = new Map<string, string>();
    (pRows || []).forEach((r) => playerMap.set(r.id, r.nickname));

    const { data: scoreRows } = await supabase
      .from('scores')
      .select('*')
      .eq('session_id', sessionId);

    const { data: attemptRows } = await supabase
      .from('challenge_attempts')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    const mappedScores: RoundSubmission[] = (scoreRows || []).map((s) => {
      // Find matching attempt to get submitted_code, hints_used, time_taken_seconds
      const matchingAttempt = (attemptRows || []).find(
        (a) =>
          a.player_id === s.player_id &&
          a.round_index === s.round_index &&
          a.is_correct
      );
      return {
        id: s.id,
        sessionId: s.session_id,
        playerId: s.player_id,
        nickname: playerMap.get(s.player_id) || 'Student',
        challengeId: s.challenge_id,
        roundIndex: s.round_index,
        submittedCode: matchingAttempt?.submitted_code || '',
        isCorrect: true,
        hintsUsed: matchingAttempt?.hints_used ?? 0,
        timeTakenSeconds: matchingAttempt?.time_taken_seconds ?? 0,
        pointsAwarded: s.total_points,
        submittedAt: s.awarded_at,
      };
    });

    setSubmissions(mappedScores);

    if (pRows) {
      setPlayers(
        pRows.map((r) => ({
          id: r.id,
          sessionId: r.session_id,
          anonymousAuthId: r.anonymous_auth_id,
          nickname: r.nickname,
          totalScore: r.total_score,
          challengesCompleted: r.challenges_completed,
          currentRoundSubmitted: mappedScores.some(
            (sc) => sc.playerId === r.id && sc.roundIndex === activeRoundIdx
          ),
          joinedAt: r.joined_at,
          lastSeenAt: r.last_seen_at,
        }))
      );
    }
  };

  const loadTeacherLatestSession = async (teacherId: string) => {
    if (!supabase) return;
    const { data: latestSession } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestSession) {
      await loadCloudSessionDetails(
        latestSession.id,
        latestSession.current_round_index
      );
    }
  };

  // Check teacher session if Supabase is configured
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      const demo = getOrCreateDemoSession();
      setSession(demo.session);
      setPlayers(demo.players);
      setSubmissions(demo.submissions);
      return;
    }

    const sb = supabase;
    sb.auth.getSession().then(async ({ data: { session: authSession } }) => {
      if (authSession?.user) {
        const { data: profile } = await sb
          .from('teacher_profiles')
          .select('id')
          .eq('id', authSession.user.id)
          .maybeSingle();

        if (profile) {
          setIsTeacherAuthenticated(true);
          setVerifiedTeacherId(profile.id);
          await loadTeacherLatestSession(profile.id);
        }
      }
    });
  }, []);

  // Sync Demo Mode storage updates across tabs or Supabase Realtime in Cloud Mode
  useEffect(() => {
    if (isSupabaseConfigured && supabase && session) {
      const sb = supabase;
      const refreshCloudSession = () => {
        loadCloudSessionDetails(session.id);
      };

      const channel = sb
        .channel(`teacher-session-${session.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'session_players',
            filter: `session_id=eq.${session.id}`,
          },
          refreshCloudSession
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'scores',
            filter: `session_id=eq.${session.id}`,
          },
          refreshCloudSession
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'challenge_attempts',
            filter: `session_id=eq.${session.id}`,
          },
          refreshCloudSession
        )
        .subscribe();

      const pollInterval = setInterval(refreshCloudSession, 2000);

      return () => {
        clearInterval(pollInterval);
        sb.removeChannel(channel);
      };
    }

    const syncDemo = () => {
      const demo = getOrCreateDemoSession();
      setSession(demo.session);
      setPlayers(demo.players);
      setSubmissions(demo.submissions);
    };
    window.addEventListener('storage', syncDemo);
    return () => window.removeEventListener('storage', syncDemo);
  }, [session?.id]);

  const handleTeacherSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!supabase) return;

    const { data, error } = await supabase.auth.signInWithPassword({
      email: teacherEmail.trim(),
      password: teacherPassword,
    });

    if (error || !data.user) {
      setAuthError(error?.message || 'Sign-in failed.');
      return;
    }

    const { data: profile, error: profErr } = await supabase
      .from('teacher_profiles')
      .select('id, display_name')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profErr || !profile) {
      setUnregisteredUuid(data.user.id);
      await supabase.auth.signOut();
      setAuthError(
        'Your user exists in Supabase Auth, but is not yet registered in public.teacher_profiles. Run the 2-line SQL shown below in the Supabase SQL Editor!'
      );
      return;
    }

    setUnregisteredUuid(null);
    setIsTeacherAuthenticated(true);
    setVerifiedTeacherId(profile.id);
    await loadTeacherLatestSession(profile.id);
  };

  const handleCreateChampionship = async (e: React.FormEvent) => {
    e.preventDefault();
    sound.playClick();

    if (isSupabaseConfigured && supabase && verifiedTeacherId) {
      const pin = generateSixDigitPin();
      const ids = selectedPack.challengeIds.slice(
        0,
        Math.min(challengeCount, selectedPack.challengeIds.length)
      );
      const { data, error } = await supabase
        .from('game_sessions')
        .insert({
          pin,
          title: newTitle.trim() || 'Classroom Python Championship',
          teacher_id: verifiedTeacherId,
          pack_id: selectedPack.id,
          challenge_ids: ids,
          current_round_index: 0,
          status: 'lobby',
        })
        .select('*')
        .single();

      if (!error && data) {
        setSession({
          id: data.id,
          pin: data.pin,
          title: data.title,
          teacherId: data.teacher_id,
          packId: data.pack_id,
          challengeIds: data.challenge_ids,
          currentRoundIndex: data.current_round_index,
          status: data.status,
          createdAt: data.created_at,
        });
        setPlayers([]);
        setSubmissions([]);
        setElapsedSeconds(0);
      }
      return;
    }

    const created = createNewDemoSession({
      title: newTitle,
      packId: selectedPackId,
      challengeCount,
    });
    setSession(created.session);
    setPlayers(created.players);
    setSubmissions(created.submissions);
    setElapsedSeconds(0);
  };

  const handleSessionControl = async (
    nextStatus: GameSession['status'],
    nextRoundIndex?: number
  ) => {
    if (!session) return;
    sound.playClick();

    if (isSupabaseConfigured && supabase) {
      const targetRoundIdx =
        typeof nextRoundIndex === 'number'
          ? nextRoundIndex
          : session.currentRoundIndex;

      setSession({
        ...session,
        status: nextStatus,
        currentRoundIndex: targetRoundIdx,
      });

      const updatePayload: Record<string, unknown> = {
        status: nextStatus,
        current_round_index: targetRoundIdx,
      };

      const { data: updatedRow, error: updateErr } = await supabase
        .from('game_sessions')
        .update(updatePayload)
        .eq('id', session.id)
        .select('*')
        .maybeSingle();

      if (updateErr || !updatedRow) {
        const {
          data: { session: currentAuth },
        } = await supabase.auth.getSession();
        if (!currentAuth) {
          setIsTeacherAuthenticated(false);
          setAuthError('Session expired. Please sign in again as Teacher.');
          return;
        }
      }

      notifySessionRoundChange(session.id);
      await loadCloudSessionDetails(session.id, targetRoundIdx);
      return;
    }

    const updated = updateDemoSessionStatus(nextStatus, nextRoundIndex);
    notifySessionRoundChange(updated.session.id);
    setSession(updated.session);
    setPlayers(updated.players);
    setSubmissions(updated.submissions);
  };

  const handleDeleteOrResetSession = async () => {
    if (!session) return;
    sound.playClick();

    if (isSupabaseConfigured && supabase) {
      await supabase.from('game_sessions').delete().eq('id', session.id);
      setSession(null);
      setPlayers([]);
      setSubmissions([]);
      return;
    }

    const reset = createNewDemoSession({
      title: newTitle,
      packId: selectedPackId,
      challengeCount,
    });
    setSession(reset.session);
    setPlayers(reset.players);
    setSubmissions(reset.submissions);
  };

  // Teacher Login Screen when Supabase is configured and teacher not yet signed in
  if (isSupabaseConfigured && !isTeacherAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-8">
        <div className="rounded-3xl border-2 border-arena-border bg-arena-card p-6 sm:p-8 shadow-2xl space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-sky-500/20 border border-sky-400/40 text-sky-300">
              <KeyRound className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-white">
                Teacher Sign In
              </h1>
              <p className="text-xs text-slate-400">
                Verified server-side via Supabase teacher_profiles
              </p>
            </div>
          </div>

          <form onSubmit={handleTeacherSignIn} className="space-y-4">
            <div>
              <label
                htmlFor="teacher-email"
                className="block text-xs font-mono uppercase text-slate-300 mb-1"
              >
                Lecturer Email
              </label>
              <input
                id="teacher-email"
                type="email"
                required
                value={teacherEmail}
                onChange={(e) => setTeacherEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-sky-400"
              />
            </div>

            <div>
              <label
                htmlFor="teacher-password"
                className="block text-xs font-mono uppercase text-slate-300 mb-1"
              >
                Password
              </label>
              <input
                id="teacher-password"
                type="password"
                required
                value={teacherPassword}
                onChange={(e) => setTeacherPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-sky-400"
              />
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs space-y-2">
                <div>{authError}</div>
                {unregisteredUuid && (
                  <pre className="p-2 rounded bg-slate-950 text-amber-300 font-mono text-[11px] overflow-x-auto select-all">
{`insert into public.teacher_profiles (id, display_name)
values ('${unregisteredUuid}', 'Profesor')
on conflict (id) do nothing;`}
                  </pre>
                )}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-bold text-base transition"
            >
              Sign In to Teacher Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  const totalRounds = session?.challengeIds.length || 1;
  const currentRoundIdx = session?.currentRoundIndex || 0;
  const currentChallengeId = session?.challengeIds[currentRoundIdx];
  const currentChallenge =
    CHALLENGES.find((c) => c.id === currentChallengeId) || CHALLENGES[0];

  const submittedCount = players.filter((p) => p.currentRoundSubmitted).length;
  const leaderboardEntries = buildLeaderboardEntries(
    players,
    submissions,
    currentRoundIdx
  );

  const currentRoundSubmissions = submissions.filter(
    (s) => s.roundIndex === currentRoundIdx
  );

  const remainingCountdown =
    countdownTarget !== null
      ? Math.max(0, countdownTarget - elapsedSeconds)
      : null;

  const averageScore =
    players.length > 0
      ? Math.round(
          players.reduce((acc, p) => acc + p.totalScore, 0) / players.length
        )
      : 0;

  const studentViewLabels: Record<GameSession['status'], string> = {
    lobby: 'Waiting Lobby ("Waiting for your teacher to start...")',
    active: `Coding Round ${currentRoundIdx + 1}: #${currentChallenge.number} ${currentChallenge.title}`,
    paused: 'Paused Screen ("Game Paused by Teacher — Eyes to the front!")',
    leaderboard: `Round ${currentRoundIdx + 1} Live Leaderboard`,
    completed: 'Final Championship Podium (Top 3 Winners)',
  };

  return (
    <div className="space-y-6">
      {/* Demo Mode Teacher Banner */}
      {!isSupabaseConfigured && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-amber-500/15 border border-amber-400/50 text-amber-200 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5">
            <Info className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <strong>DEMO MODE TEACHER DASHBOARD:</strong> Exploring local teacher controls and sample classroom data. Open a second tab or switch to <strong>Join Game</strong> with PIN{' '}
              <span className="font-mono font-bold underline">
                {session?.pin || '483921'}
              </span>{' '}
              to test the full student/teacher flow!
            </div>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="rounded-2xl border-2 border-arena-border bg-arena-card/95 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-300">
            <Monitor className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-mono uppercase text-sky-400 font-bold">
              Classroom Projector &amp; Instructor Control Centre
            </div>
            <h1 className="text-2xl font-display font-bold text-white">
              Teacher Championship Dashboard
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setActiveTab('control')}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition flex items-center gap-1.5 ${
              activeTab === 'control'
                ? 'bg-sky-500 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Shield className="w-4 h-4" /> Live Session Control
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition flex items-center gap-1.5 ${
              activeTab === 'analytics'
                ? 'bg-sky-500 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <BarChart3 className="w-4 h-4" /> Class Analytics &amp; Results
          </button>

          {isSupabaseConfigured && (
            <button
              type="button"
              onClick={async () => {
                await supabase?.auth.signOut();
                setIsTeacherAuthenticated(false);
              }}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          )}
        </div>
      </div>

      {activeTab === 'control' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Create / Configure Championship & Round Selector */}
          <div className="lg:col-span-4 space-y-5">
            <div className="rounded-2xl border-2 border-arena-border bg-arena-card/90 p-5 space-y-4">
              <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-teal-400" />
                Create New Championship
              </h2>

              <form onSubmit={handleCreateChampionship} className="space-y-3.5">
                <div>
                  <label
                    htmlFor="session-title"
                    className="block text-xs font-mono uppercase text-slate-300 mb-1"
                  >
                    Session Title
                  </label>
                  <input
                    id="session-title"
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="pack-select"
                    className="block text-xs font-mono uppercase text-slate-300 mb-1"
                  >
                    Challenge Pack
                  </label>
                  <select
                    id="pack-select"
                    value={selectedPackId}
                    onChange={(e) => {
                      const pack = CHALLENGE_PACKS.find(
                        (p) => p.id === e.target.value
                      );
                      setSelectedPackId(e.target.value);
                      if (pack) setChallengeCount(pack.challengeIds.length);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-400"
                  >
                    {CHALLENGE_PACKS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">
                    {selectedPack.description}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="num-challenges"
                    className="block text-xs font-mono uppercase text-slate-300 mb-1"
                  >
                    Number of Challenges ({challengeCount})
                  </label>
                  <input
                    id="num-challenges"
                    type="range"
                    min={1}
                    max={selectedPack.challengeIds.length}
                    value={Math.min(
                      challengeCount,
                      selectedPack.challengeIds.length
                    )}
                    onChange={(e) => setChallengeCount(Number(e.target.value))}
                    className="w-full accent-sky-400"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-display font-bold text-sm transition flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-4 h-4" /> Generate New 6-Digit PIN
                </button>
              </form>
            </div>

            {/* Direct Round Navigator (Jump to any challenge in the session) */}
            {session && (
              <div className="rounded-2xl border-2 border-arena-border bg-arena-card/90 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-display font-bold text-white uppercase tracking-wider">
                    Jump to Any Round ({totalRounds} Challenges)
                  </h3>
                  <span className="text-xs font-mono text-sky-300">
                    Current: R{currentRoundIdx + 1}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Click any challenge below to send all connected students directly to that round:
                </p>
                <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                  {session.challengeIds.map((cid, idx) => {
                    const ch = CHALLENGES.find((c) => c.id === cid);
                    const isCurrent = idx === currentRoundIdx;
                    return (
                      <button
                        key={`${cid}-${idx}`}
                        type="button"
                        onClick={() => handleSessionControl('active', idx)}
                        className={`w-full text-left px-3 py-2 rounded-xl border text-xs transition flex items-center justify-between gap-2 ${
                          isCurrent
                            ? 'bg-sky-500/20 border-sky-400 text-white font-bold'
                            : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <span className="truncate">
                          <span className="font-mono text-sky-400 mr-1.5">
                            R{idx + 1}.
                          </span>
                          {ch ? `${ch.title} (#${ch.number})` : cid}
                        </span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 shrink-0">
                          {ch?.engineType.replace('_', ' ')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Active Session Projector, Timer, Question/Solution Viewer & Student Answers */}
          <div className="lg:col-span-8 space-y-5">
            {session && (
              <div className="rounded-3xl border-2 border-sky-500/60 bg-slate-900/95 p-6 shadow-2xl space-y-5">
                {/* Large Projector PIN & Timer Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800">
                  <div className="space-y-1">
                    <span className="px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 font-mono text-xs uppercase font-bold">
                      Status: {session.status.toUpperCase()}
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mt-1">
                      {session.title}
                    </h2>
                    <div className="text-xs sm:text-sm text-teal-300 flex items-center gap-1.5 pt-1">
                      <Eye className="w-4 h-4 shrink-0" />
                      <span>
                        <strong>Student Screens Showing:</strong>{' '}
                        {studentViewLabels[session.status]}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Live Round Timer Box */}
                    <div
                      className={`px-5 py-3 rounded-2xl border-2 text-center shadow-lg ${
                        remainingCountdown !== null && remainingCountdown <= 15
                          ? 'bg-rose-950/80 border-rose-500 text-rose-200 animate-pulse'
                          : 'bg-slate-950 border-sky-500/60 text-white'
                      }`}
                    >
                      <div className="text-[11px] font-mono uppercase text-sky-300 font-bold flex items-center justify-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {remainingCountdown !== null
                          ? 'TIME REMAINING'
                          : 'ROUND TIME'}
                      </div>
                      <div className="text-3xl sm:text-4xl font-mono font-extrabold tracking-wider">
                        {remainingCountdown !== null
                          ? formatTimer(remainingCountdown)
                          : formatTimer(elapsedSeconds)}
                      </div>
                    </div>

                    {/* Large Game PIN Box */}
                    <div className="px-6 py-3 rounded-2xl bg-slate-950 border-2 border-amber-400 text-center shadow-lg">
                      <div className="text-xs font-mono uppercase text-amber-300 font-bold">
                        JOIN WITH GAME PIN
                      </div>
                      <div className="text-3xl sm:text-4xl font-mono font-extrabold tracking-widest text-white">
                        {session.pin}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timer Configuration Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono uppercase text-slate-400 font-semibold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-sky-400" /> Round Timer Preset:
                    </span>
                    {[
                      { label: 'Count Up Only', val: null },
                      { label: '60s', val: 60 },
                      { label: '90s', val: 90 },
                      { label: '120s', val: 120 },
                      { label: '180s', val: 180 },
                    ].map((preset) => (
                      <button
                        key={String(preset.val)}
                        type="button"
                        onClick={() => {
                          setCountdownTarget(preset.val);
                          setElapsedSeconds(0);
                        }}
                        className={`px-2.5 py-1 rounded-lg font-mono transition ${
                          countdownTarget === preset.val
                            ? 'bg-sky-500 text-slate-950 font-bold'
                            : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                    {countdownTarget !== null && (
                      <button
                        type="button"
                        onClick={() =>
                          setCountdownTarget((prev) => (prev || 60) + 30)
                        }
                        className="px-2.5 py-1 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/40 font-mono hover:bg-teal-500/30"
                      >
                        +30s
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setElapsedSeconds(0)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 font-mono"
                    >
                      Reset Clock
                    </button>
                  </div>

                  {countdownTarget !== null && (
                    <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoPauseOnZero}
                        onChange={(e) => setAutoPauseOnZero(e.target.checked)}
                        className="accent-sky-400"
                      />
                      <span>Auto-show Leaderboard at 00:00</span>
                    </label>
                  )}
                </div>

                {/* Live Round & Submission Counter */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="text-xs font-mono uppercase text-slate-400">
                      Connected Students
                    </div>
                    <div className="text-2xl font-display font-bold text-sky-300 mt-1 flex items-center gap-2">
                      <Users className="w-6 h-6" /> {players.length}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="text-xs font-mono uppercase text-slate-400">
                      Current Round
                    </div>
                    <div className="text-2xl font-display font-bold text-white mt-1">
                      Round {currentRoundIdx + 1} of {totalRounds}
                    </div>
                    <div className="text-xs text-teal-300 truncate mt-0.5">
                      #{currentChallenge.number}: {currentChallenge.title}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="text-xs font-mono uppercase text-slate-400">
                      Round {currentRoundIdx + 1} Solved
                    </div>
                    <div className="text-2xl font-display font-bold text-emerald-400 mt-1 flex items-center gap-2">
                      <CheckCircle2 className="w-6 h-6" /> {submittedCount} /{' '}
                      {players.length}
                    </div>
                  </div>
                </div>

                {/* Teacher Master Screen & Round Controls */}
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  {session.status === 'lobby' && (
                    <button
                      type="button"
                      onClick={() => handleSessionControl('active', 0)}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-base shadow-lg transition"
                    >
                      <Play className="w-5 h-5 fill-current" /> Start Game (Round 1)
                    </button>
                  )}

                  {currentRoundIdx > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        handleSessionControl('active', currentRoundIdx - 1)
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-semibold text-xs transition"
                    >
                      <SkipBack className="w-4 h-4" /> Prev (R{currentRoundIdx})
                    </button>
                  )}

                  {session.status !== 'active' && session.status !== 'lobby' && (
                    <button
                      type="button"
                      onClick={() =>
                        handleSessionControl('active', currentRoundIdx)
                      }
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-sm transition"
                    >
                      <Play className="w-4 h-4 fill-current" /> Show Challenge (R
                      {currentRoundIdx + 1}) on Student Screens
                    </button>
                  )}

                  {session.status === 'active' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSessionControl('paused')}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-semibold text-sm transition"
                      >
                        <Pause className="w-4 h-4" /> Pause Students
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSessionControl('leaderboard')}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-bold text-sm transition"
                      >
                        <Trophy className="w-4 h-4" /> Show Leaderboard to Class
                      </button>

                      {!isSupabaseConfigured && (
                        <button
                          type="button"
                          onClick={() => {
                            sound.playSuccess();
                            const sim = simulateDemoClassroomRoundSubmissions();
                            setSession(sim.session);
                            setPlayers(sim.players);
                            setSubmissions(sim.submissions);
                          }}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 border border-teal-400/40 font-semibold text-xs transition"
                        >
                          <Users className="w-4 h-4" /> Simulate Class Answers (Demo)
                        </button>
                      )}
                    </>
                  )}

                  {currentRoundIdx < totalRounds - 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        handleSessionControl('active', currentRoundIdx + 1)
                      }
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-display font-bold text-sm transition"
                    >
                      <SkipForward className="w-4 h-4" /> Next Challenge (Round{' '}
                      {currentRoundIdx + 2})
                    </button>
                  )}

                  {session.status !== 'completed' && (
                    <button
                      type="button"
                      onClick={() => handleSessionControl('completed')}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm transition"
                    >
                      <Trophy className="w-4 h-4" /> Final Podium
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleDeleteOrResetSession}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold ml-auto transition"
                  >
                    <Trash2 className="w-4 h-4" /> Reset / Delete
                  </button>
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* TEACHER QUESTION, INITIAL CODE & MODEL SOLUTION INSPECTOR         */}
            {/* ================================================================= */}
            {session && currentChallenge && (
              <div className="rounded-3xl border-2 border-arena-border bg-arena-card/95 p-6 shadow-xl space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono text-xs font-bold">
                        ROUND {currentRoundIdx + 1} QUESTION • CHALLENGE #
                        {currentChallenge.number}
                      </span>
                      <span className="px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-xs">
                        {currentChallenge.engineType.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="px-2.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-xs">
                        {currentChallenge.difficulty}
                      </span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-display font-bold text-white mt-1.5">
                      {currentChallenge.title}
                    </h3>
                  </div>

                  {/* Toggle Correct Answer Button */}
                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      setShowCorrectAnswer((prev) => !prev);
                    }}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-display font-bold text-sm border transition ${
                      showCorrectAnswer
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                        : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {showCorrectAnswer ? (
                      <>
                        <EyeOff className="w-4 h-4" /> Hide Correct Answer &amp; Hints
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" /> Show Correct Answer &amp; Hints
                      </>
                    )}
                  </button>
                </div>

                {/* Question / Mission Prompt that students see */}
                <div className="space-y-2">
                  <div className="text-xs font-mono uppercase text-sky-300 font-bold">
                    Student Mission / Question Prompt:
                  </div>
                  <p className="text-base sm:text-lg text-slate-100 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                    {currentChallenge.mission}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                    <span>
                      <strong className="text-slate-300">Learning Objective:</strong>{' '}
                      {currentChallenge.learningObjective}
                    </span>
                    {currentChallenge.simulatedInputs &&
                      currentChallenge.simulatedInputs.length > 0 && (
                        <span className="font-mono text-indigo-300">
                          Simulated Input():{' '}
                          <strong>
                            {currentChallenge.simulatedInputs.join(', ')}
                          </strong>
                        </span>
                      )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left: Initial Code / Blocks shown to students */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
                    <div className="text-xs font-mono uppercase text-slate-400 font-bold flex items-center gap-1.5">
                      <Code2 className="w-4 h-4 text-sky-400" />
                      Initial Code / Blocks Shown to Students:
                    </div>
                    <div className="space-y-1.5 font-mono text-sm sm:text-base pt-1">
                      {(currentChallenge.engineType === 'code_builder' &&
                      currentChallenge.shuffledBlocks
                        ? currentChallenge.shuffledBlocks
                        : currentChallenge.initialLines
                      ).map((line, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded bg-slate-900/90"
                        >
                          <span className="w-5 text-right text-xs text-slate-500 select-none">
                            {i + 1}
                          </span>
                          <div className="overflow-x-auto">
                            <HighlightedPythonLine line={line} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Correct Answer & Expected Output (Revealed when showCorrectAnswer is true) */}
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/15 p-4 space-y-3 flex flex-col justify-between">
                    {showCorrectAnswer ? (
                      <div className="space-y-3">
                        <div className="text-xs font-mono uppercase text-emerald-300 font-bold flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-400" />
                          Correct Python Solution:
                        </div>
                        <div className="space-y-1.5 font-mono text-sm sm:text-base">
                          {currentChallenge.correctSolution
                            .split('\n')
                            .map((line, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded bg-slate-950 border border-emerald-500/30"
                              >
                                <span className="w-5 text-right text-xs text-emerald-400 select-none">
                                  {i + 1}
                                </span>
                                <div className="overflow-x-auto">
                                  <HighlightedPythonLine line={line} />
                                </div>
                              </div>
                            ))}
                        </div>

                        <div className="pt-2 border-t border-emerald-500/20">
                          <div className="text-xs font-mono uppercase text-slate-400 flex items-center gap-1 mb-1">
                            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                            Expected Terminal Output:
                          </div>
                          <pre className="p-2.5 rounded-lg bg-slate-950 text-emerald-300 font-mono text-sm whitespace-pre-wrap">
                            {currentChallenge.expectedOutput}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center py-6 space-y-2 text-slate-400">
                        <EyeOff className="w-8 h-8 text-slate-500" />
                        <div className="text-sm font-semibold text-slate-300">
                          Model Solution Hidden for Classroom Projection
                        </div>
                        <p className="text-xs max-w-xs">
                          Click <strong>&quot;Show Correct Answer &amp; Hints&quot;</strong> above to reveal the solution when reviewing with your class.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3 Progressive Hints when Answer Key is expanded */}
                {showCorrectAnswer && (
                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <div className="text-xs font-mono uppercase text-amber-300 font-bold flex items-center gap-1.5">
                      <Lightbulb className="w-4 h-4" /> Three Progressive Hints Available to Students:
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {currentChallenge.hints.map((h, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl bg-slate-950 border border-amber-500/30 text-xs text-slate-200"
                        >
                          <div className="font-bold text-amber-400 mb-1">
                            Hint {i + 1}:
                          </div>
                          <div className="whitespace-pre-line">{h}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ================================================================= */}
            {/* LIVE STUDENT ANSWERS & SUBMITTED CODE INSPECTOR                   */}
            {/* ================================================================= */}
            {session && (
              <div className="rounded-3xl border-2 border-arena-border bg-arena-card/95 p-6 shadow-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-sky-400" />
                      Round {currentRoundIdx + 1} Student Status &amp; Answers (
                      {submittedCount}/{players.length} Solved)
                    </h3>
                    <p className="text-xs text-slate-400">
                      See who has finished Round {currentRoundIdx + 1} and optionally inspect their submitted Python code.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowStudentCode((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-sky-300 border border-sky-500/40 text-xs font-semibold transition"
                  >
                    {showStudentCode ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" /> Hide Student Code
                      </>
                    ) : (
                      <>
                        <Code2 className="w-3.5 h-3.5" /> Show Student Submitted Code
                      </>
                    )}
                  </button>
                </div>

                {players.length === 0 ? (
                  <div className="text-sm text-slate-400 py-4 text-center">
                    No students have joined with PIN <strong>{session.pin}</strong> yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {players.map((p) => {
                      const sub = currentRoundSubmissions.find(
                        (s) => s.playerId === p.id
                      );
                      return (
                        <div
                          key={p.id}
                          className={`p-3.5 rounded-xl border transition space-y-2 ${
                            p.currentRoundSubmitted
                              ? 'bg-emerald-950/20 border-emerald-500/50'
                              : 'bg-slate-950 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-display font-bold text-white text-sm flex items-center gap-2">
                              {p.nickname}
                              {p.currentRoundSubmitted ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[11px]">
                                  <CheckCircle2 className="w-3 h-3" /> Solved
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono text-[11px]">
                                  <Clock className="w-3 h-3" /> Coding...
                                </span>
                              )}
                            </span>

                            <span className="font-mono text-xs text-amber-300 font-bold">
                              {sub ? `+${sub.pointsAwarded} pts` : `${p.totalScore} total`}
                            </span>
                          </div>

                          {sub && (
                            <div className="text-[11px] font-mono text-slate-400 flex items-center gap-3">
                              <span>Hints used: {sub.hintsUsed}</span>
                              {sub.timeTakenSeconds > 0 && (
                                <span>Time: {sub.timeTakenSeconds}s</span>
                              )}
                            </div>
                          )}

                          {showStudentCode && sub?.submittedCode && (
                            <pre className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-sky-200 overflow-x-auto whitespace-pre-wrap">
                              {sub.submittedCode}
                            </pre>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Projected Live Leaderboard */}
            {session && (
              <LiveLeaderboard
                entries={leaderboardEntries}
                currentRound={currentRoundIdx + 1}
                totalRounds={totalRounds}
                isDemoMode={!isSupabaseConfigured}
                isFinalPodium={session.status === 'completed'}
              />
            )}
          </div>
        </div>
      ) : (
        /* Teacher Results & Analytics Tab (Section 18) */
        <div className="rounded-3xl border-2 border-arena-border bg-arena-card/95 p-6 shadow-2xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-2xl font-display font-bold text-white">
                Class Performance &amp; Challenge Analytics
              </h2>
              <p className="text-sm text-slate-300">
                Review participant scores, most difficult challenges, and topic performance (nicknames only — zero personal data).
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isSupabaseConfigured && (
                <button
                  type="button"
                  onClick={async () => {
                    sound.playClick();
                    await supabase?.rpc('cleanup_old_game_sessions', {
                      days_to_keep: 7,
                    });
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Clean Up Old Sessions (&gt;7d)
                </button>
              )}
              <button
                type="button"
                onClick={handleDeleteOrResetSession}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold transition"
              >
                <Trash2 className="w-4 h-4" /> Delete Session &amp; Results
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-xs font-mono uppercase text-slate-400">
                Participants
              </div>
              <div className="text-3xl font-mono font-bold text-sky-300 mt-1">
                {players.length}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-xs font-mono uppercase text-slate-400">
                Class Average Score
              </div>
              <div className="text-3xl font-mono font-bold text-amber-300 mt-1">
                {averageScore} pts
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-xs font-mono uppercase text-slate-400">
                Total Submissions Logged
              </div>
              <div className="text-3xl font-mono font-bold text-emerald-300 mt-1">
                {submissions.length}
              </div>
            </div>
          </div>

          {/* Most Difficult Challenges in Session */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5">
            <h3 className="text-sm font-bold text-rose-300 uppercase font-mono">
              Most Difficult Challenges (Focus Areas for Class Review)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {(session?.challengeIds || ['ch-17', 'ch-23', 'ch-27', 'ch-30'])
                .slice(-4)
                .map((cid) => {
                  const ch = CHALLENGES.find((c) => c.id === cid);
                  if (!ch) return null;
                  const chSubs = submissions.filter(
                    (s) => s.challengeId === ch.id
                  );
                  const solvedCount = chSubs.filter((s) => s.isCorrect).length;
                  return (
                    <div
                      key={ch.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1"
                    >
                      <div className="font-mono text-rose-400 font-bold">
                        #{ch.number} • {ch.difficulty}
                      </div>
                      <div className="font-display font-bold text-white text-sm">
                        {ch.title}
                      </div>
                      <div className="text-slate-400">
                        Topic: {ch.topicTag}
                      </div>
                      <div className="font-mono text-amber-300 pt-1">
                        Solved in session: {solvedCount} / {players.length}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
              <h3 className="text-sm font-bold text-amber-300 uppercase font-mono">
                Common Student Syntax &amp; Logic Errors
              </h3>
              <ul className="text-sm text-slate-300 space-y-1.5 list-disc list-inside">
                <li>
                  <strong>Missing colon ( : )</strong> at the end of{' '}
                  <code>if</code>, <code>elif</code> and <code>for</code> lines
                </li>
                <li>
                  <strong>Using single = instead of ==</strong> when comparing values inside an <code>if</code> statement
                </li>
                <li>
                  <strong>Forgetting int() or float()</strong> around <code>input()</code> before doing maths
                </li>
                <li>
                  <strong>Off-by-one stop numbers</strong> inside <code>range(start, stop)</code>
                </li>
              </ul>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
              <h3 className="text-sm font-bold text-sky-300 uppercase font-mono">
                Performance by Curriculum Topic (Weeks 1–7)
              </h3>
              <div className="space-y-2 text-xs">
                {(
                  [
                    'Output & Syntax',
                    'Variables & Data Types',
                    'Input & Type Conversion',
                    'Conditionals (if/elif/else)',
                    'For Loops & range()',
                  ] as TopicTag[]
                ).map((topic) => (
                  <div
                    key={topic}
                    className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800"
                  >
                    <span className="text-slate-200 font-medium">{topic}</span>
                    <span className="font-mono text-emerald-300">
                      Ready in Pack
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
