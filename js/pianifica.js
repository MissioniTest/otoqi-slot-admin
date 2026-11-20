import { CITIES, HOURS } from './config.js';
import { esc, p2, isoDay, mondayOf, keyOf, romeIso, addDays } from './utils.js';
import { Data } from './api.js';
import { renderNav } from './nav.js';

const DN = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const S = { city: CITIES[0], ws: mondayOf(new Date()), slots: new Map(), edits: new Map(), preview: null, err: '', loading: true };
const app = document.getElementById('app');
const base = (k) => { const s = S.slots.get(k); return s ? String(s.capacity) : ''; };

async function load() {
  S.loading = true; render();
  try {
    const rows = await Data.week(S.city, S.ws);
    S.slots = new Map(rows.map((s) => [keyOf(s.starts_at), s]));
    S.err = '';
  } catch (e) { console.error(e); S.err = e.message; }
  S.edits.clear(); S.preview = null; S.loading = false; render();
}

function payload() {
  const out = [];
  S.edits.forEach((v, k) => {
    const [iso, h] = k.split('|');
    out.push({ citta: S.city.toLowerCase(), inizio: romeIso(iso, Number(h)), capienza: parseInt(v, 10) });
  });
  return out;
}

const down = () => [...S.edits].filter(([k, v]) => { const s = S.slots.get(k); return s && s.status === 'pubblicato' && Number(v) < s.capacity; }).length;

function cell(k) {
  const s = S.slots.get(k), chg = S.edits.has(k), v = chg ? S.edits.get(k) : base(k);
  const stato = !s ? 'nuovo' : s.status === 'pubblicato' ? 'pubblicato' : s.publish_at ? 'programmato' : 'bozza';
  const bk = s ? s.booked.length : 0;
  return '<div class="pc' + (v === '0' ? ' closed' : '') + (chg ? ' chg' : '') + '">' +
    '<input type="number" min="0" max="99" inputmode="numeric" value="' + esc(v) + '" data-key="' + k + '" aria-label="Capienza ' + k + '">' +
    '<small>' + stato + (bk ? ' · ' + bk + ' pren.' : '') + (v === '0' ? ' · chiuso' : '') + '</small></div>';
}

function render() {
  renderNav();
  const days = Array.from({ length: 7 }, (_, i) => { const d = addDays(S.ws, i); return { d, iso: isoDay(d) }; });
  const end = addDays(S.ws, 6);
  const label = S.ws.getDate() + '–' + end.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  const tabs = CITIES.map((c) => '<button class="tab' + (c === S.city ? ' on' : '') + '" data-city="' + esc(c) + '">' + esc(c) + '</button>').join('');
  let grid = '<div></div>' + days.map((x, i) => '<div class="dh"><b>' + DN[i] + ' ' + x.d.getDate() + '</b></div>').join('');
  HOURS.forEach((h) => {
    grid += '<div class="hr">' + p2(h) + '–' + p2(h + 2) + '</div>' + days.map((x) => cell(x.iso + '|' + h)).join('');
  });
  const n = S.edits.size;
  let pv = '';
  if (S.preview) {
    const r = S.preview.res, d = down();
    pv = '<div class="card det"><h2>Anteprima del salvataggio</h2><div class="sub">' +
      r.nuovi + ' slot nuovi (in bozza) · ' + r.aggiornati + ' aggiornati · ' + r.invariati + ' invariati · ' + r.promossi + ' promossi dalla lista d\'attesa</div>' +
      (d ? '<div class="msg err">Stai riducendo la capienza di ' + d + ' slot già pubblicati.</div>' : '') +
      (r.avvisi.length ? '<div class="msg err">' + r.avvisi.length + ' slot scendono sotto le prenotazioni esistenti (restano valide).</div>' : '') +
      (r.errori.length ? '<div class="msg err">Errori: ' + esc(JSON.stringify(r.errori)) + '</div>' : '') +
      '<div class="row" style="margin-top:12px"><button class="btn" data-act="back">Torna alla modifica</button><button class="btn pri" data-act="save">Conferma e salva</button></div></div>';
  }
  app.innerHTML =
    '<div class="row"><h1>Otoqi <span>· Pianifica</span></h1></div>' +
    '<div class="row"><div style="display:flex;gap:8px;flex-wrap:wrap">' + tabs + '</div>' +
    '<div style="display:flex;align-items:center;gap:10px"><button class="nav" data-week="-1" aria-label="Settimana precedente">‹</button><div style="min-width:180px;text-align:center;font-weight:600">' + label + '</div><button class="nav" data-week="1" aria-label="Settimana successiva">›</button></div></div>' +
    (S.err ? '<div class="msg err">' + esc(S.err) + '</div>' : '') +
    '<div class="row"><div class="sub" style="margin:0">Scrivi la capienza in ogni slot. Vuoto = nessuno slot, 0 = slot chiuso. Le caselle verdi sono modifiche non ancora salvate. Gli slot nuovi nascono in bozza.</div>' +
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn" data-act="copy">Copia dalla settimana precedente</button><button class="btn" data-act="reset">Annulla modifiche</button>' +
    '<span id="cnt" class="pill">' + n + '</span><button id="save" class="btn pri" data-act="preview"' + (n ? '' : ' disabled') + '>Salva modifiche</button></div></div>' +
    pv + (S.loading ? '<div class="msg">Caricamento…</div>' : '<div class="card scroll"><div class="pgrid">' + grid + '</div></div>');
}

function counter() {
  document.getElementById('cnt').textContent = S.edits.size;
  document.getElementById('save').disabled = !S.edits.size;
}

app.addEventListener('input', (e) => {
  const k = e.target.dataset.key; if (!k) return;
  const v = e.target.value.trim();
  if (v === '' || v === base(k) || isNaN(v) || Number(v) < 0) S.edits.delete(k); else S.edits.set(k, String(parseInt(v, 10)));
  const box = e.target.closest('.pc'), cur = S.edits.has(k) ? S.edits.get(k) : base(k);
  box.classList.toggle('chg', S.edits.has(k));
  box.classList.toggle('closed', cur === '0');
  counter();
});

app.addEventListener('click', async (e) => {
  const t = e.target.closest('button'); if (!t) return;
  try {
    if (t.dataset.city) { S.city = t.dataset.city; load(); }
    else if (t.dataset.week) {
      if (S.edits.size && !confirm('Hai modifiche non salvate: le perdi se cambi settimana. Continuare?')) return;
      S.ws = addDays(S.ws, 7 * Number(t.dataset.week)); load();
    }
    else if (t.dataset.act === 'reset') { S.edits.clear(); S.preview = null; render(); }
    else if (t.dataset.act === 'back') { S.preview = null; render(); }
    else if (t.dataset.act === 'copy') {
      const prev = await Data.week(S.city, addDays(S.ws, -7));
      const pm = new Map(prev.map((s) => [keyOf(s.starts_at), s]));
      for (let i = 0; i < 7; i++) HOURS.forEach((h) => {
        const p = pm.get(isoDay(addDays(S.ws, i - 7)) + '|' + h), k = isoDay(addDays(S.ws, i)) + '|' + h;
        if (p && String(p.capacity) !== base(k)) S.edits.set(k, String(p.capacity));
      });
      render();
    }
    else if (t.dataset.act === 'preview') { S.preview = { res: await Data.plan(payload(), true) }; render(); }
    else if (t.dataset.act === 'save') { await Data.plan(payload(), false); await load(); }
  } catch (err) { S.err = err.message; render(); }
});

load();