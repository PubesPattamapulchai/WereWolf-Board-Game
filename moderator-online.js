import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getDatabase, ref, set, get, update, onValue } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";
import { behaviorFor, roleKey, safeRole } from "./game-rules.js";

const $ = (id) => document.getElementById(id);

function installHostPlayerUI(){
  const card=document.querySelector(".online-room-card");
  if(!card || document.getElementById("hostPlayToggle")) return;

  const style=document.createElement("style");
  style.textContent=`
    .host-play-setup{display:grid;grid-template-columns:minmax(0,1fr) minmax(180px,.7fr);gap:9px;margin-top:12px}
    .host-play-box{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid #334057;background:#0d131d;border-radius:14px}
    .host-play-box label{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:850;cursor:pointer}
    .host-play-box input[type=checkbox]{width:18px;height:18px;accent-color:#ef4454}
    .host-name{min-height:42px}
    .room-extra-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:7px}
    .vote-control{margin-top:10px;padding:10px;border-radius:14px;border:1px solid #3a445a;background:#0e141e}
    .vote-control-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:7px}
    .vote-control-title{font-size:12px;font-weight:900}
    .vote-control-sub{font-size:10px;color:#8f9bad}
    .vote-results{display:grid;gap:5px;margin-top:7px}
    .vote-result-row{display:flex;justify-content:space-between;gap:10px;font-size:11px;padding:6px 8px;border-radius:9px;background:#151c28}
    .vote-result-row b{color:#f0d69a}
    @media(max-width:720px){.host-play-setup{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const head=card.querySelector(".online-head");
  const setup=document.createElement("div");
  setup.className="host-play-setup";
  setup.innerHTML=`
    <div class="host-play-box">
      <div>
        <div style="font-size:12px;font-weight:900">ฉันเป็น Host และเล่นด้วย</div>
        <div class="panel-desc" style="margin-top:2px">Host จะถูกนับเป็นผู้เล่น 1 คน และได้รับ Role แบบสุ่มเหมือนทุกคน</div>
      </div>
      <label><input id="hostPlayToggle" type="checkbox" checked> เล่นด้วย</label>
    </div>
    <input id="hostPlayerName" class="field host-name" maxlength="24" value="Host" placeholder="ชื่อของ Host ในเกม">
  `;
  head.insertAdjacentElement("afterend",setup);

  const roomButtons=card.querySelector(".room-buttons");
  if(roomButtons){
    const extra=document.createElement("div");
    extra.className="room-extra-actions";
    extra.innerHTML=`
      <button id="openHostPlayerBtn" class="btn secondary" type="button">🎭 เปิดหน้าผู้เล่นของฉัน</button>
      <button id="startVoteBtn" class="btn secondary" type="button">🗳 เริ่มโหวต</button>
    `;
    roomButtons.insertAdjacentElement("afterend",extra);

    const vote=document.createElement("div");
    vote.id="voteControl";
    vote.className="vote-control hidden";
    vote.innerHTML=`
      <div class="vote-control-head">
        <div>
          <div class="vote-control-title">ผลโหวตปัจจุบัน</div>
          <div id="voteProgressText" class="vote-control-sub">0 / 0 คนโหวตแล้ว</div>
        </div>
        <button id="confirmVoteBtn" class="btn primary" type="button" style="min-height:36px;padding:6px 9px;font-size:11px">ยืนยันผลโหวต</button>
      </div>
      <div id="voteResults" class="vote-results"></div>
    `;
    extra.insertAdjacentElement("afterend",vote);
  }

  const desc=card.querySelector(".online-head .panel-desc");
  if(desc) desc.textContent="คนสร้างห้องเล่นด้วยได้ • Host กดเริ่ม Night / เริ่มโหวต / ยืนยันโหวต ส่วนการเรียก Role กลางคืนใช้เสียงอัตโนมัติ";
}

installHostPlayerUI();

const statusEl = $("onlineStatus");
const bodyEl = $("onlineRoomBody");
const codeEl = $("roomCodeText");
const playersEl = $("onlinePlayerList");
const playerCountEl = $("onlinePlayerCount");
const createBtn = $("createRoomBtn");
const assignBtn = $("assignRolesBtn");
const copyBtn = $("copyJoinBtn");
const actionPanel = $("onlineActionPanel");
const actionList = $("onlineActionList");
const actionProgress = $("onlineActionProgress");
const hostPlayToggle = $("hostPlayToggle");
const hostPlayerName = $("hostPlayerName");
const openHostPlayerBtn = $("openHostPlayerBtn");
const startVoteBtn = $("startVoteBtn");
const confirmVoteBtn = $("confirmVoteBtn");
const voteControl = $("voteControl");
const voteProgressText = $("voteProgressText");
const voteResults = $("voteResults");

let db=null, auth=null, hostUid=null, roomCode="";
let players={}, privateData={};
let currentPhaseId="", currentNight=1, currentExpected=[];
let stopActions=null, voteId="", currentVotes={}, stopVotes=null;

function setStatus(text, connected=false){
  statusEl.textContent=text;
  statusEl.classList.toggle("connected",connected);
}
function roomPath(path=""){ return `rooms/${roomCode}${path?"/"+path:""}`; }
function randomCode(){
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({length:5},()=>chars[Math.floor(Math.random()*chars.length)]).join("");
}
function shuffle(a){
  const arr=[...a];
  for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}
  return arr;
}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]))}
function playerName(uid){return players?.[uid]?.name||"ผู้เล่น"}
function displayRole(role){
  if(!role) return "ยังไม่ได้แจก";
  return role.th&&role.th!==role.name?`${role.th} (${role.name})`:role.name;
}
function hostIsPlayer(){return Boolean(hostUid&&players?.[hostUid])}
function aliveEntries(){return Object.entries(players||{}).filter(([,p])=>p.alive!==false)}

function renderPlayers(){
  const entries=Object.entries(players||{}).sort((a,b)=>(a[1].joinedAt||0)-(b[1].joinedAt||0));
  playerCountEl.textContent=entries.length;
  if(!entries.length){
    playersEl.innerHTML=`<div class="online-empty">รอผู้เล่นเข้าห้อง… เปิด player.html แล้วใส่ Room Code ${roomCode||""}</div>`;
    return;
  }
  const hideRoles=hostIsPlayer();
  playersEl.innerHTML=entries.map(([uid,p])=>{
    const role=privateData?.[uid]?.role;
    const alive=p.alive!==false;
    const reason=p.eliminatedBy==="vote"?"ถูกโหวตออก":p.eliminatedBy==="werewolf"?"โดนหมาป่ากำจัด":p.eliminatedBy?"ถูกกำจัด":"ออกจากเกม";
    const roleText=role?(hideRoles?"🔒 Role ถูกซ่อน":"🎭 "+escapeHtml(displayRole(role))):"ยังไม่ได้แจก Role";
    return `<div class="online-player">
      <div class="online-player-main">
        <div class="online-player-name"><span class="presence ${p.connected!==false?"on":""}"></span>${escapeHtml(p.name||"Player")}${uid===hostUid?" • HOST":""}</div>
        <div class="online-player-sub">${roleText} • ${alive?"ยังอยู่ในเกม":escapeHtml(reason)} • 🔒 ไม่เปิด Role</div>
      </div>
      <div class="alive-actions">
        ${alive?`
          <button class="alive-btn vote" data-eliminate="vote" data-uid="${uid}">โหวตออก</button>
          <button class="alive-btn wolf" data-eliminate="werewolf" data-uid="${uid}">หมาป่าฆ่า</button>
        `:`<button class="alive-btn restore" data-restore-uid="${uid}">↩ คืนเกม</button>`}
      </div>
    </div>`;
  }).join("");

  playersEl.querySelectorAll("[data-eliminate]").forEach(btn=>btn.addEventListener("click",()=>eliminatePlayer(btn.dataset.uid,btn.dataset.eliminate)));
  playersEl.querySelectorAll("[data-restore-uid]").forEach(btn=>btn.addEventListener("click",async()=>{
    const uid=btn.dataset.restoreUid;
    await update(ref(db,roomPath(`players/${uid}`)),{alive:true,eliminatedBy:null,eliminatedAt:null});
  }));
}
function attachRoom(){
  onValue(ref(db,roomPath("players")),snap=>{players=snap.val()||{};renderPlayers()});
  onValue(ref(db,roomPath("private")),snap=>{privateData=snap.val()||{};renderPlayers()});
}

async function createRoom(){
  if(!db||!hostUid) return alert("ยังไม่ได้เชื่อม Firebase");
  setStatus("กำลังสร้างห้อง…");
  let code="";
  for(let i=0;i<8;i++){
    const candidate=randomCode();
    const snap=await get(ref(db,`rooms/${candidate}/hostUid`));
    if(!snap.exists()){code=candidate;break}
  }
  if(!code) return alert("สร้าง Room Code ไม่สำเร็จ ลองอีกครั้ง");
  roomCode=code;
  await set(ref(db,roomPath("hostUid")),hostUid);
  await set(ref(db,roomPath("public")),{status:"lobby",createdAt:Date.now(),phase:{state:"lobby",night:1}});

  if(hostPlayToggle?.checked){
    const name=(hostPlayerName?.value||"Host").trim()||"Host";
    await update(ref(db,roomPath(`players/${hostUid}`)),{
      name,alive:true,connected:true,joinedAt:Date.now(),assigned:false
    });
  }

  localStorage.setItem("ww_host_room",roomCode);
  attachRoom();
  bodyEl.classList.remove("hidden");
  codeEl.textContent=roomCode;
  setStatus("ห้องออนไลน์พร้อม",true);
  createBtn.textContent="สร้างห้องใหม่";
}

async function eliminatePlayer(uid,reason){
  const label=reason==="vote"?"ถูกโหวตออก":"โดนหมาป่ากำจัด";
  await update(ref(db,roomPath(`players/${uid}`)),{alive:false,eliminatedBy:reason,eliminatedAt:Date.now()});
  await update(ref(db,roomPath(`private/${uid}/turn`)),{active:false,state:"eliminated",eliminationReason:reason,eliminatedAt:Date.now()});
  alert(`${playerName(uid)} ${label}\n\nRole จะไม่ถูกเปิดเผย`);
}

async function assignRoles(){
  const bridge=window.WWModeratorBridge;
  if(!bridge) return;
  const rolePool=bridge.getRoles().filter(r=>r.name&&r.name!=="Moderator"&&r.name!=="The Moderator");
  const playerEntries=Object.entries(players||{});
  if(!playerEntries.length) return alert("ยังไม่มีผู้เล่นในห้อง");
  if(rolePool.length!==playerEntries.length){
    return alert(`จำนวน Role (${rolePool.length}) ต้องเท่ากับจำนวนผู้เล่น (${playerEntries.length}) ก่อนแจก\n\nHost ที่เลือก “เล่นด้วย” ถูกนับรวมเป็นผู้เล่น 1 คน`);
  }

  const shuffledRoles=shuffle(rolePool), shuffledPlayers=shuffle(playerEntries), assignments={};
  shuffledPlayers.forEach(([uid,p],i)=>{
    const role={...safeRole(shuffledRoles[i]),ability:shuffledRoles[i].ability||shuffledRoles[i].action||""};
    assignments[uid]={player:p,role};
  });
  const updates={};
  for(const [uid,item] of Object.entries(assignments)){
    const teammates=Object.entries(assignments)
      .filter(([otherId,o])=>otherId!==uid&&((item.role.cat==="Werewolves"&&o.role.cat==="Werewolves")||(item.role.name==="Mason"&&o.role.name==="Mason")))
      .map(([otherId,o])=>({uid:otherId,name:o.player.name}));
    updates[`private/${uid}`]={role:item.role,teammates,turn:{active:false,state:"lobby"}};
    updates[`players/${uid}/assigned`]=true;
    updates[`players/${uid}/alive`]=true;
    updates[`players/${uid}/eliminatedBy`]=null;
    updates[`players/${uid}/eliminatedAt`]=null;
  }
  updates["public/status"]="assigned";
  await update(ref(db,roomPath()),updates);
  alert(hostIsPlayer()
    ?"แจก Role แล้ว • เพื่อไม่ให้ Host เห็น Role คนอื่น หน้าควบคุมจะซ่อน Role ทั้งหมด\nเปิด “หน้าผู้เล่นของฉัน” เพื่อดู Role ของคุณ"
    :"สุ่มแจก Role ให้ผู้เล่นครบแล้ว");
}

async function copyJoinLink(){
  if(!roomCode) return;
  const url=new URL("player.html",location.href);
  url.searchParams.set("room",roomCode);
  try{
    await navigator.clipboard.writeText(url.toString());
    copyBtn.textContent="คัดลอกแล้ว ✓";
    setTimeout(()=>copyBtn.textContent="คัดลอกลิงก์",1300);
  }catch{prompt("คัดลอกลิงก์นี้",url.toString())}
}
function openHostPlayer(){
  if(!roomCode) return alert("สร้างห้องก่อน");
  if(!hostIsPlayer()) return alert("ห้องนี้ไม่ได้ตั้งให้ Host เล่นด้วย");
  const url=new URL("player.html",location.href);
  url.searchParams.set("room",roomCode);
  url.searchParams.set("host","1");
  window.open(url.toString(),"_blank","noopener");
}

function renderVotes(votes={}){
  currentVotes=votes||{};
  const alive=aliveEntries(),counts={};
  Object.values(currentVotes).forEach(v=>{if(v?.target) counts[v.target]=(counts[v.target]||0)+1});
  voteProgressText.textContent=`${Object.keys(currentVotes).length} / ${alive.length} คนโหวตแล้ว`;
  voteResults.innerHTML=alive.map(([uid,p])=>`<div class="vote-result-row"><span>${escapeHtml(p.name||"Player")}</span><b>${counts[uid]||0} เสียง</b></div>`).join("");
}
function listenVotes(id){
  stopVotes?.();
  voteId=id;
  stopVotes=onValue(ref(db,roomPath(`votes/${id}`)),snap=>renderVotes(snap.val()||{}));
}
async function startVote(){
  if(!roomCode||!db) return alert("ยังไม่ได้สร้างห้อง");
  const alive=aliveEntries();
  if(alive.length<2) return alert("ผู้เล่นที่ยังอยู่ในเกมไม่พอสำหรับการโหวต");
  voteId=`v_${Date.now().toString(36)}`;
  currentVotes={};
  await update(ref(db,roomPath()),{
    "public/status":"vote",
    "public/phase":{state:"vote",voteId,night:currentNight||1,startedAt:Date.now()}
  });
  voteControl.classList.remove("hidden");
  renderVotes({});
  listenVotes(voteId);
}
async function confirmVote(){
  if(!voteId) return alert("ยังไม่มี Vote Phase");
  const alive=aliveEntries(),submitted=Object.keys(currentVotes||{}).length;
  if(submitted<alive.length&&!confirm(`ตอนนี้โหวตแล้ว ${submitted}/${alive.length} คน\nยืนยันผลตอนนี้เลยหรือไม่?`)) return;
  const counts={};
  Object.values(currentVotes||{}).forEach(v=>{if(v?.target) counts[v.target]=(counts[v.target]||0)+1});
  const ranked=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  if(!ranked.length) return alert("ยังไม่มีคะแนนโหวต");
  const topScore=ranked[0][1],top=ranked.filter(([,n])=>n===topScore);
  if(top.length>1){
    await update(ref(db,roomPath("public/phase")),{state:"day",voteResult:"tie",confirmedAt:Date.now()});
    voteControl.classList.add("hidden");stopVotes?.();
    return alert("คะแนนเสมอ — ไม่มีใครถูกกำจัด");
  }
  const targetUid=top[0][0];
  await eliminatePlayer(targetUid,"vote");
  await update(ref(db,roomPath("public/phase")),{state:"day",voteResult:"eliminated",eliminatedUid:targetUid,confirmedAt:Date.now()});
  voteControl.classList.add("hidden");stopVotes?.();
}

function listenActions(night,phaseId){
  stopActions?.();currentPhaseId=phaseId;
  if(!phaseId){actionPanel.classList.add("hidden");return}
  stopActions=onValue(ref(db,roomPath(`actions/${night}/${phaseId}`)),snap=>renderActions(snap.val()||{}));
}
function renderActions(actions){
  if(!currentExpected.length){actionPanel.classList.add("hidden");return}
  actionPanel.classList.remove("hidden");
  const submitted=currentExpected.filter(uid=>actions?.[uid]).length;
  actionProgress.textContent=`${submitted} / ${currentExpected.length} ส่งแล้ว`;

  if(hostIsPlayer()){
    actionList.innerHTML=`<div class="online-action-row"><b>🔒 ซ่อนคำตอบ Night Action</b><span>Host เล่นด้วย จึงแสดงเฉพาะจำนวนที่ส่งแล้ว</span></div>`;
    return;
  }
  actionList.innerHTML=currentExpected.map(uid=>{
    const a=actions?.[uid];
    if(!a) return `<div class="online-action-row"><b>${escapeHtml(playerName(uid))}</b><span>กำลังตัดสินใจ…</span></div>`;
    const selectedIds=Array.isArray(a.selected)?a.selected:[];
    const selectedNames=selectedIds.map(id=>players?.[id]?.name||"ผู้เล่นไม่ทราบชื่อ");
    const answer=a.skipped?"ไม่ใช้ความสามารถ":selectedNames.length?selectedNames.join(", "):"เสร็จแล้ว";
    return `<div class="online-action-row"><b>${escapeHtml(playerName(uid))}</b><span>${escapeHtml(answer)}</span></div>`;
  }).join("");
}

async function publishRole(role,info){
  if(!roomCode||!db) return;
  const key=roleKey(role);
  currentNight=Number(info?.nightNumber)||1;
  currentPhaseId=`n${currentNight}_${Date.now().toString(36)}`;
  const behavior=behaviorFor(role);
  const roleSafe={...safeRole({...role,ability:window.WWModeratorBridge?.abilitySummary?.(role)||role.action})};
  currentExpected=[];
  const updates={
    "public/status":"night",
    "public/phase":{state:"night",night:currentNight,phaseId:currentPhaseId,step:info?.step||1,total:info?.total||1,duration:info?.totalDuration||30}
  };
  for(const [uid,p] of Object.entries(players||{})){
    const assigned=privateData?.[uid]?.role,alive=p.alive!==false,active=alive&&assigned?.key===key;
    if(active) currentExpected.push(uid);
    updates[`private/${uid}/turn`]=active?{
      active:true,state:"act",night:currentNight,phaseId:currentPhaseId,role:roleSafe,
      action:info?.action||role.action||"",ability:window.WWModeratorBridge?.abilitySummary?.(role)||role.action||"",behavior
    }:{active:false,state:"sleep",night:currentNight,phaseId:currentPhaseId};
  }
  await update(ref(db,roomPath()),updates);
  listenActions(currentNight,currentPhaseId);
  renderActions({});
}
async function publishSleep(){
  if(!roomCode||!db) return;
  const updates={"public/phase/state":"night-transition"};
  for(const uid of Object.keys(players||{})) updates[`private/${uid}/turn`]={active:false,state:"sleep",night:currentNight,phaseId:currentPhaseId};
  await update(ref(db,roomPath()),updates);
}
async function publishDay({nightNumber}={}){
  if(!roomCode||!db) return;
  currentExpected=[];actionPanel.classList.add("hidden");stopActions?.();
  const night=Number(nightNumber)||currentNight||1;
  const updates={"public/status":"day","public/phase":{state:"day",night,phaseId:""}};
  for(const uid of Object.keys(players||{})) updates[`private/${uid}/turn`]={active:false,state:"day",night};
  await update(ref(db,roomPath()),updates);
}
function beginNight(){}

window.WWOnline={publishRole,publishSleep,publishDay,beginNight};

createBtn.addEventListener("click",createRoom);
assignBtn.addEventListener("click",assignRoles);
copyBtn.addEventListener("click",copyJoinLink);
openHostPlayerBtn?.addEventListener("click",openHostPlayer);
startVoteBtn?.addEventListener("click",startVote);
confirmVoteBtn?.addEventListener("click",confirmVote);

(async function boot(){
  if(!isFirebaseConfigured()){
    setStatus("ต้องตั้งค่า Firebase");
    createBtn.addEventListener("click",()=>alert("เปิดไฟล์ firebase-config.js แล้ววาง Firebase config ก่อนใช้งาน Online Room"),{once:true});
    return;
  }
  try{
    const app=initializeApp(firebaseConfig);
    auth=getAuth(app);db=getDatabase(app);
    const cred=await signInAnonymously(auth);
    hostUid=cred.user.uid;
    setStatus("Firebase พร้อม • สร้างห้องได้",true);
  }catch(err){
    console.error(err);
    setStatus("เชื่อม Firebase ไม่สำเร็จ");
  }
})();