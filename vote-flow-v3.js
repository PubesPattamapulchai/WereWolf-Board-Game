import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getDatabase, ref, get, update, onValue } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const $ = id => document.getElementById(id);
const DEFENSE_SECONDS = 60;
let app, auth, db, hostUid = "", room = "", players = {}, priv = {};
let voteId = "", confirmId = "", candidateUid = "", firstBallots = {};
let stopReceipt = null, stopConfirmReceipt = null, defenseTimer = null, defenseEndsAt = 0;

const PACK = new Set(["Werewolf","Lone Wolf","The Lone Wolf","Wolf Cub","Alpha Wolf","Alpha Werewolf","Big Bad Wolf","Mystic Wolf","Omega Wolf","Confused Wolf","German shepherd","The Remorseful Werewolf","The Fallen Angel"]);
const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
const roomPath = p => `rooms/${room}${p ? "/"+p : ""}`;
const nameOf = uid => players?.[uid]?.name || "ผู้เล่น";
const roleOf = uid => priv?.[uid]?.role || null;
const aliveEntries = () => Object.entries(players || {}).filter(([,p]) => p?.alive !== false);
const mayorWeight = uid => roleOf(uid)?.name === "Mayor" ? 2 : 1;
const isActualWolf = uid => {
  const r = roleOf(uid); if (!r) return false;
  if (r.name === "Cursed") return Boolean(priv?.[uid]?.resources?.convertedToWerewolf);
  return r.cat === "Werewolves" && PACK.has(r.name);
};

function say(text){
  try { if (!("speechSynthesis" in window)) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang="th-TH"; u.rate=.92; speechSynthesis.speak(u); } catch {}
}

async function ensureFirebase(){
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app); db = getDatabase(app);
  if (!auth.currentUser) await signInAnonymously(auth);
  hostUid = auth.currentUser.uid;
  room = localStorage.getItem("ww_host_room") || "";
  if (!room) throw new Error("ยังไม่มีห้องเกม");
}
async function refresh(){
  await ensureFirebase();
  const [ps,pr] = await Promise.all([get(ref(db,roomPath("players"))),get(ref(db,roomPath("private")))]);
  players = ps.val() || {}; priv = pr.val() || {};
}
function publicBallots(ballots,type="first"){
  const out={}; for (const [uid,b] of Object.entries(ballots||{})) out[uid]= type==="confirm" ? {choice:b.choice} : {target:b.target}; return out;
}
function ballotRows(ballots,type="first"){
  const rows=Object.entries(ballots||{}).sort((a,b)=>nameOf(a[0]).localeCompare(nameOf(b[0]),"th"));
  return rows.length ? rows.map(([uid,b])=>`<div class="v3-row"><span>${esc(nameOf(uid))}${mayorWeight(uid)===2?" 👑×2":""}</span><b>${type==="confirm"?(b.choice==="eliminate"?"🔴 เอาออก":"🟢 ไม่เอาออก"):`→ ${esc(nameOf(b.target))}`}</b></div>`).join("") : `<div class="v3-note">ไม่มีคะแนน</div>`;
}
function tallyFirst(ballots){
  const counts={}; const alive=new Set(aliveEntries().map(([u])=>u));
  for(const [voter,b] of Object.entries(ballots||{})){
    if(!alive.has(voter)||!alive.has(b?.target)||b.target===voter) continue;
    counts[b.target]=(counts[b.target]||0)+mayorWeight(voter);
  }
  return counts;
}
function tallyConfirm(ballots){
  let eliminate=0,pardon=0;
  const alive=new Set(aliveEntries().map(([u])=>u));
  for(const [voter,b] of Object.entries(ballots||{})){
    if(!alive.has(voter)) continue;
    const role=roleOf(voter)?.name;
    let choice=b?.choice;
    if(role==="Pacifist") choice="pardon";
    if(role==="Villager Idiot") choice="eliminate";
    const w=mayorWeight(voter);
    if(choice==="eliminate") eliminate+=w; else if(choice==="pardon") pardon+=w;
  }
  return {eliminate,pardon};
}

function installUI(){
  const card=document.querySelector(".hp-day-card"); if(!card||$("v3VoteFlow")) return false;
  ["hpHostVoteBox","hpVoteStatus","hpVoteTally","hpConfirmVote","hpRevote"].forEach(id=>$(id)?.classList.add("hidden"));
  const oldStart=$("hpStartVote"); if(oldStart){ oldStart.onclick=null; oldStart.textContent="🗳 เริ่มโหวตรอบแรก"; }
  const style=document.createElement("style"); style.textContent=`
  .v3-flow{margin-top:12px;border-top:1px solid #30394b;padding-top:12px}.v3-panel{margin-top:9px;padding:12px;border:1px solid #374157;border-radius:15px;background:#101620}.v3-title{font-size:13px;font-weight:950}.v3-note{font-size:10px;color:#99a7ba;line-height:1.45;margin-top:5px}.v3-progress{margin-top:8px;font-size:11px;color:#d6deea;font-weight:850}.v3-targets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:9px}.v3-target{min-height:42px;border:1px solid #354158;background:#151c28;color:#dce4ee;border-radius:12px;padding:8px;font-size:11px;font-weight:850}.v3-target.sel{border-color:#9a3a49;background:#311820;color:#ffd6db}.v3-row{display:flex;justify-content:space-between;gap:10px;padding:7px 8px;border-radius:9px;background:#151c28;margin-top:5px;font-size:11px}.v3-row b{color:#f2d08a;text-align:right}.v3-clock{font-size:44px;font-weight:950;font-variant-numeric:tabular-nums;margin:8px 0;color:#fff}.v3-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}.v3-danger{background:linear-gradient(145deg,#ef4454,#bd2738)!important}.v3-safe{background:#173126!important;border:1px solid #32634d!important}.v3-result{font-size:18px;font-weight:950;margin-top:6px}@media(max-width:640px){.v3-targets,.v3-actions{grid-template-columns:1fr}}
  `; document.head.appendChild(style);
  const box=document.createElement("div"); box.id="v3VoteFlow"; box.className="v3-flow"; box.innerHTML=`
    <div id="v3First" class="v3-panel hidden"><div class="v3-title">🗳 Hidden Ballot — รอบเสนอชื่อ</div><div class="v3-note">ระหว่างโหวต Host เห็นเฉพาะจำนวนคนที่ส่ง • เปิดว่าใครเลือกใครเมื่อปิดรอบเท่านั้น</div><div id="v3FirstProgress" class="v3-progress"></div><div id="v3HostFirst" class="hidden"><div id="v3FirstTargets" class="v3-targets"></div><button id="v3SubmitFirst" class="btn primary hp-day-primary" disabled>ล็อกคะแนนของฉัน</button></div><button id="v3CloseFirst" class="btn secondary hp-day-primary">ปิดโหวตและเปิดผล</button></div>
    <div id="v3Defense" class="v3-panel hidden"><div class="v3-title">⚖️ ช่วงแก้ตัว</div><div id="v3Candidate" class="v3-result"></div><div id="v3Clock" class="v3-clock">60</div><div class="v3-note">วินาที • หลังหมดเวลา Host เปิดโหวตรอบยืนยัน</div><div id="v3FirstReveal"></div><button id="v3OpenConfirm" class="btn primary hp-day-primary" disabled>เปิดโหวตรอบยืนยัน</button></div>
    <div id="v3Confirm" class="v3-panel hidden"><div class="v3-title">🔐 Hidden Ballot — ยืนยันกำจัด</div><div id="v3ConfirmCandidate" class="v3-result"></div><div id="v3ConfirmProgress" class="v3-progress"></div><div id="v3HostConfirm" class="hidden"><div class="v3-actions"><button id="v3Eliminate" class="btn v3-danger">🔴 เอาออก</button><button id="v3Pardon" class="btn v3-safe">🟢 ไม่เอาออก</button></div><button id="v3SubmitConfirm" class="btn primary hp-day-primary" disabled>ล็อกคำตอบของฉัน</button></div><button id="v3CloseConfirm" class="btn secondary hp-day-primary">ปิดโหวตและเปิดผล</button></div>
    <div id="v3Result" class="v3-panel hidden"><div class="v3-title">ผลโหวต</div><div id="v3ResultTitle" class="v3-result"></div><div id="v3ResultSummary" class="v3-note"></div><div id="v3Reveal"></div><button id="v3Finish" class="btn secondary hp-day-primary">กลับสู่ช่วงกลางวัน</button><button id="v3Night" class="btn primary hp-day-primary">🌙 เข้าสู่คืนถัดไป</button></div>`;
  card.appendChild(box);
  oldStart?.addEventListener("click",startFirstVote);
  $("v3CloseFirst").onclick=closeFirstVote; $("v3OpenConfirm").onclick=openConfirm;
  $("v3CloseConfirm").onclick=closeConfirm; $("v3Finish").onclick=finishDay;
  $("v3Night").onclick=async()=>{await finishDay(); $("againBtn")?.click();};
  return true;
}
function hidePanels(){["v3First","v3Defense","v3Confirm","v3Result"].forEach(id=>$(id)?.classList.add("hidden"));}

let hostFirstChoice="", hostConfirmChoice="";
function renderHostFirst(){
  const wrap=$("v3HostFirst"); if(!wrap) return;
  const hostAlive=players?.[hostUid]?.alive!==false; wrap.classList.toggle("hidden",!hostAlive); if(!hostAlive) return;
  const list=aliveEntries().filter(([u])=>u!==hostUid); $("v3FirstTargets").innerHTML=list.map(([u,p])=>`<button type="button" class="v3-target ${hostFirstChoice===u?"sel":""}" data-v3t="${u}">${esc(p.name)}</button>`).join("");
  document.querySelectorAll("[data-v3t]").forEach(b=>b.onclick=()=>{hostFirstChoice=b.dataset.v3t;renderHostFirst()});
  $("v3SubmitFirst").disabled=!hostFirstChoice; $("v3SubmitFirst").onclick=submitHostFirst;
}
async function submitHostFirst(){
  if(!hostFirstChoice||!voteId)return; try{await update(ref(db,roomPath()),{[`votes/${voteId}/${hostUid}`]:{target:hostFirstChoice,submittedAt:Date.now()},[`voteReceipts/${voteId}/${hostUid}`]:true});$("v3SubmitFirst").disabled=true;$("v3SubmitFirst").textContent="ล็อกแล้ว ✓"}catch(e){console.error(e);alert("คะแนนของ Host ถูกล็อกแล้วหรือส่งไม่สำเร็จ")}
}
function renderHostConfirm(){
  const wrap=$("v3HostConfirm"); if(!wrap)return; const hostAlive=players?.[hostUid]?.alive!==false;wrap.classList.toggle("hidden",!hostAlive);if(!hostAlive)return;
  const role=roleOf(hostUid)?.name; const elim=$("v3Eliminate"),pardon=$("v3Pardon");
  elim.disabled=role==="Pacifist"; pardon.disabled=role==="Villager Idiot";
  elim.classList.toggle("sel",hostConfirmChoice==="eliminate");pardon.classList.toggle("sel",hostConfirmChoice==="pardon");
  elim.onclick=()=>{if(!elim.disabled){hostConfirmChoice="eliminate";renderHostConfirm()}};pardon.onclick=()=>{if(!pardon.disabled){hostConfirmChoice="pardon";renderHostConfirm()}};
  if(role==="Pacifist")hostConfirmChoice="pardon";if(role==="Villager Idiot")hostConfirmChoice="eliminate";
  $("v3SubmitConfirm").disabled=!hostConfirmChoice;$("v3SubmitConfirm").onclick=submitHostConfirm;
}
async function submitHostConfirm(){
  if(!confirmId||!hostConfirmChoice)return;try{await update(ref(db,roomPath()),{[`confirmVotes/${confirmId}/${hostUid}`]:{choice:hostConfirmChoice,submittedAt:Date.now()},[`confirmReceipts/${confirmId}/${hostUid}`]:true});$("v3SubmitConfirm").disabled=true;$("v3SubmitConfirm").textContent="ล็อกแล้ว ✓"}catch(e){console.error(e);alert("คำตอบของ Host ถูกล็อกแล้วหรือส่งไม่สำเร็จ")}
}

async function startFirstVote(){
  try{await refresh()}catch(e){return alert(e.message)}
  if(aliveEntries().length<2)return alert("ผู้เล่นที่ยังอยู่ในเกมไม่พอสำหรับการโหวต");
  voteId=`v_${Date.now().toString(36)}`;confirmId="";candidateUid="";firstBallots={};hostFirstChoice="";hostConfirmChoice="";hidePanels();
  await update(ref(db,roomPath()),{"public/status":"vote","public/phase":{state:"vote",night:Number($("playNight")?.textContent)||1,voteId,startedAt:Date.now()}});
  $("v3First").classList.remove("hidden");renderHostFirst();
  stopReceipt?.();stopReceipt=onValue(ref(db,roomPath(`voteReceipts/${voteId}`)),s=>{$("v3FirstProgress").textContent=`ส่งแล้ว ${Object.keys(s.val()||{}).length} / ${aliveEntries().length} คน`});say("เริ่มโหวตรอบแรก ทุกคนเลือกผู้เล่นหนึ่งคน คะแนนจะถูกซ่อนไว้จน Host ปิดรอบ");
}
async function closeFirstVote(){
  await refresh();const expected=aliveEntries().length;const rs=await get(ref(db,roomPath(`voteReceipts/${voteId}`)));const sent=Object.keys(rs.val()||{}).length;if(sent<expected&&!confirm(`ส่งแล้ว ${sent}/${expected} คน ปิดรอบตอนนี้หรือไม่?`))return;
  await update(ref(db,roomPath("public/phase")),{state:"vote_reveal",closedAt:Date.now()});const bs=await get(ref(db,roomPath(`votes/${voteId}`)));firstBallots=bs.val()||{};const counts=tallyFirst(firstBallots);const ranked=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  if(!ranked.length)return alert("ยังไม่มีคะแนนที่ใช้ได้");const topScore=ranked[0][1],top=ranked.filter(([,n])=>n===topScore);
  if(top.length!==1){hidePanels();$("v3Result").classList.remove("hidden");$("v3ResultTitle").textContent="คะแนนสูงสุดเสมอ — ไม่มีใครถูกกำจัด";$("v3ResultSummary").textContent=`คะแนนสูงสุด ${topScore} เสียง`;$("v3Reveal").innerHTML=ballotRows(firstBallots);await update(ref(db,roomPath()),{"public/status":"vote_result","public/phase":{state:"vote_result",voteResult:"tie",night:Number($("playNight")?.textContent)||1,firstBallots:publicBallots(firstBallots),closedAt:Date.now()}});return;
  }
  candidateUid=top[0][0];defenseEndsAt=Date.now()+DEFENSE_SECONDS*1000;hidePanels();$("v3Defense").classList.remove("hidden");$("v3Candidate").textContent=`${nameOf(candidateUid)} • ${topScore} คะแนน`;$("v3FirstReveal").innerHTML=ballotRows(firstBallots);await update(ref(db,roomPath()),{"public/status":"defense","public/phase":{state:"defense",voteId,candidateUid,score:topScore,defenseEndsAt,firstBallots:publicBallots(firstBallots),startedAt:Date.now()}});runDefenseClock();say(`${nameOf(candidateUid)} ได้คะแนนสูงสุด มีเวลาแก้ตัว ${DEFENSE_SECONDS} วินาที`);
}
function runDefenseClock(){clearInterval(defenseTimer);const tick=()=>{const n=Math.max(0,Math.ceil((defenseEndsAt-Date.now())/1000));$("v3Clock").textContent=n;$("v3OpenConfirm").disabled=n>0;if(n<=0)clearInterval(defenseTimer)};tick();defenseTimer=setInterval(tick,250)}
async function openConfirm(){
  if(Date.now()<defenseEndsAt)return;await refresh();confirmId=`c_${Date.now().toString(36)}`;hostConfirmChoice="";hidePanels();$("v3Confirm").classList.remove("hidden");$("v3ConfirmCandidate").textContent=`จะกำจัด ${nameOf(candidateUid)} หรือไม่?`;renderHostConfirm();await update(ref(db,roomPath()),{"public/status":"confirm_vote","public/phase":{state:"confirm_vote",voteId,confirmId,candidateUid,firstBallots:publicBallots(firstBallots),startedAt:Date.now()}});stopConfirmReceipt?.();stopConfirmReceipt=onValue(ref(db,roomPath(`confirmReceipts/${confirmId}`)),s=>{$("v3ConfirmProgress").textContent=`ส่งแล้ว ${Object.keys(s.val()||{}).length} / ${aliveEntries().length} คน`});say(`เริ่มโหวตรอบยืนยัน จะกำจัด ${nameOf(candidateUid)} หรือไม่`);
}
async function eliminate(uid,reason){
  await update(ref(db,roomPath(`players/${uid}`)),{alive:false,eliminatedBy:reason,eliminatedAt:Date.now()});await update(ref(db,roomPath(`private/${uid}/turn`)),{active:false,state:"eliminated"});
  const lover=priv?.[uid]?.loverUid;if(lover&&players?.[lover]?.alive!==false){await update(ref(db,roomPath(`players/${lover}`)),{alive:false,eliminatedBy:"lover",eliminatedAt:Date.now()});await update(ref(db,roomPath(`private/${lover}/turn`)),{active:false,state:"eliminated"})}
}
async function closeConfirm(){
  await refresh();const expected=aliveEntries().length;const rs=await get(ref(db,roomPath(`confirmReceipts/${confirmId}`)));const sent=Object.keys(rs.val()||{}).length;if(sent<expected&&!confirm(`ส่งแล้ว ${sent}/${expected} คน ปิดรอบตอนนี้หรือไม่?`))return;
  await update(ref(db,roomPath("public/phase")),{state:"confirm_reveal",closedAt:Date.now()});const bs=await get(ref(db,roomPath(`confirmVotes/${confirmId}`)));const ballots=bs.val()||{};const {eliminate:ec,pardon:pc}=tallyConfirm(ballots);let eliminated=ec>pc;let special="";
  const role=roleOf(candidateUid);
  if(eliminated&&role?.name==="Prince"){eliminated=false;special="การกำจัดถูกยกเลิกด้วยความสามารถป้องกัน (No-Reveal variant)";}
  if(eliminated)await eliminate(candidateUid,"vote");
  hidePanels();$("v3Result").classList.remove("hidden");$("v3ResultTitle").textContent=eliminated?`${nameOf(candidateUid)} ถูกกำจัด`:`${nameOf(candidateUid)} รอด`;$("v3ResultSummary").textContent=`เอาออก ${ec} • ไม่เอาออก ${pc}${ec===pc?" • เสมอ = รอด":""}${special?" • "+special:""}`;$("v3Reveal").innerHTML=ballotRows(ballots,"confirm");
  const phase={state:"confirm_result",candidateUid,eliminated,eliminateCount:ec,pardonCount:pc,confirmBallots:publicBallots(ballots,"confirm"),firstBallots:publicBallots(firstBallots),closedAt:Date.now(),roleRevealed:false};
  if(eliminated&&role?.name==="Tanner"){phase.gameOver=true;phase.winner="เงื่อนไขชนะพิเศษ";await update(ref(db,roomPath()),{"public/status":"gameover","public/phase":{state:"gameover",winner:"เงื่อนไขชนะพิเศษ",roleRevealed:false}});$("v3ResultSummary").textContent+=" • เกมจบ: เงื่อนไขชนะพิเศษสำเร็จ";return;}
  await update(ref(db,roomPath()),{"public/status":"confirm_result","public/phase":phase});say(eliminated?`${nameOf(candidateUid)} ถูกกำจัด ไม่มีการเปิดเผยบทบาท`:`${nameOf(candidateUid)} ไม่ถูกกำจัด`);
}
async function finishDay(){
  clearInterval(defenseTimer);stopReceipt?.();stopConfirmReceipt?.();hidePanels();await ensureFirebase();await update(ref(db,roomPath()),{"public/status":"day","public/phase":{state:"day",night:Number($("playNight")?.textContent)||1,roleRevealed:false,updatedAt:Date.now()}});
}

async function boot(){
  for(let i=0;i<30&&!installUI();i++) await new Promise(r=>setTimeout(r,100));
  try{await refresh()}catch{}
}
boot();
