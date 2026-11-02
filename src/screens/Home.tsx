import { useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ActiveFilters, FilterSheetBody } from '../components/FilterSheet';
import { SearchBar } from '../components/SearchBar';
import { Avatar, DateTile, Poster, Sheet, where } from '../components/ui';
import { formatDay, formatTime, todayISO } from '../lib/dates';
import { familyColor, familyOf } from '../lib/families';
import { activeOn, rootOf, whenText } from '../lib/schedule';
import { useFiltered, useStore } from '../lib/store';
import type { Plan } from '../lib/types';
import Menu from './Menu';

export default function Home() {
  const { profile, entries, plans, lists, filter, typeMap, planFor } = useStore();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const today = todayISO();
  const visible = useFiltered(entries);

  const passes = (plan: Plan) =>
    !filter.size || plan.stops.some((s) => s.entry.type_ids.some((t) => filter.has(t)));
  const upcoming = plans.filter((p) => p.date >= today && passes(p)).slice(0, 6);

  const onToday = useMemo(() => {
    const planned = new Set(plans.filter((p) => p.date === today).flatMap((p) => p.stops.map((s) => rootOf(s.entry))));
    return visible
      .filter((e) => e.occurrence !== 'always' && activeOn(e, today))
      .sort((a, b) => Number(planned.has(rootOf(b))) - Number(planned.has(rootOf(a))));
  }, [visible, plans, today]);

  return (
    <div className="screen enter">
      <div className="row spread">
        <button className="row" onClick={() => setMenu(true)} aria-label="Menu">
          <Avatar name={profile?.name ?? null} url={profile?.avatar_url} />
          <span className="muted small">{formatDay(today)}</span>
        </button>
      </div>
      <h1 className="h1">What's the move?</h1>
      <div className="stack">
        <SearchBar
          value=""
          onChange={(q) => navigate(`/saved?q=${encodeURIComponent(q)}`)}
          onFilter={() => setFiltering(true)}
        />
        <ActiveFilters />
      </div>

      {onToday.length > 0 && (
        <section className="sec">
          <div className="sec-head">
            <h2 className="h3">On today</h2>
            <Link to="/calendar">Calendar</Link>
          </div>
          <div className="hscroll">
            {onToday.map((e) => {
              const going = !!planFor(e, today);
              const left = whenText(e, today);
              const badge = going ? 'Attending' : left === 'Last day' ? 'Last day' : null;
              return (
                <Link key={e.id} to={`/entry/${e.id}`} className="hcard">
                  <Poster entry={e} badge={badge && <span className="badge">{badge}</span>} />
                  <span className="name ellipsis">{e.name}</span>
                  <span className="muted small ellipsis">{[where(e), left].filter(Boolean).join(' · ')}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="sec">
          <div className="sec-head">
            <h2 className="h3">Your plans</h2>
          </div>
          <div className="stack">
            {upcoming.map((p) => {
              const first = p.stops[0]?.entry;
              if (!first) return null;
              const color = familyColor(familyOf(first.type_ids, typeMap));
              const time = p.stops[0].start_time ?? first.start_time;
              const others = p.members.filter((m) => m.user_id !== profile?.id).map((m) => m.name?.split(' ')[0]);
              const sub = [formatDay(p.date), time && formatTime(time.slice(0, 5)), others.length && `with ${others.join(', ')}`]
                .filter(Boolean)
                .join(' · ');
              return (
                <Link key={p.id} to={`/plan/${p.id}`} className="rowcard">
                  <DateTile date={p.date} color={color} />
                  <span className="grow">
                    <span className="name ellipsis" style={{ display: 'block' }}>
                      {p.stops.length > 1 ? `${first.name} + ${p.stops.length - 1}` : first.name}
                    </span>
                    <span className="sub ellipsis" style={{ display: 'block' }}>
                      {sub}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="sec">
        <div className="sec-head">
          <h2 className="h3">Your lists</h2>
          <Link to="/saved">Everything saved</Link>
        </div>
        <div className="hscroll">
          {lists.map((l, i) => (
            <Link
              key={l.id}
              to={`/lists/${l.id}`}
              className="collection"
              style={{ background: `color-mix(in oklch, ${familyColor(FAMILY_CYCLE[i % FAMILY_CYCLE.length])} 20%, var(--surface))` } as CSSProperties}
            >
              <span className="c-name">{l.name}</span>
              <span className="muted small">{l.entry_ids.length} saved</span>
            </Link>
          ))}
          <Link to="/lists" className="collection" style={{ justifyContent: 'center', alignItems: 'center' }}>
            <span className="c-name">+</span>
          </Link>
        </div>
      </section>

      {menu && <Menu onClose={() => setMenu(false)} />}
      {filtering && (
        <Sheet onClose={() => setFiltering(false)}>
          <FilterSheetBody count={onToday.length + upcoming.length} onDone={() => setFiltering(false)} />
        </Sheet>
      )}
    </div>
  );
}

const FAMILY_CYCLE = ['arts', 'music', 'food', 'outdoors', 'games', 'social'] as const;
