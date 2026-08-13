export function roleKey(role){
  return `${role?.cat || "Custom"}|${role?.name || ""}`;
}

const TWO_TARGETS = new Set(["Cupid","Mentalist","Hoodlum"]);
const NO_TARGET = new Set([
  "Mason","Minion","Ghost","Drunk","Mayor","Hunter","Disease","Pacifist",
  "Villager","Prince","Lycan","Tough Guy","Villager Idiot","Moderator","The Moderator",
  "Tanner","Mad Bomber","Cursed","Doppelganger","Doppelgänger"
]);
const OPTIONAL = new Set([
  "Witch","Priest","Troublemaker","Huntress","Alpha Wolf","Alpha Werewolf",
  "Arsonist","Apprentice Seer","P.I."
]);
const ALLOW_SELF = new Set(["Witch","Cupid","Cult Leader","Arsonist"]);

export function behaviorFor(role){
  const name = role?.name || "";
  if (NO_TARGET.has(name)) {
    return {
      targetCount:0,
      optional:false,
      allowSelf:false,
      prompt:"ทำความสามารถ/รับข้อมูลของ Role แล้วกด เสร็จแล้ว"
    };
  }
  const targetCount = TWO_TARGETS.has(name) ? 2 : 1;
  return {
    targetCount,
    optional:OPTIONAL.has(name),
    allowSelf:ALLOW_SELF.has(name),
    prompt: targetCount === 2 ? "เลือกผู้เล่น 2 คน" : "เลือกผู้เล่น 1 คน"
  };
}

export function safeRole(role){
  return {
    name:role?.name || "",
    th:role?.th || "",
    cat:role?.cat || "Custom",
    action:role?.action || "",
    ability:role?.ability || role?.action || "",
    key:roleKey(role)
  };
}
