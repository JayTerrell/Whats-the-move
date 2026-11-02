import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ActiveFilters, FilterSheetBody } from '../components/FilterSheet';
import { SearchBar } from '../components/SearchBar';
import { Back, EntryRow, Poster, Sheet, StarButton } from '../components/ui';
import { todayISO } from '../lib/dates';
import { familyColor, typesInOrder } from '../lib/families';
import { issuesFor, ISSUE_LABEL, upcomingDates, type Issue } from '../lib/schedule';
import { useFiltered, useStore } from '../lib/store';
import type { Entry, EventType, Occurrence } from '../lib/types';

type Sort = 'recent' | 'soonest' | 'az';
const OCCURRENCE: [Occurrence, string][] = [
  ['once', 'Once'],
  ['repeats', 'Repeats'],
  ['run', 'For a run'],
  ['always', 'Always open'],
];
const NO_TYPE = 'none';
const COLLAPSED_KEY = 'wtm.collapsed';

interface Group {
  id: string;
  name: string;
  type?: EventType;
  entries: Entry[];
}

function readCollapsed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

/** Sections a list collapses to. Remembered on this device. */
function useCollapsed() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const save = useCallback((next: Set<string>) => {
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
    } catch {
      /* fine: just won't be remembered */
    }
  }, []);
  return [collapsed, save] as const;
}

/**
 * /saved            event type buckets
 * /saved?all        everything, grouped by event type
 * /saved?type=<id>  one event type ("none" for entries without one)
 * /saved?starred    your starred shortlist, grouped by event type
 * /saved?q=<text>   search results, grouped by event type
 */
export default function Saved() {
  const { entries, types, typeMap } = useStore();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const typeId = params.get('type');
  const all = params.has('all');
  const starred = params.has('starred');
  const inbox = params.has('inbox');
  const [sort, setSort] = useState<Sort>('recent');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [filtering, setFiltering] = useState(false);
  const [how, setHow] = useState<Set<Occurrence>>(new Set());
  const [freeOnly, setFreeOnly] = useState(false);
  const [city, setCity] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useCollapsed();
  const today = todayISO();

  const typed = useFiltered(entries);
  const cities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) if (e.place?.city) counts.set(e.place.city, (counts.get(e.place.city) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([c]) => c);
  }, [entries]);

  // Everything that passes search and filters, sorted. Groups keep this order.
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = typed.filter((e) => {
      if (how.size && !how.has(e.occurrence)) return false;
      if (freeOnly && !e.free) return false;
      if (city && e.place?.city !== city) return false;
      if (!needle) return true;
      const hay = [e.name, e.place?.name, e.place?.city, e.place?.address, ...e.type_ids.map((t) => typeMap.get(t)?.name)]
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
    const next = (e: Entry) => (e.occurrence === 'always' ? '9999' : (upcomingDates(e, today, 1)[0] ?? '9998'));
    return list.sort((a, b) =>
      sort === 'az'
        ? a.name.localeCompare(b.name)
        : sort === 'soonest'
          ? next(a).localeCompare(next(b))
          : b.created_at.localeCompare(a.created_at),
    );
  }, [typed, q, how, freeOnly, city, sort, typeMap, today]);

  // One group per event type, in family order. An entry with two types shows in both.
  const groupsOf = useCallback(
    (list: Entry[]): Group[] => {
      const groups: Group[] = typesInOrder(types).map((t) => ({ id: t.id, name: t.name, type: t, entries: [] }));
      const byId = new Map(groups.map((g) => [g.id, g]));
      const untyped: Group = { id: NO_TYPE, name: 'No type', entries: [] };
      for (const e of list) {
        const mine = e.type_ids.map((t) => byId.get(t)).filter((g) => !!g);
        if (mine.length) mine.forEach((g) => g.entries.push(e));
        else untyped.entries.push(e);
      }
      return untyped.entries.length ? [...groups, untyped] : groups;
    },
    [types],
  );

  const needing = useMemo(() => entries.filter((e) => issuesFor(e).length), [entries]);
  const starCount = useMemo(() => shown.filter((e) => e.starred_at).length, [shown]);

  const setQ = (v: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v) next.set('q', v);
        else next.delete('q');
        return next;
      },
      { replace: true },
    );

  if (inbox) return <Inbox entries={needing} />;

  const browsing = !!(q || typeId || all || starred);
  const only = typeId ? (typeId === NO_TYPE ? { name: 'No type' } : typeMap.get(typeId)) : null;
  const scoped = starred ? shown.filter((e) => e.starred_at) : shown;
  const groups = typeId
    ? groupsOf(scoped).filter((g) => g.id === typeId)
    : groupsOf(scoped).filter((g) => g.entries.length);
  const count = typeId ? (groups[0]?.entries.length ?? 0) : scoped.length;
  const title = starred ? 'Starred' : only ? only.name : all ? 'Everything' : q ? 'Search' : 'Saved';
  const grouped = !typeId;
  const allCollapsed = grouped && groups.length > 0 && groups.every((g) => collapsed.has(g.id));

  const toggle = (id: string) => {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCollapsed(next);
  };

  return (
    <div className="screen enter">
      <div className="row spread">
        <div className="row">
          {browsing && <Back to="/saved" />}
          <h1 className="h2 ellipsis">{title}</h1>
        </div>
        <span className="muted">{browsing ? count : shown.length}</span>
      </div>
      <div className="stack">
        <SearchBar value={q} onChange={setQ} onFilter={() => setFiltering(true)} autoFocus={!!q && !typeId && !all && !starred} />
        <ActiveFilters />
      </div>

      {!browsing ? (
        <>
          {needing.length > 0 && (
            <Link to="/saved?inbox" className="banner">
              <span>{needing.length} need details</span>
              <span>›</span>
            </Link>
          )}
          <div className="buckets">
            <Link to="/saved?starred" className="bucket wide" style={{ '--c': 'var(--f-outdoors)' } as CSSProperties}>
              <span className="star on" style={{ width: 'auto', height: 'auto', fontSize: 18 }} aria-hidden>
                ★
              </span>
              <span className="b-name">Starred</span>
              <span className="b-count">{starCount}</span>
            </Link>
          </div>
          <section className="sec">
            <div className="sec-head">
              <h2 className="h3">Event types</h2>
              <Link to="/saved?all">See all</Link>
            </div>
            <div className="buckets">
              {groupsOf(shown).map((g) => (
                <Link
                  key={g.id}
                  to={`/saved?type=${g.id}`}
                  className={`bucket ${g.entries.length ? '' : 'empty'}`}
                  style={{ '--c': familyColor(g.type?.family) } as CSSProperties}
                  aria-disabled={!g.entries.length}
                  tabIndex={g.entries.length ? undefined : -1}
                >
                  <span className="dot" />
                  <span className="b-name">{g.name}</span>
                  <span className="b-count">{g.entries.length}</span>
                </Link>
              ))}
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="row spread">
            <div className="seg">
              {(['recent', 'soonest', 'az'] as Sort[]).map((s) => (
                <button key={s} className={sort === s ? 'on' : ''} onClick={() => setSort(s)}>
                  {s === 'recent' ? 'Recent' : s === 'soonest' ? 'Soonest' : 'A–Z'}
                </button>
              ))}
            </div>
            <button className="chip" onClick={() => setView(view === 'list' ? 'grid' : 'list')}>
              {view === 'list' ? 'Grid' : 'List'}
            </button>
          </div>
          {grouped && groups.length > 1 && (
            <div className="row" style={{ marginTop: -8 }}>
              <button
                className="linkbtn"
                onClick={() => setCollapsed(allCollapsed ? new Set() : new Set([...collapsed, ...groups.map((g) => g.id)]))}
              >
                {allCollapsed ? 'Expand all' : 'Collapse all'}
              </button>
            </div>
          )}

          {count === 0 && <p className="empty">{starred && !q ? 'Star something to keep it here.' : 'Nothing saved matches that yet.'}</p>}
          {groups.map((g) =>
            grouped ? (
              <section key={g.id} className="sec" style={{ '--c': familyColor(g.type?.family) } as CSSProperties}>
                <button className="group-head" aria-expanded={!collapsed.has(g.id)} onClick={() => toggle(g.id)}>
                  <span className="dot" />
                  <span className="h3 ellipsis">{g.name}</span>
                  <span className="muted">{g.entries.length}</span>
                  <span className="chev" aria-hidden>
                    ▾
                  </span>
                </button>
                {!collapsed.has(g.id) && <Entries list={g.entries} view={view} />}
              </section>
            ) : (
              <Entries key={g.id} list={g.entries} view={view} />
            ),
          )}
        </>
      )}

      {filtering && (
        <Sheet onClose={() => setFiltering(false)}>
          <FilterSheetBody count={browsing ? count : shown.length} onDone={() => setFiltering(false)}>
            <div className="stack">
              <span className="label">How often</span>
              <div className="chips wrap">
                {OCCURRENCE.map(([o, label]) => (
                  <button
                    key={o}
                    className={`chip ${how.has(o) ? 'on' : ''}`}
                    onClick={() => {
                      const next = new Set(how);
                      if (next.has(o)) next.delete(o);
                      else next.add(o);
                      setHow(next);
                    }}
                  >
                    {label}
                  </button>
                ))}
                <button className={`chip ${freeOnly ? 'on' : ''}`} onClick={() => setFreeOnly(!freeOnly)}>
                  Free
                </button>
              </div>
            </div>
            <div className="stack">
              <span className="label">City</span>
              <div className="chips wrap">
                {cities.map((c) => (
                  <button key={c} className={`chip ${city === c ? 'on' : ''}`} onClick={() => setCity(city === c ? null : c)}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </FilterSheetBody>
        </Sheet>
      )}
    </div>
  );
}

function Entries({ list, view }: { list: Entry[]; view: 'list' | 'grid' }) {
  return view === 'list' ? (
    <div className="stack">
      {list.map((e) => (
        <EntryRow key={e.id} entry={e} attend={false} types star />
      ))}
    </div>
  ) : (
    <div className="listgrid">
      {list.map((e) => (
        <Link key={e.id} to={`/entry/${e.id}`} className="gridcard">
          <Poster entry={e} badge={<StarButton entry={e} className="on-poster" />} />
        </Link>
      ))}
    </div>
  );
}

function Inbox({ entries }: { entries: Entry[] }) {
  const groups: Issue[] = ['type', 'date', 'repeats', 'location'];
  return (
    <div className="screen enter">
      <div className="row">
        <Back to="/saved" />
        <h1 className="h2">Needs details</h1>
      </div>
      {groups.map((issue) => {
        const list = entries.filter((e) => issuesFor(e)[0] === issue);
        if (!list.length) return null;
        return (
          <section key={issue} className="sec">
            <div className="sec-head">
              <h2 className="h3">{ISSUE_LABEL[issue]}</h2>
              <span className="muted">{list.length}</span>
            </div>
            <div className="stack">
              {list.map((e) => (
                <Link key={e.id} to={`/entry/${e.id}/edit`} className="rowcard">
                  <span className="grow">
                    <span className="name ellipsis" style={{ display: 'block' }}>
                      {e.name}
                    </span>
                  </span>
                  <span className="muted">Edit</span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
