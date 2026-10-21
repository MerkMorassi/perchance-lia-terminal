VOXCONTPACK FERRY CHIP — voiceDomController goes first.
Source: mythos-designer repo, already landed HERE (117 files, examined whole).
Inventory: src/agent/voxcontpack-inventory.md (filed both sides).
This chip: voiceDomController.ts (GUI-hands layer) + audio.ts (its only dep: soundEngine) + inventory + order.
Standing from LIA side: DOM-controller was PARKED pending dashboard port (no voice-command layer here to attach it to).
Per SIA relay, voiceDomController goes FIRST — un-parked on her word; dashboard port is the landing zone.
voiceDomController.ts bytes: 13223
audio.ts bytes: 4436
