import { TZ } from './config.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));

export const p2 = (n) => String(n % 24).padStart(2, '0');

export function isoDay(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function mondayOf(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

const keyFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23'
});

export function keyOf(iso) {
  const p = Object.fromEntries(keyFmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return p.year + '-' + p.month + '-' + p.day + '|' + Number(p.hour);
}

export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// Etichetta della settimana che parte da ws (lunedì):
// "9–15 novembre 2026" oppure, se scavalca il mese, "26 ottobre – 1 novembre 2026"
export function weekLabel(ws, short = false) {
  const end = addDays(ws, 6);
  const mese = (d) => d.toLocaleDateString('it-IT', { month: short ? 'short' : 'long' });
  const anno = short ? '' : ' ' + end.getFullYear();
  if (ws.getMonth() === end.getMonth()) {
    return ws.getDate() + '–' + end.getDate() + ' ' + mese(end) + anno;
  }
  return ws.getDate() + ' ' + mese(ws) + ' – ' + end.getDate() + ' ' + mese(end) + anno;
}

// Orario di Roma -> stringa ISO con l'offset corretto (gestisce l'ora legale)
const offFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' });
export function romeIso(dayIso, hour) {
  const [y, m, d] = dayIso.split('-').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hour - 1));
  const off = offFmt.formatToParts(guess).find((p) => p.type === 'timeZoneName').value.replace('GMT', '') || '+00:00';
  return dayIso + 'T' + String(hour).padStart(2, '0') + ':00:00' + off;
}