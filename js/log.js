import { esc } from './utils.js';
import { Data } from './api.js';
import { renderNav, ready } from './nav.js';

const PAGE = 100;

// Nomi leggibili delle azioni registrate dal database
const AZIONI = {
  crea_ops: 'Creato operatore',
  toggle_ops_active: 'Operatore attivato/disattivato',
  reset_password: 'Password driver reimpostata',
  toggle_driver_active: 'Driver attivato/disattivato',
  set_driver_habit: 'Abitudine driver modificata',
  cambio_fase: 'Fase driver cambiata',
  promozione: 'Promozione da lista d’attesa',
  pianifica_slot: 'Capienze salvate',
  programma_pubblicazione: 'Pubblicazione programmata',
  annulla_programmazione: 'Programmazione annullata',
  pubblica_adesso: 'Pubblicazione immediata',
  pubblica_programmata: 'Pubblicazione automatica',
  cancella_bozze: 'Bozze cancellate',
  upsert_driver: 'Driver creato/aggiornato da Airtable'
};

const S = { rows: [], search: '', more: false, err: '', loading: true };
let seq = 0;

const fmt = (iso) => new Date(iso).toLocaleString('it-IT', {
  timeZone: 'Europe/Rome', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
});

// Dettaglio leggibile: "chiave: valore" per ogni campo
function dettaglio(d) {
  if (!d || typeof d !== 'object') return '';
  return Object.entries(d)
    .map(([k, v]) => k + ': ' + (v !== null && typeof v === 'object' ? JSON.stringify(v) : v))
    .join(' · ');
}

async function load(append = false) {
  const my = ++seq;
  if (!(await ready())) return;
  try {
    const offset = append ? S.rows.length : 0;
    const rows = await Data.logs(PAGE, offset);
    if (my !== seq) return;
    S.rows = append ? S.rows.concat(rows) : rows;
    S.more = rows.length === PAGE;
    S.err = '';
  } catch (e) {
    if (my !== seq) return;
    console.error(e);
    S.err = e.message === 'non_autorizzato' ? 'Pagina riservata al Superadmin.' : 'Impossibile caricare i log: ' + e.message;
  }
  S.loading = false;
  render();
}

function render() {
  renderNav();
  const app = document.getElementById('app');

  if (S.err) {
    app.innerHTML = '<div class="msg err">' + esc(S.err) + '</div>';
    return;
  }

  const q = S.search.toLowerCase().trim();
  const rows = q
    ? S.rows.filter((r) =>
        (AZIONI[r.action] || r.action).toLowerCase().includes(q) ||
        String(r.operatore).toLowerCase().includes(q) ||
        dettaglio(r.detail).toLowerCase().includes(q))
    : S.rows;

  const lines = rows.map((r) =>
    '<div class="logrow">' +
      '<span class="logdate">' + esc(fmt(r.at)) + '</span>' +
      '<span class="logop">' + esc(r.operatore) + '</span>' +
      '<span class="logact"><b>' + esc(AZIONI[r.action] || r.action) + '</b><em>' + esc(dettaglio(r.detail)) + '</em></span>' +
    '</div>').join('');

  app.innerHTML =
    '<div class="row"><h1>Otoqi <span>· Registro operazioni</span></h1><button class="nav" data-act="refresh" aria-label="Aggiorna">↻</button></div>' +
    '<div class="row"><input type="text" id="logSearch" class="search-box" placeholder="Cerca operatore, azione o dettaglio…" value="' + esc(S.search) + '">' +
    '<span class="sub" style="margin:0">' + rows.length + ' operazioni' + (q ? ' trovate' : ' caricate') + '</span></div>' +
    '<div class="card" style="padding:0;overflow:hidden">' +
      (S.loading ? '<div class="msg">Caricamento…</div>' : (lines || '<div class="msg">Nessuna operazione.</div>')) +
    '</div>' +
    (S.more && !q ? '<div class="row" style="justify-content:center"><button class="btn" data-act="more">Carica altre</button></div>' : '');
}

document.getElementById('app').addEventListener('input', (e) => {
  if (e.target.id !== 'logSearch') return;
  const pos = e.target.selectionStart;
  S.search = e.target.value;
  render();
  const box = document.getElementById('logSearch');
  box.focus();
  box.setSelectionRange(pos, pos);
});

document.getElementById('app').addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.act === 'refresh') load();
  else if (t.dataset.act === 'more') load(true);
});

load();