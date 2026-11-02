import type { EventType, FamilyId } from './types';

export const FAMILIES: { id: FamilyId; name: string }[] = [
  { id: 'food', name: 'Food & drink' },
  { id: 'music', name: 'Music & nightlife' },
  { id: 'arts', name: 'Arts & culture' },
  { id: 'outdoors', name: 'Outdoors & active' },
  { id: 'games', name: 'Games & experiences' },
  { id: 'social', name: 'Social & shopping' },
];

/** Colours live in CSS (--f-food, ...); this returns the variable for inline styles. */
export const familyColor = (family: FamilyId | null | undefined) => (family ? `var(--f-${family})` : 'var(--muted)');

export function familyOf(typeIds: string[], types: Map<string, EventType>): FamilyId | null {
  for (const id of typeIds) {
    const t = types.get(id);
    if (t) return t.family;
  }
  return null;
}

/** Event types in family order, then by name: the order buckets and sections use. */
export function typesInOrder(types: EventType[]): EventType[] {
  const rank = new Map(FAMILIES.map((f, i) => [f.id, i]));
  return [...types].sort((a, b) => (rank.get(a.family) ?? 9) - (rank.get(b.family) ?? 9) || a.name.localeCompare(b.name));
}
