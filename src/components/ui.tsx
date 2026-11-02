import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { monthShort, parts } from '../lib/dates';
import { familyColor, familyOf } from '../lib/families';
import { placeLine } from '../lib/places';
import { whenText } from '../lib/schedule';
import { useStore } from '../lib/store';
import type { Entry, ISODate } from '../lib/types';

/** Colour variable for an entry, from its first event type's family. */
export function useEntryColor(entry: Entry): CSSProperties {
  const { typeMap } = useStore();
  return { '--c': familyColor(familyOf(entry.type_ids, typeMap)) } as CSSProperties;
}

export function Poster({ entry, badge, className = '' }: { entry: Entry; badge?: ReactNode; className?: string }) {
  const { typeMap } = useStore();
  const style = useEntryColor(entry);
  const type = entry.type_ids.map((id) => typeMap.get(id)?.name).find(Boolean);
  return (
    <div className={`poster ${className}`} style={style}>
      <div className="p-top">
        <span className="p-type">{type}</span>
        {badge}
      </div>
      <div className="p-name">{entry.name}</div>
    </div>
  );
}

export function where(entry: Entry): string {
  return entry.place ? placeLine(entry.place) : '';
}

export function AttendButton({ entry, date }: { entry: Entry; date: ISODate }) {
  const { planFor, toggleAttend, toast } = useStore();
  const on = !!planFor(entry, date);
  const style = useEntryColor(entry);
  return (
    <button
      className={`attend ${on ? 'on' : ''}`}
      style={style}
      aria-pressed={on}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleAttend(entry, date).catch((err) => toast(err.message));
      }}
    >
      {on ? 'Attending' : 'Attend'}
    </button>
  );
}

export function EntryRow({ entry, date, sub, attend = true }: { entry: Entry; date?: ISODate; sub?: string; attend?: boolean }) {
  const style = useEntryColor(entry);
  const line = sub ?? [whenText(entry, date), where(entry)].filter(Boolean).join(' · ');
  return (
    <Link to={`/entry/${entry.id}`} className="rowcard" style={style}>
      <span className="thumb" />
      <span className="grow">
        <span className="name ellipsis" style={{ display: 'block' }}>
          {entry.name}
        </span>
        <span className="sub ellipsis" style={{ display: 'block' }}>
          {line}
        </span>
      </span>
      {attend && date && <AttendButton entry={entry} date={date} />}
    </Link>
  );
}

export function DateTile({ date, color }: { date: ISODate; color?: string }) {
  return (
    <span className="datetile" style={color ? ({ '--c': color } as CSSProperties) : undefined}>
      <span className="m">{monthShort(date)}</span>
      <span className="d">{parts(date).d}</span>
    </span>
  );
}

export function Avatar({ name, url, size = '' }: { name: string | null; url?: string | null; size?: '' | 'sm' | 'xs' }) {
  return (
    <span className={`avatar ${size}`}>
      {url ? <img src={url} alt="" referrerPolicy="no-referrer" /> : (name ?? '?').slice(0, 1).toUpperCase()}
    </span>
  );
}

export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="handle" />
        {children}
      </div>
    </>
  );
}

export function BottomNav() {
  const tabs: [string, string][] = [
    ['/', 'Home'],
    ['/calendar', 'Calendar'],
    ['/map', 'Map'],
    ['/saved', 'Saved'],
  ];
  return (
    <nav className="nav" aria-label="Main">
      {tabs.map(([to, label]) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function Toast() {
  const { toastText } = useStore();
  return toastText ? (
    <div className="toast" role="status">
      {toastText}
    </div>
  ) : null;
}

export function Back({ to }: { to?: string }) {
  return (
    <Link
      to={to ?? '..'}
      className="back"
      aria-label="Back"
      onClick={(e) => {
        if (!to && window.history.length > 1) {
          e.preventDefault();
          window.history.back();
        }
      }}
    >
      ‹
    </Link>
  );
}
