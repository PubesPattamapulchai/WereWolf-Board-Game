# Werewolf Connected Game

อัปเกรดล่าสุดด้าน UI/UX:

- ปรับธีมภาพรวมให้เป็นแนว **fantasy card / board game** มากขึ้น
- แยกโทนสีของแต่ละฝั่งชัดเจน: **Villagers / Werewolves / Neutral / Additional**
- รายการ Role, Night Order และหน้าการ์ดของผู้เล่นมี **crest / badge / card-style visuals** เพื่ออ่านง่ายขึ้น
- หน้าผู้เล่นมี **Role card แบบใหม่** ที่เปลี่ยนหน้าตาตามฝ่ายของ Role อัตโนมัติ
- ใช้กราฟิกที่ออกแบบขึ้นใหม่ในโค้ดเอง เพื่อหลีกเลี่ยงปัญหาลิขสิทธิ์ของการ์ดทางการ

ชุดเว็บ 2 ฝั่งที่ใช้คู่กัน:

- `index.html` — **Moderator**
- `player.html` — **Player Companion**
- `firebase-config.js` — Firebase project config
- `firebase.rules.json` — Realtime Database Security Rules
- `moderator-online.js` / `player-online.js` — ระบบเชื่อมแบบ realtime
- `game-rules.js` — กติกาการเลือกเป้าหมายแบบย่อ

## Flow การเล่น

1. Moderator เปิด `index.html`
2. ตั้ง Role ให้จำนวน **เท่ากับจำนวนผู้เล่น** (Role ซ้ำได้)
3. กด **สร้างห้องออนไลน์**
4. ผู้เล่นเปิด `player.html` และใส่ Room Code หรือใช้ลิงก์ที่ Moderator คัดลอกให้
5. เมื่อผู้เล่นครบ Moderator กด **สุ่มแจก Role**
6. ผู้เล่นแต่ละคนแตะดู Role ลับของตัวเอง
7. Moderator เริ่ม Night Phase ตามปกติ
8. เมื่อ Role ใดถูกเรียก:
   - ผู้เล่น Role นั้นจะเห็นหน้าจอ Action
   - เลือกเป้าหมาย 1/2 คนตาม Role
   - ส่งคำตอบกลับ Moderator
   - ผู้เล่น Role อื่นเห็นเพียง “หลับตา”
9. Moderator เห็นคำตอบที่ส่งเข้ามาแบบ realtime ใต้ Timer
10. Moderator สามารถทำให้ผู้เล่น “ออกจากเกม/คืนเกม” จาก Online Room ได้

## ตั้งค่า Firebase

ระบบออนไลน์ใช้ Firebase Realtime Database และ Anonymous Authentication

### 1. สร้าง Firebase Project

ไป Firebase Console แล้วสร้าง Project และ Register Web App

Official setup:
https://firebase.google.com/docs/web/setup

### 2. เปิด Anonymous Authentication

Firebase Console → Authentication → Sign-in method → เปิด **Anonymous**

Official docs:
https://firebase.google.com/docs/auth/web/anonymous-auth

### 3. สร้าง Realtime Database

Firebase Console → Realtime Database → Create database

Official docs:
https://firebase.google.com/docs/database/web/start

### 4. ใส่ Firebase Config

เปิด `firebase-config.js` แล้วนำ config จาก Firebase มาแทน:

```js
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  databaseURL: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

`databaseURL` จำเป็นสำหรับ Realtime Database

### 5. ใส่ Security Rules

เปิด Firebase Console → Realtime Database → Rules

คัดลอกเนื้อหาจาก `firebase.rules.json` ไปวางแล้ว Publish

Rules ชุดนี้ออกแบบให้:
- ผู้เล่นอ่านข้อมูลสาธารณะของห้องได้
- ผู้เล่นแก้ได้เฉพาะชื่อ/สถานะการเชื่อมต่อของตัวเอง ส่วน alive/assigned ให้ Moderator คุม
- Role ลับอยู่ใน `private/<uid>` และผู้เล่นอ่านได้เฉพาะของตัวเอง
- Action ของผู้เล่นเขียนได้เฉพาะ uid ของตัวเอง
- Moderator (host uid) อ่านข้อมูล private/actions ทั้งห้องได้

## Deploy GitHub Pages

Upload ไฟล์ทั้งหมดใน ZIP ขึ้น repository เดียวกัน

GitHub:
**Settings → Pages → Deploy from a branch → main → /(root)**

จากนั้น:

- Moderator: `https://YOURNAME.github.io/REPO/`
- Player: `https://YOURNAME.github.io/REPO/player.html`

Moderator มีปุ่ม **คัดลอกลิงก์** ซึ่งจะใส่ Room Code ใน URL ให้ผู้เล่นอัตโนมัติ

## หมายเหตุเรื่องกติกา

ระบบ Player Companion ตั้ง target count พื้นฐานให้อัตโนมัติ เช่น:
- Werewolf → เลือก 1 คน
- Seer → เช็ค 1 คน
- Bodyguard → ป้องกัน 1 คน
- Cupid → เลือก 2 คน
- Mentalist → เลือก 2 คน
- Role ที่ไม่ต้องเลือกเป้าหมาย → ปุ่ม “เสร็จแล้ว”

Role ที่มีกติกาหลาย Variant ยังให้ Moderator เป็นผู้ตัดสินผลจริง เพื่อไม่ล็อกเว็บเข้ากับ house rule ใด house rule หนึ่ง

## Security

อย่าใช้ Realtime Database แบบ public test rules ในเว็บที่เผยแพร่จริง  
ไฟล์ `firebase.rules.json` ใช้ Firebase Authentication `uid` เพื่อจำกัดข้อมูล private ของผู้เล่น

Firebase Security Rules docs:
https://firebase.google.com/docs/database/security

## No Role Reveal Rule

ระบบนี้ใช้กติกา **No Reveal** โดยค่าเริ่มต้น:

- ถ้าผู้เล่นถูกโหวตออก → ทุกคนเห็นเฉพาะว่า `ถูกโหวตออก`
- ถ้าผู้เล่นโดนหมาป่ากำจัด → ทุกคนเห็นเฉพาะว่า `โดนหมาป่ากำจัด`
- **ไม่มีการประกาศหรือแสดง Role ของผู้เล่นที่ถูกกำจัด**
- Role ยังคงอยู่เฉพาะใน `private/<uid>` ของผู้เล่นคนนั้นและ Moderator
- public player list เก็บเฉพาะชื่อ, alive/dead state และสาเหตุการถูกกำจัด
- เมื่อผู้เล่นตาย ระบบจะยกเลิก Night Action ของคนนั้นทันที
- หน้า Player ที่ตายจะไม่กลับไปแสดงหน้าการ์ด Role อีกระหว่างเกม

Moderator มีปุ่มแยก `โหวตออก` และ `หมาป่าฆ่า` เพื่อบันทึกสาเหตุโดยไม่เผย Role

## Firebase Project ที่ใส่ไว้แล้ว

แพ็กเกจนี้ตั้งค่า Web App ให้ใช้ Firebase Project:

- Project ID: `werewolf-board-game-9b361`
- Realtime Database region: `asia-southeast1`

ไม่ต้องแก้ `firebase-config.js` เพิ่ม เว้นแต่ต้องการย้ายไป Firebase Project อื่น

ยังต้องตรวจใน Firebase Console ให้เรียบร้อยว่า:
1. Authentication → Anonymous = Enabled
2. Realtime Database ถูกสร้างแล้ว
3. Realtime Database Rules ใช้เนื้อหาจาก `firebase.rules.json`

## Premium Board-Game UI

เวอร์ชันนี้เพิ่ม presentation layer โดยไม่เปลี่ยน game rules:

- animated moonlight, stars และหมอกแบบ subtle
- faction sigils แบบ original SVG สำหรับ Villagers / Werewolves / Neutral / Additional
- Role reveal animation คล้ายพลิกการ์ด
- card depth, shine, hover/press feedback และ ripple
- Night Phase cinematic ambience + timer glow
- Pack/secret-team panels มี visual hierarchy ชัดขึ้น
- vote / defense / success states มี transition ที่อ่านสถานะง่ายขึ้น
- รองรับ `prefers-reduced-motion` เพื่อปิด animation หนักอัตโนมัติ

ไฟล์ presentation เพิ่มเติม:

- `premium-theme.css`
- `premium-effects.js`
- `assets/*-sigil.svg`

กราฟิกในชุดนี้เป็นงาน original ที่สร้างขึ้นสำหรับเว็บนี้ ไม่ได้ใช้ภาพการ์ดทางการของเกมอื่น
