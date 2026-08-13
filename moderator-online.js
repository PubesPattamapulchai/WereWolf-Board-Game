import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getDatabase, ref, set, get, update, onValue } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";
import { behaviorFor, roleKey, safeRole } from "./game-rules.js";

const $ = (id) => document.getElementById(id);
const DEFENSE_SECONDS = 60;

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
    .vote-control,.defense-control,.confirm-control,.result-control{margin-top:10px;padding:10px;border-radius:14px;border:1px solid #3a445a;background:#0e141e}
    .vote-control-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:7px}
    .vote-control-title{font-size:12px;font-weight:900}
    .vote-control-sub{font-size:10px;color:#8f9bad;line-height:1.45}
    .vote-results{display:grid;gap:5px;margin-top:7px}
    .vote-result-row{display:flex;justify-content:space-between;gap:10px;font-size:11px;padding:7px 8px;border-radius:9px;background:#151c28}
    .vote-result-row b{color:#f0d69a;text-align:right}
    .ballot-reveal{margin-top:10px;padding-top:9px;border-top:1px solid #2d3749}
    .ballot-reveal-title{font-size:10px;color:#91a0b4;font-weight:900;margin-bottom:6px}
    .defense-control{border-color:#5d4827;background:linear-gradient(135deg,#241d12,#10151f)}
    .defense-title{font-size:12px;font-weight:950;color:#f5d28f}
    .defense-candidate{font-size:20px;font-weight:950;margin-top:6px}
    .defense-clock{font-size:40px;line-height:1;font-weight:950;font-variant-numeric:tabular-nums;color:#fff;margin:10px 0 5px}
    .defense-actions{display:grid;grid-template-columns:1fr;gap:7px;margin-top:10px}
    .defense-note{font-size:10px;color:#aeb8c7;line-height:1.45}
    .confirm-control{border-color:#493753;background:linear-gradient(135deg,#211724,#10151f)}
    .confirm-candidate{font-size:18px;font-weight:950;margin:5px 0}
    .result-control{border-color:#2e4d41;background:linear-gradient(135deg,#13231d,#10151f)}
    .result-title{font-size:17px;font-weight:950}
    .hidden-ballot-note{padding:8px 9px;border-radius:10px;background:#121925;color:#99a7ba;font-size:10px;line-height:1.45;margin-top:7px}
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
        <div class="panel-desc" style="margin-top:2px">Host ถูกนับเป็นผู้เล่น 1 คน และได้รับ Role แบบสุ่มเหมือนทุกคน</div>
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
      <button id="startVoteBtn" class="btn secondary" type="button">🗳 เริ่มโหวตรอบแรก</button>
    `;
    roomButtons.insertAdjacentElement("afterend",extra);

    const vote=document.createElement("div");
    vote.id="voteControl";
    vote.className="vote-control hidden";
    vote.innerHTML=`
      <div class="vote-control-head">
        <div>
          <div class="vote-control-title">🗳 โหวตรอบแรก • Hidden Ballot</div>
          <div id="voteProgressText" class="vote-control-sub">0 / 0 คนส่งแล้ว</div>
        </div>
        <button id="confirmVoteBtn" class="btn primary" type="button" style="min-height:36px;padding:6px 9px;font-size:11px">ปิดโหวตและเปิดผล</button>
      </div>
      <div class="hidden-ballot-note">ระหว่างโหวตจะไม่แสดงว่าใครเลือกใคร • เปิดเผยพร้อมกันเมื่อ Host ปิดรอบเท่านั้น</div>
      <div id="voteResults" class="vote-results"></div>
    `;
    extra.insertAdjacentElement("afterend",vote);

    const defense=document.createElement("div");
    defense.id="defenseControl";
    defense.className="defense-control hidden";
    defense.innerHTML=`
      <div class="defense-title">⚖️ ช่วงแก้ตัว</div>
      <div id="defenseCandidate" class="defense-candidate">—</div>
      <div><span id="defenseClock" class="defense-clock">60</span> <span class="vote-control-sub">วินาที</span></div>
      <div class="defense-note">ผลโหวตรอบแรกถูกเปิดเผยแล้ว • เมื่อหมดเวลา Host เปิดโหวตรอบยืนยันให้ทุกคนเลือก “เอาออก / ไม่เอาออก”</div>
      <div id="firstBallotReveal" class="ballot-reveal"></div>
      <div class="defense-actions">
        <button id="openConfirmVoteBtn" class="btn primary" type="button" disabled>เปิดโหวตรอบยืนยัน</button>
      </div>
    `;
    vote.insertAdjacentElement("afterend",defense);

    const confirmBox=document.createElement("div");
    confirmBox.id="confirmControl";
    confirmBox.className="confirm-control hidden";
    confirmBox.innerHTML=`
      <div class="vote-control-head">
        <div>
          <div class="vote-control-title">🔐 โหวตรอบยืนยัน • Hidden Ballot</div>
          <div id="confirmCandidate" class="confirm-candidate">—</div>
          <div id="confirmProgressText" class="vote-control-sub">0 / 0 คนส่งแล้ว</div>
        </div>
        <button id="closeConfirmVoteBtn" class="btn primary" type="button" style="min-height:36px;padding:6px 9px;font-size:11px">ปิดโหวตและเปิดผล</button>
      </div>
      <div class="hidden-ballot-note">ระหว่างรอบนี้จะเห็นเพียงจำนวนคนที่ส่งแล้ว • คำตอบ “เอาออก / ไม่เอาออก” จะเปิดพร้อมกันหลัง Host ปิดรอบ</div>
    `;
    defense.insertAdjacentElement("afterend",confirmBox);

    const result=document.createElement("div");
    result.id="resultControl";
    result.className="result-control hidden";
    result.innerHTML=`
      <div id="finalResultTitle" class="result-title">ผลโหวตยืนยัน</div>
      <div id="finalResultSummary" class="vote-control-sub" style="margin-top:4px"></div>
      <div id="confirmBallotReveal" class="ballot-reveal"></div>
      <button id="finishVoteRoundBtn" class="btn secondary" type="button" style="width:100%;margin-top:9px">กลับสู่ช่วงกลางวัน</button>
    `;
    confirmBox.insertAdjacentElement("afterend",result);
  }

  const desc=card.querySelector(".online-head .panel-desc");
  if(desc) desc.textContent="Host เล่นด้วยได้ • โหวตทั้งสองรอบเป็น Hidden Ballot และเปิดว่าใครเลือกอะไรหลัง Host ปิดรอบเท่านั้น";
}

installHostPlayerUI();

const statusEl=$("onlineStatus"),bodyEl=$("onlineRoomBody"),codeEl=$("roomCodeText"),playersEl=$("onlinePlayerList"),playerCountEl=$("onlinePlayerCount");
const createBtn=$("createRoomBtn"),assignBtn=$("assignRolesBtn"),copyBtn=$("copyJoinBtn"),actionPanel=$("onlineActionPanel"),actionList=$("onlineActionList"),actionProgress=$("onlineActionProgress");
const hostPlayToggle=$("hostPlayToggle"),hostPlayerName=$("hostPlayerName"),openHostPlayerBtn=$("openHostPlayerBtn"),startVoteBtn=$("startVoteBtn");
const voteControl=$("voteControl"),voteProgressText=$("voteProgressText"),voteResults=$("voteResults"),confirmVoteBtn=$("confirmVoteBtn");
const defenseControl=$("defenseControl"),defenseCandidate=$("defenseCandidate"),defenseClock=$("defenseClock"),firstBallotReveal=$("firstBallotReveal"),openConfirmVoteBtn=$("openConfirmVoteBtn");
const confirmControl=$("confirmControl"),confirmCandidate=$("confirmCandidate"),confirmProgressText=$("confirmProgressText"),closeConfirmVoteBtn=$("closeConfirmVoteBtn");
const resultControl=$("resultControl"),finalResultTitle=$("finalResultTitle"),finalResultSummary=$("finalResultSummary"),confirmBallotReveal=$("confirmBallotReveal"),finishVoteRoundBtn=$("finishVoteRoundBtn");

let db=null,auth=null,hostUid=null,roomCode="",players={},privateData={};
let currentPhaseId="",currentNight=1,currentExpected=[],stopActions=null;
let voteId="",voteReceiptCount=0,stopVoteReceipts=null;
let defenseCandidateUid="",defenseEndsAt=0,defenseTimer=null,defenseEndSpoken=false,firstBallots={};
let confirmId="",confirmReceiptCount=0,stopConfirmReceipts=null,confirmBallots={};

function setStatus(text,connected=false){statusEl.textContent=text;statusEl.classList.toggle("connected",connected)}
function roomPath(path=""){return `rooms/${roomCode}${path?"/"+path:""}`}
function randomCode(){const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";return Array.from({length:5},()=>chars[Math.floor(Math.random()*chars.length)]).join("")}
function shuffle(a){const arr=[...a];for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]))}
function playerName(uid){return players?.[uid]?.name||"ผู้เล่น"}
function displayRole(role){if(!role)return"ยังไม่ได้แจก";return role.th&&role.th!==role.name?`${role.th} (${role.name})`:role.name}
function hostIsPlayer(){return Boolean(hostUid&&players?.[hostUid])}
function aliveEntries(){return Object.entries(players||{}).filter(([,p])=>p.alive!==false)}
function say(text){try{if(!("speechSynthesis" in window))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="th-TH";u.rate=.92;u.pitch=.96;speechSynthesis.speak(u)}catch{}}
function hideVotePanels(){voteControl.classList.add("hidden");defenseControl.classList.add("hidden");confirmControl.classList.add("hidden");resultControl.classList.add("hidden")}

function renderPlayers(){
  const entries=Object.entries(players||{}).sort((a,b)=>(a[1].joinedAt||0)-(b[1].joinedAt||0));
  playerCountEl.textContent=entries.length;
  if(!entries.length){playersEl.innerHTML=`<div class="online-empty">รอผู้เล่นเข้าห้อง… เปิด player.html แล้วใส่ Room Code ${roomCode||""}</div>`;return}
  const hideRoles=hostIsPlayer();
  playersEl.innerHTML=entries.map(([uid,p])=>{
    const role=privateData?.[uid]?.role,alive=p.alive!==false;
    const reason=p.eliminatedBy==="vote"?"ถูกโหวตออก":p.eliminatedBy==="werewolf"?"โดนหมาป่ากำจัด":p.eliminatedBy?"ถูกกำจัด":"ออกจากเกม";
    const roleText=role?(hideRoles?"🔒 Role ถูกซ่อน":"🎭 "+escapeHtml(displayRole(role))):"ยังไม่ได้แจก Role";
    return `<div class="online-player"><div class="online-player-main"><div class="online-player-name"><span class="presence ${p.connected!==false?"on":""}"></span>${escapeHtml(p.name||"Player")}${uid===hostUid?" • HOST":""}</div><div class="online-player-sub">${roleText} • ${alive?"ยังอยู่ในเกม":escapeHtml(reason)} • 🔒 ไม่เปิด Role</div></div><div class="alive-actions">${alive?`<button class="alive-btn vote" data-eliminate="vote" data-uid="${uid}">โหวตออก</button><button class="alive-btn wolf" data-eliminate="werewolf" data-uid="${uid}">หมาป่าฆ่า</button>`:`<button class="alive-btn restore" data-restore-uid="${uid}">↩ คืนเกม</button>`}</div></div>`;
  }).join("");
  playersEl.querySelectorAll("[data-eliminate]").forEach(btn=>btn.addEventListener("click",()=>eliminatePlayer(btn.dataset.uid,btn.dataset.eliminate)));
  playersEl.querySelectorAll("[data-restore-uid]").forEach(btn=>btn.addEventListener("click",async()=>{const uid=btn.dataset.restoreUid;await update(ref(db,roomPath(`players/${uid}`)),{alive:true,eliminatedBy:null,eliminatedAt:null})}));
}
function attachRoom(){onValue(ref(db,roomPath("players")),snap=>{players=snap.val()||{};renderPlayers()});onValue(ref(db,roomPath("private")),snap=>{privateData=snap.val()||{};renderPlayers()})}

async function createRoom(){
  if(!db||!hostUid)return alert("ยังไม่ได้เชื่อม Firebase");
  setStatus("กำลังสร้างห้อง…");let code="";
  for(let i=0;i<8;i++){const candidate=randomCode();const snap=await get(ref(db,`rooms/${candidate}/hostUid`));if(!snap.exists()){code=candidate;break}}
  if(!code)return alert("สร้าง Room Code ไม่สำเร็จ ลองอีกครั้ง");
  roomCode=code;await set(ref(db,roomPath("hostUid")),hostUid);await set(ref(db,roomPath("public")),{status:"lobby",createdAt:Date.now(),phase:{state:"lobby",night:1}});
  if(hostPlayToggle?.checked){const name=(hostPlayerName?.value||"Host").trim()||"Host";await update(ref(db,roomPath(`players/${hostUid}`)),{name,alive:true,connected:true,joinedAt:Date.now(),assigned:false})}
  localStorage.setItem("ww_host_room",roomCode);attachRoom();bodyEl.classList.remove("hidden");codeEl.textContent=roomCode;setStatus("ห้องออนไลน์พร้อม",true);createBtn.textContent="สร้างห้องใหม่";
}
async function eliminatePlayer(uid,reason){
  const label=reason==="vote"?"ถูกโหวตออก":"โดนหมาป่ากำจัด";
  await update(ref(db,roomPath(`players/${uid}`)),{alive:false,eliminatedBy:reason,eliminatedAt:Date.now()});
  await update(ref(db,roomPath(`private/${uid}/turn`)),{active:false,state:"eliminated",eliminationReason:reason,eliminatedAt:Date.now()});
  alert(`${playerName(uid)} ${label}\n\nRole จะไม่ถูกเปิดเผย`);
}
async function assignRoles(){
  const bridge=window.WWModeratorBridge;if(!bridge)return;
  const rolePool=bridge.getRoles().filter(r=>r.name&&r.name!=="Moderator"&&r.name!=="The Moderator"),playerEntries=Object.entries(players||{});
  if(!playerEntries.length)return alert("ยังไม่มีผู้เล่นในห้อง");
  if(rolePool.length!==playerEntries.length)return alert(`จำนวน Role (${rolePool.length}) ต้องเท่ากับจำนวนผู้เล่น (${playerEntries.length}) ก่อนแจก\n\nHost ที่เลือก “เล่นด้วย” ถูกนับรวมเป็นผู้เล่น 1 คน`);
  const shuffledRoles=shuffle(rolePool),shuffledPlayers=shuffle(playerEntries),assignments={};
  shuffledPlayers.forEach(([uid,p],i)=>{const role={...safeRole(shuffledRoles[i]),ability:shuffledRoles[i].ability||shuffledRoles[i].action||""};assignments[uid]={player:p,role}});
  const updates={};
  for(const [uid,item] of Object.entries(assignments)){
    const teammates=Object.entries(assignments).filter(([otherId,o])=>otherId!==uid&&((item.role.cat==="Werewolves"&&o.role.cat==="Werewolves")||(item.role.name==="Mason"&&o.role.name==="Mason"))).map(([otherId,o])=>({uid:otherId,name:o.player.name}));
    updates[`private/${uid}`]={role:item.role,teammates,turn:{active:false,state:"lobby"}};updates[`players/${uid}/assigned`]=true;updates[`players/${uid}/alive`]=true;updates[`players/${uid}/eliminatedBy`]=null;updates[`players/${uid}/eliminatedAt`]=null;
  }
  updates["public/status"]="assigned";await update(ref(db,roomPath()),updates);
  alert(hostIsPlayer()?"แจก Role แล้ว • หน้าควบคุมจะซ่อน Role คนอื่น\nเปิด “หน้าผู้เล่นของฉัน” เพื่อดู Role ของคุณ":"สุ่มแจก Role ให้ผู้เล่นครบแล้ว");
}
async function copyJoinLink(){if(!roomCode)return;const url=new URL("player.html",location.href);url.searchParams.set("room",roomCode);try{await navigator.clipboard.writeText(url.toString());copyBtn.textContent="คัดลอกแล้ว ✓";setTimeout(()=>copyBtn.textContent="คัดลอกลิงก์",1300)}catch{prompt("คัดลอกลิงก์นี้",url.toString())}}
function openHostPlayer(){if(!roomCode)return alert("สร้างห้องก่อน");if(!hostIsPlayer())return alert("ห้องนี้ไม่ได้ตั้งให้ Host เล่นด้วย");const url=new URL("player.html",location.href);url.searchParams.set("room",roomCode);url.searchParams.set("host","1");window.open(url.toString(),"_blank","noopener")}

function listenVoteReceipts(id){
  stopVoteReceipts?.();voteReceiptCount=0;
  stopVoteReceipts=onValue(ref(db,roomPath(`voteReceipts/${id}`)),snap=>{voteReceiptCount=Object.keys(snap.val()||{}).length;voteProgressText.textContent=`${voteReceiptCount} / ${aliveEntries().length} คนส่งแล้ว`;voteResults.innerHTML=""});
}
function listenConfirmReceipts(id){
  stopConfirmReceipts?.();confirmReceiptCount=0;
  stopConfirmReceipts=onValue(ref(db,roomPath(`confirmReceipts/${id}`)),snap=>{confirmReceiptCount=Object.keys(snap.val()||{}).length;confirmProgressText.textContent=`${confirmReceiptCount} / ${aliveEntries().length} คนส่งแล้ว`});
}
function ballotRevealHtml(ballots,type="first"){
  const rows=Object.entries(ballots||{}).sort((a,b)=>playerName(a[0]).localeCompare(playerName(b[0]),"th"));
  if(!rows.length)return `<div class="vote-control-sub">ไม่มีข้อมูลคะแนน</div>`;
  return `<div class="ballot-reveal-title">เปิดเผยหลังปิดโหวต</div>${rows.map(([voterUid,b])=>{
    const answer=type==="confirm"?(b.choice==="eliminate"?"🔴 เอาออก":"🟢 ไม่เอาออก"):`→ ${escapeHtml(playerName(b.target))}`;
    return `<div class="vote-result-row"><span>${escapeHtml(playerName(voterUid))}</span><b>${answer}</b></div>`;
  }).join("")}`;
}
function stopDefenseClock(){if(defenseTimer)clearInterval(defenseTimer);defenseTimer=null}
function renderDefenseClock(){
  if(!defenseEndsAt)return;
  const remaining=Math.max(0,Math.ceil((defenseEndsAt-Date.now())/1000));defenseClock.textContent=remaining;
  openConfirmVoteBtn.disabled=remaining>0;
  openConfirmVoteBtn.textContent=remaining>0?`เปิดโหวตรอบยืนยัน (${remaining})`:"เปิดโหวตรอบยืนยัน";
  if(remaining<=0&&!defenseEndSpoken){defenseEndSpoken=true;say("หมดเวลาแก้ตัว Host สามารถเปิดโหวตรอบยืนยันได้แล้ว")}
}
function startDefenseClock(){stopDefenseClock();renderDefenseClock();defenseTimer=setInterval(renderDefenseClock,250)}
async function startDefense(targetUid,score,ballots){
  defenseCandidateUid=targetUid;defenseEndsAt=Date.now()+DEFENSE_SECONDS*1000;defenseEndSpoken=false;firstBallots=ballots||{};
  stopVoteReceipts?.();voteControl.classList.add("hidden");defenseControl.classList.remove("hidden");defenseCandidate.textContent=`${playerName(targetUid)} • ${score} เสียง`;firstBallotReveal.innerHTML=ballotRevealHtml(firstBallots,"first");startDefenseClock();
  const publicBallots={};for(const [voterUid,b] of Object.entries(firstBallots))publicBallots[voterUid]={target:b.target};
  await update(ref(db,roomPath()),{"public/status":"defense","public/phase":{state:"defense",voteId,night:currentNight||1,candidateUid:targetUid,score,defenseEndsAt,firstBallots:publicBallots,startedAt:Date.now()}});
  say(`${playerName(targetUid)} ได้คะแนนสูงสุด มีเวลาแก้ตัว ${DEFENSE_SECONDS} วินาที`);
}
async function startVote(){
  if(!roomCode||!db)return alert("ยังไม่ได้สร้างห้อง");if(aliveEntries().length<2)return alert("ผู้เล่นที่ยังอยู่ในเกมไม่พอสำหรับการโหวต");
  stopDefenseClock();hideVotePanels();voteId=`v_${Date.now().toString(36)}`;voteReceiptCount=0;
  await update(ref(db,roomPath()),{"public/status":"vote","public/phase":{state:"vote",voteId,night:currentNight||1,startedAt:Date.now()}});
  voteControl.classList.remove("hidden");voteProgressText.textContent=`0 / ${aliveEntries().length} คนส่งแล้ว`;voteResults.innerHTML="";listenVoteReceipts(voteId);
}
async function closeFirstVote(){
  if(!voteId)return alert("ยังไม่มี Vote Phase");const expected=aliveEntries().length;
  if(voteReceiptCount<expected&&!confirm(`ตอนนี้ส่งแล้ว ${voteReceiptCount}/${expected} คน\nปิดโหวตตอนนี้หรือไม่? คนที่ยังไม่ส่งจะไม่มีคะแนน`))return;
  await update(ref(db,roomPath("public/phase")),{state:"vote_reveal",closedAt:Date.now()});
  const snap=await get(ref(db,roomPath(`votes/${voteId}`)));const ballots=snap.val()||{};
  const counts={};Object.values(ballots).forEach(v=>{if(v?.target)counts[v.target]=(counts[v.target]||0)+1});
  const ranked=Object.entries(counts).sort((a,b)=>b[1]-a[1]);if(!ranked.length)return alert("ยังไม่มีคะแนนโหวต");
  const topScore=ranked[0][1],top=ranked.filter(([,n])=>n===topScore);
  if(top.length>1){
    const publicBallots={};for(const [voterUid,b] of Object.entries(ballots))publicBallots[voterUid]={target:b.target};
    firstBallots=ballots;voteControl.classList.add("hidden");resultControl.classList.remove("hidden");finalResultTitle.textContent="คะแนนรอบแรกเสมอ";finalResultSummary.textContent="ไม่มีใครเข้าสู่ช่วงแก้ตัว และไม่มีใครถูกกำจัด";confirmBallotReveal.innerHTML=ballotRevealHtml(ballots,"first");
    await update(ref(db,roomPath()),{"public/status":"vote_result","public/phase":{state:"vote_result",night:currentNight||1,voteResult:"tie",firstBallots:publicBallots,closedAt:Date.now()}});say("คะแนนโหวตเสมอ ไม่มีใครถูกกำจัด");return;
  }
  await startDefense(top[0][0],topScore,ballots);
}
async function openConfirmVote(){
  if(!defenseCandidateUid)return alert("ไม่มีผู้เล่นในช่วงแก้ตัว");if(Date.now()<defenseEndsAt)return alert("ช่วงแก้ตัวยังไม่หมดเวลา");
  stopDefenseClock();defenseControl.classList.add("hidden");confirmId=`c_${Date.now().toString(36)}`;confirmReceiptCount=0;
  await update(ref(db,roomPath()),{"public/status":"confirm_vote","public/phase":{state:"confirm_vote",night:currentNight||1,voteId,confirmId,candidateUid:defenseCandidateUid,firstBallots:Object.fromEntries(Object.entries(firstBallots).map(([u,b])=>[u,{target:b.target}])),startedAt:Date.now()}});
  confirmControl.classList.remove("hidden");confirmCandidate.textContent=`ยืนยันว่าจะกำจัด ${playerName(defenseCandidateUid)} หรือไม่?`;confirmProgressText.textContent=`0 / ${aliveEntries().length} คนส่งแล้ว`;listenConfirmReceipts(confirmId);say(`เริ่มโหวตรอบยืนยัน จะกำจัด ${playerName(defenseCandidateUid)} หรือไม่`);
}
async function closeConfirmVote(){
  if(!confirmId)return alert("ยังไม่มีโหวตรอบยืนยัน");const expected=aliveEntries().length;
  if(confirmReceiptCount<expected&&!confirm(`ตอนนี้ส่งแล้ว ${confirmReceiptCount}/${expected} คน\nปิดโหวตตอนนี้หรือไม่?`))return;
  await update(ref(db,roomPath("public/phase")),{state:"confirm_reveal",closedAt:Date.now()});
  const snap=await get(ref(db,roomPath(`confirmVotes/${confirmId}`)));confirmBallots=snap.val()||{};
  let eliminateCount=0,pardonCount=0;Object.values(confirmBallots).forEach(v=>{if(v?.choice==="eliminate")eliminateCount++;else if(v?.choice==="pardon")pardonCount++});
  const eliminated=eliminateCount>pardonCount,targetUid=defenseCandidateUid;
  if(eliminated)await eliminatePlayer(targetUid,"vote");
  confirmControl.classList.add("hidden");resultControl.classList.remove("hidden");finalResultTitle.textContent=eliminated?`${playerName(targetUid)} ถูกโหวตออก`:`${playerName(targetUid)} รอด`;
  finalResultSummary.textContent=`เอาออก ${eliminateCount} • ไม่เอาออก ${pardonCount}${eliminateCount===pardonCount?" • เสมอ = ไม่เอาออก":""}`;confirmBallotReveal.innerHTML=ballotRevealHtml(confirmBallots,"confirm");
  const publicConfirm={};for(const [voterUid,b] of Object.entries(confirmBallots))publicConfirm[voterUid]={choice:b.choice};
  await update(ref(db,roomPath()),{"public/status":"confirm_result","public/phase":{state:"confirm_result",night:currentNight||1,candidateUid:targetUid,eliminated,eliminateCount,pardonCount,confirmBallots:publicConfirm,firstBallots:Object.fromEntries(Object.entries(firstBallots).map(([u,b])=>[u,{target:b.target}])),closedAt:Date.now()}});
  stopConfirmReceipts?.();say(eliminated?`${playerName(targetUid)} ถูกโหวตออก`:`${playerName(targetUid)} ไม่ถูกกำจัด`);
}
async function finishVoteRound(){
  hideVotePanels();defenseCandidateUid="";defenseEndsAt=0;voteId="";confirmId="";firstBallots={};confirmBallots={};
  await update(ref(db,roomPath()),{"public/status":"day","public/phase":{state:"day",night:currentNight||1,voteResult:"finished",confirmedAt:Date.now()}});
}

function listenActions(night,phaseId){stopActions?.();currentPhaseId=phaseId;if(!phaseId){actionPanel.classList.add("hidden");return}stopActions=onValue(ref(db,roomPath(`actions/${night}/${phaseId}`)),snap=>renderActions(snap.val()||{}))}
function renderActions(actions){
  if(!currentExpected.length){actionPanel.classList.add("hidden");return}actionPanel.classList.remove("hidden");const submitted=currentExpected.filter(uid=>actions?.[uid]).length;actionProgress.textContent=`${submitted} / ${currentExpected.length} ส่งแล้ว`;
  if(hostIsPlayer()){actionList.innerHTML=`<div class="online-action-row"><b>🔒 ซ่อนคำตอบ Night Action</b><span>Host เล่นด้วย จึงแสดงเฉพาะจำนวนที่ส่งแล้ว</span></div>`;return}
  actionList.innerHTML=currentExpected.map(uid=>{const a=actions?.[uid];if(!a)return `<div class="online-action-row"><b>${escapeHtml(playerName(uid))}</b><span>กำลังตัดสินใจ…</span></div>`;const selectedIds=Array.isArray(a.selected)?a.selected:[],selectedNames=selectedIds.map(id=>players?.[id]?.name||"ผู้เล่นไม่ทราบชื่อ"),answer=a.skipped?"ไม่ใช้ความสามารถ":selectedNames.length?selectedNames.join(", "):"เสร็จแล้ว";return `<div class="online-action-row"><b>${escapeHtml(playerName(uid))}</b><span>${escapeHtml(answer)}</span></div>`}).join("");
}
async function publishRole(role,info){
  if(!roomCode||!db)return;const key=roleKey(role);currentNight=Number(info?.nightNumber)||1;currentPhaseId=`n${currentNight}_${Date.now().toString(36)}`;const behavior=behaviorFor(role),roleSafe={...safeRole({...role,ability:window.WWModeratorBridge?.abilitySummary?.(role)||role.action})};currentExpected=[];
  const updates={"public/status":"night","public/phase":{state:"night",night:currentNight,phaseId:currentPhaseId,step:info?.step||1,total:info?.total||1,duration:info?.totalDuration||30}};
  for(const [uid,p] of Object.entries(players||{})){const assigned=privateData?.[uid]?.role,alive=p.alive!==false,active=alive&&assigned?.key===key;if(active)currentExpected.push(uid);updates[`private/${uid}/turn`]=active?{active:true,state:"act",night:currentNight,phaseId:currentPhaseId,role:roleSafe,action:info?.action||role.action||"",ability:window.WWModeratorBridge?.abilitySummary?.(role)||role.action||"",behavior}:{active:false,state:"sleep",night:currentNight,phaseId:currentPhaseId}}
  await update(ref(db,roomPath()),updates);listenActions(currentNight,currentPhaseId);renderActions({});
}
async function publishSleep(){if(!roomCode||!db)return;const updates={"public/phase/state":"night-transition"};for(const uid of Object.keys(players||{}))updates[`private/${uid}/turn`]={active:false,state:"sleep",night:currentNight,phaseId:currentPhaseId};await update(ref(db,roomPath()),updates)}
async function publishDay({nightNumber}={}){if(!roomCode||!db)return;currentExpected=[];actionPanel.classList.add("hidden");stopActions?.();const night=Number(nightNumber)||currentNight||1,updates={"public/status":"day","public/phase":{state:"day",night,phaseId:""}};for(const uid of Object.keys(players||{}))updates[`private/${uid}/turn`]={active:false,state:"day",night};await update(ref(db,roomPath()),updates)}
function beginNight(){}
window.WWOnline={publishRole,publishSleep,publishDay,beginNight};

createBtn.addEventListener("click",createRoom);assignBtn.addEventListener("click",assignRoles);copyBtn.addEventListener("click",copyJoinLink);openHostPlayerBtn?.addEventListener("click",openHostPlayer);startVoteBtn?.addEventListener("click",startVote);confirmVoteBtn?.addEventListener("click",closeFirstVote);openConfirmVoteBtn?.addEventListener("click",openConfirmVote);closeConfirmVoteBtn?.addEventListener("click",closeConfirmVote);finishVoteRoundBtn?.addEventListener("click",finishVoteRound);

(async function boot(){
  if(!isFirebaseConfigured()){setStatus("ต้องตั้งค่า Firebase");createBtn.addEventListener("click",()=>alert("เปิดไฟล์ firebase-config.js แล้ววาง Firebase config ก่อนใช้งาน Online Room"),{once:true});return}
  try{const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getDatabase(app);const cred=await signInAnonymously(auth);hostUid=cred.user.uid;setStatus("Firebase พร้อม • สร้างห้องได้",true)}catch(err){console.error(err);setStatus("เชื่อม Firebase ไม่สำเร็จ")}
})();