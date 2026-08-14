import { automationSupport } from "./game-rules.js";

const $ = id => document.getElementById(id);

function installAuditUI(){
  if($("ruleAuditV3")) return;
  const orderCard=document.querySelector("#tab-order .order-card .card.panel");
  if(!orderCard) return;
  const style=document.createElement("style");
  style.textContent=`
    .audit-v3{margin:12px 0 14px;padding:12px 13px;border-radius:16px;border:1px solid #38445a;background:linear-gradient(145deg,#111824,#0d121a)}
    .audit-v3-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.audit-v3-title{font-size:13px;font-weight:950}.audit-v3-sub{margin-top:3px;color:#98a5b8;font-size:10px;line-height:1.45}
    .audit-v3-badge{white-space:nowrap;padding:5px 8px;border-radius:999px;border:1px solid #355440;background:#12231b;color:#b8efd0;font-size:9px;font-weight:950}.audit-v3-badge.warn{border-color:#68532e;background:#261f13;color:#f5d696}
    .audit-v3-list{display:grid;gap:6px;margin-top:9px}.audit-v3-row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:8px 9px;border-radius:11px;background:#121925;border:1px solid #293449;font-size:10px}.audit-v3-row b{font-size:11px}.audit-v3-row span{color:#9da9ba;text-align:right;line-height:1.35}.audit-v3-row.manual{border-color:#5e4b2e;background:#211b12}.audit-v3-note{margin-top:8px;color:#8693a6;font-size:9px;line-height:1.45}
  `;
  document.head.appendChild(style);
  const box=document.createElement("section");
  box.id="ruleAuditV3";box.className="audit-v3";
  box.innerHTML=`<div class="audit-v3-head"><div><div class="audit-v3-title">🧭 Rule Engine Coverage</div><div class="audit-v3-sub">ตรวจว่า Role ในชุดนี้ให้ระบบ resolve ผลได้อัตโนมัติแค่ไหน</div></div><div id="auditBadge" class="audit-v3-badge">กำลังตรวจ</div></div><div id="auditList" class="audit-v3-list"></div><div class="audit-v3-note">Role ที่ขึ้น “Host ตรวจ” ยังเล่นได้ตามปกติ แต่ระบบจะไม่เดาผลของ trigger/เงื่อนไขชนะที่ยังไม่ได้ automate เพื่อป้องกันการตัดสินผิด</div>`;
  const readiness=$("readinessBox");
  if(readiness) readiness.insertAdjacentElement("afterend",box); else orderCard.appendChild(box);
}

function getRoles(){return window.WWModeratorBridge?.getRoles?.() || []}
function renderAudit(){
  installAuditUI();const list=$("auditList"),badge=$("auditBadge");if(!list||!badge)return;
  const roles=getRoles().filter(r=>r?.name&&r.name!=="Moderator"&&r.name!=="The Moderator");
  const rows=roles.map(r=>({role:r,support:automationSupport(r)}));
  const manual=rows.filter(x=>x.support.level!=="auto");
  badge.textContent=manual.length?`${manual.length} Role ต้องตรวจ`:`AUTO CORE`;
  badge.classList.toggle("warn",manual.length>0);
  const priority=[...manual,...rows.filter(x=>x.support.level==="auto")].slice(0,12);
  list.innerHTML=priority.length?priority.map(({role,support})=>`<div class="audit-v3-row ${support.level!=="auto"?"manual":""}"><b>${role.th||role.name}</b><span>${support.level==="auto"?"✓ Auto core":"⚠ Host ตรวจ"}<br>${support.reason}</span></div>`).join(""):`<div class="audit-v3-note">ยังไม่ได้เลือก Role</div>`;
}

function manualRoles(){return getRoles().filter(r=>automationSupport(r).level!=="auto"&&r.name!=="Moderator"&&r.name!=="The Moderator")}

function installStartGuard(){
  const start=$("startBtn");if(!start||start.dataset.auditGuard)return;start.dataset.auditGuard="1";
  start.addEventListener("click",e=>{
    // First click only moves Settings -> Order. Guard actual Night start only.
    const orderTab=$("tab-order");if(!orderTab?.classList.contains("active"))return;
    const manual=manualRoles();if(!manual.length)return;
    const names=manual.slice(0,8).map(r=>r.th||r.name).join(", ")+(manual.length>8?` และอีก ${manual.length-8} Role`:"");
    const ok=confirm(`ชุดนี้มี Role ที่ต้อง Host ตรวจผลตามกติกาเอง:\n\n${names}\n\nระบบยังเรียก Role / รับ Action / จับเวลาได้ แต่จะไม่เดา trigger หรือเงื่อนไขชนะบางอย่างให้เอง\n\nเริ่ม Night ต่อหรือไม่?`);
    if(!ok){e.preventDefault();e.stopImmediatePropagation()}
  },true);
}

function boot(){installAuditUI();installStartGuard();renderAudit();
  const root=$("selectedRolesPreview")||document.body;
  new MutationObserver(()=>renderAudit()).observe(root,{childList:true,subtree:true});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
