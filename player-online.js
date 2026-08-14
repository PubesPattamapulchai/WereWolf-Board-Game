// Player entrypoint v3: load the full multiplayer engine and prevent clicks before Firebase Auth is ready.
const joinBtn = document.getElementById("joinBtn");
const statusEl = document.getElementById("connectionStatus");

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
  await import("./player-core-v3.js?v=20260814-audit1");
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
