import { esc } from './utils.js';
import { Data } from './api.js';
import { renderNav } from './nav.js';

// Dati di esempio per l'anteprima (solo grafica: non vengono salvati da nessuna parte)
const SAMPLE = {
  nome: 'Mario',
  data: 'giovedì 19 novembre',
  citta: 'Milano',
  ora_inizio: '01:00',
  ora_fine: '09:00',
  durata: '8',
  anticipo: '2 ore'
};

const STATI = {
  da_inviare: ['In coda', '#E3EFFD', '#1E429F'],
  in_invio: ['In invio', '#FEF08A', '#713F12'],
  inviata: ['Inviata', '#DEF7EC', '#03543F'],
  errore: ['Errore', '#FDE8E8', '#9B1C1C'],
  saltata: ['Saltata', '#E5E2DC', '#7D7871']
};

const S = {
  templates: [],
  sel: null,
  draft: null,
  dirty: false,
  queue: [],
  status: null,
  msg: null, // { ok: boolean, text: string }
  err: '',
  loading: true,
  focus: 'corpo'
};

const app = document.getElementById('app');
const cur = () => S.templates.find((t) => t.key === S.sel) || null;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fill = (txt) => String(txt ?? '').replace(/\{\{([^}]*)\}\}/g, (m, k) => (k in SAMPLE ? SAMPLE[k] : m));
const preview = (txt) =>
  esc(fill(txt)).replace(/\{\{[^}]*\}\}/g, (m) => '<mark style="background:#FDE8E8;color:#9B1C1C">' + m + '</mark>');

const fmtDt = (iso) =>
  iso
    ? new Date(iso).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '–';

function pick(key) {
  S.sel = key;
  const t = cur();
  S.draft = t ? { oggetto: t.oggetto, corpo: t.corpo, attivo: t.attivo } : null;
  S.dirty = false;
  S.msg = null;
}

async function load() {
  S.loading = true;
  render();
  try {
    const me = await Data.getMe();
    if (me?.role !== 'superadmin') {
      S.err = 'Accesso riservato al Dittatore.';
      S.loading = false;
      render();
      return;
    }
    const [templates, queue, status] = await Promise.all([Data.emailTemplates(), Data.emailQueue(50), Data.emailStatus()]);
    S.templates = templates;
    S.queue = queue;
    S.status = status;
    if (!S.sel || !templates.some((t) => t.key === S.sel)) pick(templates[0]?.key || null);
    else if (!S.dirty) pick(S.sel);
    S.err = '';
  } catch (e) {
    console.error(e);
    S.err = e.message === 'non_autorizzato' ? 'Accesso riservato al Dittatore.' : 'Impossibile caricare: ' + e.message;
  }
  S.loading = false;
  render();
}

// Aggiorna solo coda e banner, senza perdere ciò che stai scrivendo
async function refreshQueue() {
  try {
    const [queue, status] = await Promise.all([Data.emailQueue(50), Data.emailStatus()]);
    S.queue = queue;
    S.status = status;
  } catch (e) {
    S.msg = { ok: false, text: 'Aggiornamento non riuscito: ' + e.message };
  }
  render();
}

function banner() {
  const s = S.status || {};
  const stat = (s.in_coda || 0) + ' in coda · ' + (s.errori || 0) + ' errori negli ultimi 7 giorni';
  if (s.modalita === 'reale') {
    return `<div class="card" style="border-color:#BCF0DA;background:#F3FBF7;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <div><b>Invio REALE attivo</b><div class="em-small">Le email partono verso i driver. ${stat}</div></div>
      <button class="btn dng" data-act="mode-test">Torna in modalità test</button></div>`;
  }
  const dest = s.destinatario_test
    ? 'tutte le email vanno a <b>' + esc(s.destinatario_test) + '</b>'
    : '<b>nessuna email parte</b> (manca il destinatario di prova)';
  return `<div class="card" style="border-color:#F5D97A;background:#FFFBEA;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
    <div><b>Modalità TEST</b> · ${dest}<div class="em-small">${stat}</div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn" data-act="set-dest">Cambia destinatario di prova</button>
      <button class="btn pri" data-act="mode-real">Passa a invio reale</button>
    </div></div>`;
}

function editor() {
  const t = cur();
  const d = S.draft;
  if (!t || !d) return '<div class="card"><div class="em-small">Nessuna email selezionata.</div></div>';

  const chips = (t.variabili || [])
    .map((v) => `<button type="button" class="em-chip" data-ins="{{${esc(v)}}}" title="Inserisci nel testo">{{${esc(v)}}}</button>`)
    .join('');

  return `<div class="card">
    <div class="row">
      <div><h2 style="margin:0">${esc(t.descrizione)}</h2><div class="em-small">Codice: ${esc(t.key)} · ultima modifica ${fmtDt(t.updated_at)}</div></div>
      <span id="dirty" class="tag" style="background:#FEF08A;color:#713F12;${S.dirty ? '' : 'display:none'}">Modifiche non salvate</span>
    </div>

    <label class="em-lbl" for="f-oggetto">Oggetto</label>
    <input id="f-oggetto" class="em-in" type="text" value="${esc(d.oggetto)}">

    <label class="em-lbl" for="f-corpo">Testo</label>
    <textarea id="f-corpo" class="em-in">${esc(d.corpo)}</textarea>

    <div class="em-small" style="margin-top:8px">Segnaposto disponibili (clicca per inserirlo dove stai scrivendo):</div>
    <div class="em-chips">${chips}</div>

    <label class="em-lbl" style="display:flex;gap:8px;align-items:center;font-weight:500">
      <input id="f-attivo" type="checkbox" ${d.attivo ? 'checked' : ''}>
      Email attiva (se la spegni, non viene più creata)
    </label>

    ${S.msg ? `<div class="${S.msg.ok ? 'em-ok' : 'em-ko'}" style="margin-top:10px">${esc(S.msg.text)}</div>` : ''}

    <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
      <button id="btn-save" class="btn pri" data-act="save"${S.dirty ? '' : ' disabled'}>Salva modifiche</button>
      <button id="btn-reset" class="btn" data-act="reset"${S.dirty ? '' : ' disabled'}>Annulla modifiche</button>
    </div>

    <div class="em-lbl" style="margin-top:22px">Anteprima (con dati di esempio)</div>
    <div class="em-prev"><b id="prev-subj">${preview(d.oggetto)}</b>\n\n<span id="prev-body">${preview(d.corpo)}</span></div>
  </div>`;
}

function queueCard() {
  const rows = S.queue
    .map((q) => {
      const [lab, bg, fg] = STATI[q.stato] || [q.stato, '#E5E2DC', '#7D7871'];
      const err = q.ultimo_errore ? `<div class="em-small" style="color:#9B1C1C">${esc(q.ultimo_errore)}</div>` : '';
      return `<div class="li" style="align-items:flex-start">
        <span style="min-width:0"><b>${esc(q.oggetto)}</b><br>
          <span class="em-small">${esc(q.a_email)}${q.driver ? ' · ' + esc(q.driver) : ''} · ${esc(q.template_key)} · creata ${fmtDt(q.created_at)}${q.inviata_il ? ' · inviata ' + fmtDt(q.inviata_il) : ''}</span>${err}</span>
        <span class="tag" style="background:${bg};color:${fg};white-space:nowrap">${lab}${q.tentativi > 1 ? ' · ' + q.tentativi + ' tent.' : ''}</span>
      </div>`;
    })
    .join('');
  return `<div class="card">
    <div class="row"><h2 style="margin:0">Storico invii</h2><button class="nav" data-act="refresh" aria-label="Aggiorna">↻</button></div>
    <div class="em-small" style="margin:6px 0 4px">Le ultime 50 email create dal sistema. In modalità test l'indirizzo è quello di prova e l'oggetto inizia con [TEST per …].</div>
    ${rows || '<div class="em-small" style="padding:12px 0">Ancora nessuna email.</div>'}
  </div>`;
}

function render() {
  renderNav();
  if (S.err) {
    app.innerHTML = `<div class="msg err">${esc(S.err)}</div>`;
    return;
  }
  if (S.loading && !S.templates.length) {
    app.innerHTML = '<div class="msg">Caricamento…</div>';
    return;
  }

  const list = S.templates
    .map(
      (t) => `<div class="driver-item ${t.key === S.sel ? 'sel' : ''}" data-key="${esc(t.key)}">
        <div><b>${esc(t.descrizione)}</b><div class="em-small" style="margin-top:2px">${esc(t.key)}</div></div>
        <span class="tag" style="${t.attivo ? 'background:#DEF7EC;color:#03543F' : 'background:#E5E2DC;color:#7D7871'}">${t.attivo ? 'Attiva' : 'Spenta'}</span>
      </div>`
    )
    .join('');

  app.innerHTML = `
    <div class="row"><h1>Otoqi <span>· Email automatiche</span></h1></div>
    ${banner()}
    <div class="em-grid">
      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:12px 14px;border-bottom:1px solid var(--line);background:#FAF9F7;font-size:12px;font-weight:700">Casistiche (${S.templates.length})</div>
        ${list || '<div class="em-small" style="padding:14px">Nessuna casistica.</div>'}
        <div class="em-small" style="padding:12px 14px;border-top:1px solid var(--line)">Le nuove casistiche compaiono qui quando vengono aggiunte al sistema.</div>
      </div>
      ${editor()}
    </div>
    ${queueCard()}`;
}

// ---- eventi -------------------------------------------------------------

function refreshPreviewAndState() {
  const subj = document.getElementById('prev-subj');
  const body = document.getElementById('prev-body');
  if (subj) subj.innerHTML = preview(S.draft.oggetto);
  if (body) body.innerHTML = preview(S.draft.corpo);
  const t = cur();
  S.dirty = !!t && (S.draft.oggetto !== t.oggetto || S.draft.corpo !== t.corpo || S.draft.attivo !== t.attivo);
  const dirty = document.getElementById('dirty');
  if (dirty) dirty.style.display = S.dirty ? '' : 'none';
  const save = document.getElementById('btn-save');
  const reset = document.getElementById('btn-reset');
  if (save) save.disabled = !S.dirty;
  if (reset) reset.disabled = !S.dirty;
}

app.addEventListener('input', (e) => {
  if (!S.draft) return;
  if (e.target.id === 'f-oggetto') S.draft.oggetto = e.target.value;
  else if (e.target.id === 'f-corpo') S.draft.corpo = e.target.value;
  else return;
  S.msg = null;
  refreshPreviewAndState();
});

app.addEventListener('change', (e) => {
  if (e.target.id === 'f-attivo' && S.draft) {
    S.draft.attivo = e.target.checked;
    refreshPreviewAndState();
  }
});

app.addEventListener('focusin', (e) => {
  if (e.target.id === 'f-oggetto') S.focus = 'oggetto';
  if (e.target.id === 'f-corpo') S.focus = 'corpo';
});

async function save() {
  const t = cur();
  if (!t || !S.draft) return;
  try {
    const r = await Data.saveEmailTemplate(t.key, S.draft.oggetto, S.draft.corpo, S.draft.attivo);
    if (r?.esito === 'ok') {
      S.templates = await Data.emailTemplates();
      pick(t.key);
      S.msg = { ok: true, text: 'Salvato.' };
    } else if (r?.esito === 'variabile_sconosciuta') {
      const amm = (r.ammesse || []).map((a) => '{{' + a + '}}').join(', ');
      S.msg = { ok: false, text: 'Segnaposto non ammesso: ' + r.variabile + '. Ammessi: ' + amm };
    } else if (r?.esito === 'testo_vuoto') {
      S.msg = { ok: false, text: 'Oggetto e testo non possono essere vuoti.' };
    } else {
      S.msg = { ok: false, text: 'Non salvato: ' + (r?.esito || 'errore') };
    }
  } catch (err) {
    S.msg = { ok: false, text: 'Non salvato: ' + err.message };
  }
  render();
}

async function setMode(modalita, destinatario) {
  const r = await Data.setEmailMode(modalita, destinatario);
  if (r?.esito === 'email_non_valida') throw new Error('Indirizzo email non valido.');
  if (r?.esito !== 'ok') throw new Error(r?.esito || 'errore');
  await refreshQueue();
}

app.addEventListener('click', async (e) => {
  const chip = e.target.closest('[data-ins]');
  if (chip && S.draft) {
    const el = document.getElementById(S.focus === 'oggetto' ? 'f-oggetto' : 'f-corpo');
    if (!el) return;
    const a = el.selectionStart ?? el.value.length;
    const b = el.selectionEnd ?? a;
    el.value = el.value.slice(0, a) + chip.dataset.ins + el.value.slice(b);
    el.focus();
    el.selectionStart = el.selectionEnd = a + chip.dataset.ins.length;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }

  const item = e.target.closest('[data-key]');
  if (item) {
    if (item.dataset.key === S.sel) return;
    if (S.dirty && !confirm('Hai modifiche non salvate: le perdi se cambi email. Continuare?')) return;
    pick(item.dataset.key);
    render();
    return;
  }

  const t = e.target.closest('button');
  if (!t) return;
  const act = t.dataset.act;

  try {
    if (act === 'save') await save();
    else if (act === 'reset') {
      pick(S.sel);
      render();
    } else if (act === 'refresh') await refreshQueue();
    else if (act === 'mode-real') {
      if (!confirm('Da ora le email partono verso i DRIVER VERI. Hai controllato testi e destinatari? Continuare?')) return;
      await setMode('reale', null);
    } else if (act === 'mode-test') {
      await setMode('test', null);
    } else if (act === 'set-dest') {
      const now = S.status?.destinatario_test || '';
      const v = prompt('A quale indirizzo devono arrivare le email di prova?', now);
      if (v === null) return;
      if (!EMAIL_RE.test(v.trim())) throw new Error('Indirizzo email non valido.');
      await setMode('test', v.trim());
    }
  } catch (err) {
    alert('Operazione non riuscita: ' + err.message);
  }
});

window.addEventListener('beforeunload', (e) => {
  if (S.dirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

load();