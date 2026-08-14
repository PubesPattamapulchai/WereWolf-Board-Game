import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

let allowPack=false;
function enforce(){const el=document.getElementById('teamComms');if(el&&!allowPack)el.classList.add('hidden')}
async function boot(){
  try{
    const app=getApps().length?getApp():initializeApp(firebaseConfig),auth=getAuth(app),db=getDatabase(app);
    if(!auth.currentUser)await signInAnonymously(auth);const uid=auth.currentUser.uid;
    const q=new URLSearchParams(location.search),room=(q.get('room')||localStorage.getItem('ww_player_room')||'').toUpperCase();if(!room)return;
    onValue(ref(db,`rooms/${room}/private/${uid}/turn`),snap=>{const turn=snap.val()||{};allowPack=Boolean(turn.active&&turn.behavior?.kind==='werewolf');enforce()});
    new MutationObserver(enforce).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  }catch(e){console.error('player-pack-guard-v3',e)}
}
boot();
