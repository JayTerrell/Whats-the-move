import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ActiveFilters, FilterSheetBody } from '../components/FilterSheet';
import { SearchBar } from '../components/SearchBar';
import { Avatar, DateTile, Poster, Sheet, where } from '../components/ui';
import { addDays, diffDays, formatDay, formatShort, formatTime, todayISO, WEEKDAY_SHORT, weekday } from '../lib/dates';
import { familyColor, familyOf } from '../lib/families';
import { activeOn, rootOf, whenText } from '../lib/schedule';
import { useFiltered, useStore } from '../lib/store';
import type { Entry, ISODate, Plan } from '../lib/types';
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

  const feed = useFeed(visible, today);
  const onToday = useMemo(() => {
    const planned = new Set(plans.filter((p) => p.date === today).flatMap((p) => p.stops.map((s) => rootOf(s.entry))));
    return [...feed.today].sort((a, b) => Number(planned.has(rootOf(b))) - Number(planned.has(rootOf(a))));
  }, [feed.today, plans, today]);

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

      <Rail title={feed.weekendTitle}>
        {feed.weekend.map(({ entry, date }) => (
          <Card key={entry.id} entry={entry} date={date} badge={WEEKDAY_SHORT[weekday(date)]} />
        ))}
      </Rail>

      <Rail title="Ending soon">
        {feed.ending.map((e) => {
          const left = diffDays(today, e.end_date!);
          return <Card key={e.id} entry={e} badge={left === 0 ? 'Last day' : `${left} day${left === 1 ? '' : 's'} left`} />;
        })}
      </Rail>

      <Rail title="Coming up" link={<Link to="/calendar">Calendar</Link>}>
        {feed.coming.map(({ entry, date }) => (
          <Card key={entry.id} entry={entry} date={date} badge={formatShort(date)} />
        ))}
      </Rail>

      <Rail title="Starred" link={<Link to="/saved">Saved</Link>}>
        {feed.starred.map((e) => (
          <Card key={e.id} entry={e} />
        ))}
      </Rail>

      <Rail title="Just saved">
        {feed.recent.map((e) => (
          <Card key={e.id} entry={e} />
        ))}
      </Rail>

      <Rail title="Always open">
        {feed.always.map((e) => (
          <Card key={e.id} entry={e} />
        ))}
      </Rail>

      <section className="sec">
        <div className="sec-head">
          <h2 className="h3">Your lists</h2>
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
          <FilterSheetBody count={feed.count} onDone={() => setFiltering(false)} />
        </Sheet>
      )}
    </div>
  );
}

const FAMILY_CYCLE = ['arts', 'music', 'food', 'outdoors', 'games', 'social'] as const;

const DATED_DAYS = 30; // how far ahead "Coming up" looks
const RAIL = 12; // cards per section

/** First date within the next `days` days (from `from`, inclusive) the entry is on. */
function firstDate(entry: Entry, from: ISODate, days: number): ISODate | null {
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i);
    if (activeOn(entry, d)) return d;
  }
  return null;
}

/** The next run of Fri–Sun after today (today itself belongs to On today). */
function weekendDays(today: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let i = 1; i <= 7; i++) {
    const d = addDays(today, i);
    const w = weekday(d);
    if (w === 5 || w === 6 || w === 0) out.push(d);
    else if (out.length) break;
  }
  return out;
}

/** Same order all day, a new order tomorrow. */
function dailyShuffle<T extends { id: string }>(list: T[], seed: string): T[] {
  const hash = (s: string) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  };
  return [...list].sort((a, b) => hash(seed + a.id) - hash(seed + b.id));
}

/** Home's sections. Dated sections don't repeat an entry; Starred, Just saved and Always open can. */
function useFeed(visible: Entry[], today: ISODate) {
  return useMemo(() => {
    const dated = visible.filter((e) => e.occurrence !== 'always');
    const shown = new Set<string>();
    const take = <T,>(list: T[], id: (x: T) => string) => {
      const out = list.filter((x) => !shown.has(id(x))).slice(0, RAIL);
      out.forEach((x) => shown.add(id(x)));
      return out;
    };

    const todayList = take(dated.filter((e) => activeOn(e, today)), (e) => e.id);

    const days = weekendDays(today);
    const weekendTitle = weekday(today) === 0 ? 'Next weekend' : 'This weekend';
    const weekend = take(
      dated.flatMap((entry) => {
        const date = days.find((d) => activeOn(entry, d));
        return date ? [{ entry, date }] : [];
      }).sort((a, b) => a.date.localeCompare(b.date) || (a.entry.start_time ?? '99').localeCompare(b.entry.start_time ?? '99')),
      (x) => x.entry.id,
    );

    const ending = take(
      dated
        .filter((e) => e.occurrence === 'run' && e.end_date && e.start_date && e.start_date <= today && diffDays(today, e.end_date) >= 0 && diffDays(today, e.end_date) <= 21)
        .sort((a, b) => a.end_date!.localeCompare(b.end_date!)),
      (e) => e.id,
    );

    const coming = take(
      dated
        .flatMap((entry) => {
          const date = firstDate(entry, addDays(today, 1), DATED_DAYS);
          return date ? [{ entry, date }] : [];
        })
        .sort((a, b) => a.date.localeCompare(b.date)),
      (x) => x.entry.id,
    );

    const starred = visible
      .filter((e) => e.starred_at)
      .sort((a, b) => (b.starred_at ?? '').localeCompare(a.starred_at ?? ''))
      .slice(0, RAIL);
    const weekAgo = addDays(today, -7);
    const recent = visible.filter((e) => e.created_at.slice(0, 10) >= weekAgo).slice(0, RAIL);
    const always = dailyShuffle(
      visible.filter((e) => e.occurrence === 'always' && activeOn(e, today) && e.place),
      today,
    ).slice(0, RAIL);

    const count = new Set([...shown, ...starred.map((e) => e.id), ...recent.map((e) => e.id), ...always.map((e) => e.id)]).size;
    return { today: todayList, weekend, weekendTitle, ending, coming, starred, recent, always, count };
  }, [visible, today]);
}

function Rail({ title, link, children }: { title: string; link?: ReactNode; children: ReactNode[] }) {
  if (!children.length) return null;
  return (
    <section className="sec">
      <div className="sec-head">
        <h2 className="h3">{title}</h2>
        {link}
      </div>
      <div className="hscroll">{children}</div>
    </section>
  );
}

function Card({ entry, date, badge }: { entry: Entry; date?: ISODate; badge?: string }) {
  const { planFor } = useStore();
  const going = !!(date && planFor(entry, date));
  const label = going ? 'Attending' : badge;
  const sub = [where(entry), date ? null : whenText(entry)].filter(Boolean).join(' · ');
  return (
    <Link to={`/entry/${entry.id}`} className="hcard">
      <Poster entry={entry} badge={label && <span className="badge">{label}</span>} />
      <span className="name ellipsis">{entry.name}</span>
      <span className="muted small ellipsis">{sub || '\u00a0'}</span>
    </Link>
  );
}
