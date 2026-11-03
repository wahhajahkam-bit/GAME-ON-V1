// Game time. t = minutes since 1 March 2025 00:00. Working day 08:00-18:00.
export const DAY_START = 480;
export const DAY_END = 1080;
export const DAYMIN = 1440;
const BASE = Date.UTC(2025, 2, 1);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const tOf = (d, min) => d * DAYMIN + min;
export const dayOf = (t) => Math.floor(t / DAYMIN);
export const minOf = (t) => t - dayOf(t) * DAYMIN;
export const dateOf = (d) => new Date(BASE + d * 86400000);
export function monthOf(d) {
  const x = dateOf(d);
  return (x.getUTCFullYear() - 2025) * 12 + x.getUTCMonth() - 2;
}
export const monthFirst = (m) => Math.round((Date.UTC(2025, 2 + m, 1) - BASE) / 86400000);
export const monthLast = (m) => monthFirst(m + 1) - 1;
export function fmtDay(d) { const x = dateOf(d); return x.getUTCDate() + '-' + MON[x.getUTCMonth()]; }
export function fmtDayLong(d) { const x = dateOf(d); return WD[x.getUTCDay()] + ' ' + x.getUTCDate() + ' ' + MON[x.getUTCMonth()] + ' ' + x.getUTCFullYear(); }
export function monthName(m) { const x = dateOf(monthFirst(m)); return MONTH_FULL[x.getUTCMonth()] + ' ' + x.getUTCFullYear(); }
export function monthShort(m) { const x = dateOf(monthFirst(m)); return MON[x.getUTCMonth()]; }
export function fmtClock(t) {
  const m = minOf(t); const h = Math.floor(m / 60); const mm = Math.floor(m % 60);
  return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}
export const fmtT = (t) => fmtDay(dayOf(t)) + ' ' + fmtClock(t);
