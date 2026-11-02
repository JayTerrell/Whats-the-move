export type ISODate = string; // YYYY-MM-DD, a local calendar date

export type Occurrence = 'once' | 'repeats' | 'run' | 'always';

export type FamilyId = 'food' | 'music' | 'arts' | 'outdoors' | 'games' | 'social';

export interface Place {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  precision: 'address' | 'city';
}

export interface EventType {
  id: string;
  name: string;
  family: FamilyId;
  owner_id: string | null;
}

export interface Entry {
  id: string;
  owner_id: string;
  name: string;
  place_id: string | null;
  place: Place | null;
  occurrence: Occurrence;
  start_date: ISODate | null;
  end_date: ISODate | null;
  start_time: string | null; // HH:MM:SS
  repeats: string | null;
  free: boolean;
  source_url: string | null;
  copied_from: string | null;
  created_at: string;
  type_ids: string[]; // first one sets the colour
}

export interface Member {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
}

export interface PlanStop {
  id: string;
  entry_id: string;
  position: number;
  start_time: string | null;
  entry: Entry;
}

export interface Plan {
  id: string;
  created_by: string;
  date: ISODate;
  stops: PlanStop[];
  members: Member[];
}

export interface List {
  id: string;
  name: string;
  entry_ids: string[];
}

export interface Profile {
  id: string;
  name: string | null;
  avatar_url: string | null;
}
