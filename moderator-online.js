// Host entrypoint v3: keep the automatic night engine and layer the audited day-vote flow on top.
await import("./host-player-v2.js?v=20260814-audit1");
await import("./vote-flow-v3.js?v=20260814-audit1");
