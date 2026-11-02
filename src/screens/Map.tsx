import { AdvancedMarker, APIProvider, Map as GoogleMap, useMap } from '@vis.gl/react-google-maps';
import { MarkerClusterer, type Renderer } from '@googlemaps/markerclusterer';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ActiveFilters, FilterSheetBody } from '../components/FilterSheet';
import { EntryRow, Sheet } from '../components/ui';
import { addDays, formatDay, todayISO } from '../lib/dates';
import { familyColor, familyOf } from '../lib/families';
import { activeOn } from '../lib/schedule';
import { useFiltered, useStore } from '../lib/store';
import type { Entry, Place } from '../lib/types';

type View = 'all' | 'on' | 'plans';
const DFW = { lat: 32.83, lng: -96.93 };

export default function MapScreen() {
  return (
    <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
      <MapBody />
    </APIProvider>
  );
}

function MapBody() {
  const { entries, plans, filter, selectedDate, setSelectedDate } = useStore();
  const [view, setView] = useState<View>('all');
  const [open, setOpen] = useState<{ entries: Entry[]; title?: string } | null>(null);
  const [filtering, setFiltering] = useState(false);
  const date = selectedDate;
  const visible = useFiltered(entries);

  const stops = useMemo(
    () =>
      plans
        .filter((p) => p.date === date)
        .flatMap((p) => p.stops.map((s) => s.entry))
        .filter((e) => !filter.size || e.type_ids.some((t) => filter.has(t))),
    [plans, date, filter],
  );
  const shown = view === 'plans' ? stops : view === 'on' ? visible.filter((e) => activeOn(e, date)) : visible;
  const mapped = shown.filter((e) => e.place?.lat != null);
  const exact = mapped.filter((e) => e.place!.precision === 'address');
  const cities = useMemo(() => {
    const groups = new Map<string, { place: Place; entries: Entry[] }>();
    for (const e of mapped) {
      if (e.place!.precision !== 'city') continue;
      const g = groups.get(e.place!.id) ?? { place: e.place!, entries: [] };
      g.entries.push(e);
      groups.set(e.place!.id, g);
    }
    return [...groups.values()];
  }, [mapped]);

  return (
    <>
      <div className="mapwrap">
        <GoogleMap
          mapId={import.meta.env.VITE_GOOGLE_MAP_ID}
          defaultCenter={DFW}
          defaultZoom={9}
          disableDefaultUI
          gestureHandling="greedy"
          clickableIcons={false}
          colorScheme="DARK"
          onClick={() => setOpen(null)}
          style={{ width: '100%', height: '100%' }}
        >
          <Pins entries={exact} numbered={view === 'plans'} onPick={(e) => setOpen({ entries: [e] })} />
          {cities.map(({ place, entries: list }) => (
            <AdvancedMarker
              key={place.id}
              position={{ lat: place.lat!, lng: place.lng! }}
              onClick={() => setOpen({ entries: list, title: place.city ?? place.name })}
              zIndex={1}
            >
              <span className="citypin">
                {place.city ?? place.name} · {list.length}
              </span>
            </AdvancedMarker>
          ))}
          {view === 'plans' && <Route entries={exact} />}
        </GoogleMap>
      </div>

      <div className="map-top">
        <div className="seg">
          {(
            [
              ['all', 'Everything'],
              ['on', "What's on"],
              ['plans', 'My plans'],
            ] as [View, string][]
          ).map(([v, label]) => (
            <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
              {label}
            </button>
          ))}
        </div>
        <div className="row">
          <button className={`filter-btn ${filter.size ? 'on' : ''}`} onClick={() => setFiltering(true)}>
            {filter.size ? `Filter · ${filter.size}` : 'Filter'}
          </button>
          {view !== 'all' && (
            <span className="seg">
              <button aria-label="Previous day" onClick={() => setSelectedDate(addDays(date, -1))}>
                ‹
              </button>
              <button className="on" onClick={() => setSelectedDate(todayISO())}>
                {date === todayISO() ? 'Today' : formatDay(date)}
              </button>
              <button aria-label="Next day" onClick={() => setSelectedDate(addDays(date, 1))}>
                ›
              </button>
            </span>
          )}
        </div>
        <ActiveFilters />
      </div>

      {open && (
        <div className="map-card">
          {open.title && <span className="label" style={{ padding: '4px 6px' }}>{open.title}</span>}
          {open.entries.map((e) => (
            <EntryRow key={e.id} entry={e} date={view === 'all' ? undefined : date} />
          ))}
        </div>
      )}

      {filtering && (
        <Sheet onClose={() => setFiltering(false)}>
          <FilterSheetBody count={mapped.length} onDone={() => setFiltering(false)} />
        </Sheet>
      )}
    </>
  );
}

const clusterRenderer: Renderer = {
  render: ({ count, position }) => {
    const el = document.createElement('div');
    el.className = 'cluster';
    el.textContent = String(count);
    return new google.maps.marker.AdvancedMarkerElement({ position, content: el, zIndex: 2 });
  },
};

/** Venue pins, grouped into a count where they crowd together. */
function Pins({ entries, numbered, onPick }: { entries: Entry[]; numbered: boolean; onPick: (e: Entry) => void }) {
  const map = useMap();
  const { typeMap } = useStore();
  const markers = useRef(new Map<string, google.maps.marker.AdvancedMarkerElement>());
  const frame = useRef(0);
  const clusterer = useMemo(() => (map ? new MarkerClusterer({ map, renderer: clusterRenderer }) : null), [map]);

  // Markers attach after render; batch them into the clusterer once per frame.
  const sync = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      if (!clusterer) return;
      clusterer.clearMarkers();
      if (!numbered) clusterer.addMarkers([...markers.current.values()]);
    });
  }, [clusterer, numbered]);

  useEffect(() => {
    sync();
    return () => cancelAnimationFrame(frame.current);
  }, [sync, entries]);

  const setRef = (marker: google.maps.marker.AdvancedMarkerElement | null, key: string) => {
    if (marker) markers.current.set(key, marker);
    else markers.current.delete(key);
  };

  return (
    <>
      {entries.map((e, i) => (
        <AdvancedMarker
          key={e.id}
          ref={(m) => setRef(m, e.id)}
          position={{ lat: e.place!.lat!, lng: e.place!.lng! }}
          onClick={() => onPick(e)}
          zIndex={3}
        >
          <span
            className={`pin ${numbered ? 'num' : ''}`}
            style={{ '--c': familyColor(familyOf(e.type_ids, typeMap)) } as CSSProperties}
          >
            {numbered ? i + 1 : null}
          </span>
        </AdvancedMarker>
      ))}
    </>
  );
}

/** A thin line through a day's plans, in order. */
function Route({ entries }: { entries: Entry[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || entries.length < 2) return;
    const line = new google.maps.Polyline({
      map,
      path: entries.map((e) => ({ lat: e.place!.lat!, lng: e.place!.lng! })),
      strokeColor: '#f1efe9',
      strokeOpacity: 0.7,
      strokeWeight: 2,
    });
    return () => line.setMap(null);
  }, [map, entries]);
  return null;
}
