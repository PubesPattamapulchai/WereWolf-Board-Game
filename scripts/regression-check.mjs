import fs from 'node:fs';

const read = p => fs.readFileSync(p,'utf8');
const fail = msg => { console.error(`❌ ${msg}`); process.exitCode = 1; };
const ok = msg => console.log(`✓ ${msg}`);

const requiredFiles = [
  'index.html','player.html','moderator-online.js','player-online.js','player-core-v3.js',
  'host-player-v2.js','vote-flow-v3.js','rule-audit-v3.js','rule-intel-v3.js',
  'night-guard-v3.js','first-night-v3.js','game-state-v3.js','game-rules.js','firebase.rules.json'
];
for(const f of requiredFiles){ if(!fs.existsSync(f)) fail(`missing ${f}`); else ok(`found ${f}`); }

try{ JSON.parse(read('firebase.rules.json')); ok('firebase.rules.json is valid JSON'); }catch(e){ fail(`invalid firebase.rules.json: ${e.message}`); }

const hostEntry=read('moderator-online.js');
for(const marker of ['host-player-v2.js','vote-flow-v3.js','rule-audit-v3.js','rule-intel-v3.js','night-guard-v3.js','first-night-v3.js','game-state-v3.js']){
  hostEntry.includes(marker)?ok(`host entry loads ${marker}`):fail(`host entry no longer loads ${marker}`);
}
const playerEntry=read('player-online.js');
playerEntry.includes('player-core-v3.js')?ok('player entry loads v3 multiplayer core'):fail('player entry regressed away from player-core-v3.js');
playerEntry.includes('joinBtn.disabled = true')?ok('join guarded until Firebase ready'):fail('Firebase join guard missing');

const rules=read('firebase.rules.json');
for(const marker of ['teamSignals','teamChat','voteReceipts','confirmVotes','confirmReceipts',"child('turn').child('active').val() == true"]){
  rules.includes(marker)?ok(`rules contain ${marker}`):fail(`security rule marker missing: ${marker}`);
}

const playerHtml=read('player.html');
for(const id of ['joinBtn','connectionStatus','lobbyView','roleView','phaseView','turnView','voteView','defenseView','confirmVoteView','voteResultView','targetList','deadBanner']){
  playerHtml.includes(`id="${id}"`)?ok(`player UI contains #${id}`):fail(`player UI missing #${id}`);
}

const gameRules=read('game-rules.js');
for(const marker of ['automationSupport','teamForRole','isActualWerewolfRole']){
  gameRules.includes(marker)?ok(`game rules export ${marker}`):fail(`game rules audit helper missing: ${marker}`);
}

if(process.exitCode) process.exit(process.exitCode);
console.log('\n✅ Werewolf regression audit passed');
