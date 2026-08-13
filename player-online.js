// Cache-busted player entrypoint. Bump PLAYER_BUILD whenever player-v2.js changes.
const PLAYER_BUILD = "20260813-1616-firebase-fix";
await import(`./player-v2.js?v=${PLAYER_BUILD}`);
