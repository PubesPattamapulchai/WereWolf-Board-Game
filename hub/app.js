const PAGE_ROOT = 'https://pubespattamapulchai.github.io';

// เพิ่มเกมใหม่ใน array นี้จุดเดียว แล้วหน้า Hub จะสร้างการ์ดให้อัตโนมัติ
const GAMES = [
  {
    id: 'werewolf', name: 'Werewolf', th: 'มนุษย์หมาป่า', symbol: '☾',
    kicker: 'SOCIAL DEDUCTION', tag: 'ลับ • โหวต • กลางคืน',
    description: 'เกมจับโกหกแบบเต็มระบบ มี Role ลับ Night Phase, Pack Link และ Hidden Ballot',
    players: 'กลุ่ม 3+ คน', time: '20–60 นาที', code: '5 ตัว',
    hostUrl: `${PAGE_ROOT}/WereWolf-Board-Game/`, playerUrl: `${PAGE_ROOT}/WereWolf-Board-Game/player.html`,
    colors: ['#17131b', '#0c1119', '#ef7180', 'rgba(207,52,75,.65)']
  },
  {
    id: 'insider', name: 'Insider', th: 'ตามหาอินไซเดอร์', symbol: '◉',
    kicker: 'HIDDEN INFORMATION', tag: 'คำลับ • ถามตอบ',
    description: 'MASTER และ INSIDER รู้คำลับ คนอื่นต้องช่วยกันหาคำและจับให้ได้ว่าใครรู้มากเกินไป',
    players: '3–6 คน', time: '10–20 นาที', code: 'I + 5 ตัว',
    hostUrl: `${PAGE_ROOT}/Insider/`, playerUrl: `${PAGE_ROOT}/Insider/player.html`,
    colors: ['#15192a', '#0c1119', '#93a9ff', 'rgba(83,105,238,.68)']
  },
  {
    id: 'spyfall', name: 'SpyFall', th: 'สายลับอยู่ไหน', symbol: '⌖',
    kicker: 'BLUFF & QUESTION', tag: 'สถานที่ • สายลับ',
    description: 'ทุกคนรู้สถานที่ยกเว้น Spy ถามกันให้เนียน จับ Spy ให้ทันก่อนที่ Spy จะเดาสถานที่ถูก',
    players: '3+ คน', time: '8–15 นาที', code: 'S + 5 ตัว',
    hostUrl: `${PAGE_ROOT}/SpyFall/`, playerUrl: `${PAGE_ROOT}/SpyFall/player.html`,
    colors: ['#101d1b', '#0b1114', '#77dfbb', 'rgba(47,171,135,.62)']
  },
  {
    id: 'chess', name: 'Chess', th: 'Walnut & Brass Chess', symbol: '♞',
    kicker: 'CLASSIC STRATEGY', tag: '2 ผู้เล่น • Local',
    description: 'หมากรุกธีม Walnut & Brass สำหรับเล่นบนเครื่องเดียว เหมาะกับเกมสองคนแบบคลาสสิก',
    players: '2 คน', time: 'ตามต้องการ', code: null,
    hostUrl: `${PAGE_ROOT}/Chess-game/`, playerUrl: null,
    colors: ['#2d251d', '#14110e', '#e2c16d', 'rgba(176,126,52,.7)']
  }
];

const grid = document.getElementById('gameGrid');
const count = document.getElementById('gameCount');
const form = document.getElementById('joinForm');
const input = document.getElementById('roomCode');
const detected = document.getElementById('detectedGame');

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[char]);
}

function renderGames() {
  count.textContent = GAMES.length;
  grid.innerHTML = GAMES.map(game => {
    const [card1, card2, accent, glow] = game.colors;
    const joinButton = game.playerUrl
      ? `<button class="secondary" type="button" data-join-game="${game.id}">เข้าห้อง</button>`
      : '';
    const primaryText = game.playerUrl ? 'สร้างห้อง' : 'เล่นเกม';
    return `
      <article class="game-card" data-symbol="${escapeHtml(game.symbol)}" style="--card1:${card1};--card2:${card2};--accent:${accent};--glow:${glow}">
        <div class="game-top"><span class="game-kicker">${escapeHtml(game.kicker)}</span><span class="game-tag">${escapeHtml(game.tag)}</span></div>
        <h3>${escapeHtml(game.name)}</h3>
        <div class="game-th">${escapeHtml(game.th)}</div>
        <p class="game-desc">${escapeHtml(game.description)}</p>
        <div class="game-meta">
          <span>♟ ${escapeHtml(game.players)}</span><span>◷ ${escapeHtml(game.time)}</span>
          ${game.code ? `<span>⌗ ${escapeHtml(game.code)}</span>` : ''}
        </div>
        <div class="game-actions">
          <a class="primary" href="${game.hostUrl}">${primaryText} <span aria-hidden="true">&nbsp;→</span></a>
          ${joinButton}
        </div>
      </article>`;
  }).join('');

  grid.querySelectorAll('[data-join-game]').forEach(button => {
    button.addEventListener('click', () => {
      const game = GAMES.find(item => item.id === button.dataset.joinGame);
      input.focus();
      if (game?.id === 'insider') input.placeholder = 'IXXXXX';
      else if (game?.id === 'spyfall') input.placeholder = 'SXXXXX';
      else input.placeholder = '5 ตัว';
      detected.className = 'detected';
      detected.innerHTML = `กำลังจะเข้า <b>${escapeHtml(game?.name || 'เกม')}</b> • ใส่ Room Code ด้านบน`;
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
}

function normalizedCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
}

function detectByCode(code) {
  if (code.length === 6 && code.startsWith('I')) return GAMES.find(game => game.id === 'insider');
  if (code.length === 6 && code.startsWith('S')) return GAMES.find(game => game.id === 'spyfall');
  if (code.length === 5) return GAMES.find(game => game.id === 'werewolf');
  return null;
}

function updateDetection() {
  const code = normalizedCode(input.value);
  if (input.value !== code) input.value = code;
  detected.className = 'detected';
  if (!code) { detected.textContent = ''; return; }
  const game = detectByCode(code);
  if (game) {
    detected.innerHTML = `ตรวจพบ <b>${escapeHtml(game.name)}</b> • กด “เข้าเกม” ได้เลย`;
    return;
  }
  const partial = (code.startsWith('I') || code.startsWith('S')) && code.length < 6;
  if (partial || code.length < 5) { detected.textContent = 'กำลังตรวจ Room Code…'; return; }
  detected.className = 'detected error';
  detected.textContent = 'รูปแบบ Room Code ยังไม่ตรงกับเกมที่รองรับ';
}

input.addEventListener('input', updateDetection);
form.addEventListener('submit', event => {
  event.preventDefault();
  const code = normalizedCode(input.value);
  const game = detectByCode(code);
  if (!game?.playerUrl) {
    detected.className = 'detected error';
    detected.textContent = 'ไม่พบเกมจาก Room Code นี้ กรุณาตรวจอีกครั้ง';
    input.focus();
    return;
  }
  const destination = new URL(game.playerUrl);
  destination.searchParams.set('room', code);
  window.location.href = destination.toString();
});

renderGames();
