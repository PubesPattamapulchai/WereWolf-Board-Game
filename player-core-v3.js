import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getDatabase, ref, set, get, update, onValue, onDisconnect, push } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

const $=(id)=>document.getElementById(id);
let db=null,auth=null,uid="",room="",myName="",players={},privateState={},publicState={};
let selected=new Set(),selectedVote="",lastPhaseId="",defenseTimer=null;
let firstVoteSubmittedFor="",confirmChoice="",confirmSubmittedFor="",lastConfirmId="";
let teamSignals={},teamMessages={},activeTeamKey="",stopTeamSignals=null,stopTeamChat=null;
const joinView=$("joinView"),gameView=$("gameView"),lobbyView=$("lobbyView"),roleView=$("roleView"),phaseView=$("phaseView"),turnView=$("turnView"),voteView=$("voteView"),defenseView=$("defenseView"),confirmVoteView=$("confirmVoteView"),voteResultView=$("voteResultView");

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]))}
function roomPath(path=""){return `rooms/${room}${path?"/"+path:""}`}
function showOnly(view){[lobbyView,roleView,phaseView,turnView,voteView,defenseView,confirmVoteView,voteResultView].forEach(v=>v.classList.add("hidden"));view?.classList.remove("hidden")}
function displayRole(role){return role?.th&&role.th!==role.name?role.th:(role?.name||"")}
function stopDefenseTimer(){if(defenseTimer)clearInterval(defenseTimer);defenseTimer=null}
function playerName(id){return players?.[id]?.name||"ผู้เล่น"}

function teamChannelForRole(role){
  if(role?.cat==="Werewolves") return "werewolves";
  return "";
}
function teamLabel(channel){return channel==="werewolves"?"ฝูงหมาป่า":"ทีมลับ"}
function getActiveTeamContext(){
  const role=privateState?.role,turn=privateState?.turn,phase=publicState?.phase||{};
  const channel=teamChannelForRole(role);
  if(!channel||!turn?.active||!turn?.phaseId||phase.state!=="night"||phase.phaseId!==turn.phaseId)return null;
  return {channel,night:Number(turn.night||phase.night||1),phaseId:turn.phaseId,turn};
}
function installTeamCommsUI(){
  if($("teamComms")||!turnView)return;
  const style=document.createElement("style");
  style.textContent=`
    .team-comms{margin-top:16px;padding:13px;border:1px solid #54313a;border-radius:17px;background:linear-gradient(145deg,#21141a,#10151f);text-align:left}
    .team-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.team-title{font-size:13px;font-weight:950;color:#ffd0d6}.team-sub{font-size:10px;color:#9da8b8;line-height:1.45;margin-top:3px}
    .team-live{display:inline-flex;align-items:center;gap:6px;padding:5px 8px;border-radius:999px;border:1px solid #5c313a;background:#2b171d;color:#ffc7ce;font-size:9px;font-weight:950}.team-dot{width:6px;height:6px;border-radius:50%;background:#ef4454}
    .team-consensus{margin-top:10px;display:grid;gap:6px}.team-consensus-row{display:flex;justify-content:space-between;gap:10px;padding:8px 9px;border-radius:11px;background:#141a25;border:1px solid #293347;font-size:11px}.team-consensus-row.top{border-color:#71404a;background:#28171d}.team-consensus-row b{color:#ffd3d8}
    .team-empty{padding:9px 10px;border-radius:11px;background:#111722;color:#8f9bad;font-size:11px;line-height:1.45}.team-quick{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.team-quick button{min-height:32px;border:1px solid #344057;background:#171e2a;color:#d7dfeb;border-radius:999px;padding:5px 9px;font-size:10px;font-weight:850}
    .team-chat-details{margin-top:9px;border-top:1px solid #2a3243;padding-top:8px}.team-chat-details summary{cursor:pointer;color:#aab5c5;font-size:10px;font-weight:900}.team-messages{display:grid;gap:5px;max-height:118px;overflow:auto;margin-top:8px}.team-msg{padding:7px 8px;border-radius:10px;background:#121925;font-size:10px;line-height:1.4}.team-msg b{color:#f0c0c7;margin-right:5px}.team-chat-form{display:grid;grid-template-columns:1fr auto;gap:6px;margin-top:7px}.team-chat-input{min-height:38px;border:1px solid #344057;background:#0c1119;color:white;border-radius:11px;padding:7px 9px;font-size:11px}.team-send{min-height:38px;border:0;border-radius:11px;background:#8e3040;color:white;padding:7px 10px;font-size:10px;font-weight:900}
    .pack-count{display:inline-flex;align-items:center;gap:3px;margin-left:5px;padding:2px 5px;border-radius:999px;background:#3a1c23;color:#ffc9cf;font-size:9px;font-weight:950}.target{display:flex;align-items:center;justify-content:space-between;gap:7px}
  `;
  document.head.appendChild(style);
  const box=document.createElement("section");
  box.id="teamComms";box.className="team-comms hidden";
  box.innerHTML=`
    <div class="team-head"><div><div id="teamCommsTitle" class="team-title">🐺 Pack Link</div><div class="team-sub">ไม่ต้องพิมพ์ก็ได้ — การแตะเป้าหมายด้านบนจะรวมคะแนนแบบเงียบให้ฝูงเห็นทันที</div></div><div class="team-live"><span class="team-dot"></span>NIGHT ONLY</div></div>
    <div id="teamConsensus" class="team-consensus"></div>
    <div class="team-quick">
      <button type="button" data-team-quick="👍 เห็นด้วย">👍 เห็นด้วย</button>
      <button type="button" data-team-quick="🔄 ขอเปลี่ยนเป้า">🔄 เปลี่ยนเป้า</button>
      <button type="button" data-team-quick="⚠️ ระวังเป้านี้">⚠️ ระวัง</button>
      <button type="button" data-team-quick="🎯 ล็อกเป้านี้">🎯 ล็อกเป้า</button>
    </div>
    <details class="team-chat-details"><summary>💬 ข้อความลับ (ตัวเลือกเสริม — แนะนำ Quick Signal เวลาเล่นต่อหน้ากัน)</summary><div id="teamMessages" class="team-messages"></div><div class="team-chat-form"><input id="teamChatInput" class="team-chat-input" maxlength="80" placeholder="ข้อความสั้น ๆ ถึงฝูง"><button id="teamChatSend" class="team-send" type="button">ส่ง</button></div></details>
  `;
  turnView.querySelector(".submit-row")?.insertAdjacentElement("beforebegin",box);
  box.querySelectorAll("[data-team-quick]").forEach(btn=>btn.addEventListener("click",()=>sendTeamMessage(btn.dataset.teamQuick)));
  $("teamChatSend")?.addEventListener("click",()=>{const input=$("teamChatInput");const text=input.value.trim();if(text){sendTeamMessage(text);input.value=""}});
  $("teamChatInput")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();$("teamChatSend")?.click()}});
}
function detachTeamListeners(){
  stopTeamSignals?.();stopTeamChat?.();stopTeamSignals=null;stopTeamChat=null;activeTeamKey="";teamSignals={};teamMessages={};
  $("teamComms")?.classList.add("hidden");
}
function ensureTeamListeners(){
  const ctx=getActiveTeamContext();
  if(!ctx){detachTeamListeners();return null}
  const key=`${ctx.night}|${ctx.phaseId}|${ctx.channel}`;
  $("teamComms")?.classList.remove("hidden");
  $("teamCommsTitle").textContent=ctx.channel==="werewolves"?"🐺 Pack Link — ฝูงหมาป่า":`🔒 ${teamLabel(ctx.channel)}`;
  if(activeTeamKey===key){renderTeamConsensus();return ctx}
  stopTeamSignals?.();stopTeamChat?.();teamSignals={};teamMessages={};activeTeamKey=key;
  stopTeamSignals=onValue(ref(db,roomPath(`teamSignals/${ctx.night}/${ctx.phaseId}/${ctx.channel}`)),snap=>{teamSignals=snap.val()||{};renderTeamConsensus();renderTurn(ctx.turn)});
  stopTeamChat=onValue(ref(db,roomPath(`teamChat/${ctx.night}/${ctx.phaseId}/${ctx.channel}`)),snap=>{teamMessages=snap.val()||{};renderTeamMessages()});
  renderTeamConsensus();renderTeamMessages();
  return ctx;
}
function teamTargetCounts(){
  const counts={};Object.values(teamSignals||{}).forEach(s=>{if(s?.target)counts[s.target]=(counts[s.target]||0)+1});return counts;
}
function renderTeamConsensus(){
  const el=$("teamConsensus");if(!el)return;
  const counts=teamTargetCounts(),rows=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  if(!rows.length){el.innerHTML=`<div class="team-empty">🐺 ยังไม่มีสัญญาณเป้าหมาย • แต่ละคนแตะชื่อเป้าหมายด้านบนได้เลย ไม่ต้องพิมพ์</div>`;return}
  const top=rows[0][1];
  el.innerHTML=rows.map(([targetId,n])=>`<div class="team-consensus-row ${n===top?"top":""}"><span>${esc(playerName(targetId))}</span><b>${n} เสียง</b></div>`).join("");
}
function renderTeamMessages(){
  const el=$("teamMessages");if(!el)return;
  const rows=Object.values(teamMessages||{}).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0)).slice(-8);
  el.innerHTML=rows.length?rows.map(m=>`<div class="team-msg"><b>${esc(playerName(m.senderUid))}</b>${esc(m.text||"")}</div>`).join(""):`<div class="team-empty">ยังไม่มีข้อความ • ใช้ Quick Signal จะเนียนกว่าเวลาเล่นต่อหน้ากัน</div>`;
  el.scrollTop=el.scrollHeight;
}
async function sendTeamMessage(text){
  const ctx=getActiveTeamContext();if(!ctx||!db)return;
  const clean=String(text||"").trim().slice(0,80);if(!clean)return;
  try{const msgRef=push(ref(db,roomPath(`teamChat/${ctx.night}/${ctx.phaseId}/${ctx.channel}`)));await set(msgRef,{senderUid:uid,text:clean,createdAt:Date.now()})}catch(err){console.error(err)}
}
async function syncTeamSignal(turn){
  const ctx=getActiveTeamContext();if(!ctx||!turn||Number(turn?.behavior?.targetCount||0)!==1||selected.size!==1)return;
  const target=[...selected][0];
  try{await set(ref(db,roomPath(`teamSignals/${ctx.night}/${ctx.phaseId}/${ctx.channel}/${uid}`)),{target,updatedAt:Date.now()})}catch(err){console.error(err)}
}

installTeamCommsUI();

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
  return `<div class="ballot-title">เปิดเผยหลัง Host ปิดรอบ</div>${rows.map(([voterId,b])=>{const answer=type==="confirm"?(b.choice==="eliminate"?"🔴 เอาออก":"🟢 ไม่เอาออก"):`→ ${esc(playerName(b.target))}`;return `<div class="ballot-row"><span>${esc(playerName(voterId))}</span><b>${answer}</b></div>`}).join("")}`;
}
async function syncFirstVoteLock(voteId){if(!voteId||!db||!uid)return;try{const snap=await get(ref(db,roomPath(`votes/${voteId}/${uid}`)));if(snap.exists()){firstVoteSubmittedFor=voteId;selectedVote=snap.val()?.target||"";renderVote()}}catch{}}
async function syncConfirmLock(confirmId){if(!confirmId||!db||!uid)return;try{const snap=await get(ref(db,roomPath(`confirmVotes/${confirmId}/${uid}`)));if(snap.exists()){confirmSubmittedFor=confirmId;confirmChoice=snap.val()?.choice||"";renderConfirmVote()}}catch{}}
function renderVote(){
  const phase=publicState?.phase||{};if(phase.state!=="vote")return;
  const locked=firstVoteSubmittedFor===phase.voteId,alive=Object.entries(players||{}).filter(([,p])=>p.alive!==false);
  $("voteList").innerHTML=alive.map(([id,p])=>`<button class="target ${selectedVote===id?"selected":""}" data-vote="${id}" ${locked?"disabled":""}>${esc(p.name||"Player")}${id===uid?" (คุณ)":""}</button>`).join("");
  if(!locked)$("voteList").querySelectorAll("[data-vote]").forEach(b=>b.addEventListener("click",()=>{selectedVote=b.dataset.vote;renderVote();$("submitVoteBtn").disabled=false}));
  $("submitVoteBtn").classList.toggle("hidden",locked);$("voteSent").classList.toggle("hidden",!locked);$("submitVoteBtn").disabled=locked||!selectedVote;
}
function renderDefense(){
  const phase=publicState?.phase||{};if(phase.state!=="defense")return;
  const candidateUid=phase.candidateUid||"",candidateName=playerName(candidateUid);
  $("defenseName").textContent=candidateName;$("defensePlayerMessage").textContent=candidateUid===uid?"คุณได้คะแนนสูงสุด ใช้เวลานี้พูดแก้ตัว ก่อนทุกคนจะโหวตยืนยันอีกครั้ง":`กำลังฟังคำแก้ตัวของ ${candidateName}`;$("firstVoteRevealPlayer").innerHTML=ballotHtml(phase.firstBallots||{},"first");
  stopDefenseTimer();const tick=()=>{const remaining=Math.max(0,Math.ceil(((Number(phase.defenseEndsAt)||Date.now())-Date.now())/1000));$("defensePlayerClock").textContent=remaining;$("defenseAfterText").textContent=remaining>0?"ครบเวลาแล้ว รอ Host เปิดโหวตรอบยืนยัน":"หมดเวลาแก้ตัวแล้ว • รอ Host เปิดโหวตรอบยืนยัน"};tick();defenseTimer=setInterval(tick,250);
}
function renderConfirmVote(){
  const phase=publicState?.phase||{};if(phase.state!=="confirm_vote")return;
  if(lastConfirmId!==phase.confirmId){lastConfirmId=phase.confirmId;confirmChoice="";if(confirmSubmittedFor!==phase.confirmId)confirmSubmittedFor=""}
  const locked=confirmSubmittedFor===phase.confirmId,candidate=playerName(phase.candidateUid);
  $("confirmVoteQuestion").textContent=`หลังฟังคำแก้ตัวแล้ว จะยืนยันให้ ${candidate} ออกจากเกมหรือไม่?`;
  $("chooseEliminateBtn").classList.toggle("selected",confirmChoice==="eliminate");$("choosePardonBtn").classList.toggle("selected",confirmChoice==="pardon");$("chooseEliminateBtn").disabled=locked;$("choosePardonBtn").disabled=locked;$("submitConfirmVoteBtn").classList.toggle("hidden",locked);$("confirmVoteSent").classList.toggle("hidden",!locked);$("submitConfirmVoteBtn").disabled=locked||!confirmChoice;
}
function renderVoteResult(){
  const phase=publicState?.phase||{};
  if(phase.state==="vote_result"){$("voteResultTitle").textContent="คะแนนรอบแรกเสมอ";$("voteResultSummary").textContent="ไม่มีใครเข้าสู่ช่วงแก้ตัว และไม่มีใครถูกกำจัด";$("voteResultBallots").innerHTML=ballotHtml(phase.firstBallots||{},"first");return}
  if(phase.state!=="confirm_result")return;
  const candidate=playerName(phase.candidateUid),eliminated=Boolean(phase.eliminated),e=Number(phase.eliminateCount)||0,p=Number(phase.pardonCount)||0;
  $("voteResultTitle").textContent=eliminated?`${candidate} ถูกโหวตออก`:`${candidate} รอด`;$("voteResultSummary").textContent=`เอาออก ${e} • ไม่เอาออก ${p}${e===p?" • คะแนนเสมอ = ไม่เอาออก":""}`;$("voteResultBallots").innerHTML=ballotHtml(phase.confirmBallots||{},"confirm");
}
function renderTurn(turn){
  if(lastPhaseId!==turn.phaseId){selected.clear();lastPhaseId=turn.phaseId;$("sentMessage").classList.add("hidden");$("submitActionBtn").classList.remove("hidden");$("skipActionBtn").classList.toggle("hidden",!turn?.behavior?.optional)}
  $("turnRole").textContent=displayRole(turn.role);$("turnAction").textContent=turn.action||turn.ability||"ทำความสามารถของคุณ";
  const behavior=turn.behavior||{targetCount:1,allowSelf:false,optional:false},targetCount=Number(behavior.targetCount)||0;
  const teamCtx=ensureTeamListeners();
  if(targetCount===0){$("targetSection").classList.add("hidden");$("submitActionBtn").textContent="เสร็จแล้ว";$("submitActionBtn").disabled=false;return}
  $("targetSection").classList.remove("hidden");$("targetTitle").textContent=targetCount===2?"เลือกผู้เล่น 2 คน":"เลือกผู้เล่น 1 คน";
  const teammateIds=new Set((privateState?.teammates||[]).map(x=>x.uid));
  const counts=teamTargetCounts();
  const list=Object.entries(players||{}).filter(([id,p])=>p.alive!==false&&(behavior.allowSelf||id!==uid)&&!(teamCtx?.channel==="werewolves"&&teammateIds.has(id)));
  $("targetList").innerHTML=list.map(([id,p])=>`<button class="target ${selected.has(id)?"selected":""}" data-target="${id}"><span>${esc(p.name||"Player")}${id===uid?" (คุณ)":""}</span>${teamCtx&&counts[id]?`<span class="pack-count">🐺 ${counts[id]}</span>`:""}</button>`).join("");
  $("targetList").querySelectorAll("[data-target]").forEach(btn=>btn.addEventListener("click",()=>{const id=btn.dataset.target;if(targetCount===1){selected.clear();selected.add(id)}else if(selected.has(id))selected.delete(id);else{if(selected.size>=targetCount)selected.delete([...selected][0]);selected.add(id)}syncTeamSignal(turn);renderTurn(turn)}));
  $("submitActionBtn").textContent="ยืนยัน";$("submitActionBtn").disabled=selected.size!==targetCount;
}
function renderState(){
  renderPlayers();renderRole();
  const role=privateState?.role,turn=privateState?.turn,me=players?.[uid],dead=me&&me.alive===false,phase=publicState?.phase||{};
  if(!turn?.active)detachTeamListeners();
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