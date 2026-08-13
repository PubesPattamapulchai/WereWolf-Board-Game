import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getDatabase, ref, set, get, update, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

const $=(id)=>document.getElementById(id);
let db=null,auth=null,uid="",room="",myName="",players={},privateState={},publicState={};
let selected=new Set(),selectedVote="",lastPhaseId="",defenseTimer=null;
let firstVoteSubmittedFor="",confirmChoice="",confirmSubmittedFor="",lastConfirmId="";
const joinView=$("joinView"),gameView=$("gameView"),lobbyView=$("lobbyView"),roleView=$("roleView"),phaseView=$("phaseView"),turnView=$("turnView"),voteView=$("voteView"),defenseView=$("defenseView"),confirmVoteView=$("confirmVoteView"),voteResultView=$("voteResultView");

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]))}
function roomPath(path=""){return `rooms/${room}${path?"/"+path:""}`}
function showOnly(view){[lobbyView,roleView,phaseView,turnView,voteView,defenseView,confirmVoteView,voteResultView].forEach(v=>v.classList.add("hidden"));view?.classList.remove("hidden")}
function displayRole(role){return role?.th&&role.th!==role.name?role.th:(role?.name||"")}
function stopDefenseTimer(){if(defenseTimer)clearInterval(defenseTimer);defenseTimer=null}
function playerName(id){return players?.[id]?.name||"ผู้เล่น"}

function renderPlayers(){
  const arr=Object.entries(players||{}).sort((a,b)=>(a[1].joinedAt||0)-(b[1].joinedAt||0));
  $("playerList").innerHTML=arr.map(([id,p])=>{const alive=p.alive!==false;const reason=p.eliminatedBy==="vote"?" • ถูกโหวตออก":p.eliminatedBy==="werewolf"?" • โดนหมาป่ากำจัด":(!alive?" • ถูกกำจัด":"");return `<div class="player"><span class="dot ${!alive?"dead":p.connected===false?"off":""}"></span>${esc(p.name||"Player")}${id===uid?" (คุณ)":""}${alive?"":esc(reason)}${alive?"":" • 🔒 ไม่เปิด Role"}</div>`}).join("");
  const me=players?.[uid],dead=me&&me.alive===false;
  $("deadBanner").classList.toggle("hidden",!dead);
  if(dead)$("deadBanner").textContent=`☠️ ${me.eliminatedBy==="vote"?"คุณถูกโหวตออก":me.eliminatedBy==="werewolf"?"คุณโดนหมาป่ากำจัด":"คุณถูกกำจัด"} — Role ของคุณจะไม่ถูกเปิดเผย`;
}
function renderRole(){
  const role=privateState?.role;if(!role)return;
  $("roleName").textContent=displayRole(role);$("roleEnglish").textContent=role.th&&role.th!==role.name?role.name:(role.cat||"");$("roleAbility").textContent=role.ability||role.action||"ทำความสามารถตามกติกา";
  const mates=privateState?.teammates||[];$("teamText").classList.toggle("hidden",!mates.length);if(mates.length)$("teamText").textContent=`เพื่อนที่คุณรู้จัก: ${mates.map(x=>x.name).join(", ")}`;
}
function ballotHtml(ballots,type="first"){
  const rows=Object.entries(ballots||{}).sort((a,b)=>playerName(a[0]).localeCompare(playerName(b[0]),"th"));
  if(!rows.length)return `<div class="vote-note">ไม่มีข้อมูลคะแนน</div>`;
  return `<div class="ballot-title">เปิดเผยหลัง Host ปิดรอบ</div>${rows.map(([voterId,b])=>{
    const answer=type==="confirm"?(b.choice==="eliminate"?"🔴 เอาออก":"🟢 ไม่เอาออก"):`→ ${esc(playerName(b.target))}`;
    return `<div class="ballot-row"><span>${esc(playerName(voterId))}</span><b>${answer}</b></div>`;
  }).join("")}`;
}
async function syncFirstVoteLock(voteId){
  if(!voteId||!db||!uid)return;
  try{const snap=await get(ref(db,roomPath(`votes/${voteId}/${uid}`)));if(snap.exists()){firstVoteSubmittedFor=voteId;selectedVote=snap.val()?.target||"";renderVote()}}catch{}
}
async function syncConfirmLock(confirmId){
  if(!confirmId||!db||!uid)return;
  try{const snap=await get(ref(db,roomPath(`confirmVotes/${confirmId}/${uid}`)));if(snap.exists()){confirmSubmittedFor=confirmId;confirmChoice=snap.val()?.choice||"";renderConfirmVote()}}catch{}
}
function renderVote(){
  const phase=publicState?.phase||{};if(phase.state!=="vote")return;
  const locked=firstVoteSubmittedFor===phase.voteId;
  const alive=Object.entries(players||{}).filter(([,p])=>p.alive!==false);
  $("voteList").innerHTML=alive.map(([id,p])=>`<button class="target ${selectedVote===id?"selected":""}" data-vote="${id}" ${locked?"disabled":""}>${esc(p.name||"Player")}${id===uid?" (คุณ)":""}</button>`).join("");
  if(!locked)$("voteList").querySelectorAll("[data-vote]").forEach(b=>b.addEventListener("click",()=>{selectedVote=b.dataset.vote;renderVote();$("submitVoteBtn").disabled=false}));
  $("submitVoteBtn").classList.toggle("hidden",locked);$("voteSent").classList.toggle("hidden",!locked);$("submitVoteBtn").disabled=locked||!selectedVote;
}
function renderDefense(){
  const phase=publicState?.phase||{};if(phase.state!=="defense")return;
  const candidateUid=phase.candidateUid||"",candidateName=playerName(candidateUid);
  $("defenseName").textContent=candidateName;
  $("defensePlayerMessage").textContent=candidateUid===uid?"คุณได้คะแนนสูงสุด ใช้เวลานี้พูดแก้ตัว ก่อนทุกคนจะโหวตยืนยันอีกครั้ง":`กำลังฟังคำแก้ตัวของ ${candidateName}`;
  $("firstVoteRevealPlayer").innerHTML=ballotHtml(phase.firstBallots||{},"first");
  stopDefenseTimer();
  const tick=()=>{const remaining=Math.max(0,Math.ceil(((Number(phase.defenseEndsAt)||Date.now())-Date.now())/1000));$("defensePlayerClock").textContent=remaining;$("defenseAfterText").textContent=remaining>0?"ครบเวลาแล้ว รอ Host เปิดโหวตรอบยืนยัน":"หมดเวลาแก้ตัวแล้ว • รอ Host เปิดโหวตรอบยืนยัน"};
  tick();defenseTimer=setInterval(tick,250);
}
function renderConfirmVote(){
  const phase=publicState?.phase||{};if(phase.state!=="confirm_vote")return;
  if(lastConfirmId!==phase.confirmId){lastConfirmId=phase.confirmId;confirmChoice="";if(confirmSubmittedFor!==phase.confirmId)confirmSubmittedFor=""}
  const locked=confirmSubmittedFor===phase.confirmId,candidate=playerName(phase.candidateUid);
  $("confirmVoteQuestion").textContent=`หลังฟังคำแก้ตัวแล้ว จะยืนยันให้ ${candidate} ออกจากเกมหรือไม่?`;
  $("chooseEliminateBtn").classList.toggle("selected",confirmChoice==="eliminate");$("choosePardonBtn").classList.toggle("selected",confirmChoice==="pardon");
  $("chooseEliminateBtn").disabled=locked;$("choosePardonBtn").disabled=locked;$("submitConfirmVoteBtn").classList.toggle("hidden",locked);$("confirmVoteSent").classList.toggle("hidden",!locked);$("submitConfirmVoteBtn").disabled=locked||!confirmChoice;
}
function renderVoteResult(){
  const phase=publicState?.phase||{};
  if(phase.state==="vote_result"){
    $("voteResultTitle").textContent="คะแนนรอบแรกเสมอ";$("voteResultSummary").textContent="ไม่มีใครเข้าสู่ช่วงแก้ตัว และไม่มีใครถูกกำจัด";$("voteResultBallots").innerHTML=ballotHtml(phase.firstBallots||{},"first");return;
  }
  if(phase.state!=="confirm_result")return;
  const candidate=playerName(phase.candidateUid),eliminated=Boolean(phase.eliminated),e=Number(phase.eliminateCount)||0,p=Number(phase.pardonCount)||0;
  $("voteResultTitle").textContent=eliminated?`${candidate} ถูกโหวตออก`:`${candidate} รอด`;
  $("voteResultSummary").textContent=`เอาออก ${e} • ไม่เอาออก ${p}${e===p?" • คะแนนเสมอ = ไม่เอาออก":""}`;
  $("voteResultBallots").innerHTML=ballotHtml(phase.confirmBallots||{},"confirm");
}
function renderTurn(turn){
  if(lastPhaseId!==turn.phaseId){selected.clear();lastPhaseId=turn.phaseId;$("sentMessage").classList.add("hidden");$("submitActionBtn").classList.remove("hidden");$("skipActionBtn").classList.toggle("hidden",!turn?.behavior?.optional)}
  $("turnRole").textContent=displayRole(turn.role);$("turnAction").textContent=turn.action||turn.ability||"ทำความสามารถของคุณ";
  const behavior=turn.behavior||{targetCount:1,allowSelf:false,optional:false},targetCount=Number(behavior.targetCount)||0;
  if(targetCount===0){$("targetSection").classList.add("hidden");$("submitActionBtn").textContent="เสร็จแล้ว";$("submitActionBtn").disabled=false;return}
  $("targetSection").classList.remove("hidden");$("targetTitle").textContent=targetCount===2?"เลือกผู้เล่น 2 คน":"เลือกผู้เล่น 1 คน";
  const list=Object.entries(players||{}).filter(([id,p])=>p.alive!==false&&(behavior.allowSelf||id!==uid));
  $("targetList").innerHTML=list.map(([id,p])=>`<button class="target ${selected.has(id)?"selected":""}" data-target="${id}">${esc(p.name||"Player")}${id===uid?" (คุณ)":""}</button>`).join("");
  $("targetList").querySelectorAll("[data-target]").forEach(btn=>btn.addEventListener("click",()=>{const id=btn.dataset.target;if(selected.has(id))selected.delete(id);else{if(selected.size>=targetCount)selected.delete([...selected][0]);selected.add(id)}renderTurn(turn)}));$("submitActionBtn").disabled=selected.size!==targetCount;
}
function renderState(){
  renderPlayers();renderRole();
  const role=privateState?.role,turn=privateState?.turn,me=players?.[uid],dead=me&&me.alive===false,phase=publicState?.phase||{};
  if(!role){showOnly(lobbyView);$("lobbyText").textContent="เข้าห้องแล้ว • รอ Host แจก Role";return}
  if(phase.state==="confirm_result"||phase.state==="vote_result"){stopDefenseTimer();showOnly(voteResultView);renderVoteResult();return}
  if(dead){stopDefenseTimer();showOnly(phaseView);$("phaseTitle").textContent="คุณถูกกำจัดแล้ว";$("phaseSub").textContent="Role จะไม่ถูกเปิดเผย";return}
  if(phase.state==="defense"){showOnly(defenseView);renderDefense();return}
  stopDefenseTimer();
  if(phase.state==="confirm_vote"){showOnly(confirmVoteView);renderConfirmVote();return}
  if(phase.state==="vote"){showOnly(voteView);renderVote();return}
  if(!turn||turn.state==="lobby"){showOnly(roleView);return}
  if(turn.active){renderTurn(turn);showOnly(turnView);return}
  showOnly(phaseView);
  if(phase.state==="day"||turn.state==="day"){$("phaseTitle").textContent="ทุกคนลืมตา";$("phaseSub").textContent=`เข้าสู่ช่วงกลางวัน • Night ${phase.night||turn.night||1} จบแล้ว`}else{$("phaseTitle").textContent="หลับตา";$("phaseSub").textContent=`Night ${phase.night||turn.night||1} • รอเสียงเรียก Role ของคุณ`}
}
async function submitAction(skipped=false){const turn=privateState?.turn;if(!turn?.phaseId)return;const selectedIds=skipped?[]:[...selected];await set(ref(db,roomPath(`actions/${turn.night}/${turn.phaseId}/${uid}`)),{selected:selectedIds,skipped,submittedAt:Date.now()});$("sentMessage").classList.remove("hidden");$("submitActionBtn").classList.add("hidden");$("skipActionBtn").classList.add("hidden")}
async function submitVote(){
  const phase=publicState?.phase;if(phase?.state!=="vote"||!phase.voteId||!selectedVote||firstVoteSubmittedFor===phase.voteId)return;
  try{await update(ref(db,roomPath()),{[`votes/${phase.voteId}/${uid}`]:{target:selectedVote,submittedAt:Date.now()},[`voteReceipts/${phase.voteId}/${uid}`]:true});firstVoteSubmittedFor=phase.voteId;renderVote()}catch(err){console.error(err);alert("ส่งคะแนนไม่สำเร็จ หรือคะแนนรอบนี้ถูกล็อกไปแล้ว")}
}
async function submitConfirmVote(){
  const phase=publicState?.phase;if(phase?.state!=="confirm_vote"||!phase.confirmId||!confirmChoice||confirmSubmittedFor===phase.confirmId)return;
  try{await update(ref(db,roomPath()),{[`confirmVotes/${phase.confirmId}/${uid}`]:{choice:confirmChoice,submittedAt:Date.now()},[`confirmReceipts/${phase.confirmId}/${uid}`]:true});confirmSubmittedFor=phase.confirmId;renderConfirmVote()}catch(err){console.error(err);alert("ส่งคำตอบไม่สำเร็จ หรือคำตอบรอบนี้ถูกล็อกไปแล้ว")}
}
async function joinRoom(){
  if(!db||!uid)return alert("ยังไม่ได้เชื่อม Firebase");const code=$("roomInput").value.trim().toUpperCase(),name=$("nameInput").value.trim();if(code.length!==5)return alert("Room Code ต้องมี 5 ตัว");if(!name)return alert("กรุณาใส่ชื่อผู้เล่น");
  const hostSnap=await get(ref(db,`rooms/${code}/hostUid`));if(!hostSnap.exists())return alert("ไม่พบห้องนี้");room=code;myName=name;await update(ref(db,roomPath(`players/${uid}`)),{name,connected:true,joinedAt:Date.now()});try{await onDisconnect(ref(db,roomPath(`players/${uid}/connected`))).set(false)}catch{}
  localStorage.setItem("ww_player_room",room);localStorage.setItem("ww_player_name",myName);$("roomText").textContent=room;$("meText").textContent=myName;joinView.classList.add("hidden");gameView.classList.remove("hidden");attachListeners();
}
function attachListeners(){
  onValue(ref(db,roomPath("public")),s=>{const prev=publicState?.phase||{};publicState=s.val()||{};const phase=publicState?.phase||{};if(phase.state==="vote"&&phase.voteId!==prev.voteId){selectedVote="";firstVoteSubmittedFor="";syncFirstVoteLock(phase.voteId)}if(phase.state==="confirm_vote"&&phase.confirmId!==prev.confirmId){confirmChoice="";confirmSubmittedFor="";syncConfirmLock(phase.confirmId)}renderState()});
  onValue(ref(db,roomPath("players")),s=>{players=s.val()||{};renderState()});onValue(ref(db,roomPath(`private/${uid}`)),s=>{privateState=s.val()||{};renderState()});
}
$("joinBtn").addEventListener("click",joinRoom);$("revealBtn").addEventListener("click",()=>{$("hiddenRoleCard").classList.add("hidden");$("revealedRoleCard").classList.remove("hidden")});$("hideRoleBtn").addEventListener("click",()=>{$("revealedRoleCard").classList.add("hidden");$("hiddenRoleCard").classList.remove("hidden")});$("submitActionBtn").addEventListener("click",()=>submitAction(false));$("skipActionBtn").addEventListener("click",()=>submitAction(true));$("submitVoteBtn").addEventListener("click",submitVote);$("chooseEliminateBtn").addEventListener("click",()=>{if(confirmSubmittedFor===(publicState?.phase?.confirmId||""))return;confirmChoice="eliminate";renderConfirmVote()});$("choosePardonBtn").addEventListener("click",()=>{if(confirmSubmittedFor===(publicState?.phase?.confirmId||""))return;confirmChoice="pardon";renderConfirmVote()});$("submitConfirmVoteBtn").addEventListener("click",submitConfirmVote);

(async function boot(){const qp=new URLSearchParams(location.search);$("roomInput").value=(qp.get("room")||localStorage.getItem("ww_player_room")||"").toUpperCase();$("nameInput").value=localStorage.getItem("ww_player_name")||"";if(qp.get("host")==="1")$("hostNote").classList.remove("hidden");if(!isFirebaseConfigured()){$("connectionStatus").textContent="ต้องตั้งค่า Firebase";$("joinBtn").disabled=true;return}try{const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getDatabase(app);const cred=await signInAnonymously(auth);uid=cred.user.uid;$("connectionStatus").textContent="ออนไลน์"}catch(err){console.error(err);$("connectionStatus").textContent="เชื่อมไม่สำเร็จ"}})();