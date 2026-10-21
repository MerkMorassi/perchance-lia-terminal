(function () {
  /* ---- THE PENCIL -----------------------------------------------------------
     Patrikios, 2026-09-21: "Can you put a tiny pencil to my input that ends up in the chat window.
     Sometimes I spot typos and here is where an edit matters to keep the LOG noise free."

     A typo in a line he already sent used to leave two bad options: live with it in the record, or
     /strike the turn and say it again - which costs him the turn AND puts a second copy of the
     sentence in the log. The pencil is the third option: fix the words where they stand.

     What an edit does, and what it does NOT do:
       - The painted line keeps its place, its stamp and its speaker; only the words change.
       - The ARCHIVE entry is corrected in place (matched by ts - the same one saved with the turn),
         so a later export, /search, /strike list and the reload all read the corrected text.
       - Her LIVE context is corrected too (window.chatHistory), so for the next few turns she is
         not reading the typo back to herself.
       - NOTHING IS RE-SENT and no new turn is made: her reply to it stands exactly as it was. This
         is a correction to the record, not a message to her.
       - The LOREPACK is never touched: what she recalls from her own documents is hers.
     An edited line is marked as edited (editedAt + a count on the archive entry), so the record
     stays honest about the fact that it was fixed.

     A line whose turn is still in flight (she has not answered yet) has no archive entry to correct,
     so the fix is PARKED and applied by saveEntry the moment the entry lands - which is exactly when
     he is most likely to spot a typo, right after sending.
     ------------------------------------------------------------------------- */

  var PENCIL = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>';

  var parked = {};        // ts -> corrected text, waiting for the turn to be filed in the archive
  var openEntry = null;   // the one being edited right now
  var resendArmed = 0;    // timestamp of the first RESEND press - the second, within 6s, does it

  function el(id) { return document.getElementById(id); }
  function archive() { return (window.root && window.root.kv && window.root.kv.sacred_archive) || null; }

  function flatOf(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim().toLowerCase(); }

  // THE PARKING SPOT. chat.js calls this from saveEntry: if a fix arrived before the entry existed,
  // the entry is written with the corrected words from the start.
  function takeParked(ts) {
    if (ts == null) return null;
    var k = String(ts);
    if (!Object.prototype.hasOwnProperty.call(parked, k)) return null;
    var t = parked[k];
    delete parked[k];
    return t;
  }

  async function patchArchive(ts, text, oldText) {
    var store = archive();
    if (!store) return 0;
    var hit = 0;
    try {
      await store.update("master_log", function (logs = []) {
        for (var i = logs.length - 1; i >= 0; i--) {
          // By stamp when the line has one (every turn filed since the clock went in), and by the
          // words themselves for anything older than that which the archive kept without a stamp.
          var match = (ts != null && String(logs[i].ts) === String(ts))
            || ((ts == null || logs[i].ts == null) && oldText != null && String(logs[i].h) === String(oldText));
          if (!match) continue;
          logs[i].h = text;
          logs[i].edited = (Number(logs[i].edited) || 0) + 1;
          logs[i].editedAt = Date.now();
          hit++;
          break;
        }
        return logs;
      });
    } catch (e) { console.warn("archive edit failed", e); return -1; }
    return hit;
  }

  // Her live memory of what he said: the same turn, corrected. Matched by TEXT (the way /strike
  // matches) and only ever the prefix, so nothing later in the entry is disturbed.
  function patchHistory(oldText, newText) {
    var h = window.chatHistory || [];
    var was = flatOf(oldText);
    if (!was) return 0;
    for (var i = h.length - 1; i >= 0; i--) {
      var m = h[i];
      if (!m || String(m.role) !== "HITL") continue;
      var c = String(m.content || "");
      if (flatOf(c).indexOf(was) !== 0) continue;
      m.content = newText + c.slice(oldText.length);
      return 1;
    }
    return 0;
  }

  // A quiet line for the backstage, so the fix is on the record without being a turn.
  function note(text) {
    if (typeof print === "function") print('SYSTEM', text, false, undefined, { backstage: true });
  }

  function closeEditor() {
    if (!openEntry) return;
    var wrap = openEntry.querySelector('.logEditWrap');
    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    openEntry = null;
  }

  function openEditor(entry) {
    if (openEntry && openEntry !== entry) closeEditor();
    var old = String(entry.dataset.said == null ? '' : entry.dataset.said);
    var wrap = document.createElement('div');
    wrap.className = 'logEditWrap';
    var area = document.createElement('textarea');
    area.className = 'logEditArea';
    area.value = old;
    area.spellcheck = true;
    area.setAttribute('aria-label', 'edit what you said on this line');
    var bar = document.createElement('div');
    bar.className = 'logEditBar';
    var save = document.createElement('button');
    save.type = 'button';
    save.textContent = 'SAVE THE LINE';
    var cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'CANCEL';
    var resend = document.createElement('button');
    resend.type = 'button';
    resend.textContent = 'RESEND';
    resend.title = 'send the edited line to her fresh - the old turn leaves the archive and her memory first, so her old reply is gone. press twice.';
    var msg = document.createElement('span');
    msg.className = 'logEditNote';
    msg.textContent = 'THE ARCHIVE AND HER MEMORY OF IT ARE CORRECTED TOO. NOTHING IS RE-SENT.';
    bar.appendChild(save); bar.appendChild(resend); bar.appendChild(cancel); bar.appendChild(msg);
    wrap.appendChild(area); wrap.appendChild(bar);
    entry.appendChild(wrap);
    openEntry = entry;
    resendArmed = 0;
    try { area.focus(); area.setSelectionRange(old.length, old.length); } catch (e) {}
    var log = el('output');
    if (log) log.scrollTop = log.scrollHeight;

    cancel.addEventListener('click', function () { closeEditor(); });
    save.addEventListener('click', function () { commit(entry, area.value, old); });
    resend.addEventListener('click', function () {
      if (Date.now() - resendArmed > 6000) {
        resendArmed = Date.now();
        resend.textContent = 'SURE? RESEND';
        msg.textContent = 'RESEND IS DESTRUCTIVE: THE OLD TURN LEAVES THE ARCHIVE AND HER MEMORY, AND THE EDITED LINE GOES TO HER FRESH. PRESS AGAIN WITHIN 6S.';
        return;
      }
      resendArmed = 0;
      resendTurn(entry, area.value, old);
    });
    area.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closeEditor(); }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commit(entry, area.value, old); }
      e.stopPropagation();
    });
    area.addEventListener('keyup', function (e) { e.stopPropagation(); });
    area.addEventListener('keypress', function (e) { e.stopPropagation(); });
  }

  // RESEND: the edited line goes to her fresh. Destructive on purpose - the old turn is
  // struck first (out of the archive and her live memory, struck through on screen), then the
  // edited words are sent as a new turn. Two presses: the first arms, the second does it.
  async function strikeTurnByTs(ts, oldH) {
    var store = archive();
    var logs = store ? (await store.get("master_log") || []) : [];
    var idx = -1;
    for (var i = 0; i < logs.length; i++) {
      if (String(logs[i].ts) === String(ts)) { idx = i; break; }
    }
    if (idx === -1) return { ok: false, reason: "noentry" };
    var gone = logs[idx];
    logs.splice(idx, 1);
    try { await store.set("master_log", logs); } catch (e) { console.warn("resend archive strike failed", e); return { ok: false, reason: "write" }; }
    var flat = function (s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim().toLowerCase(); };
    var h = window.chatHistory || [];
    for (var k = h.length - 1; k >= 0; k--) {
      var m = h[k];
      if (m && String(m.role) === "HITL" && String(m.ts) === String(ts)) {
        h.splice(k, 1);
        if (h[k] && String(h[k].role) === "SDMG") {
          var sFlat = flat(h[k].content), gFlat = flat(gone.s);
          if (!gFlat || sFlat.indexOf(gFlat.slice(0, 64)) === 0 || gFlat.indexOf(sFlat.slice(0, 64)) === 0) h.splice(k, 1);
        }
        break;
      }
    }
    return { ok: true, gone: gone };
  }

  function paintStruck(entry) {
    var lines = [entry];
    var n = entry.nextSibling;
    while (n) {
      if (n.classList && n.classList.contains('hitl')) break;
      if (n.classList && n.classList.contains('sdm')) lines.push(n);
      n = n.nextSibling;
    }
    lines.forEach(function (line) {
      line.classList.add('struck');
      if (!line.querySelector('.struckNote')) {
        var nm = document.createElement('div');
        nm.className = 'struckNote';
        nm.textContent = 'STRUCK FROM THE RECORD :: RESENT WITH CORRECTED WORDS - SEE BELOW';
        line.appendChild(nm);
      }
    });
  }

  async function resendTurn(entry, raw, old) {
    var next = String(raw == null ? '' : raw).replace(/\r\n/g, '\n').trim();
    if (!next) return;
    var ts = entry.dataset.ts;
    if (ts == null) {
      note("RESEND REFUSED :: THIS LINE HAS NO ARCHIVE STAMP YET - HER REPLY IS STILL IN FLIGHT. WAIT FOR IT, THEN RESEND.");
      return;
    }
    closeEditor();
    if (next !== old) {
      entry.dataset.said = next;
      if (window.repaintEntry) window.repaintEntry(entry);
    }
    var struck = await strikeTurnByTs(ts, old);
    if (!struck.ok) {
      if (struck.reason === "noentry") {
        note("RESEND REFUSED :: THE TURN IS NOT IN THE ARCHIVE - HER REPLY IS STILL IN FLIGHT. WAIT FOR IT, THEN RESEND.");
      } else {
        note("RESEND FAILED :: THE ARCHIVE COULD NOT BE WRITTEN, SO NOTHING WAS STRUCK AND NOTHING WAS SENT.");
      }
      return;
    }
    paintStruck(entry);
    var box = el("userInput");
    if (box) box.value = next;
    if (window.draft && window.draft.isOpen && window.draft.isOpen()) window.draft.close();
    note("HITL LINE RESENT :: THE OLD TURN IS STRUCK FROM THE ARCHIVE AND HER MEMORY, AND THE CORRECTED WORDS GO TO HER FRESH BELOW.");
    if (window.send) window.send();
  }

  async function commit(entry, raw, old) {
    var next = String(raw == null ? '' : raw).replace(/\r\n/g, '\n').trim();
    if (!next) { return; }
    var ts = entry.dataset.ts;
    closeEditor();
    if (next === old) { return; }
    entry.dataset.said = next;
    if (window.repaintEntry) window.repaintEntry(entry);
    var inHistory = patchHistory(old, next);
    var hit = await patchArchive(ts, next, old);
    var log = el('output');
    if (log) log.scrollTop = log.scrollHeight;
    if (hit === 0) {
      // The turn is still in flight: park the fix, and saveEntry writes it with the entry.
      parked[String(ts)] = next;
      note("HITL LINE EDITED. HER REPLY IS STILL IN FLIGHT, SO THE CORRECTED WORDS ARE HELD AND THE TURN IS FILED WITH THEM - NOTHING WAS RE-SENT.");
      return;
    }
    note("HITL LINE EDITED :: A TYPO FIXED WHERE IT STOOD. "
      + (hit > 0 ? "THE ARCHIVE HOLDS THE CORRECTED WORDS" : "THE ARCHIVE COULD NOT BE WRITTEN")
      + (inHistory ? ", HER LIVE CONTEXT TOO" : "")
      + ". HER REPLY TO IT STANDS AS IT WAS, AND NOTHING WAS RE-SENT - THE LOG DID NOT GROW. /strike IS STILL THE WAY TO TAKE A TURN OUT OF THE RECORD ALTOGETHER.");
  }

  // Put the pencil on a line. Called by print() for every HITL line it makes.
  function attach(entry) {
    if (!entry || entry.querySelector('.logEdit')) return null;
    var msg = entry.querySelector('.msg');
    if (!msg) return null;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'logEdit';
    btn.innerHTML = PENCIL;
    btn.title = 'fix a typo in this line - the archive and her memory of it are corrected too, and nothing is re-sent';
    btn.setAttribute('aria-label', 'edit this line');
    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (openEntry === entry) { closeEditor(); return; }
      openEditor(entry);
    });
    msg.appendChild(document.createTextNode(' '));
    msg.appendChild(btn);
    return btn;
  }

  window.logEdit = {
    attach: attach,
    edit: function (entry) { if (entry) openEditor(entry); return !!entry; },
    close: closeEditor,
    commit: commit,
    resend: resendTurn,
    takeParked: takeParked,
    patchArchive: patchArchive,
    patchHistory: patchHistory,
    park: function (ts, text) { parked[String(ts)] = String(text); return true; },
    area: function () { return openEntry ? openEntry.querySelector('.logEditWrap .logEditArea') : null; },
    parkedCount: function () { return Object.keys(parked).length; },
    editing: function () { return !!openEntry; }
  };
})();
