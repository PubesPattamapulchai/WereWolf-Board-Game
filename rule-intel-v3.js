import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getDatabase, ref, get, update, onValue } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";
import { isActualWerewolfRole, teamForRole } from "./game-rules.js";

let app,auth,db,uid="",room="",players={},priv={},publicState={},stopActions=null,lastPatchedAssignment="";
const roomPath=p=>`rooms/${room}${p?"/"+p:""}`;
const nameOf=id=>players?.[id]?.name||"ผู้เล่น";
const roleOf=id=>priv?.[id]?.role||null;

async function ensure(){
  app=getApps().length?getApp():initializeApp(firebaseConfig);auth=getAuth(app);db=getDatabase(app);
  if(!auth.currentUser)await signInAnonymously(auth);uid=auth.currentUser.uid;room=localStorage.getItem("ww_host_room")||"";return Boolean(room);
}
async function refresh(){
  if(!(await ensure()))return false;
  const [ps,pr,pu]=await Promise.all([get(ref(db,roomPath("players"))),get(ref(db,roomPath("private"))),get(ref(db,roomPath("public")))]);
  players=ps.val()||{};priv=pr.val()||{};publicState=pu.val()||{};return true;
}

async function patchAssignmentIntel(){
  if(!Object.keys(priv).length)return;
  const assignedIds=Object.keys(priv).filter(id=>priv[id]?.role?.name);
  if(!assignedIds.length)return;
  const signature=assignedIds.map(id=>`${id}:${priv[id].role.key||priv[id].role.name}`).sort().join("|");
  if(signature===lastPatchedAssignment)return;
  const wolves=assignedIds.filter(id=>isActualWerewolfRole(roleOf(id))).map(id=>({uid:id,name:nameOf(id)}));
  const masons=assignedIds.filter(id=>roleOf(id)?.name==="Mason").map(id=>({uid:id,name:nameOf(id)}));
  const updates={};
  for(const id of assignedIds){
    const role=roleOf(id);let teammates=[];
    if(isActualWerewolfRole(role))teammates=wolves.filter(x=>x.uid!==id);
    else if(role?.name==="Minion")teammates=wolves; // Minion knows who the wolves are, but wolves do not learn Minion here.
    else if(role?.name==="Mason")teammates=masons.filter(x=>x.uid!==id);
    updates[`private/${id}/teammates`]=teammates.length?teammates:null;
  }
  await update(ref(db,roomPath()),updates);lastPatchedAssignment=signature;
}

function actualTeam(id){return teamForRole(roleOf(id),priv?.[id]?.resources||{})}
async function patchMentalist(actions,phase){
  for(const [actor,a] of Object.entries(actions||{})){
    if(roleOf(actor)?.name!=="Mentalist"||a?.skipped)continue;
    const ids=Array.isArray(a?.selected)?a.selected:[];if(ids.length<2)continue;
    const same=actualTeam(ids[0])===actualTeam(ids[1]);
    const result=`${nameOf(ids[0])} และ ${nameOf(ids[1])} ${same?"อยู่ฝ่ายเดียวกัน":"อยู่คนละฝ่าย"}`;
    await update(ref(db,roomPath(`private/${actor}/turn`)),{result,ruleAudit:"team-v3"});
  }
}
async function watchPhase(){
  stopActions?.();stopActions=null;
  const phase=publicState?.phase||{};if(phase.state!=="night"||!phase.phaseId)return;
  stopActions=onValue(ref(db,roomPath(`actions/${phase.night||1}/${phase.phaseId}`)),snap=>patchMentalist(snap.val()||{},phase).catch(console.error));
}

async function boot(){
  try{if(!(await refresh()))return;await patchAssignmentIntel();
    onValue(ref(db,roomPath("players")),s=>{players=s.val()||{};patchAssignmentIntel().catch(console.error)});
    onValue(ref(db,roomPath("private")),s=>{priv=s.val()||{};patchAssignmentIntel().catch(console.error)});
    onValue(ref(db,roomPath("public")),s=>{publicState=s.val()||{};watchPhase().catch(console.error)});
    await watchPhase();
  }catch(e){console.error("rule-intel-v3",e)}
}
boot();
