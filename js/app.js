import { CITIES, REFRESH_MS, GROUP_LABELS, BAND_FULL } from './config.js';
import { esc, p2, isoDay, mondayOf, keyOf, addDays, weekLabel } from './utils.js';
import { Data } from './api.js';
import { renderNav, ready } from './nav.js';

const PAGE_SIZE = 10;
const DN = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

// 8 righe: fascia 01–09, sei slot singoli, fascia 21–01
const ROWS = [
  { id: 'N', label: '01–09', hours: [1, 3, 5, 7], band: true },
  ...[9, 11, 13, 15, 17, 19].map((h) => ({ id: String(h), label: p2(h) + '–' + p2(h + 2), hours: [h] })),
  { id: 'S', label: '21–01', hours: [21, 23], band: true }
];

const S = {
  city: CITIES[0],
  ws: mondayOf(new Date()),
  sel: null,
  slots: [],
  unbooked: [],
  ins: [],
  page: 0,
  err: '',
  loading: true
};

let seq = 0; // numero dell'ultima richiesta: le risposte più vecchie vengono scartate

const reg = (s) => (s.booked || []).filter((m) => !m.inserimento);
const insc = (s) => (s.booked || []).filter((m) => m.inserimento);

function stats(s) {
  const r = reg(s).length;
  return {
    r,
    c: s.capacity,
    i: insc(s).length,
    ok: Math.min(r, s.capacity),
    extra: Math.max(0, r - s.capacity)
  };
}

const comp = (t) =>
  t.ok + '/' + t.c +
  (t.extra ? ' + ' + t.extra + (t.extra === 1 ? ' promosso' : ' promossi') : '') +
  (t.i ? ' + ' + t.i + (t.i === 1 ? ' inserimento' : ' inserimenti') : '');

const first = (m) => (m.name || '').split(' ')[0];

async function load() {
  const my = ++seq;
  if (!(await ready())) return;
  try {
    const [slots, unbooked, ins] = await Promise.all([
      Data.week(S.city, S.ws),
      Data.unbooked(S.city, S.ws),
      Data.inserimenti(S.city)
    ]);
    if (my !== seq) return; // nel frattempo è partita una richiesta più recente
    Object.assign(S, { slots, unbooked, ins, err: '' });
  } catch (e) {
    if (my !== seq) return;
    console.error(e);
    S.err = 'Impossibile caricare i dati: ' + e.message;
  }
  S.loading = false;
  render();
}

function cell(map, iso, row) {
  const key = iso + '|' + row.id;
  const sl = row.hours.map((h) => map.get(iso + '|' + h)).filter(Boolean);
  if (!sl.length) return '<div class="c off" aria-hidden="true"></div>';

  const isDraft = sl.some((s) => s.status && s.status !== 'pubblicato');
  const x = (isDraft ? ' draft' : '') + (S.sel === key ? ' sel' : '');
  const wl = sl.reduce((a, s) => a + (s.waitlist || []).length, 0);
  const badge = wl ? '<span class="badge">attesa ' + wl + '</span>' : '';

  if (row.band) {
    const cap = sl.reduce((a, s) => a + s.capacity, 0);
    const ok = sl.reduce((a, s) => a + stats(s).ok, 0);
    const who = new Set(sl.flatMap((s) => (s.booked || []).map((m) => m.driver_id))).size;
    const ratio = cap ? ok / cap : 0;
    const k = who === 0 ? 'none' : ratio >= BAND_FULL ? 'full' : 'half';
    return '<button class="c band ' + k + x + '" data-key="' + esc(key) + '">' +
      '<div class="t"><span>' + who + ' driver</span>' + badge + '</div>' +
      '<div class="w">' + Math.round(ratio * 100) + '% coperto</div></button>';
  }

  const s = sl[0];
  const t = stats(s);
  if (s.capacity === 0) {
    return '<button class="c closed' + x + '" data-key="' + esc(key) + '"><div class="t"><span>chiuso</span></div></button>';
  }

  const k = t.r === 0 ? 'none' : t.r >= t.c ? 'full' : 'half';
  const names = reg(s).slice(0, 2).map(first).join(', ') + (t.r > 2 ? ' +' + (t.r - 2) : '');
  return '<button class="c ' + k + x + '" data-key="' + esc(key) + '">' +
    '<div class="t"><span>' + t.ok + '/' + t.c + (t.extra ? ' +' + t.extra : '') + (t.i ? ' · ' + t.i + ' ins.' : '') + '</span>' + badge + '</div>' +
    '<div class="w">' + esc(t.r ? names : 'libero') + '</div></button>';
}

function detail(map, days) {
  if (!S.sel) return '';
  const [iso, id] = S.sel.split('|');
  const row = ROWS.find((r) => r.id === id);
  const sl = row ? row.hours.map((h) => ({ h, s: map.get(iso + '|' + h) })).filter((o) => o.s) : [];
  const di = days.findIndex((d) => d.iso === iso);
  if (!sl.length || di < 0) return '';

  const line = (m, j, tag) =>
    '<div class="li"><span>' + (j + 1) + '</span><b style="flex:1">' + esc(m.name) + '</b>' +
    (tag ? '<span class="tag">' + tag + '</span>' : '') + '</div>';

  let html = '<div class="card det"><div class="row"><h2>' + esc(S.city) + ' · ' + DN[di] + ' ' + days[di].d.getDate() + ' · ' + row.label + '</h2><button class="x" data-close aria-label="Chiudi">×</button></div>';

  sl.forEach(({ h, s }) => {
    const t = stats(s);
    const r = reg(s);
    const regs = r.slice(0, t.c);
    const extra = r.slice(t.c);
    const waitlist = s.waitlist || [];

    html += '<div class="sec">' + p2(h) + '–' + p2(h + 2) + ' · ' + (s.capacity === 0 ? 'chiuso' : comp(t)) + '</div>' +
      regs.map((m, j) => line(m, j)).join('') +
      extra.map((m, j) => line(m, regs.length + j, 'promosso')).join('') +
      insc(s).map((m, j) => line(m, j, 'inserimento')).join('') +
      ((s.booked || []).length ? '' : '<div class="sub">Nessun driver prenotato</div>') +
      (waitlist.length ? '<div class="sub"><b>Lista d\'attesa</b></div>' + waitlist.map((m, j) =>
        '<div class="wl li" style="border:0"><span>' + (j + 1) + '</span><b style="flex:1">' + esc(m.name) + '</b>' +
        '<button class="btn-prom" data-act="promote" data-slot="' + esc(s.slot_id || s.id) + '" data-driver="' + esc(m.driver_id) + '" data-name="' + esc(m.name) + '">Promuovi</button></div>').join('') : '');
  });

  return html + '</div>';
}

function render() {
  renderNav();
  const map = new Map(S.slots.map((s) => [keyOf(s.starts_at), s]));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(S.ws, i);
    return { d, iso: isoDay(d) };
  });

  const tot = {};
  const n = { full: 0, half: 0, none: 0, seats: 0 };
  days.forEach((x) => (tot[x.iso] = [0, 0]));

  S.slots.forEach((s) => {
    const [iso] = keyOf(s.starts_at).split('|');
    const t = stats(s);
    if (tot[iso]) {
      tot[iso][0] += t.ok;
      tot[iso][1] += t.c;
    }
    if (!s.capacity) return;
    n[t.r === 0 ? 'none' : t.r >= t.c ? 'full' : 'half']++;
    n.seats += t.r + t.i;
  });

  const gap = (i) => (i === 1 || i === 5 ? '<div></div>' : '');
  const head = days.map((x, i) => gap(i) + '<div class="dh"><b>' + DN[i] + ' ' + x.d.getDate() + '</b><small>' + tot[x.iso][0] + '/' + tot[x.iso][1] + ' posti</small></div>').join('');
  const body = ROWS.map((row) => '<div class="hr">' + row.label + '</div>' + days.map((x, i) => gap(i) + cell(map, x.iso, row)).join('')).join('');

  const label = weekLabel(S.ws);
  const tabs = CITIES.map((c) => '<button class="tab' + (c === S.city ? ' on' : '') + '" data-city="' + esc(c) + '">' + esc(c) + '</button>').join('');

  const pages = Math.ceil(S.unbooked.length / PAGE_SIZE) || 1;
  if (S.page >= pages) S.page = pages - 1;
  const from = S.page * PAGE_SIZE;

  const un = '<div class="card"><div class="row"><h2>Da contattare · ' + esc(S.city) + '</h2><span class="pill">' + S.unbooked.length + '</span></div>' +
    '<div class="sub">Driver attivi senza alcuno slot prenotato questa settimana</div>' +
    (S.unbooked.slice(from, from + PAGE_SIZE).map((u) => '<div class="li"><b>' + esc(u.name) + (u.phase === 'inserimento' ? '<span class="tag">inserimento</span>' : '') + '</b><em>ultimo slot ' + esc(u.last_slot || '–') + '</em></div>').join('') || '<div class="sub">Tutti i driver attivi hanno almeno uno slot.</div>') +
    (pages > 1 ? '<div class="un-foot"><span>' + (from + 1) + '–' + Math.min(from + PAGE_SIZE, S.unbooked.length) + ' di ' + S.unbooked.length + '</span><div style="display:flex;gap:6px;align-items:center"><button class="nav-mini" data-un-page="-1"' + (S.page === 0 ? ' disabled' : '') + '>‹</button><span style="font-weight:600">' + (S.page + 1) + '/' + pages + '</span><button class="nav-mini" data-un-page="1"' + (S.page >= pages - 1 ? ' disabled' : '') + '>›</button></div></div>' : '') + '</div>';

  const ins = '<div class="card"><div class="row"><h2>In inserimento · ' + esc(S.city) + '</h2><span class="pill">' + S.ins.length + '</span></div>' +
    '<div class="sub">Vedono solo gli slot diurni. Sblocca quando sono autonomi.</div>' +
    (S.ins.map((u) => '<div class="li"><span><b>' + esc(u.name) + '</b><br><em>' + Number(u.svolti) + ' svolti · ' + Number(u.prossimi) + ' prenotati' + (u.ultimo ? ' · ultimo ' + esc(u.ultimo) : '') + '</em></span><button class="btn-prom" data-act="unlock" data-driver="' + esc(u.driver_id) + '" data-name="' + esc(u.name) + '">Sblocca</button></div>').join('') || '<div class="sub">Nessun driver in inserimento.</div>') + '</div>';

  document.getElementById('app').innerHTML =
    '<div class="row"><h1>Otoqi <span>· Controllo</span></h1><button class="nav" data-refresh aria-label="Aggiorna">↻</button></div>' +
    '<div class="row"><div style="display:flex;gap:8px;flex-wrap:wrap">' + tabs + '</div><div style="display:flex;align-items:center;gap:10px"><button class="nav" data-week="-1" aria-label="Settimana precedente">‹</button><div style="min-width:180px;text-align:center;font-weight:600">' + esc(label) + '</div><button class="nav" data-week="1" aria-label="Settimana successiva">›</button></div></div>' +
    (S.err ? '<div class="msg err">' + esc(S.err) + '</div>' : '') +
    '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:stretch"><div class="kpi"><b>' + n.seats + '</b><span>posti prenotati</span></div><div class="kpi"><b style="color:var(--ink)">' + n.full + '</b><span>slot pieni</span></div><div class="kpi"><b style="color:var(--ink)">' + n.half + '</b><span>slot a metà</span></div><div class="kpi"><b style="color:var(--ink)">' + n.none + '</b><span>slot liberi</span></div>' +
    '<div class="legend"><span><i style="background:var(--bd)"></i>Pieno</span><span><i style="background:var(--soft)"></i>A metà</span><span><i style="background:var(--empty);border-color:#D5D1CA"></i>Libero</span><span><i style="background:#A9BFA3"></i>Attesa</span><span><i style="border:2px solid var(--sage)"></i>Bozza</span></div></div>' +
    '<div class="main"><div class="card scroll"><div class="cg"><div class="gl" style="grid-column:2">' + esc(GROUP_LABELS.mon) + '</div><div class="gl" style="grid-column:9 / span 2">' + esc(GROUP_LABELS.weekend) + '</div></div>' +
    '<div class="cg"><div></div>' + head + body + '</div></div><div class="side">' + detail(map, days) + ins + un + '</div></div>';
}

document.getElementById('app').addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  const d = t.dataset;
  try {
    if (d.unPage) {
      S.page += Number(d.unPage);
      render();
    } else if (d.act === 'promote') {
      if (!confirm('Promuovere ' + d.name + ' su questo slot? Avrà il posto in più oltre la capienza.')) return;
      const r = await Data.promote(d.slot, d.driver);
      if (r?.esito !== 'ok') throw new Error(r?.esito || 'errore');
      await load();
    } else if (d.act === 'unlock') {
      if (!confirm('Sbloccare ' + d.name + '? Da ora vedrà tutti gli slot, anche di notte.')) return;
      const r = await Data.setPhase(d.driver, 'pieno');
      if (r?.esito !== 'ok') throw new Error(r?.esito || 'errore');
      await load();
    } else if (d.key) {
      S.sel = d.key;
      render();
    } else if ('close' in d) {
      S.sel = null;
      render();
    } else if (d.city) {
      S.city = d.city;
      S.sel = null;
      S.page = 0;
      load();
    } else if (d.week) {
      S.ws = addDays(S.ws, 7 * Number(d.week));
      S.sel = null;
      S.page = 0;
      load();
    } else if ('refresh' in d) {
      load();
    }
  } catch (err) {
    alert('Operazione non riuscita: ' + err.message);
  }
});

load();
// Aggiornamento automatico solo se la pagina è visibile
setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);