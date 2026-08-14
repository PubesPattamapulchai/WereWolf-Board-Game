import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

let roleName="",phaseState="",applying=false;
const $=id=>document.getElementById(id);
function enforce(){
  if(applying||phaseState!=="confirm_vote")return;
  const eliminate=$("chooseEliminateBtn"),pardon=$("choosePardonBtn");if(!eliminate||!pardon)return;
  applying=true;
  try{
    if(roleName==="Pacifist"){
      eliminate.disabled=true;eliminate.title="Pacifist ต้องโหวตให้ผู้เล่นรอด";
      if(!pardon.disabled&&!pardon.classList.contains("selected"))pardon.click();
    }else if(roleName==="Villager Idiot"){
      pardon.disabled=true;pardon.title="Villager Idiot ต้องโหวตให้ผู้เล่นถูกกำจัด";
      if(!eliminate.disabled&&!eliminate.classList.contains("selected"))eliminate.click();
    }
  }finally{applying=false}
}
async function boot(){
  try{
    const app=getApps().length?getApp():initializeApp(firebaseConfig),auth=getAuth(app),db=getDatabase(app);if(!auth.currentUser)await signInAnonymously(auth);const uid=auth.currentUser.uid;
    const q=new URLSearchParams(location.search),room=(q.get('room')||localStorage.getItem('ww_player_room')||'').toUpperCase();if(!room)return;
    onValue(ref(db,`rooms/${room}/private/${uid}/role/name`),s=>{roleName=s.val()||"";queueMicrotask(enforce)});
    onValue(ref(db,`rooms/${room}/public/phase/state`),s=>{phaseState=s.val()||"";queueMicrotask(enforce)});
    new MutationObserver(()=>queueMicrotask(enforce)).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class','disabled'],childList:true});
  }catch(e){console.error('player-vote-guard-v3',e)}
}
boot();
