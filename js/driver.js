import { CITIES } from './config.js';
import { esc } from './utils.js';
import { Data } from './api.js';
import { renderNav, ready } from './nav.js';

// Numeri dal database: sempre numeri, mai testo
const n = (x) => Number(x) || 0;

// Finestra con la password temporanea e il pulsante Copia (al posto di prompt())
function showSecret(title, secret) {
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(43,26,29,.45);z-index:99998;display:flex;align-items:center;justify-content:center;padding:16px';
  ov.innerHTML =
    '<div style="background:#fff;border-radius:14px;padding:24px;max-width:420px;width:100%">' +
    '<h2 style="margin:0 0 8px;font-size:18px">' + esc(title) + '</h2>' +
    '<p style="margin:0 0 12px;font-size:13px;color:var(--mute)">Copiala e mandagliela: non verrà più mostrata.</p>' +
    '<input id="secret-box" readonly value="' + esc(secret) + '" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--line);border-radius:8px;font:600 16px monospace;margin-bottom:14px">' +
    '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" id="secret-copy">Copia</button><button class="btn pri" id="secret-close">Chiudi</button></div></div>';
  document.body.appendChild(ov);
  const box = ov.querySelector('#secret-box');
  box.select();
  ov.querySelector('#secret-copy').onclick = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      ov.querySelector('#secret-copy').textContent = 'Copiata ✓';
    } catch (e) {
      box.select();
    }
  };
  ov.querySelector('#secret-close').onclick = () => ov.remove();
}

const HABIT_LABELS = {
  tempo_pieno: 'Tempo pieno',
  notturno: 'Notturno',
  fine_settimana: 'Fine settimana',
  flessibile: 'Flessibile'
};

const S = {
  city: '', // vuoto = tutte
  search: '',
  cat: 'inserimento', // categoria attiva di default (la priorità per le ops)
  selId: null,
  drivers: [],
  err: '',
  loading: true
};

async function load() {
  if (!(await ready())) return;
  try {
    S.drivers = await Data.driversDirectory(S.city || null);
    S.err = '';
    // Se c'era un driver selezionato, mantienilo aggiornato
    if (S.selId && !S.drivers.some((d) => d.driver_id === S.selId)) {
      S.selId = null;
    }
  } catch (e) {
    console.error(e);
    S.err = 'Impossibile caricare i driver: ' + e.message;
  }
  S.loading = false;
  render();
}

function getCounts(list) {
  return {
    inserimento: list.filter((d) => d.active && d.phase === 'inserimento').length,
    in_rientro: list.filter((d) => d.stato_attivita === 'in_rientro').length,
    inattivo: list.filter((d) => d.active && d.stato_attivita === 'inattivo').length,
    disattivato: list.filter((d) => !d.active).length,
    notturno: list.filter((d) => d.active && d.habit_effettivo === 'notturno').length,
    fine_settimana: list.filter((d) => d.active && d.habit_effettivo === 'fine_settimana').length,
    tempo_pieno: list.filter((d) => d.active && d.habit_effettivo === 'tempo_pieno').length,
    flessibile: list.filter((d) => d.active && d.habit_effettivo === 'flessibile').length
  };
}

function getFilteredDrivers() {
  const q = S.search.toLowerCase().trim();
  let base = S.city ? S.drivers.filter((d) => d.city_code === S.city.toLowerCase()) : S.drivers;

  if (q) {
    return base.filter((d) =>
      (d.full_name || '').toLowerCase().includes(q) ||
      (d.driver_code || '').toLowerCase().includes(q)
    );
  }

  switch (S.cat) {
    case 'inserimento': return base.filter((d) => d.active && d.phase === 'inserimento');
    case 'in_rientro': return base.filter((d) => d.stato_attivita === 'in_rientro');
    case 'inattivo': return base.filter((d) => d.active && d.stato_attivita === 'inattivo');
    case 'disattivato': return base.filter((d) => !d.active);
    case 'notturno': return base.filter((d) => d.active && d.habit_effettivo === 'notturno');
    case 'fine_settimana': return base.filter((d) => d.active && d.habit_effettivo === 'fine_settimana');
    case 'tempo_pieno': return base.filter((d) => d.active && d.habit_effettivo === 'tempo_pieno');
    case 'flessibile': return base.filter((d) => d.active && d.habit_effettivo === 'flessibile');
    default: return base;
  }
}

function render() {
  renderNav();
  const currentCityPool = S.city
    ? S.drivers.filter((d) => d.city_code === S.city.toLowerCase())
    : S.drivers;

  const counts = getCounts(currentCityPool);
  const list = getFilteredDrivers();
  const selDriver = S.drivers.find((d) => d.driver_id === S.selId) || list[0] || null;
  if (selDriver && !S.selId) S.selId = selDriver.driver_id;

  const cityTabs = ['Tutte', ...CITIES].map((c) => {
    const code = c === 'Tutte' ? '' : c;
    const isSel = S.city === code;
    return `<button class="tab ${isSel ? 'on' : ''}" data-city="${esc(code)}">${esc(c)}</button>`;
  }).join('');

  // Riquadri Categorie
  const card = (key, label, num, sub, isAlert = false) => {
    const act = (S.cat === key && !S.search) ? ' active' : '';
    const numStyle = isAlert && num > 0 ? 'color:var(--bd);' : 'color:var(--ink);';
    return `
      <button class="kpi-card${act}" data-cat="${key}">
        <b style="${numStyle}">${num}</b>
        <span>${label}</span>
        <small>${sub}</small>
      </button>
    `;
  };

  // Dettaglio laterale del driver selezionato
  let detailHtml = '<div class="panel-detail" style="color:var(--mute);text-align:center;padding:40px 20px">Nessun driver selezionato.</div>';
  if (selDriver) {
    const d = selDriver;
    const isOver = Boolean(d.habit_override);
    const autoLabel = esc(HABIT_LABELS[d.habit_calc] || d.habit_calc);

    let stBadge = '<span class="tag" style="background:#DEF7EC;color:#03543F">Attivo</span>';
    if (!d.active) stBadge = '<span class="tag" style="background:#E5E2DC;color:#7D7871">Disattivato</span>';
    else if (d.stato_attivita === 'in_rientro') stBadge = '<span class="tag" style="background:#E3EFFD;color:#1E429F">In Rientro</span>';
    else if (d.stato_attivita === 'inattivo') stBadge = '<span class="tag" style="background:#FDE8E8;color:#9B1C1C">Inattivo (30gg)</span>';

    const habitButtons = Object.entries(HABIT_LABELS).map(([k, label]) => {
      const isOn = d.habit_effettivo === k && isOver;
      return `<button class="btn-opt ${isOn ? 'on' : ''}" data-act="set-habit" data-habit="${k}">${label}</button>`;
    }).join('');

    detailHtml = `
      <div class="panel-detail">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <h2>${esc(d.full_name)}</h2>
            <div style="font-size:12px;color:var(--mute)">Cod. ${esc(d.driver_code || '–')} · ${esc(d.city_code.toUpperCase())}</div>
          </div>
          ${stBadge}
        </div>

        <div style="margin:16px 0;padding:12px;background:#FAF9F7;border-radius:6px;border:1px solid var(--line)">
          <div style="font-size:11px;font-weight:700;color:var(--mute);text-transform:uppercase">Fase operativa</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
            <b>${d.phase === 'inserimento' ? 'Inserimento (solo diurno)' : 'Pieno (h24)'}</b>
            <button class="btn-prom" data-act="toggle-phase" data-id="${esc(d.driver_id)}" data-phase="${esc(d.phase)}">
              ${d.phase === 'inserimento' ? 'Sblocca a Pieno' : 'Retrocedi a Inserimento'}
            </button>
          </div>
        </div>

        <div style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:11px;font-weight:700;color:var(--mute);text-transform:uppercase">Abitudine di lavoro</span>
            ${isOver ? '<button class="nav-mini" style="font-size:11px;width:auto;padding:2px 8px" data-act="reset-habit" title="Ripristina calcolo automatico">↺ Auto (' + autoLabel + ')</button>' : ''}
          </div>
          <div style="font-size:12px;margin:4px 0 6px 0">
            Attuale: <b>${esc(HABIT_LABELS[d.habit_effettivo] || d.habit_effettivo)}</b> 
            <small style="color:var(--mute)">(${isOver ? 'fissata a mano' : 'auto da storico'})</small>
          </div>
          <div class="btn-group-habit">${habitButtons}</div>
        </div>

        <div style="font-size:12px">
          <div class="panel-row"><span>Slot ultimi 30gg:</span><b>${n(d.slot_30d)} (${n(d.ore_30d)} ore)</b></div>
          <div class="panel-row"><span>Slot futuri prenotati:</span><b>${n(d.prossimi_slot)}</b></div>
          <div class="panel-row"><span>Ultimo slot completato:</span><b>${esc(d.ultimo_slot || 'Nessuno')}</b></div>
        </div>

        <div style="margin-top:20px;padding-top:14px;border-top:1px solid var(--line);text-align:right">
          <button class="btn-prom" style="margin-right:8px" data-act="reset-pw" data-id="${esc(d.driver_id)}" data-name="${esc(d.full_name)}">Reimposta password</button>
          <button class="btn-prom ${d.active ? 'btn-danger' : 'btn-active'}" data-act="toggle-active" data-id="${esc(d.driver_id)}" data-active="${d.active}">
            ${d.active ? 'Disattiva Driver' : 'Riattiva Driver'}
          </button>
        </div>
      </div>
    `;
  }

  // Lista a sinistra
  const rows = list.map((d) => {
    const isSel = selDriver && selDriver.driver_id === d.driver_id;
    const tagFase = d.phase === 'inserimento' ? '<span class="tag" style="background:#FEF08A;color:#713F12">Ins.</span>' : '';
    const habName = esc(HABIT_LABELS[d.habit_effettivo] || d.habit_effettivo);

    return `
      <div class="driver-item ${isSel ? 'sel' : ''}" data-select-driver="${esc(d.driver_id)}">
        <div>
          <b>${esc(d.full_name)}</b> ${tagFase}
          <div style="font-size:11px;color:var(--mute);margin-top:2px">
            Cod. ${esc(d.driver_code || '–')} · ${esc(d.city_code.toUpperCase())} · <span style="color:var(--ink)">${habName}</span>
          </div>
        </div>
        <div style="text-align:right;font-size:12px">
          <b>${n(d.ore_30d)}h</b>
          <div style="font-size:11px;color:var(--mute)">${n(d.prossimi_slot) ? n(d.prossimi_slot) + ' pr.' : '0 pr.'}</div>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('app').innerHTML = `
    <div class="row">
      <h1>Otoqi <span>· Gestione Driver</span></h1>
      <button class="nav" data-act="refresh" aria-label="Aggiorna">↻</button>
    </div>

    <div class="row" style="margin-bottom:14px">
      <div style="display:flex;gap:8px;flex-wrap:wrap">${cityTabs}</div>
      <input type="text" id="searchInput" placeholder="Cerca nome o codice..." value="${esc(S.search)}" class="search-box">
    </div>

    ${S.err ? '<div class="msg err">' + esc(S.err) + '</div>' : ''}

    <div class="dash-sec-title">Stato Operativo</div>
    <div class="card-grid">
      ${card('inserimento', 'In Inserimento', counts.inserimento, 'Solo diurno, da sbloccare', true)}
      ${card('in_rientro', 'In Rientro', counts.in_rientro, 'Tornati a prenotare')}
      ${card('inattivo', 'Inattivi', counts.inattivo, '0 slot nelle ultime 4 sett.')}
      ${card('disattivato', 'Disattivati', counts.disattivato, 'Accesso revocato')}
    </div>

    <div class="dash-sec-title">Abitudini di Lavoro</div>
    <div class="card-grid">
      ${card('tempo_pieno', 'Tempo Pieno', counts.tempo_pieno, '20+ slot al mese')}
      ${card('notturno', 'Notturni', counts.notturno, 'Prevalenza 21–09')}
      ${card('fine_settimana', 'Fine Settimana', counts.fine_settimana, 'Prevalenza Sab–Dom')}
      ${card('flessibile', 'Flessibili', counts.flessibile, 'Nessun pattern fisso')}
    </div>

    <div class="drill-view">
      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:12px 14px;border-bottom:1px solid var(--line);background:#FAF9F7;font-size:12px;font-weight:700;display:flex;justify-content:space-between">
          <span>${S.search ? 'Risultati ricerca per "' + esc(S.search) + '"' : 'Elenco: ' + esc(S.cat.replace('_', ' ').toUpperCase())}</span>
          <span>${list.length} driver</span>
        </div>
        <div style="max-height:560px;overflow-y:auto">
          ${rows || '<div style="padding:24px;text-align:center;color:var(--mute)">Nessun driver in questa visualizzazione.</div>'}
        </div>
      </div>
      <div>${detailHtml}</div>
    </div>
  `;
}

// Gestione eventi e interazioni
document.getElementById('app').addEventListener('input', (e) => {
  if (e.target.id === 'searchInput') {
    const pos = e.target.selectionStart;
    S.search = e.target.value;
    render();
    const box = document.getElementById('searchInput');
    box.focus();
    box.setSelectionRange(pos, pos);
  }
});

document.getElementById('app').addEventListener('click', async (e) => {
  const t = e.target.closest('button, .kpi-card, .driver-item');
  if (!t) return;
  const d = t.dataset;

  try {
    if (d.city !== undefined) {
      S.city = d.city;
      S.selId = null;
      render();
    } else if (d.cat) {
      S.cat = d.cat;
      S.search = '';
      S.selId = null;
      render();
    } else if (d.selectDriver) {
      S.selId = d.selectDriver;
      render();
    } else if (d.act === 'refresh') {
      load();
    } else if (d.act === 'toggle-phase') {
      const next = d.phase === 'inserimento' ? 'pieno' : 'inserimento';
      const msg = next === 'pieno'
        ? 'Sbloccare il driver? Da ora vedrà e potrà prenotare tutti gli slot, inclusi quelli notturni.'
        : 'Riportare il driver in inserimento? Potrà prenotare solo la fascia diurna.';
      if (!confirm(msg)) return;
      const r = await Data.setPhase(d.id, next);
      if (r?.esito !== 'ok') throw new Error(r?.esito || 'errore');
      await load();
    } else if (d.act === 'toggle-active') {
      const curActive = d.active === 'true';
      const msg = curActive
        ? 'Disattivare il driver? Non potrà più accedere né prenotarsi.'
        : 'Riattivare il driver?';
      if (!confirm(msg)) return;
      await Data.toggleDriverActive(d.id, !curActive);
      await load();
    } else if (d.act === 'reset-pw') {
      if (!confirm('Reimpostare la password di ' + d.name + '? Verrà disconnesso e dovrà sceglierne una nuova al prossimo accesso.')) return;
      const r = await Data.resetPassword(d.id);
      if (r?.esito === 'driver_senza_accesso') throw new Error('Questo driver non ha ancora un accesso creato.');
      if (r?.esito !== 'ok') throw new Error(r?.esito || 'errore');
      showSecret('Password temporanea di ' + d.name, r.password);
    } else if (d.act === 'set-habit') {
      await Data.setDriverHabit(S.selId, d.habit);
      await load();
    } else if (d.act === 'reset-habit') {
      await Data.setDriverHabit(S.selId, null);
      await load();
    }
  } catch (err) {
    alert('Operazione non riuscita: ' + err.message);
  }
});

load();