import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getDatabase, ref, set, get, update, onValue
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";
import { behaviorFor, roleKey, safeRole } from "./game-rules.js";

const $ = (id) => document.getElementById(id);
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

let db = null;
let auth = null;
let hostUid = null;
let roomCode = "";
let players = {};
let privateData = {};
let currentPhaseId = "";
let currentNight = 1;
let currentExpected = [];
let stopActions = null;

function setStatus(text, connected=false){
  statusEl.textContent = text;
  statusEl.classList.toggle("connected", connected);
}
function roomPath(path=""){
  return `rooms/${roomCode}${path ? "/" + path : ""}`;
}
function randomCode(){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for(let i=0;i<5;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}
function shuffle(a){
  const arr=[...a];
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}
function playerName(uid){
  return players?.[uid]?.name || "ผู้เล่น";
}
function displayRole(role){
  if(!role) return "ยังไม่ได้แจก";
  return role.th && role.th !== role.name ? `${role.th} (${role.name})` : role.name;
}

function renderPlayers(){
  const entries = Object.entries(players || {}).sort((a,b)=>(a[1].joinedAt||0)-(b[1].joinedAt||0));
  playerCountEl.textContent = entries.length;
  if(!entries.length){
    playersEl.innerHTML = `<div class="online-empty">รอผู้เล่นเข้าห้อง… เปิด player.html แล้วใส่ Room Code ${roomCode || ""}</div>`;
    return;
  }
  playersEl.innerHTML = entries.map(([uid,p])=>{
    const role = privateData?.[uid]?.role;
    const alive = p.alive !== false;
    const reason = p.eliminatedBy === "vote" ? "ถูกโหวตออก" :
      p.eliminatedBy === "werewolf" ? "โดนหมาป่ากำจัด" :
      p.eliminatedBy ? "ถูกกำจัด" : "ออกจากเกม";
    return `<div class="online-player">
      <div class="online-player-main">
        <div class="online-player-name"><span class="presence ${p.connected!==false?"on":""}"></span>${escapeHtml(p.name || "Player")}</div>
        <div class="online-player-sub">${role ? "🎭 "+escapeHtml(displayRole(role)) : "ยังไม่ได้แจก Role"} • ${alive ? "ยังอยู่ในเกม" : escapeHtml(reason)} • 🔒 ไม่เปิด Role</div>
      </div>
      <div class="alive-actions">
        ${alive ? `
          <button class="alive-btn vote" data-eliminate="vote" data-uid="${uid}">โหวตออก</button>
          <button class="alive-btn wolf" data-eliminate="werewolf" data-uid="${uid}">หมาป่าฆ่า</button>
        ` : `
          <button class="alive-btn restore" data-restore-uid="${uid}">↩ คืนเกม</button>
        `}
      </div>
    </div>`;
  }).join("");

  playersEl.querySelectorAll("[data-eliminate]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const uid=btn.dataset.uid;
      const reason=btn.dataset.eliminate;
      await eliminatePlayer(uid, reason);
    });
  });
  playersEl.querySelectorAll("[data-restore-uid]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const uid=btn.dataset.restoreUid;
      await update(ref(db, roomPath(`players/${uid}`)), {
        alive:true,
        eliminatedBy:null,
        eliminatedAt:null
      });
    });
  });
}
function escapeHtml(v){
  return String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
}

async function createRoom(){
  if(!db || !hostUid) return alert("ยังไม่ได้เชื่อม Firebase");
  setStatus("กำลังสร้างห้อง…");
  let code;
  for(let i=0;i<8;i++){
    const candidate=randomCode();
    const snap=await get(ref(db, `rooms/${candidate}/hostUid`));
    if(!snap.exists()){ code=candidate; break; }
  }
  if(!code) return alert("สร้าง Room Code ไม่สำเร็จ ลองอีกครั้ง");

  roomCode=code;
  await set(ref(db, roomPath("hostUid")), hostUid);
  await set(ref(db, roomPath("public")), {
    status:"lobby",
    createdAt:Date.now(),
    phase:{state:"lobby",night:1}
  });
  localStorage.setItem("ww_host_room", roomCode);
  attachRoom();
  bodyEl.classList.remove("hidden");
  codeEl.textContent=roomCode;
  setStatus("ห้องออนไลน์พร้อม", true);
  createBtn.textContent="สร้างห้องใหม่";
}

function attachRoom(){
  onValue(ref(db, roomPath("players")), snap=>{
    players=snap.val() || {};
    renderPlayers();
  });
  onValue(ref(db, roomPath("private")), snap=>{
    privateData=snap.val() || {};
    renderPlayers();
  });
}


async function eliminatePlayer(uid, reason){
  const label = reason === "vote" ? "ถูกโหวตออก" : "โดนหมาป่ากำจัด";
  await update(ref(db, roomPath(`players/${uid}`)), {
    alive:false,
    eliminatedBy:reason,
    eliminatedAt:Date.now()
  });

  // Important: role remains ONLY in private/<uid>. We never copy it into public/players.
  // Clear any active turn so an eliminated player cannot submit a night action.
  await update(ref(db, roomPath(`private/${uid}/turn`)), {
    active:false,
    state:"eliminated",
    eliminationReason:reason,
    eliminatedAt:Date.now()
  });

  alert(`${playerName(uid)} ${label}\\n\\nRole จะไม่ถูกเปิดเผยให้ผู้เล่นคนอื่น`);
}

async function assignRoles(){
  const bridge=window.WWModeratorBridge;
  if(!bridge) return;
  const rolePool=bridge.getRoles().filter(r=>r.name && r.name!=="Moderator" && r.name!=="The Moderator");
  const playerEntries=Object.entries(players || {});
  if(!playerEntries.length) return alert("ยังไม่มีผู้เล่นในห้อง");
  if(rolePool.length !== playerEntries.length){
    return alert(`จำนวน Role (${rolePool.length}) ต้องเท่ากับจำนวนผู้เล่น (${playerEntries.length}) ก่อนแจก\n\nเพิ่ม Role ซ้ำได้ เช่น Villager หรือ Werewolf หลายใบ`);
  }

  const shuffledRoles=shuffle(rolePool);
  const shuffledPlayers=shuffle(playerEntries);
  const assignments={};
  shuffledPlayers.forEach(([uid,p],i)=>{
    const role={...safeRole(shuffledRoles[i]), ability:shuffledRoles[i].ability || shuffledRoles[i].action || ""};
    assignments[uid]={player:p,role};
  });

  const updates={};
  for(const [uid,item] of Object.entries(assignments)){
    const teammates=Object.entries(assignments)
      .filter(([otherId,o])=>otherId!==uid && (
        (item.role.cat==="Werewolves" && o.role.cat==="Werewolves") ||
        (item.role.name==="Mason" && o.role.name==="Mason")
      ))
      .map(([otherId,o])=>({uid:otherId,name:o.player.name}));

    updates[`private/${uid}`]={
      role:item.role,
      teammates,
      turn:{active:false,state:"lobby"}
    };
    updates[`players/${uid}/assigned`]=true;
    updates[`players/${uid}/alive`]=true;
    updates[`players/${uid}/eliminatedBy`]=null;
    updates[`players/${uid}/eliminatedAt`]=null;
  }
  updates["public/status"]="assigned";
  await update(ref(db, roomPath()), updates);
  alert("สุ่มแจก Role ให้ผู้เล่นครบแล้ว");
}

async function copyJoinLink(){
  if(!roomCode) return;
  const url=new URL("player.html", location.href);
  url.searchParams.set("room",roomCode);
  try{
    await navigator.clipboard.writeText(url.toString());
    copyBtn.textContent="คัดลอกแล้ว ✓";
    setTimeout(()=>copyBtn.textContent="คัดลอกลิงก์",1300);
  }catch{
    prompt("คัดลอกลิงก์นี้",url.toString());
  }
}

function listenActions(night, phaseId){
  stopActions?.();
  currentPhaseId=phaseId;
  if(!phaseId){
    actionPanel.classList.add("hidden");
    return;
  }
  stopActions=onValue(ref(db, roomPath(`actions/${night}/${phaseId}`)), snap=>{
    const actions=snap.val() || {};
    renderActions(actions);
  });
}

function renderActions(actions){
  if(!currentExpected.length){
    actionPanel.classList.add("hidden");
    return;
  }
  actionPanel.classList.remove("hidden");
  const submitted=currentExpected.filter(uid=>actions?.[uid]).length;
  actionProgress.textContent=`${submitted} / ${currentExpected.length} ส่งแล้ว`;

  actionList.innerHTML=currentExpected.map(uid=>{
    const a=actions?.[uid];
    if(!a){
      return `<div class="online-action-row"><b>${escapeHtml(playerName(uid))}</b><span>กำลังตัดสินใจ…</span></div>`;
    }
    const selectedIds = Array.isArray(a.selected) ? a.selected : [];
    const selectedNames = selectedIds.map(id => players?.[id]?.name || "ผู้เล่นไม่ทราบชื่อ");
    const answer=a.skipped ? "ไม่ใช้ความสามารถ" :
      (selectedNames.length ? selectedNames.join(", ") : "เสร็จแล้ว");
    return `<div class="online-action-row"><b>${escapeHtml(playerName(uid))}</b><span>${escapeHtml(answer)}</span></div>`;
  }).join("");
}

async function publishRole(role, info){
  if(!roomCode || !db) return;
  const key=roleKey(role);
  currentNight=Number(info?.nightNumber)||1;
  currentPhaseId=`n${currentNight}_${Date.now().toString(36)}`;
  const behavior=behaviorFor(role);
  const roleSafe={...safeRole({...role,ability:window.WWModeratorBridge?.abilitySummary?.(role) || role.action})};
  const assignments=privateData || {};
  currentExpected=[];

  const updates={
    "public/status":"night",
    "public/phase":{
      state:"night",
      night:currentNight,
      phaseId:currentPhaseId,
      step:info?.step||1,
      total:info?.total||1,
      duration:info?.totalDuration||30
    }
  };

  for(const [uid,p] of Object.entries(players || {})){
    const assigned=assignments?.[uid]?.role;
    const alive=p.alive !== false;
    const active=alive && assigned?.key===key;
    if(active) currentExpected.push(uid);

    updates[`private/${uid}/turn`]=active ? {
      active:true,
      state:"act",
      night:currentNight,
      phaseId:currentPhaseId,
      role:roleSafe,
      action:info?.action || role.action || "",
      ability:window.WWModeratorBridge?.abilitySummary?.(role) || role.action || "",
      behavior
    } : {
      active:false,
      state:"sleep",
      night:currentNight,
      phaseId:currentPhaseId
    };
  }

  await update(ref(db, roomPath()), updates);
  listenActions(currentNight,currentPhaseId);
  renderActions({});
}

async function publishSleep(){
  if(!roomCode || !db) return;
  const updates={"public/phase/state":"night-transition"};
  for(const uid of Object.keys(players || {})){
    updates[`private/${uid}/turn`]={
      active:false,state:"sleep",night:currentNight,phaseId:currentPhaseId
    };
  }
  await update(ref(db, roomPath()),updates);
}

async function publishDay({nightNumber}={}){
  if(!roomCode || !db) return;
  currentExpected=[];
  actionPanel.classList.add("hidden");
  stopActions?.();
  const updates={
    "public/status":"day",
    "public/phase":{
      state:"day",
      night:Number(nightNumber)||currentNight||1,
      phaseId:""
    }
  };
  for(const uid of Object.keys(players || {})){
    updates[`private/${uid}/turn`]={active:false,state:"day",night:Number(nightNumber)||currentNight||1};
  }
  await update(ref(db, roomPath()),updates);
}

function beginNight(){}

window.WWOnline={publishRole,publishSleep,publishDay,beginNight};

createBtn.addEventListener("click",createRoom);
assignBtn.addEventListener("click",assignRoles);
copyBtn.addEventListener("click",copyJoinLink);

(async function boot(){
  if(!isFirebaseConfigured()){
    setStatus("ต้องตั้งค่า Firebase");
    createBtn.addEventListener("click",()=>alert("เปิดไฟล์ firebase-config.js แล้ววาง Firebase config ก่อนใช้งาน Online Room"),{once:true});
    return;
  }
  try{
    const app=initializeApp(firebaseConfig);
    auth=getAuth(app);
    db=getDatabase(app);
    const cred=await signInAnonymously(auth);
    hostUid=cred.user.uid;
    setStatus("Firebase พร้อม • สร้างห้องได้", true);
  }catch(err){
    console.error(err);
    setStatus("เชื่อม Firebase ไม่สำเร็จ");
  }
})();
