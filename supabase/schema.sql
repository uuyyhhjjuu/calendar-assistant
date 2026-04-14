create extension if not exists "pgcrypto";

create table if not exists calendars (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  passcode_hash text not null,
  timezone text not null default 'Asia/Shanghai',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references calendars(id) on delete cascade,
  date date not null,
  period text not null check (period in ('morning', 'afternoon', 'evening')),
  event_type text not null default 'work' check (event_type in ('work', 'personal', 'social')),
  start_time time,
  end_time time,
  title text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table events add column if not exists event_type text;
update events set event_type = 'work' where event_type is null;
alter table events alter column event_type set default 'work';
alter table events alter column event_type set not null;

create index if not exists idx_events_calendar_date on events(calendar_id, date);

create table if not exists day_notes (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references calendars(id) on delete cascade,
  date date not null,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(calendar_id, date)
);

create table if not exists todos (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references calendars(id) on delete cascade,
  content text not null,
  done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_todos_calendar_order on todos(calendar_id, sort_order);

alter table calendars enable row level security;
alter table events enable row level security;
alter table day_notes enable row level security;
alter table todos enable row level security;