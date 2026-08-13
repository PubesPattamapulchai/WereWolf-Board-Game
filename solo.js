const $=id=>document.getElementById(id);

const ROLES=[
  {key:'villager',name:'Villager',th:'ชาวบ้าน',team:'good',wake:'never',ability:'ไม่มีพลังกลางคืน • ช่วยวิเคราะห์และโหวต'},
  {key:'werewolf',name:'Werewolf',th:'มนุษย์หมาป่า',team:'evil',wake:'every',order:20,action:'wolf',ability:'กลางคืนฝูงหมาป่าเลือกกำจัดผู้เล่น 1 คน'},
  {key:'seer',name:'Seer',th:'ผู้หยั่งรู้',team:'good',wake:'every',order:40,action:'seer',ability:'เลือกเช็ค 1 คน • รู้ว่าเป็นฝ่ายหมาป่าหรือไม่'},
  {key:'bodyguard',name:'Bodyguard',th:'ผู้คุ้มกัน',team:'good',wake:'every',order:30,action:'guard',ability:'เลือกป้องกันผู้เล่น 1 คนในคืนนี้'},
  {key:'witch',name:'Witch',th:'แม่มด',team:'good',wake:'every',order:50,action:'witch',ability:'มียาช่วย 1 ครั้ง และยาพิษ 1 ครั้ง'},
  {key:'cupid',name:'Cupid',th:'คิวปิด',team:'good',wake:'first',order:10,action:'cupid',ability:'คืนแรกเลือกผู้เล่น 2 คนให้เป็นคู่รัก'},
  {key:'mystic-seer',name:'Mystic Seer',th:'ญาณทิพย์',team:'good',wake:'every',order:43,action:'mystic',ability:'เลือกเช็ค 1 คน • รู้ Role จริงของคนนั้น'},
  {key:'aura-seer',name:'Aura Seer',th:'ผู้เห็นออร่า',team:'good',wake:'every',order:41,action:'aura',ability:'เลือกเช็ค 1 คน • รู้ว่ามีพลังพิเศษหรือไม่'},
  {key:'mentalist',name:'Mentalist',th:'นักอ่านใจ',team:'good',wake:'every',order:42,action:'mentalist',ability:'เลือก 2 คน • รู้ว่าอยู่ฝ่ายเดียวกันหรือไม่'},
  {key:'sorcerer',name:'Sorcerer',th:'จอมเวท',team:'evil',wake:'every',order:44,action:'sorcerer',ability:'เลือกเช็ค 1 คน • รู้ว่าเป็น Seer หรือไม่'},
  {key:'mason',name:'Mason',th:'เมสัน',team:'good',wake:'first',order:15,action:'mason',ability:'คืนแรกเมสันลืมตาเพื่อรู้จักกัน'},
  {key:'hunter',name:'Hunter',th:'นายพราน',team:'good',wake:'never',ability:'เมื่อถูกกำจัด ใช้กติกานายพรานตามที่กลุ่มตกลง'},
  {key:'prince',name:'Prince',th:'เจ้าชาย',team:'good',wake:'never',ability:'ไม่มี Action กลางคืน'},
  {key:'tanner',name:'Tanner',th:'แทนเนอร์',team:'neutral',wake:'never',ability:'เป้าหมายเฉพาะของ Role ตามกติกาที่ใช้'},
  {key:'arsonist',name:'Arsonist',th:'นักวางเพลิง',team:'neutral',wake:'every',order:60,action:'generic',ability:'เลือกเป้าหมายตามกติกา Arsonist ของกลุ่ม'}
];

let roleCounts={villager:3,werewolf:2,seer:1,bodyguard:1};
let players=[];
let revealIndex=0;
let night=1;
let duration=30;
let queue=[];
let queueIndex=-1;
let currentRole=null;
let selected=[];
let timerId=null;
let timeLeft=30;
let wakeLock=null;
let nightState={wolfTarget:null,guardTarget:null,witchHeal:false,witchPoison:null,lovers:[]};
let persistent={witchHealAvailable:true,witchPoisonAvailable:true};

function roleByKey(key){return ROLES.find(r=>r.key===key)}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function alivePlayers(){return players.filter(p=>p.alive!==false)}
function playerById(id){return players.find(p=>p.id===id)}
function assignedRole(p){return roleByKey(p.roleKey)}
function showOnly(id){['setupView','revealView','centerView','nightView','dawnView'].forEach(x=>$(x).classList.toggle('hidden',x!==id))}
function save(){localStorage.setItem('ww_solo_state',JSON.stringify({players,roleCounts,night,persistent,duration}))}
function speak(text){
  if(!$('voiceToggle')?.checked||!('speechSynthesis' in window))return;
  try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='th-TH';u.rate=.9;u.pitch=.96;speechSynthesis.speak(u)}catch{}
}
async function keepAwake(){try{if('wakeLock' in navigator)wakeLock=await navigator.wakeLock.request('screen')}catch{}}

function renderRoleSelect(){
  $('roleSelect').innerHTML=ROLES.map(r=>`<option value="${r.key}">${r.th} (${r.name})</option>`).join('');
}
function renderRolePool(){
  $('rolePool').innerHTML=Object.entries(roleCounts).filter(([,n])=>n>0).map(([key,n])=>{
    const r=roleByKey(key);return `<div class="role-row"><div><b>${esc(r.th)}</b><div class="mini">${esc(r.ability)}</div></div><div class="count"><button data-minus="${key}">−</button><b>${n}</b><button data-plus="${key}">+</button></div></div>`;
  }).join('')||'<div class="mini">ยังไม่มี Role</div>';
  $('rolePool').querySelectorAll('[data-minus]').forEach(b=>b.onclick=()=>{roleCounts[b.dataset.minus]=Math.max(0,(roleCounts[b.dataset.minus]||0)-1);renderRolePool()});
  $('rolePool').querySelectorAll('[data-plus]').forEach(b=>b.onclick=()=>{roleCounts[b.dataset.plus]=(roleCounts[b.dataset.plus]||0)+1;renderRolePool()});
}
function shuffled(a){const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x}

function assignRoles(){
  const names=$('playersInput').value.split(/\n/).map(s=>s.trim()).filter(Boolean);
  const pool=[];for(const [key,n] of Object.entries(roleCounts))for(let i=0;i<n;i++)pool.push(key);
  if(names.length<3)return alert('กรุณาใส่ผู้เล่นอย่างน้อย 3 คน');
  if(pool.length!==names.length)return alert(`จำนวนผู้เล่น ${names.length} คน แต่มี Role ${pool.length} ใบ\nต้องให้จำนวนเท่ากันก่อน`);
  const shuffledRoles=shuffled(pool);
  players=names.map((name,i)=>({id:`p${i+1}`,name,roleKey:shuffledRoles[i],alive:true,eliminatedBy:null}));
  revealIndex=0;night=1;persistent={witchHealAvailable:true,witchPoisonAvailable:true};
  save();showReveal();
}
function showReveal(){
  showOnly('revealView');
  const p=players[revealIndex];
  $('revealPlayer').textContent=p.name;
  $('revealPrompt').textContent=`คนที่ ${revealIndex+1} / ${players.length} • ให้ ${p.name} ถือมือถือคนเดียว`;
  $('roleSecret').classList.add('hidden');$('showRoleBtn').classList.remove('hidden');$('nextRevealBtn').classList.add('hidden');
}
function revealRole(){
  const p=players[revealIndex],r=assignedRole(p);
  $('roleSecretName').textContent=r.th;
  $('roleSecretAbility').textContent=r.ability;
  $('roleSecret').classList.remove('hidden');$('showRoleBtn').classList.add('hidden');$('nextRevealBtn').classList.remove('hidden');
}
function nextReveal(){
  revealIndex++;
  if(revealIndex>=players.length){renderCenter();showOnly('centerView');return}
  showReveal();
}
function renderStatus(containerId){
  const el=$(containerId);if(!el)return;
  el.innerHTML=players.map(p=>`<div class="status-row ${p.alive===false?'dead':''}"><span>${esc(p.name)}</span><b>${p.alive===false?(p.eliminatedBy==='vote'?'ถูกโหวตออก':p.eliminatedBy==='werewolf'?'ถูกกำจัดกลางคืน':'ออกจากเกม'):'ยังอยู่ในเกม'}</b></div>`).join('');
}
function renderCenter(){
  $('startNightBtn').textContent=`เริ่ม Night ${night}`;renderStatus('playerStatus');
}

function buildQueue(){
  const keys=[...new Set(alivePlayers().map(p=>p.roleKey))];
  queue=keys.map(roleByKey).filter(r=>r&&r.wake!=='never'&&(r.wake==='every'||(r.wake==='first'&&night===1))).sort((a,b)=>(a.order||99)-(b.order||99));
}
function resetNightState(){nightState={wolfTarget:null,guardTarget:null,witchHeal:false,witchPoison:null,lovers:nightState.lovers||[]}}
async function startNight(){
  duration=Number($('durationSelect').value)||30;resetNightState();buildQueue();queueIndex=-1;save();await keepAwake();showOnly('nightView');
  $('nightLabel').textContent=`NIGHT ${night}`;$('nightRole').textContent='ทุกคนหลับตา';$('nightInstruction').textContent='เตรียมเริ่มลำดับกลางคืน';$('nightTimer').textContent='—';$('nightTargets').innerHTML='';$('nightExtra').classList.add('hidden');$('confirmActionBtn').classList.add('hidden');$('skipActionBtn').classList.add('hidden');
  speak('ทุกคนหลับตา เริ่มเข้าสู่ช่วงกลางคืน');
  setTimeout(nextRole,3500);
}
function nextRole(){
  clearInterval(timerId);selected=[];queueIndex++;
  if(queueIndex>=queue.length){finishNight();return}
  currentRole=queue[queueIndex];
  const holders=alivePlayers().filter(p=>p.roleKey===currentRole.key);
  if(!holders.length){nextRole();return}
  $('nightRole').textContent=currentRole.th;$('nightInstruction').textContent=`${currentRole.th} ลืมตาและทำ Action บนหน้าจอ`;
  speak(`${currentRole.th} ลืมตา`);
  setTimeout(()=>renderRoleAction(currentRole),1200);
}
function startTimer(){
  clearInterval(timerId);timeLeft=duration;$('nightTimer').textContent=timeLeft;
  timerId=setInterval(()=>{timeLeft--;$('nightTimer').textContent=Math.max(0,timeLeft);if(timeLeft<=0){clearInterval(timerId);sleepCurrentRole()}},1000);
}
function eligibleTargets({excludeSameRole=false,excludeSelfHolder=false}={}){
  let list=alivePlayers();
  if(excludeSameRole&&currentRole)list=list.filter(p=>p.roleKey!==currentRole.key);
  if(excludeSelfHolder){const holders=alivePlayers().filter(p=>p.roleKey===currentRole.key);if(holders.length===1)list=list.filter(p=>p.id!==holders[0].id)}
  return list;
}
function renderTargets(list,count=1){
  $('nightTargets').innerHTML=list.map(p=>`<button class="target" data-target="${p.id}">${esc(p.name)}</button>`).join('');
  $('nightTargets').querySelectorAll('[data-target]').forEach(btn=>btn.onclick=()=>{
    const id=btn.dataset.target;
    if(selected.includes(id))selected=selected.filter(x=>x!==id);else{if(selected.length>=count)selected.shift();selected.push(id)}
    $('nightTargets').querySelectorAll('[data-target]').forEach(b=>b.classList.toggle('selected',selected.includes(b.dataset.target)));
    $('confirmActionBtn').disabled=selected.length!==count;
  });
}
function renderRoleAction(role){
  $('nightTargets').innerHTML='';$('nightExtra').classList.add('hidden');$('confirmActionBtn').classList.remove('hidden');$('skipActionBtn').classList.remove('hidden');$('confirmActionBtn').disabled=true;$('confirmActionBtn').textContent='ยืนยัน Action';$('skipActionBtn').textContent='ข้าม / ไม่ใช้';
  if(role.action==='mason'){
    const mates=alivePlayers().filter(p=>p.roleKey==='mason').map(p=>p.name).join(', ');
    $('nightExtra').textContent=`เมสันในเกม: ${mates}`;$('nightExtra').classList.remove('hidden');$('confirmActionBtn').disabled=false;$('confirmActionBtn').textContent='รับทราบ';$('skipActionBtn').classList.add('hidden');startTimer();return;
  }
  if(role.action==='wolf'){
    $('nightInstruction').textContent='หมาป่าทุกคนลืมตา • ชี้/พยักหน้าเงียบ ๆ แล้วให้คนหนึ่งแตะเป้าหมาย';renderTargets(eligibleTargets({excludeSameRole:true}),1);
  }else if(role.action==='cupid'){
    $('nightInstruction').textContent='เลือกผู้เล่น 2 คนให้เป็นคู่รัก';renderTargets(alivePlayers(),2);
  }else if(role.action==='mentalist'){
    $('nightInstruction').textContent='เลือกผู้เล่น 2 คนเพื่อเทียบฝ่าย';renderTargets(alivePlayers(),2);
  }else if(role.action==='witch'){
    renderWitch();startTimer();return;
  }else{
    renderTargets(eligibleTargets({excludeSelfHolder:true}),1);
  }
  startTimer();
}
function renderWitch(){
  const victim=nightState.wolfTarget?playerById(nightState.wolfTarget):null;
  let html=`เป้าหมายของหมาป่าคืนนี้: <b>${victim?esc(victim.name):'ไม่มี / ยังไม่เลือก'}</b><br><br>`;
  html+=`ยาช่วย: ${persistent.witchHealAvailable?'ยังมี':'ใช้แล้ว'} • ยาพิษ: ${persistent.witchPoisonAvailable?'ยังมี':'ใช้แล้ว'}`;
  $('nightExtra').innerHTML=html;$('nightExtra').classList.remove('hidden');
  $('nightTargets').innerHTML='';
  const buttons=[];
  if(victim&&persistent.witchHealAvailable)buttons.push(`<button class="target" data-witch="heal">🧪 ช่วย ${esc(victim.name)}</button>`);
  if(persistent.witchPoisonAvailable)buttons.push(`<button class="target" data-witch="poison">☠️ ใช้ยาพิษ</button>`);
  buttons.push(`<button class="target" data-witch="none">ไม่ใช้ยา</button>`);
  $('nightTargets').innerHTML=buttons.join('');
  $('confirmActionBtn').classList.add('hidden');$('skipActionBtn').classList.add('hidden');
  $('nightTargets').querySelectorAll('[data-witch]').forEach(b=>b.onclick=()=>{
    const a=b.dataset.witch;
    if(a==='heal'){nightState.witchHeal=true;persistent.witchHealAvailable=false;sleepCurrentRole()}
    else if(a==='none'){sleepCurrentRole()}
    else{selected=[];$('nightInstruction').textContent='แม่มดเลือกคนที่จะใช้ยาพิษ';renderTargets(alivePlayers().filter(p=>p.roleKey!=='witch'),1);$('confirmActionBtn').classList.remove('hidden');$('confirmActionBtn').disabled=true;$('confirmActionBtn').textContent='ยืนยันใช้ยาพิษ';$('confirmActionBtn').dataset.mode='witch-poison';$('skipActionBtn').classList.remove('hidden')}
  });
}

async function confirmCurrentAction(){
  clearInterval(timerId);
  if($('confirmActionBtn').dataset.mode==='witch-poison'){
    delete $('confirmActionBtn').dataset.mode;
    if(selected[0]){nightState.witchPoison=selected[0];persistent.witchPoisonAvailable=false}
    sleepCurrentRole();return;
  }
  const role=currentRole;if(!role){sleepCurrentRole();return}
  if(role.action==='wolf')nightState.wolfTarget=selected[0]||null;
  else if(role.action==='guard')nightState.guardTarget=selected[0]||null;
  else if(role.action==='cupid')nightState.lovers=[...selected];
  else if(role.action==='seer'&&selected[0]){const p=playerById(selected[0]),r=assignedRole(p);await privateResult(r.team==='evil'&&r.key==='werewolf'?'🐺 ฝ่ายหมาป่า':'✅ ไม่ใช่ฝ่ายหมาป่า',`${p.name} • ผลการเช็คของ Seer`,r.team==='evil'&&r.key==='werewolf');}
  else if(role.action==='mystic'&&selected[0]){const p=playerById(selected[0]),r=assignedRole(p);await privateResult(`🎭 ${r.th}`,`${p.name} คือ ${r.name}`,false);}
  else if(role.action==='aura'&&selected[0]){const p=playerById(selected[0]),r=assignedRole(p),special=!['villager','werewolf'].includes(r.key);await privateResult(special?'✨ มีพลังพิเศษ':'○ ไม่มีพลังพิเศษ',p.name,!special);}
  else if(role.action==='sorcerer'&&selected[0]){const p=playerById(selected[0]),r=assignedRole(p);await privateResult(r.key==='seer'?'🔮 เป็น Seer':'✖ ไม่ใช่ Seer',p.name,r.key!=='seer');}
  else if(role.action==='mentalist'&&selected.length===2){const a=assignedRole(playerById(selected[0])),b=assignedRole(playerById(selected[1]));await privateResult(a.team===b.team?'🤝 ฝ่ายเดียวกัน':'⚡ คนละฝ่าย',`${playerById(selected[0]).name} กับ ${playerById(selected[1]).name}`,a.team!==b.team);}
  sleepCurrentRole();
}
function privateResult(title,sub,bad=false){
  return new Promise(resolve=>{
    const box=$('privateResult');$('privateResultTitle').textContent=title;$('privateResultTitle').className=`result-main ${bad?'result-bad':'result-good'}`;$('privateResultSub').textContent=sub;box.classList.remove('hidden');let n=4;$('privateResultCountdown').textContent=n;
    const id=setInterval(()=>{n--;$('privateResultCountdown').textContent=Math.max(0,n);if(n<=0){clearInterval(id);box.classList.add('hidden');resolve()}},1000);
  });
}
function sleepCurrentRole(){
  clearInterval(timerId);delete $('confirmActionBtn').dataset.mode;
  const name=currentRole?.th||'Role';$('nightTargets').innerHTML='';$('nightExtra').classList.add('hidden');$('confirmActionBtn').classList.add('hidden');$('skipActionBtn').classList.add('hidden');$('nightTimer').textContent='—';$('nightInstruction').textContent=`${name} หลับตา`;
  speak(`${name} หลับตา`);save();setTimeout(nextRole,2200);
}
function resolveDeaths(){
  const dead=[];
  if(nightState.wolfTarget){
    const protectedByGuard=nightState.guardTarget===nightState.wolfTarget;
    const protectedByWitch=nightState.witchHeal===true;
    if(!protectedByGuard&&!protectedByWitch){const p=playerById(nightState.wolfTarget);if(p&&p.alive!==false){p.alive=false;p.eliminatedBy='werewolf';dead.push(p)}}
  }
  if(nightState.witchPoison){const p=playerById(nightState.witchPoison);if(p&&p.alive!==false){p.alive=false;p.eliminatedBy='witch';dead.push(p)}}
  if(nightState.lovers?.length===2){
    const [aId,bId]=nightState.lovers,a=playerById(aId),b=playerById(bId);
    if(a&&b){if(a.alive===false&&b.alive!==false){b.alive=false;b.eliminatedBy='lover';dead.push(b)}else if(b.alive===false&&a.alive!==false){a.alive=false;a.eliminatedBy='lover';dead.push(a)}}
  }
  return [...new Map(dead.map(p=>[p.id,p])).values()];
}
function finishNight(){
  clearInterval(timerId);const dead=resolveDeaths();save();showOnly('dawnView');
  $('dawnResult').textContent=dead.length?dead.map(p=>p.name).join(', ')+' ถูกกำจัด':'คืนนี้ไม่มีใครถูกกำจัด';
  renderStatus('dawnStatus');speak(dead.length?`ทุกคนลืมตา คืนนี้ ${dead.map(p=>p.name).join(' และ ')} ถูกกำจัด`:'ทุกคนลืมตา คืนนี้ไม่มีใครถูกกำจัด');
}
function nextNight(){night++;renderCenter();showOnly('centerView');save()}
function dayEliminate(){
  const alive=alivePlayers();if(!alive.length)return;
  const names=alive.map((p,i)=>`${i+1}. ${p.name}`).join('\n');const ans=prompt(`ใส่หมายเลขคนที่ถูกโหวตออก\n${names}`);const i=Number(ans)-1;if(i<0||i>=alive.length)return;
  if(!confirm(`ยืนยันว่า ${alive[i].name} ถูกโหวตออก?\nRole จะไม่ถูกเปิดเผย`))return;
  alive[i].alive=false;alive[i].eliminatedBy='vote';renderStatus('dawnStatus');save();
}

$('addRoleBtn').onclick=()=>{const k=$('roleSelect').value;roleCounts[k]=(roleCounts[k]||0)+1;renderRolePool()};
$('clearRolesBtn').onclick=()=>{roleCounts={};renderRolePool()};
$('assignBtn').onclick=assignRoles;
$('showRoleBtn').onclick=revealRole;$('nextRevealBtn').onclick=nextReveal;
$('startNightBtn').onclick=startNight;$('confirmActionBtn').onclick=confirmCurrentAction;$('skipActionBtn').onclick=sleepCurrentRole;
$('nextNightBtn').onclick=nextNight;$('dayEliminateBtn').onclick=dayEliminate;

renderRoleSelect();renderRolePool();
const saved=localStorage.getItem('ww_solo_state');
if(saved){try{const s=JSON.parse(saved);if(s.roleCounts)roleCounts=s.roleCounts;if(s.duration)$('durationSelect').value=String(s.duration);renderRolePool()}catch{}}
