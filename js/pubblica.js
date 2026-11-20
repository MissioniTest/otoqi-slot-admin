import { CITIES } from './config.js';
import { esc, isoDay, mondayOf, addDays, weekLabel } from './utils.js';
import { Data } from './api.js';
import { renderNav, ready } from './nav.js';

const WEEKS = 8;
const z = (n) => String(n).padStart(2, '0');
const toInput = (d) => isoDay(d) + 'T' + z(d.getHours()) + ':' + z(d.getMinutes());
const fmt = (d) => d.toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const range = (ws) => weekLabel(ws, true);

function defaultWhen() { // prossimo mercoledì alle 12
  const d = new Date(); d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + ((3 - d.getDay() + 7) % 7));
  if (d < new Date()) d.setDate(d.getDate() + 7);
  return d;
}

const S = { cells: [], sel: new Set(), when: defaultWhen(), err: '', loading: true };
const app = document.getElementById('app');

async function load() {
  if (!(await ready())) return;
  S.loading = true; render();
  const first = mondayOf(new Date());
  const jobs = [];
  for (let i = 0; i < WEEKS; i++) CITIES.forEach((city) => jobs.push({ city, ws: addDays(first, i * 7) }));
  try {
    const res = await Promise.all(jobs.map((j) => Data.week(j.city, j.ws)));
    S.cells = jobs.map((j, i) => {
      const sl = res[i], bz = sl.filter((s) => s.status !== 'pubblicato');
      const prog = bz.filter((s) => s.publish_at);
      const when = prog.length ? new Date(Math.min(...prog.map((s) => new Date(s.publish_at)))) : null;
      return { ...j, key: j.city + '|' + isoDay(j.ws), total: sl.length, bozza: bz.length, pubb: sl.length - bz.length, prog: prog.length, when };
    });
    S.err = '';
  } catch (e) { console.error(e); S.err = e.message; }
  S.sel.clear(); S.loading = false; render();
}

function chip(c) {
  if (!c.total) return '<span class="chip vu">—</span>';
  if (!c.bozza) return '<span class="chip pb">Pubblicata · ' + c.pubb + '</span>';
  const extra = c.pubb ? ' <small>(+' + c.pubb + ' già pubbl.)</small>' : '';
  if (c.prog === c.bozza) return '<span class="chip pg">Programmata ' + fmt(c.when) + ' · ' + c.bozza + '</span>' + extra;
  if (c.prog) return '<span class="chip pz">Parziale · ' + c.prog + '/' + c.bozza + ' programmati</span>' + extra;
  return '<span class="chip bz">Bozza · ' + c.bozza + '</span>' + extra;
}

function render() {
  renderNav();
  const sel = S.cells.filter((c) => S.sel.has(c.key));
  const nB = sel.reduce((a, c) => a + c.bozza, 0), nP = sel.reduce((a, c) => a + c.prog, 0);
  const weeks = [...new Set(S.cells.map((c) => isoDay(c.ws)))];
  const rows = weeks.map((iso) => {
    const cs = S.cells.filter((c) => isoDay(c.ws) === iso), ws = cs[0].ws;
    const attive = cs.filter((c) => c.total), tutte = attive.length > 0 && attive.every((c) => S.sel.has(c.key));
    return '<tr><td><label><input type="checkbox" data-row="' + iso + '"' + (tutte ? ' checked' : '') + '> <b>' + range(ws) + '</b></label></td>' +
      cs.map((c) => '<td><label>' + (c.total ? '<input type="checkbox" data-key="' + c.key + '"' + (S.sel.has(c.key) ? ' checked' : '') + '> ' : '') + chip(c) + '</label></td>').join('') + '</tr>';
  }).join('');
  const sched = S.cells.filter((c) => c.prog).sort((a, b) => a.when - b.when);
  const list = sched.length ? sched.map((c) => '<div class="li"><span><b>' + esc(c.city) + '</b> · ' + range(c.ws) + ' · ' + c.prog + ' slot<br><em>' + fmt(c.when) + '</em></span><button class="btn" data-cancel="' + c.key + '">Annulla</button></div>').join('')
    : '<div class="sub">Niente in programma.</div>';
  app.innerHTML =
    '<div class="row"><h1>Otoqi <span>· Pubblica</span></h1><button class="nav" data-act="refresh" aria-label="Aggiorna">↻</button></div>' +
    (S.err ? '<div class="msg err">' + esc(S.err) + '</div>' : '') +
    '<div class="main"><div class="card scroll"><div class="sub">Seleziona settimane e città, poi scegli cosa fare. Si agisce solo sugli slot in bozza.</div>' +
    (S.loading ? '<div class="msg">Caricamento…</div>' : '<table class="pt"><thead><tr><th>Settimana</th>' + CITIES.map((c) => '<th>' + esc(c) + '</th>').join('') + '</tr></thead><tbody>' + rows + '</tbody></table>') +
    '</div><div class="side"><div class="card"><div class="row"><h2>In pubblicazione</h2><span class="pill">' + sched.length + '</span></div>' + list + '</div></div></div>' +
    '<div class="card bar"><div><b>' + sel.length + '</b> selezionate · ' + nB + ' slot in bozza · ' + nP + ' programmati</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
    '<button class="btn pri" data-act="now"' + (nB ? '' : ' disabled') + '>Pubblica adesso</button>' +
    '<input type="datetime-local" id="when" value="' + toInput(S.when) + '">' +
    '<button class="btn" data-act="sched"' + (nB ? '' : ' disabled') + '>Programma</button>' +
    '<button class="btn" data-act="cancel"' + (nP ? '' : ' disabled') + '>Annulla programmazione</button>' +
    '<button class="btn dng" data-act="del"' + (nB ? '' : ' disabled') + '>Elimina bozze</button></div></div>';
}

async function run(kind, cells) {
  const use = kind === 'cancel' ? cells.filter((c) => c.prog) : cells.filter((c) => c.bozza);
  const n = use.reduce((a, c) => a + (kind === 'cancel' ? c.prog : c.bozza), 0);
  if (!use.length) return;
  if (kind === 'sched' && S.when <= new Date()) { S.err = 'La data di programmazione è nel passato.'; render(); return; }
  const verb = { now: 'Pubblicare SUBITO', sched: 'Programmare per ' + fmt(S.when), cancel: 'Annullare la programmazione di', del: 'ELIMINARE definitivamente' }[kind];
  if (!confirm(verb + ' ' + n + ' slot (' + use.length + ' settimane-città)?')) return;
  let errMsg = '';
  try {
    for (const c of use) {
      const to = addDays(c.ws, 6);
      if (kind === 'now') await Data.publishNow(c.city, c.ws, to);
      else if (kind === 'sched') await Data.setPublish(c.city, c.ws, to, S.when);
      else if (kind === 'cancel') await Data.setPublish(c.city, c.ws, to, null);
      else await Data.deleteDrafts(c.city, c.ws, to);
    }
  } catch (e) { errMsg = e.message; }
  // Si ricarica sempre: se una azione si ferma a metà, la tabella mostra lo stato reale
  await load();
  if (errMsg) { S.err = errMsg; render(); }
}

app.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'when') { if (t.value) S.when = new Date(t.value); return; }
  if (t.dataset.key) { t.checked ? S.sel.add(t.dataset.key) : S.sel.delete(t.dataset.key); render(); }
  if (t.dataset.row) {
    S.cells.filter((c) => isoDay(c.ws) === t.dataset.row && c.total).forEach((c) => (t.checked ? S.sel.add(c.key) : S.sel.delete(c.key)));
    render();
  }
});

app.addEventListener('click', (e) => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.act === 'refresh') load();
  else if (t.dataset.cancel) run('cancel', S.cells.filter((c) => c.key === t.dataset.cancel));
  else if (t.dataset.act) run(t.dataset.act, S.cells.filter((c) => S.sel.has(c.key)));
});

load();