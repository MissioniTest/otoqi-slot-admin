import { esc } from './utils.js';
import { Data } from './api.js';
import { renderNav } from './nav.js';

const S = {
  list: [],
  err: '',
  loading: true
};

async function load() {
  S.loading = true;
  try {
    S.list = await Data.listOps();
    S.err = '';
  } catch (e) {
    console.error(e);
    S.err = e.message === 'non_autorizzato' ? 'Accesso riservato al Dittatore.' : e.message;
  }
  S.loading = false;
  render();
}

function render() {
  renderNav();
  const app = document.getElementById('app');

  if (S.err) {
    app.innerHTML = `<div class="msg err">${esc(S.err)}</div>`;
    return;
  }

  const rows = S.list.map((u) => {
    const isMe = u.role === 'superadmin';
    const tag = u.role === 'superadmin' 
      ? '<span class="tag" style="background:#2B1A1D;color:#fff">Dittatore</span>' 
      : '<span class="tag">Ops</span>';

    const stBadge = u.active
      ? '<span class="tag" style="background:#DEF7EC;color:#03543F">Attivo</span>'
      : '<span class="tag" style="background:#FDE8E8;color:#9B1C1C">Disattivato</span>';

    const actionBtn = isMe
      ? ''
      : `<button class="btn-prom ${u.active ? 'btn-danger' : 'btn-active'}" data-toggle-id="${u.auth_user_id}" data-active="${u.active}">
          ${u.active ? 'Disattiva' : 'Riattiva'}
        </button>`;

    return `
      <div class="li" style="padding:12px 14px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between">
        <div>
          <b>${esc(u.email)}</b> ${tag} ${stBadge}
        </div>
        <div>${actionBtn}</div>
      </div>
    `;
  }).join('');

  app.innerHTML = `
    <div class="row">
      <h1>Otoqi <span>· Team Ops</span></h1>
      <button class="nav" data-act="refresh" aria-label="Aggiorna">↻</button>
    </div>

    <div class="main" style="display:grid;grid-template-columns:1fr 360px;gap:20px;align-items:start">
      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:14px;background:#FAF9F7;border-bottom:1px solid var(--line);font-weight:700">
          Operatori con accesso al Backoffice (${S.list.length})
        </div>
        ${S.loading ? '<div class="msg">Caricamento…</div>' : rows}
      </div>

      <div class="card">
        <h2>Aggiungi Operatore Ops</h2>
        <div class="sub">Crea un account per un nuovo membro del team Ops.</div>
        <form id="add-ops-form" style="margin-top:14px">
          <div style="margin-bottom:12px">
            <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">Email</label>
            <input type="email" id="new-email" required placeholder="mario.rossi@otoqi.com" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:6px">
          </div>
          <div style="margin-bottom:16px">
            <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">Password Temporanea</label>
            <input type="password" id="new-pw" required placeholder="Minimo 8 caratteri" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:6px">
          </div>
          <button type="submit" class="btn pri" style="width:100%">Crea Account Ops</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('add-ops-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const em = document.getElementById('new-email').value.trim();
    const pw = document.getElementById('new-pw').value;

    if (pw.length < 6) {
      alert('La password deve contenere almeno 6 caratteri.');
      return;
    }

    try {
      const res = await Data.createOps(em, pw);
      if (res?.esito === 'email_esistente') {
        alert('Questa email è già registrata a sistema.');
        return;
      }
      if (res?.esito !== 'ok') throw new Error(res?.esito || 'Errore');
      alert('Operatore ' + em + ' creato con successo!');
      load();
    } catch (err) {
      alert('Impossibile creare l\'account: ' + err.message);
    }
  });
}

document.getElementById('app').addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  const d = t.dataset;

  if (d.act === 'refresh') {
    load();
  } else if (d.toggleId) {
    const curActive = d.active === 'true';
    if (!confirm(curActive ? 'Disattivare questo operatore? Non potrà più accedere.' : 'Riattivare questo operatore?')) return;
    try {
      await Data.toggleOpsActive(d.toggleId, !curActive);
      load();
    } catch (err) {
      alert('Errore: ' + err.message);
    }
  }
});

load();