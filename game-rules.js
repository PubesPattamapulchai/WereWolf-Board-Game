export function roleKey(role){
  return `${role?.cat || "Custom"}|${role?.name || ""}`;
}

const TWO_TARGETS = new Set(["Cupid","Mentalist","Hoodlum"]);
const NO_TARGET = new Set([
  "Mason","Minion","Ghost","Drunk","Mayor","Hunter","Disease","Pacifist",
  "Villager","Prince","Lycan","Tough Guy","Villager Idiot","Moderator","The Moderator",
  "Tanner","Mad Bomber","Cursed"
]);
const OPTIONAL = new Set([
  "Witch","Priest","Troublemaker","Huntress","Alpha Wolf","Alpha Werewolf",
  "Arsonist","Apprentice Seer","P.I."
]);
// Roles for which the cited rule does not explicitly forbid choosing yourself.
const ALLOW_SELF = new Set(["Witch","Cupid","Priest","Arsonist"]);

const ACTUAL_WOLVES = new Set([
  "Werewolf","Lone Wolf","The Lone Wolf","Wolf Cub","Alpha Wolf","Alpha Werewolf",
  "Big Bad Wolf","Mystic Wolf","Omega Wolf","Confused Wolf","German shepherd",
  "The Remorseful Werewolf","The Fallen Angel"
]);

const MANUAL_RESOLUTION = new Set([
  "Spellcaster","Drunk","Priest","P.I.","Troublemaker","Old Hag","Apprentice Seer",
  "Hunter","Disease","Ghost","Doppelganger","Doppelgänger","Tough Guy","Lone Wolf",
  "The Lone Wolf","Wolf Cub","Cursed","Alpha Wolf","Alpha Werewolf","Hoodlum","Vampire",
  "Cult Leader","Revealer","Huntress","Mad Bomber","Big Bad Wolf","Mystic Wolf","Omega Wolf",
  "Poisoner","Fruit Brute","The Fallen Angel","Confused Wolf","German shepherd",
  "The Remorseful Werewolf","Turncoat","Bloody Mary","Vengeful ghost","Chef","Enchantress",
  "Arsonist","Thespian","Orphan","The Guardian Angel","The Priest","Sheriff","Amnesiac"
]);

export function behaviorFor(role){
  const name = role?.name || "";
  if (NO_TARGET.has(name)) {
    return {
      targetCount:0,
      optional:false,
      allowSelf:false,
      prompt:"รับข้อมูล/ทำขั้นตอนของ Role แล้วกด เสร็จแล้ว"
    };
  }
  // Doppelganger/Doppelgänger must choose an initial player; older builds incorrectly treated them as no-target.
  const targetCount = TWO_TARGETS.has(name) ? 2 : 1;
  return {
    targetCount,
    optional:OPTIONAL.has(name),
    allowSelf:ALLOW_SELF.has(name),
    prompt: targetCount === 2 ? "เลือกผู้เล่น 2 คน" : "เลือกผู้เล่น 1 คน"
  };
}

export function isActualWerewolfRole(role){
  return role?.cat === "Werewolves" && ACTUAL_WOLVES.has(role?.name || "");
}

export function teamForRole(role, resources={}){
  if (!role) return "unknown";
  if (role.name === "Cursed") return resources.convertedToWerewolf ? "werewolves" : "villagers";
  if (role.cat === "Villagers" || role.cat === "Additional") return "villagers";
  if (role.cat === "Werewolves") return "werewolves";
  return `neutral:${role.name || "unknown"}`;
}

export function automationSupport(role){
  const name = role?.name || "";
  if (!name) return {level:"manual",reason:"Role ไม่ระบุชื่อ"};
  if (MANUAL_RESOLUTION.has(name)) return {
    level:"manual",
    reason:"Role นี้มี trigger/ผลต่อเนื่อง/เงื่อนไขชนะที่ยังต้องให้ Host ตรวจตามกติกา"
  };
  return {level:"auto",reason:"Night target / information / vote behavior รองรับโดย engine หลัก"};
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
