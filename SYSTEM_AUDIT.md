# Werewolf System Audit v3

วันที่ตรวจ: 2026-08-14

เอกสารนี้เป็น regression/rules checklist ของเว็บ `WereWolf-Board-Game` หลังพบว่า UI upload เคยนำ logic รุ่นเก่ากลับมาทับ engine รุ่นใหม่

## Rule baseline

ระบบตั้งใจอิง role/rule set ที่ใช้ในโปรเจกต์จาก Online Station และ Werewolf the Game Wiki แต่มี house rule ที่ผู้พัฒนาเกมนี้กำหนดเอง:

- Host สามารถเป็น Player ได้
- ตายจากการโหวตหรือกลางคืน **ไม่เปิดเผย Role**
- กลางวันใช้ Hidden Ballot 2 รอบ: เสนอชื่อ → แก้ตัว 60 วิ → ยืนยัน `เอาออก / ไม่เอาออก`
- คะแนนเท่ากันในรอบยืนยัน = ผู้ถูกเสนอชื่อรอด
- Prince ใช้ **No-Reveal variant**: ถ้าพลังช่วยจากการโหวต ระบบยกเลิกการกำจัดโดยไม่บอกชื่อ Role

## Critical regressions fixed

- Restored full player multiplayer engine as `player-core-v3.js`
- `player-online.js` now waits for Firebase connection status before enabling Join
- Restored Hidden Ballot / Defense / Confirm Vote player states
- Restored Werewolf Pack Link / Silent Pack Vote / Quick Signal
- Restored restrictive Firebase Rules and hardened them further
- Added cache-busted JS entrypoints to reduce GitHub Pages stale-module problems
- Added `vote-flow-v3.js` to avoid falling back to the legacy one-stage Host vote

## Security rules fixed

- Night Action write is accepted only while that player's private turn is active and matches current phaseId
- Dead players cannot submit Night Actions or votes
- First ballot is immutable after first write
- First ballot cannot target yourself or a dead player
- Confirmation ballot is immutable after first write
- Pacifist can submit only `pardon`
- Villager Idiot can submit only `eliminate`
- Pack Link is night-only and limited to Werewolves in the active role phase
- Pack Signal cannot target self, dead player, or another Werewolf

**Firebase Console warning:** editing `firebase.rules.json` in GitHub does not publish Realtime Database Rules. Copy the latest file into Firebase Console → Realtime Database → Rules → Publish after every Rules update.

## Day vote v3

1. Host opens first vote
2. Each alive player votes once; vote is hidden and immutable
3. Host sees only submission count
4. Host closes round; ballots are revealed together
5. Mayor vote counts 2
6. Highest unique candidate enters 60-second defense
7. A first-round tie eliminates nobody
8. Host opens confirmation vote after defense timer ends
9. Each alive player chooses `เอาออก / ไม่เอาออก` once
10. Host closes round; individual choices are revealed together
11. Mayor counts 2; Pacifist is forced to pardon; Villager Idiot forced to eliminate
12. `eliminate > pardon` eliminates candidate; tie means survives
13. Role remains secret

## Core automation currently safe

The system can automate the basic mechanics for these without inventing a missing trigger:

- Villager / no-action roles
- Base Werewolf when all wolves use the same basic Werewolf role key
- Seer (including Lycan appearing as Werewolf)
- Bodyguard target restriction (no self, no same target two nights consecutively)
- Aura Seer basic/special result
- Witch basic one-use heal / one-use kill resources
- Cupid lover linking and lover death cascade
- Mason identity information
- Minion knowledge of actual Werewolves (patched by `rule-intel-v3.js`)
- Sorcerer finding Seer
- Mentalist same-team result using real team semantics rather than raw role category
- Mystic Seer exact role information, privately
- Mayor double vote
- Pacifist / Villager Idiot confirmation vote constraints
- Tanner immediate special victory when actually voted out by the v3 confirmation flow
- Standard Villager win when no actual Werewolves remain, and standard Werewolf win at parity, **only when no independent special-win role is present**

## Roles deliberately marked Host-check/manual

The UI now warns before starting a setup containing these roles because one or more triggers/effects are not yet fully resolved by the automatic engine:

- Spellcaster
- Drunk
- Priest
- P.I.
- Troublemaker
- Old Hag
- Apprentice Seer
- Hunter
- Disease
- Ghost
- Doppelganger / Doppelgänger
- Tough Guy
- Lone Wolf / The Lone Wolf
- Wolf Cub
- Cursed
- Alpha Wolf / Alpha Werewolf
- Hoodlum
- Vampire
- Cult Leader
- Revealer
- Huntress
- Mad Bomber
- Big Bad Wolf / Mystic Wolf / Omega Wolf and other wolf variants
- Poisoner
- Turncoat / Bloody Mary / Vengeful ghost / Chef / Enchantress / Arsonist / Thespian / Orphan / Guardian Angel
- Sheriff / Amnesiac and other house-rule roles

These roles still receive role cards, wake calls and target UI where applicable, but Host must apply the unresolved special effect according to the chosen variant.

## Known architectural limitation

This is a client-only GitHub Pages + Firebase Realtime Database app. The Host browser is the game engine and therefore currently has Firebase permission to read the private role subtree in order to route role turns and resolve information roles.

The normal Host UI hides other players' roles and Night answers, but a technically knowledgeable Host can inspect Firebase traffic/DevTools. A truly cheat-resistant Host-as-player design requires moving secret resolution to trusted server-side code (for example Cloud Functions / another trusted backend) so Host never receives the full secret state.

## Regression test matrix

Before calling a release stable, test with at least 3 independent browser sessions/devices:

### Connection
- Host creates room
- Player joins only after `ออนไลน์`
- refresh/rejoin preserves player identity sufficiently for the session
- invalid room displays `ไม่พบห้องนี้`

### Assignment/privacy
- role count must equal player count including Host
- Host receives one random role
- normal Host UI never lists other roles
- eliminated player role is never publicly displayed

### Night
- voice announces wake and sleep automatically
- first-night wolf no-kill option works when enabled
- only active role can submit action
- action after phase closes is rejected by Firebase Rules
- Bodyguard cannot self-target and cannot repeat previous protected target
- Seer result is private
- Werewolf Pack Link disappears outside active wolf night phase

### Day vote
- no ballot identity is visible before Host closes
- one player cannot overwrite a submitted ballot
- dead player cannot vote
- self-vote is rejected
- Mayor counts 2
- tie in first round causes no defense/elimination
- defense lasts 60 sec
- confirmation ballot remains hidden until closed
- Pacifist / Villager Idiot constraints are enforced server-side
- tie confirmation means candidate survives
- elimination never reveals role

### Win state
- basic game: all wolves dead → Villagers win
- basic game: wolves reach parity → Werewolves win
- setup with independent win condition → Win Guard warns Host instead of falsely auto-ending

## Next automation priorities

Recommended implementation order for full rule coverage:

1. Group all actual Werewolf variants into a single wolf wake/action phase
2. Cursed conversion on wolf attack
3. Disease skips the next wolf kill
4. Tough Guy delayed death
5. Wolf Cub enables two wolf victims next night
6. Hunter immediate revenge target
7. Apprentice Seer takeover
8. Doppelganger role inheritance
9. Priest/Huntress one-use enforcement
10. Troublemaker two-elimination day flow
11. Old Hag exile state
12. Vampire / Cult Leader / Hoodlum / Lone Wolf special win-state engines
13. Mad Bomber neighbor deaths (requires stable seating order)

Do not silently approximate these effects. If the engine cannot guarantee the selected variant, keep the Role marked Host-check.
