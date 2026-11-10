import React, { useEffect, useState } from 'react';
import {
  Shield,
  PlusCircle,
  Play,
  Pause,
  SkipForward,
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
import { sound } from '../utils/sound';

export const TeacherDashboard: React.FC = () => {
  // Auth state when Supabase is configured
  const [teacherEmail, setTeacherEmail] = useState<string>('');
  const [teacherPassword, setTeacherPassword] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [unregisteredUuid, setUnregisteredUuid] = useState<string | null>(null);
  const [isTeacherAuthenticated, setIsTeacherAuthenticated] = useState<boolean>(
    !isSupabaseConfigured // In Demo Mode, allow exploring Demo Teacher Preview with clear banner
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

  const selectedPack =
    CHALLENGE_PACKS.find((p) => p.id === selectedPackId) || CHALLENGE_PACKS[0];

  const loadCloudSessionDetails = async (sessionId: string, roundIdxOverride?: number) => {
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

    const { data: scoreRows } = await supabase
      .from('scores')
      .select('*')
      .eq('session_id', sessionId);

    const mappedScores: RoundSubmission[] = (scoreRows || []).map((s) => ({
      id: s.id,
      sessionId: s.session_id,
      playerId: s.player_id,
      nickname: '',
      challengeId: s.challenge_id,
      roundIndex: s.round_index,
      submittedCode: '',
      isCorrect: true,
      hintsUsed: 0,
      timeTakenSeconds: 0,
      pointsAwarded: s.total_points,
      submittedAt: s.awarded_at,
    }));
    setSubmissions(mappedScores);

    const { data: pRows } = await supabase
      .from('session_players')
      .select('*')
      .eq('session_id', sessionId);

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
        // Verify server-side teacher_profiles row
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
        .subscribe();

      // Reliable 2-second polling fallback so teacher screen always stays in sync
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

    // Verify teacher_profiles membership via RLS
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
      }
      return;
    }

    // Demo Mode session creation
    const created = createNewDemoSession({
      title: newTitle,
      packId: selectedPackId,
      challengeCount,
    });
    setSession(created.session);
    setPlayers(created.players);
    setSubmissions(created.submissions);
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

      // Update local teacher state immediately for snappy UI
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
        // Teacher session might have been invalidated; prompt re-auth if needed
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
  const currentChallenge = CHALLENGES.find((c) => c.id === currentChallengeId);

  const submittedCount = players.filter((p) => p.currentRoundSubmitted).length;
  const leaderboardEntries = buildLeaderboardEntries(
    players,
    submissions,
    currentRoundIdx
  );

  // Analytics calculations (Section 18)
  const averageScore =
    players.length > 0
      ? Math.round(
          players.reduce((acc, p) => acc + p.totalScore, 0) / players.length
        )
      : 0;

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
              Classroom Projector View
            </div>
            <h1 className="text-2xl font-display font-bold text-white">
              Teacher Championship Control Centre
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
          {/* Left Column: Create / Configure Championship */}
          <div className="lg:col-span-4 rounded-2xl border-2 border-arena-border bg-arena-card/90 p-5 space-y-4 h-fit">
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

          {/* Right Column: Active Session Projector & Controls */}
          <div className="lg:col-span-8 space-y-5">
            {session && (
              <div className="rounded-3xl border-2 border-sky-500/60 bg-slate-900/95 p-6 shadow-2xl space-y-6">
                {/* Large Projector PIN Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800">
                  <div>
                    <span className="px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 font-mono text-xs uppercase font-bold">
                      Status: {session.status.toUpperCase()}
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mt-2">
                      {session.title}
                    </h2>
                  </div>

                  <div className="px-6 py-3 rounded-2xl bg-slate-950 border-2 border-amber-400 text-center shadow-lg">
                    <div className="text-xs font-mono uppercase text-amber-300 font-bold">
                      JOIN WITH GAME PIN
                    </div>
                    <div className="text-3xl sm:text-5xl font-mono font-extrabold tracking-widest text-white">
                      {session.pin}
                    </div>
                  </div>
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
                    {currentChallenge && (
                      <div className="text-xs text-teal-300 truncate mt-0.5">
                        #{currentChallenge.number}: {currentChallenge.title}
                      </div>
                    )}
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="text-xs font-mono uppercase text-slate-400">
                      Round Submissions
                    </div>
                    <div className="text-2xl font-display font-bold text-emerald-400 mt-1 flex items-center gap-2">
                      <CheckCircle2 className="w-6 h-6" /> {submittedCount} /{' '}
                      {players.length}
                    </div>
                  </div>
                </div>

                {/* Teacher Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  {session.status === 'lobby' && (
                    <button
                      type="button"
                      onClick={() => handleSessionControl('active', 0)}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-base shadow-lg transition"
                    >
                      <Play className="w-5 h-5 fill-current" /> Start Game (Round 1)
                    </button>
                  )}

                  {session.status === 'active' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSessionControl('paused')}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-semibold text-sm transition"
                      >
                        <Pause className="w-4 h-4" /> Pause Game
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSessionControl('leaderboard')}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-bold text-sm transition"
                      >
                        <Trophy className="w-4 h-4" /> Reveal Round Leaderboard
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

                  {session.status === 'paused' && (
                    <button
                      type="button"
                      onClick={() => handleSessionControl('active')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-sm transition"
                    >
                      <Play className="w-4 h-4 fill-current" /> Resume Round
                    </button>
                  )}

                  {(session.status === 'active' ||
                    session.status === 'leaderboard') &&
                    currentRoundIdx < totalRounds - 1 && (
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
                      <Trophy className="w-4 h-4" /> End Championship &amp; Show Podium
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleDeleteOrResetSession}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold ml-auto transition"
                  >
                    <Trash2 className="w-4 h-4" /> Reset / Delete Session
                  </button>
                </div>

                {/* Lobby Joined Nicknames List */}
                <div className="pt-4 border-t border-slate-800">
                  <div className="text-xs font-mono uppercase text-slate-400 mb-2">
                    Joined Student Nicknames ({players.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {players.map((p) => (
                      <span
                        key={p.id}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 font-display font-semibold text-sm text-white flex items-center gap-2"
                      >
                        {p.nickname}
                        {p.currentRoundSubmitted && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        )}
                      </span>
                    ))}
                  </div>
                </div>
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
