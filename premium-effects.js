(() => {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const qs = (s, root=document) => root.querySelector(s);
  const qsa = (s, root=document) => [...root.querySelectorAll(s)];

  function injectAtmosphere(){
    if (qs('.premium-atmosphere')) return;
    const layer = document.createElement('div');
    layer.className = 'premium-atmosphere';
    layer.setAttribute('aria-hidden','true');
    layer.innerHTML = '<span class="premium-orb moon"></span><span class="premium-orb mist-a"></span><span class="premium-orb mist-b"></span>';
    document.body.prepend(layer);
    const vignette = document.createElement('div');
    vignette.className = 'premium-vignette';
    vignette.setAttribute('aria-hidden','true');
    document.body.appendChild(vignette);
  }

  function factionFromRole(role){
    const cat = role?.cat || '';
    if (cat === 'Werewolves') return 'werewolves';
    if (cat === 'Villagers') return 'villagers';
    if (cat === 'Neutral') return 'neutral';
    if (cat) return 'additional';
    return '';
  }
  function sigilForFaction(faction){
    return ({
      werewolves:'./assets/wolf-sigil.svg',
      villagers:'./assets/village-sigil.svg',
      neutral:'./assets/neutral-sigil.svg',
      additional:'./assets/additional-sigil.svg'
    })[String(faction||'').toLowerCase()] || './assets/moon-sigil.svg';
  }
  function emojiForFaction(faction){
    return ({werewolves:'🐺',villagers:'🛡️',neutral:'🕯️',additional:'✨'})[String(faction||'').toLowerCase()] || '🌙';
  }

  function addWatermark(card, faction){
    if (!card || card.querySelector('.premium-role-watermark')) return;
    const mark = document.createElement('span');
    mark.className = 'premium-role-watermark';
    mark.setAttribute('aria-hidden','true');
    mark.innerHTML = `<img alt="" src="${sigilForFaction(faction)}">`;
    card.appendChild(mark);
  }

  function decorateRoleCards(){
    qsa('.role-card[data-faction],.selected-role-card[data-faction],.library-item[data-faction]').forEach(card => {
      const raw = card.dataset.faction || '';
      const faction = raw.toLowerCase();
      addWatermark(card, faction);
    });
    qsa('.secret-card[data-faction],.turn-card[data-faction]').forEach(card => addWatermark(card, card.dataset.faction));
  }

  function updatePlayerSigils(){
    const revealed = qs('#revealedRoleCard');
    const turn = qs('#turnView');
    [revealed,turn].forEach(card => {
      if (!card) return;
      const faction = String(card.dataset.faction || 'neutral').toLowerCase();
      addWatermark(card, faction);
      const crest = card.querySelector('#roleCrest,.role-crest');
      if (crest && !crest.querySelector('img')) {
        crest.textContent = '';
        const img = document.createElement('img');
        img.src = sigilForFaction(faction);
        img.alt = '';
        crest.appendChild(img);
      }
    });
  }

  function observeCards(){
    const mo = new MutationObserver((mutations) => {
      let needs = false;
      for (const m of mutations) {
        if (m.type === 'childList' || (m.type === 'attributes' && m.attributeName === 'data-faction')) { needs = true; break; }
      }
      if (needs) {
        decorateRoleCards();
        updatePlayerSigils();
      }
    });
    mo.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-faction','class']});
  }

  function roleRevealFX(){
    const hidden = qs('#hiddenRoleCard');
    const revealed = qs('#revealedRoleCard');
    const revealBtn = qs('#revealBtn');
    const hideBtn = qs('#hideRoleBtn');
    if (!hidden || !revealed || !revealBtn) return;

    revealBtn.addEventListener('click', () => {
      requestAnimationFrame(() => {
        revealed.classList.remove('premium-reveal-in');
        void revealed.offsetWidth;
        revealed.classList.add('premium-reveal-in');
        burstFrom(revealBtn, 10);
        updatePlayerSigils();
      });
    });
    hideBtn?.addEventListener('click', () => {
      hidden.classList.remove('premium-reveal-in');
      requestAnimationFrame(() => hidden.classList.add('premium-reveal-in'));
    });
  }

  function rippleButtons(){
    document.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('button,.target,.choice,.pv-vote-target');
      if (!btn || btn.disabled || reduced) return;
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width,rect.height)*.42;
      const r = document.createElement('span');
      r.className='premium-ripple';
      r.style.width=r.style.height=`${size}px`;
      r.style.left=`${e.clientX-rect.left-size/2}px`;
      r.style.top=`${e.clientY-rect.top-size/2}px`;
      btn.appendChild(r);
      setTimeout(()=>r.remove(),620);
    },{passive:true});
  }

  function burstFrom(el,count=8){
    if (reduced || !el) return;
    const r=el.getBoundingClientRect();
    const cx=r.left+r.width/2, cy=r.top+r.height/2;
    for(let i=0;i<count;i++){
      const p=document.createElement('i');
      p.className='premium-particle';
      const a=(Math.PI*2*i/count)+(Math.random()-.5)*.3;
      const dist=35+Math.random()*55;
      p.style.left=`${cx}px`;p.style.top=`${cy}px`;
      p.style.setProperty('--dx',`${Math.cos(a)*dist}px`);
      p.style.setProperty('--dy',`${Math.sin(a)*dist}px`);
      document.body.appendChild(p);
      setTimeout(()=>p.remove(),820);
    }
  }

  function successBursts(){
    const mo = new MutationObserver((ms)=>{
      for(const m of ms){
        if(m.type!=='attributes'||m.attributeName!=='class') continue;
        const el=m.target;
        if((el.classList.contains('sent')||el.classList.contains('pv-vote-sent'))&&!el.classList.contains('hidden')) burstFrom(el,7);
      }
    });
    qsa('.sent,.pv-vote-sent').forEach(el=>mo.observe(el,{attributes:true,attributeFilter:['class']}));
  }

  function tiltCards(){
    if (reduced || !window.matchMedia('(pointer:fine)').matches) return;
    const selector='.role-card,.library-item,.secret-card,.online-room-card,.setting-card';
    document.addEventListener('pointermove',(e)=>{
      const card=e.target.closest(selector);
      if(!card) return;
      const r=card.getBoundingClientRect();
      const x=(e.clientX-r.left)/r.width-.5;
      const y=(e.clientY-r.top)/r.height-.5;
      const max=card.classList.contains('secret-card')?2.4:1.25;
      card.style.transform=`perspective(900px) rotateX(${(-y*max).toFixed(2)}deg) rotateY(${(x*max).toFixed(2)}deg) translateY(-1px)`;
    },{passive:true});
    document.addEventListener('pointerout',(e)=>{
      const card=e.target.closest?.(selector);
      if(card) card.style.transform='';
    },{passive:true});
  }

  function phaseTransitions(){
    const targets=qsa('#playingState,#doneState,#phaseView,#turnView,#voteView,#defenseView,#confirmVoteView,#voteResultView,#pvVoteView');
    targets.forEach(el=>{
      const mo=new MutationObserver(()=>{
        if(!el.classList.contains('hidden')){
          el.animate?.([
            {opacity:.25,transform:'translateY(10px) scale(.992)'},
            {opacity:1,transform:'translateY(0) scale(1)'}
          ],{duration:380,easing:'cubic-bezier(.2,.78,.2,1)'});
        }
      });
      mo.observe(el,{attributes:true,attributeFilter:['class']});
    });
  }

  function defenseUrgency(){
    const clock=qs('#defensePlayerClock')||qs('#defenseClock');
    if(!clock) return;
    const apply=()=>{
      const n=Number(clock.textContent);
      const host=clock.closest('.defense-view,.defense-control');
      if(!host) return;
      host.classList.toggle('premium-urgent',Number.isFinite(n)&&n<=10&&n>0);
    };
    new MutationObserver(apply).observe(clock,{childList:true,characterData:true,subtree:true});
    apply();
  }

  function polishFactionCrests(){
    qsa('.role-crest,.library-crest,.selected-role-icon').forEach(el=>{
      const host=el.closest('[data-faction]');
      if(!host||el.querySelector('img')) return;
      const faction=String(host.dataset.faction||'').toLowerCase();
      if(!faction) return;
      el.textContent='';
      const img=document.createElement('img');
      img.src=sigilForFaction(faction);
      img.alt='';
      img.style.cssText='width:72%;height:72%;object-fit:contain;filter:drop-shadow(0 4px 8px rgba(0,0,0,.3))';
      el.appendChild(img);
    });
  }

  function init(){
    injectAtmosphere();
    decorateRoleCards();
    polishFactionCrests();
    updatePlayerSigils();
    observeCards();
    roleRevealFX();
    rippleButtons();
    successBursts();
    tiltCards();
    phaseTransitions();
    defenseUrgency();
    document.documentElement.classList.add('premium-ui-ready');
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
