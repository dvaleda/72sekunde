-- 72 sekunde - database schema (Supabase Postgres)
-- Safe to run multiple times (idempotent guards via IF NOT EXISTS).

create extension if not exists "pgcrypto";

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  nickname varchar(50) not null,
  email varchar(255) not null unique,
  marketing_consent boolean not null default false,
  terms_accepted boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists questions (
  id varchar(50) primary key,
  category varchar(50) not null,
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  correct_answer char(1) not null check (correct_answer in ('A','B','C')),
  difficulty varchar(20) not null check (difficulty in ('EASY','MEDIUM','HARD')),
  active boolean not null default true
);

create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  attempt_number integer not null default 1,
  started_at timestamptz not null,
  expires_at timestamptz not null,
  finished_at timestamptz,
  score integer not null default 0,
  answered_count integer not null default 0,
  status varchar(20) not null default 'in_progress'
    check (status in ('in_progress', 'finished', 'expired')),
  question_order jsonb not null default '[]'::jsonb, -- ordered list of question ids for this attempt
  created_at timestamptz not null default now()
);

create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references attempts(id) on delete cascade,
  question_id varchar(50) not null references questions(id),
  selected_answer char(1) not null check (selected_answer in ('A','B','C')),
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  sequence_number integer not null,
  unique (attempt_id, question_id),
  unique (attempt_id, sequence_number)
);

create table if not exists event_config (
  id integer primary key default 1,
  project_name text not null default '72 sata bez kompromisa',
  edition_year integer not null default 2026,
  slogan text,
  official_registration_url text,
  official_project_url text default 'https://72h.hr/',
  organizer_name text,
  age_min integer default 15,
  age_max integer default 35,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);

insert into event_config (id) values (1) on conflict (id) do nothing;

-- Helpful indexes
create index if not exists idx_attempts_player_id on attempts(player_id);
create index if not exists idx_attempts_status on attempts(status);
create index if not exists idx_answers_attempt_id on answers(attempt_id);
create index if not exists idx_questions_category on questions(category);
create index if not exists idx_questions_active on questions(active);

-- Leaderboard view: best finished attempt per player.
create or replace view leaderboard_view as
select distinct on (p.id)
  p.id as player_id,
  p.nickname,
  a.id as attempt_id,
  a.score,
  a.answered_count,
  a.finished_at,
  extract(epoch from (a.finished_at - a.started_at)) as elapsed_seconds
from attempts a
join players p on p.id = a.player_id
where a.status = 'finished'
order by p.id, a.score desc, extract(epoch from (a.finished_at - a.started_at)) asc;
