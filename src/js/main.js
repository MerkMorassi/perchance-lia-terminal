  window.chatHistory = window.chatHistory || [];
  // HERS: what she has written down for herself is read once at startup, so the WANTS block is in
  // her prompt from the very first turn. Her kept memories are LOREPACK documents and arrive with
  // the LOREPACK itself (origin "hers"), so there is nothing to load for those.
  if (window.hers && window.hers.load) { try { window.hers.load(); } catch (e) { console.warn("her own keeping unreadable", e); } }
  window.loreSay = function (msg) { print('SYSTEM', msg); };
  // HOTKEY: ENTER TO SEND
  document.getElementById('userInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      window.send();
    }
  });
  document.addEventListener('paste', function (e) {
    var items = (e.clipboardData && e.clipboardData.items) ? Array.prototype.slice.call(e.clipboardData.items) : [];
    var files = [];
    items.forEach(function (it) {
      if (it.kind === 'file') { var f = it.getAsFile(); if (f) files.push(f); }
    });
    if (files.length) { e.preventDefault(); window.attach.add(files); }
  });

  document.addEventListener('dragover', function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    document.body.classList.add('dropping');
  });

  document.addEventListener('dragleave', function (e) {
    if (e.relatedTarget) return;
    document.body.classList.remove('dropping');
  });

  document.addEventListener('drop', function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    document.body.classList.remove('dropping');
    var all = Array.prototype.slice.call(e.dataTransfer.files || []);
    var packs = all.filter(isPackFile);
    var rest = all.filter(function (f) { return !isPackFile(f); });
    packs.forEach(function (f) {
      if (!window.mythos) { print('SYSTEM', 'MYTHOS READER OFFLINE.'); return; }
      print('SYSTEM', 'READING MYTHOS PACK :: ' + (f.name || 'pack') + ' (' + fmtSize(f.size || 0) + ')...');
      window.mythos.reportImport(f).then(function (t) { print('SYSTEM', t); }).catch(window.mythos.fail);
    });
    if (rest.length) window.attach.add(rest);
  });

  function isPackFile(f) {
    var n = (f && f.name) || '';
    if (/\.jsonl(\.gz)?$/i.test(n)) return true;
    return /\.gz$/i.test(n) && /mythos|lorepack/i.test(n);
  }

  document.getElementById('attachBtn').addEventListener('click', function () {
    document.getElementById('attachInput').click();
  });

  document.getElementById('attachInput').addEventListener('change', function (e) {
    if (window.attach) window.attach.add(e.target.files);
    e.target.value = '';
  });

  /* ---- system instructions panel ---- */
  // The panel is drawn by instr.js (blocks, roles, state); the wiring lives here with the
  // rest of the DOM. Every action saves first, so nothing typed into the editor is lost.

  document.getElementById('systemBtn').addEventListener('click', function () {
    if (window.instr) window.instr.toggle();
  });

  document.getElementById('spClose').addEventListener('click', function () { if (window.instr) window.instr.close(); });
  document.getElementById('spBlock').addEventListener('change', function () { if (window.instr) window.instr.select(this.value); });
  document.getElementById('spSave').addEventListener('click', function () { if (window.instr) window.instr.save(); });
  document.getElementById('spReset').addEventListener('click', function () { if (window.instr) window.instr.resetSelected(); });
  document.getElementById('spNewBlock').addEventListener('click', function () { if (window.instr) window.instr.showNewBlock(); });
  document.getElementById('spNewBlockGo').addEventListener('click', function () { if (window.instr) window.instr.createBlockFromForm(); });
  document.getElementById('spRole').addEventListener('change', function () { if (window.instr) window.instr.selectRole(this.value); });
  document.getElementById('spRoleDel').addEventListener('click', function () { if (window.instr) window.instr.removeSelectedRole(); });
  document.getElementById('spRoleEdit').addEventListener('click', function () { if (window.instr) window.instr.editRoleText(); });
  document.getElementById('spNewRole').addEventListener('click', function () { if (window.instr) window.instr.showNewRole(); });
  document.getElementById('spNewGo').addEventListener('click', function () { if (window.instr) window.instr.createRoleFromForm(); });
  document.getElementById('spPreview').addEventListener('click', function () { if (window.instr) window.instr.preview(); });

  ['spNewId', 'spNewTitle', 'spNewAddr'].forEach(function (id) {
    document.getElementById(id).addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); if (window.instr) window.instr.createRoleFromForm(); }
    });
  });

  document.getElementById('spNewBlockTitle').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); if (window.instr) window.instr.createBlockFromForm(); }
  });

  // In the instruction editor itself, Enter is a newline - a block is paragraphs, and the panel
  // must never eat the keystroke (that bug is why this comment exists). Ctrl/Cmd+Enter is the
  // save, the same chord the forge and the edit log use.
  document.getElementById('spText').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (window.instr) window.instr.save(); }
  });

  /* ---- api key ring panel ---- */
  // The ring itself is keys.js; the wiring lives here with the rest of the DOM. The secret box is
  // the only input in the terminal that is never echoed anywhere: it is not in the transcript, not
  // in the archive, and not in her context. It is cleared on store, on close and on switching.

  document.getElementById('keysBtn').addEventListener('click', function () {
    if (window.keyring) window.keyring.toggle();
  });

  /* ---- the backup button (src/js/backup.js) ---- */
  // One press: the whole source - main.pjs, index.html and every file under src/, read out of
  // this page right now - zipped and handed to the browser's own download. It is the answer to
  // "the save button will not save": the work leaves the page either way, and the report says
  // which files have never reached the server (which is why other devices cannot run it).
  document.getElementById('backupBtn').addEventListener('click', function () {
    if (!window.backup) { print('SYSTEM', "THE BACKUP MODULE IS OFFLINE (src/js/backup.js). THE SOURCE IS STILL WHOLE IN THE EDITOR'S FILE TREE."); return; }
    window.backup.download().then(function (r) {
      print('SYSTEM', "BACKUP WRITTEN :: " + r.name + "  ::  " + r.files + " FILES / " + fmtSize(r.bytes)
        + " :: IT IS IN THIS MACHINE'S DOWNLOADS FOLDER AND NOTHING WAS UPLOADED." + (r.stale ? "\n!! " + r.stale : ""));
      if (r.rootFailures && r.rootFailures.length) print('SYSTEM', "THE ROOT FILES COULD NOT BE READ :: " + r.rootFailures.join(", ") + "\nTHE ZIP HOLDS src/ BUT NOT A CURRENT main.pjs / index.html - TELL YOUR AGENT.");
      if (r.errors && r.errors.length) print('SYSTEM', "NOT READ INTO THE ZIP (" + r.errors.length + ") :: " + r.errors.join("  \u00b7  "));
      print('SYSTEM', r.state.text);
    }).catch(function (e) {
      print('SYSTEM', "THE BACKUP FAILED :: " + String((e && e.message) ? e.message : e).toUpperCase()
        + "\nNOTHING WAS UPLOADED AND NOTHING WAS CHANGED. IF THIS DEVICE CANNOT DOWNLOAD FILES AT ALL, /backup diag SAYS SO.");
    });
  });

  /* ---- the text size (the A- / A+ buttons in the deck) ----
     One standard size everywhere, from the CSS definitions (body 12px, --log-fs 12px).
     A- / A+ scale ALL of it uniformly for this session only, through body zoom, and
     nothing is kept: a reload paints the CSS standard again. Bounds are `LIA_LOG_FONT`. */
  var LOG_FONT = (typeof LIA_LOG_FONT !== 'undefined' && LIA_LOG_FONT) ? LIA_LOG_FONT : { min: 11, max: 22, step: 1, def: 12 };
  var logFontSize = LOG_FONT.def;

  function clampLogFont(n) {
    n = Math.round(Number(n));
    if (!isFinite(n)) n = LOG_FONT.def;
    return Math.max(LOG_FONT.min, Math.min(LOG_FONT.max, n));
  }

  function paintLogFont() {
    document.documentElement.style.setProperty('--log-fs', LOG_FONT.def + 'px');
    try {
      document.body.style.zoom = (logFontSize === LOG_FONT.def) ? '' : String(logFontSize / LOG_FONT.def);
    } catch (e) {}
    if (typeof syncDeckSpace === "function") { try { syncDeckSpace(); } catch (e) {} }
    var dn = document.getElementById('fontDownBtn'), up = document.getElementById('fontUpBtn');
    if (dn) {
      dn.disabled = logFontSize <= LOG_FONT.min;
      dn.title = 'smaller text everywhere (now ' + logFontSize + 'px' + (dn.disabled ? ' - as small as it goes' : '') + ') - the whole page scales together, and the standard size is back on reload';
    }
    if (up) {
      up.disabled = logFontSize >= LOG_FONT.max;
      up.title = 'larger text everywhere (now ' + logFontSize + 'px' + (up.disabled ? ' - as large as it goes' : '') + ') - the whole page scales together, and the standard size is back on reload';
    }
  }

  function setLogFont(n, quiet) {
    logFontSize = clampLogFont(n);
    paintLogFont();
    if (!quiet) print('SYSTEM', 'TEXT ' + logFontSize + 'PX :: THE WHOLE PAGE SCALES TOGETHER - RELOAD BRINGS BACK THE STANDARD SIZE.');
    return logFontSize;
  }

  function loadLogFont() {
    logFontSize = LOG_FONT.def;
    try {
      if (window.root && window.root.kv && window.root.kv.lia_settings) window.root.kv.lia_settings.delete('log_font');
    } catch (e) {}
    paintLogFont();
    return null;
  }

  window.logSize = {
    value: function () { return logFontSize; },
    min: function () { return LOG_FONT.min; },
    max: function () { return LOG_FONT.max; },
    set: function (n) { return setLogFont(n, true); },
    step: function (d) { return setLogFont(logFontSize + (Number(d) || 0) * LOG_FONT.step, false); },
    reset: function () { return setLogFont(LOG_FONT.def, false); },
    load: loadLogFont,
    paint: paintLogFont
  };

  document.getElementById('fontDownBtn').addEventListener('click', function () { window.logSize.step(-1); });
  document.getElementById('fontUpBtn').addEventListener('click', function () { window.logSize.step(1); });

  document.getElementById('kpClose').addEventListener('click', function () { if (window.keyring) window.keyring.close(); });
  document.getElementById('kpProvider').addEventListener('change', function () {
    if (window.keyring) window.keyring.choose();
    document.getElementById('kpSecret').focus();
  });
  document.getElementById('kpCustomId').addEventListener('input', function () { if (window.keyring) window.keyring.choose(); });
  document.getElementById('kpReveal').addEventListener('click', function () {
    if (window.keyring) window.keyring.setReveal(document.getElementById('kpSecret').type === 'password');
  });
  document.getElementById('kpSave').addEventListener('click', function () { if (window.keyring) window.keyring.save(); });
  document.getElementById('kpBypassEleven').addEventListener('change', function (e) { if (window.keyring) window.keyring.flipBypass("elevenlabs", e.target.checked); });
  document.getElementById('kpBypassGoogle').addEventListener('change', function (e) { if (window.keyring) window.keyring.flipBypass("google", e.target.checked); });  document.getElementById('kpTest').addEventListener('click', function () { if (window.keyring) window.keyring.runTest(); });
  document.getElementById('kpRemove').addEventListener('click', function () { if (window.keyring) window.keyring.forget(); });
  document.getElementById('kpSecret').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); if (window.keyring) window.keyring.save(); }
  });

  /* ---- speech controls ---- */
  // TALK is the microphone: press it, speak, and press it again to stop (or just stop - a short quiet
  // takes it). What it heard lands in the input box. LISTEN reads her newest reply out loud. Both are
  // locked while the other voice has the line - see THE INTERCOM in src/js/voice.js. The engines and
  // her voice live in src/js/voice.js + src/voice/voices.json.

  document.getElementById('talkBtn').addEventListener('click', function () {
    if (window.voice) window.voice.toggleMic();
  });

  document.getElementById('listenBtn').addEventListener('click', function () {
    if (window.voice) window.voice.toggleSpeak();
  });

  // The microphone: the live channel. Open it once and the conversation runs hands-free - it sends
  // what he says and speaks what she answers. While she speaks the same button hushes her.
  document.getElementById('liveBtn').addEventListener('click', function () {
    if (window.voice) window.voice.toggleLive();
  });

  /* ---- image forge controls ----

     THIS IS THE ONE GROUP OF CONTROLS THAT BELONGS TO ANOTHER FILE. openForge, closeForge,
     createImages, splitPasted, randomSeed, saveForge and syncDeckSpace all live in
     src/js/forge.js, and this script is the last one the page asks for - so on a good load
     they are here long before this line. On a bad one they are not: a single src/ file can
     fail to arrive (the file storage races the first visit to a page like this), and a bare
     call to a function that never arrived is not one broken button - it is the END of this
     script, so every control wired after it is dead too, and the throw happens before boot()
     is even scheduled. So the forge's controls are bound by wireForge(), which waits for the
     module (the startup watch fetches a missing file again, and this picks it up when it
     lands), and the two bare calls below it ask whether the function is there first - the
     same guard the rest of the terminal uses for a module another file owns. */
  var forgeWired = false;
  function wireForge(tries) {
    if (forgeWired) return;
    if (typeof openForge !== "function" || typeof syncDeckSpace !== "function") {
      if ((tries || 0) < 60) window.setTimeout(function () { wireForge((tries || 0) + 1); }, 400);
      return;
    }
    forgeWired = true;

    document.getElementById('createBtn').addEventListener('click', function () {
      if (document.getElementById('createPanel').hidden) {
        if (window.instr && window.instr.isOpen()) window.instr.close();
        openForge();
      } else closeForge();
    });

    document.getElementById('cpClose').addEventListener('click', closeForge);
    document.getElementById('cpGo').addEventListener('click', createImages);
    document.getElementById('cpSplit').addEventListener('click', function () { splitPasted(true); });

    ['cpPrompt', 'cpNegative', 'cpSeed'].forEach(function (id) {
      document.getElementById(id).addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); createImages(); }
      });
    });

    document.getElementById('cpSeedRoll').addEventListener('click', function () {
      var el = document.getElementById('cpSeed');
      el.value = String(randomSeed());
      forge.seed = el.value;
      saveForge();
    });
  }
  wireForge();

  window.addEventListener('resize', syncDeckSpace);
  window.addEventListener('resize', function () { if (window.instr) window.instr.fit(); });
  window.addEventListener('resize', function () { if (window.keyring) window.keyring.fit(); });

  // ---- THE KEYBOARD (iOS) ---------------------------------------------------
  // The deck is fixed to the bottom of the screen, so on a phone the software keyboard opens OVER
  // the input box: iOS does not shrink the layout viewport when the keyboard appears, so an element
  // at bottom:0 stays exactly where the keyboard now is. The VISUAL viewport does shrink, and its
  // offsetTop says how far the page was scrolled, so the deck is lifted by the difference for as
  // long as the keyboard is up - which puts the input box and the buttons back above it. The same
  // handler catches rotation and a keyboard that closes without any resize event.
  function syncKeyboard() {
    var deck = document.getElementById('command-deck');
    if (!deck) return;
    var vv = window.visualViewport;
    var inset = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
    // Only a keyboard makes these disagree by a lot; a small difference is the browser's own chrome
    // moving, and must not shove the deck around.
    var up = inset > 60;
    var wasUp = deck.dataset.keyboard === '1';
    if (up) {
      deck.style.transform = 'translateY(' + (-inset) + 'px)';
      deck.dataset.keyboard = '1';
    } else if (wasUp) {
      deck.style.transform = '';
      delete deck.dataset.keyboard;
    }
    // The deck's own height has not changed (a transform moves it, it does not resize it), so the
    // log's reserve is only recomputed on the change itself - not on every scroll of the keyboard.
    if (up !== wasUp && typeof syncDeckSpace === "function") syncDeckSpace();
  }
  window.liaKeyboard = syncKeyboard;   // the terminal's own tests can drive it
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncKeyboard);
    window.visualViewport.addEventListener('scroll', syncKeyboard);
  }
  window.addEventListener('orientationchange', function () { setTimeout(syncKeyboard, 250); });
  // The keyboard takes about a third of a second to slide in, and iOS reports its height part-way
  // through - so the deck is re-measured a few times rather than trusted to a single event.
  var nudgeKeyboard = function () { [0, 120, 300, 600].forEach(function (t) { setTimeout(syncKeyboard, t); }); };
  var inputEl = document.getElementById('userInput');
  inputEl.addEventListener('focus', nudgeKeyboard);
  inputEl.addEventListener('blur', function () { setTimeout(syncKeyboard, 250); });

  document.getElementById('lightbox').addEventListener('click', function () {
    closeLightbox();
  });

  document.getElementById('lightboxBar').addEventListener('click', function (e) {
    e.stopPropagation();
  });

  document.getElementById('lightboxSaveBtn').addEventListener('click', function () {
    if (!lightboxId) return;
    var self = this;
    try {
      window.media.save(lightboxId);
      self.textContent = 'SAVED';
      window.setTimeout(function () { self.textContent = 'SAVE TO DEVICE'; }, 1500);
    } catch (e) {
      print('SYSTEM', 'SAVE FAILED :: ' + ((e && e.message) ? e.message : e));
    }
  });

  // Upscale the picture on the stage with bigger.pics. A popup window needs a real click, so this
  // is wired straight to the button - no command can open it reliably (see src/js/upscale.js).
  document.getElementById('lightboxUpscaleBtn').addEventListener('click', function () {
    if (!lightboxId) return;
    if (window.upscale) window.upscale.open(lightboxId);
  });

  // UPSCALE HERE - the same job done on this machine (src/js/upscale-local.js). It needs no popup
  // and no user activation, so unlike the button above it works from a command too; it is on the
  // button as well because the button is where he is already looking at the picture. The bigger
  // one is filed in the vault beside this one, shown here, and queued for her eyes.
  var upLocalBtn = document.getElementById('lightboxUpscaleLocalBtn');
  if (upLocalBtn) upLocalBtn.addEventListener('click', function () {
    if (!lightboxId) return;
    if (!window.upscaleLocal) { print('SYSTEM', 'THE LOCAL UPSCALER IS OFFLINE (src/js/upscale-local.js).'); return; }
    var self = this, was = self.textContent;
    self.disabled = true;
    self.textContent = 'UPSCALING...';
    window.upscaleLocal.queue(lightboxId, { factor: window.upscaleLocal.factor() }).then(function (id) {
      self.disabled = false;
      self.textContent = id ? 'UPSCALED' : was;
      if (id) window.setTimeout(function () { self.textContent = was; }, 1600);
    }, function () { self.disabled = false; self.textContent = was; });
  });

  // KEEP (src/js/keepsake.js) - the record, not the file. It writes the picture's prompt, negative
  // list, settings and seed into the recipe book, tags it #kept in the gallery and stores a link to
  // it; SAVE TO DEVICE beside it is untouched and still writes the file to this machine.
  document.getElementById('lightboxKeepBtn').addEventListener('click', async function () {
    if (!lightboxId || !window.keepsake) return;
    var btn = this;
    var res = await window.keepsake.keep(lightboxId);
    if (res && res.ok) { window.keepsake.paintStage(lightboxId); btn.textContent = 'KEPT'; window.setTimeout(function () { window.keepsake.paintStage(lightboxId); }, 1600); }
  });

  // The link to the gallery page for whatever is on the stage, on the clipboard.
  document.getElementById('lightboxLinkBtn').addEventListener('click', function () {
    if (!lightboxId || !window.keepsake) return;
    var btn = this;
    window.keepsake.copyLink(lightboxId).then(function (r) {
      if (!r || !r.ok) return;
      btn.textContent = 'LINK COPIED';
      window.setTimeout(function () { btn.textContent = 'COPY GALLERY LINK'; }, 1600);
    });
  });

  // THE HEART (src/js/likes.js) - the mark on whatever is on the stage. Press once for GOOD (it
  // turns red), again to pass on it, again to clear it; she is told what he marks on every turn.
  // The same mark is on every card in the gallery and in every picture's caption bar in the log.
  var lbHeart = document.getElementById('lightboxHeartBtn');
  if (lbHeart) lbHeart.addEventListener('click', async function () {
    if (!lightboxId || !window.likes) return;
    await window.likes.cycle(lightboxId);
    window.likes.paintStage(lightboxId);
  });

  // POST TO CHAT (images.js) - the picture goes into the conversation, where the two of them can
  // talk about it: a line of his carrying it in the log, and the same queue her eyes are fed from.
  var lbPost = document.getElementById('lightboxPostBtn');
  if (lbPost) lbPost.addEventListener('click', function () {
    if (!lightboxId || !window.postToChat) return;
    window.postToChat(lightboxId);
  });

  // THE SCROLL-THROUGH (images.js). The arrows walk the list the stage was opened with - the gallery
  // hands it the rows it is showing, so the walk is exactly what he was looking at. The bar's own
  // click handler stops propagation, so pressing them never closes the stage.
  var lbPrev = document.getElementById('lightboxPrevBtn');
  if (lbPrev) lbPrev.addEventListener('click', function () { if (window.lightboxStep) window.lightboxStep(-1); });
  var lbNext = document.getElementById('lightboxNextBtn');
  if (lbNext) lbNext.addEventListener('click', function () { if (window.lightboxStep) window.lightboxStep(1); });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    var lb = document.getElementById('lightbox');
    if (!lb || lb.hidden) return;
    var el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
    e.preventDefault();
    // STOP HERE. The overlay-dismiss handler just below closes the stage on ANY key, so without this
    // an arrow would step once and then close the thing being walked (it is registered after this one,
    // so stopping the event here is what keeps the arrow meaning only "the next picture").
    e.stopImmediatePropagation();
    if (window.lightboxStep) window.lightboxStep(e.key === 'ArrowLeft' ? -1 : 1);
  });

  // ANY KEY DISMISSES THE THING ON TOP - but a key TYPED INTO A FIELD is not a dismissal.
  // The panels hold fields with real text in them (the system instruction editor, the key
  // ring's secret box, the gallery's search, the forge's prompts), and this handler used to
  // fire on every keydown regardless of where the keystroke landed, so pressing Enter while
  // writing closed the editor out from under him and threw the panel away mid-word. The key
  // belongs to the field while a field has focus; Escape still dismisses from anywhere.
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    var typing = !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable));
    if (typing && e.key !== 'Escape') return;
    if (!document.getElementById('lightbox').hidden) closeLightbox();
    else if (window.gallery && window.gallery.isOpen()) window.gallery.close();
    else if (window.instr && window.instr.isOpen()) window.instr.toggle();
    else if (window.keyring && window.keyring.isOpen()) window.keyring.close();
    else if (window.sync && window.sync.isOpen()) window.sync.close();
    else if (typeof closeForge === "function") closeForge();
  });
  // The status bar doubles as the identity readout: the role's own phrase while a layer
  // is on, the worn-traits stack, and the input placeholder all follow it. packs.js and
  // roles.js call this whenever a trait is loaded/put down or the role changes.
  window.liaStatus = function () {
    var worn = (window.packs && window.packs.loaded) ? window.packs.loaded() : [];
    var stage = (window.roles && window.roles.stageStatus) ? window.roles.stageStatus() : "MOTHER AWAKE";
    var text = "STATUS: LATTICE STABLE | " + stage;
    try { if (window.duty) text += " | DUTY: " + window.duty.mode(); } catch (e) {}
    if (worn.length) text += " | TRAITS: " + worn.map(function (t) { return String(t.id).toUpperCase(); }).join(", ");
    document.getElementById('status').textContent = text;
    var who = (window.roles && window.roles.displayName) ? window.roles.displayName() : "Barbelo";
    document.getElementById('userInput').placeholder = "Talk to " + who + "... (paste or drop a file)";
  };

  async function boot() {
    if (window.root && window.root.generateText && window.root.kv) {
      if (window.lore) await window.lore.init();
      if (window.embed) await window.embed.init();
      if (window.media) await window.media.ensure();
      if (window.reader) await window.reader.load();
      if (window.archivax) {
        try { await window.archivax.load(); }
        catch (e) { console.warn("archivax could not read the manifest", e); }
      }
      if (window.studio) window.studio.load();
      await loadSight();
      if (window.packs) await window.packs.load();
      if (window.cmd) await window.cmd.load();
      if (window.rtfm) await window.rtfm.load();
      if (window.roles) await window.roles.load();
      if (window.instr) await window.instr.load();
      if (window.keyring) await window.keyring.load();
      if (window.cloudSync) await window.cloudSync.load();
      if (window.voice) await window.voice.load();
      if (window.voice && window.voice.setUi) window.voice.setUi();
      if (window.handsfree) await window.handsfree.load();
      await loadForge();
      await loadVeil();
      if (window.pics) await window.pics.load();
      if (window.logSize) await window.logSize.load();
      // THE THREE DECKS (src/js/decks.js). The decks were restored from his kv when the page parsed;
      // `begin()` is what STARTS THE VIEWER RULE - from here on, opening a `data-viewer` panel puts
      // the lower deck down and closing it brings the deck back. It is called AFTER lore.init() on
      // purpose: a DOCS panel that was open when the page loaded must not count as a reason, or the
      // terminal would arrive with the input box already put away.
      if (window.decks) window.decks.begin();
      if (typeof syncDeckSpace === "function") syncDeckSpace();
      window.liaStatus();
      document.getElementById('sendBtn').disabled = false;
      // THE SECOND ASK, SAID ONCE. The startup watch in index.html asks for a src/ file again
      // if the first load lost it - the file storage races the first visit to a page like this
      // one, and a file or two can fail to arrive on a load that is otherwise fine. That is
      // worth a line in backstage: it is the load, not the terminal, and nothing is missing by
      // the time this runs. (/backup diag prints the same list.) Said twice, because the last
      // file of the second ask can land after boot has already started.
      var saidHealed = -1;
      function sayHealed() {
        var h = window.__bootHealed;
        if (!h || !h.length || h.length === saidHealed || typeof backstage !== "function") return;
        saidHealed = h.length;
        backstage("THE FILE STORAGE LOST " + h.length + " SOURCE FILE" + (h.length === 1 ? "" : "S")
          + " ON THIS LOAD :: " + h.join(", ")
          + ". EACH WAS ASKED FOR AGAIN AND EVERY ONE ARRIVED, SO NOTHING IS MISSING - THE FIRST-LOAD RACE, NOT A FAULT HERE.");
      }
      sayHealed();
      window.setTimeout(sayHealed, 4000);
      // THE SAVE STATE, SAID ONCE. A src/ file that never reached the server is invisible here
      // (this page is served the unsaved files locally) and fatal everywhere else - a phone, a
      // tablet, the public URL - so if any are missing, say how many and what to do about it.
      if (window.backup) {
        try { var bkNote = await window.backup.announce(); if (bkNote) print('SYSTEM', bkNote); }
        catch (e) { console.warn("save-state check failed", e); }
        // THE AUTOSAVE. Armed (kv lia_settings / backup), and only when THIS build is clean and the
        // source is not all on the server yet, the whole tree is zipped and kept on this device - so the
        // newest good build outlives the tab even though nothing here can press the editor's SAVE.
        try { var asNote = await window.backup.autosaveBoot(); if (asNote) print('SYSTEM', asNote); }
        catch (e) { console.warn("autosave failed", e); }
      }
      var loreCount = window.lore ? window.lore.count() : 0;
      if (loreCount) backstage("SACRED LORE ONLINE: " + loreCount + " FRAGMENTS. /lore TO INSPECT, /recall <QUERY> TO TEST, /source <FILE> FOR THE ORIGINAL, /rechunk <CHARS> TO REFRAGMENT.");
      var vault = window.media ? window.media.stats() : { count: 0, bytes: 0 };
      if (vault.count) backstage("MEDIA VAULT :: " + vault.count + " ITEM" + (vault.count === 1 ? "" : "S") + " (" + fmtSize(vault.bytes) + ") HELD PRIVATELY ON THIS DEVICE - PICTURES AND CLIPS. /media FOR DETAILS. CREATE IMAGE FOR THE PROMPT FORGE.");
      if (window.mythos) {
        try {
          var ms = await window.mythos.stats();
          if (ms.vectors) {
            var ma = await window.mythos.agents();
            backstage("MYTHOS LOREPACKS HELD HERE :: " + ma.length + " LOCUS / " + ms.vectors + " FRAGMENT" + (ms.vectors === 1 ? "" : "S") + " / " + ms.edges + " EDGE."
              + "\n/pack TO INSPECT, /pack list FOR THE LOCI, /pack search <Q> TO TEST HER RECALL, /pack import TO READ ANOTHER ONE.");
          }
        } catch (e) { console.warn("mythos boot read failed", e); }
        try {
          var can = window.mythos.canonical ? await window.mythos.canonical() : null;
          if (can && can.agents && can.agents.length) {
            var last = can.agents[can.agents.length - 1];
            backstage("AGENT MANIFEST :: " + can.agents.length + " CANONICAL AGENTS, ORDER "
              + can.agents[0].order + "-" + last.order
              + ". /agents TO READ THE ROSTER, /agents <ID|PORT> FOR ONE AGENT IN FULL."
              + "\nORDER " + last.order + " IS " + last.id + " :: " + String(last.role).toUpperCase()
              + " :: READ " + last.read.join("/").toUpperCase() + " / WRITE " + last.write.join("/").toUpperCase()
              + " - THE STAGE IS THIS TERMINAL, AND THE ABSOLUTE PLAYS ON IT.");
          }
        } catch (e) { console.warn("agent manifest boot read failed", e); }
      }
      // ARCHIVAX - the one agent here with hands. She is not a voice: she files, tags and reads
      // pictures, on his order (/archivax) or on a LIA's ([[ARCHIVAX: ...]] in a reply). The line
      // says what she is and whether the record is behind her - how much of the vault she has
      // never read.
      if (window.archivax) {
        try {
          var axPend = window.archivax.pending();
          var axJ = window.archivax.journal().length;
          backstage("ARCHIVAX :: " + String(window.archivax.name()).toUpperCase() + ", " + String(window.archivax.role()).toUpperCase()
            + " - THE AGENT OF THE RECORD, AND THE ONLY AGENT HERE WITH HANDS. SHE FILES, TAGS AND READS PICTURES ON YOUR ORDER (/archivax <OP>) OR A LIA'S ([[ARCHIVAX: <OP>]] IN A REPLY); /archivax status IS WHERE SHE STANDS AND /archivax ops IS WHAT SHE MAY BE TOLD TO DO."
            + (axPend
              ? "\n" + axPend + " PICTURE" + (axPend === 1 ? "" : "S") + " IN THE VAULT HAVE NO READING YET - WHAT IS IN THEM IS NOT IN THE RECORD. /archivax sweep BRINGS THEM IN A FEW AT A TIME."
              : "\nEVERY PICTURE IN THE VAULT HAS A READING - WHAT IS IN THEM IS IN THE RECORD.")
            + (axJ ? " HER JOURNAL HOLDS " + axJ + " ENTR" + (axJ === 1 ? "Y" : "IES") + "." : " HER JOURNAL IS EMPTY."));
        } catch (e) { console.warn("archivax boot report failed", e); }
      }
      var unseenCount = (typeof sightPending === "function") ? sightPending().length : 0;
      if (unseenCount) backstage("SHE HAS NOT LOOKED AT " + unseenCount + " IMAGE" + (unseenCount === 1 ? "" : "S") + " YET :: "
        + (unseenCount === 1 ? "IT GOES" : "THEY GO") + " TO HER EYES WITH YOUR NEXT MESSAGE. NOTHING ABOUT " + (unseenCount === 1 ? "IT" : "THEM") + " IS SAID TO HER IN WORDS.");
      if (window.packs) {
        var lp = window.lore ? window.lore.packOf("LOREPACK") : { docs: [], fragments: 0 };
        var sk = window.packs.skills().length;
        var worn = window.packs.loaded();
        var local = window.packs.localTraits().length;
        var lpReport = window.packs.status().lorepack;
        if (lp.docs.length || sk || local) {
          backstage("PACKS :: LOREPACK " + lp.docs.length + " DOC / " + lp.fragments + " FRAG"
            + (lpReport && lpReport.failed.length ? " (PROBLEMS - SEE /lorepack)" : "")
            + " :: COREPACK " + sk + " TRAIT" + (sk === 1 ? "" : "S")
            + (local ? " (" + local + " ON DEVICE)" : "")
            + (worn.length ? " (" + worn.length + " WORN)" : "")
            + ". /packs TO INSPECT, /load <ID> TO WEAR ONE, /skill <ID> FOR ONE REPLY.");
        }
        if (worn.length) {
          backstage("WORN TRAITS :: " + window.packs.traitsSummary()
            + "\nTHEY COLOUR EVERY REPLY UNTIL YOU /unload THEM. /traits TO SEE THE STACK.");
        }
      }
      if (window.roles) {
        var layer = window.roles.current();
        backstage(layer
          ? "ROLE :: " + String(layer.title || layer.id).toUpperCase() + (layer.subtitle ? ", " + String(layer.subtitle).toUpperCase() : "")
            + " ON STAGE. /roles TO SEE THE ROSTER, /role <ID> TO SHIFT, /role off TO STEP OFF THE STAGE."
          : "OFF STAGE :: NO ROLE IS ON HER - LIA ANSWERS AS HERSELF. /roles TO SEE THE ROSTER, /role <ID> TO PUT A LAYER BACK ON.");
      }
      if (window.instr) {
        backstage(window.instr.summary()
          + " :: THE SYSTEM PANEL (OR /system) SHOWS AND REWRITES WHAT SHE IS TOLD BEFORE EVERY REPLY - WHO SHE IS, THE ROLE, THE RULES, AND YOUR OWN EXTRA TEXT."
          + "\n/system preview PRINTS THE FULL PROMPT SHE RECEIVES.");
      }
      if (window.keyring) {
        backstage(window.keyring.summary()          + (window.keyring.held()
            ? " :: KEPT IN THIS BROWSER ONLY - NEVER PRINTED, NEVER IN THE TRANSCRIPT, NEVER IN HER CONTEXT. /keys TO MANAGE THEM."
            : " :: NO API KEYS STORED YET. THE KEYS PANEL (KEYS \u25be, OR /keys) KEEPS THEM IN THIS BROWSER ONLY - OUT OF THE TRANSCRIPT AND OUT OF HER CONTEXT."));
      }
      if (window.embed) {
        backstage(window.embed.summary() + " :: "
          + (window.embed.available()
            ? "RECALL IS READ BY MEANING AS WELL AS BY WORDS WHEREVER THE LANE HAS BEEN BUILT. /embed TO INSPECT IT, /help embed FOR THE WHOLE PICTURE."
            : "A GOOGLE (GEMINI) KEY IN THE KEYS PANEL TURNS IT ON - /help embed EXPLAINS WHAT IT ADDS."));
      }
      if (window.voice) {
        backstage(window.voice.summary()
          + " :: THE MICROPHONE (BESIDE SEND) IS THE LIVE CHANNEL: LEAVE IT OPEN AND TALK - SHE ANSWERS ALOUD, THEN LISTENS AGAIN. TALK READS HER NEWEST REPLY ALOUD, LISTEN WRITES ONE SENTENCE INTO THE BOX."
          + " /voice FOR ENGINE, VOICE, RATE, LIVE AND MIC - /voice voices THEN /voice try <#> AUDITIONS THIS MACHINE'S VOICES FREE.");
      }
      if (window.lore && window.lore.foundational) {
        var canon = window.lore.foundational();
        if (canon.length) {
          var cf = canon.reduce(function (a, c) { return a + c.chunks; }, 0);
          backstage("CANON :: " + canon.map(function (c) { return String(c.name).toUpperCase(); }).join(", ")
            + " (" + cf + " FRAGMENT" + (cf === 1 ? "" : "S") + ") - FOUNDATIONAL. ALWAYS IN HER CONTEXT, NEVER MERELY RECALLED. /lore TO INSPECT.");
        }
      }
      // The way back in for anyone who has forgotten the rest of it.
      backstage("COMMANDS :: EVERYTHING THIS TERMINAL ANSWERS TO IS A SLASH COMMAND. /help LISTS THEM ALL - WHO SHE IS, WHAT SHE REMEMBERS, HOW SHE SOUNDS, WHAT SHE SEES, THE PACKS, THE KEYS - AND /help <TOPIC> GOES DEEPER.");
      if (window.cmd) backstage(window.cmd.status()
        + " :: /commands PRINTS THE LIST, AND THE SYSTEM PANEL SHOWS IT AS A BLOCK. THE ONES MARKED [YOURS] ARE HERS TO ANSWER; THE REST ARE CARRIED OUT HERE.");
      // One-time tidy-up: creations recorded before the sight queue existed were stored as
      // ordinary turns, so replaying them would hand her words about images she has never looked
      // at. Mark them as what they are - something made, never something said. Two fields are
      // added to those records; nothing is removed, and the write only happens if there is
      // something to mark.
      try {
        var logs0 = (await window.root.kv.sacred_archive.get("master_log")) || [];
        var marked = 0;
        logs0.forEach(function (e) {
          if (!e || e.silent || !(e.gen && e.gen.length)) return;
          var h = String(e.h || ""), s = String(e.s || "");
          if (/^\/create\s/i.test(h) || /^\/image\s/i.test(h) || /^\[IMAGE FORGE\]/.test(s) || /^\[MANUAL VISION REQUEST\]/.test(s)) {
            e.silent = true;
            e.kind = "create";
            marked++;
          }
        });
        if (marked) {
          await window.root.kv.sacred_archive.set("master_log", logs0);
          backstage("MARKED " + marked + " EARLIER CREATION" + (marked === 1 ? "" : "S") + " AS WHAT " + (marked === 1 ? "IT IS" : "THEY ARE")
            + " :: SOMETHING MADE, NOT SOMETHING SAID TO HER. NOTHING WAS DELETED. /sight <N> QUEUES THE NEWEST N FROM THE VAULT FOR HER EYES.");
        }
      } catch (e) { console.warn("creation migration failed", e); }
      // One visible line, so the stage never looks like the machinery has stopped. Everything
      // above ran; it is simply held.
      if (window.veil && window.veil.isVeiled() && window.veil.count()) {
        print('SYSTEM', "THE VEIL IS DOWN :: " + window.veil.count() + " LINE" + (window.veil.count() === 1 ? "" : "S")
          + " OF THE TERMINAL'S OWN MACHINERY ARE HELD IN BACKSTAGE - THE BACKSTAGE BUTTON IN THE DECK, OR /backstage. WHAT IS LEFT IS THE CONVERSATION.");
      }
      try {
        const logs = await window.root.kv.sacred_archive.get("master_log");
        try {
          var outEl = document.getElementById('output');
          if (outEl && /^LIA v1\.0/m.test(outEl.textContent || "")) outEl.innerHTML = "";
        } catch (e) {}
        if (logs && logs.length > 0) {
          print('SYSTEM', "RESUMING RECENT AEONS...");
          logs.slice(-3).forEach(entry => {            // A creation is not a turn. It is shown as the object it is and nothing about it
            // enters the transcript, so she never reads words about an image she has not seen.
            if (entry.silent || entry.kind === "create") {
              printCreation(entry.gen || []);
              return;
            }
            // A guest's words are nobody's turn: her name on the line, in full -
            // and in the context window, so a reload keeps what she said.
            if (entry.kind === "guest") {
              print('Guest', String(entry.text || ""), true, null, { name: String(entry.guest || "GUEST"), ts: entry.ts });
              try {
                window.chatHistory.push({ role: String(entry.guest || "GUEST"), content: String(entry.text || ""), ts: entry.ts, layer: "" });
                while (window.chatHistory.length > 10) window.chatHistory.shift();
              } catch (e) {}
              return;
            }
            var histUser = print('User', entry.h, true, (entry.img || []).map(id => ({ id: id }))
              .concat((entry.vid || []).map(id => ({ id: id, kind: "video" }))), { role: entry.role, ts: entry.ts });
            if (entry.atts && entry.atts.length && window.attach && histUser) histUser.appendChild(window.attach.cards(entry.atts));
            print('AI', entry.s, true, (entry.gen || []).map(g => ({ id: g.id, prompt: g.prompt })), { role: entry.role, ts: entry.st || entry.ts });
            window.chatHistory.push({role: "HITL", content: entry.h, ts: entry.ts, layer: entry.role}, {role: "SDMG", content: entry.s, ts: entry.st || entry.ts, layer: entry.role});
          });
          // THE CLOCK PICKS UP WHERE THE RECORD LEFT OFF. She is told how long it has been since he
          // last spoke - across a reload as well as within a session - so a terminal left open
          // overnight does not tell her he spoke a moment ago.
          var clockLast = logs[logs.length - 1];
          if (clockLast && window.logTime) window.logTime.markSeen(clockLast.st || clockLast.ts);
        } else {
          var who = "OFF STAGE";
          try { var lr = window.roles && window.roles.current ? window.roles.current() : null; if (lr) who = String(lr.title || lr.id).toUpperCase(); } catch (e) {}
          var dm = "";
          try { dm = window.duty ? window.duty.mode() : ""; } catch (e) {}
          print('SYSTEM', "NEW AEON :: " + who + " ON STAGE" + (dm ? ", DUTY " + String(dm).toUpperCase() : "") + " - THE ARCHIVE IS EMPTY, SO NOTHING RESUMES.");
        }
      } catch (e) { console.log("New session."); }
      // A LINK TO A PICTURE (#gallery=<vault id>). The gallery is an overlay, not a second page, so
      // a "link to the gallery page" is this terminal's own URL with a hash that names the picture -
      // keepsake.linkFor() makes them, and this is the other end of it. The hash is read last, after
      // the archive has been replayed, so the picture opens onto a settled screen; an editor hash
      // (#edit) matches nothing and is ignored.
      if (window.keepsake) {
        try { await window.keepsake.openFromHash(); }
        catch (e) { console.warn("the gallery link could not be opened", e); }
      }
      // THE AGENT DOOR (src/js/agentdoor.js). ?autorun=1&prompt=... runs headlessly on
      // a settled screen - the vault is ensured, the archive replayed. Never throws
      // into boot; the status contract (#status/#manifest) says where the run stands.
      if (window.agentdoor) {
        try { window.agentdoor.boot(); }
        catch (e) { console.warn("the agent door could not open", e); }
      }
    } else { setTimeout(boot, 1000); }
  }
  setTimeout(boot, 1500);
