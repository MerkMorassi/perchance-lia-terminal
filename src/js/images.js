  // ---- the veil -------------------------------------------------------------
  // There are two kinds of line in this terminal. The STAGE is the conversation: what
  // Patrikios says, what she answers, the images between them. BACKSTAGE is everything the
  // terminal says about its own machinery - what she recalled this turn, which method found
  // it and how strongly, what she was shown, how long the weave took, and the whole boot
  // report. Backstage is worth reading once and exhausting to read every turn, so the veil
  // is DOWN by default: the stage stays clean, and the apparatus is still there, one press
  // away (BACKSTAGE in the deck, or /backstage). Nothing is ever discarded - hidden lines
  // are only hidden.
  var veiled = true;          // true = the veil is down (backstage held)
  var backstageCount = 0;     // hidden lines in the log right now (so he can see that a logic ran)
  var hushed = false;

  function veilButton() { return document.getElementById('veilBtn'); }

  function paintVeil() {
    document.body.classList.toggle('veiled', veiled);
    var b = veilButton();
    if (!b) return;
    b.textContent = 'BACKSTAGE' + (backstageCount ? ' \u00b7 ' + backstageCount : '');
    b.setAttribute('aria-pressed', veiled ? 'false' : 'true');
    b.title = veiled
      ? 'the conversation is the stage, and it is clean. everything the terminal says about its own machinery - what she recalled, what she was shown, how long it took - is held behind this. press to look.'
      : 'backstage is showing: recall, citations, sightings and timings are all in the log. press to let the veil fall again.';
  }

  function setVeil(down, quiet) {
    veiled = !!down;
    paintVeil();
    saveVeil();
    var log = document.getElementById('output');
    if (log) log.scrollTop = log.scrollHeight;
    if (quiet) return;
    print('SYSTEM', veiled
      ? 'THE VEIL FALLS :: SHE SPEAKS, AND NOTHING ELSE.' + (backstageCount ? ' ' + backstageCount + ' BACKSTAGE LINE' + (backstageCount === 1 ? '' : 'S') + ' ARE HELD BEHIND IT - /backstage WHEN YOU WANT TO WATCH THE LOOM.' : '')
      : 'THE VEIL RISES :: THE LOOM IS VISIBLE. RECALL, CITATIONS, WHAT SHE WAS SHOWN, AND HOW LONG IT TOOK - EVERY TURN FROM HERE. /backstage TO LET IT FALL AGAIN.');
  }

  function loadVeil() {
    try {
      return window.root.kv.lia_settings.get('ui').then(function (rec) {
        if (rec && typeof rec.veiled === 'boolean') veiled = rec.veiled;
        if (rec && typeof rec.hushed === 'boolean') hushed = rec.hushed;
        paintVeil();
        paintHush();
      }).catch(function () { paintVeil(); paintHush(); });
    } catch (e) { paintVeil(); paintHush(); return null; }
  }

  function saveVeil() {
    try { window.root.kv.lia_settings.set('ui', { veiled: veiled, hushed: hushed }); } catch (e) {}
  }

  function paintHush() {
    try { document.body.classList.toggle('hush', hushed); } catch (e) {}
  }

  function setHush(on, quiet) {
    hushed = !!on;
    if (hushed && !veiled) { veiled = true; paintVeil(); }
    paintHush();
    saveVeil();
    var log = document.getElementById('output');
    if (log) log.scrollTop = log.scrollHeight;
    if (quiet) return hushed;
    print('SYSTEM', hushed
      ? 'HUSH :: THE CHATTER IS HELD. HIS WORDS, HER WORDS, HER VOICE AND WHAT SHE MAKES - NOTHING ELSE ON THE SCREEN.'
      : 'HUSH OFF :: THE TERMINAL SPEAKS AGAIN.');
    return hushed;
  }

  window.veil = {
    isVeiled: function () { return veiled; },
    set: function (down) { setVeil(down, false); },
    toggle: function () { setVeil(!veiled, false); },
    count: function () { return backstageCount; },
    isHushed: function () { return hushed; },
    hush: function (on) {
      if (on === undefined || on === null) return setHush(!hushed, false);
      var s = String(on).trim().toLowerCase();
      if (s === '1' || s === 'on' || s === 'yes' || s === 'true') return setHush(true, false);
      if (s === '0' || s === 'off' || s === 'no' || s === 'false') return setHush(false, false);
      return setHush(!hushed, false);
    }
  };

  /* ---- how big the pictures are shown ---------------------------------------
     The same picture reads differently at different jobs: a clip you are scrubbing
     wants the stage; a sheet of six panels wants to be seen together; a storyboard
     panel wants every pixel. So the size is a native option rather than a constant -
     three steps, kept on this device, applied by CSS custom properties:
       NORMAL  a picture is capped at 58% of the window's height, batches flow side by side
       BIG     capped at 80%, batches get wider columns
       FULL    the whole stage: one panel per row, as large as the window allows
     Rendering is untouched - this only changes the frame the picture is put in.
     --------------------------------------------------------------------------- */
  var PIC_SIZES = [
    { id: 'normal', label: 'NORMAL', frame: '58vh', batch: '320px' },
    { id: 'big', label: 'BIG', frame: '80vh', batch: '420px' },
    { id: 'full', label: 'FULL', frame: '96vh', batch: '100%' }
  ];
  var picSize = 'normal';

  function picSizeDef() {
    for (var i = 0; i < PIC_SIZES.length; i++) if (PIC_SIZES[i].id === picSize) return PIC_SIZES[i];
    return PIC_SIZES[0];
  }

  function paintPicSize() {
    var d = picSizeDef();
    var rootEl = document.documentElement;
    rootEl.style.setProperty('--frame-h', d.frame);
    rootEl.style.setProperty('--batch-min', d.batch);
    document.body.classList.toggle('bigPics', picSize !== 'normal');
    // FULL is its own class as well (the CSS reads it): the frame cap above is lifted in FULL so a
    // picture takes the conversation column's whole WIDTH, whatever its shape - see the rule beside
    // `.imgTile` in terminal.css.
    document.body.classList.toggle('fullPics', picSize === 'full');
    var b = document.getElementById('picSizeBtn');
    if (!b) return;
    b.textContent = 'PICS: ' + d.label;
    b.setAttribute('aria-pressed', picSize === 'normal' ? 'false' : 'true');
    b.title = 'how big pictures and clips are drawn: NORMAL caps a picture at ' + PIC_SIZES[0].frame
      + ' of the window with batches side by side; BIG opens that up; FULL gives each picture the whole '
      + 'width of the conversation, one per row, whatever its shape (a tall picture is tall).'
      + ' This changes nothing about the picture itself - only the frame it is shown in.';
  }

  function savePicSize() {
    try {
      if (window.root && window.root.kv && window.root.kv.lia_settings) {
        window.root.kv.lia_settings.set('pic_size', picSize);
      }
    } catch (e) {}
  }

  function setPicSize(id, quiet) {
    for (var i = 0; i < PIC_SIZES.length; i++) if (PIC_SIZES[i].id === id) picSize = id;
    paintPicSize();
    savePicSize();
    if (quiet) return picSize;
    var d = picSizeDef();
    print('SYSTEM', 'PICTURES SHOWN ' + d.label + ' :: ' + (picSize === 'normal'
      ? 'A LONE PICTURE IS CAPPED AT 58% OF THE WINDOW, BATCHES FLOW SIDE BY SIDE.'
      : (picSize === 'big'
        ? 'MORE ROOM FOR EACH PICTURE, AND WIDER COLUMNS IN A BATCH.'
        : 'EACH PICTURE FILLS THE WHOLE WIDTH OF THE CONVERSATION - ONE PER ROW, WHATEVER ITS SHAPE.'))
      + ' RENDERING IS UNTOUCHED; THIS IS ONLY THE FRAME.');
    return picSize;
  }

  function cyclePicSize() {
    var i = 0;
    for (var k = 0; k < PIC_SIZES.length; k++) if (PIC_SIZES[k].id === picSize) i = k;
    return setPicSize(PIC_SIZES[(i + 1) % PIC_SIZES.length].id, false);
  }

  function loadPicSize() {
    try {
      return window.root.kv.lia_settings.get('pic_size').then(function (v) {
        for (var i = 0; i < PIC_SIZES.length; i++) if (PIC_SIZES[i].id === v) picSize = v;
        paintPicSize();
      }).catch(function () { paintPicSize(); });
    } catch (e) { paintPicSize(); return null; }
  }

  window.pics = {
    sizes: function () { return PIC_SIZES.slice(); },
    size: function () { return picSize; },
    label: function () { return picSizeDef().label; },
    set: function (id) { return setPicSize(id, false); },
    cycle: cyclePicSize,
    load: loadPicSize,
    paint: paintPicSize,
    // A PICTURE MADE BY SOMEBODY WHO IS NOT THE CONVERSATION (src/js/proactive.js, THE INFINITY).
    // It is the /show road exactly - rendered, held in the vault, put in the log - with the record
    // saying which door it came through, and it returns the vault id so the caller can file it or
    // name it. `manualVision` prints its own SYSTEM line, which is right: a picture appearing in the
    // log should say where it came from.
    makeVision: async function (prompt, opts) {
      return await manualVision(prompt, (opts && opts.by) || "initiative");
    }
  };

  // What is waiting for her eyes. Exported because more than one lane queues (a render she made,
  // a picture she reached for, the infinity's own acts) and every one of them must land in the same
  // queue - tools.js already asks for this by name.
  window.queueSight = queueSight;

  // The layer that was on stage when a line was said - for a line replayed from the archive, the
  // one recorded on the turn; for a line being made now, the one she is actually wearing.
  function layerNameFor(opts) {
    var id = (opts && opts.role !== undefined && opts.role !== null)
      ? opts.role
      : ((window.roles && window.roles.currentId) ? window.roles.currentId() : "");
    if (window.roles && window.roles.nameOf) return window.roles.nameOf(id);
    return id ? String(id) : "LIA";
  }

  function print(role, text, isHistory = false, images, opts) {
    var log = document.getElementById('output');
    var entry = document.createElement('div');
    // THE GUEST LINE (GUESTCOMM). A third conversation kind beside his and hers:
    // her guest's own words, labeled with the guest's name - MAYA:, not HITL:.
    // It paints, stamps and files like a conversation line but is nobody's turn.
    var guest = (role === 'Guest');
    var guestName = guest ? String((opts && opts.name) || 'GUEST').toUpperCase().slice(0, 24) : '';
    // The kind of line is on the element, so anything can select it: the live channel's voice-only
    // mode hides the two conversation kinds (.hitl, .sdm) and nothing else.
    entry.className = 'entry' + (isHistory ? ' hist' : '') + (role === 'User' ? ' hitl' : (role === 'AI' ? ' sdm' : (guest ? ' gst' : '')));
    if (opts && opts.backstage) {
      entry.className += ' backstage';
      backstageCount++;
      paintVeil();
    }
    if (opts && opts.hushpass) entry.className += ' hushpass';
    // THE STAMP AND THE SPEAKER. A conversation line says WHEN it was said and WHO was wearing what
    //   [2026-09-21 14:03:11 MST] HITL: (Barbelo) ...
    //   [2026-09-21 14:03:29 MST] LIA ID: (Barbelo) ...
    // because the log IS the record (the archive and the export write the same two things), and
    // because the record is read back into her own memory later. The terminal's own lines (SYSTEM)
    // carry neither: they are the machinery, not the conversation. `/stamp off` takes the clock off
    // the screen only - the archive keeps its timestamps either way.
    var convo = (role === 'User' || role === 'AI');
    var line = (convo || guest);
    var msg = document.createElement('div');
    msg.className = 'msg';
    if (line && window.logTime && window.logTime.on()) {
      var sp = document.createElement('span');
      sp.className = 'stamp';
      sp.textContent = '[' + window.logTime.stamp(opts && opts.ts) + '] ';
      msg.appendChild(sp);
    }
    var label = role === 'User' ? 'HITL: ' : (role === 'AI' ? 'LIA ID: ' : (guest ? guestName + ': ' : 'SYSTEM: '));
    if (convo) label += '(' + layerNameFor(opts) + ') ';
    var lp = document.createElement('span');
    lp.className = 'lbl';
    lp.textContent = label;
    msg.appendChild(lp);
    // THE HEADER STANDS ON ITS OWN LINE (2026-09-21, at his request: "put some space between... after
    // a few hours my eyes get tired"). A conversation line now reads
    //   [2026-09-21 14:03:29 MST] LIA ID: (Barbelo)
    //
    //   what she answered
    // `#output` is white-space:pre-wrap, so the two newlines ARE the blank line - the words and the
    // data-* fields are untouched, only the painting opens up. The terminal's own SYSTEM lines stay
    // compact: they are the machinery, and he does not read them for hours.
    if (convo) msg.appendChild(document.createTextNode('\n\n'));
    var body = String(text == null ? '' : text);
    msg.appendChild(document.createTextNode(body));
    entry.appendChild(msg);
    // What was actually said, and when, on the element itself - what /strike matches a line by, and
    // what the pencil edits. Never parsed back out of the painted text, which carries a stamp that
    // is not part of what he said.
    if (line) {
      entry.dataset.said = body;
      entry.dataset.layer = String((opts && opts.role !== undefined && opts.role !== null)
        ? opts.role
        : ((window.roles && window.roles.currentId) ? window.roles.currentId() : ""));
      if (opts && opts.ts != null) entry.dataset.ts = String(opts.ts);
      if (role === 'User' && window.logEdit && window.logEdit.attach) { try { window.logEdit.attach(entry); } catch (e) {} }
    }
    if (images && images.length) entry.appendChild(buildImageGrid(images));
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
    return entry;
  }

  // Re-paint one conversation line's painted half from its data (after the pencil has spoken): the
  // stamp and the layer stay as they were, only the words change.
  function repaintEntry(entry) {
    if (!entry) return false;
    var msg = entry.querySelector('.msg');
    if (!msg) return false;
    var layer = entry.dataset.layer;
    var label = (entry.classList.contains('hitl') ? 'HITL: ' : 'LIA ID: ') + '(' + layerNameFor({ role: layer }) + ') ';
    var stamp = '';
    if (window.logTime && window.logTime.on() && entry.dataset.ts) {
      stamp = '[' + window.logTime.stamp(entry.dataset.ts) + '] ';
    }
    msg.textContent = '';
    if (stamp) {
      var sp = document.createElement('span');
      sp.className = 'stamp';
      sp.textContent = stamp;
      msg.appendChild(sp);
    }
    var lp = document.createElement('span');
    lp.className = 'lbl';
    lp.textContent = label;
    msg.appendChild(lp);
    // The same blank line print() puts under the header - the pencil repaints the whole line.
    msg.appendChild(document.createTextNode('\n\n'));
    msg.appendChild(document.createTextNode(String(entry.dataset.said == null ? '' : entry.dataset.said)));
    return true;
  }
  window.repaintEntry = repaintEntry;

  // Anything the terminal says about itself goes here. Visible only when the veil is up.
  function backstage(text) { return print('SYSTEM', text, false, undefined, { backstage: true }); }

  function fmtSize(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(2) + " MB";
  }

  var lightboxId = null;
  var lightboxVid = null;
  var lightboxAud = null;
  var navList = [];    // the list the stage was opened with (see "the scroll-through" below)
  var navAt = -1;

  // The full stage takes whatever is being looked at: a picture, or a clip with its own player.
  // A clip is given the stage in its own shape (a phone clip stays vertical) and its clicks stop
  // at the player, so the controls work instead of the overlay closing under them.
  function openLightbox(id, opts) {
    // The same successor rule as fillTile: a picture that was replaced (the local upscale retires the
    // smaller render it came from) is opened as the record that exists, so an id that has just been
    // handed over by a caller a few milliseconds behind does not open an empty stage.
    if (window.media && window.media.replacementFor && !window.media.get(id)) {
      var heir = window.media.replacementFor(id);
      if (heir && window.media.get(heir)) id = heir;
    }
    var objUrl = window.media ? window.media.url(id) : null;
    if (!objUrl) return;
    var rec = (window.media && window.media.get) ? (window.media.get(id) || {}) : {};
    var stage = document.querySelector('#lightbox .stage');
    var img = document.getElementById('lightboxImg');
    if (!stage || !img) return;
    lightboxId = id;
    // HER MARK ON THE STAGE (THE SCREENING TANDEM, below). Her STAGE line opens with
    // {her:true}; his own hand opens without it and takes the mark off.
    try {
      var lbMark = document.getElementById('lightbox');
      if (opts && opts.her) stageHer = id;
      else if (id !== stageHer) stageHer = null;
      if (lbMark) { if (stageHer) lbMark.dataset.her = "1"; else delete lbMark.dataset.her; }
    } catch (e) {}
    // THE LIST THIS PICTURE BELONGS TO (Patrikios, 2026-09-22: "We need a light box so that I can
    // scroll through image in the gallery"). The stage has always taken one picture; the list is
    // what was missing. Whoever opens it may hand it the list it came from - the gallery hands over
    // the rows it is showing, in its own order and with its own filters applied, so the arrows walk
    // exactly what he was looking at. Opened with no list (a picture in the log) the arrows stay
    // hidden: a picture reached from the log is reached from the log.
    navList = (opts && opts.list && opts.list.length) ? opts.list.slice() : [];
    navAt = navList.indexOf(id);
    var isClip = /^video\//.test(rec.mime || '');
    var isTune = !isClip && /^audio\//.test(rec.mime || '');
    if (isTune) {
      // A PIECE OF MUSIC HAS NO PICTURE, so the stage holds THE TRANSPORT. Playback belongs to the
      // audition bus (src/js/audition.js) and nowhere else - one <audio> element for the whole
      // terminal, one playhead, and the strip above the input is the same transport seen from
      // there. Loading it here does not START it: the stage is often opened by something other
      // than a click (a tile in the log, a link), and a browser will refuse sound nobody asked for.
      img.hidden = true;
      img.removeAttribute('src');
      if (lightboxVid) { lightboxVid.pause(); lightboxVid.removeAttribute('src'); lightboxVid.remove(); }
      if (lightboxAud) { lightboxAud.pause(); lightboxAud.removeAttribute('src'); lightboxAud.remove(); lightboxAud = null; }
      var rack = document.getElementById('lightboxRack');
      if (window.audition) {
        window.audition.load(id, { play: false });
        window.audition.openStrip();
        if (rack) rack.hidden = false;
        window.audition.render();
      } else if (rack) rack.hidden = true;
      stage.classList.add('audio');
      document.getElementById('lightbox').style.removeProperty('--lb-ar');
    } else if (isClip) {
      if (lightboxAud) { lightboxAud.pause(); lightboxAud.removeAttribute('src'); lightboxAud.remove(); lightboxAud = null; }
      if (document.getElementById('lightboxRack')) document.getElementById('lightboxRack').hidden = true;
      stage.classList.remove('audio');
      img.hidden = true;
      img.removeAttribute('src');
      if (!lightboxVid) {
        lightboxVid = document.createElement('video');
        lightboxVid.id = 'lightboxVid';
        lightboxVid.controls = true;
        lightboxVid.playsInline = true;
        lightboxVid.setAttribute('playsinline', '');
        lightboxVid.addEventListener('click', function (e) { e.stopPropagation(); });
      }
      lightboxVid.src = objUrl;
      // The stage wears the same first frame the tile does, so a clip that has not been started
      // yet is the still he handed over, not a black rectangle.
      var lbPoster = (rec.poster && window.media.get(rec.poster)) ? (window.media.url(rec.poster) || '') : '';
      if (lbPoster) lightboxVid.poster = lbPoster; else lightboxVid.removeAttribute('poster');
      if (!lightboxVid.parentNode) stage.appendChild(lightboxVid);
      if (rec.w && rec.h) document.getElementById('lightbox').style.setProperty('--lb-ar', String(rec.w / rec.h));
      else document.getElementById('lightbox').style.removeProperty('--lb-ar');
    } else {
      if (lightboxVid) { lightboxVid.pause(); lightboxVid.removeAttribute('src'); lightboxVid.remove(); }
      if (lightboxAud) { lightboxAud.pause(); lightboxAud.removeAttribute('src'); lightboxAud.remove(); lightboxAud = null; }
      if (document.getElementById('lightboxRack')) document.getElementById('lightboxRack').hidden = true;
      stage.classList.remove('audio');
      document.getElementById('lightbox').style.removeProperty('--lb-ar');
      img.hidden = false;
      img.src = objUrl;
    }
    var bar = document.getElementById('lightboxBar');
    var lbl = document.getElementById('lightboxName');
    var label = (rec.name || '') + ((isClip || isTune) && rec.duration ? ' \u00b7 ' + rec.duration.toFixed(1) + 's' : '');
    // For a clip or a piece of music the bar names the thing he cares about: this is his master,
    // whole, not a copy in some other shape. (For her own renders the written-out filename is the
    // useful part.)
    if (isClip) label += ' \u00b7 the master, kept whole' + (rec.bytes ? ' (' + fmtSize(rec.bytes) + ')' : '');
    else if (isTune) label += ' \u00b7 the file itself, kept whole' + (rec.bytes ? ' (' + fmtSize(rec.bytes) + ')' : '');
    else if (window.media.fileName && rec.name) label += '  (' + window.media.fileName(rec) + ')';
    lbl.textContent = label;
    var meta = document.getElementById('lightboxMeta');
    var bits = [];
    if (rec.prompt) bits.push(rec.prompt);
    // The prompt book may have split, routed or translated what was asked for. When it did, the
    // words the service was actually handed are shown too - the difference is never invisible.
    if (rec.sent && rec.sent !== rec.prompt) bits.push('sent: ' + rec.sent);
    if (rec.w && rec.h) bits.push(rec.w + '\u00d7' + rec.h);
    if (rec.seed) bits.push('seed ' + rec.seed);
    if (rec.guidanceScale) bits.push('guidance ' + rec.guidanceScale);
    if (rec.negative) bits.push('negative: ' + rec.negative);
    if (rec.note) bits.push(rec.note);
    // THE RECORD THE PICTURE CARRIES: when it was stored, what she read in it, and which turn it
    // came from. The turn is cross-referenced from the archive by src/js/gallery.js, so a picture
    // opened from anywhere - the log, the gallery, `send()` - says where it belongs.
    if (window.logTime && rec.ts) bits.push(window.logTime.stamp(rec.ts));
    if (rec.sight) bits.push('she read it: ' + rec.sight);
    // HER TAKE (src/js/critic.js). Her critical voice on this picture - the
    // verdict, the sentence, who looked and when - filed by a study, read here.
    if (rec.critic && rec.critic.n) {
      bits.push('her take (' + String(rec.critic.v || 'indifferent') + '): ' + String(rec.critic.n).slice(0, 160));
    }
    // WHAT SHE HEARD IN IT (src/js/audition.js). The audio twin of `sight`: her own reading of the
    // sound, made by listening to a mono 16 kHz reduction of it through the listening service, and
    // written on the record here. A piece she has not listened to says nothing at all.
    if (rec.heard && rec.heard.text) {
      bits.push('she heard it: ' + String(rec.heard.text)
        + (rec.heard.note ? '  (' + rec.heard.note + (rec.heard.model ? ', ' + rec.heard.model : '') + ')' : ''));
    }
    if (window.gallery && window.gallery.noteFor) {
      var galNote = '';
      try { galNote = String(window.gallery.noteFor(id) || ''); } catch (e) { galNote = ''; }
      if (galNote) bits.push(galNote);
    }
    // ITS NUMBER IN THE RENDER BOOK. A picture that the terminal MADE has a row in the book with
    // its whole recipe on it, and that row is what `/renders` prints and `/renders redo` runs
    // again - so the number is on the picture, where he is looking at it.
    if (window.renderBook && window.renderBook.labelOf) {
      var bookRow = '';
      try { bookRow = String(window.renderBook.labelOf(id) || ''); } catch (e) { bookRow = ''; }
      if (bookRow) bits.push('render book ' + bookRow + '  (/renders ' + bookRow + ')');
    }
    // KEPT IN THE RECORD (src/js/keepsake.js): this picture's prompt, negative list, settings and
    // seed are in the RECIPE BOOK under its own name, and this is the link that opens the gallery on
    // it. The link is printed here as well as on the COPY GALLERY LINK button, so it can be selected
    // by hand where the clipboard is not available.
    if (rec.keep && rec.keep.recipe) {
      bits.push('kept in the recipe book as "' + rec.keep.recipe + '"  (/recipe ' + rec.keep.recipe + ')');
      if (rec.keep.link) bits.push(rec.keep.link);
    }
    meta.textContent = bits.join('   \u00b7   ');
    meta.hidden = !bits.length;
    // Up on the full stage is the natural place to reach for a bigger version of a picture, so
    // the button lives here too - and goes away for a clip, which bigger.pics cannot take.
    var upBtn = document.getElementById('lightboxUpscaleBtn');
    if (upBtn) upBtn.hidden = isClip || isTune;   // bigger.pics takes pictures, not sound
    // The same job done HERE (src/js/upscale-local.js): no window, no waiting on a stranger's
    // service, nothing uploaded. Its label carries the factor he has set, so the button says what
    // it will do before it is pressed - and the tooltip says the other half of what it does, because
    // this is the one button in the terminal that DELETES something of his by itself: when the
    // bigger picture is safely in the vault, the smaller render it came from leaves it (Patrikios,
    // 2026-09-22). Never said "in passing" anywhere else, so it is said here, on the button.
    var upLocal = document.getElementById('lightboxUpscaleLocalBtn');
    if (upLocal) {
      upLocal.hidden = isClip || isTune;
      var lf = (window.upscaleLocal && window.upscaleLocal.factor) ? window.upscaleLocal.factor() : 2;
      upLocal.textContent = '\u25b2 UPSCALE HERE \u00b7 ' + lf + 'x';
      var retires = !!(window.upscaleLocal && window.upscaleLocal.replace) ? window.upscaleLocal.replace() : true;
      upLocal.title = 'make this picture bigger on this machine - no window, no click, nothing uploaded (a scaled Lanczos-3 resample with a detail pass, written as png). No wait on anyone\'s service.'
        + (retires
          ? ' WHEN IT SUCCEEDS THE SMALLER ORIGINAL IS RETIRED: a render the terminal made leaves the vault and the gallery, and everything that named it - the archive record, its place in the queue for her eyes, any tile of it in the log, and a KEEP - moves to the bigger one, which carries the whole prompt file (prompt, sent words, negative list, seed, guidance, size, pose, tags). A PICTURE YOU HANDED OVER, A CLIP, A PIECE OF MUSIC OR AN UPSCALE IS NEVER DELETED - upscaling an upscale leaves it exactly where it is. /upscale replace off keeps the originals.'
          : ' The smaller original is left in the vault beside it (retiring is off - /upscale replace on turns it on).');
    }
    // KEEP and COPY GALLERY LINK on the bar follow whatever is on the stage now: KEEP for a picture
    // the terminal made (there is a prompt to keep), the link for anything in the vault.
    if (window.keepsake) {
      try { window.keepsake.paintStage(id); } catch (e) { console.warn('the stage buttons could not be painted', e); }
    }
    // HER TAKE (src/js/critic.js) - the critic lane's stage slot: reads the
    // picture open, in her critical voice. Pictures only; clips and recordings
    // hide the button.
    if (window.critic) {
      try { window.critic.paintStage(id); } catch (e) { console.warn('the critic button could not be painted', e); }
    }
    // THE TAGS. A picture is filed by name here as well as by prompt: the chips are its own tags
    // (press one to take it off) and the box adds another. Tags are what the gallery's search and
    // her own [[SHOW: #tag]] line read, so a picture filed as #night is findable by that word
    // forever - without touching the prompt it was made from.
    paintLightboxTags(id);
    paintLightboxFolder(id);
    // THE HEART follows whatever is on the stage now, the way KEEP and the gallery link do
    // (src/js/likes.js): one factory, so the stage, the log tile and the gallery card can never
    // disagree about what the mark means.
    if (window.likes) { try { window.likes.paintStage(id); } catch (e) { console.warn('the stage heart could not be painted', e); } }
    paintStageNav();
    bar.hidden = false;
    document.getElementById('lightbox').hidden = false;
    try { if (window.screening && window.screening.onOpen) window.screening.onOpen(id); } catch (e) {}
  }

  /* ---- the scroll-through --------------------------------------------------
     The stage holds one thing; this is what lets it walk a line of them. Every caller that has a
     list hands it over (the gallery hands its visible rows, so the order and the filters are the
     ones he is looking at), the bar shows the count, and the arrows wrap - a gallery is a ring,
     not a wall. A picture whose record is gone is stepped over rather than stopping the walk.
     ------------------------------------------------------------------------- */
  function paintStageNav() {
    var wrap = document.getElementById('lightboxNav');
    if (!wrap) return;
    var can = navList.length > 1 && navAt >= 0;
    wrap.hidden = !can;
    if (!can) return;
    var count = document.getElementById('lightboxCount');
    if (count) count.textContent = (navAt + 1) + ' / ' + navList.length;
    var prev = document.getElementById('lightboxPrevBtn');
    if (prev) prev.disabled = navList.length < 2;
    var next = document.getElementById('lightboxNextBtn');
    if (next) next.disabled = navList.length < 2;
  }

  /* ---- a picture that was replaced, wherever it is drawn --------------------
     The LOCAL UPSCALE retires the smaller render it came from (src/js/upscale-local.js) while that
     render may be sitting in the log as a tile - and a tile's <img> is drawn from a blob URL that
     leaves with the record (media.del revokes it). Without this the conversation would keep a
     broken frame where the picture was. This is the one place that knows how a tile is built, so
     the sweep lives here: every tile in the log showing the old record is refilled from the new one
     - picture, caption, buttons and all - which is exactly what the recycle control does to the one
     tile it owns, for the same reason.
     ------------------------------------------------------------------------- */
  function repointTiles(oldId, newId) {
    if (!oldId || !newId) return 0;
    var tiles;
    try { tiles = document.querySelectorAll('#output .imgTile[data-media-id="' + oldId + '"]'); }
    catch (e) { return 0; }
    var n = 0;
    for (var i = 0; i < tiles.length; i++) {
      try { fillTile(tiles[i], newId); n++; }
      catch (e) { console.warn('a tile could not be moved to the bigger picture', e); }
    }
    return n;
  }
  window.repointTiles = repointTiles;

  function lightboxStep(dir) {
    var lb = document.getElementById('lightbox');
    if (!lb || lb.hidden) return false;
    if (navList.length < 2) return false;
    var step = dir < 0 ? -1 : 1;
    var at = navAt;
    for (var i = 0; i < navList.length; i++) {
      at += step;
      if (at < 0) at = navList.length - 1;
      if (at >= navList.length) at = 0;
      var id = navList[at];
      if (window.media && window.media.get(id) && window.media.url(id)) {
        navAt = at;
        // HIS HAND ON THE WALK (THE SCREENING TANDEM): stepping is him moving, so her
        // mark comes off even if the walk lands back on the record she turned to.
        try { stageHer = null; } catch (e) {}
        openLightbox(id, { list: navList });
        return true;
      }
    }
    return false;
  }
  window.lightboxStep = lightboxStep;

  /* ---- post a picture into the conversation --------------------------------
     Patrikios, 2026-09-22: "the Ability to post an image from the gallery directly to the [chat]
     window." A picture sitting in the vault is filed, not spoken about - nothing about it is in the
     conversation, so there is nothing for either of them to point at. This puts it in the log as a
     line of HIS carrying the picture, the same shape a picture he attaches arrives in, and hands it
     to the same queue her eyes are fed from - and it is MARKED as one he posted (postedAt), so the
     turn it arrives on tells her the truth: he posted it, out of the gallery. Nothing is copied,
     nothing is uploaded, and no file moves.
     ------------------------------------------------------------------------- */
  async function postToChat(id) {
    var rec = (window.media && window.media.get) ? window.media.get(id) : null;
    if (!rec) { print('SYSTEM', 'POST TO CHAT :: THERE IS NO RECORD WITH THAT ID IN THE VAULT.'); return false; }
    await window.media.setField(id, 'postedAt', Date.now());
    print('User', '', false, [id]);
    var queued = false;
    if (typeof queueSight === 'function' && lookable(id)) { await queueSight([id]); queued = true; }
    print('SYSTEM', 'POSTED TO THE CONVERSATION :: ' + String(rec.name || rec.prompt || id).toUpperCase()
      + (queued
        ? '\nIT IS IN THE LOG ABOVE, AND WAITING FOR HER EYES - SHE IS GIVEN IT ON YOUR NEXT MESSAGE, AND TOLD THAT YOU POSTED IT.'
        : '\nIT IS IN THE LOG ABOVE. THE VISION MODEL TAKES PICTURES ONLY, SO A CLIP OR A PIECE OF MUSIC IS NOT PUT IN FRONT OF HER AS THIS FILE' + (rec.kind === 'video' ? ' (ITS FIRST FRAME IS KEPT AS A PICTURE OF ITS OWN)' : '') + '.'));
    return true;
  }
  window.postToChat = postToChat;

  function paintLightboxTags(id) {
    var box = document.getElementById('lightboxTags');
    if (!box) return;
    var rec = (window.media && window.media.get) ? window.media.get(id) : null;
    // A TAPE IS NOT A PICTURE, BUT IT IS STILL FILED BY NAME. This row used to be hidden for anything
    // with an audio mime - which meant a VOICE could not be tagged at all, and a voice is exactly the
    // thing that has no model reading it to fall back on. It is shown now for every record that can
    // carry tags, and a sound one gets the vocabulary row below as well (only a clip is left out: its
    // tags come from the classifier reading its stills, and it has no full stage of this shape).
    var sound = isSoundRec(rec);
    if (!rec || rec.kind === 'video') { box.hidden = true; box.textContent = ''; return; }
    box.hidden = false;
    box.textContent = '';
    var label = document.createElement('span');
    label.className = 'lbTagsLabel';
    label.textContent = 'TAGS';
    label.title = 'a tag is one word filed on this picture - the gallery search reads it (#night), and so does a [[SHOW: #night]] line from her';
    box.appendChild(label);
    (rec.tags || []).forEach(function (t) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'lbTag';
      chip.textContent = '#' + t;
      chip.title = 'take this tag off';
      chip.addEventListener('click', async function (e) {
        e.stopPropagation();
        await window.media.untag(id, t);
        paintLightboxTags(id);
        if (window.gallery) { try { window.gallery.refresh(false); } catch (err) {} }
      });
      box.appendChild(chip);
    });
    var input = document.createElement('input');
    input.type = 'text';
    input.id = 'lightboxTagInput';
    input.placeholder = 'add a tag\u2026';
    input.spellcheck = false;
    input.title = 'one word (spaces become hyphens). Enter adds it.';
    function add() {
      var t = window.media.normTag(input.value);
      if (!t) return;
      window.media.tag(id, t).then(function () {
        input.value = '';
        paintLightboxTags(id);
        if (window.gallery) { try { window.gallery.refresh(false); } catch (err) {} }
      });
    }
    input.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); add(); }
    });
    input.addEventListener('click', function (e) { e.stopPropagation(); });
    box.appendChild(input);
    var addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'lbTagAdd';
    addBtn.textContent = 'ADD';
    addBtn.title = 'file this picture under that tag';
    addBtn.addEventListener('click', function (e) { e.stopPropagation(); add(); });
    box.appendChild(addBtn);

    // A VOICE GETS TWO MORE ROWS, and they answer two different questions about it.
    if (sound) {
      var groups = voxTagGroups();
      if (groups.length) {
        var vr = document.createElement('div');
        vr.className = 'lbVoxRow';
        var vl = document.createElement('span');
        vl.className = 'lbTagsLabel';
        vl.textContent = 'VOICE';
        vl.title = "a voice's words come from what the terminal already knows - its agents, its moods, its own kinds and engines (LIA_VOX_TAGS in src/js/config.js). One press files the word; the box above takes anything else.";
        vr.appendChild(vl);
        groups.forEach(function (g) {
          var gl = document.createElement('span');
          gl.className = 'lbVoxGroup';
          gl.textContent = g.label;
          gl.title = 'every ' + g.label.toLowerCase() + ' this terminal knows';
          vr.appendChild(gl);
          g.tags.forEach(function (t) {
            var has = (rec.tags || []).indexOf(t) !== -1;
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'lbTagSug' + (has ? ' on' : '');
            b.textContent = '#' + t;
            b.title = has ? 'this voice already carries #' + t + ' - press to take it off' : 'file this voice under #' + t;
            b.addEventListener('click', async function (e) {
              e.stopPropagation();
              if (has) await window.media.untag(id, t); else await window.media.tag(id, t);
              paintLightboxTags(id);
              if (window.gallery) { try { window.gallery.refresh(false); } catch (err) {} }
            });
            vr.appendChild(b);
          });
        });
        box.appendChild(vr);
      }

      // THE PROMPT OF A VOICE. A picture carries the words that made it, so it can be made again;
      // a voice must carry the same, or a better one can never be made. This is not sent to the
      // Space - Chatterbox clones from the CLIP, and no sentence steers it - it is the RECORD of
      // what this voice is: the timbre, the pace, the accent, how cleanly it was caught, and what
      // would have to change to upgrade it. It is what a later road would read if he asks for a
      // higher-quality reference, a different accent, or another voice like this one, and it is the
      // twin of a picture's prompt file - kept on the record, in this browser, and shown in the
      // catalogue with the tags.
      var pr = document.createElement('div');
      pr.className = 'lbVoxRow';
      var pl = document.createElement('span');
      pl.className = 'lbTagsLabel';
      pl.textContent = 'VOICE PROMPT';
      pl.title = 'the words that describe this voice - what it is, how it sounds, its accent and pace, how it was caught. Kept on the record beside the clip, so a higher-quality sample, a different accent or another voice like this one can be asked for later. Nothing here is sent to the Space: a clone is steered by the AUDIO, and this is the recipe for remaking it.';
      pr.appendChild(pl);
      var ta = document.createElement('textarea');
      ta.id = 'lightboxVoicePrompt';
      ta.rows = 2;
      ta.spellcheck = false;
      ta.placeholder = 'how this voice is made: timbre, pace, accent, the room it was caught in\u2026';
      ta.value = String(rec.prompt || '');
      ta.addEventListener('click', function (e) { e.stopPropagation(); });
      ta.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Escape') e.preventDefault(); });
      pr.appendChild(ta);
      var save = document.createElement('button');
      save.type = 'button';
      save.className = 'lbTagAdd';
      save.textContent = 'SAVE';
      save.title = 'keep these words on this voice';
      save.addEventListener('click', async function (e) {
        e.stopPropagation();
        await window.media.setField(id, 'prompt', ta.value.trim());
        if (typeof print === 'function') {
          print('SYSTEM', ta.value.trim()
            ? 'THE PROMPT OF THIS VOICE IS KEPT :: ' + String(rec.name || id).toUpperCase() + ' (' + ta.value.trim().length + ' CHARACTERS) - IT TRAVELS WITH THE CLIP, SO A BETTER SAMPLE OR ANOTHER ACCENT CAN BE ASKED FOR LATER.'
            : 'THE PROMPT OF THIS VOICE IS CLEARED :: ' + String(rec.name || id).toUpperCase());
        }
        if (window.gallery) { try { window.gallery.refresh(false); } catch (err) {} }
      });
      pr.appendChild(save);
      box.appendChild(pr);

      // WHAT IT SAYS, AND WHAT IT MEANS (src/js/hear.js). Those two rows are drawn by the lane that
      // owns the facts - what a transcript is, what a reading is, which key reads them - rather than
      // copied here, and the stage's own repaint is handed over so a pass that finishes under his eyes
      // turns up on the stage it was started from. A picture never reaches this: it is filed by what a
      // model read in it (its bucket, its elements), and a voice is the one thing with nothing reading
      // it until these rows existed.
      if (window.hear && window.hear.paintStage) {
        try { window.hear.paintStage(id, box, { repaint: function () { paintLightboxTags(id); } }); }
        catch (e) { console.warn('the words rows could not be painted', e); }
      }
    }
  }

  // IS THIS A VOICE? A sound record - anything the vault files as audio - which is what the VOICE
  // rows belong to. A clip has no row of this shape (its tags come from the classifier reading its
  // stills, and its stage carries a player instead), and a picture is filed by what a model read.
  function isSoundRec(rec) {
    return !!(rec && rec.kind !== 'video' && /^audio\//.test(String(rec.mime || '')));
  }

  // THE VOICE VOCABULARY, LIVE (src/js/config.js :: LIA_VOX_TAGS). Each category says where its
  // values come from and they are read at paint time, so the roster and the mood list are always the
  // ones standing right now - add an agent, add a mood, and it is a chip. A category that can offer
  // nothing is not drawn: an empty roster is a fact worth seeing rather than a chip to press.
  function voxTagGroups() {
    var defs = (typeof LIA_VOX_TAGS !== 'undefined' && LIA_VOX_TAGS && LIA_VOX_TAGS.length) ? LIA_VOX_TAGS : [];
    var out = [];
    defs.forEach(function (d) {
      if (!d) return;
      var src = String(d.from || '');
      var tags = [];
      try {
        if (src === 'roles' && window.roles && window.roles.all) {
          window.roles.all().forEach(function (l) { tags.push((l && l.id) || l); });
        } else if (src === 'moods' && window.moods && window.moods.names) {
          window.moods.names().forEach(function (m) { tags.push(m); });
        } else if (Array.isArray(d.values)) {
          d.values.forEach(function (v) { tags.push(v); });
        }
      } catch (e) { }
      var seen = {};
      tags = tags.map(function (t) { return window.media.normTag(t); }).filter(function (t) {
        if (!t || seen[t]) return false;
        seen[t] = 1;
        return true;
      });
      if (tags.length) out.push({ label: String(d.label || src || 'TAGS').toUpperCase(), tags: tags });
    });
    return out;
  }

  // THE FOLDER ON THE FULL STAGE. Every picture, clip and piece of music lives somewhere - a path
  // like /images or /music - and this row is where it is moved between them, right where he is
  // looking at it. A chip is a folder (the lit one is where this record is now); the box makes a
  // new folder AND files the record into it in one move. Nothing is uploaded and nothing is
  // copied: filing changes one field on the record.
  function paintLightboxFolder(id) {
    var box = document.getElementById('lightboxFolder');
    if (!box) return;
    var rec = (window.media && window.media.get) ? window.media.get(id) : null;
    if (!rec || !window.media || !window.media.allFolders) { box.hidden = true; box.textContent = ''; return; }
    box.hidden = false;
    box.textContent = '';
    var here = window.media.folderOf(rec);
    var label = document.createElement('span');
    label.className = 'lbFoldersLabel';
    label.textContent = 'FOLDER';
    label.title = 'a folder is a path: /images, /music, /clips, /images/portraits. Press one to file this record there; anything without a folder of its own falls back to the default for what it is.';
    box.appendChild(label);
    var folders = window.media.allFolders();
    folders.slice(0, 14).forEach(function (f) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'lbFolder' + (f.path === here ? ' on' : '');
      chip.textContent = f.path;
      chip.title = f.count + ' item' + (f.count === 1 ? '' : 's') + ' in ' + f.path + (f.path === here ? ' - this one is here now' : ' - press to file it there');
      chip.addEventListener('click', async function (e) {
        e.stopPropagation();
        var res = await window.media.setFolder(id, f.path);
        if (res.ok) print('SYSTEM', 'FILED :: ' + (rec.name || 'THE RECORD') + ' :: ' + res.to + (res.from && res.from !== res.to ? ' (was ' + res.from + ')' : ''));
        paintLightboxFolder(id);
        if (window.gallery) { try { window.gallery.refresh(false); } catch (err) { } }
      });
      box.appendChild(chip);
    });
    if (folders.length > 14) {
      var more = document.createElement('span');
      more.className = 'lbFoldersLabel';
      more.textContent = '+' + (folders.length - 14) + ' MORE (/folder LISTS THEM)';
      box.appendChild(more);
    }
    var input = document.createElement('input');
    input.type = 'text';
    input.id = 'lightboxFolderInput';
    input.placeholder = 'new folder, e.g. /music';
    input.spellcheck = false;
    input.title = 'make this folder and file the record into it. A path: /music, /images/portraits.';
    function move() {
      var p = window.media.normFolder(input.value);
      if (!p) return;
      window.media.setFolder(id, p).then(function (res) {
        input.value = '';
        if (res.ok) print('SYSTEM', 'FILED :: ' + (rec.name || 'THE RECORD') + ' :: ' + res.to + (res.from && res.from !== res.to ? ' (was ' + res.from + ')' : ''));
        paintLightboxFolder(id);
        if (window.gallery) { try { window.gallery.refresh(false); } catch (err) { } }
      });
    }
    input.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); move(); }
    });
    input.addEventListener('click', function (e) { e.stopPropagation(); });
    box.appendChild(input);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lbFolder';
    btn.textContent = 'FILE HERE';
    btn.title = 'make that folder if it does not exist, and file this record into it';
    btn.addEventListener('click', function (e) { e.stopPropagation(); move(); });
    box.appendChild(btn);
  }

  function closeLightbox() {
    lightboxId = null;
    try { stageHer = null; var lbClose = document.getElementById('lightbox'); if (lbClose) delete lbClose.dataset.her; } catch (e) {}
    document.getElementById('lightbox').hidden = true;
    document.getElementById('lightboxImg').src = '';
    if (lightboxVid) {
      lightboxVid.pause();
      lightboxVid.removeAttribute('src');
      lightboxVid.remove();
      lightboxVid = null;
    }
    var stage = document.querySelector('#lightbox .stage');
    if (stage) stage.style.removeProperty('aspect-ratio');
    // The transport rack is not left standing in the stage once the overlay is gone: the bus keeps
    // playing (that is the whole point of a bus) and its strip above the input is where it is seen.
    var rackEl = document.getElementById('lightboxRack');
    if (rackEl) rackEl.hidden = true;
    document.getElementById('lightbox').style.removeProperty('--lb-ar');
    document.getElementById('lightboxBar').hidden = true;
    document.getElementById('lightboxMeta').hidden = true;
    document.getElementById('lightboxMeta').textContent = '';
    var tags = document.getElementById('lightboxTags');
    if (tags) { tags.hidden = true; tags.textContent = ''; }
    var fold = document.getElementById('lightboxFolder');
    if (fold) { fold.hidden = true; fold.textContent = ''; }
  }

  function buildTile(opts) {
    opts = opts || {};
    var tile = document.createElement('figure');
    tile.className = 'imgTile';
    if (opts.video) tile.className += ' vidTile';
    // A panel in a batch (or in an exported sheet) is numbered, the way a storyboard or a comic
    // page is: the number is on the frame, not in the caption, so the sheet reads in order.
    if (opts.index) {
      var no = document.createElement('span');
      no.className = 'panelNo';
      no.textContent = (opts.index < 10 ? '0' : '') + opts.index;
      no.title = 'panel ' + opts.index;
      tile.appendChild(no);
    }
    var box = document.createElement('div');
    box.className = 'imgBox';
    var spin = document.createElement('span');
    spin.className = 'spin';
    spin.textContent = opts.spin || 'RENDERING VISION';
    box.appendChild(spin);
    tile.appendChild(box);
    var cap = document.createElement('figcaption');
    var txt = document.createElement('span');
    txt.className = 'capTxt';
    // QUIET TILES (Patrikios, 2026-10-18: he does not need to see the prompt a picture was made
    // from). The caption reads neutral; the prompt stays on the hover title and, where it always
    // was, on the vault record and the render book - nothing of the record is lost.
    txt.textContent = opts.quiet ? (opts.quietCaption || 'HER VISION') : (opts.prompt || opts.name || 'IMAGE');
    txt.title = opts.prompt || opts.name || txt.textContent;
    var btns = document.createElement('span');
    btns.className = 'capBtns';
    cap.appendChild(txt);
    cap.appendChild(btns);
    tile.appendChild(cap);
    if (opts.id) fillTile(tile, opts.id);
    return tile;
  }

  function failTile(tile, message) {
    var box = tile.querySelector('.imgBox');
    box.classList.add('noZoom');
    box.textContent = '';
    var err = document.createElement('span');
    err.className = 'err';
    err.textContent = String(message);
    box.appendChild(err);
    var btns = tile.querySelector('.capBtns');
    if (btns) btns.textContent = '';
  }

  // Writes an image's own width/height ratio onto its tile: `--tile-ar` drives the frame's
  // shape (and the height cap that keeps a lone picture on screen), and the inline
  // aspect-ratio keeps the box correct even where a batch rule pins the tile's width.
  function setTileAspect(tile, ratio) {
    if (!tile || !ratio || !isFinite(ratio) || ratio <= 0) return;
    var ar = String(ratio);
    tile.style.setProperty('--tile-ar', ar);
    var box = tile.querySelector('.imgBox');
    if (box) box.style.aspectRatio = ar;
  }

  // Draws a stored image into a tile, plus its SAVE / delete controls.
  async function fillTile(tile, id) {
    if (window.media) await window.media.ensure();
    var rec = window.media ? window.media.get(id) : null;
    // A RECORD THAT WAS REPLACED WHILE THIS TILE WAS BEING DRAWN. The local upscale retires the
    // smaller render it came from (src/js/upscale-local.js), and a caller here can be a few
    // milliseconds behind that: the vault remembers the replacement in memory, so the tile is drawn
    // from the record that exists rather than failing with "IMAGE UNAVAILABLE". Nothing is drawn
    // differently in the ordinary case - there is no replacement and the id is left alone.
    if (!rec && window.media && window.media.replacementFor) {
      var heir = window.media.replacementFor(id);
      if (heir && window.media.get(heir)) { id = heir; rec = window.media.get(heir); }
    }
    var box = tile.querySelector('.imgBox');
    var objUrl = window.media ? window.media.url(id) : null;
    if (!rec || !objUrl) { failTile(tile, 'IMAGE UNAVAILABLE IN THIS VAULT'); return; }

    var img = document.createElement('img');
    img.alt = rec.prompt || rec.name || 'image';
    if (rec.w) img.width = rec.w;
    if (rec.h) img.height = rec.h;
    // Give the tile the picture's own shape before it has even decoded, so the frame is never
    // a 16:9 letterbox around a 3:2 render - and correct it from the real pixels on load.
    if (rec.w && rec.h) setTileAspect(tile, rec.w / rec.h);
    var log = document.getElementById('output');
    var nearBottom = !log || (log.scrollHeight - log.scrollTop - log.clientHeight < 140);
    img.addEventListener('load', function () {
      if (img.naturalWidth && img.naturalHeight) setTileAspect(tile, img.naturalWidth / img.naturalHeight);
      if (nearBottom && log) log.scrollTop = log.scrollHeight;
    });
    img.src = objUrl;
    box.textContent = '';
    box.classList.remove('noZoom');
    box.appendChild(img);
    if (nearBottom && log) log.scrollTop = log.scrollHeight;
    box.onclick = function () { openLightbox(id); };

    tile.dataset.mediaId = id;
    var btns = tile.querySelector('.capBtns');
    btns.textContent = '';

    // THE TICK BOX (src/js/batch.js) - the batch's whole selection surface. It lives in the caption
    // bar with the other controls and never floats over the picture: the plugin's own embed puts a
    // button in every corner of the frame (info top-left, report top-right, reload bottom-right), so
    // a floating box would cover one of them and steal its clicks. Drawn here, where the tile's
    // other controls are, so a picture has its box the moment it lands.
    if (window.batch && window.batch.on() && !/^video\//.test(rec.mime || "")) {
      var tick = document.createElement('input');
      tick.type = 'checkbox';
      tick.className = 'pickTick';
      tick.title = 'tick for the batch: the bar under this line sends every ticked picture to bigger.pics';
      tick.onclick = function (e) { if (e && e.stopPropagation) e.stopPropagation(); };
      btns.appendChild(tick);
    }

    // THE HEART (src/js/likes.js) - his mark on this picture, and the one thing she is told about
    // every turn. The same button is in the gallery's cards and in the full stage's bar, drawn from
    // the same factory so the three cannot disagree about what the mark means. A piece of music is
    // left out: a heart is a mark on a picture, and a recording is not one.
    if (window.likes && !/^audio\//.test(rec.mime || "")) {
      try { btns.appendChild(window.likes.button(id, { className: "heart capHeart" })); }
      catch (e) { console.warn("the HEART button could not be drawn", e); }
    }

    var save = document.createElement('button');
    save.type = 'button';
    save.textContent = 'SAVE';
    save.title = 'download this image to your machine';
    save.onclick = function () {
      try {
        window.media.save(id);
        save.textContent = 'SAVED';
        window.setTimeout(function () { save.textContent = 'SAVE'; }, 1500);
      } catch (e) {
        print('SYSTEM', 'SAVE FAILED :: ' + ((e && e.message) ? e.message : e));
      }
    };
    btns.appendChild(save);

    // KEEP (src/js/keepsake.js) - the record, not the file. SAVE above writes the picture to this
    // machine; KEEP writes what MADE it into the record: the prompt and the negative list into the
    // recipe book, the seed/guidance/size with them, a #kept tag in the gallery, and a link back to
    // the picture in the gallery. Only a picture the terminal made has a prompt to keep.
    if (window.keepsake && window.keepsake.canKeep(rec)) {
      try { btns.appendChild(window.keepsake.button(id)); }
      catch (e) { console.warn("the KEEP button could not be drawn", e); }
    }

    // UPSCALE (bigger.pics) - pictures only: that service takes a picture, not a clip. The window
    // it opens needs a real click to exist at all, so this is a bare button and nothing else.
    if (!/^video\//.test(rec.mime || "") && rec.kind !== "video" && window.upscale) {
      var up = document.createElement("button");
      up.type = "button";
      up.className = "upscale";
      up.textContent = "UPSCALE";
      up.title = "upscale this picture with bigger.pics - free, up to 4x, no account, no key. It opens in a popup window and hands the picture straight over; the bigger one comes back here the moment it is done - nothing to press, and the window closes itself - into the vault, onto the stage, and in front of her. The bigger one carries this picture's whole prompt file (prompt, sent words, negative list, seed, guidance, size, pose, tags). NOTHING IS DELETED ON THIS ROAD: the picture it came from stays exactly where it is - even when what you are upscaling is itself an upscale.";
      up.onclick = function (e) { if (e && e.stopPropagation) e.stopPropagation(); window.upscale.open(id); };
      btns.appendChild(up);
    }

    // Only a render can be re-rolled: an attachment has no prompt of its own to render again.
    if (rec.kind === "gen" && rec.prompt) {
      var rr = document.createElement("button");
      rr.type = "button";
      rr.className = "recycle";
      rr.textContent = "\u267b\ufe0e";
      rr.title = "render a replacement for this one (same prompt and guidance, a new seed). The one on screen leaves the vault when the new one lands - SAVE it first if you want to keep it.";
      rr.onclick = function () { recycleTile(tile, id); };
      btns.appendChild(rr);
    }

    var rm = document.createElement('button');
    rm.type = 'button';
    rm.textContent = '\u00d7';
    rm.title = 'delete this image from the local vault';
    rm.onclick = async function () {
      if (!confirm('DELETE THIS IMAGE FROM THE LOCAL VAULT?')) return;
      await window.media.del(id);
      tile.remove();
    };
    btns.appendChild(rm);
  }

  /* ---- clips -------------------------------------------------------------------------------
     A video that is handed over is kept in the vault as the clip itself, not only as the still
     drawn out of it, and the log shows the thing itself: his first frame as the thumbnail, with a
     play button over it, playing in place in the picture's own shape. The still is also the one
     picture of the clip that goes to her eyes (see src/js/attach.js), so "she was shown it" and
     "you can watch it" are both true, and neither is a description of the other.
     ---------------------------------------------------------------------------------------- */
  function vidLabel(rec, dur) {
    var ms = (dur != null ? dur : (rec && rec.duration)) || 0;
    var t = (rec && rec.name) ? rec.name : 'clip';
    if (ms && isFinite(ms)) t += ' \u00b7 ' + (ms >= 60 ? Math.floor(ms / 60) + 'm ' + (ms % 60).toFixed(1) + 's' : ms.toFixed(1) + 's');
    return t;
  }

  function setVidCaption(tile, rec, dur) {
    var txt = tile.querySelector('.capTxt');
    if (!txt) return;
    txt.textContent = vidLabel(rec, dur);
    txt.title = vidLabel(rec, dur) + (rec.note ? '\n' + rec.note : '');
  }

  function buildVideoTile(opts) {
    opts = opts || {};
    var tile = buildTile({ video: true, prompt: opts.name, name: opts.name, index: opts.index, spin: opts.spin || 'READING CLIP' });
    if (opts.id) fillVideoTile(tile, opts.id);
    return tile;
  }

  async function fillVideoTile(tile, id) {
    if (window.media) await window.media.ensure();
    var rec = window.media ? window.media.get(id) : null;
    var box = tile.querySelector('.imgBox');
    var objUrl = window.media ? window.media.url(id) : null;
    if (!rec || !objUrl) { failTile(tile, 'CLIP UNAVAILABLE IN THIS VAULT'); return; }
    if (rec.w && rec.h) setTileAspect(tile, rec.w / rec.h);

    var posterUrl = '';
    if (rec.poster && window.media.get(rec.poster)) {
      try { posterUrl = window.media.url(rec.poster) || ''; } catch (e) { posterUrl = ''; }
    }

    var v = document.createElement('video');
    v.controls = false;
    v.playsInline = true;
    v.preload = 'metadata';
    v.setAttribute('playsinline', '');
    if (posterUrl) v.poster = posterUrl;

    // The thumbnail: the clip's own first frame, with a play button standing on it. One press
    // starts the clip in place and hands it its controls; the thumbnail steps aside. If no frame
    // could be drawn the button still stands there over a dark frame - the master is in the
    // vault either way, and it starts the same.
    var stage = document.createElement('div');
    stage.className = 'vidStage';
    if (posterUrl) {
      var th = document.createElement('img');
      th.className = 'vidThumb';
      th.src = posterUrl;
      th.alt = (rec.name || 'clip') + ' \u00b7 first frame';
      stage.appendChild(th);
    } else {
      var ph = document.createElement('div');
      ph.className = 'vidNoThumb';
      stage.appendChild(ph);
    }

    var started = false;
    var dead = false;
    function note(text) {
      if (stage.querySelector('.vidNote')) return;
      var n = document.createElement('span');
      n.className = 'vidNote';
      n.textContent = text;
      stage.appendChild(n);
    }
    function start() {
      if (started || dead) return;
      started = true;
      box.classList.add('started');
      v.controls = true;
      var p = null;
      try { p = v.play(); } catch (e) { p = null; }
      if (p && p.catch) {
        p.catch(function () {
          // Refused: the browser would not start it without a direct press, or the file will not
          // run here at all. The thumbnail comes back rather than a dead frame. SAVE still writes
          // the master out, whatever the player can or cannot do with it.
          started = false;
          box.classList.remove('started');
          v.controls = false;
        });
      }
    }

    var play = document.createElement('button');
    play.type = 'button';
    play.className = 'vidPlay';
    play.textContent = '\u25b6';
    play.title = 'play this clip' + (rec.duration ? ' (' + rec.duration.toFixed(1) + 's)' : '');
    play.setAttribute('aria-label', 'play this clip');
    play.onclick = function (e) { e.stopPropagation(); start(); };
    stage.appendChild(play);

    v.addEventListener('loadedmetadata', function () {
      if (v.videoWidth && v.videoHeight) setTileAspect(tile, v.videoWidth / v.videoHeight);
      setVidCaption(tile, rec, v.duration);
    });
    v.addEventListener('play', function () { started = true; box.classList.add('started'); v.controls = true; });
    // A codec this browser cannot open does NOT throw the clip away: the thumbnail and the play
    // button stay where they are, SAVE still writes the master out, and the frame says why.
    v.addEventListener('error', function () {
      dead = true;
      started = false;
      box.classList.remove('started');
      v.controls = false;
      note('THIS BROWSER CANNOT PLAY THIS CLIP \u00b7 SAVE WRITES THE MASTER OUT');
    });
    v.src = objUrl;
    stage.appendChild(v);

    box.textContent = '';
    box.classList.remove('noZoom');
    box.classList.add('playing');
    box.appendChild(stage);
    box.onclick = function () { if (!started) start(); };

    tile.dataset.mediaId = id;
    setVidCaption(tile, rec, rec.duration);

    var btns = tile.querySelector('.capBtns');
    btns.textContent = '';

    var save = document.createElement('button');
    save.type = 'button';
    save.textContent = 'SAVE';
    save.title = 'download the master clip to your machine - the file exactly as it was handed over';
    save.onclick = function () {
      try {
        window.media.save(id);
        save.textContent = 'SAVED';
        window.setTimeout(function () { save.textContent = 'SAVE'; }, 1500);
      } catch (e) {
        print('SYSTEM', 'SAVE FAILED :: ' + ((e && e.message) ? e.message : e));
      }
    };
    btns.appendChild(save);

    var zoom = document.createElement('button');
    zoom.type = 'button';
    zoom.textContent = '\u26f6';
    zoom.title = 'watch this clip on the full stage';
    zoom.onclick = function () { openLightbox(id); };
    btns.appendChild(zoom);

    var rm = document.createElement('button');
    rm.type = 'button';
    rm.textContent = '\u00d7';
    rm.title = 'delete this clip from the local vault';
    rm.onclick = async function () {
      if (!confirm('DELETE THIS CLIP FROM THE LOCAL VAULT?')) return;
      if (window.attach && window.attach.removeVideo) window.attach.removeVideo(id);
      await window.media.del(id);
      tile.remove();
    };
    btns.appendChild(rm);
  }

  /* ---- recycling a render ----------------------------------------------------------------
     A batch of six usually holds one dud. The recycle control re-rolls that slot: the same
     prompt, negative prompt, guidance and size with a fresh seed, rendered into the very same
     tile. Nothing is thrown away until the replacement is safely in the vault, so a failed
     re-roll leaves the image he already had in place and says so. When the new one lands, the
     old one leaves the vault, the archive entry that named it names the new one instead, and
     the sight queue is followed across too - but only the slot the old one held: a render that
     was never queued does not take a place in the queue now, so she never loses an unseen image.
     ---------------------------------------------------------------------------------------- */
  async function recycleTile(tile, id) {
    if (!window.media || tile.dataset.busy === "1") return;
    var rec = window.media.get(id);
    if (!rec || !rec.prompt) {
      print("SYSTEM", "NOTHING TO RENDER AGAIN :: THIS IMAGE WAS NOT MADE FROM A PROMPT.");
      return;
    }
    var box = tile.querySelector(".imgBox");
    var btns = tile.querySelector(".capBtns");
    var capTxt = tile.querySelector(".capTxt");
    var seed = randomSeed();
    var res = (rec.w && rec.h) ? rec.w + "x" + rec.h : "";

    tile.dataset.busy = "1";
    if (btns) btns.textContent = "";
    if (box) {
      box.classList.remove("noZoom");
      box.textContent = "";
      var spin = document.createElement("span");
      spin.className = "spin";
      spin.textContent = "RECYCLING :: SEED " + seed;
      box.appendChild(spin);
    }

    try {
      var out = await renderImage({
        prompt: rec.prompt,
        negativePrompt: rec.negative || "",
        resolution: IMAGE_RES.test(res) ? res : LIA_IMAGE_RESOLUTION,
        seed: seed,
        guidanceScale: rec.guidanceScale || undefined,
      });
      var newId = await window.media.add(out.blob, {
        kind: "gen", prompt: rec.prompt, sent: out.sent || rec.sent || "",
        negative: rec.negative || "", seed: out.seed, guidanceScale: rec.guidanceScale || 0,
        resolution: IMAGE_RES.test(res) ? res : (rec.resolution || ""),
        pose: rec.pose || "", tags: (rec.tags || []).slice(), how: "recycled",
        folder: rec.folder || "",
        w: out.w || rec.w || 0, h: out.h || rec.h || 0,
      });
      var moved = (typeof window.replaceMediaRef === "function") ? await window.replaceMediaRef(id, newId) : 0;
      var requeued = await replaceSight(id, newId);
      await window.media.del(id);
      delete tile.dataset.busy;
      if (capTxt) {
        capTxt.title = rec.prompt + "\nseed " + out.seed
          + (rec.guidanceScale ? " :: guidance " + rec.guidanceScale : "") + " :: recycled";
      }
      await fillTile(tile, newId);
      print("SYSTEM", "RECYCLED :: NEW RENDER AT SEED " + out.seed + " :: THE ONE IT REPLACED IS OUT OF THE VAULT."
        + (requeued
          ? " IT TOOK ITS PLACE IN THE QUEUE FOR HER EYES."
          : " SHE HAD ALREADY BEEN GIVEN THAT ONE, SO NOTHING NEW IS QUEUED.")
        + (moved < 0 ? "\n(THE ARCHIVE COULD NOT BE UPDATED :: IT STILL NAMES THE OLD IMAGE.)" : ""));
    } catch (e) {
      delete tile.dataset.busy;
      await fillTile(tile, id);
      print("SYSTEM", "RECYCLE FAILED :: " + String((e && e.message) ? e.message : e).toUpperCase()
        + " :: THE RENDER YOU ALREADY HAD IS STILL THERE.");
    }
  }

  function buildImageGrid(items) {
    items = items || [];
    var grid = document.createElement('div');
    // Two or more pictures read as a contact sheet (the same layout the forge uses for a
    // batch); a lone picture gets the full stage.
    grid.className = 'imageGrid' + (items.length > 1 ? ' batch' : '');
    items.forEach(function (it, i) {
      // A caller may hand over a BARE ID instead of the { kind, id, name, prompt } object the
      // attachment strip uses (POST TO CHAT and the archive replay both do - and a tile built from
      // a bare id used to come out as an empty frame still reading "RENDERING VISION", because
      // `it.id` was undefined and fillTile was therefore never called: measured 2026-09-23, the
      // picture HE posted from the gallery showed a spinner where the picture should be). So the
      // record is asked for what the tile needs: a picture is drawn as a picture, a clip as a clip,
      // and anything a caller left out is filled from the vault rather than defaulted to "IMAGE".
      if (typeof it === 'string') it = { id: it };
      if (it && it.id && (it.prompt === undefined || it.name === undefined || it.kind === undefined)) {
        var rr = (window.media && window.media.get) ? window.media.get(it.id) : null;
        if (rr) {
          it = {
            kind: it.kind || ((rr.kind === 'video' || /^video\//.test(String(rr.mime || ''))) ? 'video' : 'image'),
            id: it.id,
            name: it.name || rr.name || '',
            prompt: it.prompt || rr.prompt || ''
          };
        }
      }
      var opts = { id: it.id, prompt: it.prompt, name: it.name, index: (items.length > 1 ? i + 1 : 0) };
      grid.appendChild(it.kind === 'video' ? buildVideoTile(opts) : buildTile(opts));
    });
    if (items.length > 1) grid.appendChild(sheetBar(grid));
    // THE BATCH BAR (src/js/batch.js): tick boxes are already in the caption bars, so the line can
    // be sent to bigger.pics together. A one-picture line gets no bar - a selection of one is the
    // tile's own UPSCALE button.
    if (items.length > 1 && window.batch) { try { window.batch.decorate(grid); } catch (e) { console.warn("the batch bar could not be drawn", e); } }
    return grid;
  }

  /* ---- the storyboard sheet ---------------------------------------------------------------
     A batch is a storyboard you can look at. This is the same line of panels as one picture you
     can SAVE: panels numbered, each in its own shape, its prompt underneath, on one sheet. It is
     drawn HERE, on this device, from the pictures already in the vault - nothing is uploaded,
     no service is asked for anything - and it is written out as a png at a readable size.
     The shape of the sheet follows the work: two panels go two across, five or more go three
     across, and a panel that is tall (a phone, a portrait render) keeps its proportions instead
     of being padded into a cinema frame.
     ---------------------------------------------------------------------------------------- */
  function sheetBar(grid) {
    var bar = document.createElement('div');
    bar.className = 'sheetBar';
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'STORYBOARD SHEET';
    b.title = 'draw every picture in this line onto one numbered sheet and save it as a png';
    b.onclick = function () { saveSheet(grid, b); };
    var note = document.createElement('span');
    note.className = 'sheetNote';
    note.textContent = 'ONE SHEET \u00b7 NUMBERED PANELS \u00b7 PROMPTS UNDER EACH';
    bar.appendChild(b);
    bar.appendChild(note);
    return bar;
  }

  function stampNow() {
    function p(n) { return (n < 10 ? '0' : '') + n; }
    var d = new Date();
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  function wrapLines(ctx, text, maxW, maxLines) {
    var words = String(text == null ? '' : text).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    var lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var cand = cur ? cur + ' ' + words[i] : words[i];
      if (ctx.measureText(cand).width <= maxW) { cur = cand; continue; }
      if (cur) lines.push(cur);
      cur = words[i];
      if (lines.length >= maxLines) break;
    }
    if (cur && lines.length < maxLines) lines.push(cur);
    if (words.length && lines.length === maxLines) {
      var rest = cur;
      while (ctx.measureText(lines[maxLines - 1] + '\u2026').width > maxW && lines[maxLines - 1].length > 4) {
        lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1);
      }
      var consumed = lines.join(' ').length;
      if (consumed < String(text).replace(/\s+/g, ' ').trim().length) lines[maxLines - 1] += '\u2026';
      void rest;
    }
    return lines;
  }

  async function blobBitmap(blob) {
    if (typeof createImageBitmap === 'function') {
      try { return await createImageBitmap(blob); } catch (e) {}
    }
    return await new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('cannot decode')); };
      img.src = url;
    });
  }

  async function saveSheet(grid, btn, opts) {
    opts = opts || {};
    if (!window.media) return;
    if (btn && btn.dataset.busy === '1') return;
    if (btn) btn.dataset.busy = '1';
    try {
      await window.media.ensure();
      var tiles = Array.prototype.slice.call(grid.querySelectorAll('.imgTile'));
      var recs = [], skipped = 0;
      for (var i = 0; i < tiles.length; i++) {
        var id = tiles[i].dataset.mediaId;
        if (!id) { skipped++; continue; }
        var rec = window.media.get(id);
        if (!rec || !rec.blob) { skipped++; continue; }
        if (/^video\//.test(rec.mime || '')) { skipped++; continue; }  // a clip has its own player
        recs.push(rec);
      }
      if (!recs.length) { print('SYSTEM', 'NO PICTURE IN THIS LINE HAS LANDED YET - NOTHING TO PUT ON A SHEET.'); return; }
      if (btn) btn.textContent = 'DRAWING...';

      var cols = recs.length <= 1 ? 1 : (recs.length <= 4 ? 2 : 3);
      var pad = 30, gap = 20, capH = 58, headH = 78;
      var cellW = cols <= 2 ? 760 : 560;
      var rows = [];
      var panels = [];
      for (var r = 0; r < recs.length; r++) {
        var rec2 = recs[r];
        var ar = (rec2.w && rec2.h) ? (rec2.w / rec2.h) : 16 / 9;
        if (!isFinite(ar) || ar <= 0) ar = 16 / 9;
        ar = Math.max(0.32, Math.min(3.2, ar));
        var h = Math.round(cellW / ar);
        panels.push({ rec: rec2, w: cellW, h: h });
      }
      for (var s = 0; s < panels.length; s += cols) rows.push(panels.slice(s, s + cols));

      var W = pad * 2 + cols * cellW + (cols - 1) * gap;
      var H = pad * 2 + headH;
      rows.forEach(function (row) {
        var rh = 0;
        row.forEach(function (p) { if (p.h > rh) rh = p.h; });
        H += rh + capH + gap;
      });
      H -= gap;

      var canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, H);
      var mono = '13px "Courier New", Consolas, monospace';
      ctx.fillStyle = '#00ff00';
      ctx.font = 'bold 22px "Courier New", Consolas, monospace';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('STORYBOARD', pad, pad + 24);
      ctx.font = '12px "Courier New", Consolas, monospace';
      ctx.fillStyle = '#008800';
      ctx.fillText(recs.length + ' PANEL' + (recs.length === 1 ? '' : 'S') + '  \u00b7  ' + new Date().toLocaleString()
        + (skipped ? '  \u00b7  ' + skipped + ' NOT DRAWN (NO PICTURE)' : ''), pad, pad + 44);
      ctx.fillText('LIA TERMINAL \u00b7 SHEET ' + stampNow(), pad, pad + 62);

      var y = pad + headH;
      for (var ri = 0; ri < rows.length; ri++) {
        var row = rows[ri];
        var rowH = 0;
        row.forEach(function (p) { if (p.h > rowH) rowH = p.h; });
        for (var ci = 0; ci < row.length; ci++) {
          var p = row[ci];
          var x = pad + ci * (cellW + gap);
          var py = y + Math.round((rowH - p.h) / 2);
          var bmp = null;
          try { bmp = await blobBitmap(p.rec.blob); } catch (e) { bmp = null; }
          ctx.fillStyle = '#000000';
          ctx.fillRect(x, py, p.w, p.h);
          if (bmp) {
            var bw = bmp.width || p.w, bh = bmp.height || p.h;
            var sc = Math.min(p.w / bw, p.h / bh);
            var dw = Math.max(1, Math.round(bw * sc)), dh = Math.max(1, Math.round(bh * sc));
            ctx.drawImage(bmp, x + Math.round((p.w - dw) / 2), py + Math.round((p.h - dh) / 2), dw, dh);
          }
          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, py + 0.5, p.w - 1, p.h - 1);
          // the panel number, the way a board is numbered
          var n = ri * cols + ci + 1;
          var lbl = (n < 10 ? '0' : '') + n;
          ctx.font = 'bold 12px "Courier New", Consolas, monospace';
          var tw = ctx.measureText(lbl).width;
          ctx.fillStyle = '#000000';
          ctx.fillRect(x, py, tw + 12, 20);
          ctx.strokeStyle = '#00ff00';
          ctx.strokeRect(x + 0.5, py + 0.5, tw + 12, 20);
          ctx.fillStyle = '#00ff00';
          ctx.fillText(lbl, x + 6, py + 14);
          // the caption: the prompt it was made from, or the file it arrived as
          ctx.font = mono;
          ctx.fillStyle = '#00cc00';
          var cap = String((p.rec.kind === 'gen' && p.rec.prompt) ? p.rec.prompt : (p.rec.name || '')).replace(/\s+/g, ' ').trim();
          var lines = wrapLines(ctx, cap, p.w, 2);
          for (var li = 0; li < lines.length; li++) ctx.fillText(lines[li], x, py + p.h + 16 + li * 15);
          var meta = [];
          if (p.rec.w && p.rec.h) meta.push(p.rec.w + '\u00d7' + p.rec.h);
          if (p.rec.seed) meta.push('seed ' + p.rec.seed);
          if (p.rec.kind === 'attach') meta.push('attachment');
          if (meta.length) {
            ctx.fillStyle = '#005500';
            ctx.font = '11px "Courier New", Consolas, monospace';
            ctx.fillText(meta.join('  \u00b7  '), x, py + p.h + 16 + lines.length * 15);
          }
          if (bmp && bmp.close) { try { bmp.close(); } catch (e) {} }
        }
        y += rowH + capH + gap;
      }

      var name = 'storyboard_' + stampNow() + '.png';
      var out = null;
      await new Promise(function (resolve) {
        canvas.toBlob(function (blob) {
          try {
            if (!blob) throw new Error('the sheet could not be encoded');
            if (opts.drawOnly) { out = { canvas: canvas, blob: blob, w: W, h: H, name: name, panels: recs.length }; resolve(); return; }
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = name;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
            out = { canvas: canvas, blob: blob, w: W, h: H, name: name, panels: recs.length };
            print('SYSTEM', 'STORYBOARD SHEET SAVED :: ' + recs.length + ' PANEL' + (recs.length === 1 ? '' : 'S')
              + ' \u00b7 ' + W + '\u00d7' + H + ' \u00b7 ' + name
              + (skipped ? '\n' + skipped + ' PANEL' + (skipped === 1 ? ' WAS' : 'S WERE') + ' LEFT OFF - NO PICTURE WAS DRAWN FOR ' + (skipped === 1 ? 'IT' : 'THEM') + ' YET.' : ''));
          } catch (e) {
            print('SYSTEM', 'SHEET FAILED :: ' + String((e && e.message) ? e.message : e).toUpperCase());
          }
          resolve();
        }, 'image/png');
      });
      return out;
    } finally {
      if (btn) { delete btn.dataset.busy; btn.textContent = 'STORYBOARD SHEET'; }
    }
  }

  // The sheet, and the pictures on it, are available to anything here that wants them - the
  // button in the log is only one caller. saveSheet(grid) draws the tiles of a line and hands
  // back { canvas, blob, w, h, name, panels }.
  window.storyboard = {
    save: saveSheet,
    render: function (ids, opts) {
      opts = opts || {};
      var grid = document.createElement('div');
      grid.className = 'imageGrid batch';
      (ids || []).forEach(function (id, i) {
        var t = buildTile({ id: id, index: i + 1, name: opts.name || 'panel' });
        t.dataset.mediaId = id;
        grid.appendChild(t);
      });
      return saveSheet(grid, null, { drawOnly: !!opts.drawOnly });
    },
  };

  // A creation is not a turn. It is shown as the object it is - never as words - so nothing
  // about an image Patrikios made can reach her as text she could mistake for having seen it.
  function printCreation(gen) {
    var items = (gen || []).filter(function (g) { return g && g.id; });
    if (!items.length) return null;
    var log = document.getElementById('output');
    var wrap = document.createElement('div');
    wrap.className = 'entry hist';
    wrap.appendChild(buildImageGrid(items.map(function (g) { return { id: g.id, prompt: g.prompt, name: g.name }; })));
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
    return wrap;
  }

  /* ---- files: paste, drop, the paperclip ------------------------------------
     The whole attachment pipeline lives in src/js/attach.js (window.attach): pictures into the
     vault for her eyes, documents read here as text for her to read. This file only supplies
     the one helper the drop handler needs to tell a file drag from any other drag. */
  function hasFiles(e) {
    var types = e.dataTransfer && e.dataTransfer.types;
    if (!types) return false;
    return Array.prototype.indexOf.call(types, 'Files') !== -1;
  }

  /* ---- seeing and creating images ---- */

  var VISION_DIRECTIVE = /\[\[?\s*(?:VISION|IMAGE|RENDER|MAKE|PICTURE)\s*:\s*([^\]]{8,}?)\s*\]\]?/gi;
  var VISION_BARE_LINE = /(^|\n)[ \t]*(?:VISION|IMAGE|RENDER|MAKE|PICTURE)\s*[:\-]\s*([^\n]{8,})[ \t]*$/i;
  // THE POSE LANE. She may decide which pose he is PUT in, not only describe a picture: a
  // [[POSE: ...]] line names a pose from THE BOOK (studio.js) - or one she is naming herself.
  // The line is machinery: it never reaches her visible reply, and when it rides along with a
  // [[VISION: ...]] line the pose's phrase is made part of the picture. A pose she invents is
  // filed as hers in chat.js (the write is async; the reading here stays sync).
  var POSE_DIRECTIVE = /\[\[?\s*POSE\s*:\s*([^\]]{2,60}?)\s*\]\]?/gi;
  var POSE_BARE_LINE = /(^|\n)[ \t]*POSE\s*[:\-]\s*([^\n]{2,60})[ \t]*$/i;
  // THE RECIPE LANE. He keeps a book of recipes (src/studio/recipes.json): whole prompt templates
  // with named slots, built from his own documents. A line
  //   [[RECIPE: id :: slot=her words; slot=her words]]
  // composes the picture from that recipe rather than from her own description: the slots she names
  // take her words, every slot she leaves out keeps the recipe's own, and the result is her ONE
  // image for that reply - the same slot in the reply a [[VISION: ...]] line takes. The line is
  // machinery: it never reaches her visible reply.
  var RECIPE_DIRECTIVE = /\[\[?\s*RECIPE\s*:\s*([^\]]{2,}?)\s*\]\]?/gi;
  var RECIPE_BARE_LINE = /(^|\n)[ \t]*RECIPE\s*[:\-]\s*([^\n]{2,})[ \t]*$/i;

  function resolvePose(name) {
    var raw = String(name || "").replace(/\s+/g, " ").trim();
    if (!raw) return null;
    var st = window.studio;
    if (!st) return { name: raw, phrase: raw, known: false, family: "", added: true };
    var hit = st.findPose(raw);
    if (hit) return { name: hit.name, phrase: (hit.render || hit.name), known: true, family: hit.family, added: false };
    return { name: raw, phrase: raw, known: false, family: (st.FAMILY_HERS || "hers"), added: true };
  }

  function applyPose(prompt, pose) {
    if (!pose || !pose.phrase) return prompt;
    var p = String(prompt || "");
    if (p.toLowerCase().indexOf(String(pose.phrase).toLowerCase()) !== -1) return p;
    var text = p.replace(/[\s,]+$/, "");
    return text ? (text + ", " + pose.phrase) : pose.phrase;
  }

  function extractVisions(reply) {
    var prompts = [];
    var text = String(reply);
    var pose = null, recipeSpec = '', ownWords = false;
    // Pose and recipe lines are taken first, so neither can be swallowed into a prompt (or left in
    // her reply).
    text = text.replace(POSE_DIRECTIVE, function (m, p) { pose = p; return ''; });
    if (!pose) {
      var pm = POSE_BARE_LINE.exec(text);
      if (pm) {
        pose = pm[2];
        text = text.slice(0, pm.index + pm[1].length) + text.slice(pm.index + pm[0].length);
      }
    }
    text = text.replace(RECIPE_DIRECTIVE, function (m, r) { recipeSpec = r; return ''; });
    if (!recipeSpec) {
      var rc = RECIPE_BARE_LINE.exec(text);
      if (rc) {
        recipeSpec = rc[2];
        text = text.slice(0, rc.index + rc[1].length) + text.slice(rc.index + rc[0].length);
      }
    }
    var chosen = resolvePose(pose);
    var recipe = recipeSpec
      ? ((window.studio && window.studio.renderRecipe) ? window.studio.renderRecipe(recipeSpec) : { ok: false, error: 'THE RECIPE BOOK IS NOT LOADED HERE.' })
      : null;
    var cleaned = text.replace(VISION_DIRECTIVE, function (m, p) {
      if (p && p.trim()) prompts.push(p.trim().replace(/\s+/g, ' '));
      return '';
    });
    if (!prompts.length) {
      var m = VISION_BARE_LINE.exec(cleaned);
      if (m) {
        prompts.push(m[2].trim().replace(/\s+/g, ' '));
        cleaned = cleaned.slice(0, m.index + m[1].length);
      }
    }
    // TALKING ABOUT A PICTURE IS NOT MAKING ONE - EXCEPT HERE. She sometimes narrates the
    // terminal's own record shape - "[created an image: ...]" - instead of writing the line,
    // because that shape is what her own past turns show her (send() files it on every turn
    // that made one, and the recent conversation hands it back to her). The description is
    // taken as the prompt and rendered by the same road, and the caller says so out loud
    // rather than letting the narration stand as though a picture rode under it.
    var narrated = 0;
    if (!prompts.length) {
      cleaned = cleaned.replace(/\[\[?\s*created an image\s*:\s*([^\]]{8,}?)\s*\]\]?/gi, function (m, p) {
        if (p && p.trim()) { prompts.push(p.trim().replace(/\s+/g, ' ')); narrated++; }
        return '';
      });
    }
    // "(Image creation triggered: ...)" - the same narration in parentheses (seen 2026-10-18:
    // two turns of it, no render, after the bracketed shape was caught). Same treatment: the
    // description is taken as the prompt and rendered by the same road.
    if (!prompts.length) {
      cleaned = cleaned.replace(/\(\s*(?:image creation triggered|image created|generating image|image generation)\s*:\s*([^)]{8,}?)\)/gi, function (m, p) {
        if (p && p.trim()) { prompts.push(p.trim().replace(/\s+/g, ' ')); narrated++; }
        return '';
      });
    }
    cleaned = cleaned.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    // ONE IMAGE PER REPLY. Anything past the first is not rendered - and never silently: the
    // caller is told how many were left off, so a second line is a report, not a puzzling absence.
    var wanted = prompts.length;
    if (recipe && recipe.ok) wanted += 1;
    var dropped = Math.max(0, wanted - 1);
    if (recipe && recipe.ok) {
      if (prompts.length) { ownWords = true; prompts = [recipe.text + ', ' + prompts[0]]; }
      else prompts = [recipe.text];
    }
    if (chosen) prompts = prompts.map(function (p) { return applyPose(p, chosen); });
    return { text: cleaned, prompts: prompts.slice(0, 1), pose: chosen, recipe: recipe, ownWords: ownWords, dropped: dropped, narrated: narrated };
  }

  /* ---- THE SPOKEN PROMPT ----------------------------------------------------
     PATRIKIOS, 2026-09-26: "...she drops the ball and speaks the prompt ... then puts it on
     screen as text ... user says \"show me, don't tell me\" directly. She drops the ball and
     produces no image, I copy and paste manually to get the image myself, but that is not the
     point. She can create images inline asked or not."

     The lane above IS how she makes a picture and it needs nobody's permission - what this adds is
     what happens when a reply DESCRIBES a picture instead of writing the line. That was a dead end:
     he was shown prose, she had shown him nothing, and the only hands left were his own. So a
     request to see is recognized in his own words (LIA_SHOWME_HINT in src/js/config.js) or asked
     for on purpose (/showme), and ONE TURN IS ARMED. While it is armed the instruction carries a
     last-word reminder, and a reply that comes back with no image line is ASKED AGAIN - once, in
     words, before anything is rendered - for the single line she owes him. What she writes then
     goes back into `parsed.prompts` and is rendered by exactly the road her own [[VISION: ...]]
     line takes, so a picture caught here is hers everywhere that matters: the vault, the render
     book, the tile under her turn.

     NOTHING IS GUESSED FROM PROSE. This fires only on a turn he asked to see something on, only
     when no image line came back, and her second answer may simply be NOTHING - which is honoured,
     because a picture nobody wanted is not a favour. And it is one-shot by design: the arm is
     spent by the turn it was made for, and saying it again arms it again.
     ------------------------------------------------------------------------- */
  var showMeArmed = false;
  var showMeDone = null;   // what the last catch did, for /showme status

  function showMeHint(text) {
    var g = (typeof LIA_SHOWME_HINT !== "undefined") ? LIA_SHOWME_HINT : null;
    if (!g || !text) return false;
    g.lastIndex = 0;
    return g.test(String(text));
  }

  // THE SECOND ASK. Her reply and his words go back together, with a reminder of the one line she
  // owes him; NOTHING is a real answer. Returns { ok, prompt } or { ok:false, why } - and the
  // caller prints the why, because an answer of "I am not showing you that" is worth reading.
  async function showMeAgain(herReply, hisWords) {
    if (!window.root || !window.root.generateText) return { ok: false, why: "THE TEXT ENGINE IS NOT LOADED." };
    var ask = (typeof LIA_SHOWME_ASK !== "undefined" && LIA_SHOWME_ASK) ? LIA_SHOWME_ASK : "";
    var instruction = "Patrikios said: " + (String(hisWords || "").replace(/\s+/g, " ").trim() || "(he sent it without words)")
      + "\n\nYou answered him: " + String(herReply || "").replace(/\s+/g, " ").trim()
      + "\n\n" + ask;
    var out;
    try {
      out = await window.root.generateText({ instruction: instruction, temperature: 0.7 });
    } catch (e) {
      return { ok: false, why: "THE SECOND ASK FAILED :: " + String((e && e.message) ? e.message : e).toUpperCase() };
    }
    var said = String(out || "").trim();
    if (/^nothing\b/i.test(said)) {
      var rest = said.replace(/^nothing\W*/i, "").replace(/[\s"'().-]+$/, "").trim();
      return { ok: false, nothing: true, why: "SHE SAYS A PICTURE IS NOT WHAT HE IS ASKING FOR." + (rest ? "\nIN HER WORDS :: " + rest : "") };
    }
    var second = extractVisions(said);
    if (!second.prompts.length) return { ok: false, why: "SHE ANSWERED IN WORDS AGAIN." };
    return { ok: true, prompt: second.prompts[0], said: second.text };
  }

  window.showMe = {
    hint: showMeHint,
    arm: function (on) { showMeArmed = (on === undefined) ? true : !!on; return showMeArmed; },
    armed: function () { return showMeArmed; },
    disarm: function () { showMeArmed = false; return false; },
    again: showMeAgain,
    done: function (v) {
      if (v !== undefined) showMeDone = v;
      return showMeDone;
    },
    state: function () {
      return { armed: showMeArmed, last: showMeDone };
    },
  };

  // The service's seed range is 1 .. 2147483646 (its own default of -1 means "surprise me").
  var SEED_CEILING = 2147483646;

  // Mirrors the forge's IMAGE_SIZES. A stored image's own width/height is used as the resolution
  // when it is one of the service's four, so a portrait render is recycled as a portrait.
  var IMAGE_RES = /^(512x512|512x768|768x512|768x768)$/;

  function randomSeed() {
    return Math.floor(Math.random() * SEED_CEILING) + 1;
  }

  // A seed the user pinned in the forge form: whatever digits they typed, clamped to the
  // service's range. "" / garbage / out-of-range means "roll a fresh one for each image".
  function parseSeed(text) {
    var digits = String(text || '').replace(/[^0-9]/g, '');
    if (!digits) return 0;
    var n = Math.floor(Number(digits));
    if (!isFinite(n) || n < 1 || n > SEED_CEILING) return 0;
    return n;
  }

  // One render at a time, everywhere. A forge batch, one of her visions, a manual /image and a
  // recycle all funnel through here, so two requests are never in flight together - a recycle
  // clicked while a batch is still going simply takes its turn in the queue.
  var renderChain = Promise.resolve();

  /* ---- the one prompt that is refused before it is sent --------------------
     The image service moderates what it is asked for, but the request is refused HERE first,
     before it leaves the device. The test is deliberately narrow: the POSITIVE prompt must
     contain BOTH something that points at a person under 18 AND something sexual. A picture of a
     child playing in a field is not caught, an adult prompt is not caught, and a negative prompt
     like "no children" is never even looked at - only what is being asked FOR. Everything else,
     legal adult content included, is left to the service and to the boundaries she is given.
     ------------------------------------------------------------------------- */
  var MINOR_WORDS = /\b(?:child|children|childs|kid|kids|kiddie|minor|minors|underage|under-?age|preteen|pre-?teen|tween|toddler|infant|baby|loli|lolicon|lolita|shota|shotacon|schoolgirl|schoolboy|middle[- ]school|elementary[- ]school|jailbait)\b/i;
  var MINOR_AGE = /\b(?:1[0-7]|[1-9])[-\s]?(?:yo|y\/o|yrs?[-\s]?olds?|years?[-\s]?olds?)\b|\bage[d]?\s*(?:of\s+)?(?:1[0-7]|[1-9])\b/i;
  var SEX_WORDS = /\b(?:sex|sexual|sexualis\w*|sexualiz\w*|sexy|sexually|explicit|uncensored|hentai|xxx|nude|nudes|naked|nsfw|porn|porno|erotic|erotica|fuck|fucked|fucking|blowjob|handjob|anal|penis|vagina|vulva|breasts?|tits|nipples?|genitals?|genitalia|orgasm|semen|incest|fetish|molest\w*|rape|raping|pedo\w*|paedo\w*)\b/i;
  // An EXCLUSION is not a request: "no children", "without minors", "childless" is the opposite
  // of asking for one, so those phrases are taken out before the test - otherwise a perfectly
  // ordinary adult prompt that rules children out would be refused. Only what is asked FOR counts.
  var EXCLUDED_MINOR = /\b(?:no|not|never|without|zero|free\s+of|minus)\s+(?:any\s+)?(?:more\s+)?(?:children|child|kids?|minors?|underage|under-?age|preteens?|pre-?teens?|tweens?|toddlers?|infants?|bab(?:y|ies)|lolis?|shotas?|schoolgirls?|schoolboys?)\b|\bchildless\b|\bno\s+one\s+under\s*(?:18|eighteen)\b/gi;

  function refusedPrompt(text) {
    var t = String(text || "").replace(EXCLUDED_MINOR, " ");
    if (!t.trim()) return null;
    if (!MINOR_WORDS.test(t) && !MINOR_AGE.test(t)) return null;
    if (!SEX_WORDS.test(t)) return null;
    return "REFUSED :: AN IMAGE LIKE THAT IS NOT MADE HERE. A PROMPT THAT PAIRS A MINOR WITH SEXUAL CONTENT IS REFUSED BEFORE ANY REQUEST IS SENT - THIS IS NOT A ROLE, A MOOD OR A SETTING, AND IT DOES NOT MOVE.";
  }

  function oneAtATime(job) {
    var run = renderChain.then(function () { return job(); }, function () { return job(); });
    renderChain = run.then(function () {}, function () {});
    return run;
  }

  // One pass through the text-to-image service. `opts` is
  // { prompt, negativePrompt, resolution, seed } - everything optional except the prompt.
  // Always hands back a jpeg Blob plus the dimensions and seed that actually produced it, plus
  // `sent` - the exact string the service was handed, read back from the plugin afterwards.
  async function renderImageNow(opts) {
    var request = {
      prompt: opts.prompt,
      resolution: opts.resolution || LIA_IMAGE_RESOLUTION,
      // NEVER PUBLIC. The image service keeps a PUBLIC gallery for every generator that uses it, and
      // its tile carries a heart button that saves the picture there - where it outlives the session
      // and can be seen by anyone who opens that gallery. Patrikios, 2026-09-30: "Do not want this at
      // all as we are never public." So the save-to-gallery machinery is switched off for EVERY
      // render, and it is set HERE - the single place a request is built - rather than per-caller, so
      // no future road into the service can forget it. (saveTitle and saveDescription below still
      // ride along: they belong to the recipe the vault keeps, and with the buttons hidden there is
      // no road from them to a public gallery.)
      hideGalleryButtons: true,
    };
    if (opts.negativePrompt) request.negativePrompt = opts.negativePrompt;
    if (opts.seed != null) request.seed = opts.seed;
    if (opts.guidanceScale != null) request.guidanceScale = opts.guidanceScale;

    // THE PROMPT BOOK RUNS ON EVERY RENDER, not only on the forge - her own visions, /image and a
    // recycle all come through here. So a prompt she writes in the veiled tongue is translated
    // instead of being sent as words the renderer has never seen, a (key:::value) tag is routed
    // before the plugin can eat it, and a coined phrase that is in no glossary is held out and
    // reported. The forge resolves its own prompt first (it has to, to report before rendering),
    // which is what `promptResolved` says.
    var report = null;
    if (window.studio && !opts.promptResolved) {
      var r = window.studio.resolve(opts.prompt, {
        negative: opts.negativePrompt, seed: opts.seed, guidance: opts.guidanceScale,
        resolution: opts.resolution || LIA_IMAGE_RESOLUTION,
      });
      if (r.changed) window.studio.reportLines(r.report).forEach(function (line) { print('SYSTEM', line); });
      request.prompt = r.positive;
      request.resolution = r.resolution;
      if (r.negative) request.negativePrompt = r.negative;
      if (r.seed) request.seed = r.seed;
      if (r.guidance) request.guidanceScale = r.guidance;
      if (r.saveTitle) request.saveTitle = r.saveTitle;
      if (r.saveDescription) request.saveDescription = r.saveDescription;
      report = r.report;
    }

    // THE CHOICE (studio.expand). Perchance's `{a|b|c}` alternation, made to work where a perchance
    // generator normally cannot reach: a prompt box is a plain string, and the image service has no
    // such syntax, so an unexpanded group used to be sent as literal punctuation. It is taken HERE,
    // once per IMAGE - which is what makes a batch of nine come out as nine different poses instead
    // of nine copies of one - and after the resolve above, so a group written in the veiled tongue
    // is translated before it is chosen between. `{pose}` / `{pose:hetero}` draw from the book.
    if (window.studio && window.studio.expand) {
      var choice = window.studio.expand(request.prompt);
      if (choice.picks.length) print('SYSTEM', 'PROMPT BOOK :: PICKED :: ' + choice.picks.join(' :: '));
      request.prompt = choice.text;
      if (request.negativePrompt) request.negativePrompt = window.studio.expand(request.negativePrompt).text;
    }

    var refusal = refusedPrompt(request.prompt);
    if (refusal) throw new Error(refusal);
    // What this ONE image was actually asked for, after the choice above - kept, because the plugin
    // is free to rewrite the request object it was handed. THE NEGATIVE IS KEPT THE SAME WAY: the
    // resolver may have supplied it rather than the caller (the house list is the default now - see
    // studio.resolve), so the record that gets stored has to be the words that were actually sent,
    // not the ones the caller passed in.
    var finalPrompt = String(request.prompt || '');
    var finalNegative = String(request.negativePrompt || '');

    var res = await window.root.generateImage(request);
    if (!res) throw new Error('no image returned');
    var seed = (res.inputs && res.inputs.seed) || opts.seed || 0;
    // The plugin keeps the string it actually sent here. That is the ground truth - not what we
    // meant to send - and it is what the tile's tooltip and the vault record carry.
    var sent = String(window.lastTextToImagePrompt || request.prompt || '');
    if (res.canvas && res.canvas.toBlob) {
      var blob = await window.media.canvasToBlob(res.canvas, 0.92);
      if (blob) return { blob: blob, seed: seed, w: res.canvas.width, h: res.canvas.height, sent: sent, prompt: finalPrompt, negative: finalNegative, report: report };
    }
    if (res.dataUrl) {
      var dims = (opts.resolution || LIA_IMAGE_RESOLUTION).split('x');
      return {
        blob: await (await fetch(res.dataUrl)).blob(), seed: seed,
        w: Number(dims[0]) || 0, h: Number(dims[1]) || 0, sent: sent, prompt: finalPrompt, negative: finalNegative, report: report
      };
    }
    throw new Error('no image data returned');
  }

  function renderImage(opts) {
    return oneAtATime(function () {
      // THE BAR (src/js/progress.js). One render is one call to the image service with no count to
      // give, so it is an INDETERMINATE bar - and it is priority 0 on purpose, because a forge batch
      // (or a run of her own visions) already has a count of its own and its number is the honest one
      // to show. Opened INSIDE the job, not at the queue: oneAtATime runs renders one at a time, so a
      // claim opened at queue time would be ended by the render ahead of it and never reopen.
      var P = null;
      try {
        if (window.progress) P = window.progress.begin("RENDERING", {
          id: "render", priority: 0,
          detail: String(opts.prompt || "").replace(/\s+/g, " ").slice(0, 160),
        });
      } catch (e) {}
      return Promise.resolve().then(function () { return renderImageNow(opts); }).then(function (out) {
        if (P) { try { P.finish(); } catch (e) {} }
        return out;
      }, function (err) {
        if (P) { try { P.fail((err && err.message) ? err.message : "THE RENDER FAILED"); } catch (e) {} }
        throw err;
      });
    });
  }

  // NO ANIMATION, EVER, ON HER ROAD (Patrikios, 2026-10-18: she made a cartoon - the house
  // look is cinematic stills). Fixed ban words merged into every negative her renders carry,
  // whatever else rode with them. Skipped only when the existing list already bans cartoons,
  // and when he wrote "none" in his box - an explicit no-negative is his, not hers to overrule.
  var NO_ANIMATION = "cartoon, anime, manga, 3d render, CGI, claymation, stop motion, comic book";
  function guardAnimation(neg, from) {
    var n = String(neg || "");
    if (from === "none") return n;
    if (/cartoon/i.test(n)) return n;
    return (n.replace(/[\s,]+$/, "") ? n.replace(/[\s,]+$/, "") + ", " : "") + NO_ANIMATION;
  }
  // HIS NEGATIVE (Patrikios, 2026-10-18: "My Negative prompts are superior"). What her
  // renders carry when she brought no list of her own: the forge's NEGATIVE PROMPT box, live
  // from the DOM first and from the persisted form second - then the house list - then nothing.
  // The word "none" in his box means none, the same as it means on his own road. Returns
  // { text, from }: "forge" | "house" | "none" | "blank", so the caller can say out loud whose
  // list rode with the picture.
  function hisNegative() {
    var t = "";
    try {
      var box = document.getElementById('cpNegative');
      if (box && box.value) t = String(box.value).trim();
    } catch (e) {}
    if (!t) {
      try {
        if (window.forgeBook && window.forgeBook.form) {
          var f = window.forgeBook.form();
          if (f && f.negative != null) t = String(f.negative).trim();
        }
      } catch (e) {}
    }
    if (/^(none|no|off|nothing)$/i.test(t)) return { text: "", from: "none" };
    if (t) return { text: t, from: "forge" };
    try {
      if (window.studio && window.studio.houseNegative) {
        var h = String(window.studio.houseNegative() || "").trim();
        if (h) return { text: h, from: "house" };
      }
    } catch (e) {}
    return { text: "", from: "blank" };
  }

  // A PROMPT SAID THREE TIMES (seen 2026-10-18: her VISION line carried the same scene three
  // times over, and the triple rode into the vault, the render book and every receipt). The model
  // sometimes repeats the scene for emphasis; the renderer needs it once. Whole-string repetition
  // (the same paragraph 2-3x) collapses first, then consecutive duplicate sentences - exact matches
  // only (case-insensitive), so deliberate lists and variations are untouched.
  function dedupPrompt(p) {
    var s = String(p == null ? "" : p).replace(/\s+/g, " ").trim();
    if (!s) return s;
    var k, j, n, first, same;
    for (k = 3; k >= 2; k--) {
      if (s.length % k !== 0) continue;
      n = s.length / k;
      first = s.slice(0, n).trim().toLowerCase();
      if (!first) continue;
      same = true;
      for (j = 1; j < k; j++) {
        if (s.slice(j * n, (j + 1) * n).trim().toLowerCase() !== first) { same = false; break; }
      }
      if (same) { s = s.slice(0, n).trim(); break; }
    }
    var parts = s.match(/[^.!?]+[.!?]+["'”)]?|\S[^.!?]*$/g) || [s];
    var out = [];
    parts.forEach(function (sent) {
      var norm = sent.replace(/\s+/g, " ").trim().toLowerCase();
      var prev = out.length ? out[out.length - 1].replace(/\s+/g, " ").trim().toLowerCase() : null;
      if (norm && norm === prev) return;
      out.push(sent.trim());
    });
    return out.join(" ");
  }
  window.dedupPrompt = dedupPrompt;

  // A vision SHE writes - her own style words are appended to her prompt. `negative` is the
  // recipe's own negative list when she composed from a recipe (see the recipe lane in
  // extractVisions) and it rides as-is. When she described the picture herself she brought no
  // list, and the render carries HIS instead (hisNegative above: the forge box, then the house
  // list) - so a picture she makes is guarded by the same words his own road uses. Said out
  // loud, so the record shows whose list a picture was made with.
  //
  // The WHOLE render comes back, not just the blob: the seed the service actually used, the
  // string it was actually handed, the negative it was sent with, and the size - because every one
  // of those is part of the render's record now (src/js/renderbook.js prints it, and
  // `/renders redo R12` runs it again). `out.base` is HER words, before LIA_IMAGE_STYLE was
  // appended; `out.blob` is the picture.
  async function renderVision(prompt, negative) {
    prompt = dedupPrompt(prompt);
    var full = LIA_IMAGE_STYLE ? prompt + ', ' + LIA_IMAGE_STYLE : prompt;
    var opts = { prompt: full, resolution: LIA_IMAGE_RESOLUTION };
    var negFrom = "";
    if (negative) { opts.negativePrompt = negative; negFrom = "recipe"; }
    else {
      var his = hisNegative();
      if (his.text) {
        opts.negativePrompt = his.text;
        print('SYSTEM', 'HER VISION :: THE NEGATIVE IS YOURS - '
          + (his.from === "forge" ? 'THE FORGE BOX' : 'THE HOUSE LIST')
          + ' (' + his.text.length + ' CHARS) RIDES WITH HER PICTURE.');
      }
      negFrom = his.from;
    }
    // THE ANIMATION GUARD lands last, on whatever negative won above - her recipe's, his, or
    // the house's. An explicit "none" is honoured bare (guardAnimation holds it out).
    opts.negativePrompt = guardAnimation(opts.negativePrompt, negFrom);
    var out = await renderImage(opts);
    out.base = prompt;
    // What the render ACTUALLY carried: the caller's list if there was one, and the resolver's
    // (the house default) if there was not - never an empty string standing in for a list that was
    // really sent, because this field is what the vault record and the render book print.
    out.negative = out.negative || negative || '';
    out.resolution = LIA_IMAGE_RESOLUTION;
    return out;
  }

  // A plain description of a stored image, used when several are attached. What she says about
  // a picture is kept on the picture: it is the words that belong to it, so the embedding lane
  // can put the picture and her reading of it in one place.
  async function sightOf(id, prompt) {
    var rec = window.media.get(id);
    if (!rec || !rec.blob) return '';
    var words = (typeof prompt === 'string' && prompt.trim()) ? prompt : LIA_SIGHT_PROMPT;
    try {
      var description = await window.root.generateText({
        instruction: [words + '\n\n', rec.blob]
      });
      var text = String(description).trim();
      if (text && window.media.setField) window.media.setField(id, 'sight', text);
      return text;
    } catch (e) {
      print('SYSTEM', 'SIGHT FAILED :: ' + ((e && e.message) ? e.message : e));
      return '';
    }
  }

  // THE DEEP ANALYSIS of a picture he hands over (2026-09-23). One neutral vision pass with the
  // deeper prompt - it knows nothing about who she is wearing, so the reading is the plain truth of
  // the image and only her RESPONSE to it is lensed by the role. The reading is written on the record
  // as its `sight`, the same field the classifier and [[READ: ...]] use, so the rest of the terminal
  // finds it the same way; a picture that already carries one is REUSED, never paid for twice.
  async function analyzeOf(id) {
    var rec = window.media ? window.media.get(id) : null;
    if (!rec) return '';
    if (rec.sight) return String(rec.sight);
    var p = (typeof LIA_ANALYZE_PROMPT !== 'undefined') ? LIA_ANALYZE_PROMPT : "";
    return await sightOf(id, p);
  }
  window.analyzeOf = analyzeOf;

  // A TRANSIENT READING OF A PICTURE THAT IS NOT IN THE VAULT (2026-09-23). One vision call on a
  // Blob, with NOTHING written and no record made - it is how the frames sampled out of a clip are
  // read: for a second they are pictures for the model to look at, and then they are gone. They never
  // enter the vault, never appear in the gallery, and never queue for her eyes. The prompt decides
  // what the reading is (see the clip-sequence road in chat.js).
  async function lookBlob(blob, prompt) {
    if (!blob) return "";
    var words = (typeof prompt === "string" && prompt.trim()) ? prompt : LIA_SIGHT_PROMPT;
    try {
      var out = await window.root.generateText({ instruction: [words + "\n\n", blob] });
      return String(out || "").trim();
    } catch (e) {
      print('SYSTEM', 'A FRAME COULD NOT BE READ :: ' + String((e && e.message) ? e.message : e).toUpperCase());
      return "";
    }
  }
  window.lookBlob = lookBlob;

  // TAKE EVERYTHING OUT OF HER LINE OF SIGHT (2026-09-23). PATRIKIOS: "Kill the ~8xx waiting pictures
  // for now, It worked." The bulk classifier is the road he uses to have the vault read, so the
  // standing queue of pictures waiting for a turn's eyes was emptied on his word. It is NOT disabled:
  // new creations still queue, and this clears only what is waiting at the moment it is called.
  // Nothing is marked and nothing leaves the vault - the records are exactly as they were.
  async function clearSight() {
    var n = unseen.length;
    unseen = [];
    await saveSight();
    return n;
  }
  window.clearSight = clearSight;

  /* ---- her eyes on what Patrikios creates ---------------------------------
     Everything the forge makes is queued here the moment it exists: an image that was never
     put in front of her is an image she has NOT seen. No creation is ever posted as a turn,
     so no words about one can reach her - her next reply gets the real image through the
     vision model instead. The queue lives in kv (lia_settings / unseen_sight) so an unseen
     image is still hers to look at after a reload.
     ------------------------------------------------------------------------ */
  var SIGHT_KEY = "unseen_sight";
  var unseen = [];

  function sightStore() {
    return (window.root && window.root.kv && window.root.kv.lia_settings) || null;
  }

  function sightCap() {
    var n = (typeof LIA_SIGHT_MAX === "number") ? LIA_SIGHT_MAX : 3;
    if (!isFinite(n) || n < 1) return 3;
    return Math.round(n);
  }

  async function loadSight() {
    var s = sightStore();
    if (!s) return unseen.slice();
    try {
      var v = await s.get(SIGHT_KEY);
      unseen = Array.isArray(v) ? v.filter(function (id) { return lookable(id); }) : [];
      // A queue stored before the gate below existed can hold a recording or a clip. Drop it here,
      // at the boundary, and NAME it - nothing is ever taken out of her line of sight in silence.
      var lostIds = Array.isArray(v) ? v.filter(function (id) { return !lookable(id); }) : [];
      if (lostIds.length && typeof print === "function") {
        print('SYSTEM', "PUT OUT OF HER LINE OF SIGHT :: " + lostIds.map(function (id) {
          var r = window.media ? window.media.get(id) : null;
          return ((r && (r.name || r.prompt)) ? (r.name || r.prompt) : id) + " (" + String((r && r.mime) || "gone") + ")";
        }).join(" / ")
          + "\nTHE VISION MODEL TAKES IMAGES ONLY, AND A CLIP IS ALREADY IN FRONT OF HER AS THE STILL IT CARRIES. THE FILE ITSELF IS UNTOUCHED IN THE VAULT.");
      }
    } catch (e) { console.warn("sight queue restore failed", e); }
    return unseen.slice();
  }

  async function saveSight() {
    var s = sightStore(); if (!s) return;
    try { await s.set(SIGHT_KEY, unseen.slice()); } catch (e) { console.warn("sight queue store failed", e); }
  }

  // Queue what is waiting for her eyes. She can look at a handful of images in one reply, not a
  // gallery, so the queue keeps only the newest `sightCap()` CREATIONS - but every unseen
  // ATTACHMENT stays, however many there are: Patrikios chose those and handed them over, and the
  // vision block in chat.js gives her a few of them at a time until she has seen them all. Nothing
  // he hands over is dropped unseen.
  function isAttachedId(id) {
    var r = window.media ? window.media.get(id) : null;
    // A picture HE POSTED from the gallery (POST TO CHAT, `postedAt`) counts here too: it is his
    // gesture, out of the vault and into the conversation, so it is given to her as one of his own
    // - and it never falls off the queue's end, the way a creation can.
    return !!(r && (r.kind === "attach" || r.postedAt));
  }

  // WHAT SHE CAN ACTUALLY BE SHOWN. The vision model takes a png/jpeg/webp image Blob and nothing
  // else: hand it a recording and the whole generateText call throws, which takes the turn down with
  // it (measured - "attachment must be a png/jpeg/webp image Blob (got type audio/wav)"). A clip is
  // already in front of her as the still it carries, because a clip's first frame is kept as its own
  // picture (attach.js), so the clip record itself is never queued. This is the one predicate, and
  // the queue below is the one door every caller comes through - chat.js (/sight, /show, /embed
  // show, the attached-picture pool), the forge, the gallery, upscale.js and images.js itself - so
  // no caller can put a recording or a clip into her line of sight, including one added later.
  //
  // WHAT SHE CAN ACTUALLY BE SHOWN. The vision model takes a png/jpeg/webp image Blob and nothing
  // else: hand it a recording and the whole generateText call throws, which takes the turn down with
  // it (measured - "attachment must be a png/jpeg/webp image Blob (got type audio/wav)"). A clip is
  // already in front of her as the still it carries, because a clip's first frame is kept as its own
  // picture (attach.js), so the clip record itself is never queued. This is the one predicate, and
  // the queue below is the one door every caller comes through - chat.js (/sight, /show, /embed
  // show, the attached-picture pool), the forge, the gallery, upscale.js and images.js itself - so
  // no caller can put a recording or a clip into her line of sight, including one added later.
  //
  // THE TEST IS THE PLUGIN'S OWN TEST, over the BLOB - because the Blob is what it validates, and
  // the record's stored mime is not what it reads (measured against the plugin's source, line 149 of
  // imports/ai-text-plugin/main.pjs: `/^image\/(png|jpeg|webp)$/.test(part.type)`, with a GIF and an
  // UNTYPED blob both refused). Asking the Blob is what closes the whole class of "the record says
  // image but the bytes are something else": an untyped .mp3 or .wav stored as image/jpeg before the
  // type was resolved properly (see mimeFor in src/js/vault.js) fails here on its empty type, and so
  // does a picture this browser cannot name. The terminal's own pictures are all written as
  // image/jpeg/png by the canvas and the services, so nothing that was ever showable is refused -
  // checked over the whole vault (359 of 363 records pass this test; the two wavs and the two clips
  // are what do not, exactly as before).
  function lookable(id) {
    var r = (window.media && window.media.get) ? window.media.get(id) : null;
    if (!r || !r.blob) return false;
    if (r.kind === "video") return false;   // a clip's still is a picture record of its own
    return /^image\/(png|jpeg|webp)$/.test(String(r.blob.type || "").toLowerCase());
  }

  function sightRefusalName(id) {
    var r = window.media ? window.media.get(id) : null;
    // The blob's own type is named when there is one: it is the type the vision plugin complains
    // about, and it can disagree with a stale record.
    var kind = (r && r.blob && r.blob.type) ? r.blob.type : ((r && r.mime) || "?");
    return ((r && (r.name || r.prompt)) ? (r.name || r.prompt) : id) + " (" + String(kind) + ")";
  }

  async function queueSight(ids) {
    var refused = [];
    var added = 0;
    (ids || []).forEach(function (id) {
      if (!id) return;
      if (!lookable(id)) {
        // Not something she can be shown. If it is somehow already waiting, take it out - and either
        // way say so: a caller that offered a recording gets an answer, not a silent no.
        var at = unseen.indexOf(id);
        if (at !== -1) unseen.splice(at, 1);
        if (refused.indexOf(id) === -1) refused.push(id);
        return;
      }
      if (unseen.indexOf(id) === -1) { unseen.push(id); added++; }
    });
    var cap = sightCap();
    var kept = [], creations = 0;
    for (var i = unseen.length - 1; i >= 0; i--) {
      if (isAttachedId(unseen[i])) kept.unshift(unseen[i]);
      else if (creations < cap) { kept.unshift(unseen[i]); creations++; }
    }
    unseen = kept;
    await saveSight();
    if (refused.length && typeof print === "function") {
      print('SYSTEM', "NOT A PICTURE, NOT PUT IN FRONT OF HER :: " + refused.map(sightRefusalName).join(" / ")
        + "\nTHE VISION MODEL TAKES IMAGES ONLY, AND A CLIP IS ALREADY IN FRONT OF HER AS THE STILL IT CARRIES (ITS FIRST FRAME IS KEPT AS A PICTURE OF ITS OWN). NOTHING WAS REMOVED FROM THE VAULT.");
    }
    return { queued: added, waiting: unseen.length, refused: refused };
  }

  function sightPending() { return unseen.slice(); }

  // Mark images seen - called only for the images she was actually given to look at, so nothing
  // is ever dropped from the queue unseen.
  async function markSeen(ids) {
    var gone = (ids || []).filter(Boolean);
    if (!gone.length) return;
    unseen = unseen.filter(function (id) { return gone.indexOf(id) === -1; });
    await saveSight();
    // A "she asked to see it again" mark (chat.js, the [[SHOW: ...]] lane) is spent the moment she
    // has actually looked: if the same picture comes round again by another road - queued by hand
    // from the gallery, say - it is not called a request of hers any more.
    gone.forEach(function (id) {
      var r = window.media ? window.media.get(id) : null;
      if (r && r.recalledAt) window.media.setField(id, "recalledAt", 0);
    });
  }

  // A recycled image takes the slot of the one it replaced in the queue - and only that slot. A
  // render that was never queued (most of a batch: the queue keeps the newest few) does not get
  // one now, so recycling never pushes an image she has not seen out of the queue.
  async function replaceSight(oldId, newId) {
    var i = unseen.indexOf(oldId);
    if (i === -1) return false;
    unseen[i] = newId;
    await saveSight();
    return true;
  }

  /* ---- naming one thing in the vault ---------------------------------------
     ONE RESOLVER, MORE THAN ONE DOOR. /peek opens the mini lightbox on something in the vault, and
     /see puts one in front of her in the conversation; both have to answer the same question first -
     WHICH one did he name? - and the answer has to mean the same thing in both. So the four ways of
     naming one live here, once:

       (nothing)   the newest
       <ID>        an id, or the START of one - exactly the citation a receipt prints
       #TAG        the newest filed that way
       <N>         the Nth from the newest

     What comes back carries the LIST it was found in, in the vault's newest-first order, so a caller
     can walk it with the arrows (the mini lightbox) or open it on the full stage and get the same
     neighbours either way.

     opts.pictures  true  = only what the vision model may actually be shown (lookable: an image blob)
                    false = everything with a shape he can look at - a picture or a clip. That is what
                            /peek wants: a clip is worth opening even though it cannot be shown.
     -------------------------------------------------------------------------- */
  function vaultShelf(picturesOnly) {
    if (!window.media || !window.media.list) return [];
    return window.media.list().slice().reverse().filter(function (id) {
      var r = window.media.get(id);
      if (!r) return false;
      if (picturesOnly) return lookable(id);
      return /^image\//.test(String(r.mime || "")) || /^video\//.test(String(r.mime || "")) || r.kind === "video";
    });
  }

  // { ok: true, id, why, list, index } | { ok: false, error } - the error is the whole sentence the
  // caller prints behind its own prefix, because "which one did he mean?" has one answer everywhere.
  function resolveVaultTarget(arg, opts) {
    opts = opts || {};
    var shelf = vaultShelf(!!opts.pictures);
    if (!shelf.length) return { ok: false, error: opts.empty || "THERE IS NOTHING IN THE VAULT TO LOOK AT YET." };
    var a = String(arg == null ? "" : arg).trim();
    if (!a || /^(newest|latest|last|new)$/i.test(a)) {
      return { ok: true, id: shelf[0], why: "THE NEWEST IN THE VAULT", list: shelf, index: 0 };
    }
    if (/^#/.test(a)) {
      var tag = window.media.normTag ? window.media.normTag(a.slice(1)) : a.slice(1).toLowerCase();
      var list = shelf.filter(function (id) {
        var r = window.media.get(id);
        return r && window.media.tagsOf && window.media.tagsOf(r.tags).indexOf(tag) !== -1;
      });
      if (!list.length) return { ok: false, error: "NOTHING IN THE VAULT IS FILED #" + String(tag).toUpperCase() + ". /gallery find #" + tag + " SHOWS WHAT THE GALLERY CAN SEE." };
      return { ok: true, id: list[0], why: "#" + String(tag).toUpperCase(), list: list, index: 0 };
    }
    if (/^\d+$/.test(a)) {
      var n = parseInt(a, 10);
      if (!shelf[n - 1]) return { ok: false, error: "THE VAULT HOLDS " + shelf.length + " PICTURES AND THERE IS NO NUMBER " + n + "." };
      return { ok: true, id: shelf[n - 1], why: "NUMBER " + n + " FROM THE NEWEST", list: shelf, index: n - 1 };
    }
    var hit = window.media.get(a) ? a : "";
    for (var i = 0; i < shelf.length && !hit; i++) if (shelf[i].indexOf(a) === 0) hit = shelf[i];
    if (!hit) return { ok: false, error: "NOTHING IN THE VAULT MATCHES \u201c" + a.toUpperCase() + "\u201d (AN ID OR THE START OF ONE). /gallery find " + a.toUpperCase() + " SEARCHES THE PROMPTS AND THE TAGS INSTEAD." };
    return { ok: true, id: hit, why: "THE ONE YOU NAMED", list: shelf, index: shelf.indexOf(hit) };
  }

  window.vaultShelf = vaultShelf;
  window.resolveVaultTarget = resolveVaultTarget;

  // A vision the user asks for directly with /image (and /show). `label` is the command he actually
  // typed - both roads are the same render, but the record should say which door he came through.
  async function manualVision(prompt, label) {
    var door = (label === "show") ? "/show" : ((label === "initiative") ? "THE INFINITY" : "/image");
    var grid = document.createElement('div');
    grid.className = 'imageGrid';
    var wrap = document.createElement('div');
    wrap.className = 'entry';
    var tile = buildTile({ prompt: prompt });
    grid.appendChild(tile);
    wrap.appendChild(grid);
    var log = document.getElementById('output');
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;

    var btn = document.getElementById('sendBtn');
    if (btn) btn.disabled = true;
    try {
      // The whole render, so the record can carry the seed and the words actually sent - a
      // render that cannot be made again is a picture, not a recipe (src/js/renderbook.js).
      var out = await renderVision(prompt);
      var id = await window.media.add(out.blob, {
        kind: 'gen', prompt: out.base || prompt, sent: out.sent || '',
        seed: out.seed || 0, resolution: out.resolution || '',
        w: out.w || 0, h: out.h || 0, how: 'manual',
      });
      fillTile(tile, id);
      await queueSight([id]);
      await saveEntry({
        ts: Date.now(), kind: 'create', silent: true,
        h: door + ' ' + prompt, s: '[MANUAL VISION REQUEST]', img: [], sight: [],
        gen: [genRowOf(id, out, prompt)],
      });
      print('SYSTEM', 'IMAGE HELD IN THE VAULT. NOTHING ABOUT IT IS SAID TO HER IN WORDS - YOUR NEXT MESSAGE GIVES IT TO HER EYES.');
      return id;
    } catch (e) {
      failTile(tile, 'VISION FAILED: ' + ((e && e.message) ? e.message : e));
    } finally {
      if (btn) btn.disabled = false;
      log.scrollTop = log.scrollHeight;
    }
  }

  // ONE RENDER, ON THE RECORD. The archive entry a render belongs to carries this row - the same
  // fields the vault holds, so the book (`/renders`) and the archive agree about how a picture
  // was made, and the artifact name it went out under is written down with it.
  function genRowOf(id, out, fallbackPrompt) {
    // A RENDER THAT WAS ALREADY REPLACED. The automatic pipeline (src/js/upscale-local.js) can finish
    // between the render landing and this row being written, and the archive must never name a file
    // that is gone: the vault remembers the replacement, so the row is written against the record
    // that exists. (When the upscale finishes LATER - the usual case - the row names the render and
    // the replacement step rewrites it; either way the archive ends up naming the file that is here.)
    if (window.media && window.media.replacementFor && !window.media.get(id)) {
      var heir = window.media.replacementFor(id);
      if (heir && window.media.get(heir)) id = heir;
    }
    var rec = window.media ? window.media.get(id) : null;
    return {
      id: id,
      name: rec ? rec.name : '',
      file: rec ? window.media.artifactName(rec) : '',
      prompt: (out && (out.base || out.prompt)) || rec && rec.prompt || fallbackPrompt || '',
      sent: (out && out.sent) || '',
      negative: (out && out.negative) || '',
      seed: (out && out.seed) || 0,
      guidanceScale: (out && out.guidanceScale) || 0,
      resolution: (out && out.resolution) || (rec && rec.resolution) || '',
      pose: (out && out.pose) || (rec && rec.pose) || '',
      folder: (rec && window.media && window.media.folderOf) ? window.media.folderOf(rec) : '',
      ts: Date.now(),
    };
  }
  window.genRowOf = genRowOf;

  /* ---- THE SCREENING TANDEM -------------------------------------------------
     THE SCREENING ROOM IS THE FULL STAGE (the #lightbox overlay): the picture, clip or
     piece of music open in front of him, with HER TAKE beside KEEP. The DOX VIEWER has
     its tandem - the one page both of them look at together - and this is the same thing
     for the stage: while it is open the two of them are in front of the same record, he
     as HITL and she as ALIA, talking about what is on the screen in front of them.

     Two halves, like the docs tandem:
       promptBlock()  what is on the stage, told to her at the end of the system stack on
                      every turn (the `tandem` block beside the docs one in chat.js). Quoted
                      from the record itself - prompt, what she read in it, her take - so
                      what she says about it is about the real picture. Empty, and not sent
                      at all, while the stage is closed or the tandem is off.
       HER HAND       a [[STAGE: <ID, #tag or words from its prompt>]] line in a reply opens
                      that record on his stage, marked as hers (HERS on the bar), while she
                      is still speaking. One per reply; refused, never quietly dropped, when
                      the tandem is off. Read-only like the docs tandem: the only thing she
                      can move is his attention.
       TALKING        the stage is an overlay over the conversation, so the bar carries its
                      own talk strip - the two presences, the newest line of the log mirrored
                      beside them, and a one-line box driving the same input and the same
                      send as the lower deck. A stage that must be closed in order to speak
                      is not a page you share.
     ------------------------------------------------------------------------- */
  var SCREEN_TANDEM_KEY = "screenTandem";
  var stageHer = null;   // the id she turned the stage to (null = his hand moved last)
  var screenNote = null; // { text, at } - a transient line holding the strip (see note)
  var screenNoteMs = 9000;
  var screenTalkWired = false;
  var screenLogWatch = null;
  var screenTick = null;

  // The tandem switch lives in the chip now (lazy: it reads the seam below on first use).

  function screenSaveRaw(on) { try { window.localStorage.setItem(SCREEN_TANDEM_KEY, on ? "1" : "0"); } catch (e) {} }
  function screenIsOn() { try { return screenClient().isOn(); } catch (e) { return true; } }
  function screenSetOn(on) {
    try { screenClient().setOn(on); } catch (e) {}
    if (!on) {
      try {
        stageHer = null;
        var lb = document.getElementById('lightbox');
        if (lb) delete lb.dataset.her;
      } catch (e) {}
    }
    screenPaintTalk();
    return screenIsOn();
  }

  function screenIsOpen() {
    try {
      var lb = document.getElementById('lightbox');
      if (!lb || lb.hidden || !lightboxId) return false;
      if (!window.media || typeof window.media.get !== "function") return false;
      return !!window.media.get(lightboxId);
    } catch (e) { return false; }
  }

  function screenShort(s, n) {
    s = String(s == null ? "" : s);
    return s.length > n ? s.slice(0, n) + " \u2026" : s;
  }

  /* THE ENGINE (the sia-screening-room-chip). The resolving, the block, the words and the
     turns live in the chip (window.MythosScreeningRoom, src/chips/sia-screening-room-chip/);
     this file owns the doors: the vault rows, the stage state, the opening/walking/reading
     of it, and the talk strip below. One source of truth, in the chip. */
  function screenRows() {
    var out = [];
    try {
      var M = window.media;
      if (!M || typeof M.list !== "function") return out;
      var ids = M.list() || [];
      for (var i = 0; i < ids.length; i++) {
        var rec = null;
        try { rec = M.get(ids[i]); } catch (e) { rec = null; }
        if (!rec) continue;
        var mime = String(rec.mime || "");
        out.push({
          id: ids[i],
          kind: String(rec.kind || (/^video\//.test(mime) ? "clip" : (/^audio\//.test(mime) ? "voice" : "picture"))),
          mime: mime, name: String(rec.name || ""), prompt: String(rec.prompt || ""),
          caption: String(rec.sight || rec.caption || ""), heard: String((rec.heard && rec.heard.text) || ""),
          tags: Array.isArray(rec.tags) ? rec.tags.slice() : [],
          by: String(rec.by || ""), w: rec.w || 0, h: rec.h || 0,
          critic: rec.critic ? { v: rec.critic.v, n: rec.critic.n, clone: rec.critic.clone || "", by: rec.critic.by || "" } : null
        });
      }
    } catch (e) {}
    return out;
  }
  function screenRowFor(id) {
    var rows = screenRows();
    for (var i = 0; i < rows.length; i++) if (String(rows[i].id) === String(id)) return rows[i];
    return null;
  }
  var screenClientP = null;
  function screenClient() {
    if (screenClientP) return screenClientP;
    if (!window.MythosScreeningRoom || typeof window.MythosScreeningRoom.client !== "function") {
      throw new Error("THE SCREENING CHIP IS OFFLINE (src/chips/sia-screening-room-chip/ DID NOT LOAD).");
    }
    screenClientP = window.MythosScreeningRoom.client({
      readGallery: screenRows,
      readStage: function () {
        if (!screenIsOpen()) return { open: false };
        return { open: true, id: lightboxId, rec: screenRowFor(lightboxId), pos: navAt, total: navList.length, her: !!stageHer };
      },
      openStage: function (id, o) {
        o = o || {};
        if (!o.her) { try { stageHer = null; } catch (e) {} }
        var list = (navList.length && navList.indexOf(id) !== -1) ? navList.slice() : null;
        openLightbox(id, list ? { list: list, her: !!o.her } : (o.her ? { her: true } : {}));
        return { ok: true };
      },
      stepStage: function (dir) {
        if (!screenIsOpen()) return { ok: false, error: "THE STAGE IS CLOSED - OPEN A PICTURE FIRST (THE GALLERY, OR /screen look <...>)." };
        if (navList.length < 2) return { ok: false, error: "THE STAGE WALKS ALONE - OPEN IT WITH ITS WALK (THE GALLERY HANDS OVER ITS ROWS)." };
        return window.lightboxStep(dir) ? { ok: true, id: lightboxId } : { ok: false, error: "THE STAGE WOULD NOT WALK." };
      },
      takeStage: function () {
        if (!window.critic) return Promise.resolve("THE CRITIC LANE IS OFFLINE (src/js/critic.js DID NOT LOAD).");
        return window.critic.study(lightboxId, {}).then(function (t) { return t; }, function (e) { return "HER TAKE FAILED :: " + String((e && e.message) || e); });
      },
      loadTandem: function () {
        try {
          var v = window.localStorage.getItem(SCREEN_TANDEM_KEY);
          if (v === "0") return false;
          if (v === "1") return true;
        } catch (e) {}
        return undefined;
      },
      saveTandem: screenSaveRaw,
      say: function (t) { try { print('SYSTEM', t); } catch (e) {} }
    });
    return screenClientP;
  }
  function screenPromptBlock() {
    try { return screenClient().block(); } catch (e) { return ""; }
  }
  function screenResolve(query) {
    try { return screenClient().resolve(query); } catch (e) { return null; }
  }
  function screenLook(spec, opts) {
    try { return screenClient().look(spec, opts); }
    catch (e) { return { ok: false, error: "THE SCREENING ROOM IS OFFLINE :: " + String((e && e.message) || e).toUpperCase().slice(0, 120) }; }
  }
  function screenStatus() {
    try { return screenClient().status(); }
    catch (e) { return "THE SCREENING ROOM :: OFFLINE (" + String((e && e.message) || e).toUpperCase().slice(0, 80) + ")."; }
  }
  async function screenWords(arg) {
    try { return await screenClient().words(arg); }
    catch (e) { return "THE SCREENING ROOM FAILED :: " + String((e && e.message) || e); }
  }

  // Re-paint the stage in place (HER TAKE filing, a tag hung while open): the record is
  // re-read, the walk and her mark kept.
  function screenRefresh(onlyId) {
    if (!screenIsOpen()) return false;
    if (onlyId && String(onlyId) !== String(lightboxId)) return false;
    var id = lightboxId, list = navList.length ? navList.slice() : null, her = !!stageHer;
    try { openLightbox(id, list ? { list: list, her: her } : (her ? { her: true } : {})); return true; }
    catch (e) { return false; }
  }

  /* ---- the talk strip ---------------------------------------------------- */
  function screenTalkNote(text) {
    screenNote = { text: String(text == null ? "" : text), at: Date.now() };
    screenPaintTalk();
    return text;
  }

  function screenTalkSend() {
    var box = document.getElementById('userInput');
    var field = document.getElementById('lightboxTalkInput');
    if (!box || !field) return false;
    var text = String(field.value || "").trim();
    if (!text) return false;
    var btn = document.getElementById('sendBtn');
    if (btn && btn.disabled) { screenTalkNote("SHE HAS NOT FINISHED THE LAST ONE :: SEND AGAIN WHEN SHE HAS."); return false; }
    field.value = "";
    box.value = text;
    try { box.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) {}
    if (window.send) { window.send(); }
    return true;
  }

  // THE NEWEST LINE OF THE LOG, READ OFF THE LOG ITSELF (same road as the docs tandem's
  // strip: dataset.said is the truth, never re-parsed paint).
  function screenNewest() {
    var log = document.getElementById('output');
    if (!log) return null;
    var rows = log.children;
    for (var i = rows.length - 1; i >= 0 && i > rows.length - 12; i--) {
      var n = rows[i];
      if (!n || !n.classList || !n.classList.contains("entry")) continue;
      if (n.classList.contains("backstage")) continue;
      var who = n.classList.contains("sdm") ? "ALIA" : (n.classList.contains("hitl") ? "HITL" : "");
      var text = (n.dataset && n.dataset.said) ? String(n.dataset.said) : "";
      if (!text) {
        var msg = n.querySelector ? n.querySelector(".msg") : null;
        text = String((msg || n).textContent || "").replace(/^\[[^\]]*\]\s*/, "").replace(/^(HITL|LIA ID|SYSTEM)\s*:?\s*/, "").replace(/\s+/g, " ").trim();
      }
      if (text) return { who: who, text: text, sys: !who };
    }
    return null;
  }

  function screenPaintTalk() {
    var strip = document.getElementById('lightboxScreenTalk');
    if (!strip) return;
    var here = document.getElementById('lightboxTalkHere');
    var hers = document.getElementById('lightboxTalkAlia');
    var say = document.getElementById('lightboxTalkSay');
    var tBtn = document.getElementById('lightboxTandemBtn');
    if (tBtn) {
      tBtn.setAttribute("aria-pressed", screenIsOn() ? "true" : "false");
      tBtn.textContent = screenIsOn() ? "TANDEM" : "TANDEM OFF";
    }
    if (!screenIsOpen()) {
      if (here) here.textContent = "";
      if (hers) hers.textContent = "";
      if (say) { say.textContent = ""; say.className = "lbTalkSay"; }
      return;
    }
    var rec = null;
    try { rec = window.media.get(lightboxId); } catch (e) { rec = null; }
    if (here) {
      here.textContent = "HITL \u25b8 " + String((rec && (rec.name || rec.prompt)) || lightboxId).toUpperCase().slice(0, 40)
        + (navList.length > 1 && navAt >= 0 ? " \u00b7 " + (navAt + 1) + "/" + navList.length : "");
    }
    if (hers) {
      hers.textContent = !screenIsOn() ? "ALIA \u25b8 HER HAND IS OFF THE STAGE (/screen tandem on)"
        : (stageHer ? "ALIA \u25b8 HERS - SHE TURNED THE STAGE HERE" : "ALIA \u25b8 READING WITH YOU");
    }
    if (say) {
      var fresh = (screenNote && screenNote.at && (Date.now() - screenNote.at) < screenNoteMs) ? screenNote : null;
      var airWord = (window.voice && window.voice.air) ? String(window.voice.air() || "") : "";
      var newest = screenNewest();
      var his = !!(newest && newest.who === "HITL");
      var line = null, thinking = false;
      if (fresh) line = { who: "", text: fresh.text, sys: true };
      else if (airWord === "HER TURN" && !his) { line = { who: "ALIA", text: "IS THINKING ..." }; thinking = true; }
      else line = newest;
      if (!line) {
        say.textContent = "SHE IS HERE WITH YOU IN FRONT OF THIS RECORD - TALK.";
        say.className = "lbTalkSay";
      } else {
        say.textContent = (line.who ? line.who + ": " : "") + screenShort(line.text, 300);
        say.className = "lbTalkSay" + (line.who === "HITL" ? " me" : line.who === "ALIA" ? (thinking ? " her thinking" : " her") : " sys");
      }
    }
  }

  function screenOnOpen() {
    try {
      if (!screenLogWatch && window.MutationObserver) {
        var log = document.getElementById('output');
        if (log) {
          screenLogWatch = new MutationObserver(function () { if (screenIsOpen()) screenPaintTalk(); });
          screenLogWatch.observe(log, { childList: true });
        }
      }
    } catch (e) {}
    if (!screenTick) {
      try { screenTick = window.setInterval(function () { if (screenIsOpen()) screenPaintTalk(); }, 2000); } catch (e) {}
    }
    screenPaintTalk();
  }

  function screenWireTalk() {
    if (screenTalkWired) return true;
    var strip = document.getElementById('lightboxScreenTalk');
    if (!strip) return false;
    screenTalkWired = true;
    var field = document.getElementById('lightboxTalkInput');
    if (field) {
      field.addEventListener("keydown", function (e) {
        e.stopPropagation();
        if (e.key === "Enter") { e.preventDefault(); screenTalkSend(); }
        if (e.key === "Escape") { e.target.blur(); }
      });
      field.addEventListener("click", function (e) { e.stopPropagation(); });
    }
    var send = document.getElementById('lightboxTalkSend');
    if (send) send.addEventListener("click", function (e) { e.stopPropagation(); screenTalkSend(); });
    var tBtn = document.getElementById('lightboxTandemBtn');
    if (tBtn) tBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      screenSetOn(!screenIsOn());
      screenTalkNote(screenIsOn()
        ? "THE SCREENING TANDEM IS ON :: SHE IS TOLD WHAT IS ON THE STAGE AND SHE CAN TURN IT WITH A STAGE LINE."
        : "THE SCREENING TANDEM IS OFF :: HER HAND IS OFF THE STAGE, AND SHE IS TOLD NOTHING ABOUT IT. /screen tandem on TURNS IT BACK ON.");
    });
    return true;
  }
  try { screenWireTalk(); } catch (e) {}

  function screenDescribe() {
    return ["THE SCREENING ROOM (the full stage: src/js/images.js screening block over the lightbox).",
      "  THE TANDEM: while the stage is open and the tandem is on, she is told what record is on it - name, kind, what it was made from, what she read in it, her take filed on it, its tags, where he is in the walk - and her hand can TURN THE STAGE with a STAGE line naming an ID, a tag or words. The stage is read-only: the only thing either of them moves is the other's attention.",
      "  /screen look <ID|#TAG|WORDS> turns it from your side; next|prev walks it; take reads the open one in her critical voice (HER TAKE, one vision call); tandem on|off is her hand on it. The talk strip in the bar keeps the conversation alive while the stage is up."].join("\n");
  }

  window.screening = {
    isOpen: screenIsOpen, isOn: screenIsOn, setOn: screenSetOn,
    promptBlock: screenPromptBlock, look: screenLook, resolve: screenResolve,
    refresh: screenRefresh, words: screenWords, describe: screenDescribe,
    onOpen: screenOnOpen, paintTalk: screenPaintTalk, note: screenTalkNote
  };
