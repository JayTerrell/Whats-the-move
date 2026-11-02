import { useState, type CSSProperties } from 'react';
import { Back } from '../components/ui';
import { FAMILIES, familyColor } from '../lib/families';
import { useStore } from '../lib/store';
import type { FamilyId } from '../lib/types';

export default function TypesScreen() {
  const { types, addType, deleteType, toast } = useStore();
  const [name, setName] = useState('');
  const [family, setFamily] = useState<FamilyId | null>(null);
  return (
    <div className="screen enter">
      <div className="row">
        <Back />
        <h1 className="h2">Event types</h1>
      </div>
      {FAMILIES.map((f) => (
        <section key={f.id} className="stack" style={{ '--c': familyColor(f.id) } as CSSProperties}>
          <span className="row">
            <span className="dot" />
            <span style={{ fontWeight: 700 }}>{f.name}</span>
          </span>
          <div className="chips wrap">
            {types
              .filter((t) => t.family === f.id)
              .map((t) =>
                t.owner_id ? (
                  <button key={t.id} className="chip" onClick={() => deleteType(t.id).catch((e) => toast(e.message))}>
                    {t.name} <span className="x">×</span>
                  </button>
                ) : (
                  <span key={t.id} className="chip">
                    {t.name}
                  </span>
                ),
              )}
          </div>
        </section>
      ))}
      <form
        className="stack"
        style={{ paddingBottom: 12 }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim() || !family) return;
          try {
            await addType(name, family);
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
        {name.trim() && family && <button className="btn light">Add {name.trim()}</button>}
      </form>
    </div>
  );
}
