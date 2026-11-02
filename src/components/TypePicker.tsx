import { useState, type CSSProperties } from 'react';
import { FAMILIES, familyColor } from '../lib/families';
import { useStore } from '../lib/store';
import type { FamilyId } from '../lib/types';
import { Sheet } from './ui';

/** Pick one or more event types; the first one picked sets the entry's colour. */
export function TypePicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { types, typeMap, addType, toast } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [family, setFamily] = useState<FamilyId | null>(null);

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <>
      <button type="button" className="input" style={{ textAlign: 'left', display: 'flex', flexWrap: 'wrap', gap: 6 }} onClick={() => setOpen(true)}>
        {value.length === 0 && <span className="muted">Choose event types</span>}
        {value.map((id) => {
          const t = typeMap.get(id);
          return t ? (
            <span key={id} className="tag" style={{ '--c': familyColor(t.family) } as CSSProperties}>
              {t.name}
            </span>
          ) : null;
        })}
      </button>
      {open && (
        <Sheet onClose={() => setOpen(false)}>
          <h2 className="h3">Event type</h2>
          {FAMILIES.map((f) => (
            <div key={f.id} className="stack" style={{ '--c': familyColor(f.id) } as CSSProperties}>
              <span className="row">
                <span className="dot" />
                <span style={{ fontWeight: 700 }}>{f.name}</span>
              </span>
              <div className="chips wrap">
                {types
                  .filter((t) => t.family === f.id)
                  .map((t) => (
                    <button key={t.id} type="button" className={`chip ${value.includes(t.id) ? 'on' : ''}`} onClick={() => toggle(t.id)}>
                      {t.name}
                    </button>
                  ))}
              </div>
            </div>
          ))}
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim() || !family) return;
              try {
                const t = await addType(name, family);
                onChange([...value, t.id]);
                setName('');
                setFamily(null);
              } catch (err) {
                toast((err as Error).message);
              }
            }}
          >
            <span className="label">New type</span>
            <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            {name.trim() && (
              <div className="chips wrap">
                {FAMILIES.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`chip ${family === f.id ? 'on' : ''}`}
                    style={{ '--c': familyColor(f.id) } as CSSProperties}
                    onClick={() => setFamily(f.id)}
                  >
                    <span className="dot" />
                    {f.name}
                  </button>
                ))}
              </div>
            )}
            {name.trim() && family && <button className="btn">Add {name.trim()}</button>}
          </form>
          <div className="sheet-foot">
            <span className="grow" />
            <button type="button" className="btn light" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}
