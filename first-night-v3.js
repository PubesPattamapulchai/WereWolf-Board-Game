const $=id=>document.getElementById(id);

function install(){
  const btn=$("hpStartVote");if(!btn||btn.dataset.firstNightGuard)return false;btn.dataset.firstNightGuard="1";
  btn.addEventListener("click",e=>{
    const night=Number($("playNight")?.textContent)||1;
    const safe=Boolean($("firstNightSafeToggle")?.checked);
    if(!(safe&&night===1))return;
    e.preventDefault();e.stopImmediatePropagation();
    const ok=confirm("โหมดคืนแรกแบบ Online Station เปิดอยู่\n\nคืนแรกไม่มีทั้งการฆ่าและการเผา/โหวตกำจัด ผู้เล่นใช้ช่วงกลางวันพูดคุย แล้วเข้าสู่ Night 2\n\nเข้าสู่คืนที่ 2 เลยหรือไม่?");
    if(ok){
      try{if("speechSynthesis" in window){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance("คืนแรกไม่มีการโหวตกำจัด ทุกคนเตรียมเข้าสู่คืนที่สอง");u.lang="th-TH";speechSynthesis.speak(u)}}catch{}
      setTimeout(()=>$("againBtn")?.click(),250);
    }
  },true);
  return true;
}
async function boot(){for(let i=0;i<40&&!install();i++)await new Promise(r=>setTimeout(r,100))}
boot();
