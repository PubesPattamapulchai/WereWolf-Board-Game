import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getDatabase, ref, get, update, onValue } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";
import { isActualWerewolfRole } from "./game-rules.js";

const $=id=>document.getElementById(id);
let app,auth,db,uid="",room="",players={},priv={},pub={},checking=false,lastDecision="";
const roomPath=p=>`rooms/${room}${p?"/"+p:""}`;
const aliveIds=()=>Object.entries(players||{}).filter(([,p])=>p?.alive!==false).map(([id])=>id);
const roleOf=id=>priv?.[id]?.role||null;

// These roles can change the normal faction end condition or have an independent win condition.
// When present, the browser refuses to auto-declare a winner rather than making a false ruling.
const SPECIAL_WIN = new Set([
  "Tanner","Lone Wolf","The Lone Wolf","Hoodlum","Vampire","Cult Leader","Turncoat",
  "Bloody Mary","Vengeful ghost","Chef","Enchantress","Arsonist","Thespian","Orphan",
  "The Guardian Angel","Amnesiac"
]);

function installUI(){
  if($("winGuardV3"))return;
  const card=document.querySelector(".online-room-card");if(!card)return;
  const el=document.createElement("div");el.id="winGuardV3";el.style.cssText="margin-top:10px;padding:9px 11px;border:1px solid #334057;border-radius:13px;background:#0d131d;color:#9eabba;font-size:10px;line-height:1.45";el.textContent="🏁 Win Guard: รอตรวจหลังแจก Role";card.appendChild(el);
}
function setNote(text,warn=false){installUI();const el=$("winGuardV3");if(!el)return;el.textContent=text;el.style.borderColor=warn?"#674f2e":"#334057";el.style.color=warn?"#f1d18f":"#a8b4c5"}
async function ensure(){app=getApps().length?getApp():initializeApp(firebaseConfig);auth=getAuth(app);db=getDatabase(app);if(!auth.currentUser)await signInAnonymously(auth);uid=auth.currentUser.uid;room=localStorage.getItem("ww_host_room")||"";return Boolean(room)}
async function refresh(){if(!(await ensure()))return false;const [p,r,u]=await Promise.all([get(ref(db,roomPath("players"))),get(ref(db,roomPath("private"))),get(ref(db,roomPath("public")))]);players=p.val()||{};priv=r.val()||{};pub=u.val()||{};return true}
function hasSpecialWinRole(){return Object.values(priv||{}).some(d=>SPECIAL_WIN.has(d?.role?.name||""))}
function convertedWolf(id){return roleOf(id)?.name==="Cursed"&&Boolean(priv?.[id]?.resources?.convertedToWerewolf)}
function actualWolf(id){return isActualWerewolfRole(roleOf(id))||convertedWolf(id)}

async function evaluate(){
  if(checking)return;checking=true;
  try{
    if(!(await refresh()))return;const state=pub?.phase?.state||"";
    if(["lobby","assigned","night","night-start","night-transition","vote","vote_reveal","defense","confirm_vote","confirm_reveal"].includes(state))return;
    if(state==="gameover")return;
    const ids=aliveIds();if(!ids.length)return;
    if(hasSpecialWinRole()){setNote("🏁 Win Guard: ชุดนี้มี Role เงื่อนไขชนะพิเศษ — Host ต้องตรวจชัยชนะก่อนเริ่มรอบถัดไป",true);return}
    const wolves=ids.filter(actualWolf),others=ids.filter(id=>!actualWolf(id));
    let winner="";
    if(wolves.length===0)winner="ฝ่ายชาวบ้าน";
    else if(wolves.length>=others.length)winner="ฝ่ายมนุษย์หมาป่า";
    if(!winner){setNote(`🏁 Win Guard: ยังเล่นต่อ • หมาป่าจริง ${wolves.length} / ผู้เล่นอื่น ${others.length}`);return}
    const signature=`${winner}|${ids.sort().join(",")}`;if(signature===lastDecision)return;lastDecision=signature;
    await update(ref(db,roomPath()),{"public/status":"gameover","public/phase":{state:"gameover",winner,roleRevealed:false,endedAt:Date.now(),reason:winner==="ฝ่ายชาวบ้าน"?"no-wolves":"wolf-parity"}});
    setNote(`🏁 เกมจบ: ${winner} • ไม่เปิดเผย Role`);
    try{if("speechSynthesis" in window){speechSynthesis.cancel();const v=new SpeechSynthesisUtterance(`เกมจบ ${winner} ชนะ`);v.lang="th-TH";speechSynthesis.speak(v)}}catch{}
  }catch(e){console.error("game-state-v3",e);setNote("🏁 Win Guard: ตรวจผลไม่สำเร็จ — ให้ Host ตรวจด้วยตนเอง",true)}finally{checking=false}
}

async function boot(){installUI();try{if(!(await refresh()))return;onValue(ref(db,roomPath("players")),s=>{players=s.val()||{};setTimeout(evaluate,80)});onValue(ref(db,roomPath("private")),s=>{priv=s.val()||{};setTimeout(evaluate,80)});onValue(ref(db,roomPath("public")),s=>{pub=s.val()||{};setTimeout(evaluate,80)});setTimeout(evaluate,150)}catch(e){console.error(e)}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
