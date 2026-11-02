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
