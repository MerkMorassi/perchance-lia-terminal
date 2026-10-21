CHATLOG FAN-OUT PATCH — CREATIVE-FIRE-MEDIA
Applies against repo root (files listed repo-relative).
Copy these 6 files over yours, restart the node server.

WHAT IT DOES
- Automation master switch (ragEnabled) = ARM. While ON, every finished
  agent-chat turn fans out to ALL armed lanes; while OFF, nothing fires.
- Lanes (each fires only if configured = "switched on"):
  1. BROWSER — appended to localStorage mythos_chatlog_v1 (cap 500).
  2. STUDIO — POST to your Localhost RAG URL with /api/rag rewritten to
     /api/chatlog (new server endpoint below). Only if URL is set.
  3. CLOUD — POST to ragBaseUrl {apiKey, boxId, entry}. Only if key+URL+box set.
  4. EVENT WEBHOOKS — POST the turn to every listed webhook URL.
- Retrieval is unchanged: the provider radio still picks the READ lane.
  Writes fan out; reads stay single-lane.
- Fail-soft: 8s POST timeout, Promise.allSettled, try/catch at call site.
  Chat rendering never depends on the fan-out.

SERVER (server.js)
- POST /api/chatlog ingests {agentId, projectId, user, model, at},
  appends to chatlog.json (cap 5000, restored at boot like the vaults).

CLIENT
- services/chatlogFanout.ts (NEW): fanoutChatTurn() + testWebhook().
- components/AgentChatView.tsx: handleTurnComplete calls fanoutChatTurn()
  (covers AgentChatStudio too — it wraps AgentChatView; deps fixed to [agent.id]).
- App.tsx: Automation Test button now really POSTs {type:'webhook.test'}
  instead of stubbed true.
- components/AutomationStudio.tsx: header notes fan-out semantics.
- service-worker.js: caches the new service.

TRY IT
1. Automation → master switch ON, add a webhook URL (https://webhook.site),
   set Studio URL to http://localhost:4000/api/rag.
2. Agent Chat → send a message → webhook.site receives {type:'chatlog.turn'…},
   server log shows nothing (ingest is silent) but chatlog.json grows.
