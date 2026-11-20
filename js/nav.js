import { Data } from './api.js';

export async function renderNav() {
  const el = document.getElementById('nav');
  if (!el) return;

  const session = await Data.getSession();

  if (!session) {
    el.innerHTML = `
      <div id="login-overlay" style="position:fixed;inset:0;background:#FAF9F7;z-index:99999;display:flex;align-items:center;justify-content:center;font-family:inherit;">
        <div style="background:#fff;border:1px solid #E5E2DC;border-radius:12px;padding:32px;width:100%;max-width:380px;box-shadow:0 8px 24px rgba(0,0,0,0.06);">
          <div style="margin-bottom:24px;text-align:center;">
            <h2 style="margin:0 0 6px 0;font-size:22px;color:#1E1E1E;">Otoqi · Backoffice</h2>
            <span style="font-size:13px;color:#7D7871;">Accedi per gestire slot e driver</span>
          </div>
          <form id="login-form">
            <div style="margin-bottom:14px;">
              <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:#4B4741;">Email</label>
              <input type="email" id="login-email" required placeholder="nome@otoqi.com" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #D5D1CA;border-radius:6px;font-size:14px;outline:none;">
            </div>
            <div style="margin-bottom:20px;">
              <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:#4B4741;">Password</label>
              <input type="password" id="login-password" required placeholder="••••••••" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #D5D1CA;border-radius:6px;font-size:14px;outline:none;">
            </div>
            <div id="login-error" style="color:#9B1C1C;font-size:12px;margin-bottom:12px;display:none;"></div>
            <button type="submit" id="login-submit" style="width:100%;padding:11px;background:#1E1E1E;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;">Accedi</button>
          </form>
        </div>
      </div>
    `;

    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const errBox = document.getElementById('login-error');
      const btn = document.getElementById('login-submit');

      btn.disabled = true;
      btn.innerText = 'Accesso in corso…';
      errBox.style.display = 'none';

      try {
        const { error } = await Data.login(email, password);
        if (error) throw error;
        window.location.reload();
      } catch (err) {
        errBox.textContent = 'Credenziali non valide o account disattivato.';
        errBox.style.display = 'block';
        btn.disabled = false;
        btn.innerText = 'Accedi';
      }
    });
    return;
  }

  // Verifica profilo e ruolo
  const me = await Data.getMe();
  const isBoss = me?.role === 'superadmin'; // nel database resta "superadmin": "Dittatore" è solo il nome mostrato
  const cur = location.pathname.split('/').pop() || 'index.html';

  // Stili della barra (iniettati qui: non serve toccare style.css)
  if (!document.getElementById('nav-extra-css')) {
    const st = document.createElement('style');
    st.id = 'nav-extra-css';
    st.textContent = `
      .nav-wrap { width: 100%; }
      .nav-user { display: flex; justify-content: flex-end; align-items: center; gap: 10px; font-size: 12px; color: var(--mute); margin-bottom: 8px; flex-wrap: wrap; }
      .nav-user .role { background: #2B1A1D; color: #fff; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; border-radius: 999px; padding: 2px 9px; }
      .nav-row { display: flex; justify-content: space-between; align-items: center; gap: 12px 24px; flex-wrap: wrap; margin-bottom: 20px; }
      .nav-main { display: flex; gap: 6px; flex-wrap: wrap; }
      .sa-group { display: flex; align-items: center; gap: 4px; background: #2B1A1D; border-radius: 999px; padding: 4px 6px 4px 16px; }
      .sa-label { font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #D9B3BB; margin-right: 8px; }
      .sa-group a.tab { border-color: transparent; color: #fff; padding: 6px 16px; }
      .sa-group a.tab:hover { background: rgba(255,255,255,.16); }
      .sa-group a.tab.on { background: #fff; color: #2B1A1D; }
    `;
    document.head.appendChild(st);
  }

  const mainLinks = [
    { href: 'index.html', label: 'Controllo' },
    { href: 'pianifica.html', label: 'Pianifica' },
    { href: 'pubblica.html', label: 'Pubblica' },
    { href: 'driver.html', label: 'Driver' }
  ];

  // Solo per il Dittatore: le ops non li vedono
  const bossLinks = [
    { href: 'ops.html', label: 'Team Ops' },
    { href: 'email.html', label: 'Email' }
  ];

  const tab = (l) => {
    const on = (cur === l.href || (cur === '' && l.href === 'index.html')) ? ' on' : '';
    return `<a href="${l.href}" class="tab${on}">${l.label}</a>`;
  };

  el.innerHTML = `
    <div class="nav-wrap">
      <div class="nav-user">
        <span>${session.user.email}</span>
        ${isBoss ? '<span class="role">Dittatore</span>' : ''}
        <button id="logout-btn" class="nav-mini" style="cursor:pointer;font-weight:600;padding:4px 10px;width:auto;" title="Disconnetti">Esci</button>
      </div>
      <div class="nav-row">
        <div class="nav-main">${mainLinks.map(tab).join('')}</div>
        ${isBoss ? `<div class="sa-group"><span class="sa-label">Dittatore</span>${bossLinks.map(tab).join('')}</div>` : ''}
      </div>
    </div>
  `;

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await Data.logout();
    window.location.reload();
  });
}
// Controllo d'accesso per le pagine: true solo se loggato e abilitato al backoffice
export async function ready() {
  const session = await Data.getSession();
  if (!session) {
    await renderNav(); // mostra la schermata di login
    return false;
  }
  const me = await Data.getMe();
  if (me?.esito !== 'ok') {
    await renderNav();
    document.getElementById('app').innerHTML =
      '<div class="msg err">Questo account non ha accesso al backoffice.</div>';
    return false;
  }
  return true;
}