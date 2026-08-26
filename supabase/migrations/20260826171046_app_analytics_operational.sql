create extension if not exists pgcrypto;

-- Existing operational tables now live in migrations. Runtime startup must not
-- mutate schema: deploy this migration before releasing the matching code.
create table if not exists public.looks (
  id uuid primary key default gen_random_uuid(),
  ocasiao varchar(255),
  tipo_cerimonia varchar(255),
  renda_decisao boolean,
  biotipo varchar(255),
  peca varchar(255),
  comprimento varchar(255),
  decote varchar(255),
  manga varchar(255),
  possui_manga boolean,
  saia varchar(255),
  renda varchar(255),
  comentario text,
  cor varchar(255),
  tecido_sku varchar(255),
  foto_usuario_url text,
  croqui_url text,
  realista_url text,
  nome_cliente varchar(255),
  telefone_cliente varchar(255),
  generation_provider varchar(50),
  generation_model varchar(100),
  generation_prompt_version varchar(100),
  generation_candidates jsonb,
  specification jsonb,
  created_at timestamptz not null default now()
);

alter table public.looks add column if not exists tipo_cerimonia varchar(255);
alter table public.looks add column if not exists renda_decisao boolean;
alter table public.looks add column if not exists possui_manga boolean;
alter table public.looks add column if not exists saia varchar(255);
alter table public.looks add column if not exists renda varchar(255);
alter table public.looks add column if not exists comentario text;
alter table public.looks add column if not exists tecido_sku varchar(255);
alter table public.looks add column if not exists nome_cliente varchar(255);
alter table public.looks add column if not exists telefone_cliente varchar(255);
alter table public.looks add column if not exists generation_provider varchar(50);
alter table public.looks add column if not exists generation_model varchar(100);
alter table public.looks add column if not exists generation_prompt_version varchar(100);
alter table public.looks add column if not exists generation_candidates jsonb;
alter table public.looks add column if not exists specification jsonb;

create table if not exists public.upload_sessions (
  id uuid primary key default gen_random_uuid(),
  nome_cliente varchar(255),
  ocasiao varchar(255),
  reference_piece varchar(50),
  status varchar(50) not null default 'pending',
  croqui_url text,
  reference_analysis jsonb,
  analysis_error_code varchar(100),
  vision_provider varchar(50),
  vision_model varchar(100),
  prompt_version varchar(100),
  generation_provider varchar(50),
  generation_model varchar(100),
  generation_prompt_version varchar(100),
  generation_candidates jsonb,
  specification jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes'
);

alter table public.upload_sessions add column if not exists ocasiao varchar(255);
alter table public.upload_sessions add column if not exists reference_piece varchar(50);
alter table public.upload_sessions add column if not exists reference_analysis jsonb;
alter table public.upload_sessions add column if not exists analysis_error_code varchar(100);
alter table public.upload_sessions add column if not exists vision_provider varchar(50);
alter table public.upload_sessions add column if not exists vision_model varchar(100);
alter table public.upload_sessions add column if not exists prompt_version varchar(100);
alter table public.upload_sessions add column if not exists generation_provider varchar(50);
alter table public.upload_sessions add column if not exists generation_model varchar(100);
alter table public.upload_sessions add column if not exists generation_prompt_version varchar(100);
alter table public.upload_sessions add column if not exists generation_candidates jsonb;
alter table public.upload_sessions add column if not exists specification jsonb;
alter table public.upload_sessions add column if not exists updated_at timestamptz not null default now();

create schema if not exists app_analytics;
revoke all on schema app_analytics from public, anon, authenticated;

create table if not exists app_analytics.executions (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('manual', 'reference')),
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  tracking_status text not null default 'healthy' check (tracking_status in ('healthy', 'degraded')),
  specification jsonb not null default '{}'::jsonb,
  error_code text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  failed_at timestamptz,
  analytics_retention_until timestamptz not null default now() + interval '12 months',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_analytics.execution_steps (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references app_analytics.executions(id) on delete cascade,
  parent_step_id uuid references app_analytics.execution_steps(id) on delete cascade,
  stage text not null,
  attempt integer not null default 1 check (attempt > 0),
  status text not null default 'running' check (status in ('running', 'success', 'error')),
  provider text,
  model text,
  prompt_version text,
  seed integer,
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer check (duration_ms is null or duration_ms >= 0)
);

create table if not exists app_analytics.execution_artifacts (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references app_analytics.executions(id) on delete cascade,
  step_id uuid references app_analytics.execution_steps(id) on delete set null,
  kind text not null check (kind in ('reference_crop', 'croqui_candidate', 'croqui', 'realistic')),
  selected boolean not null default false,
  status text not null default 'available' check (status in ('pending', 'available', 'storage_failed', 'deleted', 'deletion_failed')),
  storage_bucket text,
  storage_path text,
  source_url text,
  mime_type text,
  metadata jsonb not null default '{}'::jsonb,
  retention_until timestamptz not null,
  deletion_attempts integer not null default 0,
  deletion_error_code text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_analytics.result_ratings (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references app_analytics.executions(id) on delete cascade,
  artifact_id uuid not null unique references app_analytics.execution_artifacts(id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  rated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_analytics.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references app_analytics.executions(id) on delete cascade,
  artifact_id uuid not null references app_analytics.execution_artifacts(id) on delete cascade,
  event_key text not null unique,
  channel text not null default 'telegram' check (channel = 'telegram'),
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error_code text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists execution_steps_execution_started_idx
  on app_analytics.execution_steps (execution_id, started_at);
create index if not exists execution_artifacts_execution_created_idx
  on app_analytics.execution_artifacts (execution_id, created_at);
create index if not exists execution_artifacts_retention_idx
  on app_analytics.execution_artifacts (retention_until)
  where status in ('available', 'storage_failed', 'deletion_failed');
create index if not exists executions_started_idx
  on app_analytics.executions (started_at desc);
create index if not exists executions_status_started_idx
  on app_analytics.executions (status, started_at desc);
create index if not exists ratings_score_updated_idx
  on app_analytics.result_ratings (score, updated_at desc);
create index if not exists notification_outbox_pending_idx
  on app_analytics.notification_outbox (status, next_attempt_at)
  where status in ('pending', 'failed');

alter table app_analytics.executions enable row level security;
alter table app_analytics.execution_steps enable row level security;
alter table app_analytics.execution_artifacts enable row level security;
alter table app_analytics.result_ratings enable row level security;
alter table app_analytics.notification_outbox enable row level security;

grant usage on schema app_analytics to service_role;
grant select, insert, update, delete on all tables in schema app_analytics to service_role;
alter default privileges in schema app_analytics
  grant select, insert, update, delete on tables to service_role;

alter table public.looks add column if not exists execution_id uuid;
alter table public.upload_sessions add column if not exists execution_id uuid;
alter table public.upload_sessions add column if not exists croqui_artifact_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'looks_execution_id_fkey') then
    alter table public.looks
      add constraint looks_execution_id_fkey foreign key (execution_id)
      references app_analytics.executions(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'upload_sessions_execution_id_fkey') then
    alter table public.upload_sessions
      add constraint upload_sessions_execution_id_fkey foreign key (execution_id)
      references app_analytics.executions(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'upload_sessions_croqui_artifact_id_fkey') then
    alter table public.upload_sessions
      add constraint upload_sessions_croqui_artifact_id_fkey foreign key (croqui_artifact_id)
      references app_analytics.execution_artifacts(id) on delete set null;
  end if;
end
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'execution-assets',
  'execution-assets',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
