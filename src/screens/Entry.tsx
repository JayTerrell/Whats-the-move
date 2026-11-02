import { useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Back, Sheet, StarButton, useEntryColor } from '../components/ui';
import { formatDay, monthShort, parts, todayISO, WEEKDAY_SHORT, weekday } from '../lib/dates';
import { familyColor } from '../lib/families';
import { googleMapsUrl, placeLine } from '../lib/places';
import { upcomingDates, whenText } from '../lib/schedule';
import { sourceName } from '../lib/share';
import { useStore } from '../lib/store';
import type { Entry } from '../lib/types';

const KIND: Record<Entry['occurrence'], string> = { once: 'Event', repeats: 'Repeats', run: 'Limited run', always: 'Always open' };

export default function EntryScreen() {
  const { id } = useParams();
  const { entries, plans, user } = useStore();
  const entry = entries.find((e) => e.id === id) ?? plans.flatMap((p) => p.stops.map((s) => s.entry)).find((e) => e.id === id);
  if (!entry) {
    return (
      <div className="screen">
        <Back to="/" />
        <p className="empty">This entry isn't in your account.</p>
      </div>
    );
  }
  return <EntryView key={entry.id} entry={entry} mine={entry.owner_id === user?.id} />;
}

function EntryView({ entry, mine }: { entry: Entry; mine: boolean }) {
  const { typeMap, planFor, toggleAttend, inviteLink, lists, toggleInList, createList, deleteEntry, toast, profile } = useStore();
  const navigate = useNavigate();
  const today = todayISO();
  const dates = useMemo(() => upcomingDates(entry, today, 7), [entry, today]);
  const [date, setDate] = useState(dates[0] ?? null);
  const [listsOpen, setListsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newList, setNewList] = useState('');
  const color = useEntryColor(entry);
  const plan = date ? planFor(entry, date) : undefined;
  const others = plan?.members.filter((m) => m.user_id !== profile?.id) ?? [];

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const invite = () =>
    run(async () => {
      if (!date) return;
      const url = await inviteLink(entry, date);
      const text = `${entry.name} · ${formatDay(date)}`;
      if (navigator.share) {
        await navigator.share({ title: entry.name, text, url }).catch(() => {});
      } else {
        await navigator.clipboard.writeText(url);
        toast('Invite link copied');
      }
    });

  const city = entry.place?.city;

  return (
    <div className="screen enter" style={{ paddingTop: 14 }}>
      <div className="hero" style={{ position: 'relative' }}>
        <div className="hero-bar">
          <Back />
          {mine && <StarButton entry={entry} className="on-hero" />}
        </div>
        <div className="poster" style={color}>
          <div className="tags">
            {entry.type_ids.map((t) => {
              const type = typeMap.get(t);
              return type ? (
                <span key={t} className="badge dark" style={{ '--c': familyColor(type.family) } as CSSProperties}>
                  {type.name}
                </span>
              ) : null;
            })}
            <span className="badge">{KIND[entry.occurrence]}</span>
            {entry.free && <span className="badge">Free</span>}
          </div>
        </div>
      </div>

      <h1 className="h2">{entry.name}</h1>

      <div className="stack" style={{ gap: 12 }}>
        <div className="info">
          <span className="tile">
            {entry.occurrence === 'once' && entry.start_date ? (
              <>
                {monthShort(entry.start_date).toUpperCase()}
                <br />
                {parts(entry.start_date).d}
              </>
            ) : (
              '◷'
            )}
          </span>
          <span>{whenText(entry, today)}</span>
        </div>
        {entry.place && (
          <a className="info" href={googleMapsUrl(entry.place, entry.name)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
            <span className="tile">{(city ?? entry.place.name).slice(0, 2).toUpperCase()}</span>
            <span className="grow">{placeLine(entry.place)}</span>
            <span className="muted small">Maps ↗</span>
          </a>
        )}
      </div>

      {dates.length > 0 && (
        <div className="stack">
          <span className="label">{entry.occurrence === 'always' ? 'Go on' : 'Coming up'}</span>
          <div className="chips" style={color}>
            {dates.map((d) => (
              <button
                key={d}
                className={`chip ${d === date ? 'on' : ''}`}
                style={planFor(entry, d) ? { boxShadow: 'inset 0 0 0 2px var(--c)' } : undefined}
                onClick={() => setDate(d)}
              >
                {d === today ? 'Today' : `${WEEKDAY_SHORT[weekday(d)]} ${parts(d).d}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {date && (
        <div className="two">
          <button
            className="btn"
            disabled={busy}
            style={plan ? ({ ...color, background: 'var(--c)', color: 'var(--ink)' } as CSSProperties) : undefined}
            onClick={() => run(() => toggleAttend(entry, date))}
          >
            {plan ? 'Attending' : 'Attend'}
          </button>
          <button className="btn light" disabled={busy} onClick={invite}>
            Invite
          </button>
        </div>
      )}

      {plan && others.length > 0 && (
        <Link to={`/plan/${plan.id}`} className="rowcard">
          <span className="grow">
            <span className="name" style={{ display: 'block' }}>
              {formatDay(plan.date)} with {others.map((m) => m.name?.split(' ')[0]).join(', ')}
            </span>
          </span>
          <span className="muted">›</span>
        </Link>
      )}

      {mine && (
        <div className="stack">
          <span className="label">Lists</span>
          <div className="chips wrap">
            {lists
              .filter((l) => l.entry_ids.includes(entry.id))
              .map((l) => (
                <button key={l.id} className="chip on" onClick={() => run(() => toggleInList(l.id, entry.id))}>
                  {l.name}
                </button>
              ))}
            <button className="chip" onClick={() => setListsOpen(true)}>
              + Add to list
            </button>
          </div>
        </div>
      )}

      <div className="stack" style={{ gap: 14, paddingBottom: 12 }}>
        {entry.source_url && (
          <a className="row spread small" href={entry.source_url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
            <span className="muted">
              {sourceName(entry.source_url)} · Saved {formatDay(entry.created_at.slice(0, 10))}
            </span>
            <span>Open original ↗</span>
          </a>
        )}
        {mine && (
          <div className="two">
            <Link to={`/entry/${entry.id}/edit`} className="btn">
              Edit
            </Link>
            <button className="btn danger" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          </div>
        )}
      </div>

      {listsOpen && (
        <Sheet onClose={() => setListsOpen(false)}>
          <h2 className="h3">Add to list</h2>
          <div className="chips wrap">
            {lists.map((l) => {
              const on = l.entry_ids.includes(entry.id);
              return (
                <button key={l.id} className={`chip ${on ? 'on' : ''}`} onClick={() => run(() => toggleInList(l.id, entry.id))}>
                  {l.name}
                </button>
              );
            })}
          </div>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newList.trim()) return;
              run(async () => {
                const list = await createList(newList);
                await toggleInList(list.id, entry.id);
                setNewList('');
              });
            }}
          >
            <input className="input grow" placeholder="New list" value={newList} onChange={(e) => setNewList(e.target.value)} />
            <button className="btn light" disabled={!newList.trim()}>
              Add
            </button>
          </form>
        </Sheet>
      )}

      {confirmDelete && (
        <Sheet onClose={() => setConfirmDelete(false)}>
          <h2 className="h3">Delete {entry.name}?</h2>
          <div className="two">
            <button className="btn" onClick={() => setConfirmDelete(false)}>
              Keep
            </button>
            <button
              className="btn primary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await deleteEntry(entry.id);
                  toast('Deleted');
                  navigate('/saved', { replace: true });
                })
              }
            >
              Delete
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
