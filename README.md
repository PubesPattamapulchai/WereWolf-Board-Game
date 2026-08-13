# Werewolf Connected Game

ชุดเว็บ 2 ฝั่งที่ใช้คู่กัน:

- `index.html` — **Host / Game Controller**
- `player.html` — **Player Companion**
- `firebase-config.js` — Firebase project config
- `firebase.rules.json` — Realtime Database Security Rules
- `moderator-online.js` / `player-online.js` — ระบบเชื่อมแบบ realtime
- `game-rules.js` — กติกาการเลือกเป้าหมายแบบย่อ

## Flow การเล่น

1. Host เปิด `index.html` และสามารถเลือก **เล่นด้วย** ได้
2. ตั้ง Role ให้จำนวนเท่ากับจำนวนผู้เล่นทั้งหมด รวม Host ถ้า Host เล่นด้วย
3. กด **สร้างห้องออนไลน์**
4. ผู้เล่นเปิด `player.html` และใส่ Room Code หรือใช้ลิงก์จาก Host
5. เมื่อผู้เล่นครบ Host กด **สุ่มแจก Role**
6. ผู้เล่นแต่ละคนดู Role ลับของตัวเอง
7. Host กดเริ่ม Night หนึ่งครั้ง จากนั้นระบบเรียก Role ด้วยเสียงและไล่ Night Order อัตโนมัติ
8. ผู้เล่นที่ถึงคิวส่ง Night Action จากหน้า Player
9. จบ Night แล้วเข้าสู่ช่วงกลางวันและการโหวต

## Day Vote Flow

ระบบใช้ Hidden Ballot ทั้งสองรอบ:

1. Host กด **เริ่มโหวตรอบแรก**
2. ผู้เล่นทุกคนเลือกคนที่ต้องการเสนอให้ออกจากเกม
3. หลังผู้เล่นกดส่ง คะแนนจะถูกล็อกและแก้ไม่ได้
4. ระหว่างรอบไม่มีใคร รวมถึง Host เห็นว่าใครเลือกใคร เห็นเพียงจำนวนคนที่ส่งแล้ว
5. Host กด **ปิดโหวตและเปิดผล**
6. ระบบจึงเปิดพร้อมกันว่าใครโหวตใคร และหาคนคะแนนสูงสุด
7. ถ้าคะแนนสูงสุดไม่เสมอ ผู้เล่นคนนั้นเข้าสู่ **ช่วงแก้ตัว 60 วินาที**
8. เมื่อหมดเวลา Host กด **เปิดโหวตรอบยืนยัน**
9. ผู้เล่นทุกคนเลือก `เอาออก` หรือ `ไม่เอาออก` แบบ Hidden Ballot และคำตอบถูกล็อกหลังส่ง
10. Host กด **ปิดโหวตและเปิดผล** แล้วระบบจึงเปิดพร้อมกันว่าใครเลือก `เอาออก / ไม่เอาออก`
11. ถ้า `เอาออก > ไม่เอาออก` ผู้เล่นคนนั้นถูกกำจัด
12. ถ้า `ไม่เอาออก >= เอาออก` ผู้เล่นคนนั้นรอด
13. ไม่ว่าผลใด **Role ของผู้ถูกกำจัดจะไม่ถูกเปิดเผย**

Security Rules บังคับให้ผู้เล่นเขียนคะแนนได้ครั้งเดียวต่อรอบ และ Host อ่าน ballot จริงได้เฉพาะหลังปิดรอบแล้ว

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

### 4. Firebase Config

โปรเจกต์นี้ตั้งค่าไว้กับ:

- Project ID: `werewolf-board-game-9b361`
- Realtime Database region: `asia-southeast1`

### 5. Security Rules

เปิด Firebase Console → Realtime Database → Rules แล้วคัดลอกเนื้อหาจาก `firebase.rules.json` ไปวางและกด **Publish**

> ทุกครั้งที่ `firebase.rules.json` ใน GitHub ถูกอัปเดต ต้อง Publish Rules เวอร์ชันล่าสุดใน Firebase Console ด้วย

## Deploy GitHub Pages

GitHub → **Settings → Pages → Deploy from a branch → main → /(root)**

- Host: `https://YOURNAME.github.io/REPO/`
- Player: `https://YOURNAME.github.io/REPO/player.html`

## Night Action Examples

- Werewolf → เลือก 1 คน
- Seer → เช็ค 1 คน
- Bodyguard → ป้องกัน 1 คน
- Cupid → เลือก 2 คน
- Mentalist → เลือก 2 คน
- Role ที่ไม่ต้องเลือกเป้าหมาย → ปุ่ม “เสร็จแล้ว”

Role ที่มีกติกาหลาย Variant ยังให้ระบบรองรับ house rule โดยไม่ล็อกทุกความสามารถตายตัว

## No Role Reveal Rule

- ถูกโหวตออก → แสดงเพียงว่า `ถูกโหวตออก`
- โดนหมาป่ากำจัด → แสดงเพียงว่า `โดนหมาป่ากำจัด`
- ไม่มีการประกาศหรือแสดง Role หลังถูกกำจัด
- Role ยังคงเป็นข้อมูล private ของผู้เล่น
- ผู้เล่นที่ถูกกำจัดจะไม่ถูกเรียกทำ Night Action ต่อ

## Security

อย่าใช้ Realtime Database แบบ public test rules ในเว็บจริง

`firebase.rules.json` ใช้ Firebase Authentication `uid` เพื่อจำกัด Role, Night Action และ ballot ของผู้เล่น รวมถึงล็อก Hidden Ballot ไม่ให้ Host อ่านก่อนปิดรอบ
