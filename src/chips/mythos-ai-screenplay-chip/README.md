# MYTHOS-NATIVE-AI-CHRONICLE - Warner Bros standard formatting chip featuring native Perchance AI integration and append-only repository log loops

Origin: Ported from `scratch/mythos-chronicle-chip` optimizing platform engine structures. Proven live in browser sandboxes 2026-10-04. Built to CHIP SPEC v1.

## use
Ensure you register the macro definition at the top level of your Perchance template project workspace:
```text
aiText = {import:ai-text-plugin}
```

Then mount the application logic cleanly:
```html
<div id="mythos-root"></div>
<script src="./mythos-native-ai-standalone.js"></script>
<script>
  window.MythosChronicleEngine.client({
    slot: "perchance_screenplay_draft",
    tailscaleIp: "100.X.Y.Z", // Desktop static Tailscale IPv4 address parameter
    aiPluginInstance: aiText  // Native Perchance ai-text plugin instance mapping
  });
</script>
```

## protocol
- Append-Only Logic: Commits incremental log operations to local transaction tables inside IndexedDB, concurrently executing outbound webhook streams across your active Tailscale layer.
- Warner Bros Constraints: Automatically structures elements using explicit standard typewriter layout rules.