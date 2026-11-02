import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ActiveFilters, FilterSheetBody } from '../components/FilterSheet';
import { SearchBar } from '../components/SearchBar';
import { Back, EntryRow, Poster, Sheet } from '../components/ui';
import { todayISO } from '../lib/dates';
import { issuesFor, ISSUE_LABEL, upcomingDates, type Issue } from '../lib/schedule';
import { useFiltered, useStore } from '../lib/store';
import type { Entry, Occurrence } from '../lib/types';

type Sort = 'recent' | 'soonest' | 'az';
const OCCURRENCE: [Occurrence, string][] = [
  ['once', 'Once'],
  ['repeats', 'Repeats'],
  ['run', 'For a run'],
  ['always', 'Always open'],
];

export default function Saved() {
  const { entries, typeMap } = useStore();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const inbox = params.has('inbox');
  const [sort, setSort] = useState<Sort>('recent');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [filtering, setFiltering] = useState(false);
  const [how, setHow] = useState<Set<Occurrence>>(new Set());
  const [freeOnly, setFreeOnly] = useState(false);
  const [city, setCity] = useState<string | null>(null);
  const today = todayISO();

  const typed = useFiltered(entries);
  const cities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) if (e.place?.city) counts.set(e.place.city, (counts.get(e.place.city) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([c]) => c);
  }, [entries]);

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

  const needing = useMemo(() => entries.filter((e) => issuesFor(e).length), [entries]);
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
      {needing.length > 0 && !q && (
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
        <button className="chip" onClick={() => setView(view === 'grid' ? 'list' : 'grid')}>
          {view === 'grid' ? 'List' : 'Grid'}
        </button>
      </div>

      {shown.length === 0 && <p className="empty">Nothing saved matches that yet.</p>}
      {view === 'grid' ? (
        <div className="listgrid">
          {shown.map((e) => (
            <Link key={e.id} to={`/entry/${e.id}`} className="gridcard">
              <Poster entry={e} />
            </Link>
          ))}
        </div>
      ) : (
        <div className="stack">
          {shown.map((e) => (
            <EntryRow key={e.id} entry={e} attend={false} />
          ))}
        </div>
      )}

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
