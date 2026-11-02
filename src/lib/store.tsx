import type { User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { todayISO } from './dates';
import { rootOf } from './schedule';
import { supabase } from './supabase';
import type { Entry, EventType, FamilyId, ISODate, List, Occurrence, Place, Plan, Profile } from './types';

const ENTRY = '*, place:places(*), entry_types(type_id, position)';
const PLAN = `id, created_by, date, plan_stops(id, entry_id, position, start_time, entry:entries(${ENTRY})), plan_members(user_id, profile:profiles(name, avatar_url))`;
const RETURN_KEY = 'wtm.returnTo';

type EntryRow = Omit<Entry, 'type_ids'> & { entry_types: { type_id: string; position: number }[] };

const toEntry = ({ entry_types, ...row }: EntryRow): Entry => ({
  ...row,
  type_ids: [...(entry_types ?? [])].sort((a, b) => a.position - b.position).map((t) => t.type_id),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toPlan = (row: any): Plan => ({
  id: row.id,
  created_by: row.created_by,
  date: row.date,
  stops: [...row.plan_stops]
    .filter((s) => s.entry)
    .sort((a, b) => a.position - b.position)
    .map((s) => ({ ...s, entry: toEntry(s.entry) })),
  members: row.plan_members.map((m: { user_id: string; profile: Profile | null }) => ({
    user_id: m.user_id,
    name: m.profile?.name ?? null,
    avatar_url: m.profile?.avatar_url ?? null,
  })),
});

export type PlaceChoice = { kind: 'none' } | { kind: 'existing'; place: Place } | { kind: 'new'; place: Omit<Place, 'id'> };

export interface EntryInput {
  name: string;
  type_ids: string[];
  place: PlaceChoice;
  occurrence: Occurrence;
  start_date: ISODate | null;
  end_date: ISODate | null;
  start_time: string | null;
  repeats: string | null;
  free: boolean;
  source_url: string | null;
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function useStoreState() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [types, setTypes] = useState<EventType[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [filter, setFilter] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<ISODate>(todayISO());
  const [toastText, setToastText] = useState<string | null>(null);
  const toastTimer = useRef<number>(undefined);

  const toast = useCallback((text: string) => {
    setToastText(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastText(null), 2200);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  const loadPlans = useCallback(async (uid: string) => {
    const { data, error } = await supabase.from('plans').select(PLAN).order('date');
    fail(error);
    setPlans((data ?? []).map(toPlan).filter((p) => p.members.some((m) => m.user_id === uid)));
  }, []);

  const loadAll = useCallback(
    async (uid: string) => {
      const [p, e, t, l] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
        supabase.from('entries').select(ENTRY).eq('owner_id', uid).order('created_at', { ascending: false }),
        supabase.from('event_types').select('*').order('name'),
        supabase.from('lists').select('id, name, list_entries(entry_id)').order('created_at'),
      ]);
      [p, e, t, l].forEach((r) => fail(r.error));
      setProfile(p.data);
      setEntries((e.data as EntryRow[]).map(toEntry));
      setTypes(t.data as EventType[]);
      setLists(
        (l.data ?? []).map((row: { id: string; name: string; list_entries: { entry_id: string }[] }) => ({
          id: row.id,
          name: row.name,
          entry_ids: row.list_entries.map((x) => x.entry_id),
        })),
      );
      await loadPlans(uid);
      setLoaded(true);
    },
    [loadPlans],
  );

  useEffect(() => {
    if (user) loadAll(user.id).catch((e) => toast(e.message));
    else setLoaded(false);
  }, [user, loadAll, toast]);

  const typeMap = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);

  const signIn = useCallback(async (returnTo = window.location.pathname + window.location.search) => {
    try {
      localStorage.setItem(RETURN_KEY, returnTo);
    } catch {
      /* fine: you'll land on Home */
    }
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
  }, []);

  const takeReturnPath = useCallback(() => {
    try {
      const path = localStorage.getItem(RETURN_KEY);
      localStorage.removeItem(RETURN_KEY);
      return path;
    } catch {
      return null;
    }
  }, []);

  const signOut = useCallback(() => supabase.auth.signOut(), []);

  const saveEntry = useCallback(
    async (input: EntryInput, id?: string): Promise<Entry> => {
      let place_id: string | null = null;
      if (input.place.kind === 'existing') place_id = input.place.place.id;
      if (input.place.kind === 'new') {
        const { data, error } = await supabase.from('places').insert(input.place.place).select('id').single();
        fail(error);
        place_id = data!.id;
      }
      const row = {
        name: input.name.trim(),
        place_id,
        occurrence: input.occurrence,
        start_date: input.start_date,
        end_date: input.end_date,
        start_time: input.start_time,
        repeats: input.repeats?.trim() || null,
        free: input.free,
        source_url: input.source_url,
        updated_at: new Date().toISOString(),
      };
      const saved = id
        ? await supabase.from('entries').update(row).eq('id', id).select('id').single()
        : await supabase.from('entries').insert(row).select('id').single();
      fail(saved.error);
      const entryId = saved.data!.id as string;
      fail((await supabase.from('entry_types').delete().eq('entry_id', entryId)).error);
      if (input.type_ids.length) {
        fail(
          (
            await supabase
              .from('entry_types')
              .insert(input.type_ids.map((type_id, position) => ({ entry_id: entryId, type_id, position })))
          ).error,
        );
      }
      const { data, error } = await supabase.from('entries').select(ENTRY).eq('id', entryId).single();
      fail(error);
      const entry = toEntry(data as EntryRow);
      setEntries((prev) => [entry, ...prev.filter((e) => e.id !== entry.id)]);
      return entry;
    },
    [],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      fail((await supabase.from('entries').delete().eq('id', id)).error);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setLists((prev) => prev.map((l) => ({ ...l, entry_ids: l.entry_ids.filter((x) => x !== id) })));
      if (user) await loadPlans(user.id);
    },
    [user, loadPlans],
  );

  /** The plan you're in that has this entry (or its copy) on this date. */
  const planFor = useCallback(
    (entry: Entry, date: ISODate) =>
      plans.find((p) => p.date === date && p.stops.some((s) => rootOf(s.entry) === rootOf(entry))),
    [plans],
  );

  const createPlan = useCallback(
    async (entry: Entry, date: ISODate) => {
      const { data, error } = await supabase.from('plans').insert({ date }).select('id').single();
      fail(error);
      fail((await supabase.from('plan_stops').insert({ plan_id: data!.id, entry_id: entry.id })).error);
      await loadPlans(user!.id);
      return data!.id as string;
    },
    [user, loadPlans],
  );

  const toggleAttend = useCallback(
    async (entry: Entry, date: ISODate) => {
      const plan = planFor(entry, date);
      if (!plan) {
        await createPlan(entry, date);
        return;
      }
      const alone = plan.members.length <= 1 && plan.created_by === user!.id;
      const res = alone
        ? await supabase.from('plans').delete().eq('id', plan.id)
        : await supabase.from('plan_members').delete().eq('plan_id', plan.id).eq('user_id', user!.id);
      fail(res.error);
      setPlans((prev) => prev.filter((p) => p.id !== plan.id));
    },
    [user, planFor, createPlan],
  );

  const inviteLink = useCallback(
    async (entry: Entry, date: ISODate) => {
      const planId = planFor(entry, date)?.id ?? (await createPlan(entry, date));
      const { data, error } = await supabase.from('invites').insert({ plan_id: planId }).select('token').single();
      fail(error);
      return `${window.location.origin}/i/${data!.token}`;
    },
    [planFor, createPlan],
  );

  const acceptInvite = useCallback(
    async (token: string) => {
      const { data, error } = await supabase.rpc('accept_invite', { invite_token: token });
      fail(error);
      await loadAll(user!.id);
      return data as string;
    },
    [user, loadAll],
  );

  const addType = useCallback(
    async (name: string, family: FamilyId) => {
      const { data, error } = await supabase
        .from('event_types')
        .insert({ name: name.trim(), family, owner_id: user!.id })
        .select('*')
        .single();
      fail(error);
      setTypes((prev) => [...prev, data as EventType].sort((a, b) => a.name.localeCompare(b.name)));
      return data as EventType;
    },
    [user],
  );

  const deleteType = useCallback(async (id: string) => {
    fail((await supabase.from('event_types').delete().eq('id', id)).error);
    setTypes((prev) => prev.filter((t) => t.id !== id));
    setEntries((prev) => prev.map((e) => ({ ...e, type_ids: e.type_ids.filter((t) => t !== id) })));
  }, []);

  const createList = useCallback(async (name: string) => {
    const { data, error } = await supabase.from('lists').insert({ name: name.trim() }).select('id, name').single();
    fail(error);
    const list = { ...(data as { id: string; name: string }), entry_ids: [] };
    setLists((prev) => [...prev, list]);
    return list as List;
  }, []);

  const renameList = useCallback(async (id: string, name: string) => {
    fail((await supabase.from('lists').update({ name: name.trim() }).eq('id', id)).error);
    setLists((prev) => prev.map((l) => (l.id === id ? { ...l, name: name.trim() } : l)));
  }, []);

  const deleteList = useCallback(async (id: string) => {
    fail((await supabase.from('lists').delete().eq('id', id)).error);
    setLists((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const toggleInList = useCallback(
    async (listId: string, entryId: string) => {
      const list = lists.find((l) => l.id === listId)!;
      const has = list.entry_ids.includes(entryId);
      const res = has
        ? await supabase.from('list_entries').delete().eq('list_id', listId).eq('entry_id', entryId)
        : await supabase.from('list_entries').insert({ list_id: listId, entry_id: entryId });
      fail(res.error);
      setLists((prev) =>
        prev.map((l) =>
          l.id === listId
            ? { ...l, entry_ids: has ? l.entry_ids.filter((x) => x !== entryId) : [...l.entry_ids, entryId] }
            : l,
        ),
      );
    },
    [lists],
  );

  return {
    user,
    authReady,
    loaded,
    profile,
    entries,
    types,
    typeMap,
    plans,
    lists,
    filter,
    setFilter,
    selectedDate,
    setSelectedDate,
    toastText,
    toast,
    signIn,
    signOut,
    takeReturnPath,
    saveEntry,
    deleteEntry,
    planFor,
    toggleAttend,
    inviteLink,
    acceptInvite,
    addType,
    deleteType,
    createList,
    renameList,
    deleteList,
    toggleInList,
  };
}

export type Store = ReturnType<typeof useStoreState>;
const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const store = useStoreState();
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore outside StoreProvider');
  return store;
}

/** Entries that pass the shared event type filter (empty filter = everything). */
export function useFiltered(entries: Entry[]): Entry[] {
  const { filter } = useStore();
  return useMemo(
    () => (filter.size ? entries.filter((e) => e.type_ids.some((t) => filter.has(t))) : entries),
    [entries, filter],
  );
}
