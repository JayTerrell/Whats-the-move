import { useEffect, useRef, useState } from 'react';
import { lookUp as findOnMap, placeLine, searchSaved, type FoundPlace } from '../lib/places';
import type { PlaceChoice } from '../lib/store';
import type { Place } from '../lib/types';

/** Venue, address or city. Suggests saved places as you type; looks the text up on the map when asked. */
export function PlacePicker({ value, onChange, initialQuery = '' }: {
  value: PlaceChoice;
  onChange: (v: PlaceChoice, text: string) => void;
  initialQuery?: string;
}) {
  const [text, setText] = useState(initialQuery);
  const [saved, setSaved] = useState<Place[]>([]);
  const [found, setFound] = useState<FoundPlace[] | null>(null);
  const [searching, setSearching] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (value.kind !== 'none') return;
    const t = window.setTimeout(() => searchSaved(text).then(setSaved), 250);
    return () => window.clearTimeout(t);
  }, [text, value.kind]);

  const lookUp = async (q = text) => {
    setSearching(true);
    setFound(await findOnMap(q).catch(() => []));
    setSearching(false);
  };

  // A Google Maps share arrives with the venue name and address: look it up once.
  useEffect(() => {
    if (initialQuery && !ran.current) {
      ran.current = true;
      lookUp(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  if (value.kind !== 'none') {
    const p = value.place;
    return (
      <div className="picked">
        <span className="grow">
          <span style={{ display: 'block', fontWeight: 600 }}>{p.name}</span>
          {placeLine(p) !== p.name && <span className="muted small">{placeLine(p)}</span>}
        </span>
        <button
          type="button"
          className="chip"
          onClick={() => {
            setText(p.name);
            setFound(null);
            onChange({ kind: 'none' }, p.name);
          }}
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <input
        className="input"
        value={text}
        placeholder="Venue, address or city"
        onChange={(e) => {
          setText(e.target.value);
          setFound(null);
          onChange({ kind: 'none' }, e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            lookUp();
          }
        }}
      />
      {(saved.length > 0 || text.trim().length > 1 || found) && (
        <div className="picklist">
          {saved.map((p) => (
            <button type="button" key={p.id} onClick={() => onChange({ kind: 'existing', place: p }, p.name)}>
              <span>{p.name}</span>
              <span className="muted small">{placeLine(p)}</span>
            </button>
          ))}
          {found?.map((p, i) => (
            <button type="button" key={i} onClick={() => onChange({ kind: 'new', place: p }, p.name)}>
              <span>{p.name}</span>
              <span className="muted small">{placeLine(p)}</span>
            </button>
          ))}
          {found?.length === 0 && (
            <button type="button" disabled>
              <span className="muted">No map results for “{text.trim()}”</span>
            </button>
          )}
          {!found && text.trim().length > 1 && (
            <button type="button" onClick={() => lookUp()} disabled={searching}>
              <span>{searching ? 'Searching…' : `Search the map for “${text.trim()}”`}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
