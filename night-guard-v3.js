import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getDatabase, ref, get, update } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";
import { isActualWerewolfRole } from "./game-rules.js";

let app,auth,db,room="";
const roomPath=p=>`rooms/${room}${p?"/"+p:""}`;
async function ensure(){app=getApps().length?getApp():initializeApp(firebaseConfig);auth=getAuth(app);db=getDatabase(app);if(!auth.currentUser)await signInAnonymously(auth);room=localStorage.getItem("ww_host_room")||"";return Boolean(room)}

async function wolfTieContext(){
  if(!(await ensure()))return null;
  const [pu,pr]=await Promise.all([get(ref(db,roomPath("public"))),get(ref(db,roomPath("private")))]);
  const pub=pu.val()||{},priv=pr.val()||{},phase=pub.phase||{};
  if(phase.state!=="night"||!phase.phaseId)return null;
  const active=Object.entries(priv).filter(([,d])=>d?.turn?.active&&d?.turn?.phaseId===phase.phaseId);
  if(!active.some(([,d])=>isActualWerewolfRole(d?.role)))return null;
  const ac=await get(ref(db,roomPath(`actions/${phase.night||1}/${phase.phaseId}`))),actions=ac.val()||{};
  const counts={};for(const a of Object.values(actions)){const target=Array.isArray(a?.selected)?a.selected[0]:null;if(target)counts[target]=(counts[target]||0)+1}
  const rows=Object.entries(counts).sort((a,b)=>b[1]-a[1]);if(rows.length<2)return {tied:false,phase,priv};
  const tied=rows[0][1]===rows[1][1];return {tied,phase,priv,rows};
}

function announce(){try{if("speechSynthesis" in window){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance("ฝูงหมาป่าตัดสินใจไม่ลงตัว คืนนี้จึงไม่มีเป้าหมายจากฝูง");u.lang="th-TH";speechSynthesis.speak(u)}}catch{}}

async function install(){
  for(let i=0;i<50&&!window.WWOnline?.publishSleep;i++)await new Promise(r=>setTimeout(r,80));
  const api=window.WWOnline;if(!api?.publishSleep||api.publishSleep.__nightGuardV3)return;
  const original=api.publishSleep.bind(api);
  async function guardedPublishSleep(...args){
    try{
      const ctx=await wolfTieContext();
      if(ctx?.tied){
        // Do not call the legacy resolver: it randomly breaks a tied wolf target.
        const updates={"public/phase/state":"night-transition"};
        for(const [id,d] of Object.entries(ctx.priv||{}))updates[`private/${id}/turn`]={active:false,state:"sleep",night:ctx.phase.night||1,phaseId:ctx.phase.phaseId};
        await update(ref(db,roomPath()),updates);
        document.getElementById("hpHostTurn")?.classList.add("hidden");
        announce();
        return;
      }
    }catch(e){console.error("night-guard-v3",e)}
    return original(...args);
  }
  guardedPublishSleep.__nightGuardV3=true;api.publishSleep=guardedPublishSleep;
}
install();
