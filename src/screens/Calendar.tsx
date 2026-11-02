import { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ActiveFilters, FilterSheetBody } from '../components/FilterSheet';
import { AttendButton, EntryRow, Sheet, where } from '../components/ui';
import { addDays, formatDay, formatTime, monthGrid, parts, todayISO, WEEKDAY_SHORT, weekStart, weekday } from '../lib/dates';
import { FAMILIES, familyColor, familyOf } from '../lib/families';
import { activeOn, rootOf } from '../lib/schedule';
import { useFiltered, useStore } from '../lib/store';
import type { Entry, FamilyId, ISODate } from '../lib/types';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function CalendarScreen() {
  const { entries, plans, typeMap, filter, selectedDate, setSelectedDate } = useStore();
  const [mode, setMode] = useState<'week' | 'month'>('week');
  const [filtering, setFiltering] = useState(false);
  const [openAlways, setOpenAlways] = useState(false);
  const today = todayISO();
  const date = selectedDate;
  const visible = useFiltered(entries);
  const dated = useMemo(() => visible.filter((e) => e.occurrence === 'once' || e.occurrence === 'repeats'), [visible]);

  const planDates = useMemo(() => new Set(plans.map((p) => p.date)), [plans]);

  /** One dot per family with a one-time or repeating entry that day, in family order. */
  const dotsFor = (d: ISODate): FamilyId[] => {
    const fams = new Set<FamilyId>();
    for (const e of dated) {
      if (!activeOn(e, d)) continue;
      const f = familyOf(e.type_ids, typeMap);
      if (f) fams.add(f);
    }
    return FAMILIES.map((f) => f.id).filter((f) => fams.has(f));
  };

  const dayPlans = plans.filter(
    (p) => p.date === date && (!filter.size || p.stops.some((s) => s.entry.type_ids.some((t) => filter.has(t)))),
  );
  const planned = new Set(dayPlans.flatMap((p) => p.stops.map((s) => rootOf(s.entry))));
  const notPlanned = (e: Entry) => !planned.has(rootOf(e));
  const active = visible.filter((e) => activeOn(e, date) && notPlanned(e));
  const onDay = active.filter((e) => e.occurrence === 'once' || e.occurrence === 'repeats').sort(byTime);
  const running = active.filter((e) => e.occurrence === 'run');
  const always = active.filter((e) => e.occurrence === 'always').sort((a, b) => a.name.localeCompare(b.name));
  const count = dayPlans.length + onDay.length + running.length;

  const { y, m } = parts(date);
  const shift = (n: number) => {
    if (mode === 'week') setSelectedDate(addDays(date, n * 7));
    else {
      const idx = y * 12 + (m - 1) + n;
      setSelectedDate(`${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}-01`);
    }
  };

  return (
    <div className="screen enter">
      <div className="row spread">
        <h1 className="h2">{MONTHS[m - 1]}</h1>
        <div className="seg">
          <button className={mode === 'week' ? 'on' : ''} onClick={() => setMode('week')}>
            Week
          </button>
          <button className={mode === 'month' ? 'on' : ''} onClick={() => setMode('month')}>
            Month
          </button>
        </div>
      </div>

      <div className="row">
        <button className={`chip ${filter.size ? 'on' : ''}`} onClick={() => setFiltering(true)}>
          {filter.size ? `Filter · ${filter.size}` : 'Filter'}
        </button>
        {date !== today && (
          <button className="chip" onClick={() => setSelectedDate(today)}>
            Today
          </button>
        )}
      </div>
      <ActiveFilters />

      {mode === 'week' ? (
        <div className="week">
          <button className="arrow" aria-label="Previous week" onClick={() => shift(-1)}>
            ‹
          </button>
          <div className="days">
            {Array.from({ length: 7 }, (_, i) => addDays(weekStart(date), i)).map((d) => (
              <button
                key={d}
                className={`wday ${d === date ? 'on' : ''} ${planDates.has(d) ? 'plan' : ''}`}
                onClick={() => setSelectedDate(d)}
              >
                <span className="dow">{WEEKDAY_SHORT[weekday(d)]}</span>
                <span className="num">{parts(d).d}</span>
                <Dots families={dotsFor(d)} />
              </button>
            ))}
          </div>
          <button className="arrow" aria-label="Next week" onClick={() => shift(1)}>
            ›
          </button>
        </div>
      ) : (
        <div className="month">
          <div className="row spread" style={{ padding: '0 4px 10px' }}>
            <button className="chip" aria-label="Previous month" onClick={() => shift(-1)}>
              ‹
            </button>
            <span style={{ fontWeight: 700 }}>
              {MONTHS[m - 1]} {y}
            </span>
            <button className="chip" aria-label="Next month" onClick={() => shift(1)}>
              ›
            </button>
          </div>
          <div className="grid">
            {WEEKDAY_SHORT.map((d) => (
              <span key={d} className="dow">
                {d.slice(0, 1)}
              </span>
            ))}
            {monthGrid(y, m).map((d) => (
              <button
                key={d}
                className={`mday ${parts(d).m !== m ? 'out' : ''} ${d === today ? 'today' : ''} ${d === date ? 'on' : ''} ${planDates.has(d) ? 'plan' : ''}`}
                onClick={() => setSelectedDate(d)}
              >
                {parts(d).d}
                <Dots families={dotsFor(d)} />
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="muted">
        {date === today ? `Today, ${formatDay(date)}` : formatDay(date)} · {count} {count === 1 ? 'thing' : 'things'} on
      </p>

      {dayPlans.map((p) => {
        const first = p.stops[0]?.entry;
        if (!first) return null;
        const color = familyColor(familyOf(first.type_ids, typeMap));
        const time = p.stops[0].start_time ?? first.start_time;
        const with_ = p.members.length > 1 ? p.members.map((x) => x.name?.split(' ')[0]).join(', ') : null;
        return (
          <Link key={p.id} to={`/plan/${p.id}`} className="plancard" style={{ '--c': color } as CSSProperties}>
            <span className="row spread">
              <span className="badge dark">{p.members.length > 1 ? 'Going together' : "You're going"}</span>
              {time && <span style={{ fontWeight: 700 }}>{formatTime(time.slice(0, 5))}</span>}
            </span>
            <span className="pc-name">{p.stops.length > 1 ? `${first.name} + ${p.stops.length - 1}` : first.name}</span>
            <span className="pc-sub">{[where(first), with_].filter(Boolean).join(' · ')}</span>
            <span className="row" style={{ justifyContent: 'flex-end' }} onClick={(e) => e.preventDefault()}>
              <AttendButton entry={first} date={date} />
            </span>
          </Link>
        );
      })}

      {onDay.length > 0 && (
        <section className="stack">
          <span className="label">On this day</span>
          {onDay.map((e) => (
            <EntryRow key={e.id} entry={e} date={date} />
          ))}
        </section>
      )}

      {running.length > 0 && (
        <section className="stack">
          <span className="label">Running now</span>
          {running.map((e) => (
            <EntryRow key={e.id} entry={e} date={date} />
          ))}
        </section>
      )}

      {always.length > 0 && (
        <section className="stack" style={{ paddingBottom: 12 }}>
          <button className="fold" onClick={() => setOpenAlways(!openAlways)} aria-expanded={openAlways}>
            <span>
              <strong>{always.length} places</strong> <span className="muted">always open</span>
            </span>
            <span className="muted">{openAlways ? 'Hide' : 'Show'}</span>
          </button>
          {openAlways && always.map((e) => <EntryRow key={e.id} entry={e} date={date} />)}
        </section>
      )}

      {filtering && (
        <Sheet onClose={() => setFiltering(false)}>
          <FilterSheetBody count={count} onDone={() => setFiltering(false)} />
        </Sheet>
      )}
    </div>
  );
}

function Dots({ families }: { families: FamilyId[] }) {
  return (
    <span className="dots">
      {families.map((f) => (
        <i key={f} style={{ '--c': familyColor(f) } as CSSProperties} />
      ))}
    </span>
  );
}

const byTime = (a: Entry, b: Entry) => (a.start_time ?? '99').localeCompare(b.start_time ?? '99') || a.name.localeCompare(b.name);
