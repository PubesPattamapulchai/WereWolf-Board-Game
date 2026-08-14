// Player entrypoint v3: full multiplayer engine + Firebase join guard + premium presentation.
const joinBtn = document.getElementById("joinBtn");
const statusEl = document.getElementById("connectionStatus");

if (!document.querySelector('link[data-premium-player]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './premium-theme.css?v=20260814-audit4';
  link.dataset.premiumPlayer = '1';
  document.head.appendChild(link);
}

if (joinBtn) {
  joinBtn.disabled = true;
  joinBtn.textContent = "กำลังเชื่อม…";
}

const statusObserver = statusEl ? new MutationObserver(() => {
  const text = statusEl.textContent || "";
  if (text.includes("ออนไลน์")) {
    if (joinBtn) {
      joinBtn.disabled = false;
      joinBtn.textContent = "เข้าห้อง";
    }
  } else if (text.includes("เชื่อมไม่สำเร็จ") || text.includes("ต้องตั้งค่า")) {
    if (joinBtn) {
      joinBtn.disabled = true;
      joinBtn.textContent = "Firebase ยังไม่พร้อม";
    }
  }
}) : null;
statusObserver?.observe(statusEl, { childList: true, characterData: true, subtree: true });

try {
  await import("./player-core-v3.js?v=20260814-audit4");
  await import("./premium-effects.js?v=20260814-audit4");
  if (statusEl?.textContent?.includes("ออนไลน์") && joinBtn) {
    joinBtn.disabled = false;
    joinBtn.textContent = "เข้าห้อง";
  }
} catch (error) {
  console.error("Player engine failed to load", error);
  if (statusEl) statusEl.textContent = "โหลดระบบผู้เล่นไม่สำเร็จ";
  if (joinBtn) {
    joinBtn.disabled = true;
    joinBtn.textContent = "โหลดระบบไม่สำเร็จ";
  }
}
