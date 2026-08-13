import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getDatabase, ref, set, get, update, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

const $=(id)=>document.getElementById(id);
let db=null,auth=null,uid="",room="",myName="",players={},privateState={},publicState={};
let selected=new Set(),selectedVote="",lastPhaseId="";
const joinView=$("joinView"),gameView=$("gameView"),lobbyView=$("lobbyView"),roleView=$("roleView"),phaseView=$("phaseView"),turnView=$("turnView"),voteView=$("voteView");

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]))}
function roomPath(path=""){return `rooms/${room}${path?"/"+path:""}`}
function showOnly(view){[lobbyView,roleView,phaseView,turnView,voteView].forEach(v=>v.classList.add("hidden"));view?.classList.remove("hidden")}
function displayRole(role){return role?.th&&role.th!==role.name?role.th:(role?.name||"")}
function renderPlayers(){
  const arr=Object.entries(players||{}).sort((a,b)=>(a[1].joinedAt||0)-(b[1].joinedAt||0));
  $("playerList").innerHTML=arr.map(([id,p])=>{const alive=p.alive!==false;const reason=p.eliminatedBy==="vote"?" • ถูกโหวตออก":p.eliminatedBy==="werewolf"?" • โดนหมาป่ากำจัด":(!alive?" • ถูกกำจัด":"");return `<div class="player"><span class="dot ${!alive?"dead":p.connected===false?"off":""}"></span>${esc(p.name||"Player")}${id===uid?" (คุณ)":""}${alive?"":esc(reason)}${alive?"":" • 🔒 ไม่เปิด Role"}</div>`}).join("");
  const me=players?.[uid],dead=me&&me.alive===false;
  $("deadBanner").classList.toggle("hidden",!dead);
  if(dead) $("deadBanner").textContent=`☠️ ${me.eliminatedBy==="vote"?"คุณถูกโหวตออก":me.eliminatedBy==="werewolf"?"คุณโดนหมาป่ากำจัด":"คุณถูกกำจัด"} — Role ของคุณจะไม่ถูกเปิดเผย`;
}
function renderRole(){
  const role=privateState?.role;if(!role)return;
  $("roleName").textContent=displayRole(role);$("roleEnglish").textContent=role.th&&role.th!==role.name?role.name:(role.cat||"");$("roleAbility").textContent=role.ability||role.action||"ทำความสามารถตามกติกา";
  const mates=privateState?.teammates||[];$("teamText").classList.toggle("hidden",!mates.length);if(mates.length)$("teamText").textContent=`เพื่อนที่คุณรู้จัก: ${mates.map(x=>x.name).join(", ")}`;
}
function renderVote(){
  const phase=publicState?.phase||{};if(phase.state!=="vote")return;
  const alive=Object.entries(players||{}).filter(([,p])=>p.alive!==false&&p.connected!==false);
  $("voteList").innerHTML=alive.map(([id,p])=>`<button class="target ${selectedVote===id?"selected":""}" data-vote="${id}">${esc(p.name||"Player")}${id===uid?" (คุณ)":""}</button>`).join("");
  $("voteList").querySelectorAll("[data-vote]").forEach(b=>b.addEventListener("click",()=>{selectedVote=b.dataset.vote;renderVote();$("submitVoteBtn").disabled=false}));
}
function renderTurn(turn){
  if(lastPhaseId!==turn.phaseId){selected.clear();lastPhaseId=turn.phaseId;$("sentMessage").classList.add("hidden");$("submitActionBtn").classList.remove("hidden");$("skipActionBtn").classList.toggle("hidden",!turn?.behavior?.optional)}
  $("turnRole").textContent=displayRole(turn.role);$("turnAction").textContent=turn.action||turn.ability||"ทำความสามารถของคุณ";
  const behavior=turn.behavior||{targetCount:1,allowSelf:false,optional:false},targetCount=Number(behavior.targetCount)||0;
  if(targetCount===0){$("targetSection").classList.add("hidden");$("submitActionBtn").textContent="เสร็จแล้ว";$("submitActionBtn").disabled=false;return}
  $("targetSection").classList.remove("hidden");$("targetTitle").textContent=targetCount===2?"เลือกผู้เล่น 2 คน":"เลือกผู้เล่น 1 คน";
  const list=Object.entries(players||{}).filter(([id,p])=>p.alive!==false&&(behavior.allowSelf||id!==uid));
  $("targetList").innerHTML=list.map(([id,p])=>`<button class="target ${selected.has(id)?"selected":""}" data-target="${id}">${esc(p.name||"Player")}${id===uid?" (คุณ)":""}</button>`).join("");
  $("targetList").querySelectorAll("[data-target]").forEach(btn=>btn.addEventListener("click",()=>{const id=btn.dataset.target;if(selected.has(id))selected.delete(id);else{if(selected.size>=targetCount)selected.delete([...selected][0]);selected.add(id)}renderTurn(turn)}));
  $("submitActionBtn").disabled=selected.size!==targetCount;
}
function renderState(){
  renderPlayers();renderRole();
  const role=privateState?.role,turn=privateState?.turn,me=players?.[uid],dead=me&&me.alive===false,phase=publicState?.phase||{};
  if(!role){showOnly(lobbyView);$("lobbyText").textContent="เข้าห้องแล้ว • รอ Host แจก Role";return}
  if(dead){showOnly(phaseView);$("phaseTitle").textContent="คุณถูกกำจัดแล้ว";$("phaseSub").textContent="Role จะไม่ถูกเปิดเผย";return}
  if(phase.state==="vote"){showOnly(voteView);renderVote();return}
  if(!turn||turn.state==="lobby"){showOnly(roleView);return}
  if(turn.active){renderTurn(turn);showOnly(turnView);return}
  showOnly(phaseView);
  if(phase.state==="day"||turn.state==="day"){$("phaseTitle").textContent="ทุกคนลืมตา";$("phaseSub").textContent=`เข้าสู่ช่วงกลางวัน • Night ${phase.night||turn.night||1} จบแล้ว`}else{$("phaseTitle").textContent="หลับตา";$("phaseSub").textContent=`Night ${phase.night||turn.night||1} • รอเสียงเรียก Role ของคุณ`}
}
async function submitAction(skipped=false){
  const turn=privateState?.turn;if(!turn?.phaseId)return;
  const selectedIds=skipped?[]:[...selected];await set(ref(db,roomPath(`actions/${turn.night}/${turn.phaseId}/${uid}`)),{selected:selectedIds,skipped,submittedAt:Date.now()});$("sentMessage").classList.remove("hidden");$("submitActionBtn").classList.add("hidden");$("skipActionBtn").classList.add("hidden");
}
async function submitVote(){
  const phase=publicState?.phase;if(phase?.state!=="vote"||!phase.voteId||!selectedVote)return;
  await set(ref(db,roomPath(`votes/${phase.voteId}/${uid}`)),{target:selectedVote,submittedAt:Date.now()});$("voteSent").classList.remove("hidden");$("submitVoteBtn").disabled=true;
}
async function joinRoom(){
  if(!db||!uid)return alert("ยังไม่ได้เชื่อม Firebase");const code=$("roomInput").value.trim().toUpperCase(),name=$("nameInput").value.trim();if(code.length!==5)return alert("Room Code ต้องมี 5 ตัว");if(!name)return alert("กรุณาใส่ชื่อผู้เล่น");
  const hostSnap=await get(ref(db,`rooms/${code}/hostUid`));if(!hostSnap.exists())return alert("ไม่พบห้องนี้");room=code;myName=name;await update(ref(db,roomPath(`players/${uid}`)),{name,connected:true,joinedAt:Date.now()});try{await onDisconnect(ref(db,roomPath(`players/${uid}/connected`))).set(false)}catch{}
  localStorage.setItem("ww_player_room",room);localStorage.setItem("ww_player_name",myName);$("roomText").textContent=room;$("meText").textContent=myName;joinView.classList.add("hidden");gameView.classList.remove("hidden");attachListeners();
}
function attachListeners(){onValue(ref(db,roomPath("public")),s=>{publicState=s.val()||{};renderState()});onValue(ref(db,roomPath("players")),s=>{players=s.val()||{};renderState()});onValue(ref(db,roomPath(`private/${uid}`)),s=>{privateState=s.val()||{};renderState()})}
$("joinBtn").addEventListener("click",joinRoom);$("revealBtn").addEventListener("click",()=>{$("hiddenRoleCard").classList.add("hidden");$("revealedRoleCard").classList.remove("hidden")});$("hideRoleBtn").addEventListener("click",()=>{$("revealedRoleCard").classList.add("hidden");$("hiddenRoleCard").classList.remove("hidden")});$("submitActionBtn").addEventListener("click",()=>submitAction(false));$("skipActionBtn").addEventListener("click",()=>submitAction(true));$("submitVoteBtn").addEventListener("click",submitVote);
(async function boot(){const qp=new URLSearchParams(location.search);$("roomInput").value=(qp.get("room")||localStorage.getItem("ww_player_room")||"").toUpperCase();$("nameInput").value=localStorage.getItem("ww_player_name")||"";if(qp.get("host")==="1")$("hostNote").classList.remove("hidden");if(!isFirebaseConfigured()){setConnection("ต้องตั้งค่า Firebase");$("joinBtn").disabled=true;return}try{const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getDatabase(app);const cred=await signInAnonymously(auth);uid=cred.user.uid;$("connectionStatus").textContent="ออนไลน์"}catch(err){console.error(err);$("connectionStatus").textContent="เชื่อมไม่สำเร็จ"}})();
