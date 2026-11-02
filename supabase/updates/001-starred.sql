-- Stars: run once in the SQL editor. schema.sql already has this column for new projects.
alter table public.entries add column if not exists starred_at timestamptz;
