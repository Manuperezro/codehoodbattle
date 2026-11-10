// Supabase Edge Function: validate-submission
// Server-side validation and competitive score calculation for Live Championship Mode.
// Prevents browser score spoofing and duplicate point awards.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function calculateServerScore(
  isCorrect: boolean,
  hintsUsed: number,
  timeTakenSeconds: number
) {
  if (!isCorrect) {
    return { basePoints: 0, hintBonus: 0, speedBonus: 0, totalPoints: 0 };
  }
  const basePoints = 100;
  const hintBonus = hintsUsed <= 0 ? 30 : hintsUsed === 1 ? 15 : 0;
  const clampedTime = Math.max(0, timeTakenSeconds);
  let speedBonus = 0;
  if (clampedTime <= 15) {
    speedBonus = 20;
  } else if (clampedTime < 75) {
    speedBonus = Math.round(20 * (1 - (clampedTime - 15) / 60));
  }
  const totalPoints = Math.min(150, basePoints + hintBonus + speedBonus);
  return { basePoints, hintBonus, speedBonus, totalPoints };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify caller identity using their JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser();

    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorised session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const {
      sessionId,
      playerId,
      challengeId,
      roundIndex,
      submittedCode,
      hintsUsed = 0,
      timeTakenSeconds = 30,
    } = body;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Verify player belongs to caller's anonymous session
    const { data: playerRow, error: playerErr } = await adminClient
      .from('session_players')
      .select('*')
      .eq('id', playerId)
      .eq('session_id', sessionId)
      .eq('anonymous_auth_id', user.id)
      .single();

    if (playerErr || !playerRow) {
      return new Response(JSON.stringify({ error: 'Invalid player session ownership' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Check duplicate score submission for this round
    const { data: existingScore } = await adminClient
      .from('scores')
      .select('id, total_points')
      .eq('session_id', sessionId)
      .eq('player_id', playerId)
      .eq('round_index', roundIndex)
      .maybeSingle();

    if (existingScore) {
      return new Response(
        JSON.stringify({
          ok: true,
          alreadySubmitted: true,
          pointsAwarded: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Look up canonical challenge requirements
    const { data: challengeRow } = await adminClient
      .from('challenge_catalogue')
      .select('*')
      .eq('id', challengeId)
      .maybeSingle();

    const cleanCode = String(submittedCode || '').trim();
    let isCorrect = cleanCode.length > 0;

    if (challengeRow) {
      const reqTokens: string[] = challengeRow.required_tokens || [];
      const hasAllTokens = reqTokens.every((t: string) => cleanCode.includes(t));
      isCorrect = hasAllTokens && cleanCode.length > 0;
    }

    // 4. Record attempt
    await adminClient.from('challenge_attempts').insert({
      session_id: sessionId,
      player_id: playerId,
      challenge_id: challengeId,
      round_index: roundIndex,
      submitted_code: cleanCode,
      is_correct: isCorrect,
      hints_used: Math.min(3, Math.max(0, Number(hintsUsed))),
      time_taken_seconds: Math.max(0, Number(timeTakenSeconds)),
    });

    if (!isCorrect) {
      return new Response(
        JSON.stringify({ ok: true, isCorrect: false, pointsAwarded: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Calculate score server-side and insert into scores
    const score = calculateServerScore(
      true,
      Number(hintsUsed),
      Number(timeTakenSeconds)
    );

    await adminClient.from('scores').insert({
      session_id: sessionId,
      player_id: playerId,
      challenge_id: challengeId,
      round_index: roundIndex,
      base_points: score.basePoints,
      hint_bonus: score.hintBonus,
      speed_bonus: score.speedBonus,
      total_points: score.totalPoints,
    });

    await adminClient
      .from('session_players')
      .update({
        total_score: playerRow.total_score + score.totalPoints,
        challenges_completed: playerRow.challenges_completed + 1,
        current_round_submitted: true,
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', playerId);

    return new Response(
      JSON.stringify({
        ok: true,
        isCorrect: true,
        pointsAwarded: score.totalPoints,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message || 'Server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

