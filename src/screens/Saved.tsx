import { useMemo, useState, type CSSProperties } from 'react';
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
const STARRED = 'starred';

interface Group {
  id: string;
  name: string;
  type?: EventType;
  entries: Entry[];
}

/**
 * /saved            everything, grouped by event type, all folded (Starred first)
 * /saved?q=<text>   search results, grouped the same way and open
 * /saved?inbox      entries that need details
 */
export default function Saved() {
  const { entries, types, typeMap, filter } = useStore();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const inbox = params.has('inbox');
  const [sort, setSort] = useState<Sort>('recent');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [filtering, setFiltering] = useState(false);
  const [how, setHow] = useState<Set<Occurrence>>(new Set());
  const [freeOnly, setFreeOnly] = useState(false);
  const [city, setCity] = useState<string | null>(null);
  // Sections you've flipped from their default: folded when browsing, open when searching.
  const [flipped, setFlipped] = useState<{ browse: Set<string>; search: Set<string> }>({ browse: new Set(), search: new Set() });
  const today = todayISO();

  const typed = useFiltered(entries);
  const cities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) if (e.place?.city) counts.set(e.place.city, (counts.get(e.place.city) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([c]) => c);
  }, [entries]);

  // Everything that passes search and filters, sorted. Sections keep this order.
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

  const searching = !!q.trim() || filter.size > 0 || how.size > 0 || freeOnly || !!city;

  // Starred first, then one section per event type in family order. An entry with two types shows in both.
  const groups = useMemo(() => {
    const byType: Group[] = typesInOrder(types).map((t) => ({ id: t.id, name: t.name, type: t, entries: [] }));
    const byId = new Map(byType.map((g) => [g.id, g]));
    const untyped: Group = { id: NO_TYPE, name: 'No type', entries: [] };
    for (const e of shown) {
      const mine = e.type_ids.map((t) => byId.get(t)).filter((g) => !!g);
      if (mine.length) mine.forEach((g) => g.entries.push(e));
      else untyped.entries.push(e);
    }
    const starred: Group = { id: STARRED, name: 'Starred', entries: shown.filter((e) => e.starred_at) };
    return [starred, ...byType, untyped].filter((g) => g.entries.length || (g.id === STARRED && !searching));
  }, [types, shown, searching]);

  const needing = useMemo(() => entries.filter((e) => issuesFor(e).length), [entries]);

  const mode = searching ? 'search' : 'browse';
  const isOpen = (id: string) => (searching ? !flipped.search.has(id) : flipped.browse.has(id));
  const setOpen = (ids: string[], open: boolean) => {
    const next = new Set(flipped[mode]);
    ids.forEach((id) => (open === searching ? next.delete(id) : next.add(id)));
    setFlipped({ ...flipped, [mode]: next });
  };
  const anyOpen = groups.some((g) => isOpen(g.id));

  const setQ = (v: string) => setParams(v ? { q: v } : {}, { replace: true });

  if (inbox) return <Inbox entries={needing} />;

  return (
    <div className="screen enter">
      <div className="row spread">
        <h1 className="h2">Saved</h1>
        <span className="muted">{shown.length}</span>
      </div>
      <div className="stack">
        <SearchBar value={q} onChange={setQ} onFilter={() => setFiltering(true)} autoFocus={!!q} />
        <ActiveFilters />
      </div>
      {needing.length > 0 && !searching && (
        <Link to="/saved?inbox" className="banner">
          <span>{needing.length} need details</span>
          <span>›</span>
        </Link>
      )}
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
      {groups.length > 1 && (
        <div className="row" style={{ marginTop: -8 }}>
          <button className="linkbtn" onClick={() => setOpen(groups.map((g) => g.id), !anyOpen)}>
            {anyOpen ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
      )}

      {shown.length === 0 && <p className="empty">Nothing saved matches that yet.</p>}
      <div className="stack" style={{ gap: 4 }}>
        {groups.map((g) => {
          const open = isOpen(g.id);
          const star = g.id === STARRED;
          return (
            <section
              key={g.id}
              className="sec"
              style={{ '--c': star ? 'var(--f-outdoors)' : familyColor(g.type?.family), paddingBottom: open ? 12 : 0 } as CSSProperties}
            >
              <button className="group-head" aria-expanded={open} onClick={() => setOpen([g.id], !open)}>
                {star ? (
                  <span className="star on" style={{ width: 'auto', height: 'auto', fontSize: 15 }} aria-hidden>
                    ★
                  </span>
                ) : (
                  <span className="dot" />
                )}
                <span className="h3 ellipsis">{g.name}</span>
                <span className="muted">{g.entries.length}</span>
                <span className="chev" aria-hidden>
                  ▾
                </span>
              </button>
              {open &&
                (g.entries.length ? (
                  <Entries list={g.entries} view={view} />
                ) : (
                  <p className="muted small">Star something to keep it here.</p>
                ))}
            </section>
          );
        })}
      </div>

      {filtering && (
        <Sheet onClose={() => setFiltering(false)}>
          <FilterSheetBody count={shown.length} onDone={() => setFiltering(false)}>
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
