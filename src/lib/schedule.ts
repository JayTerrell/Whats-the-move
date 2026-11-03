import { addDays, diffDays, formatShort, formatTime } from './dates';
import { describeRule, occursOn, parseRule, type Rule } from './recurrence';
import type { Entry, ISODate } from './types';

const rules = new Map<string, Rule | null>();
export function ruleOf(entry: Entry): Rule | null {
  const key = entry.repeats ?? '';
  if (!rules.has(key)) rules.set(key, parseRule(key));
  return rules.get(key)!;
}

const within = (date: ISODate, start: ISODate | null, end: ISODate | null) =>
  (!start || date >= start) && (!end || date <= end);

/** Is this entry something you could do on `date`? */
export function activeOn(entry: Entry, date: ISODate): boolean {
  switch (entry.occurrence) {
    case 'once':
      return entry.start_date === date;
    case 'run':
      return !!entry.start_date && within(date, entry.start_date, entry.end_date ?? entry.start_date);
    case 'repeats': {
      const rule = ruleOf(entry);
      if (!rule) return entry.start_date === date;
      return within(date, entry.start_date, entry.end_date) && occursOn(rule, date, entry.start_date ?? undefined);
    }
    case 'always':
      return within(date, entry.start_date, entry.end_date);
  }
}

/** Has this entry's last date gone by? Entries without dates never pass. */
export function isPast(entry: Entry, today: ISODate): boolean {
  const before = (d: ISODate | null) => !!d && d < today;
  switch (entry.occurrence) {
    case 'once':
      return before(entry.start_date);
    case 'run':
      return before(entry.end_date ?? entry.start_date);
    case 'repeats':
      return ruleOf(entry) ? before(entry.end_date) : before(entry.end_date ?? entry.start_date);
    case 'always':
      return before(entry.end_date);
  }
}

/** The next dates an entry can be attended, starting from `from`. */
export function upcomingDates(entry: Entry, from: ISODate, count = 7): ISODate[] {
  const out: ISODate[] = [];
  for (let i = 0; i < 400 && out.length < count; i++) {
    const d = addDays(from, i);
    if (activeOn(entry, d)) out.push(d);
  }
  return out;
}

export function whenText(entry: Entry, date?: ISODate): string {
  const time = entry.start_time ? ` · ${formatTime(entry.start_time.slice(0, 5))}` : '';
  switch (entry.occurrence) {
    case 'once':
      return entry.start_date ? formatShort(entry.start_date) + time : 'No date yet';
    case 'repeats': {
      const rule = ruleOf(entry);
      return rule ? describeRule(rule) + time : 'Repeats';
    }
    case 'run': {
      if (!entry.start_date) return 'No dates yet';
      if (!entry.end_date) return formatShort(entry.start_date) + time;
      if (date) {
        const left = diffDays(date, entry.end_date);
        if (left === 0) return 'Last day';
        if (left > 0) return `${left} day${left === 1 ? '' : 's'} left`;
      }
      return `${formatShort(entry.start_date)} – ${formatShort(entry.end_date)}`;
    }
    case 'always':
      return 'Always open';
  }
}

export type Issue = 'type' | 'date' | 'repeats' | 'location';

export const ISSUE_LABEL: Record<Issue, string> = {
  type: 'No event type',
  date: 'No date',
  repeats: 'No repeat pattern',
  location: 'No location',
};

export function issuesFor(entry: Entry): Issue[] {
  const out: Issue[] = [];
  if (!entry.type_ids.length) out.push('type');
  if ((entry.occurrence === 'once' || entry.occurrence === 'run') && !entry.start_date) out.push('date');
  if (entry.occurrence === 'repeats' && !ruleOf(entry)) out.push('repeats');
  if (!entry.place) out.push('location');
  return out;
}

/** An entry and its copies (made when someone accepts an invite) share a root. */
export const rootOf = (entry: Pick<Entry, 'id' | 'copied_from'>) => entry.copied_from ?? entry.id;
