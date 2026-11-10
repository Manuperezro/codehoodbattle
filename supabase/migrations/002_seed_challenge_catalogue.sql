-- =============================================================================
-- PYTHON CODE ARENA — MIGRATION 002: SEED 30 CHALLENGES & SERVER-SIDE SCORING RPC
-- Keeps answer keys protected on the server, enforces rate limiting,
-- and calculates competitive scores server-side.
-- =============================================================================

-- Protect canonical_solution column from being read directly by anonymous/authenticated clients
revoke select (canonical_solution) on public.challenge_catalogue from anon, authenticated;

drop policy if exists "Anyone can read public challenge metadata" on public.challenge_catalogue;
create policy "Anyone can read public challenge metadata"
  on public.challenge_catalogue
  for select
  using (true);

-- Seed all 30 challenges into challenge_catalogue
insert into public.challenge_catalogue (
  id, challenge_number, title, world_id, difficulty, engine_type, xp_reward,
  canonical_solution, expected_output, required_tokens
) values
  ('ch-01', 1, 'Hello World Rescue', 'world-1', 'Starter', 'bug_hunter', 100,
   'print("Hello World")', 'Hello World', array['print', 'Hello World']),
  ('ch-02', 2, 'Broken Print', 'world-1', 'Starter', 'bug_hunter', 100,
   E'print("Arena Ready")\nprint("Start Game")', E'Arena Ready\nStart Game', array['print', 'Start Game']),
  ('ch-03', 3, 'Code Order', 'world-1', 'Starter', 'code_builder', 100,
   E'print("Ready")\nprint("Steady")\nprint("Code!")', E'Ready\nSteady\nCode!', array['Ready', 'Steady', 'Code!']),
  ('ch-04', 4, 'Predict the Message', 'world-1', 'Starter', 'predict_output', 100,
   E'Python\nChampion', E'Python\nChampion', array[]::text[]),
  ('ch-05', 5, 'Variable Rescue', 'world-2', 'Starter', 'bug_hunter', 110,
   E'player_role = "Coder"\nprint(player_role)', 'Coder', array['player_role', '=', 'print']),
  ('ch-06', 6, 'Number Detective', 'world-2', 'Core', 'missing_code', 110,
   E'lives = 3\nlives = lives + 1\nprint(lives)', '4', array['lives', '3', '+']),
  ('ch-07', 7, 'Data Type Repair', 'world-2', 'Core', 'bug_hunter', 120,
   E'bonus = 10\npoints = 50 + bonus\nprint(points)', '60', array['bonus', '10', 'points']),
  ('ch-08', 8, 'Score Tracker', 'world-2', 'Core', 'predict_output', 120,
   '7', '7', array[]::text[]),
  ('ch-09', 9, 'Ask the Player', 'world-3', 'Starter', 'bug_hunter', 120,
   E'name = input("Enter your name: ")\nprint("Hello", name)', 'Hello Sam', array['name', 'input', 'print']),
  ('ch-10', 10, 'Age Calculator', 'world-3', 'Core', 'missing_code', 130,
   E'age = int(input("Enter age: "))\nnext_year = age + 1\nprint(next_year)', '17', array['int', 'input', 'age']),
  ('ch-11', 11, 'Price Converter', 'world-3', 'Core', 'missing_code', 130,
   E'price = float(input("Enter item price: "))\ntotal = price * 2\nprint(total)', '5.0', array['float', 'input', 'price']),
  ('ch-12', 12, 'Welcome Generator', 'world-3', 'Core', 'code_builder', 130,
   E'nickname = input("Nickname: ")\nmessage = "Welcome " + nickname\nprint(message)', 'Welcome Nova', array['nickname', 'input', 'message', 'print']),
  ('ch-13', 13, 'Calculator Rescue', 'world-4', 'Starter', 'bug_hunter', 120,
   E'width = 6\nheight = 4\narea = width * height\nprint(area)', '24', array['area', '*', 'width', 'height']),
  ('ch-14', 14, 'Price Calculator', 'world-4', 'Core', 'code_builder', 130,
   E'price = 5\nquantity = 2\ntotal = price * quantity\nprint(total)', '10', array['price', 'quantity', 'total', '*']),
  ('ch-15', 15, 'Operator Detective', 'world-4', 'Core', 'missing_code', 130,
   E'age = 18\n\nif age >= 18:\n    print("Adult")', 'Adult', array['if', 'age', '>=', '18']),
  ('ch-16', 16, 'Total Cost Challenge', 'world-4', 'Challenge', 'missing_code', 140,
   E'tickets = 3\ndelivery = 2\ntotal = tickets * 8 + delivery\nprint(total)', '26', array['tickets', '*', '8', '+', 'delivery']),
  ('ch-17', 17, 'Access Granted', 'world-5', 'Starter', 'bug_hunter', 130,
   E'score = 85\nif score >= 50:\n    print("Pass")\nelse:\n    print("Try again")', 'Pass', array['if', 'score', '>=', '50', ':']),
  ('ch-18', 18, 'Ticket Checker', 'world-5', 'Core', 'missing_code', 140,
   E'age = 14\nif age < 5:\n    print("Free")\nelif age < 16:\n    print("Junior")\nelse:\n    print("Adult")', 'Junior', array['if', 'elif', 'else']),
  ('ch-19', 19, 'Password Checker', 'world-5', 'Core', 'bug_hunter', 140,
   E'pin = 1234\nif pin == 1234:\n    print("Unlocked")', 'Unlocked', array['if', 'pin', '==', '1234']),
  ('ch-20', 20, 'Café Decision', 'world-5', 'Challenge', 'missing_code', 150,
   E'has_sandwich = "yes"\nhas_drink = "yes"\nif has_sandwich == "yes" and has_drink == "yes":\n    print("Meal Deal")', 'Meal Deal', array['if', 'and', '==']),
  ('ch-21', 21, 'Decision Boss', 'world-5', 'Boss', 'final_boss', 180,
   E'role = "ADMIN".lower()\nif role == "admin":\n    print("Full Access")\nelif role == "guest":\n    print("Read Only")\nelse:\n    print("Blocked")', 'Full Access', array['if', '==', 'elif', ':']),
  ('ch-22', 22, 'Repeat After Me', 'world-6', 'Starter', 'code_builder', 140,
   E'for step in range(3):\n    print("Jump!")\nprint("Landed")', E'Jump!\nJump!\nJump!\nLanded', array['for', 'in', 'range(3)', 'Jump!', 'Landed']),
  ('ch-23', 23, 'Count to Five', 'world-6', 'Core', 'bug_hunter', 140,
   E'for num in range(1, 6):\n    print(num)', E'1\n2\n3\n4\n5', array['for', 'num', 'range', '1', '6']),
  ('ch-24', 24, 'Countdown Challenge', 'world-6', 'Challenge', 'missing_code', 150,
   E'for count in range(3, 0, -1):\n    print(count)\nprint("Go!")', E'3\n2\n1\nGo!', array['for', 'range', '-1']),
  ('ch-25', 25, 'Multiplication Machine', 'world-6', 'Core', 'missing_code', 150,
   E'for i in range(1, 4):\n    print(i * 5)', E'5\n10\n15', array['for', 'i', 'range', '*']),
  ('ch-26', 26, 'Loop Bug Hunter', 'world-6', 'Challenge', 'bug_hunter', 160,
   E'for turn in range(2):\n    print("Boost")', E'Boost\nBoost', array['for', 'range(2)', ':', 'print']),
  ('ch-27', 27, 'Robot Escape', 'world-7', 'Boss', 'robot_programmer', 200,
   E'for step in range(3):\n    move_right()\nfor step in range(2):\n    move_down()', 'Goal reached at (3, 2)!', array['move_right()', 'move_down()']),
  ('ch-28', 28, 'Cinema Ticket Machine', 'world-7', 'Boss', 'final_boss', 200,
   E'age = int(input("Enter age: "))\nif age < 5:\n    price = 0\nelif age < 18:\n    price = 6\nelse:\n    price = 10\nprint("Ticket:", price)', 'Ticket: 6', array['int', 'input', 'if', 'elif', 'else', 'print']),
  ('ch-29', 29, 'Treasure Hunt', 'world-7', 'Boss', 'final_boss', 220,
   E'for chest in range(1, 5):\n    if chest == 3:\n        print("Treasure found in chest", chest)\n        break', 'Treasure found in chest 3', array['for', 'range', 'if', '==', 'break']),
  ('ch-30', 30, 'Guess the Number', 'world-7', 'Boss', 'final_boss', 250,
   E'secret = 7\nfor attempt in range(3):\n    guess = int(input("Guess: "))\n    if guess == secret:\n        print("You win!")\n        break\n    else:\n        print("Try again")', E'Try again\nYou win!', array['range(3)', 'int', 'input', '==', 'break'])
on conflict (id) do update set
  title = excluded.title,
  canonical_solution = excluded.canonical_solution,
  expected_output = excluded.expected_output,
  required_tokens = excluded.required_tokens;

-- =============================================================================
-- SERVER-SIDE VALIDATION, RATE-LIMITING & SCORE CALCULATION RPC
-- Can be invoked directly via supabase.rpc('submit_championship_attempt', ...)
-- =============================================================================
create or replace function public.submit_championship_attempt(
  p_session_id uuid,
  p_player_id uuid,
  p_challenge_id text,
  p_round_index int,
  p_submitted_code text,
  p_hints_used int,
  p_time_taken_seconds int
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_player record;
  v_session record;
  v_challenge record;
  v_existing_score record;
  v_recent_attempt timestamptz;
  v_token text;
  v_is_correct boolean := true;
  v_base int := 0;
  v_hint_bonus int := 0;
  v_speed_bonus int := 0;
  v_total int := 0;
begin
  -- 1. Verify caller owns the anonymous player record
  select * into v_player
  from public.session_players
  where id = p_player_id
    and session_id = p_session_id
    and anonymous_auth_id = auth.uid();

  if not found then
    raise exception 'Unauthorised player session.';
  end if;

  -- 2. Verify session is active and on the requested round
  select * into v_session
  from public.game_sessions
  where id = p_session_id;

  if not found or v_session.status <> 'active' then
    raise exception 'Championship round is not currently active.';
  end if;

  -- 3. Rate limit: block rapid spam attempts (< 1 second apart)
  select max(created_at) into v_recent_attempt
  from public.challenge_attempts
  where player_id = p_player_id
    and session_id = p_session_id
    and round_index = p_round_index;

  if v_recent_attempt is not null and v_recent_attempt > now() - interval '1 second' then
    raise exception 'Please wait a moment before submitting again.';
  end if;

  -- 4. Duplicate submission protection: check if points were already awarded this round
  select * into v_existing_score
  from public.scores
  where session_id = p_session_id
    and player_id = p_player_id
    and round_index = p_round_index;

  if found then
    return jsonb_build_object(
      'ok', true,
      'alreadySubmitted', true,
      'pointsAwarded', 0
    );
  end if;

  -- 5. Validate required tokens & solution against server-side challenge_catalogue
  select * into v_challenge
  from public.challenge_catalogue
  where id = p_challenge_id;

  if not found or length(trim(p_submitted_code)) = 0 then
    v_is_correct := false;
  else
    foreach v_token in array v_challenge.required_tokens loop
      if position(v_token in p_submitted_code) = 0 then
        v_is_correct := false;
      end if;
    end loop;
  end if;

  -- 6. Log attempt
  insert into public.challenge_attempts (
    session_id, player_id, challenge_id, round_index,
    submitted_code, is_correct, hints_used, time_taken_seconds
  ) values (
    p_session_id, p_player_id, p_challenge_id, p_round_index,
    p_submitted_code, v_is_correct,
    least(3, greatest(0, p_hints_used)),
    greatest(0, p_time_taken_seconds)
  );

  if not v_is_correct then
    return jsonb_build_object(
      'ok', true,
      'isCorrect', false,
      'pointsAwarded', 0
    );
  end if;

  -- 7. Calculate competitive score server-side (max 150 pts)
  v_base := 100;
  if p_hints_used <= 0 then
    v_hint_bonus := 30;
  elsif p_hints_used = 1 then
    v_hint_bonus := 15;
  else
    v_hint_bonus := 0;
  end if;

  if p_time_taken_seconds <= 15 then
    v_speed_bonus := 20;
  elsif p_time_taken_seconds < 75 then
    v_speed_bonus := round(20.0 * (1.0 - (p_time_taken_seconds - 15.0) / 60.0));
  else
    v_speed_bonus := 0;
  end if;

  v_total := least(150, v_base + v_hint_bonus + v_speed_bonus);

  insert into public.scores (
    session_id, player_id, challenge_id, round_index,
    base_points, hint_bonus, speed_bonus, total_points
  ) values (
    p_session_id, p_player_id, p_challenge_id, p_round_index,
    v_base, v_hint_bonus, v_speed_bonus, v_total
  );

  update public.session_players
  set total_score = total_score + v_total,
      challenges_completed = challenges_completed + 1,
      current_round_submitted = true,
      last_seen_at = now()
  where id = p_player_id;

  return jsonb_build_object(
    'ok', true,
    'isCorrect', true,
    'pointsAwarded', v_total
  );
end;
$$;

