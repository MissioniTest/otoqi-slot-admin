import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { isoDay } from './utils.js';

export const sb = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

async function call(fn, params) {
  if (!sb) return null;
  const { data, error } = await sb.rpc(fn, params);
  if (error) {
    if (String(error.message).includes('non_autorizzato')) {
      throw new Error('non_autorizzato');
    }
    throw error;
  }
  return data;
}

const city = (c) => (c ? c.toLowerCase() : null);

export const Data = {
  // --- autenticazione e sessione ---
  async login(email, password) {
    return await sb.auth.signInWithPassword({ email, password });
  },
  async logout() {
    return await sb.auth.signOut();
  },
  async getSession() {
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data?.session || null;
  },
  async getMe() {
    return (await call('admin_get_me')) || null;
  },

  // --- gestione team ops (solo superadmin) ---
  listOps() {
    return call('admin_list_ops').then((d) => d || []);
  },
  createOps(email, password) {
    return call('admin_create_ops', { p_email: email, p_password: password });
  },
  toggleOpsActive(userId, active) {
    return call('admin_toggle_ops_active', { p_user_id: userId, p_active: active });
  },

  // --- letture slot ---
  async week(c, ws) {
    return (await call('admin_get_week', { p_city: city(c), p_week_start: isoDay(ws) })) || [];
  },
  async unbooked(c, ws) {
    return (await call('admin_get_unbooked', { p_city: city(c), p_week_start: isoDay(ws) })) || [];
  },
  inserimenti(c) {
    return call('admin_get_inserimenti', { p_city: city(c) }).then((d) => d || []);
  },

  // --- anagrafica driver ---
  driversDirectory(c) {
    return call('admin_get_drivers_directory', { p_city: city(c) }).then((d) => d || []);
  },
  toggleDriverActive(driverId, active) {
    return call('admin_toggle_driver_active', { p_driver_id: driverId, p_active: active });
  },
  setDriverHabit(driverId, habit) {
    return call('admin_set_driver_habit', { p_driver_id: driverId, p_habit: habit || null });
  },
  resetPassword(driverId) {
    return call('admin_reset_driver_password', { p_driver_id: driverId });
  },

  // --- email automatiche (solo superadmin) ---
  emailTemplates() {
    return call('admin_list_email_templates').then((d) => d || []);
  },
  saveEmailTemplate(key, oggetto, corpo, attivo) {
    return call('admin_save_email_template', { p_key: key, p_oggetto: oggetto, p_corpo: corpo, p_attivo: attivo });
  },
  emailQueue(limit = 50) {
    return call('admin_get_email_queue', { p_limit: limit }).then((d) => d || []);
  },
  emailStatus() {
    return call('admin_get_email_status');
  },
  setEmailMode(modalita, destinatario) {
    return call('admin_set_email_mode', { p_modalita: modalita, p_destinatario: destinatario || null });
  },

  // --- gestione operatività slot ---
  promote(slotId, driverId) {
    return call('admin_promote_driver', { p_slot_id: Number(slotId), p_driver_id: driverId });
  },
  setPhase(driverId, phase) {
    return call('admin_set_phase', { p_driver_id: driverId, p_phase: phase });
  },

  // --- pianificazione e pubblicazione ---
  plan(slots, dryRun = false) {
    return call('admin_plan_slots', { p_slots: slots, p_dry_run: dryRun });
  },
  setPublish(c, from, to, when) {
    return call('admin_set_publish', {
      p_city: city(c), p_from: isoDay(from), p_to: isoDay(to),
      p_when: when ? when.toISOString() : null
    });
  },
  publishNow(c, from, to) {
    return call('admin_publish_now', { p_city: city(c), p_from: isoDay(from), p_to: isoDay(to) });
  },
  deleteDrafts(c, from, to) {
    return call('admin_delete_drafts', { p_city: city(c), p_from: isoDay(from), p_to: isoDay(to) });
  }
};