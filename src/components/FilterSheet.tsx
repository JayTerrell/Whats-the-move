import type { CSSProperties, ReactNode } from 'react';
import { FAMILIES, familyColor } from '../lib/families';
import { useStore } from '../lib/store';

/** Pick any number of event types, grouped by family. Tapping a family toggles all its types. */
export function FilterSheetBody({ count, onDone, children }: { count: number; onDone: () => void; children?: ReactNode }) {
  const { types, filter, setFilter } = useStore();
  const toggle = (ids: string[], on: boolean) => {
    const next = new Set(filter);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    setFilter(next);
  };
  return (
    <>
      <h2 className="h3">Filter</h2>
      {FAMILIES.map((f) => {
        const ids = types.filter((t) => t.family === f.id).map((t) => t.id);
        if (!ids.length) return null;
        const all = ids.every((id) => filter.has(id));
        return (
          <div key={f.id} className="stack" style={{ '--c': familyColor(f.id) } as CSSProperties}>
            <button className="row" onClick={() => toggle(ids, !all)} aria-pressed={all}>
              <span className="dot" />
              <span style={{ fontWeight: 700 }}>{f.name}</span>
              <span className="muted small">{all ? 'All' : ''}</span>
            </button>
            <div className="chips wrap">
              {types
                .filter((t) => t.family === f.id)
                .map((t) => (
                  <button
                    key={t.id}
                    className={`chip ${filter.has(t.id) ? 'on' : ''}`}
                    aria-pressed={filter.has(t.id)}
                    onClick={() => toggle([t.id], !filter.has(t.id))}
                  >
                    {t.name}
                  </button>
                ))}
            </div>
          </div>
        );
      })}
      {children}
      <div className="sheet-foot">
        <button className="linkbtn" onClick={() => setFilter(new Set())}>
          Clear
        </button>
        <span className="grow" />
        <button className="btn light" onClick={onDone}>
          Show {count}
        </button>
      </div>
    </>
  );
}

/** The chosen types as small removable chips under the search bar. */
export function ActiveFilters() {
  const { filter, setFilter, typeMap } = useStore();
  if (!filter.size) return null;
  return (
    <div className="chips">
      {[...filter].map((id) => {
        const t = typeMap.get(id);
        if (!t) return null;
        return (
          <button
            key={id}
            className="chip"
            style={{ '--c': familyColor(t.family) } as CSSProperties}
            onClick={() => {
              const next = new Set(filter);
              next.delete(id);
              setFilter(next);
            }}
          >
            <span className="dot" />
            {t.name}
            <span className="x">×</span>
          </button>
        );
      })}
    </div>
  );
}
