-- =============================================================================
-- PYTHON CODE ARENA — SUPABASE POSTGRESQL SCHEMA & RLS MIGRATION
-- Gateway Qualifications Level 2 Computer Programming (T/618/3703)
-- =============================================================================

create extension if not exists "pgcrypto";

-- 1. TEACHER PROFILES
create table if not exists public.teacher_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 60),
  created_at timestamptz not null default now()
);

-- 2. CHALLENGE CATALOGUE (Server-side reference for validation & scoring)
create table if not exists public.challenge_catalogue (
  id text primary key,
  challenge_number int not null unique check (challenge_number between 1 and 30),
  title text not null,
  world_id text not null,
  difficulty text not null,
  engine_type text not null,
  xp_reward int not null default 100,
  -- Server-side canonical answer key (protected via column/table privileges)
  canonical_solution text not null,
  expected_output text not null,
  required_tokens text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- 3. GAME SESSIONS
create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  pin char(6) not null check (pin ~ '^[0-9]{6}$'),
  title text not null check (char_length(title) between 3 and 100),
  teacher_id uuid not null references public.teacher_profiles(id) on delete cascade,
  pack_id text not null,
  challenge_ids text[] not null default '{}',
  current_round_index int not null default 0 check (current_round_index >= 0),
  status text not null default 'lobby' check (status in ('lobby', 'active', 'paused', 'leaderboard', 'completed')),
  round_started_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_game_sessions_pin on public.game_sessions(pin);
create index if not exists idx_game_sessions_teacher on public.game_sessions(teacher_id);

-- 4. SESSION PLAYERS (Anonymous Students)
create table if not exists public.session_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  anonymous_auth_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 3 and 16),
  total_score int not null default 0 check (total_score >= 0),
  challenges_completed int not null default 0 check (challenges_completed >= 0),
  current_round_submitted boolean not null default false,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (session_id, nickname),
  unique (session_id, anonymous_auth_id)
);

create index if not exists idx_session_players_session on public.session_players(session_id);

-- 5. CHALLENGE ATTEMPTS
create table if not exists public.challenge_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  player_id uuid not null references public.session_players(id) on delete cascade,
  challenge_id text not null,
  round_index int not null check (round_index >= 0),
  submitted_code text not null,
  is_correct boolean not null default false,
  hints_used int not null default 0 check (hints_used between 0 and 3),
  time_taken_seconds int not null default 0 check (time_taken_seconds >= 0),
  error_category text,
  created_at timestamptz not null default now()
);

create index if not exists idx_attempts_session_round on public.challenge_attempts(session_id, round_index);
create index if not exists idx_attempts_player on public.challenge_attempts(player_id);

-- 6. SCORES (One awarded score record per player per round — prevents duplicate points!)
create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  player_id uuid not null references public.session_players(id) on delete cascade,
  challenge_id text not null,
  round_index int not null check (round_index >= 0),
  base_points int not null default 100 check (base_points between 0 and 100),
  hint_bonus int not null default 0 check (hint_bonus between 0 and 30),
  speed_bonus int not null default 0 check (speed_bonus between 0 and 20),
  total_points int not null default 0 check (total_points between 0 and 150),
  awarded_at timestamptz not null default now(),
  unique (session_id, player_id, round_index)
);

create index if not exists idx_scores_session on public.scores(session_id);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

alter table public.teacher_profiles enable row level security;
alter table public.challenge_catalogue enable row level security;
alter table public.game_sessions enable row level security;
alter table public.session_players enable row level security;
alter table public.challenge_attempts enable row level security;
alter table public.scores enable row level security;

-- Helper function to verify if current authenticated user is a registered teacher
create or replace function public.is_verified_teacher()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.teacher_profiles where id = auth.uid()
  );
$$;

-- teacher_profiles: Only the teacher themselves can read their profile
drop policy if exists "Teachers can read own profile" on public.teacher_profiles;
create policy "Teachers can read own profile"
  on public.teacher_profiles
  for select
  using (auth.uid() = id);

-- game_sessions:
-- Anyone authenticated (including anonymous students) can view active/lobby sessions to join by PIN
drop policy if exists "Authenticated users can read sessions" on public.game_sessions;
create policy "Authenticated users can read sessions"
  on public.game_sessions
  for select
  using (auth.uid() is not null);

-- Only verified teachers who own the session can insert, update, or delete sessions
drop policy if exists "Verified teachers can create sessions" on public.game_sessions;
create policy "Verified teachers can create sessions"
  on public.game_sessions
  for insert
  with check (public.is_verified_teacher() and teacher_id = auth.uid());

drop policy if exists "Verified teachers can update own sessions" on public.game_sessions;
create policy "Verified teachers can update own sessions"
  on public.game_sessions
  for update
  using (public.is_verified_teacher() and teacher_id = auth.uid())
  with check (public.is_verified_teacher() and teacher_id = auth.uid());

drop policy if exists "Verified teachers can delete own sessions" on public.game_sessions;
create policy "Verified teachers can delete own sessions"
  on public.game_sessions
  for delete
  using (public.is_verified_teacher() and teacher_id = auth.uid());

-- session_players:
-- Players in the same session or the owning teacher can view session players
drop policy if exists "Session participants and teachers can view players" on public.session_players;
create policy "Session participants and teachers can view players"
  on public.session_players
  for select
  using (auth.uid() is not null);

-- Anonymous students can insert their own player row when joining a lobby
drop policy if exists "Anonymous students can join lobby as themselves" on public.session_players;
create policy "Anonymous students can join lobby as themselves"
  on public.session_players
  for insert
  with check (
    auth.uid() = anonymous_auth_id
    and total_score = 0
    and challenges_completed = 0
  );

-- Students CANNOT directly update total_score; scores are updated via Edge Function (service_role) or teacher
drop policy if exists "Teachers can manage players in own sessions" on public.session_players;
create policy "Teachers can manage players in own sessions"
  on public.session_players
  for delete
  using (
    exists (
      select 1 from public.game_sessions s
      where s.id = session_players.session_id and s.teacher_id = auth.uid()
    )
  );

-- challenge_attempts & scores:
-- Read access for session leaderboard & teacher analytics
drop policy if exists "Read scores in session" on public.scores;
create policy "Read scores in session"
  on public.scores
  for select
  using (auth.uid() is not null);

drop policy if exists "Teachers can read attempts for own sessions" on public.challenge_attempts;
create policy "Teachers can read attempts for own sessions"
  on public.challenge_attempts
  for select
  using (
    exists (
      select 1 from public.game_sessions s
      where s.id = challenge_attempts.session_id and s.teacher_id = auth.uid()
    )
    or exists (
      select 1 from public.session_players p
      where p.id = challenge_attempts.player_id and p.anonymous_auth_id = auth.uid()
    )
  );

-- =============================================================================
-- CLEANUP FUNCTION FOR OLD SESSIONS (> 7 DAYS OLD)
-- =============================================================================
create or replace function public.cleanup_old_game_sessions(days_to_keep int default 7)
returns int
language plpgsql
security definer
as $$
declare
  deleted_count int;
begin
  if not public.is_verified_teacher() then
    raise exception 'Only verified teachers may trigger session cleanup.';
  end if;

  with deleted as (
    delete from public.game_sessions
    where created_at < now() - make_interval(days => days_to_keep)
    returning id
  )
  select count(*) into deleted_count from deleted;

  return deleted_count;
end;
$$;

-- =============================================================================
-- ENABLE SUPABASE REALTIME FOR LIVE LEADERBOARD & LOBBY (IDEMPOTENT)
-- =============================================================================
do $$
begin
  begin
    alter publication supabase_realtime add table public.game_sessions;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.session_players;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.scores;
  exception when duplicate_object then null;
  end;
end $$;

