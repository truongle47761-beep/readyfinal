/* TimePay V4 cloud/auth client.
   Uses Supabase's browser CDN. Works on GitHub Pages.
*/
(() => {
  "use strict";
  const LOCAL_KEY = "timepay_v1";
  let client = null;

  function config() {
    return window.TIMEPAY_SUPABASE || {url:"", anonKey:""};
  }
  function configured() {
    const c=config();
    return !!(c.url && c.anonKey);
  }
  function statusText() {
    if (!configured()) return "Chưa cấu hình cloud";
    return client ? "Đã kết nối cloud" : "Cloud đã cấu hình";
  }
  async function init() {
    if (!configured()) return null;
    if (!window.supabase) throw new Error("Chưa tải được thư viện Supabase.");
    client = window.supabase.createClient(config().url, config().anonKey);
    return client;
  }
  async function user() {
    if (!client) await init();
    if (!client) return null;
    const {data, error}=await client.auth.getUser();
    if(error) throw error;
    return data.user;
  }
  async function signUp(email,password) {
    if(!client) await init();
    if(!client) throw new Error("Chưa cấu hình Supabase.");
    return await client.auth.signUp({email,password});
  }
  async function signIn(email,password) {
    if(!client) await init();
    if(!client) throw new Error("Chưa cấu hình Supabase.");
    return await client.auth.signInWithPassword({email,password});
  }
  async function signOut() {
    if(!client) return;
    const r=await client.auth.signOut();
    if(r.error) throw r.error;
  }
  async function pull() {
    const u=await user();
    if(!u) return null;
    const {data,error}=await client.from("timepay_records")
      .select("payload,updated_at")
      .eq("id",u.id).maybeSingle();
    if(error) throw error;
    return data;
  }
  async function push(state) {
    const u=await user();
    if(!u) return false;
    const {error}=await client.from("timepay_records").upsert({
      id:u.id,user_id:u.id,payload:state,updated_at:new Date().toISOString()
    });
    if(error) throw error;
    return true;
  }
  window.TimePayCloud={
    configured,statusText,init,user,signUp,signIn,signOut,pull,push,LOCAL_KEY
  };
})();