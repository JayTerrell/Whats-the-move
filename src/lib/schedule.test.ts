import { describe, expect, it } from 'vitest';
import { isPast } from './schedule';
import type { Entry } from './types';

const today = '2026-11-03';
const entry = (over: Partial<Entry>): Entry => ({
  id: 'e', owner_id: 'u', name: 'x', place_id: null, place: null, occurrence: 'once', start_date: null, end_date: null,
  start_time: null, repeats: null, free: false, source_url: null, copied_from: null, created_at: '2026-01-01', type_ids: [],
  ...over,
});

describe('isPast', () => {
  it('passes a one-off after its day, not on it', () => {
    expect(isPast(entry({ start_date: '2026-11-02' }), today)).toBe(true);
    expect(isPast(entry({ start_date: today }), today)).toBe(false);
  });
  it('passes a run after it closes', () => {
    expect(isPast(entry({ occurrence: 'run', start_date: '2026-10-01', end_date: '2026-11-02' }), today)).toBe(true);
    expect(isPast(entry({ occurrence: 'run', start_date: '2026-10-01', end_date: today }), today)).toBe(false);
    expect(isPast(entry({ occurrence: 'run', start_date: '2026-10-01' }), today)).toBe(true);
  });
  it('keeps repeating things until they end', () => {
    expect(isPast(entry({ occurrence: 'repeats', repeats: 'every Friday', start_date: '2025-01-01' }), today)).toBe(false);
    expect(isPast(entry({ occurrence: 'repeats', repeats: 'every Friday', end_date: '2026-10-01' }), today)).toBe(true);
  });
  it('never passes undated or always-open entries', () => {
    expect(isPast(entry({}), today)).toBe(false);
    expect(isPast(entry({ occurrence: 'always' }), today)).toBe(false);
  });
});
