import { supabase } from './supabase';
import type { Place } from './types';

export type FoundPlace = Omit<Place, 'id'>;

/** Places already in the database (anyone's saves), matched by name as you type. */
export async function searchSaved(text: string): Promise<Place[]> {
  const q = text.trim();
  if (q.length < 2) return [];
  const { data } = await supabase
    .from('places')
    .select('*')
    .ilike('name', `%${q.replace(/[%_]/g, '')}%`)
    .order('precision')
    .limit(6);
  return (data as Place[]) ?? [];
}

interface NominatimHit {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  addresstype?: string;
  address?: Record<string, string>;
}

const CITY_TYPES = new Set(['city', 'town', 'village', 'municipality', 'county', 'state', 'suburb', 'neighbourhood']);

/**
 * OpenStreetMap's free lookup. Its rules allow searches you trigger, not
 * search-as-you-type, so this only runs when you ask or when you save.
 */
export async function searchMap(text: string): Promise<FoundPlace[]> {
  const q = text.trim();
  if (!q) return [];
  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '5',
    countrycodes: 'us',
    viewbox: '-98.1,33.6,-95.9,32.1', // DFW first, anywhere else after
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
  if (!res.ok) return [];
  const hits = (await res.json()) as NominatimHit[];
  return hits.map((h) => {
    const a = h.address ?? {};
    const city = a.city ?? a.town ?? a.village ?? a.municipality ?? null;
    const isCity = CITY_TYPES.has(h.addresstype ?? '');
    const street = [a.house_number, a.road].filter(Boolean).join(' ');
    const address = isCity ? null : [street, city, a.state ? abbreviate(a.state) : null].filter(Boolean).join(', ');
    return {
      name: h.name || street || h.display_name.split(',')[0],
      address: address || null,
      city: isCity ? (h.name ?? city) : city,
      lat: Number(h.lat),
      lng: Number(h.lon),
      precision: isCity ? 'city' : 'address',
    };
  });
}

/**
 * Looks text up on the map, trying simpler versions when the full text finds nothing.
 * "Merit Coffee, 2700 Commerce St, Dallas, TX" finds nothing as written, but its
 * address does, and the venue's name is kept.
 */
export async function lookUp(text: string): Promise<FoundPlace[]> {
  const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
  const hits = await searchMap(text);
  if (hits.length || parts.length < 2) return hits;
  const byAddress = await searchMap(parts.slice(1).join(', '));
  if (byAddress.length) return [{ ...byAddress[0], name: parts[0] }];
  const city = parts.find((p) => /^[A-Za-z .]+$/.test(p) && p !== parts[0] && !/^(TX|Texas|USA)$/i.test(p));
  return searchMap(`${parts[0]} ${city ?? 'Dallas'}`);
}

const STATES: Record<string, string> = { Texas: 'TX', Oklahoma: 'OK', Louisiana: 'LA', California: 'CA', Colorado: 'CO' };
const abbreviate = (state: string) => STATES[state] ?? state;

export function placeLine(place: Pick<Place, 'name' | 'address' | 'city' | 'precision'>): string {
  if (place.precision === 'city') return place.city ?? place.name;
  return place.address && !place.address.startsWith(place.name) ? `${place.name} · ${place.address}` : place.address ?? place.name;
}

export function googleMapsUrl(place: Place | null, name: string): string {
  const query = place?.address ? `${place.name} ${place.address}` : `${name} ${place?.city ?? ''}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.trim())}`;
}
