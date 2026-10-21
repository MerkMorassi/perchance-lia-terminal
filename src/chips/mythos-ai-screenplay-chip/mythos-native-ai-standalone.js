"use strict";

window.MythosChronicleEngine = (function() {
  var activeSlotId = "screenplay_lore_draft";
  var tailscaleServerIp = "127.0.0.1";
  var formatCycle = ["action", "scene", "character", "dialogue"];
  var dbInstance = null;
  var perchanceAiGenerator = null;

  function updateStatus(message) {
    var el = document.getElementById("mythos-status");
    if (el) el.innerText = "🔍 Status: " + message;
  }

  function cleanHtmlContent(text) {
    return text.replace(/&nbsp;/g, " ").replace(/<[^>]*>/g, "").trim();
  }

  function extractFountainTextStream() {
    var canvas = document.getElementById("mythos-editable");
    if (!canvas) return "";
    var paragraphs = canvas.querySelectorAll("p");
    var fountainStream = [];
    paragraphs.forEach(function(p) {
      var type = p.getAttribute("data-type") || "action";
      var rawContent = cleanHtmlContent(p.innerHTML);
      if (!rawContent) return;
      if (type === "scene") {
        fountainStream.push(/^(INT|EXT|INT\.EXT|EXT\.INT)\b/i.test(rawContent) ? rawContent.toUpperCase() : "." + rawContent.toUpperCase());
        fountainStream.push("");
      } else if (type === "character") {
        fountainStream.push(rawContent.toUpperCase());
      } else if (type === "dialogue") {
        fountainStream.push(rawContent);
        fountainStream.push("");
      } else {
        fountainStream.push(rawContent);
        fountainStream.push("");
      }
    });
    return fountainStream.join("\n");
  }

  function runMetricsEngine() {
    var el = document.getElementById("mythos-editable");
    var display = document.getElementById("mythos-metrics");
    if (!el || !display) return;
    var text = el.innerText || "";
    display.innerText = "🗒️ Metrics: " + text.trim().length + " chars";
  }

  function appendChronicleEvent(eventType, message) {
    var ts = Date.now();
    var isoDate = new Date(ts).toISOString();
    var logEntry = { ts: ts, isoDate: isoDate, eventType: eventType, message: message };

    var streamPanel = document.getElementById("mythos-chronicle-stream");
    if (streamPanel) {
      var entryNode = document.createElement("div");
      entryNode.style.borderBottom = "1px dashed #e5e7eb";
      entryNode.style.paddingBottom = "4px";
      entryNode.innerHTML = "<b style='color:#2563eb;'>[" + eventType + "]</b><br>" + message;
      streamPanel.appendChild(entryNode);
      streamPanel.scrollTop = streamPanel.scrollHeight;
    }

    if (dbInstance) {
      try {
        var tx = dbInstance.transaction(["script_chronicle"], "readwrite");
        tx.objectStore("script_chronicle").put(logEntry);
      } catch (err) {}
    }

    fetch("http://" + tailscaleServerIp + ":3333/api/v1/webhook/append-chronicle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: activeSlotId, entry: logEntry })
    }).catch(function() {});
  }

  function initializeIndexedDB(callback) {
    var request = window.indexedDB.open("MythosStorageCore", 2);
    request.onupgradeneeded = function(e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains("document_ledger")) {
        db.createObjectStore("document_ledger", { keyPath: "documentId" });
      }
      if (!db.objectStoreNames.contains("script_chronicle")) {
        db.createObjectStore("script_chronicle", { keyPath: "ts" });
      }
    };
    request.onsuccess = function(e) {
      dbInstance = e.target.result;
      updateStatus("✅ Workspace Core Active");
      callback();
    };
    request.onerror = function() {
      updateStatus("STORE REFUSED (500) :: DATABASE CORE STORAGE OFFLINE");
      callback();
    };
  }

  return {
    client: function(opts) {
      var o = opts || {};
      if (o.slot) activeSlotId = o.slot;
      if (o.tailscaleIp) tailscaleServerIp = o.tailscaleIp;
      if (o.aiPluginInstance) perchanceAiGenerator = o.aiPluginInstance;

      initializeIndexedDB(function() {
        document.getElementById("mythos-btn-scene").onclick = function() { window.MythosChronicleEngine.setFormat("scene"); };
        document.getElementById("mythos-btn-action").onclick = function() { window.MythosChronicleEngine.setFormat("action"); };
        document.getElementById("mythos-btn-character").onclick = function() { window.MythosChronicleEngine.setFormat("character"); };
        document.getElementById("mythos-btn-dialogue").onclick = function() { window.MythosChronicleEngine.setFormat("dialogue"); };
        document.getElementById("mythos-btn-native-ai").onclick = function() { window.MythosChronicleEngine.triggerAiLine(); };
        document.getElementById("mythos-save").onclick = function() { window.MythosChronicleEngine.saveAndSync(); };
        
        document.getElementById("mythos-editable").addEventListener("keydown", function(e) {
          if (e.key === "Tab") {
            e.preventDefault();
            var sel = window.getSelection();
            if (!sel.rangeCount) return;
            var node = sel.getRangeAt(0).startContainer;
            while (node && node.nodeName !== "P" && node.id !== "mythos-editable") { node = node.parentNode; }
            if (node && node.nodeName === "P") {
              var curType = node.getAttribute("data-type") || "action";
              var nextIndex = (formatCycle.indexOf(curType) + 1) % formatCycle.length;
              window.MythosChronicleEngine.setFormat(formatCycle[nextIndex]);
            }
          }
        });

        window.addEventListener("keydown", function(e) {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
            e.preventDefault();
            window.MythosChronicleEngine.saveAndSync();
          }
        });

        runMetricsEngine();
        appendChronicleEvent("SESSION_START", "Initialized screenplay console for draft: " + activeSlotId);
      });
    },
    setFormat: function(type) {
      var selection = window.getSelection();
      if (!selection.rangeCount) return;
      var node = selection.getRangeAt(0).startContainer;
      while (node && node.nodeName !== "P" && node.id !== "mythos-editable") { node = node.parentNode; }
      if (node && node.nodeName === "P") {
        node.setAttribute("data-type", type);
        node.style.textTransform = (type === "scene" || type === "character") ? "uppercase" : "none";
        appendChronicleEvent("STYLE_CYCLE", "Swapped paragraph constraint to: " + type.toUpperCase());
        runMetricsEngine();
        document.getElementById("mythos-editable").focus();
      }
    },
    triggerAiLine: async function() {
      var generator = perchanceAiGenerator || window.aiText || (window.parent && window.parent.aiText);
      if (!generator) {
        updateStatus("❌ REJECTION - MISSING NATIVE PERCHANCE ai-text LINKAGE");
        return;
      }
      var context = extractFountainTextStream();
      updateStatus("🤖 Running native plugin inference loops...");
      appendChronicleEvent("AI_REQUEST", "Piped text mass context to native platform generator plugin");

      try {
        var res = await generator({
          prompt: "Continue the following screenplay, outputting exactly one sentence of next dialogue. Script Context:\n" + context,
          maxTokens: 50
        });
        if (res && res.trim()) {
          var canvas = document.getElementById("mythos-editable");
          var p = document.createElement("p");
          p.setAttribute("data-type", "dialogue");
          p.innerText = res.trim();
          canvas.appendChild(p);
          updateStatus("✅ Line generated cleanly");
          appendChronicleEvent("AI_RESPONSE", "Inserted generated dialogue line: " + res.trim());
          runMetricsEngine();
        }
      } catch(err) {
        updateStatus("STORE REFUSED (502) :: NATIVE AI TIMEOUT");
      }
    },
    saveAndSync: function() {
      var canvas = document.getElementById("mythos-editable");
      if (!canvas) return;
      var fountainDump = extractFountainTextStream();
      var record = { documentId: activeSlotId, sanitizedContent: canvas.innerHTML, ts: Date.now() };

      if (dbInstance) {
        var tx = dbInstance.transaction(["document_ledger"], "readwrite");
        tx.objectStore("document_ledger").put(record);
      }

      appendChronicleEvent("MANUAL_SAVE", "Committed draft update to storage ledger (" + fountainDump.length + " bytes)");

      fetch("http://" + tailscaleServerIp + ":3333/api/v1/webhook/sync-fountain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: activeSlotId, fountainStream: fountainDump })
      })
      .then(function() { updateStatus("Pipeline Synchronized Securely -> Z:\\MYTHOS-SERVER"); })
      .catch(function() { updateStatus("⚠️ Saved Locally Only (Local Sync Server Offline)"); });
    },
    metrics: function() {
      runMetricsEngine();
    }
  };
})();