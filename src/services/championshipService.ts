import { CHALLENGES, CHALLENGE_PACKS } from '../data/challenges';
import {
  ensureAnonymousStudentSession,
  isSupabaseConfigured,
  supabase,
} from '../lib/supabase';
import {
  GameSession,
  LeaderboardEntry,
  RoundSubmission,
  SessionPlayer,
  SessionStatus,
} from '../types/game';
import { validateChallengeSubmission } from '../utils/pythonValidator';
import {
  calculateChampionshipScore,
  validateGamePin,
  validateNickname,
} from '../utils/scoring';

const DEMO_SESSION_KEY = 'pca_demo_championship_session_v1';
const DEMO_PLAYERS_KEY = 'pca_demo_championship_players_v1';
const DEMO_SUBMISSIONS_KEY = 'pca_demo_championship_submissions_v1';
const ACTIVE_STUDENT_SESSION_KEY = 'pca_student_rejoin_ticket_v1';

export interface RejoinTicket {
  sessionId: string;
  pin: string;
  playerId: string;
  nickname: string;
  anonymousAuthId: string;
}

export function getSavedRejoinTicket(): RejoinTicket | null {
  try {
    const raw = localStorage.getItem(ACTIVE_STUDENT_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RejoinTicket;
  } catch {
    return null;
  }
}

export function saveRejoinTicket(ticket: RejoinTicket | null): void {
  try {
    if (!ticket) {
      localStorage.removeItem(ACTIVE_STUDENT_SESSION_KEY);
    } else {
      localStorage.setItem(ACTIVE_STUDENT_SESSION_KEY, JSON.stringify(ticket));
    }
  } catch {
    // ignore storage errors
  }
}

/**
 * Initialises or retrieves the default Demo Mode championship (PIN: 483921)
 * so students and lecturers can explore the full flow locally before configuring Supabase.
 */
export function getOrCreateDemoSession(): {
  session: GameSession;
  players: SessionPlayer[];
  submissions: RoundSubmission[];
} {
  try {
    const rawSession = localStorage.getItem(DEMO_SESSION_KEY);
    const rawPlayers = localStorage.getItem(DEMO_PLAYERS_KEY);
    const rawSubs = localStorage.getItem(DEMO_SUBMISSIONS_KEY);

    if (rawSession && rawPlayers) {
      return {
        session: JSON.parse(rawSession),
        players: JSON.parse(rawPlayers),
        submissions: rawSubs ? JSON.parse(rawSubs) : [],
      };
    }
  } catch {
    // Fallback to fresh demo data
  }

  const defaultPack = CHALLENGE_PACKS[3]; // Quick 8 Classroom Sprint
  const demoSession: GameSession = {
    id: 'demo-session-483921',
    pin: '483921',
    title: 'Level 2 Python Arena Cup (Demo Session)',
    teacherId: 'demo-teacher-id',
    packId: defaultPack.id,
    challengeIds: defaultPack.challengeIds,
    currentRoundIndex: 0,
    status: 'lobby',
    createdAt: new Date().toISOString(),
  };

  const samplePlayers: SessionPlayer[] = [
    {
      id: 'demo-p1',
      sessionId: demoSession.id,
      anonymousAuthId: 'anon-sample-1',
      nickname: 'LoopLegend',
      totalScore: 0,
      challengesCompleted: 0,
      currentRoundSubmitted: false,
      joinedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    },
    {
      id: 'demo-p2',
      sessionId: demoSession.id,
      anonymousAuthId: 'anon-sample-2',
      nickname: 'SyntaxStar',
      totalScore: 0,
      challengesCompleted: 0,
      currentRoundSubmitted: false,
      joinedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    },
    {
      id: 'demo-p3',
      sessionId: demoSession.id,
      anonymousAuthId: 'anon-sample-3',
      nickname: 'BugBusterUK',
      totalScore: 0,
      challengesCompleted: 0,
      currentRoundSubmitted: false,
      joinedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    },
  ];

  saveDemoState(demoSession, samplePlayers, []);
  return { session: demoSession, players: samplePlayers, submissions: [] };
}

export function saveDemoState(
  session: GameSession,
  players: SessionPlayer[],
  submissions: RoundSubmission[]
): void {
  try {
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(DEMO_PLAYERS_KEY, JSON.stringify(players));
    localStorage.setItem(DEMO_SUBMISSIONS_KEY, JSON.stringify(submissions));
  } catch {
    // ignore
  }
}

export function generateSixDigitPin(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return String(num);
}

/**
 * Joins a championship session with a 6-digit PIN and Nickname.
 * Uses anonymous auth session ID and checks for duplicates/profanity.
 */
export async function joinChampionshipWithPin(
  rawPin: string,
  rawNickname: string
): Promise<{
  ok: boolean;
  error?: string;
  session?: GameSession;
  player?: SessionPlayer;
}> {
  const pin = rawPin.trim();
  if (!validateGamePin(pin)) {
    return {
      ok: false,
      error: 'Please enter a valid 6-digit numeric Game PIN (e.g. 483921).',
    };
  }

  const { anonymousId } = await ensureAnonymousStudentSession();

  // If Supabase is configured, query real database
  if (isSupabaseConfigured && supabase) {
    const { data: sessionRow, error: sessionErr } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('pin', pin)
      .neq('status', 'completed')
      .maybeSingle();

    if (sessionErr || !sessionRow) {
      return {
        ok: false,
        error: 'No active Championship found with that 6-digit PIN. Check the classroom screen!',
      };
    }

    const { data: existingPlayers } = await supabase
      .from('session_players')
      .select('*')
      .eq('session_id', sessionRow.id);

    const playerList = existingPlayers || [];

    // Allow same anonymous session to rejoin automatically
    const existingSelf = playerList.find(
      (p) => p.anonymous_auth_id === anonymousId
    );
    if (existingSelf) {
      const mappedSession: GameSession = {
        id: sessionRow.id,
        pin: sessionRow.pin,
        title: sessionRow.title,
        teacherId: sessionRow.teacher_id,
        packId: sessionRow.pack_id,
        challengeIds: sessionRow.challenge_ids,
        currentRoundIndex: sessionRow.current_round_index,
        status: sessionRow.status,
        createdAt: sessionRow.created_at,
      };
      const mappedPlayer: SessionPlayer = {
        id: existingSelf.id,
        sessionId: existingSelf.session_id,
        anonymousAuthId: existingSelf.anonymous_auth_id,
        nickname: existingSelf.nickname,
        totalScore: existingSelf.total_score,
        challengesCompleted: existingSelf.challenges_completed,
        currentRoundSubmitted: existingSelf.current_round_submitted,
        joinedAt: existingSelf.joined_at,
        lastSeenAt: new Date().toISOString(),
      };
      saveRejoinTicket({
        sessionId: mappedSession.id,
        pin: mappedSession.pin,
        playerId: mappedPlayer.id,
        nickname: mappedPlayer.nickname,
        anonymousAuthId: anonymousId,
      });
      return { ok: true, session: mappedSession, player: mappedPlayer };
    }

    const nickCheck = validateNickname(
      rawNickname,
      playerList.map((p) => p.nickname)
    );
    if (!nickCheck.valid) {
      return { ok: false, error: nickCheck.reason };
    }

    const { data: insertedPlayer, error: insertErr } = await supabase
      .from('session_players')
      .insert({
        session_id: sessionRow.id,
        anonymous_auth_id: anonymousId,
        nickname: nickCheck.cleanedNickname,
      })
      .select('*')
      .single();

    if (insertErr || !insertedPlayer) {
      return {
        ok: false,
        error: insertErr?.message || 'Could not join game session. Please try another nickname.',
      };
    }

    const mappedSession: GameSession = {
      id: sessionRow.id,
      pin: sessionRow.pin,
      title: sessionRow.title,
      teacherId: sessionRow.teacher_id,
      packId: sessionRow.pack_id,
      challengeIds: sessionRow.challenge_ids,
      currentRoundIndex: sessionRow.current_round_index,
      status: sessionRow.status,
      createdAt: sessionRow.created_at,
    };
    const mappedPlayer: SessionPlayer = {
      id: insertedPlayer.id,
      sessionId: insertedPlayer.session_id,
      anonymousAuthId: insertedPlayer.anonymous_auth_id,
      nickname: insertedPlayer.nickname,
      totalScore: insertedPlayer.total_score,
      challengesCompleted: insertedPlayer.challenges_completed,
      currentRoundSubmitted: insertedPlayer.current_round_submitted,
      joinedAt: insertedPlayer.joined_at,
      lastSeenAt: insertedPlayer.last_seen_at,
    };

    saveRejoinTicket({
      sessionId: mappedSession.id,
      pin: mappedSession.pin,
      playerId: mappedPlayer.id,
      nickname: mappedPlayer.nickname,
      anonymousAuthId: anonymousId,
    });

    return { ok: true, session: mappedSession, player: mappedPlayer };
  }

  // Demo Mode local join
  const demo = getOrCreateDemoSession();
  if (demo.session.pin !== pin) {
    return {
      ok: false,
      error: `Invalid Game PIN. In Demo Mode, use PIN ${demo.session.pin} (shown on the Teacher Dashboard).`,
    };
  }

  // Check if rejoining with same nickname & anonymousId
  const existingRejoin = demo.players.find(
    (p) =>
      p.anonymousAuthId === anonymousId &&
      p.nickname.toLowerCase() === rawNickname.trim().toLowerCase()
  );
  if (existingRejoin) {
    saveRejoinTicket({
      sessionId: demo.session.id,
      pin: demo.session.pin,
      playerId: existingRejoin.id,
      nickname: existingRejoin.nickname,
      anonymousAuthId: anonymousId,
    });
    return { ok: true, session: demo.session, player: existingRejoin };
  }

  const nickCheck = validateNickname(
    rawNickname,
    demo.players.map((p) => p.nickname)
  );
  if (!nickCheck.valid) {
    return { ok: false, error: nickCheck.reason };
  }

  const newPlayer: SessionPlayer = {
    id: `demo-player-${Date.now()}`,
    sessionId: demo.session.id,
    anonymousAuthId: anonymousId,
    nickname: nickCheck.cleanedNickname,
    totalScore: 0,
    challengesCompleted: 0,
    currentRoundSubmitted: false,
    joinedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  };

  const updatedPlayers = [...demo.players, newPlayer];
  saveDemoState(demo.session, updatedPlayers, demo.submissions);
  saveRejoinTicket({
    sessionId: demo.session.id,
    pin: demo.session.pin,
    playerId: newPlayer.id,
    nickname: newPlayer.nickname,
    anonymousAuthId: anonymousId,
  });

  return { ok: true, session: demo.session, player: newPlayer };
}

/**
 * Submits a student's solution for the current championship round.
 * Prevents duplicate submissions from awarding points more than once.
 */
export async function submitChampionshipRoundCode(params: {
  sessionId: string;
  playerId: string;
  nickname: string;
  challengeId: string;
  roundIndex: number;
  submittedCode: string;
  hintsUsed: number;
  timeTakenSeconds: number;
}): Promise<{
  ok: boolean;
  alreadySubmitted?: boolean;
  pointsAwarded: number;
  error?: string;
}> {
  const challenge = CHALLENGES.find((c) => c.id === params.challengeId);
  if (!challenge) {
    return { ok: false, pointsAwarded: 0, error: 'Challenge not found.' };
  }

  // If Supabase is configured, invoke the server-side RPC or Edge Function so browser cannot spoof score
  if (isSupabaseConfigured && supabase) {
    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      'submit_championship_attempt',
      {
        p_session_id: params.sessionId,
        p_player_id: params.playerId,
        p_challenge_id: params.challengeId,
        p_round_index: params.roundIndex,
        p_submitted_code: params.submittedCode,
        p_hints_used: params.hintsUsed,
        p_time_taken_seconds: params.timeTakenSeconds,
      }
    );

    if (!rpcErr && rpcData) {
      return {
        ok: true,
        alreadySubmitted: rpcData.alreadySubmitted,
        pointsAwarded: rpcData.pointsAwarded ?? 0,
      };
    }

    const { data, error } = await supabase.functions.invoke('validate-submission', {
      body: params,
    });

    if (error || !data) {
      return {
        ok: false,
        pointsAwarded: 0,
        error: error?.message || rpcErr?.message || 'Server validation failed.',
      };
    }

    return {
      ok: true,
      alreadySubmitted: data.alreadySubmitted,
      pointsAwarded: data.pointsAwarded ?? 0,
    };
  }

  // Demo Mode local validation
  const demo = getOrCreateDemoSession();
  const duplicate = demo.submissions.find(
    (s) =>
      s.sessionId === params.sessionId &&
      s.playerId === params.playerId &&
      s.roundIndex === params.roundIndex &&
      s.isCorrect
  );

  if (duplicate) {
    return {
      ok: true,
      alreadySubmitted: true,
      pointsAwarded: 0,
    };
  }

  const valResult = validateChallengeSubmission(challenge, params.submittedCode);
  const scoreBreakdown = calculateChampionshipScore(
    valResult.isValid,
    params.hintsUsed,
    params.timeTakenSeconds
  );

  const newSub: RoundSubmission = {
    id: `sub-${Date.now()}`,
    sessionId: params.sessionId,
    playerId: params.playerId,
    nickname: params.nickname,
    challengeId: params.challengeId,
    roundIndex: params.roundIndex,
    submittedCode: params.submittedCode,
    isCorrect: valResult.isValid,
    hintsUsed: params.hintsUsed,
    timeTakenSeconds: params.timeTakenSeconds,
    pointsAwarded: scoreBreakdown.totalPoints,
    errorCategory: valResult.matchedErrorRule,
    submittedAt: new Date().toISOString(),
  };

  // In Demo Mode, also simulate sample AI bots submitting scores so the leaderboard is lively
  const updatedSubmissions = [...demo.submissions, newSub];
  const updatedPlayers = demo.players.map((p) => {
    if (p.id === params.playerId) {
      return {
        ...p,
        totalScore: p.totalScore + scoreBreakdown.totalPoints,
        challengesCompleted: valResult.isValid
          ? p.challengesCompleted + 1
          : p.challengesCompleted,
        currentRoundSubmitted: valResult.isValid ? true : p.currentRoundSubmitted,
        lastSeenAt: new Date().toISOString(),
      };
    }
    // Simulate sample demo players if they haven't submitted this round yet
    if (p.id.startsWith('demo-p') && !p.currentRoundSubmitted && valResult.isValid) {
      const botPts = p.id === 'demo-p1' ? 130 : p.id === 'demo-p2' ? 115 : 100;
      updatedSubmissions.push({
        id: `bot-sub-${p.id}-${params.roundIndex}`,
        sessionId: params.sessionId,
        playerId: p.id,
        nickname: p.nickname,
        challengeId: params.challengeId,
        roundIndex: params.roundIndex,
        submittedCode: challenge.correctSolution,
        isCorrect: true,
        hintsUsed: p.id === 'demo-p1' ? 0 : 1,
        timeTakenSeconds: 25,
        pointsAwarded: botPts,
        submittedAt: new Date().toISOString(),
      });
      return {
        ...p,
        totalScore: p.totalScore + botPts,
        challengesCompleted: p.challengesCompleted + 1,
        currentRoundSubmitted: true,
      };
    }
    return p;
  });

  saveDemoState(demo.session, updatedPlayers, updatedSubmissions);

  return {
    ok: true,
    pointsAwarded: scoreBreakdown.totalPoints,
  };
}

export function buildLeaderboardEntries(
  players: SessionPlayer[],
  submissions: RoundSubmission[],
  currentRoundIndex: number
): LeaderboardEntry[] {
  const sorted = [...players].sort((a, b) => b.totalScore - a.totalScore);
  return sorted.map((p, idx) => {
    const roundSub = submissions.find(
      (s) =>
        s.playerId === p.id &&
        s.roundIndex === currentRoundIndex &&
        s.isCorrect
    );
    return {
      rank: idx + 1,
      playerId: p.id,
      nickname: p.nickname,
      totalPoints: p.totalScore,
      challengesCompleted: p.challengesCompleted,
      currentRoundPoints: roundSub?.pointsAwarded || 0,
      currentRoundSubmitted: p.currentRoundSubmitted,
    };
  });
}

export function updateDemoSessionStatus(
  status: SessionStatus,
  nextRoundIndex?: number
): {
  session: GameSession;
  players: SessionPlayer[];
  submissions: RoundSubmission[];
} {
  const demo = getOrCreateDemoSession();
  const roundChanged =
    typeof nextRoundIndex === 'number' &&
    nextRoundIndex !== demo.session.currentRoundIndex;

  const updatedSession: GameSession = {
    ...demo.session,
    status,
    currentRoundIndex:
      typeof nextRoundIndex === 'number'
        ? nextRoundIndex
        : demo.session.currentRoundIndex,
    roundStartedAt:
      status === 'active' ? new Date().toISOString() : demo.session.roundStartedAt,
  };

  const updatedPlayers = roundChanged
    ? demo.players.map((p) => ({ ...p, currentRoundSubmitted: false }))
    : demo.players;

  saveDemoState(updatedSession, updatedPlayers, demo.submissions);
  return {
    session: updatedSession,
    players: updatedPlayers,
    submissions: demo.submissions,
  };
}

export function createNewDemoSession(params: {
  title: string;
  packId: string;
  challengeCount: number;
}): {
  session: GameSession;
  players: SessionPlayer[];
  submissions: RoundSubmission[];
} {
  const pack =
    CHALLENGE_PACKS.find((p) => p.id === params.packId) || CHALLENGE_PACKS[0];
  const selectedIds = pack.challengeIds.slice(
    0,
    Math.max(1, Math.min(params.challengeCount, pack.challengeIds.length))
  );

  const newSession: GameSession = {
    id: `demo-session-${Date.now()}`,
    pin: generateSixDigitPin(),
    title: params.title.trim() || 'Classroom Python Championship',
    teacherId: 'demo-teacher-id',
    packId: pack.id,
    challengeIds: selectedIds,
    currentRoundIndex: 0,
    status: 'lobby',
    createdAt: new Date().toISOString(),
  };

  const samplePlayers: SessionPlayer[] = [
    {
      id: 'demo-p1',
      sessionId: newSession.id,
      anonymousAuthId: 'anon-sample-1',
      nickname: 'LoopLegend',
      totalScore: 0,
      challengesCompleted: 0,
      currentRoundSubmitted: false,
      joinedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    },
    {
      id: 'demo-p2',
      sessionId: newSession.id,
      anonymousAuthId: 'anon-sample-2',
      nickname: 'SyntaxStar',
      totalScore: 0,
      challengesCompleted: 0,
      currentRoundSubmitted: false,
      joinedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    },
  ];

  saveDemoState(newSession, samplePlayers, []);
  return { session: newSession, players: samplePlayers, submissions: [] };
}

/**
 * Simulates classroom students joining or submitting answers in Demo Mode
 * so a lecturer can preview the live Teacher Dashboard projector experience.
 */
export function simulateDemoClassroomRoundSubmissions(): {
  session: GameSession;
  players: SessionPlayer[];
  submissions: RoundSubmission[];
} {
  const demo = getOrCreateDemoSession();
  const roundIdx = demo.session.currentRoundIndex;
  const challengeId =
    demo.session.challengeIds[roundIdx] || demo.session.challengeIds[0];
  const challenge = CHALLENGES.find((c) => c.id === challengeId) || CHALLENGES[0];

  const updatedSubmissions = [...demo.submissions];
  const updatedPlayers = demo.players.map((p, idx) => {
    if (p.currentRoundSubmitted) return p;
    const pts = idx === 0 ? 145 : idx === 1 ? 125 : 110;
    updatedSubmissions.push({
      id: `sim-sub-${p.id}-${roundIdx}-${Date.now()}`,
      sessionId: demo.session.id,
      playerId: p.id,
      nickname: p.nickname,
      challengeId: challenge.id,
      roundIndex: roundIdx,
      submittedCode: challenge.correctSolution,
      isCorrect: true,
      hintsUsed: idx === 0 ? 0 : 1,
      timeTakenSeconds: 18 + idx * 9,
      pointsAwarded: pts,
      submittedAt: new Date().toISOString(),
    });
    return {
      ...p,
      totalScore: p.totalScore + pts,
      challengesCompleted: p.challengesCompleted + 1,
      currentRoundSubmitted: true,
      lastSeenAt: new Date().toISOString(),
    };
  });

  saveDemoState(demo.session, updatedPlayers, updatedSubmissions);
  return {
    session: demo.session,
    players: updatedPlayers,
    submissions: updatedSubmissions,
  };
}


