import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { PlacePicker } from '../components/PlacePicker';
import { TypePicker } from '../components/TypePicker';
import { lookUp } from '../lib/places';
import { describeRule, parseRule } from '../lib/recurrence';
import { readShare } from '../lib/share';
import { useStore, type PlaceChoice } from '../lib/store';
import type { Entry, Occurrence } from '../lib/types';

const HOW: [Occurrence, string][] = [
  ['once', 'Once'],
  ['repeats', 'Repeats'],
  ['run', 'For a run'],
  ['always', 'Always open'],
];

export default function EntryForm() {
  const { id } = useParams();
  const { entries } = useStore();
  const location = useLocation();
  const existing = id ? entries.find((e) => e.id === id) : undefined;
  const shared = useMemo(
    () => (location.pathname === '/share' ? readShare(new URLSearchParams(location.search)) : null),
    [location.pathname, location.search],
  );
  if (id && !existing) {
    return (
      <div className="screen">
        <Link to="/" className="back">
          ‹
        </Link>
      </div>
    );
  }
  return <Form key={id ?? 'new'} existing={existing} shared={shared} />;
}

function Form({ existing, shared }: { existing?: Entry; shared: ReturnType<typeof readShare> | null }) {
  const { saveEntry, toast } = useStore();
  const navigate = useNavigate();
  const [name, setName] = useState(existing?.name ?? shared?.name ?? '');
  const [typeIds, setTypeIds] = useState<string[]>(existing?.type_ids ?? []);
  const [place, setPlace] = useState<PlaceChoice>(existing?.place ? { kind: 'existing', place: existing.place } : { kind: 'none' });
  const [placeText, setPlaceText] = useState(shared?.location ?? '');
  const [how, setHow] = useState<Occurrence>(existing?.occurrence ?? 'once');
  const [start, setStart] = useState(existing?.start_date ?? '');
  const [end, setEnd] = useState(existing?.end_date ?? '');
  const [time, setTime] = useState(existing?.start_time?.slice(0, 5) ?? '');
  const [repeats, setRepeats] = useState(existing?.repeats ?? '');
  const [free, setFree] = useState(existing?.free ?? false);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const sourceUrl = existing?.source_url ?? shared?.url ?? null;

  const rule = parseRule(repeats);
  const errors = {
    name: !name.trim() ? 'Add a name.' : '',
    repeats: how === 'repeats' && repeats.trim() && !rule ? 'Try “every Friday” or “1st & 3rd Monday”.' : '',
    end: (how === 'run' || how === 'repeats') && start && end && end < start ? 'Ends before it starts.' : '',
  };
  const invalid = Object.values(errors).some(Boolean);

  const save = async () => {
    setTried(true);
    if (invalid) return;
    setSaving(true);
    try {
      let choice = place;
      if (choice.kind === 'none' && placeText.trim()) {
        const [hit] = await lookUp(placeText).catch(() => []);
        choice = {
          kind: 'new',
          place: hit ?? { name: placeText.trim(), address: null, city: null, lat: null, lng: null, precision: 'address' },
        };
      }
      const entry = await saveEntry(
        {
          name,
          type_ids: typeIds,
          place: choice,
          occurrence: how,
          start_date: how === 'always' ? null : start || null,
          end_date: how === 'run' || how === 'repeats' ? end || null : null,
          start_time: how === 'run' || how === 'always' ? null : time || null,
          repeats: how === 'repeats' ? repeats : null,
          free,
          source_url: sourceUrl,
        },
        existing?.id,
      );
      toast('Saved');
      navigate(`/entry/${entry.id}`, { replace: true });
    } catch (e) {
      toast((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="screen enter">
      <div className="row spread">
        <button className="linkbtn" style={{ textDecoration: 'none' }} onClick={() => navigate(-1)}>
          Cancel
        </button>
        <h1 className="h3">{existing ? 'Edit' : 'New entry'}</h1>
        <button className="btn primary" style={{ padding: '10px 18px' }} disabled={saving} onClick={save}>
          Save
        </button>
      </div>

      {sourceUrl && !existing && (
        <div className="linkcard">
          <span className="srctile">{(shared?.source ?? 'Link').slice(0, 2).toUpperCase()}</span>
          <span className="grow mono ellipsis">{sourceUrl.replace(/^https?:\/\/(www\.)?/, '')}</span>
        </div>
      )}

      <label className="field">
        <span>Name</span>
        <input
          className={`input ${tried && errors.name ? 'error' : ''}`}
          value={name}
          autoFocus={!existing && !name}
          onChange={(e) => setName(e.target.value)}
        />
        {tried && errors.name && <span className="err">{errors.name}</span>}
      </label>

      <div className="field">
        <span>Event type</span>
        <TypePicker value={typeIds} onChange={setTypeIds} />
      </div>

      <div className="field">
        <span>Location</span>
        <PlacePicker
          value={place}
          initialQuery={shared?.location}
          onChange={(v, text) => {
            setPlace(v);
            setPlaceText(text);
          }}
        />
      </div>

      <div className="field">
        <span>How often</span>
        <div className="seg full">
          {HOW.map(([o, label]) => (
            <button key={o} type="button" className={how === o ? 'on' : ''} onClick={() => setHow(o)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {how === 'once' && (
        <div className="two">
          <label className="field">
            <span>Date</span>
            <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="field">
            <span>Time</span>
            <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
      )}

      {how === 'repeats' && (
        <>
          <label className="field">
            <span>Repeats</span>
            <input
              className={`input ${tried && errors.repeats ? 'error' : ''}`}
              placeholder="every other Thursday"
              value={repeats}
              onChange={(e) => setRepeats(e.target.value)}
            />
            {rule ? <span className="hint-ok">{describeRule(rule)}</span> : errors.repeats && <span className="err">{errors.repeats}</span>}
          </label>
          <label className="field">
            <span>Time</span>
            <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
          <div className="two">
            <label className="field">
              <span>Starts</span>
              <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="field">
              <span>Ends</span>
              <input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>
        </>
      )}

      {how === 'run' && (
        <div className="two">
          <label className="field">
            <span>Opens</span>
            <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="field">
            <span>Closes</span>
            <input className={`input ${errors.end ? 'error' : ''}`} type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
      )}
      {errors.end && <span className="err">{errors.end}</span>}

      <div className="field" style={{ paddingBottom: 12 }}>
        <span>Free</span>
        <div className="seg full">
          <button type="button" className={free ? 'on' : ''} onClick={() => setFree(true)}>
            Free
          </button>
          <button type="button" className={!free ? 'on' : ''} onClick={() => setFree(false)}>
            Paid or unsure
          </button>
        </div>
      </div>
    </div>
  );
}
