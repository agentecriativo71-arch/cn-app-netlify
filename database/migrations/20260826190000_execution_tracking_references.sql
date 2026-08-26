alter table public.looks
  add column if not exists execution_id uuid;

alter table public.upload_sessions
  add column if not exists execution_id uuid;

alter table public.upload_sessions
  add column if not exists croqui_artifact_id uuid;

create index if not exists looks_execution_id_idx
  on public.looks (execution_id)
  where execution_id is not null;

create index if not exists upload_sessions_execution_id_idx
  on public.upload_sessions (execution_id)
  where execution_id is not null;

create index if not exists upload_sessions_croqui_artifact_id_idx
  on public.upload_sessions (croqui_artifact_id)
  where croqui_artifact_id is not null;

comment on column public.looks.execution_id is
  'Referência lógica para app_analytics.executions no banco operacional separado.';

comment on column public.upload_sessions.execution_id is
  'Referência lógica para app_analytics.executions no banco operacional separado.';

comment on column public.upload_sessions.croqui_artifact_id is
  'Referência lógica para app_analytics.execution_artifacts no banco operacional separado.';
