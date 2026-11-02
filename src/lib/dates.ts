import type { ISODate } from './types';

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(y: number, m: number, d: number): ISODate {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function parts(iso: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

// All arithmetic goes through UTC so daylight-saving shifts never move a date.
const toUTC = (iso: ISODate) => {
  const { y, m, d } = parts(iso);
  return Date.UTC(y, m - 1, d);
};
const fromUTC = (ms: number): ISODate => {
  const dt = new Date(ms);
  return toISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
};

export const addDays = (iso: ISODate, n: number) => fromUTC(toUTC(iso) + n * 86_400_000);
export const diffDays = (from: ISODate, to: ISODate) => Math.round((toUTC(to) - toUTC(from)) / 86_400_000);
export const weekday = (iso: ISODate) => new Date(toUTC(iso)).getUTCDay();
export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function todayISO(): ISODate {
  const now = new Date();
  return toISO(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** 6x7 grid of dates covering the month, starting on Sunday. */
export function monthGrid(y: number, m: number): ISODate[] {
  const first = toISO(y, m, 1);
  const start = addDays(first, -weekday(first));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function formatShort(iso: ISODate): string {
  const { m, d } = parts(iso);
  return `${MONTH_SHORT[m - 1]} ${d}`;
}

export function formatLong(iso: ISODate): string {
  const { y, m, d } = parts(iso);
  return `${WEEKDAY_LONG[weekday(iso)]}, ${MONTHS[m - 1][0].toUpperCase()}${MONTHS[m - 1].slice(1)} ${d}, ${y}`;
}

export function monthTitle(y: number, m: number): string {
  return `${MONTHS[m - 1][0].toUpperCase()}${MONTHS[m - 1].slice(1)} ${y}`;
}

export function formatTime(hhmm: string): string {
  const [h, min] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return min ? `${h12}:${pad(min)}${suffix}` : `${h12}${suffix}`;
}

/** "Mon, Nov 2" */
export function formatDay(iso: ISODate): string {
  return `${WEEKDAY_SHORT[weekday(iso)]}, ${formatShort(iso)}`;
}

export const monthShort = (iso: ISODate) => MONTH_SHORT[parts(iso).m - 1];

/** Sunday that starts the week containing `iso`. */
export const weekStart = (iso: ISODate) => addDays(iso, -weekday(iso));
