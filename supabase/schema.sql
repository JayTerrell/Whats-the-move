-- What's the Move: v1 database.
-- Paste into Supabase > SQL Editor and click Run, once.

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- event types
-- owner_id null = a default type everyone has. Families are fixed in code.
create table public.event_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  family text not null check (family in ('food', 'music', 'arts', 'outdoors', 'games', 'social')),
  owner_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index event_types_unique_name
  on public.event_types (coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

insert into public.event_types (name, family) values
  ('Restaurant', 'food'), ('Bar', 'food'), ('Speakeasy', 'food'), ('Coffee shop', 'food'),
  ('Live music', 'music'), ('Concert', 'music'), ('Open mic', 'music'), ('Gala', 'music'),
  ('Museum', 'arts'), ('Art show', 'arts'), ('Literature', 'arts'), ('Movies', 'arts'),
  ('Museum & music', 'arts'), ('Theater', 'arts'), ('Painting', 'arts'),
  ('Outdoor', 'outdoors'), ('City tour', 'outdoors'), ('Sports activity', 'outdoors'),
  ('Hiking', 'outdoors'), ('Car racing', 'outdoors'),
  ('Immersive', 'games'), ('Game night', 'games'), ('Car show', 'games'), ('Gameshow', 'games'),
  ('Escape room', 'games'),
  ('Networking', 'social'), ('Shopping', 'social');

-- ---------------------------------------------------------------- places
-- Shared by everyone: one row per venue, or per city for city-only entries.
create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  city text,
  lat double precision,
  lng double precision,
  precision text not null default 'address' check (precision in ('address', 'city')),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index places_name on public.places (lower(name) text_pattern_ops);

-- ---------------------------------------------------------------- entries
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  place_id uuid references public.places (id) on delete set null,
  occurrence text not null default 'always' check (occurrence in ('once', 'repeats', 'run', 'always')),
  start_date date,
  end_date date,
  start_time time,
  repeats text,
  free boolean not null default false,
  source_url text,
  copied_from uuid references public.entries (id) on delete set null,
  starred_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index entries_owner on public.entries (owner_id);

create table public.entry_types (
  entry_id uuid not null references public.entries (id) on delete cascade,
  type_id uuid not null references public.event_types (id) on delete cascade,
  position smallint not null default 0,
  primary key (entry_id, type_id)
);

-- ---------------------------------------------------------------- lists
create table public.lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.list_entries (
  list_id uuid not null references public.lists (id) on delete cascade,
  entry_id uuid not null references public.entries (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, entry_id)
);

-- ---------------------------------------------------------------- plans
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now()
);

create table public.plan_stops (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  entry_id uuid not null references public.entries (id) on delete cascade,
  position smallint not null default 0,
  start_time time,
  status text not null default 'going' check (status in ('going', 'option'))
);
create index plan_stops_plan on public.plan_stops (plan_id);
create index plan_stops_entry on public.plan_stops (entry_id);

create table public.plan_members (
  plan_id uuid not null references public.plans (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);
create index plan_members_user on public.plan_members (user_id);

create table public.invites (
  token text primary key default replace(gen_random_uuid()::text, '-', ''),
  plan_id uuid not null references public.plans (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- The creator of a plan is its first member.
create function public.add_plan_creator() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.plan_members (plan_id, user_id) values (new.id, new.created_by);
  return new;
end $$;

create trigger on_plan_created
  after insert on public.plans
  for each row execute function public.add_plan_creator();

create function public.is_plan_member(p uuid) returns boolean
language sql security definer stable set search_path = '' as $$
  select exists (select 1 from public.plan_members where plan_id = p and user_id = auth.uid());
$$;

-- ---------------------------------------------------------------- invites
-- What someone sees before signing in.
create function public.invite_preview(invite_token text) returns json
language sql security definer stable set search_path = '' as $$
  select json_build_object(
    'plan_id', p.id,
    'date', p.date,
    'entry_name', e.name,
    'start_time', coalesce(s.start_time, e.start_time),
    'place_name', pl.name,
    'city', pl.city,
    'inviter', pr.name,
    'members', (select count(*) from public.plan_members m where m.plan_id = p.id),
    'is_member', (auth.uid() is not null and exists (
      select 1 from public.plan_members m where m.plan_id = p.id and m.user_id = auth.uid()))
  )
  from public.invites i
  join public.plans p on p.id = i.plan_id
  join public.plan_stops s on s.plan_id = p.id
  join public.entries e on e.id = s.entry_id
  left join public.places pl on pl.id = e.place_id
  left join public.profiles pr on pr.id = i.created_by
  where i.token = invite_token
  order by s.position
  limit 1;
$$;

-- Joins the plan and saves a copy of each stop's entry to the new member.
create function public.accept_invite(invite_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  plan uuid;
  stop record;
  copy uuid;
begin
  if me is null then raise exception 'Sign in first'; end if;
  select plan_id into plan from public.invites where token = invite_token;
  if plan is null then raise exception 'This invite link is no longer valid'; end if;

  insert into public.plan_members (plan_id, user_id) values (plan, me) on conflict do nothing;

  for stop in
    select e.* from public.plan_stops s join public.entries e on e.id = s.entry_id where s.plan_id = plan
  loop
    if stop.owner_id <> me and not exists (
      select 1 from public.entries where owner_id = me and copied_from = stop.id
    ) then
      insert into public.entries (owner_id, name, place_id, occurrence, start_date, end_date, start_time, repeats, free, source_url, copied_from)
      values (me, stop.name, stop.place_id, stop.occurrence, stop.start_date, stop.end_date, stop.start_time, stop.repeats, stop.free, stop.source_url, stop.id)
      returning id into copy;
      insert into public.entry_types (entry_id, type_id, position)
        select copy, et.type_id, et.position
        from public.entry_types et join public.event_types t on t.id = et.type_id
        where et.entry_id = stop.id and t.owner_id is null;
    end if;
  end loop;
  return plan;
end $$;

grant execute on function public.invite_preview(text) to anon, authenticated;
grant execute on function public.accept_invite(text) to authenticated;

-- ---------------------------------------------------------------- row level security
alter table public.profiles enable row level security;
alter table public.event_types enable row level security;
alter table public.places enable row level security;
alter table public.entries enable row level security;
alter table public.entry_types enable row level security;
alter table public.lists enable row level security;
alter table public.list_entries enable row level security;
alter table public.plans enable row level security;
alter table public.plan_stops enable row level security;
alter table public.plan_members enable row level security;
alter table public.invites enable row level security;

create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "own profile" on public.profiles for update to authenticated using (id = auth.uid());

create policy "default and own types" on public.event_types for select to authenticated
  using (owner_id is null or owner_id = auth.uid());
create policy "add own types" on public.event_types for insert to authenticated with check (owner_id = auth.uid());
create policy "change own types" on public.event_types for update to authenticated using (owner_id = auth.uid());
create policy "remove own types" on public.event_types for delete to authenticated using (owner_id = auth.uid());

create policy "places readable" on public.places for select to authenticated using (true);
create policy "add places" on public.places for insert to authenticated with check (created_by = auth.uid());
create policy "change own places" on public.places for update to authenticated using (created_by = auth.uid());

create policy "own entries and plan entries" on public.entries for select to authenticated
  using (owner_id = auth.uid() or exists (
    select 1 from public.plan_stops s where s.entry_id = entries.id and public.is_plan_member(s.plan_id)));
create policy "add own entries" on public.entries for insert to authenticated with check (owner_id = auth.uid());
create policy "change own entries" on public.entries for update to authenticated using (owner_id = auth.uid());
create policy "remove own entries" on public.entries for delete to authenticated using (owner_id = auth.uid());

create policy "types of visible entries" on public.entry_types for select to authenticated
  using (exists (select 1 from public.entries e where e.id = entry_id));
create policy "type own entries" on public.entry_types for insert to authenticated
  with check (exists (select 1 from public.entries e where e.id = entry_id and e.owner_id = auth.uid()));
create policy "untype own entries" on public.entry_types for delete to authenticated
  using (exists (select 1 from public.entries e where e.id = entry_id and e.owner_id = auth.uid()));

create policy "own lists" on public.lists for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own list entries" on public.list_entries for all to authenticated
  using (exists (select 1 from public.lists l where l.id = list_id and l.owner_id = auth.uid()))
  with check (exists (select 1 from public.lists l where l.id = list_id and l.owner_id = auth.uid()));

create policy "plans you're in" on public.plans for select to authenticated
  using (created_by = auth.uid() or public.is_plan_member(id));
create policy "make plans" on public.plans for insert to authenticated with check (created_by = auth.uid());
create policy "change own plans" on public.plans for update to authenticated using (created_by = auth.uid());
create policy "remove own plans" on public.plans for delete to authenticated using (created_by = auth.uid());

create policy "stops of your plans" on public.plan_stops for all to authenticated
  using (public.is_plan_member(plan_id)) with check (public.is_plan_member(plan_id));

create policy "members of your plans" on public.plan_members for select to authenticated
  using (public.is_plan_member(plan_id));
create policy "leave plans" on public.plan_members for delete to authenticated using (user_id = auth.uid());

create policy "invites of your plans" on public.invites for select to authenticated
  using (public.is_plan_member(plan_id));
create policy "invite to your plans" on public.invites for insert to authenticated
  with check (created_by = auth.uid() and public.is_plan_member(plan_id));

-- ---------------------------------------------------------------- access
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
