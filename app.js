(() => {
"use strict";

const KEY="timepay_v1";
const defaultState={version:1,settings:{defaultRate:25000,defaultName:""},shifts:[],extras:{}};
let state=load();
let tab="home";
let statsMode="month";
let statsJobSearch="";
let viewDate=new Date(); viewDate.setHours(0,0,0,0);

function load(){
  try{
    const raw=localStorage.getItem(KEY);
    if(!raw) return structuredClone(defaultState);
    const x=JSON.parse(raw);
    return {...structuredClone(defaultState),...x,settings:{...defaultState.settings,...(x.settings||{})},shifts:Array.isArray(x.shifts)?x.shifts:[]};
  }catch(e){return structuredClone(defaultState)}
}
function save(){
  state.updatedAt=Date.now();
  localStorage.setItem(KEY,JSON.stringify(state));
  // Cloud sync is best-effort; local data is saved first so offline use remains safe.
  if(window.TimePayCloud && TimePayCloud.configured()){
    TimePayCloud.push(state).catch(err=>console.warn("Cloud sync:",err.message));
  }
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function money(n){return Math.round(Number(n)||0).toLocaleString("vi-VN")+"đ"}
function pad(n){return String(n).padStart(2,"0")}
function iso(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function dateFromISO(s){const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)}
function fmtDate(s){const d=dateFromISO(s);return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`}
function monthLabel(d){return `Tháng ${d.getMonth()+1}, ${d.getFullYear()}`}
function minutesBetween(start,end){
  const [sh,sm]=start.split(":").map(Number),[eh,em]=end.split(":").map(Number);
  let a=sh*60+sm,b=eh*60+em,d=b-a;
  if(d<0)d+=1440;
  return d;
}
function shiftMinutes(s){return minutesBetween(s.start,s.end)}
function shiftEndISO(s){
  const d=dateFromISO(s.date), mins=minutesBetween(s.start,s.end);
  if(s.end==="00:00" && s.start!=="00:00") d.setDate(d.getDate()+1);
  else if((s.start.split(":")[0]*60+Number(s.start.split(":")[1]))+(mins)>1440) d.setDate(d.getDate()+1);
  return iso(d);
}
function shiftPay(s){
  const base=Math.round(shiftMinutes(s)*Number(s.rate||0)/60);
  const included=(s.extras||[]).filter(x=>x.include).reduce((a,x)=>a+Math.round(Number(x.amount)||0),0);
  return base+included;
}
function overlap(a,b){
  // Convert each shift to absolute minutes from its calendar date.
  const dayA=dateFromISO(a.date), dayB=dateFromISO(b.date);
  const da=Math.round((dayA-dayB)/86400000);
  let a0=da*1440+toMin(a.start), a1=a0+minutesBetween(a.start,a.end);
  let b0=toMin(b.start), b1=b0+minutesBetween(b.start,b.end);
  return Math.max(a0,b0)<Math.min(a1,b1);
}
function toMin(t){const [h,m]=t.split(":").map(Number);return h*60+m}
function duplicateForDateShift(candidate,ignoreId=null){
  return state.shifts.some(s=>s.id!==ignoreId && overlap(candidate,s));
}
function fmtDuration(m){return `${Math.floor(m/60)} giờ ${m%60} phút`}
function shiftDateTimeEnd(s){
  const d=dateFromISO(s.date);
  const mins=toMin(s.start)+shiftMinutes(s);
  d.setDate(d.getDate()+Math.floor(mins/1440));
  return {date:iso(d),min:mins%1440};
}
function monthRange(d){
  const a=new Date(d.getFullYear(),d.getMonth(),1),b=new Date(d.getFullYear(),d.getMonth()+1,0);
  return [iso(a),iso(b)];
}
function inRange(date,a,b){return date>=a&&date<=b}
function totals(shifts){
  return shifts.reduce((r,s)=>{r.minutes+=shiftMinutes(s);r.base+=Math.round(shiftMinutes(s)*Number(s.rate||0)/60);r.total+=shiftPay(s);return r},{minutes:0,base:0,total:0});
}
function allExtras(shifts){
  return shifts.reduce((r,s)=>{(s.extras||[]).forEach(x=>{if(x.include){r[x.type]=(r[x.type]||0)+Math.round(Number(x.amount)||0)}});return r},{});
}
function sortShifts(arr){return [...arr].sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start))}
function render(){
  document.querySelectorAll(".bottom-nav [data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  const main=document.getElementById("main");
  if(tab==="home") main.innerHTML=homeHTML();
  if(tab==="calendar") main.innerHTML=calendarHTML();
  if(tab==="stats") main.innerHTML=statsHTML();
  if(tab==="settings") main.innerHTML=settingsHTML();
}
function homeHTML(){
  const today=iso(new Date()), dayShifts=sortShifts(state.shifts.filter(s=>s.date===today));
  const t=totals(state.shifts.filter(s=>s.date===today));
  return `<section class="section card hero"><div class="small">Hôm nay · ${fmtDate(today)}</div><div class="big-money">${money(t.total)}</div><div class="small">Tổng nhận trong ngày</div></section>
  <section class="section grid">
   <div class="stat"><small>Tổng giờ</small><strong>${fmtDuration(t.minutes)}</strong></div>
   <div class="stat"><small>Số ca</small><strong>${dayShifts.length}</strong></div>
   <div class="stat"><small>Lương giờ</small><strong>${money(t.base)}</strong></div>
   <div class="stat"><small>Đơn giá mặc định</small><strong>${money(state.settings.defaultRate)}/h</strong></div>
  </section>
  <section class="section actions"><button class="btn primary" onclick="openShift()">＋ Thêm ca</button><button class="btn secondary" onclick="openQuick()">Nhập nhanh</button></section>
  <section class="section"><div class="inline"><h3>Ca hôm nay</h3><button class="link" onclick="tab='calendar';render()">Xem lịch</button></div>
  ${dayShifts.length?`<div class="list">${dayShifts.map(shiftCard).join("")}</div>`:`<div class="card empty">Chưa có ca hôm nay.</div>`}</section>`;
}
function shiftCard(s){
 return `<div class="card shift" onclick="openDetail('${s.id}')"><div class="shift-left"><div class="shift-name"><span class="dot"></span>${esc(s.name||"Không tên")}</div><div class="shift-meta">${fmtDate(s.date)} · ${s.start}–${s.end} · ${fmtDuration(shiftMinutes(s))}</div></div><div class="money">${money(shiftPay(s))}</div></div>`;
}
function calendarHTML(){
 const y=viewDate.getFullYear(),m=viewDate.getMonth(),first=new Date(y,m,1),days=new Date(y,m+1,0).getDate();
 const prev=(first.getDay()+6)%7;
 let cells="";
 for(let i=0;i<prev;i++)cells+=`<button class="day muted"></button>`;
 for(let n=1;n<=days;n++){const d=iso(new Date(y,m,n)), has=state.shifts.some(s=>s.date===d),today=d===iso(new Date());cells+=`<button class="day ${has?"has":""} ${today?"today":""}" onclick="selectDay('${d}')">${n}</button>`}
 const selected=iso(viewDate), list=sortShifts(state.shifts.filter(s=>s.date===selected));
 return `<section class="section card"><div class="month-row"><button onclick="moveMonth(-1)">‹</button><div class="month-title">${monthLabel(viewDate)}</div><button onclick="moveMonth(1)">›</button></div>
 <div class="calendar-grid">${["T2","T3","T4","T5","T6","T7","CN"].map(x=>`<div class="cal-head">${x}</div>`).join("")}${cells}</div></section>
 <section class="section"><div class="inline"><h3>Ca ngày ${fmtDate(selected)}</h3><button class="link" onclick="openShift('${selected}')">＋ Thêm</button></div>
 ${list.length?`<div class="list">${list.map(shiftCard).join("")}</div>`:`<div class="card empty">Không có ca trong ngày này.</div>`}</section>`;
}
function selectDay(d){viewDate=dateFromISO(d);render()}
function moveMonth(n){viewDate=new Date(viewDate.getFullYear(),viewDate.getMonth()+n,1);render()}
function rangeForStats(){
 const d=new Date(viewDate);
 if(statsMode==="day"){const x=iso(d);return [x,x,`Ngày ${fmtDate(x)}`]}
 if(statsMode==="week"){
   const start=new Date(d); const monday=(start.getDay()+6)%7; start.setDate(start.getDate()-monday);
   const end=new Date(start); end.setDate(end.getDate()+6);
   return [iso(start),iso(end),`Tuần ${fmtDate(iso(start))} – ${fmtDate(iso(end))}`]
 }
 const [a,b]=monthRange(d); return [a,b,monthLabel(d)]
}
function normalizeSearch(s){return String(s??"").trim().toLocaleLowerCase("vi-VN")}
function jobNames(){
  return [...new Set(state.shifts.map(s=>String(s.name||"Không tên").trim()||"Không tên"))].sort((a,b)=>a.localeCompare(b,"vi"));
}
function statsFiltered(list){
  const q=normalizeSearch(statsJobSearch);
  if(!q)return list;
  return list.filter(s=>normalizeSearch(s.name||"Không tên").includes(q));
}
function statsTable(list){
  if(!list.length)return `<div class="card empty">Không tìm thấy ca phù hợp trong khoảng này.</div>`;
  const rows=sortShifts(list).map(s=>`<tr><td><b>${fmtDate(s.date)}</b></td><td>${esc(s.name||"Không tên")}</td><td>${s.start}–${s.end}</td><td>${fmtDuration(shiftMinutes(s))}</td><td>${money(Math.round(shiftMinutes(s)*Number(s.rate||0)/60))}</td><td>${money(shiftPay(s)-Math.round(shiftMinutes(s)*Number(s.rate||0)/60))}</td><td><b>${money(shiftPay(s))}</b></td></tr>`).join("");
  const t=totals(list), ex=allExtras(list);
  return `<div class="table-wrap"><table class="report-table"><thead><tr><th>Ngày</th><th>Công việc</th><th>Ca</th><th>Thời gian</th><th>Lương giờ</th><th>Khoản cộng</th><th>Tổng nhận</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="3">TỔNG</td><td>${fmtDuration(t.minutes)}</td><td>${money(t.base)}</td><td>${money(t.total-t.base)}</td><td>${money(t.total)}</td></tr></tfoot></table></div>
  <div class="report-extra small">Thưởng: <b>${money(ex.thuong||0)}</b> · Phụ cấp: <b>${money(ex.phucap||0)}</b> · Khác: <b>${money(ex.khac||0)}</b></div>`;
}
function statsHTML(){
 const [a,b,label]=rangeForStats(), all=state.shifts.filter(s=>inRange(s.date,a,b)), list=statsFiltered(all),t=totals(list);
 const q=statsJobSearch.trim();
 return `<section class="section"><div class="tabs">
 <button class="${statsMode==="day"?"active":""}" onclick="setStats('day')">Ngày</button>
 <button class="${statsMode==="week"?"active":""}" onclick="setStats('week')">Tuần</button>
 <button class="${statsMode==="month"?"active":""}" onclick="setStats('month')">Tháng</button></div></section>
 <section class="section card"><div class="month-row"><button onclick="moveStats(-1)">‹</button><div class="month-title">${label}</div><button onclick="moveStats(1)">›</button></div>
 <div class="job-search"><label for="statsJobSearch">🔎 Tìm công việc</label><input id="statsJobSearch" type="search" value="${esc(statsJobSearch)}" placeholder="Gõ tên việc, ví dụ: Lani" autocomplete="off"></div>
 <div class="search-hint">${q?`Đang lọc: <b>${esc(q)}</b> · không phân biệt hoa/thường`:`Đang xem tất cả công việc`}</div>
 <div class="stats-actions"><div><div class="big-money">${money(t.total)}</div><div class="small">Tổng nhận${q?` · ${esc(q)}`:""}</div></div><button class="btn pdf-btn" onclick="exportStatsPDF()">📄 Xuất PDF</button></div></section>
 <section class="section grid"><div class="stat"><small>Tổng thời gian</small><strong>${fmtDuration(t.minutes)}</strong></div><div class="stat"><small>Số ca</small><strong>${list.length}</strong></div><div class="stat"><small>Lương giờ</small><strong>${money(t.base)}</strong></div><div class="stat"><small>Khoản cộng</small><strong>${money(t.total-t.base)}</strong></div></section>
 <section class="section card"><div class="inline"><b>Bảng tổng quát</b><span class="small">${fmtDate(a)} – ${fmtDate(b)}</span></div><div class="small" style="margin-top:6px">${list.length} ca · ${jobNames().length} công việc đang có dữ liệu</div><div style="margin-top:12px">${statsTable(list)}</div></section>`;
}
function exportStatsPDF(){
 const [a,b,label]=rangeForStats();
 const all=state.shifts.filter(s=>inRange(s.date,a,b));
 const list=statsFiltered(all);
 const q=statsJobSearch.trim();
 const t=totals(list), ex=allExtras(list);
 const rows=sortShifts(list).map(s=>{
   const base=Math.round(shiftMinutes(s)*Number(s.rate||0)/60);
   return `<tr><td>${fmtDate(s.date)}</td><td>${esc(s.name||"Không tên")}</td><td>${s.start} – ${s.end}</td><td>${fmtDuration(shiftMinutes(s))}</td><td>${money(s.rate||0)}/h</td><td>${money(shiftPay(s)-base)}</td><td>${money(shiftPay(s))}</td></tr>`;
 }).join("");
 const w=window.open("", "_blank");
 if(!w){alert("Trình duyệt đang chặn cửa sổ in. Hãy cho phép pop-up cho trang này rồi thử lại.");return}
 w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Báo cáo chấm công - ${esc(label)}</title><style>
*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:#29242a;margin:0;padding:28px;font-size:12px}h1{font-size:21px;margin:0 0 5px}h2{font-size:14px;margin:22px 0 8px}.muted{color:#777}.head{border-bottom:2px solid #ed7180;padding-bottom:14px}.filter{margin-top:6px}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px}.box{border:1px solid #eadfdb;border-radius:10px;padding:10px}.box b{display:block;font-size:14px;margin-top:4px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #e7ded9;padding:8px;text-align:left}th{background:#fff0f1;font-size:11px}tfoot td{font-weight:800;background:#fff7f7}.total{font-size:18px;font-weight:900}.foot{margin-top:18px;color:#888;font-size:10px}@media print{body{padding:12mm}@page{size:A4 landscape;margin:10mm}.no-print{display:none!important}}
</style></head><body><div class="head"><h1>BẢNG TỔNG HỢP CHẤM CÔNG & TÍNH LƯƠNG</h1><div>${esc(label)}</div><div class="filter">Bộ lọc công việc: <b>${q?esc(q):"Tất cả công việc"}</b></div></div>
<div class="summary"><div class="box">Tổng thời gian<b>${fmtDuration(t.minutes)}</b></div><div class="box">Lương giờ<b>${money(t.base)}</b></div><div class="box">Khoản cộng<b>${money(t.total-t.base)}</b></div><div class="box">Tổng nhận<b class="total">${money(t.total)}</b></div></div>
<h2>Chi tiết (${list.length} ca)</h2><table><thead><tr><th>Ngày</th><th>Công việc</th><th>Ca</th><th>Thời gian</th><th>Lương giờ</th><th>Khoản cộng</th><th>Tổng nhận</th></tr></thead><tbody>${rows||`<tr><td colspan="7" style="text-align:center">Không có dữ liệu phù hợp.</td></tr>`}</tbody><tfoot><tr><td colspan="3">TỔNG CỘNG</td><td>${fmtDuration(t.minutes)}</td><td>${money(t.base)}</td><td>${money(t.total-t.base)}</td><td>${money(t.total)}</td></tr></tfoot></table>
<div class="foot">Thưởng: ${money(ex.thuong||0)} · Phụ cấp: ${money(ex.phucap||0)} · Khác: ${money(ex.khac||0)}<br>Xuất từ ứng dụng Chấm công & Tính lương · ${new Date().toLocaleString("vi-VN")}</div><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);
 w.document.close();
}
function setStats(mode){statsMode=mode;render()}
function updateStatsJobSearch(value){statsJobSearch=value;render()}
function moveStats(n){
 if(statsMode==="day") viewDate.setDate(viewDate.getDate()+n);
 else if(statsMode==="week") viewDate.setDate(viewDate.getDate()+n*7);
 else viewDate=new Date(viewDate.getFullYear(),viewDate.getMonth()+n,1);
 render();
}
function cloudSettingsHTML(){
  const configured=window.TimePayCloud?.configured?.();
  return `<section class="section card"><div class="inline"><div><b>☁️ Đồng bộ Web ↔ App</b><div class="small">${configured?"Cloud đã cấu hình":"Chưa cấu hình Supabase"}</div></div><span class="small" id="cloudUserLabel"></span></div>
  <div id="cloudAuthBox" style="margin-top:12px">${configured?`
  <div class="two"><label>Email<input id="cloudEmail" type="email" placeholder="email của bà"></label><label>Mật khẩu<input id="cloudPassword" type="password" placeholder="Mật khẩu"></label></div>
  <div class="actions" style="margin-top:8px"><button class="btn primary" onclick="cloudLogin()">Đăng nhập</button><button class="btn secondary" onclick="cloudSignup()">Tạo tài khoản</button></div>
  <button class="btn secondary" style="width:100%;margin-top:8px" onclick="cloudSyncNow()">🔄 Đồng bộ ngay</button>
  <button class="btn secondary" style="width:100%;margin-top:8px" onclick="cloudLogout()">Đăng xuất</button>`:
  `<div class="small" style="line-height:1.7">Bà cần tạo Supabase project rồi điền Project URL và anon/publishable key vào <b>supabase-config.js</b>. File hướng dẫn có sẵn trong ZIP.</div>`}</div></section>`;
}
async function cloudLogin(){
  try{
    const email=document.getElementById("cloudEmail").value.trim(), password=document.getElementById("cloudPassword").value;
    if(!email||!password) return alert("Nhập email và mật khẩu trước nha.");
    const r=await TimePayCloud.signIn(email,password);
    if(r.error) throw r.error;
    await cloudSyncNow(true);
    alert("Đăng nhập và đồng bộ thành công.");
    render();
  }catch(e){alert("Không đăng nhập được: "+e.message)}
}
async function cloudSignup(){
  try{
    const email=document.getElementById("cloudEmail").value.trim(), password=document.getElementById("cloudPassword").value;
    if(!email||!password) return alert("Nhập email và mật khẩu trước nha.");
    if(password.length<6) return alert("Mật khẩu nên có ít nhất 6 ký tự.");
    const r=await TimePayCloud.signUp(email,password);
    if(r.error) throw r.error;
    alert(r.data.session ? "Tạo tài khoản thành công." : "Tài khoản đã tạo. Nếu Supabase yêu cầu xác nhận email, hãy mở email rồi đăng nhập.");
    render();
  }catch(e){alert("Không tạo được tài khoản: "+e.message)}
}
async function cloudLogout(){
  try{await TimePayCloud.signOut();alert("Đã đăng xuất cloud.");render()}catch(e){alert("Lỗi đăng xuất: "+e.message)}
}
async function cloudSyncNow(silent=false){
  try{
    const remote=await TimePayCloud.pull();
    if(!remote){if(!silent) alert("Chưa đăng nhập tài khoản cloud.");return}
    const localUpdated=Number(state.updatedAt||0), remoteUpdated=Date.parse(remote.updated_at||"")||0;
    if(remoteUpdated>localUpdated && Array.isArray(remote.payload?.shifts)){
      state=remote.payload;
      localStorage.setItem(KEY,JSON.stringify(state));
      render();
      if(!silent) alert("Đã tải dữ liệu từ cloud.");
    }else{
      await TimePayCloud.push(state);
      if(!silent) alert("Đã đồng bộ dữ liệu hiện tại lên cloud.");
    }
  }catch(e){if(!silent) alert("Đồng bộ thất bại: "+e.message);else console.warn(e)}
}
function settingsHTML(){
 return `${cloudSettingsHTML()}<section class="section card"><div class="inline"><div><b>Đơn giá mặc định</b><div class="small">Áp dụng khi thêm ca mới</div></div><b>${money(state.settings.defaultRate)}/h</b></div>
 <button class="btn secondary" style="width:100%;margin-top:10px" onclick="editDefaultRate()">Thay đổi đơn giá</button></section>
 <section class="section card"><b>Sao lưu & khôi phục</b><div class="small" style="margin:6px 0 12px">Xuất dữ liệu thành file JSON để lưu an toàn.</div>
 <div class="actions"><button class="btn secondary" onclick="exportData()">Xuất backup</button><button class="btn secondary" onclick="importData()">Nhập backup</button></div></section>
 <section class="section card"><b>Nhập nhanh</b><div class="small" style="margin-top:6px">Cú pháp: <b>1/9, Lani, 18-22</b>. Có thể nhập nhiều dòng.</div></section>
 <section class="section card"><b>Nguyên tắc tính</b><div class="small" style="line-height:1.7;margin-top:6px">Tính lương theo phút thực tế · hỗ trợ ca qua 00:00 · kiểm tra mọi giao nhau · khoản cộng chỉ tính khi bật.</div></section>`;
}
function openShift(date=iso(new Date()), editId=null){
 const s=editId?state.shifts.find(x=>x.id===editId):null;
 const x=s||{date,start:"18:00",end:"22:00",name:state.settings.defaultName,rate:state.settings.defaultRate,extras:[],note:""};
 showModal(`<div class="modal-head"><h2>${s?"Sửa ca":"Thêm ca"}</h2><button class="close" onclick="closeModal()">×</button></div>
 <form class="form" id="shiftForm">
 <label>Ngày làm<input id="fdate" type="date" value="${x.date}" required></label>
 <label>Công việc / địa điểm<input id="fname" value="${esc(x.name)}" placeholder="VD: Lani"></label>
 <div class="two"><label>Giờ bắt đầu<input id="fstart" type="time" value="${x.start}" required></label><label>Giờ kết thúc<input id="fend" type="time" value="${x.end}" required></label></div>
 <label>Đơn giá (VND/giờ)<input id="frate" type="number" min="0" step="1" value="${Number(x.rate)||0}" required></label>
 <label>Khoản cộng</label>
 <div id="extrasBox">${extraRows(x.extras||[])}</div>
 <button type="button" class="btn secondary" onclick="addExtraRow()">＋ Thêm khoản</button>
 <label>Ghi chú<textarea id="fnote" rows="2" placeholder="Không bắt buộc">${esc(x.note||"")}</textarea></label>
 <div id="formPreview" class="alert"></div><button class="btn primary" type="submit">${s?"Lưu thay đổi":"Lưu ca"}</button></form>`);
 updatePreview();
 ["fstart","fend","frate"].forEach(id=>document.getElementById(id).addEventListener("input",updatePreview));
 document.getElementById("shiftForm").onsubmit=e=>{e.preventDefault();saveShift(editId)};
}
function extraRows(arr){
 const a=arr.length?arr:[{type:"thuong",amount:0,include:false}];
 return a.map((x,i)=>`<div class="two extra-row" style="margin-bottom:8px"><select class="etype"><option value="thuong" ${x.type==="thuong"?"selected":""}>Thưởng</option><option value="phucap" ${x.type==="phucap"?"selected":""}>Phụ cấp</option><option value="khac" ${x.type==="khac"?"selected":""}>Khác</option></select><input class="eamount" type="number" min="0" value="${Number(x.amount)||0}" placeholder="Số tiền"><label class="check"><input class="einclude" type="checkbox" ${x.include?"checked":""}> Tính vào lương</label></div>`).join("");
}
function addExtraRow(){document.getElementById("extrasBox").insertAdjacentHTML("beforeend",extraRows([{type:"khac",amount:0,include:false}]));}
function updatePreview(){
 const start=document.getElementById("fstart")?.value,end=document.getElementById("fend")?.value,rate=Number(document.getElementById("frate")?.value||0);
 if(start&&end){const mins=minutesBetween(start,end);document.getElementById("formPreview").textContent=`Thời gian: ${fmtDuration(mins)} · Lương giờ: ${money(Math.round(mins*rate/60))}`;}
}
function collectExtras(){return [...document.querySelectorAll(".extra-row")].map(r=>({type:r.querySelector(".etype").value,amount:Math.round(Number(r.querySelector(".eamount").value)||0),include:r.querySelector(".einclude").checked})).filter(x=>x.amount>0)}
function saveShift(editId){
 const candidate={id:editId||crypto.randomUUID(),date:document.getElementById("fdate").value,name:document.getElementById("fname").value.trim(),start:document.getElementById("fstart").value,end:document.getElementById("fend").value,rate:Math.round(Number(document.getElementById("frate").value)||0),extras:collectExtras(),note:document.getElementById("fnote").value.trim()};
 if(!candidate.date||!candidate.start||!candidate.end){alert("Vui lòng nhập đủ ngày và giờ.");return}
 if(candidate.start===candidate.end){alert("Giờ bắt đầu và kết thúc giống nhau. Vui lòng kiểm tra lại.");return}
 if(duplicateForDateShift(candidate,editId)){alert("Ca này bị trùng/giao với một ca đã có.");return}
 if(editId){state.shifts=state.shifts.map(s=>s.id===editId?candidate:s)}else state.shifts.push(candidate);
 save();closeModal();render();
}
function openDetail(id){
 const s=state.shifts.find(x=>x.id===id);if(!s)return;
 showModal(`<div class="modal-head"><h2>Chi tiết ca</h2><button class="close" onclick="closeModal()">×</button></div>
 <div class="card"><b>${esc(s.name||"Không tên")}</b><div class="small">${fmtDate(s.date)}</div>
 <div style="line-height:2;margin-top:10px">Giờ: <b>${s.start} – ${s.end}</b><br>Thời gian: <b>${fmtDuration(shiftMinutes(s))}</b><br>Đơn giá: <b>${money(s.rate)}/h</b><br>Lương giờ: <b>${money(Math.round(shiftMinutes(s)*s.rate/60))}</b><br>${(s.extras||[]).map(x=>`${esc(x.type)}: <b>${money(x.amount)}</b> ${x.include?"(tính)": "(không tính)"}`).join("<br>")}</div>
 <div class="alert" style="margin-top:10px"><b>Tổng nhận: ${money(shiftPay(s))}</b></div></div>
 <div class="actions" style="margin-top:10px"><button class="btn secondary" onclick="closeModal();openShift('${s.date}','${s.id}')">Sửa</button><button class="btn" style="background:#fff0f1;color:#c74756" onclick="deleteShift('${s.id}')">Xóa</button></div>`);
}
function deleteShift(id){if(confirm("Xóa ca này?")){state.shifts=state.shifts.filter(s=>s.id!==id);save();closeModal();render()}}
function openQuick(){
 showModal(`<div class="modal-head"><h2>Nhập lịch nhanh</h2><button class="close" onclick="closeModal()">×</button></div>
 <div class="alert">Mỗi dòng một ca. Cú pháp: <b>ngày, tên, giờ bắt đầu-giờ kết thúc</b><br>Ví dụ: 1/9, Lani, 18-22</div>
 <div class="form" style="margin-top:10px"><textarea id="quickText" rows="8" placeholder="1/9, Lani, 18-22&#10;2/9, Lani, 18:30-22:45&#10;3/9, ABC, 22-2"></textarea>
 <label>Năm<input id="quickYear" type="number" value="${viewDate.getFullYear()}" min="2000" max="2100"></label>
 <button class="btn primary" onclick="previewQuick()">Phân tích lịch</button></div>
 <div id="quickResult"></div>`);
}
function parseTime(t){
 t=t.trim().toLowerCase().replace(/\s/g,"");
 const hm=t.match(/^(\d{1,2})(?::(\d{1,2}))?h?$/);
 if(!hm)return null;
 const h=Number(hm[1]),mi=hm[2]===undefined?0:Number(hm[2]);
 if(h>23||mi>59)return null;
 return `${pad(h)}:${pad(mi)}`;
}
function parseQuickLine(line,year){
 const parts=line.split(",").map(x=>x.trim());if(parts.length<3)throw new Error("Cần đủ: ngày, tên, giờ");
 const dm=parts[0].match(/^(\\d{1,2})[\\/\\-](\\d{1,2})$/);if(!dm)throw new Error("Ngày không hợp lệ");
 const d=Number(dm[1]),m=Number(dm[2]);const dt=new Date(year,m-1,d);if(dt.getFullYear()!==year||dt.getMonth()!==m-1||dt.getDate()!==d)throw new Error("Ngày không tồn tại");
 const tm=parts[2].replace(/\\s/g,"").match(/^(.+?)[\\-–—](.+)$/);if(!tm)throw new Error("Giờ phải dạng 18-22");
 const start=parseTime(tm[1]),end=parseTime(tm[2]);if(!start||!end||start===end)throw new Error("Giờ không hợp lệ");
 return {id:crypto.randomUUID(),date:iso(dt),name:parts[1]||"Không tên",start,end,rate:state.settings.defaultRate,extras:[],note:""};
}
function previewQuick(){
 const lines=document.getElementById("quickText").value.split(/\n/).map(x=>x.trim()).filter(Boolean),year=Number(document.getElementById("quickYear").value);
 const parsed=[],errors=[];
 lines.forEach((line,i)=>{try{const s=parseQuickLine(line,year); if(duplicateForDateShift(s)||parsed.some(x=>overlap(s,x)))throw new Error("Bị trùng với ca khác"); parsed.push(s)}catch(e){errors.push(`Dòng ${i+1}: ${e.message}`)}});
 document.getElementById("quickResult").innerHTML=`<div class="section" style="margin-top:12px"><b>Xem trước: ${parsed.length} ca</b></div>
 ${errors.length?`<div class="alert">${errors.map(esc).join("<br>")}</div>`:"<div class=\"alert ok\">Tất cả dòng hợp lệ.</div>"}
 <div class="list" style="margin-top:10px">${parsed.map(s=>shiftCard(s)).join("")}</div>
 ${parsed.length?`<button class="btn primary" style="width:100%;margin-top:10px" onclick='commitQuick(${JSON.stringify(parsed)})'>＋ Thêm ${parsed.length} ca vào lịch</button>`:""}`;
}
function commitQuick(arr){state.shifts.push(...arr);save();closeModal();tab="calendar";render()}
function showModal(inner){document.getElementById("modalRoot").innerHTML=`<div class="modal-back" id="modalBack"><div class="modal">${inner}</div></div>`}
function closeModal(){document.getElementById("modalRoot").innerHTML=""}
function editDefaultRate(){const n=prompt("Đơn giá mặc định (VND/giờ):",state.settings.defaultRate);if(n!==null&&Number(n)>=0){state.settings.defaultRate=Math.round(Number(n));save();render()}}
function exportData(){const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`backup-${iso(new Date())}.json`;a.click();URL.revokeObjectURL(a.href)}
function importData(){const i=document.createElement("input");i.type="file";i.accept=".json,application/json";i.onchange=()=>{const f=i.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);if(!Array.isArray(x.shifts))throw new Error();if(!confirm("Nhập backup sẽ thay dữ liệu hiện tại. Tiếp tục?"))return;state={...structuredClone(defaultState),...x,settings:{...defaultState.settings,...(x.settings||{})}};save();render();alert("Khôi phục dữ liệu thành công.")}catch(e){alert("File backup không hợp lệ.")}};r.readAsText(f)};i.click()}
document.addEventListener("click",e=>{const b=e.target.closest("[data-tab]");if(b){tab=b.dataset.tab;render()}});
document.addEventListener("input",e=>{if(e.target.id==="statsJobSearch"){statsJobSearch=e.target.value;const pos=e.target.selectionStart;render();const input=document.getElementById("statsJobSearch");if(input){input.focus();input.setSelectionRange(pos,pos)}}});
document.getElementById("addBtn").onclick=()=>openShift();
document.getElementById("settingsBtn").onclick=()=>{tab="settings";render()};
window.openShift=openShift;window.openQuick=openQuick;window.previewQuick=previewQuick;window.commitQuick=commitQuick;window.openDetail=openDetail;window.deleteShift=deleteShift;window.closeModal=closeModal;window.moveMonth=moveMonth;window.selectDay=selectDay;window.editDefaultRate=editDefaultRate;window.exportData=exportData;window.importData=importData;window.addExtraRow=addExtraRow;window.setStats=setStats;window.moveStats=moveStats;window.updateStatsJobSearch=updateStatsJobSearch;window.exportStatsPDF=exportStatsPDF;window.cloudLogin=cloudLogin;window.cloudSignup=cloudSignup;window.cloudLogout=cloudLogout;window.cloudSyncNow=cloudSyncNow;
render();
})();