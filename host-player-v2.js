import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getDatabase, ref, set, get, update, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";
import { behaviorFor, roleKey, safeRole } from "./game-rules.js";

const $=(id)=>document.getElementById(id);

function injectUI(){
  const style=document.createElement("style");
  style.textContent=`
  .hp-secret{grid-column:1/-1;border:1px solid #413343;background:#17121b;border-radius:16px;padding:12px 13px}
  .hp-secret-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.hp-secret-title{font-size:12px;font-weight:900}.hp-secret-sub{font-size:10px;color:#94879d;margin-top:3px}
  .hp-role{margin-top:10px;padding:12px;border:1px solid #4c3440;border-radius:14px;background:#0d1119;text-align:center}.hp-role-name{font-size:25px;font-weight:950}.hp-role-ability{margin-top:6px;color:#c8d1df;font-size:12px;line-height:1.5}
  .hp-turn{max-width:650px;margin:0 auto 18px;padding:14px;border:1px solid #5a303b;border-radius:18px;background:radial-gradient(500px 180px at 50% 0%,rgba(239,68,84,.14),transparent 70%),#10151f;text-align:left}
  .hp-turn-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}.hp-turn-head strong{font-size:13px}.hp-turn-head span{font-size:10px;color:#f1b5bd}
  .hp-targets,.hp-vote-targets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:10px}.hp-target{min-height:43px;border:1px solid #334058;background:#141b27;color:#dce4ef;border-radius:12px;padding:8px;font-size:11px;font-weight:850}.hp-target.selected{border-color:#b94756;background:#341a22;color:#ffd7dc}
  .hp-actions{display:flex;gap:8px;margin-top:10px}.hp-actions .btn{flex:1;min-height:42px;font-size:12px}.hp-result{margin-top:9px;padding:9px 10px;border-radius:11px;border:1px solid #2b5944;background:#11241b;color:#b9edcf;font-size:11px;font-weight:850}
  .hp-witch{display:flex;align-items:center;gap:8px;margin-top:10px;padding:9px 10px;border:1px solid #57472c;background:#251f13;border-radius:12px;color:#efd28f;font-size:11px}.hp-witch input{width:18px;height:18px;accent-color:#efb34c}
  .hp-day{width:min(700px,100%);margin:22px auto 0;text-align:left}.hp-day-card{border:1px solid #344158;background:#0d131d;border-radius:18px;padding:14px}.hp-day-card h3{margin:0;font-size:15px}.hp-day-card p{margin:5px 0 0;color:#94a1b4;font-size:11px;line-height:1.5}
  .hp-day-primary{width:100%;margin-top:12px}.hp-vote-status{margin-top:10px;padding:9px 10px;border-radius:12px;background:#131a25;border:1px solid #2d384c;color:#c7d0de;font-size:11px}.hp-tally{display:grid;gap:6px;margin-top:10px}.hp-tally-row{display:flex;justify-content:space-between;gap:10px;padding:8px 9px;border-radius:10px;background:#121925;font-size:11px}.hp-tally-row.leading{border:1px solid #5b4930;background:#251f14;color:#f3d49a}
  .hp-vote-box{margin-top:12px;padding-top:12px;border-top:1px solid #293448}.hp-note{color:#8f9bad;font-size:11px;margin-top:8px;text-align:center}
  @media(max-width:680px){.hp-targets,.hp-vote-targets{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const h1=document.querySelector(".brand h1"); if(h1) h1.textContent="Werewolf Host";
  const subtitle=document.querySelector(".brand p"); if(subtitle) subtitle.textContent="ตั้งค่าเกมและเล่นด้วยได้ • Night Phase ใช้เสียงเรียกอัตโนมัติ";
  const onlineDesc=document.querySelector(".online-room-card .panel-desc"); if(onlineDesc) onlineDesc.textContent="Host เป็นผู้เล่นด้วย • คนอื่นเปิด player.html แล้วเข้าด้วย Room Code";
  const playBrand=document.querySelector(".play-brand"); if(playBrand) playBrand.innerHTML='<span class="mini-moon">🌙</span>Werewolf Auto Moderator';

  const body=$("onlineRoomBody");
  if(body && !$("hpHostSecret")) body.insertAdjacentHTML("beforeend",`
    <div id="hpHostSecret" class="hp-secret hidden">
      <div class="hp-secret-head"><div><div class="hp-secret-title">🔒 Role ของคุณ (Host Player)</div><div class="hp-secret-sub">Host ได้ Role แบบสุ่มและไม่เห็น Role ของคนอื่น</div></div><button id="hpRevealRole" class="btn ghost" type="button" style="min-height:36px;font-size:11px">ดู Role ของฉัน</button></div>
      <div id="hpRoleBox" class="hp-role hidden"><div id="hpRoleName" class="hp-role-name">—</div><div id="hpRoleAbility" class="hp-role-ability">—</div><div id="hpTeam" class="hp-role-ability hidden" style="color:#efc77e"></div></div>
    </div>`);

  const next=document.querySelector("#playingState .next-card");
  if(next && !$("hpHostTurn")) next.insertAdjacentHTML("beforebegin",`
    <div id="hpHostTurn" class="hp-turn hidden">
      <div class="hp-turn-head"><strong id="hpTurnTitle">ถึงคิว Role ของคุณ</strong><span>เลือกแบบลับแล้วกดยืนยัน</span></div>
      <div id="hpTurnAction" style="color:#c8d1df;font-size:12px;line-height:1.5"></div>
      <label id="hpWitchRow" class="hp-witch hidden"><input id="hpWitchSave" type="checkbox"><span id="hpWitchText">ใช้ยาช่วยเป้าหมายของหมาป่า</span></label>
      <div id="hpTargetList" class="hp-targets"></div>
      <div class="hp-actions"><button id="hpSkipAction" class="btn ghost hidden" type="button">ไม่ใช้ความสามารถ</button><button id="hpSubmitAction" class="btn primary" type="button">ยืนยัน</button></div>
      <div id="hpTurnResult" class="hp-result hidden"></div>
    </div>`);

  const done=document.querySelector("#doneState .done-wrap");
  const doneActions=done?.querySelector(".done-actions");
  if(done && doneActions && !$("hpDayControls")) doneActions.insertAdjacentHTML("beforebegin",`
    <div id="hpDayControls" class="hp-day">
      <div class="hp-day-card"><h3>🗳️ ช่วงกลางวัน</h3><p>Host เป็นผู้เล่นเหมือนทุกคน หน้าที่พิเศษมีแค่เริ่มโหวตและยืนยันผล</p>
        <button id="hpStartVote" class="btn primary big hp-day-primary" type="button">เริ่มโหวต</button>
        <div id="hpHostVoteBox" class="hp-vote-box hidden"><strong style="font-size:12px">โหวตของคุณ</strong><div id="hpVoteTargets" class="hp-vote-targets"></div><button id="hpSubmitVote" class="btn primary hp-day-primary" type="button" disabled>ส่งโหวตของฉัน</button></div>
        <div id="hpVoteStatus" class="hp-vote-status hidden"></div><div id="hpVoteTally" class="hp-tally hidden"></div>
        <button id="hpConfirmVote" class="btn primary big hp-day-primary hidden" type="button">ยืนยันผลโหวต</button><button id="hpRevote" class="btn secondary hp-day-primary hidden" type="button">โหวตใหม่</button>
        <div class="hp-note">หลังยืนยันผล ระบบจะเริ่ม Night ถัดไปเอง</div>
      </div>
    </div>`);
  const again=$("againBtn"); if(again) again.classList.add("hidden");
  const oldActions=$("onlineActionPanel"); if(oldActions) oldActions.classList.add("hidden");
}
injectUI();

const statusEl=$("onlineStatus"), bodyEl=$("onlineRoomBody"), codeEl=$("roomCodeText"), playersEl=$("onlinePlayerList"), playerCountEl=$("onlinePlayerCount");
const createBtn=$("createRoomBtn"), assignBtn=$("assignRolesBtn"), copyBtn=$("copyJoinBtn");
let db=null, auth=null, hostUid="", roomCode="", players={}, privateData={}, publicData={};
let currentNight=1,currentPhaseId="",currentRole=null,currentBehavior=null,currentActions={},stopActions=null,duplicatePhase=false;
let nightSeen=new Set(),nightState=makeNightState(1),hostSelections=new Set(),hostActionPhase="";
let voteId="",votes={},stopVotes=null,hostVote="",voteResult=null;

const PACK=new Set(["Werewolf","Lone Wolf","The Lone Wolf","Wolf Cub","Alpha Wolf","Alpha Werewolf","Big Bad Wolf","Mystic Wolf","Omega Wolf","Confused Wolf","German shepherd","The Remorseful Werewolf","The Fallen Angel"]);
function isPackRole(r){return r?.cat==="Werewolves"&&PACK.has(r?.name||"")}
function kindFor(r){
  if(isPackRole(r))return"werewolf"; const n=r?.name||"";
  if(n==="Bodyguard")return"protect"; if(n==="Seer")return"seer"; if(n==="Aura Seer")return"aura"; if(n==="Mystic Seer")return"role-reveal";
  if(n==="Sorcerer"||n==="The Sorcerer")return"find-seer"; if(n==="Mentalist")return"same-team"; if(n==="Witch")return"witch"; if(n==="Cupid")return"cupid";
  return"generic";
}
function enhancedBehavior(r){const b={...behaviorFor(r),kind:kindFor(r)};if(isPackRole(r)){b.targetCount=1;b.optional=false;b.allowSelf=false;}return b}
function makeNightState(n){return{night:n,wolfTarget:null,protected:new Set(),witchSaved:false,witchKills:new Set(),extraKills:new Set()}}
function path(x=""){return`rooms/${roomCode}${x?"/"+x:""}`}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]))}
function nameOf(uid){return players?.[uid]?.name||"ผู้เล่น"}
function roleOf(uid){return privateData?.[uid]?.role||null}
function roleName(r){return r?.th&&r.th!==r.name?`${r.th} (${r.name})`:(r?.name||"—")}
function alive(){return Object.entries(players||{}).filter(([,p])=>p?.alive!==false)}
function setStatus(t,on=false){if(statusEl){statusEl.textContent=t;statusEl.classList.toggle("connected",on)}}
function say(text,done){
  if(!("speechSynthesis"in window)){done?.();return} speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text);u.lang="th-TH";u.rate=.9;let ended=false;const end=()=>{if(ended)return;ended=true;done?.()};u.onend=end;u.onerror=end;speechSynthesis.speak(u);setTimeout(end,5000)
}
function randomCode(){const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let x="";for(let i=0;i<5;i++)x+=chars[Math.floor(Math.random()*chars.length)];return x}
function shuffle(a){const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x}
function majority(actions){const m=new Map();for(const a of Object.values(actions||{})){const t=Array.isArray(a?.selected)?a.selected[0]:null;if(t)m.set(t,(m.get(t)||0)+1)}if(!m.size)return null;const max=Math.max(...m.values()),ties=[...m].filter(([,n])=>n===max).map(([id])=>id);return ties[Math.floor(Math.random()*ties.length)]||null}

function renderPlayers(){
  const list=Object.entries(players||{}).sort((a,b)=>(a[1].joinedAt||0)-(b[1].joinedAt||0)); if(playerCountEl)playerCountEl.textContent=list.length;
  if(!playersEl)return;if(!list.length){playersEl.innerHTML=`<div class="online-empty">รอผู้เล่นเข้าห้อง…</div>`;return}
  playersEl.innerHTML=list.map(([uid,p])=>{const dead=p.alive===false,reason=p.eliminatedBy==="vote"?"ถูกโหวตออก":dead?"ถูกกำจัด":"ยังอยู่ในเกม";return`<div class="online-player"><div class="online-player-main"><div class="online-player-name"><span class="presence ${p.connected!==false?"on":""}"></span>${esc(p.name)}${uid===hostUid?" • 👑 Host Player":""}</div><div class="online-player-sub">${esc(reason)} • 🔒 ไม่เปิดเผย Role</div></div></div>`}).join("")
}
function renderSecret(){const d=privateData?.[hostUid],r=d?.role,box=$("hpHostSecret");if(!box)return;box.classList.toggle("hidden",!r);if(!r)return;$("hpRoleName").textContent=roleName(r);$("hpRoleAbility").textContent=r.ability||r.action||"ทำความสามารถตามกติกา";const extras=[];if(d?.teammates?.length)extras.push(`เพื่อนที่คุณรู้จัก: ${d.teammates.map(x=>x.name).join(", ")}`);if(d?.loverName)extras.push(`คู่รัก: ${d.loverName}`);$("hpTeam").textContent=extras.join(" • ");$("hpTeam").classList.toggle("hidden",!extras.length)}
function renderHostTurn(){
  const turn=privateData?.[hostUid]?.turn,me=players?.[hostUid],panel=$("hpHostTurn");if(!panel)return;if(!turn?.active||me?.alive===false){panel.classList.add("hidden");return}panel.classList.remove("hidden");
  if(hostActionPhase!==turn.phaseId){hostActionPhase=turn.phaseId;hostSelections.clear();$("hpWitchSave").checked=false}
  const b=turn.behavior||{targetCount:1,optional:false,allowSelf:false};let count=Number(b.targetCount)||0;if(b.kind==="witch"&&turn.resources?.witchKillUsed)count=0;
  $("hpTurnTitle").textContent=`🎭 ${roleName(turn.role)} — ถึงคิวของคุณ`;$("hpTurnAction").textContent=turn.action||turn.ability||"ทำความสามารถของคุณ";
  const canSave=b.kind==="witch"&&turn.context?.wolfTarget&&!turn.resources?.witchHealUsed;$("hpWitchRow").classList.toggle("hidden",!canSave);if(canSave)$("hpWitchText").textContent=`ใช้ยาช่วย ${turn.context.wolfTargetName}`;
  const result=turn.result||"";$("hpTurnResult").textContent=result;$("hpTurnResult").classList.toggle("hidden",!result);
  if(count===0){$("hpTargetList").innerHTML="";$("hpSubmitAction").disabled=false;$("hpSubmitAction").textContent="เสร็จแล้ว"}else{
    const excluded=new Set(turn.excludedTargets||[]);$("hpSubmitAction").textContent="ยืนยัน";const list=alive().filter(([id])=>(b.allowSelf||id!==hostUid)&&!excluded.has(id));
    $("hpTargetList").innerHTML=list.map(([id,p])=>`<button class="hp-target ${hostSelections.has(id)?"selected":""}" data-hpt="${id}" type="button">${esc(p.name)}${id===hostUid?" (คุณ)":""}</button>`).join("");
    document.querySelectorAll("[data-hpt]").forEach(btn=>btn.onclick=()=>{const id=btn.dataset.hpt;if(hostSelections.has(id))hostSelections.delete(id);else{if(hostSelections.size>=count)hostSelections.delete([...hostSelections][0]);hostSelections.add(id)}renderHostTurn()});
    const saveOnly=b.kind==="witch"&&$("hpWitchSave").checked;$("hpSubmitAction").disabled=b.optional?!(hostSelections.size===count||saveOnly):hostSelections.size!==count
  }
  const sent=Boolean(currentActions?.[hostUid]);$("hpSkipAction").classList.toggle("hidden",!b.optional||sent);if(sent){$("hpSubmitAction").disabled=true;if(!result){$("hpTurnResult").textContent="✓ ส่ง Action แล้ว รอฟังเสียงเรียกหลับตา";$("hpTurnResult").classList.remove("hidden")}}
}

async function createRoom(){
  if(!db||!hostUid)return alert("ยังไม่ได้เชื่อม Firebase");const hostName=(localStorage.getItem("ww_host_player_name")||prompt("ชื่อของคุณ (Host จะเล่นด้วย)","")||"").trim();if(!hostName)return;
  localStorage.setItem("ww_host_player_name",hostName);let code="";setStatus("กำลังสร้างห้อง…");for(let i=0;i<8;i++){const c=randomCode(),snap=await get(ref(db,`rooms/${c}/hostUid`));if(!snap.exists()){code=c;break}}if(!code)return alert("สร้างห้องไม่สำเร็จ");roomCode=code;
  await set(ref(db,path("hostUid")),hostUid);await set(ref(db,path("public")),{status:"lobby",createdAt:Date.now(),phase:{state:"lobby",night:1}});await update(ref(db,path(`players/${hostUid}`)),{name:hostName,isHost:true,alive:true,connected:true,joinedAt:Date.now(),assigned:false});
  try{await onDisconnect(ref(db,path(`players/${hostUid}/connected`))).set(false)}catch{} localStorage.setItem("ww_host_room",roomCode);attach();bodyEl?.classList.remove("hidden");codeEl.textContent=roomCode;setStatus("ห้องพร้อม • คุณเป็นผู้เล่นด้วย",true);createBtn.textContent="สร้างห้องใหม่";
  const auto=$("autoToggle");if(auto){auto.checked=true;auto.disabled=true}
}
function attach(){onValue(ref(db,path("players")),s=>{players=s.val()||{};renderPlayers();renderHostTurn();renderVote()});onValue(ref(db,path("private")),s=>{privateData=s.val()||{};renderSecret();renderHostTurn();renderVote()});onValue(ref(db,path("public")),s=>{publicData=s.val()||{};renderVote()})}
async function assignRoles(){
  const bridge=window.WWModeratorBridge;if(!bridge)return;const pool=bridge.getRoles().filter(r=>r.name&&r.name!=="Moderator"&&r.name!=="The Moderator"),pe=Object.entries(players||{});if(!pe.length)return alert("ยังไม่มีผู้เล่น");if(pool.length!==pe.length)return alert(`จำนวน Role (${pool.length}) ต้องเท่ากับผู้เล่น (${pe.length}) รวม Host ด้วย`);
  const rs=shuffle(pool),ps=shuffle(pe),a={};ps.forEach(([uid,p],i)=>{const base=rs[i];a[uid]={p,role:{...safeRole(base),ability:base.ability||base.action||""}}});const u={};for(const[uid,item]of Object.entries(a)){const mates=Object.entries(a).filter(([oid,o])=>oid!==uid&&((isPackRole(item.role)&&isPackRole(o.role))||(item.role.name==="Mason"&&o.role.name==="Mason"))).map(([oid,o])=>({uid:oid,name:o.p.name}));u[`private/${uid}`]={role:item.role,teammates:mates,resources:{},turn:{active:false,state:"lobby"}};u[`players/${uid}/assigned`]=true;u[`players/${uid}/alive`]=true;u[`players/${uid}/eliminatedBy`]=null;u[`players/${uid}/eliminatedAt`]=null}u["public/status"]="assigned";u["public/phase"]={state:"assigned",night:1};await update(ref(db,path()),u);$("hpRoleBox")?.classList.add("hidden");alert("สุ่มแจก Role ให้ทุกคนแล้ว — Host ได้ Role ด้วย")
}
async function copyLink(){if(!roomCode)return;const u=new URL("player.html",location.href);u.searchParams.set("room",roomCode);try{await navigator.clipboard.writeText(u.toString());copyBtn.textContent="คัดลอกแล้ว ✓";setTimeout(()=>copyBtn.textContent="คัดลอกลิงก์",1200)}catch{prompt("คัดลอกลิงก์",u.toString())}}

function listenActions(n,pid){stopActions?.();currentActions={};stopActions=onValue(ref(db,path(`actions/${n}/${pid}`)),async s=>{currentActions=s.val()||{};await infoResults();renderHostTurn()})}
async function infoResults(){const k=currentBehavior?.kind;if(!["seer","aura","role-reveal","find-seer","same-team"].includes(k))return;for(const[uid,a]of Object.entries(currentActions)){if(a?.skipped)continue;const ids=Array.isArray(a?.selected)?a.selected:[];let result="";if(k==="same-team"&&ids.length>=2){const r1=roleOf(ids[0]),r2=roleOf(ids[1]);result=`${nameOf(ids[0])} และ ${nameOf(ids[1])} ${r1&&r2&&r1.cat===r2.cat?"อยู่ฝ่ายเดียวกัน":"อยู่คนละฝ่าย"}`}else if(ids[0]){const t=ids[0],r=roleOf(t);if(!r)continue;if(k==="seer")result=`${nameOf(t)} ${isPackRole(r)||r.name==="Lycan"?"เป็นมนุษย์หมาป่า":"ไม่ใช่มนุษย์หมาป่า"}`;else if(k==="aura")result=`${nameOf(t)} ${["Villager","Werewolf"].includes(r.name)?"ไม่ใช่ Role พิเศษ":"เป็น Role พิเศษ"}`;else if(k==="role-reveal")result=`${nameOf(t)} คือ ${roleName(r)}`;else if(k==="find-seer")result=`${nameOf(t)} ${r.name==="Seer"?"คือ Seer":"ไม่ใช่ Seer"}`}if(result)await update(ref(db,path(`private/${uid}/turn`)),{result})}}
async function processPhase(){if(duplicatePhase||!currentRole)return;const k=currentBehavior?.kind,a=currentActions||{};if(k==="werewolf"){if(!/คืนแรก.*(ยังไม่|ไม่).*?(ฆ่า|กำจัด)|ยังไม่เลือกฆ่า/.test(currentRole._action||""))nightState.wolfTarget=majority(a);return}if(k==="protect"){for(const[uid,x]of Object.entries(a)){const t=x?.selected?.[0];if(t){nightState.protected.add(t);await update(ref(db,path(`private/${uid}/resources`)),{lastProtected:t})}}return}if(k==="witch"){for(const[uid,x]of Object.entries(a)){const res=privateData?.[uid]?.resources||{};if(x?.saveWolfTarget&&nightState.wolfTarget&&!res.witchHealUsed){nightState.witchSaved=true;await update(ref(db,path(`private/${uid}/resources`)),{witchHealUsed:true})}const t=x?.selected?.[0];if(t&&!res.witchKillUsed){nightState.witchKills.add(t);await update(ref(db,path(`private/${uid}/resources`)),{witchKillUsed:true})}}return}if(k==="cupid"){for(const x of Object.values(a)){const ids=x?.selected||[];if(ids.length>=2){await update(ref(db,path(`private/${ids[0]}`)),{loverUid:ids[1],loverName:nameOf(ids[1])});await update(ref(db,path(`private/${ids[1]}`)),{loverUid:ids[0],loverName:nameOf(ids[0])})}}return}if(currentRole.name==="Priest"){for(const x of Object.values(a)){const t=x?.selected?.[0];if(t)nightState.protected.add(t)}}if(currentRole.name==="Huntress"){for(const x of Object.values(a)){const t=x?.selected?.[0];if(t)nightState.extraKills.add(t)}}}
async function eliminate(uid,reason,cascade=true){if(!uid||players?.[uid]?.alive===false)return;await update(ref(db,path(`players/${uid}`)),{alive:false,eliminatedBy:reason,eliminatedAt:Date.now()});await update(ref(db,path(`private/${uid}/turn`)),{active:false,state:"eliminated"});if(cascade){const l=privateData?.[uid]?.loverUid;if(l&&players?.[l]?.alive!==false)await eliminate(l,"lover",false)}}

async function beginNight({nightNumber}={}){currentNight=Number(nightNumber)||1;nightState=makeNightState(currentNight);nightSeen.clear();const auto=$("autoToggle");if(auto){auto.checked=true;auto.disabled=true}document.querySelector(".play-actions")?.classList.add("hidden");const u={"public/status":"night","public/phase":{state:"night-start",night:currentNight}};for(const uid of Object.keys(players))u[`private/${uid}/turn`]={active:false,state:"sleep",night:currentNight};if(roomCode)await update(ref(db,path()),u)}
async function publishRole(role,info){if(!roomCode)return;const n=Number(info?.nightNumber)||1;if(n!==nightState.night){currentNight=n;nightState=makeNightState(n);nightSeen.clear()}currentNight=n;currentPhaseId=`n${n}_${Date.now().toString(36)}`;currentRole={...role,_action:info?.action||role.action||""};currentBehavior=enhancedBehavior(role);const key=roleKey(role);duplicatePhase=nightSeen.has(key);nightSeen.add(key);const firstSafe=currentBehavior.kind==="werewolf"&&/คืนแรก.*(ยังไม่|ไม่).*?(ฆ่า|กำจัด)|ยังไม่เลือกฆ่า/.test(info?.action||"");if(firstSafe){currentBehavior={...currentBehavior,kind:"generic",targetCount:0,optional:false}}const u={"public/status":"night","public/phase":{state:"night",night:n,phaseId:currentPhaseId,step:info?.step||1,total:info?.total||1,duration:info?.totalDuration||30}};for(const[uid,p]of Object.entries(players)){const assigned=roleOf(uid),active=!duplicatePhase&&p.alive!==false&&assigned?.key===key;if(active){const res=privateData?.[uid]?.resources||{},ctx={},ex=[];if(currentBehavior.kind==="witch"&&nightState.wolfTarget){ctx.wolfTarget=nightState.wolfTarget;ctx.wolfTargetName=nameOf(nightState.wolfTarget)}if(currentBehavior.kind==="protect"&&res.lastProtected)ex.push(res.lastProtected);if(currentBehavior.kind==="werewolf")for(const[oid]of Object.entries(players))if(isPackRole(roleOf(oid)))ex.push(oid);u[`private/${uid}/turn`]={active:true,state:"act",night:n,phaseId:currentPhaseId,role:{...safeRole(assigned),ability:assigned.ability||assigned.action||""},action:info?.action||role.action||"",ability:assigned.ability||assigned.action||"",behavior:currentBehavior,context:ctx,resources:res,excludedTargets:ex}}else u[`private/${uid}/turn`]={active:false,state:"sleep",night:n,phaseId:currentPhaseId}}await update(ref(db,path()),u);listenActions(n,currentPhaseId)}
async function publishSleep(){if(!roomCode)return;try{const s=await get(ref(db,path(`actions/${currentNight}/${currentPhaseId}`)));currentActions=s.val()||currentActions}catch{}await processPhase();const u={"public/phase/state":"night-transition"};for(const uid of Object.keys(players))u[`private/${uid}/turn`]={active:false,state:"sleep",night:currentNight,phaseId:currentPhaseId};await update(ref(db,path()),u);$("hpHostTurn")?.classList.add("hidden")}
async function publishDay({nightNumber}={}){if(!roomCode)return;stopActions?.();const deaths=new Set();if(nightState.wolfTarget&&!nightState.protected.has(nightState.wolfTarget)&&!nightState.witchSaved)deaths.add(nightState.wolfTarget);for(const x of nightState.witchKills)if(!nightState.protected.has(x))deaths.add(x);for(const x of nightState.extraKills)if(!nightState.protected.has(x))deaths.add(x);const names=[];for(const uid of deaths){if(players?.[uid]?.alive===false)continue;names.push(nameOf(uid));await eliminate(uid,uid===nightState.wolfTarget?"werewolf":"night")}const n=Number(nightNumber)||currentNight;const u={"public/status":"day","public/phase":{state:"day",night:n,morningDeaths:names}};for(const[uid,p]of Object.entries(players))if(p.alive!==false&&!deaths.has(uid))u[`private/${uid}/turn`]={active:false,state:"day",night:n};await update(ref(db,path()),u);$("hpStartVote")?.classList.remove("hidden")}

async function submitHostAction(skip=false){const t=privateData?.[hostUid]?.turn;if(!t?.active)return;await set(ref(db,path(`actions/${t.night}/${t.phaseId}/${hostUid}`)),{selected:skip?[]:[...hostSelections],skipped:skip,saveWolfTarget:!skip&&t.behavior?.kind==="witch"?Boolean($("hpWitchSave")?.checked):false,submittedAt:Date.now()})}
function renderVoteTargets(){if(!voteId)return;const box=$("hpHostVoteBox"),aliveHost=players?.[hostUid]?.alive!==false;box?.classList.toggle("hidden",!aliveHost);if(!aliveHost)return;const list=alive().filter(([id])=>id!==hostUid);$("hpVoteTargets").innerHTML=list.map(([id,p])=>`<button class="hp-target ${hostVote===id?"selected":""}" data-hpv="${id}" type="button">${esc(p.name)}</button>`).join("");document.querySelectorAll("[data-hpv]").forEach(b=>b.onclick=()=>{hostVote=b.dataset.hpv;renderVoteTargets()});$("hpSubmitVote").disabled=!hostVote||Boolean(votes?.[hostUid]);$("hpSubmitVote").textContent=votes?.[hostUid]?"ส่งโหวตแล้ว ✓":"ส่งโหวตของฉัน"}
function tally(){const m=new Map();for(const[uid,v]of Object.entries(votes||{})){if(players?.[uid]?.alive===false)continue;const t=v?.target;if(!t)continue;const w=roleOf(uid)?.name==="Mayor"?2:1;m.set(t,(m.get(t)||0)+w)}return m}
function renderVote(){if(!voteId||publicData?.phase?.state!=="vote")return;const ids=alive().map(([id])=>id),sent=ids.filter(id=>votes?.[id]).length;$("hpVoteStatus").classList.remove("hidden");$("hpVoteStatus").textContent=`ส่งโหวตแล้ว ${sent} / ${ids.length} คน • ซ่อนคะแนนจนกว่าจะครบ`;renderVoteTargets();if(sent<ids.length){$("hpVoteTally").classList.add("hidden");$("hpConfirmVote").classList.add("hidden");$("hpRevote").classList.add("hidden");return}const m=tally(),max=m.size?Math.max(...m.values()):0,tied=[...m].filter(([,n])=>n===max).map(([id])=>id);voteResult={winner:tied.length===1?tied[0]:null,tied,m};$("hpVoteTally").innerHTML=[...m].sort((a,b)=>b[1]-a[1]).map(([id,n],i)=>`<div class="hp-tally-row ${i===0?"leading":""}"><span>${esc(nameOf(id))}</span><strong>${n} คะแนน</strong></div>`).join("");$("hpVoteTally").classList.remove("hidden");if(voteResult.winner){$("hpConfirmVote").textContent=`ยืนยัน: ${nameOf(voteResult.winner)} ถูกโหวตออก`;$("hpConfirmVote").classList.remove("hidden");$("hpRevote").classList.add("hidden")}else{$("hpConfirmVote").classList.add("hidden");$("hpRevote").classList.remove("hidden");$("hpVoteStatus").textContent=`คะแนนเสมอ: ${tied.map(nameOf).join(", ")} • โหวตใหม่`}}
function listenVotes(id){stopVotes?.();votes={};stopVotes=onValue(ref(db,path(`votes/${id}`)),s=>{votes=s.val()||{};renderVote()})}
async function startVote(){voteId=`v${currentNight}_${Date.now().toString(36)}`;votes={};hostVote="";voteResult=null;await update(ref(db,path()),{"public/status":"vote","public/phase":{state:"vote",night:currentNight,voteId}});for(const[uid,p]of Object.entries(players))if(p.alive!==false)await update(ref(db,path(`private/${uid}/turn`)),{active:false,state:"vote",night:currentNight,voteId});$("hpStartVote").classList.add("hidden");listenVotes(voteId);renderVote();say("เริ่มโหวต ทุกคนเลือกผู้เล่นหนึ่งคนในหน้าจอของตัวเอง")}
async function submitHostVote(){if(voteId&&hostVote)await set(ref(db,path(`votes/${voteId}/${hostUid}`)),{target:hostVote,submittedAt:Date.now()})}
function winState(){const ids=alive().map(([id])=>id),wolves=ids.filter(id=>isPackRole(roleOf(id))),others=ids.filter(id=>!isPackRole(roleOf(id)));if(!wolves.length)return{over:true,text:"ฝ่ายชาวบ้านชนะ",winner:"ฝ่ายชาวบ้าน"};if(wolves.length>=others.length)return{over:true,text:"ฝ่ายมนุษย์หมาป่าชนะ",winner:"ฝ่ายมนุษย์หมาป่า"};return{over:false}}
async function confirmVote(){if(!voteResult?.winner)return;const t=voteResult.winner;await eliminate(t,"vote");await update(ref(db,path()),{"public/status":"day","public/phase":{state:"vote-result",night:currentNight,eliminatedName:nameOf(t),roleRevealed:false}});stopVotes?.();$("hpVoteStatus").textContent=`${nameOf(t)} ถูกโหวตออก • 🔒 ไม่เปิดเผย Role`;$("hpConfirmVote").classList.add("hidden");$("hpRevote").classList.add("hidden");$("hpHostVoteBox").classList.add("hidden");const w=winState();if(w.over){await update(ref(db,path()),{"public/status":"gameover","public/phase":{state:"gameover",winner:w.winner}});say(`${nameOf(t)} ถูกโหวตออก ไม่มีการเปิดเผยบทบาท ${w.text}`);$("hpVoteStatus").textContent+=` • ${w.text}`;return}say(`${nameOf(t)} ถูกโหวตออก ไม่มีการเปิดเผยบทบาท ทุกคนเตรียมหลับตา`,()=>setTimeout(()=>$("againBtn")?.click(),1000))}

createBtn.onclick=createRoom;assignBtn.onclick=assignRoles;copyBtn.onclick=copyLink;
$("hpRevealRole").onclick=()=>{const b=$("hpRoleBox"),hide=!b.classList.contains("hidden");b.classList.toggle("hidden",hide);$("hpRevealRole").textContent=hide?"ดู Role ของฉัน":"ซ่อน Role"};
$("hpSubmitAction").onclick=()=>submitHostAction(false);$("hpSkipAction").onclick=()=>submitHostAction(true);$("hpWitchSave").onchange=renderHostTurn;
$("hpStartVote").onclick=startVote;$("hpSubmitVote").onclick=submitHostVote;$("hpConfirmVote").onclick=confirmVote;$("hpRevote").onclick=startVote;

// Prevent starting the first Night before everyone has a role. This runs before the inline app click handler.
$("startBtn")?.addEventListener("click",e=>{if(!roomCode||!$("startBtn").textContent.includes("เริ่ม Night"))return;const pe=Object.entries(players||{}),missing=pe.filter(([uid,p])=>p.assigned!==true||!roleOf(uid));if(pe.length<2||missing.length){e.preventDefault();e.stopImmediatePropagation();alert(pe.length<2?"ต้องมีผู้เล่นอย่างน้อย 2 คนรวม Host":"กรุณาสุ่มแจก Role ให้ครบทุกคนก่อนเริ่ม Night")}},true);

window.WWOnline={publishRole,publishSleep,publishDay,beginNight};

(async()=>{
  if(!isFirebaseConfigured()){setStatus("ต้องตั้งค่า Firebase");return}
  try{const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getDatabase(app);hostUid=(await signInAnonymously(auth)).user.uid;setStatus("Firebase พร้อม • Host จะเล่นด้วย",true);const saved=localStorage.getItem("ww_host_room");if(saved){const s=await get(ref(db,`rooms/${saved}/hostUid`));if(s.val()===hostUid){roomCode=saved;bodyEl?.classList.remove("hidden");codeEl.textContent=saved;createBtn.textContent="สร้างห้องใหม่";attach();const auto=$("autoToggle");if(auto){auto.checked=true;auto.disabled=true};setStatus("กลับเข้าห้องเดิมแล้ว",true)}}}catch(e){console.error(e);setStatus("เชื่อม Firebase ไม่สำเร็จ")}
})();
