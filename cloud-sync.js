/* Cloud sync adapter for Cham Công & Tính Lương V4
   - Keeps the existing localStorage data as the local/offline source.
   - Optional Supabase sync can be enabled from Settings after entering:
       window.TIMEPAY_SUPABASE_URL
       window.TIMEPAY_SUPABASE_ANON_KEY
   - The app can continue to work locally when cloud sync is not configured.
*/
(function () {
  "use strict";

  const CLOUD_KEY = "timepay_cloud_config_v1";
  const LOCAL_KEY = "timepay_v1";

  function getConfig() {
    try {
      return JSON.parse(localStorage.getItem(CLOUD_KEY) || "null");
    } catch (_) {
      return null;
    }
  }

  function setConfig(config) {
    localStorage.setItem(CLOUD_KEY, JSON.stringify(config || null));
  }

  async function request(path, options = {}) {
    const cfg = getConfig();
    if (!cfg || !cfg.url || !cfg.anonKey) {
      throw new Error("Cloud sync chưa được cấu hình.");
    }
    const res = await fetch(cfg.url.replace(/\/$/, "") + path, {
      ...options,
      headers: {
        apikey: cfg.anonKey,
        Authorization: "Bearer " + cfg.anonKey,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error("Cloud error " + res.status + (body ? ": " + body : ""));
    }
    return res.status === 204 ? null : res.json();
  }

  async function pull(userId) {
    const rows = await request(
      "/rest/v1/timepay_records?select=id,user_id,payload,updated_at&user_id=eq." +
      encodeURIComponent(userId) + "&order=updated_at.desc"
    );
    return rows || [];
  }

  async function push(userId, payload) {
    const id = userId;
    const now = new Date().toISOString();
    const rows = await request("/rest/v1/timepay_records?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([{ id, user_id: userId, payload, updated_at: now }])
    });
    return rows && rows[0] ? rows[0] : null;
  }

  window.TimePayCloud = {
    getConfig,
    setConfig,
    isConfigured: () => {
      const c = getConfig();
      return !!(c && c.url && c.anonKey);
    },
    pull,
    push,
    LOCAL_KEY
  };
})();