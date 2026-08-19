# Shared Firebase Realtime Database Rules

This repository is the single source of truth for Firebase Realtime Database Security Rules used by all three games:

- WereWolf-Board-Game
- Insider
- SpyFall

All three games use Firebase project `werewolf-board-game-9b361` and the shared `rooms/{roomCode}` tree.

## Rule source

Edit only:

`firebase.rules.json`

Do not copy rules between game repositories and do not maintain separate rule files in Insider or SpyFall.

## Deployment

`firebase.json` points Realtime Database at `firebase.rules.json`, and `.firebaserc` points the Firebase CLI at `werewolf-board-game-9b361`.

A GitHub Actions workflow automatically deploys the rules whenever `firebase.rules.json`, `firebase.json`, or `.firebaserc` changes on `main`.

The repository must contain this GitHub Actions secret:

`FIREBASE_SERVICE_ACCOUNT_WEREWOLF_BOARD_GAME_9B361`

Its value must be a Google service-account JSON credential that has permission to deploy Firebase Realtime Database rules for project `werewolf-board-game-9b361`.

Manual fallback:

```bash
firebase deploy --only database --project werewolf-board-game-9b361
```

## Game separation

The shared rules distinguish game-specific paths using `rooms/{roomCode}/public/gameType` where available:

- `spyfall` for SpyFall
- `insider-lite` for Insider
- Werewolf currently keeps backward compatibility with rooms where `gameType` is absent, while also allowing an explicit `werewolf` value in the existing rule conditions.

When adding another game, extend this single rule file instead of creating another copy.
