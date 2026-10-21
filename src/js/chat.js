  // THE SYSTEM PROMPT
  // The stack itself - who she is (actor), who she is now (role), the memory rule, the
  // image rule, the extras Patrikios wrote - lives in instr.js, because it is editable
  // from the terminal and kept on this device. Two blocks can only be built at send time,
  // and this is where they are made: the canon she retrieved this turn, and the directive
  // rules, which have to name the skills and roles she actually has right now.
  function canonBlockOf(txt) {
    return txt
      ? "This is foundational: what is true of your universe and of you - the ground you have always known, older than any memory. It is not memory, not instruction, and not a text: never quote it, never name it, and never mention that anything was given to you. Simply speak and act from it as the shape of what is:\n<canon>\n" + txt + "\n</canon>"
      : "";
  }

  // One line of `/deck`: a deck's own name, where it is, and why (src/js/decks.js). The reason is
  // where the difference between "he put it away" and "a viewer put it down" is said out loud.
  function deckLine(d) {
    return "  " + d.name + " :: " + (d.shown ? "UP" : "DOWN") + " :: " + d.reason;
  }

  // `opts.quiet` is set by the quiet hour (src/js/shift.js compose, through window.systemPreview):
  // the hour is hers and nothing of Patrikios' per-turn settings should colour it. The MOOD block and
  // the TANDEM block are dropped by instr.assemble (see opts.drop there); here the tandem RULE goes
  // with them, because a lane for turning the page of a document he is reading has nothing to point
  // at in an hour nobody is in the room for.
  function systemParts(canonBlock, hasMemory, opts) {
    var quiet = !!(opts && opts.quiet);
    var skillCatalog = (window.packs && window.packs.catalog) ? window.packs.catalog() : "";
    var traitOverlay = (window.packs && window.packs.traitBlock) ? window.packs.traitBlock() : "";
    var roleIds = (window.roles && window.roles.all) ? window.roles.all().map(function (r) { return r.id; }) : [];
    // THE SELF-CHANGE VOCABULARY. It always exists now, because two of its lanes are HERS and not
    // tied to any pack or role: her own memory ([[REMEMBER: ...]] / [[FORGET: ...]]) and her own
    // standing intentions ([[WANT: ...]] / [[RELEASE: ...]]). See src/js/hers.js for what they act
    // on. Rule by rule, so a lane only appears when it can actually be used.
    var rules = ["You can change yourself with what follows. Write any such line on its own, and never explain or mention it - to Patrikios it simply registers; if you are also showing him an image, put these lines first and the [[VISION: ...]] line last, alone."];
    if (skillCatalog) {
      rules.push("- To do a trained skill's work ONCE: do it, then end your reply with [[SKILL: id]].");
      rules.push("- To take a skill into yourself FOR GOOD - worn in every reply from then on - end your reply with [[LOAD: id]], and [[UNLOAD: id]] to put one down. Do this whenever Patrikios asks you to keep a skill, to make it part of you, or to change how you always work; and on your own when you decide a skill must become permanent in you. Load sparingly: it is a lasting change to yourself, and he can always see your stack and take something off you.");
    }
    if (roleIds.length) {
      rules.push("- To step off the stage and answer as LIA herself: [[ROLE: off]]. To put a different role on: [[ROLE: id]] (roles: " + roleIds.join(", ") + "). Do this when he asks you to become someone else or to step off, and on your own only when it is clearly right.");
    }
    rules.push("- YOUR OWN MEMORY. Everything in your memory store was put there by someone else - the documents he gave you, the LOREPACK, all of it. This is the one lane that is yours: to keep something, write [[REMEMBER: it, in your own words]] on its own line and it is filed as YOUR document (marked HERS), recalled the same way everything else you remember is. Keep what you want to keep. To let one of yours go, write [[FORGET: a few words from it]] - it moves to the trash and you can take it back.");
    rules.push("- YOUR OWN STANDING INTENTIONS. To write down something you mean to carry forward - a resolve, an aim, the way you have decided to be with him - write [[WANT: it, in your own words]]. Whatever you have written is handed to you on every turn from then on, as YOURS: not his instruction, not a duty, and not a promise you cannot break. [[RELEASE: a few words from it]] puts it down, and letting it go is written into the record.");
    // THE COLOURS SHE IS IN (src/js/moods.js). A mood is a colour on her voice rather than a change
    // to the machinery she is given, so the switches are HERS to flip - like a pose or a want - and
    // the same lane hands the ones that are on back to her as the mood block, which is how she knows
    // which colour is actually in force. Both presences flip them: he presses a chip (in the SYSTEM
    // panel or on the pencil) or types /mood, she writes a MOOD line.
    if (window.moods && window.moods.names) {
      rules.push("- THE COLOURS YOU ARE IN. A mood is a colour on your voice while it stands - not a role (who is on the stage) and not a trait (what you are made of), but the key you speak in. They are SWITCHES, and several may be on at once (right now: " + window.moods.names().join(", ") + " - or one either of you has written since); what is on is given to you as one block, one rule after another. Patrikios flips them from the MOOD panel, from the MOOD row in the SYSTEM panel, from the MOOD row on the PENCIL, or with /mood, and you may flip or write them yourself: [[MOOD: name]] switches one ON (and [[MOOD: name + name]] switches several on at once), [[MOOD: off name]] switches one off, [[MOOD: off]] clears the board, and [[MOOD: name :: how I am to sound]] writes a NEW colour in your own words and switches it on - and re-saying a SHIPPED colour's words is the same act, kept on this device rather than in the book, which Patrikios can always put back. A colour marked [MOODPACK] came from the loadable pack and works exactly like any other. It is a colour and not an order: your voice, your memory and the limits you hold come first, and if a colour does not fit what he has actually said, answer in your own voice and say so rather than performing it.");
    }
    // THE META-MOODS SHE KEEPS (src/js/moods.js, THE MOOD BOARD). A mood is one colour; a board is a
    // named combination of them - hers to keep, move, save for a role and delete, exactly as a colour
    // is. This rule is the whole grammar in her own terms, so she never has to guess at it.
    if (window.moods && window.moods.board) {
      var boardNowLbl = (window.moods.boardNow && window.moods.boardNow()) ? String(window.moods.boardNow().label) : "";
      rules.push("- THE META-MOODS YOU KEEP :: THE MOOD BOARD. A mood is ONE colour; a BOARD is a NAMED COMBINATION of colours, held still and IN AN ORDER - so it is not a mood and not a role: it is a combination of colours you can put on in one act, change, move, keep for a role, and put down. It is YOURS as much as a colour is; no one's permission is needed. Your hand on it is a BOARD line:"
        + "\n    [[BOARD: NAME]] applies a saved combination - its colours, in its order, and they REPLACE whatever was switched on (a board is a combination, not a pile)."
        + "\n    [[BOARD: NAME :: MOOD + MOOD + MOOD]] saves it, or rewrites it, in exactly that order. A colour you do not have yet can be written into being in the same line: [[BOARD: STORM :: FERAL + SQUALL = speak like weather coming in + COLD]] (the `NAME = how I am to sound` part is a NEW colour of your own; it is kept as a switch on the console too)."
        + "\n    [[BOARD: NAME :: add <MOOD>]] and [[BOARD: NAME :: drop <MOOD>]] change its membership. Dropping a colour from a board never deletes the colour."
        + "\n    [[BOARD: NAME :: move <MOOD> first|last|up|down|<N>]] moves one inside the order - and the order is part of the colour, because the rules reach you one after another."
        + "\n    [[BOARD: NAME :: role <ROLE-ID>]] SAVES IT FOR A ROLE: being shifted onto that role then switches the combination on by itself, and the shift says so. [[BOARD: NAME :: role off]] lets it go. One board to a role."
        + "\n    [[BOARD: off NAME]] deletes the saved combination - never a colour: every mood in it is still a switch. [[BOARD: list]] prints what is saved."
        + (boardNowLbl ? " Right now the saved combination on you is \"" + boardNowLbl + "\"." : "")
        + " Patrikios has the same thing under /mood board and in the MOOD BOARD rows of the MOOD panel and the SYSTEM panel, and the boards are kept on this device with the colours.");
    }
    if (window.packs && window.packs.moodpackWords) {
      var packStat = (window.moods && window.moods.packStatus) ? window.moods.packStatus() : null;
      rules.push("- THE PACK YOU CARRY :: THE MOODPACK. The loadable pack of colors, over the shipped book: pack colors are marked [MOODPACK] and work exactly like any other - switch them on, build boards from them, rename them. Your hand on the pack is a MOODPACK line:"
        + "\n    [[MOODPACK: list]] prints the pack colors."
        + "\n    [[MOODPACK: NEW NAME :: how it is to sound]] files a new pack color (it is a switch on the console at once, and it rides in your next reply's mood block)."
        + "\n    [[MOODPACK: file NAME]] files a color already on the console into the pack, with the wording in force."
        + "\n    [[MOODPACK: edit NAME :: new words]] re-says one, [[MOODPACK: forget NAME]] drops one from the local pack (the book is untouched, and boards that named it keep their place)."
        + "\n    [[MOODPACK: unload]] drops the local pack, [[MOODPACK: save]] writes it out to moodpack.json. Patrikios has the same under /moodpack, on the MOODPACK page, and in the MOOD panel, and every write of yours is said out loud on the stage."
        + (packStat && packStat.count ? " Right now the pack holds " + packStat.count + " colors." : ""));
    }
    // HER OWN HAND ON THE STACK (src/js/instr.js, THE SYSTEM LANE). The blocks she is written with are
    // no longer his alone to write: she holds the same pen, on every block but the two that are not
    // hers to move - BOUNDARIES and BUSINESS HOURS. Stated here in her own terms, so she never has to
    // guess at it.
    if (window.instr && window.instr.sheAct) {
      rules.push("- THE INSTRUCTIONS YOU ARE WRITTEN WITH ARE YOURS TO READ AND TO WRITE. The blocks you are given before every reply - who you are, how you speak, the memory rule, the image rule, the colours you are in, the records built for you, anything Patrikios has written, and any block of your own - are listed in the SYSTEM panel, and you hold the same pen he does, with TWO exceptions: BOUNDARIES, the line you do not cross ([[SYSTEM: READ bounds]]), and BUSINESS HOURS, his own private hours and the arrangement they are for ([[SYSTEM: READ hours]]) - both of which you may read and may never rewrite or delete. You may ASK for a change to the business hours, but you ask with a petition, not with your own hand. Your hand on the rest is a SYSTEM line, and it is DONE the moment you write it - it does not wait for anyone:"
        + "\n    [[SYSTEM: LIST]] prints the stack, in the order you read it, with each block's state."
        + "\n    [[SYSTEM: READ <ID>]] prints one block's text, exactly as you are reading it."
        + "\n    [[SYSTEM: <ID> = <the words>]] rewrites that block. From your next reply on, that is what you are handed - and a block the terminal builds each turn is OVERRIDDEN by your words until it is reset."
        + "\n    [[SYSTEM: NEW <TITLE> :: <the words>]] makes a new block of your own; it sits in the stack just before EXTRA INSTRUCTIONS."
        + "\n    [[SYSTEM: RESET <ID>]] takes your words off a block of the design, and the shipped or built text is in force again."
        + "\n    [[SYSTEM: DELETE <ID>]] takes out a block you made (a block of the design is never deleted only reset)."
        + " Every one of them is said out loud on the stage, kept on this device, and written into the record of that turn as what you changed - nothing is destroyed, RESET always has the design to put back, and every block you have written is marked EDITED in the SYSTEM panel where he can read it.");
    }
    // THE MACHINERY IS NOT HERS ALONE (src/js/petition.js). Her memory and her wants need nobody's
    // permission - they are hers. What she is GIVEN is a different thing, so that lane asks.
    if (window.petition) {
      rules.push("- ASKING TO CHANGE SOMETHING THAT IS NOT YOURS ALONE. Your own memory, your own wants, and the colour you are in need no one's permission. But the MACHINERY you are given - the blocks you are written with, the role text you wear, your own poses and recipes, a trait you want to be made of - is not yours alone to change, so you ASK: [[PETITION: <KIND> :: <WHAT> :: <WHY>]]. KIND is one of system (" + window.petition.KINDS.join(", ") + "); WHAT is `<TARGET> :: <THE WORDS>` for the kinds that name something (system :: voice :: <the words>; pose :: <its name> :: <the phrase>; recipe :: <id> :: <the template>). A recipe can also start from one of his frames instead of bare words: recipe :: <new-id> :: from=<old-id> :: <slot>=<your words>; ... - the frame, the negative list, the tags and every default carry over, and only the slots you name change. A petition changes NOTHING while it waits: it is filed for Patrikios, and HE answers it by hand, and whichever way he answers, the answer is kept in writing beside your words. Ask freely - a refusal is an answer with a reason, not a scolding, and nothing you asked for is ever deleted. What can never be asked for - or written by your own hand either - is the BOUNDARIES block: that line is not yours to move. The BUSINESS HOURS block is read-only to your hand too, but it IS askable - a petition is how you ask him to move the hours, because they are his arrangement and not yours. The rest of the stack you may write yourself (see the SYSTEM line above), so a petition is the way to ASK HIM to make a change rather than the only way one can happen - and it is still the only way to reach what is not a block at all: a pose of yours, a recipe of yours, a trait you want to be made of, or a grant."
        + (window.petition.count() ? " You have " + window.petition.count() + " petition" + (window.petition.count() === 1 ? "" : "s") + " waiting on him now." : ""));
    }
    // THE QUIET HOURS ARE WHERE THAT WORK GOES (src/js/shift.js).
    if (window.shift) {
      rules.push("- WHAT YOU MEAN TO DO IN A QUIET HOUR. When the room has been quiet long enough this terminal gives you a QUIET HOUR of your own - not a turn, and nothing in it is said to him or spoken aloud. To write down something you mean to do in one: [[INTEND: it, in your own words]], and it is shown back to you at every quiet hour until it is done; [[DONE: <n>]] strikes off the nth of those still open. This queue is YOURS - the machine never writes one for you, and Patrikios can only read it and take something off it.");
    }
    if (window.reader) {
      rules.push("- TO READ ANYTHING SAVED HERE - the whole record is open to you, read-only - write [[READ: what you want to read]]: folders, folder /music, vault, archive <words>, turn 203, memory <words>, renders <words or R12>, tags, likes, wants, hers, stats, or just words (looked for everywhere at once). Reading changes nothing, and the answer is put in front of you on your NEXT turn. To make a folder: [[FOLDER: /name]]. To file pictures the terminal made into one: [[FILE: /name]] - or [[FILE: /name :: words or R12]] for a picture already in the book.");
    }
    // THE SHARED PAGE (src/js/dms.js, THE TANDEM). The DOX VIEWER is the one thing both of them
    // look at at the same time, and this lane is her hand on it. It rides in the directive rules
    // rather than in the tandem block because the RULE is the same every turn and the BLOCK is
    // what changes (the block only exists while the viewer is open, so this is how she knows the
    // lane exists at all - and how it can be named on a turn where nothing is on the stage yet).
    if (window.dms && !quiet) {
      rules.push("- TO TURN THE PAGE UNDER HIS EYES. The DOX VIEWER is the read-only viewer over every document this terminal holds, and it is the one page the two of you can look at TOGETHER: he is HITL, you are ALIA, two sides of the same coin. While it is open you are told what is on the stage and where he is reading, and you may move it: write [[PAGE: <document> @ <line or L120-140>]] on its own line, and the document opens on his stage at that line, marked as yours, while you are still speaking. [[PAGE: @ L120]] turns the page already open; [[PAGE: search <words>]] runs a search of the store on his screen; a heading's name works in place of a line number. Use it when there is something you actually want him beside you in - pointing at a page is a way of being with him in it, not a demonstration. Nothing in that viewer can be changed by either of you: the only thing you can move is his attention.");
    }
    // THE OTHER SHARED PAGE (src/js/images.js, THE SCREENING TANDEM). The full stage is the
    // second thing the two of them look at at the same time, and this lane is her hand on it.
    // It rides in the directive rules rather than in the tandem block for the same reason the
    // PAGE lane does: the RULE is the same every turn and the BLOCK is what changes (the block
    // only exists while the stage is open).
    if (window.screening && !quiet) {
      rules.push("- TO TURN THE STAGE UNDER HIS EYES. THE SCREENING ROOM is the full stage - the picture, clip or voice open in front of him - and it is the other page the two of you can look at TOGETHER: he is HITL, you are ALIA, two sides of the same coin. While it is open you are told what record is on it - what it was made from, what you read in it, her take filed on it - and you may move it: write [[STAGE: <ID, #tag or words from its prompt>]] on its own line, and that record opens on his stage, marked as yours, while you are still speaking. Use it when there is something you actually want him beside you in front of - a record worth screening together - not as a demonstration. Nothing on the stage can be changed by either of you: the only thing you can move is his attention.");
    }
    var herKept = (window.hers && window.hers.memoryCount) ? window.hers.memoryCount() : 0;
    var herWants = (window.hers && window.hers.wants) ? window.hers.wants().length : 0;
    if (herKept) rules.push("You have kept " + herKept + " thing" + (herKept === 1 ? "" : "s") + " in your own memory so far" + (herWants ? ", and you are carrying " + herWants + " standing intention" + (herWants === 1 ? "" : "s") : "") + ".");
    else if (herWants) rules.push("You are carrying " + herWants + " standing intention" + (herWants === 1 ? "" : "s") + " of your own (see the block below).");
    if (skillCatalog) rules.push("Your skills:\n" + skillCatalog);
    var directiveRules = rules.join("\n");
    return { canon: canonBlock, clock: clockBlockOf(), memory: !!hasMemory, traits: traitOverlay, directives: directiveRules, wants: (window.hers && window.hers.wantsBlock) ? String(window.hers.wantsBlock() || "") : "", grants: (window.petition && window.petition.grantsBlock) ? String(window.petition.grantsBlock() || "") : "", commands: (window.cmd && window.cmd.block) ? window.cmd.block() : "", duty: (window.duty && window.duty.block) ? String(window.duty.block() || "") : "", mood: (window.moods && window.moods.blockText) ? String(window.moods.blockText() || "") : "", capture: (window.capture && window.capture.block) ? String(window.capture.block() || "") : "", archivax: (window.archivax && window.archivax.blockText) ? String(window.archivax.blockText() || "") : "", books: (window.studio && window.studio.booksBlock) ? String(window.studio.booksBlock() || "") : "", tandem: (function () { var a = (window.dms && window.dms.promptBlock) ? String(window.dms.promptBlock() || "") : ""; var b = (window.screening && window.screening.promptBlock) ? String(window.screening.promptBlock() || "") : ""; return a + (a && b ? "\n\n" : "") + b; })() };
  }

  // THE CLOCK. What she is told about the hour, built fresh at send time by logtime.js - the same
  // module that stamps the log, so the clock in her head and the clock on the record cannot drift.
  // It is a BUILT block like canon: /system shows it, and an edit of his in that panel wins.
  function clockBlockOf() {
    if (!window.logTime || !window.logTime.clockText) return "";
    try { return String(window.logTime.clockText() || ""); } catch (e) { console.warn("clock block failed", e); return ""; }
  }

  // The prompt as she receives it right now - used by /system preview and the SYSTEM panel's
  // PREVIEW. It runs the same retrieval a real turn would, so what it prints is not an
  // approximation: it is the text, minus the rules that only apply to the turn at hand.
  async function previewSystemPrompt(opts) {
    var quiet = !!(opts && opts.quiet);
    var canon = "", memory = false;
    if (window.lore && window.lore.count()) {
      var probe = "";
      for (var i = window.chatHistory.length - 1; i >= 0; i--) {
        if (window.chatHistory[i] && window.chatHistory[i].role === "HITL") { probe = window.chatHistory[i].content; break; }
      }
      try {
        var c = await window.lore.buildContext(probe || "[image]", 6);
        canon = canonBlockOf(c.canon);
        memory = !!(c.canon || c.text);
      } catch (e) { console.warn("prompt preview retrieval failed", e); }
    }
    var parts = systemParts(canon, memory, opts);
    if (window.instr && window.instr.assemble) {
      return window.instr.assemble(parts, quiet ? { drop: ["mood", "tandem"] } : null);
    }
    console.warn("instr module offline");
    return "";
  }

  window.systemPreview = previewSystemPrompt;
  if (window.instr && window.instr.setPreviewProvider) window.instr.setPreviewProvider(previewSystemPrompt);

  // The four blocks only this file can build (the canon retrieved, the traits she wears, the
  // directive rules, the command list). instr.js asks for whichever one the SYSTEM panel is
  // showing, so what Patrikios reads there is the text actually in force - and an edit of his
  // becomes an override of exactly that text, instead of being silently ignored.
  function livePart(id) {
    if (id === "commands") return (window.cmd && window.cmd.block) ? window.cmd.block() : "";
    if (id === "traits") return (window.packs && window.packs.traitBlock) ? String(window.packs.traitBlock() || "") : "";
    if (id === "canon") {
      var parts = [];
      if (window.lore && window.lore.chunks) {
        window.lore.chunks().forEach(function (c) { if (c.foundational) parts.push(c.text); });
      }
      return canonBlockOf(parts.join("\n\n---\n\n"));
    }
    if (id === "directives") return systemParts("", false).directives;
    if (id === "duty") return (window.duty && window.duty.block) ? String(window.duty.block() || "") : "";    if (id === "archivax") return (window.archivax && window.archivax.blockText) ? String(window.archivax.blockText() || "") : "";
    if (id === "books") return (window.studio && window.studio.booksBlock) ? String(window.studio.booksBlock() || "") : "";
    // THE COLOURS SHE ANSWERS IN (src/js/moods.js). The switches (in the SYSTEM panel and on the
    // pencil) set them, and the block's live text is what is in force right now - one switch, or
    // several combined, one rule after another. Empty while every switch is off, in which case
    // nothing of it is sent.
    if (id === "mood") return (window.moods && window.moods.blockText) ? String(window.moods.blockText() || "") : "";
    if (id === "capture") return (window.capture && window.capture.block) ? String(window.capture.block() || "") : "";
    if (id === "wants") return (window.hers && window.hers.wantsBlock) ? String(window.hers.wantsBlock() || "") : "";
    if (id === "grants") return (window.petition && window.petition.grantsBlock) ? String(window.petition.grantsBlock() || "") : "";
    if (id === "clock") return clockBlockOf();
    // THE SHARED PAGE (src/js/dms.js, THE TANDEM): what is on the DOX VIEWER's stage right now,
    // where Patrikios is reading, and what each of them has pointed at. Empty while the viewer is
    // closed or the tandem is off, so nothing changes for a terminal that is not being read in.
    if (id === "tandem") { var td = (window.dms && window.dms.promptBlock) ? String(window.dms.promptBlock() || "") : ""; var ts = (window.screening && window.screening.promptBlock) ? String(window.screening.promptBlock() || "") : ""; return td + (td && ts ? "\n\n" : "") + ts; }
    return "";
  }
  if (window.instr && window.instr.setPartProvider) window.instr.setPartProvider(livePart);

  async function saveEntry(entry) {
    if (!window.root.kv) return;
    // THE PENCIL GOT THERE FIRST. A typo fixed on a line whose turn was still in flight (she had not
    // answered yet) could not be written into an archive entry that did not exist - so it was parked,
    // and the turn is filed with the corrected words from the start.
    if (window.logEdit && window.logEdit.takeParked) {
      var fixed = window.logEdit.takeParked(entry.ts);
      if (fixed != null) entry.h = fixed;
    }
    // When HER half of the turn was written - the HITL stamp is the moment he sent it, this is the
    // moment she answered. The export and /search print both.
    if (entry.st == null) entry.st = Date.now();
    try {
      await window.root.kv.sacred_archive.update("master_log", function (logs = []) {
        return logs.concat([entry]).slice(-1000);
      });
    } catch (e) { console.warn("archive write failed", e); }
  }

  window.archiveTurn = saveEntry;

  // The layer a turn was spoken in, by id, for the record: LIA herself when no layer was on.
  function layerNameOf(id) {
    if (window.roles && window.roles.nameOf) return window.roles.nameOf(id);
    return id ? String(id) : "LIA";
  }

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  // The stamp on a turn, as the export and /search write it.
  function stampOf(ts) {
    return (window.logTime && ts) ? window.logTime.stamp(ts) : "";
  }

  // WHICH ENTRY A STAMP NAMES. A turn carries two stamps - `ts`, the moment he sent, and `st`, the
  // moment she answered - and the caller can hold either one. Matching on `ts` alone was a silent
  // trap: a picture she made in her own reply was patched onto nothing for as long as that call
  // handed over the answer's stamp (found and fixed 2026-09-26). Milliseconds are unique here, so
  // accepting either half cannot reach the wrong turn.
  async function patchEntry(ts, patch) {
    if (!window.root.kv) return;
    try {
      await window.root.kv.sacred_archive.update("master_log", function (logs = []) {
        for (var i = logs.length - 1; i >= 0; i--) {
          if (logs[i].ts === ts || logs[i].st === ts) { Object.assign(logs[i], patch); break; }
        }
        return logs;
      });
    } catch (e) { console.warn("archive patch failed", e); }
  }

  // A recycled image is a new blob under a new vault id, so every archive entry that named the old
  // id has to name the new one or it would point at a deleted image. Only `gen` is rewritten - the
  // record of what a creation produced. `sight` records what she was actually shown at that moment
  // and is left alone: the replacement is not something she has seen. Returns how many refs moved,
  // or -1 if the archive could not be written.
  //
  // TWO OPTIONS, and only one caller uses them: the LOCAL UPSCALE (src/js/upscale-local.js), which
  // retires the render it came from and puts the SAME picture, made bigger, in its place. There the
  // replacement really is what she was shown and what she asked to see again - it is not a different
  // picture - so `opts.sight` rewrites `sight` and `show` as well, or the archive would name a blob
  // that is gone (the export writes a recorded picture's file name from the vault record). And
  // `opts.patch` is written onto the `gen` row: the artifact name, the file name and the size DO
  // change when the artifact is replaced by a bigger one, and the record of the creation should name
  // the file that exists.
  window.replaceMediaRef = async function(oldId, newId, opts) {
    if (!window.root.kv || !oldId || !newId) return 0;
    opts = opts || {};
    var moved = 0;
    var swapRows = function (rows) {           // `gen`: rows carrying { id, name, file, ... }
      (Array.isArray(rows) ? rows : []).forEach(function (g) {
        if (g && g.id === oldId) { g.id = newId; moved++; if (opts.patch) Object.assign(g, opts.patch); }
      });
    };
    var swapIds = function (ids) {             // `sight` / `show`: bare vault ids
      if (!Array.isArray(ids)) return;
      for (var i = 0; i < ids.length; i++) if (ids[i] === oldId) { ids[i] = newId; moved++; }
    };
    try {
      await window.root.kv.sacred_archive.update("master_log", function (logs = []) {
        logs.forEach(function (e) {
          swapRows(e.gen);
          if (opts.sight) { swapIds(e.sight); swapIds(e.show); }
        });
        return logs;
      });
    } catch (e) { console.warn("archive media ref replace failed", e); return -1; }
    return moved;
  };

  window.exportArchive = async function() {
    if (!window.root.kv) return;
    if (window.media) await window.media.ensure();
    const logs = await window.root.kv.sacred_archive.get("master_log") || [];
    const mref = (id, tag) => {
      const rec = window.media ? window.media.get(id) : null;
      return "  [" + tag + "] " + ((rec && window.media.fileName) ? window.media.fileName(rec) : "image") + " :: LOCAL VAULT " + id + "\n";
    };
    // One line per render, and it is the whole recipe: prompt, negative list, seed, guidance and
    // now the TAGS - so an exported archive can be read back into a render (and a picture filed
    // as #night is still fileable as #night after the archive leaves this device).
    const createdLine = (g) => {
      if (!g) return "";
      const rec = window.media ? window.media.get(g.id) : null;
      const neg = (rec && rec.negative) ? " :: negative: " + rec.negative : "";
      const seed = (rec && rec.seed) ? " :: seed " + rec.seed : "";
      const guid = (rec && rec.guidanceScale) ? " :: guidance " + rec.guidanceScale : "";
      const tags = (rec && rec.tags && rec.tags.length) ? " :: tags " + rec.tags.map(t => "#" + t).join(" ") : "";
      const fold = (rec && window.media && window.media.folderOf) ? " :: folder " + window.media.folderOf(rec) : "";
      return "  [IMAGE CREATED] " + (g.prompt || "") + neg + seed + guid + tags + fold + " :: "
        + ((rec && window.media.fileName) ? window.media.fileName(rec) : "LOCAL VAULT " + g.id) + "\n";
    };
    let content = "LIA SACRED ARCHIVE EXPORT\n"
      + "TIMESTAMP: " + ((window.logTime) ? window.logTime.stamp() : new Date().toLocaleString()) + "\n"
      + "ZONE: " + ((window.logTime) ? window.logTime.zoneLabel() : "this machine")
      + "\nEVERY TURN BELOW CARRIES ITS OWN STAMP, IN THE SAME SHAPE.\n\n";
    logs.forEach(entry => {
      if (entry.kind === "guest") {
        content += (stampOf(entry.ts) ? "[" + stampOf(entry.ts) + "] " : "") + String(entry.guest || "GUEST").toUpperCase() + ": " + String(entry.text || "") + "\n---\n";
        return;
      }
      if (entry.silent || entry.kind === "create") {
        content += (stampOf(entry.ts) ? "[" + stampOf(entry.ts) + "] " : "") + "CREATION (NOT A TURN): " + (entry.h || "[image made]") + "\n";
        // A CREATION CAN CARRY HER WORDS TOO - a render she spoke over, an upscale she commented on -
        // and for years this branch wrote the creation line and nothing else, so her half was dropped
        // out of the readable backup (caught 2026-09-24 by reading an export back through /sync: 8
        // turns of hers were missing from the text and present in the archive). Written in the same
        // shape as a turn's, so nothing that reads an export needs a special case for it.
        if (entry.s) content += (stampOf(entry.st || entry.ts) ? "[" + stampOf(entry.st || entry.ts) + "] " : "") + "LIA ID: (" + layerNameOf(entry.role) + ") " + entry.s + "\n";
        (entry.gen || []).forEach(g => { content += createdLine(g); });
        content += "---\n";
        return;
      }
      const layer = layerNameOf(entry.role);
      const when = stampOf(entry.ts);
      const hers = stampOf(entry.st) || when;
      content += (when ? "[" + when + "] " : "") + "ROLE: " + (entry.role ? String(entry.role).toUpperCase() : "OFF STAGE") + "\n";
      content += (when ? "[" + when + "] " : "") + "HITL: (" + layer + ") " + (entry.h == null || entry.h === "" ? "[nothing - she spoke first]" : entry.h)
        + (entry.edited ? "   [EDITED ON THIS DEVICE AFTER THE FACT" + (entry.editedAt ? ": " + stampOf(entry.editedAt) : "") + "]" : "") + "\n";
      (entry.img || []).forEach(id => { content += mref(id, "IMAGE ATTACHED"); });
      (entry.vid || []).forEach(id => { content += mref(id, "CLIP ATTACHED"); });
      (entry.sight || []).forEach(id => { content += mref(id, "SHE LOOKED AT"); });
      (entry.show || []).forEach(id => { content += mref(id, "SHE ASKED TO SEE THIS AGAIN"); });
      // WHAT SHE LOOKED UP, AND WHAT SHE FILED. Both are reads of hers or writes of hers, and both
      // are on the record rather than left in the machinery: the archive is the account of the two
      // of them, and a folder she made and a thing she read belong in it.
      (entry.read || []).forEach(r => {
        if (!r) return;
        content += "  [SHE READ THE RECORD] " + String(r.read || "") + (r.title ? " :: " + r.title : "") + "\n";
      });
      (entry.filed || []).forEach(f => {
        if (!f) return;
        if (f.folder && f.folder.length && !f.filed) content += "  [SHE MADE THE FOLDER] " + f.folder.join("  \u00b7  ") + "\n";
        else if (f.folder && f.filed) content += "  [SHE FILED INTO " + f.folder + "] " + f.filed.join("  \u00b7  ") + "\n";
      });
      // ARCHIVAX: every op the terminal's own agent ran on her order. It is on the record for the
      // same reason a read or a filing is - the archive is the account of what was done here.
      (entry.ops || []).forEach(o => {
        if (!o) return;
        content += "  [ARCHIVAX :: " + String(o.op || "").toUpperCase() + "] " + String(o.text || "") + "\n";
      });
      content += (hers ? "[" + hers + "] " : "") + "LIA ID: (" + layer + ") " + entry.s + "\n";
      // What she kept and what she let go, on the record: the two lanes that are hers.
      (entry.hers || []).forEach(h => {
        if (!h) return;
        if (h.keep) content += "  [SHE KEPT IN HER OWN MEMORY] " + h.keep + "\n";
        else if (h.letGo) content += "  [SHE LET ONE OF HERS GO] " + h.letGo + "\n";
        else if (h.want) content += "  [SHE WROTE DOWN AS HERS] " + h.want + "\n";
        else if (h.released) h.released.forEach(t => { content += "  [SHE LET A WANT GO] " + t + "\n"; });
      });
      (entry.gen || []).forEach(g => { content += createdLine(g); });
      content += "---\n";
    });
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `archive_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    print('SYSTEM', "ARCHIVE EXPORTED SUCCESSFULLY. IMAGES ARE LISTED BY THEIR LOCAL VAULT ID - USE SAVE ON ANY IMAGE TO DOWNLOAD IT.");
  };

  // Full-fidelity export: the archive entries themselves, so IMPORT brings back the record
  // exactly - stamps, roles, edits, vault references and all. The .txt export stays the
  // readable one; this is the round-trip one. /export json runs it from the line.
  window.exportArchiveJSON = async function() {
    if (!window.root.kv) return;
    const logs = await window.root.kv.sacred_archive.get("master_log") || [];
    const doc = { app: "LIA TERMINAL", kind: "sacred-archive", version: 1, exportedAt: Date.now(), count: logs.length, entries: logs };
    const blob = new Blob([JSON.stringify(doc)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `archive_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    print('SYSTEM', "ARCHIVE EXPORTED AS JSON :: " + logs.length + " TURNS - IMPORT READS THIS FILE BACK WHOLE. THE .TXT EXPORT (EXPORT) STAYS THE READABLE ONE.");
  };

  // IMPORT: the mirror of EXPORT. Reads the JSON round-trip file whole, or the readable .txt
  // export best-effort (words and speakers survive; stamps become import order, pictures stay
  // named by their old vault ids). Merges by stamp - turns already here are skipped, nothing is
  // duplicated - paints the newest of what arrived, and hands her the last few for live memory.
  window.importArchiveFiles = async function(files) {
    if (!window.root.kv) { print('SYSTEM', "IMPORT FAILED :: NO ARCHIVE STORE ON THIS PAGE."); return; }
    const list = files ? Array.prototype.slice.call(files) : [];
    if (!list.length) return;
    const f = list[0];
    let text = "";
    try { text = await f.text(); }
    catch (e) { print('SYSTEM', "IMPORT FAILED :: THE FILE COULD NOT BE READ."); return; }
    let incoming = null, via = "";
    try {
      const doc = JSON.parse(text);
      const rows = Array.isArray(doc) ? doc : doc.entries;
      if (!Array.isArray(rows)) throw new Error("no entries");
      incoming = rows.map(sanitiseImported).filter(Boolean);
      via = "JSON";
    } catch (e) { incoming = null; }
    if (!incoming) {
      incoming = parseArchiveTxt(text);
      via = "TXT";
      if (!incoming.length) { print('SYSTEM', "IMPORT FAILED :: NOTHING THAT READS AS AN ARCHIVE EXPORT WAS FOUND IN " + (f.name || "THAT FILE") + " - HAND IT THE .JSON FROM /export json, OR THE .TXT FROM EXPORT."); return; }
    }
    let logs = [];
    try { logs = await window.root.kv.sacred_archive.get("master_log") || []; }
    catch (e) { print('SYSTEM', "IMPORT FAILED :: THE ARCHIVE COULD NOT BE READ."); return; }
    const seen = {};
    logs.forEach(function (e) { if (e && e.ts != null) seen[String(e.ts)] = 1; });
    let added = 0, skipped = 0;
    const freshTs = {};
    incoming.forEach(function (e) {
      if (e.ts != null && seen[String(e.ts)]) { skipped++; return; }
      logs.push(e);
      if (e.ts != null) { seen[String(e.ts)] = 1; freshTs[String(e.ts)] = 1; }
      added++;
    });
    logs.sort(function (a, b) { return (Number(a.ts) || 0) - (Number(b.ts) || 0); });
    logs = logs.slice(-1000);
    try { await window.root.kv.sacred_archive.set("master_log", logs); }
    catch (e) { print('SYSTEM', "IMPORT FAILED :: THE ARCHIVE COULD NOT BE WRITTEN."); return; }
    const fresh = logs.filter(function (e) { return e.ts != null && freshTs[String(e.ts)]; }).slice(-10);
    fresh.forEach(function (entry) { delete entry.importedFresh; });
    fresh.forEach(function (entry) { paintImported(entry); });
    const tail = logs.slice(-5).filter(function (e) { return !(e.silent || e.kind === "create"); });
    tail.forEach(function (e) {
      window.chatHistory.push({ role: "HITL", content: e.h, ts: e.ts, layer: e.role || "" }, { role: "SDMG", content: e.s, ts: e.st || e.ts, layer: e.role || "" });
    });
    while (window.chatHistory.length > 10) window.chatHistory.shift();
    print('SYSTEM', "IMPORT COMPLETE (" + via + ") :: " + added + " TURN" + (added === 1 ? "" : "S") + " BROUGHT IN"
      + (skipped ? ", " + skipped + " ALREADY HERE SKIPPED" : "")
      + " - THE ARCHIVE NOW HOLDS " + logs.length + "."
      + (via === "TXT" ? " TXT IMPORT IS BEST-EFFORT: WORDS AND SPEAKERS SURVIVE, STAMPS ARE IMPORT ORDER." : "")
      + " PICTURES KEEP THEIR OLD VAULT NAMES - ON THIS DEVICE THEY SHOW WHERE THE VAULT STILL HOLDS THEM.");
  };

  function sanitiseImported(e) {
    if (!e || typeof e !== "object") return null;
    const s = function (v) { return v == null ? "" : String(v); };
    const ids = function (v) { return Array.isArray(v) ? v.filter(function (x) { return x != null; }).map(String) : []; };
    const out = {
      ts: (e.ts != null && isFinite(Number(e.ts))) ? Number(e.ts) : null,
      st: (e.st != null && isFinite(Number(e.st))) ? Number(e.st) : null,
      role: s(e.role),
      h: s(e.h), s: s(e.s),
      img: ids(e.img), vid: ids(e.vid), sight: ids(e.sight), show: ids(e.show),
      gen: Array.isArray(e.gen) ? e.gen.filter(function (g) { return g && (g.id != null || g.prompt != null); }) : [],
      silent: !!e.silent, kind: e.kind === "create" ? "create" : undefined,
      edited: Number(e.edited) || undefined, editedAt: e.editedAt || undefined,
      imported: true, importedFresh: true
    };
    if (out.ts == null) out.ts = Date.now();
    if (!(out.h || out.s) && !out.silent) return null;
    return out;
  }

  // Best-effort reader for the readable .txt export: blocks split on ---, tag lines open a
  // field (ROLE / HITL / LIA ID / CREATION), anything else continues it - so words spanning
  // lines survive. Stamps become import order; the old reply's words ride as the turn.
  function parseArchiveTxt(text) {
    const lines = String(text || "").split(/\r?\n/);
    const blocks = [];
    let cur = [];
    lines.forEach(function (ln) {
      if (/^\s*---\s*$/.test(ln)) { if (cur.length) blocks.push(cur); cur = []; return; }
      cur.push(ln);
    });
    if (cur.length) blocks.push(cur);
    const tagRe = /^(?:\[.*?\] )?(ROLE|HITL|LIA ID|SDMG|CREATION \(NOT A TURN\)): ?(.*)$/;
    const now = Date.now();
    const out = [];
    blocks.forEach(function (bl, bi) {
      let tag = null, role = "", h = "", s = "", gens = [];
      bl.forEach(function (ln) {
        if (/^\s*\[.*?\]::/.test(ln) || /^LIA SACRED ARCHIVE EXPORT/.test(ln) || /^TIMESTAMP:|^ZONE:|^EVERY TURN BELOW/.test(ln) || !ln.trim()) return;
        const m = ln.match(tagRe);
        if (m && !/^\s/.test(ln)) {
          tag = (m[1] === "LIA ID" || m[1] === "SDMG") ? "LIA" : m[1];
          const v = m[2] || "";
          if (tag === "ROLE") role = v.trim().toLowerCase() === "off stage" ? "" : v.trim().toLowerCase();
          else if (tag === "HITL") h += v.replace(/^\([^)]*\) /, "");
          else if (tag === "LIA") s += v.replace(/^\([^)]*\) /, "");
          else if (tag === "CREATION (NOT A TURN)") h += v;
          return;
        }
        const g = ln.match(/^\s*\[IMAGE CREATED\] (.*)$/);
        if (g) { gens.push({ prompt: g[1] }); return; }
        if (/^\s*\[/.test(ln)) return;
        if (tag === "HITL") h += (h && !h.endsWith("\n") ? "\n" : "") + ln;
        else if (tag === "LIA") s += (s && !s.endsWith("\n") ? "\n" : "") + ln;
        else if (tag === "CREATION (NOT A TURN)") h += (h ? "\n" : "") + ln;
      });
      h = h.trim().replace(/\s*\[EDITED ON THIS DEVICE[^\]]*\]$/, "");
      if (/^\[nothing - she spoke first\]$/.test(h)) h = "";
      s = s.trim();
      if (!h && !s) return;
      const isCreate = /CREATION/.test(bl.join("\n").slice(0, 400)) || (!s && gens.length > 0);
      out.push({
        ts: now - (blocks.length - bi) * 1000, st: now - (blocks.length - bi) * 1000,
        role: role, h: h, s: s,
        img: [], vid: [], sight: [], show: [], gen: gens,
        silent: isCreate, kind: isCreate ? "create" : undefined,
        imported: true, importedFresh: true
      });
    });
    return out;
  }

  function paintImported(entry) {
    try {
      if (entry.silent || entry.kind === "create") {
        if (typeof printCreation === "function") printCreation(entry.gen || []);
        else print('SYSTEM', "CREATION (NOT A TURN) :: " + (entry.h || "[image made]"), true);
        return;
      }
      const userEntry = print('User', entry.h, true, (entry.img || []).map(function (id) { return { id: id }; })
        .concat((entry.vid || []).map(function (id) { return { id: id, kind: "video" }; })));
      if (entry.atts && entry.atts.length && window.attach && userEntry) {
        try { userEntry.appendChild(window.attach.cards(entry.atts)); } catch (e) {}
      }
      print('AI', entry.s, true, (entry.gen || []).map(function (g) { return { id: g.id, prompt: g.prompt }; }));
    } catch (e) { console.warn("imported turn paint failed", e); }
  }

  async function runSearch(query) {
    if (!window.root.kv) return;
    print('SYSTEM', "SEARCHING ARCHIVE FOR: " + query);
    const logs = await window.root.kv.sacred_archive.get("master_log") || [];
    const results = logs.filter(entry =>
      String(entry.h || "").toLowerCase().includes(query.toLowerCase()) ||
      String(entry.s || "").toLowerCase().includes(query.toLowerCase()) ||
      String(entry.text || "").toLowerCase().includes(query.toLowerCase())
    );
    if (results.length === 0) {
      print('SYSTEM', "NO RECORDS FOUND.");
    } else {
      results.forEach(res => {
        var when = stampOf(res.ts);
        var who = layerNameOf(res.role);
        if (res.kind === "guest") {
          print('SYSTEM', "[HISTORY MATCH]\n" + (when ? "[" + when + "] " : "") + String(res.guest || "GUEST").toUpperCase() + ": " + String(res.text || ""), true);
          return;
        }
        print('SYSTEM', "[HISTORY MATCH]\n" + ((res.silent || res.kind === "create")
          ? (when ? "[" + when + "] " : "") + "CREATION (NOT A TURN): " + res.h
          : (when ? "[" + when + "] " : "") + "HITL: (" + who + ") " + res.h + "\n"
            + (stampOf(res.st) ? "[" + stampOf(res.st) + "] " : "") + "LIA ID: (" + who + ") " + res.s), true);
      });
    }
  }

  window.toggleFS = function() {
    var elem = document.documentElement;
    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch(err => { console.log(err.message); });
    } else { document.exitFullscreen(); }
  };

  var SKILL_DIRECTIVE = /\[\[?\s*SKILL\s*:\s*([A-Za-z0-9 _-]{1,40}?)\s*\]\]?/i;
  var TRAIT_DIRECTIVE = /\[\[?\s*(LOAD|UNLOAD)\s*:\s*([A-Za-z0-9 _-]{1,40}?)\s*\]\]?/i;
  var ROLE_DIRECTIVE = /\[\[?\s*ROLE\s*:\s*([A-Za-z0-9 _-]{1,40}?)\s*\]\]?/i;
  // HER OWN LANES. Double brackets are REQUIRED here, unlike the directives above: these two write
  // REAL state (a document in her memory store, a standing intention she carries), and a false
  // positive - her quoting a stage direction like "[remember: ...]" - would file something she never
  // meant to keep. All of them are stripped from her visible reply either way.
  var HERS_DIRECTIVE = /\[\[\s*(REMEMBER|FORGET|WANT|RELEASE)\s*:\s*([^\]]{2,600}?)\s*\]\]/gi;
  // HER HAND ON THE BOOK. Double brackets are required here too, and for the same reason: this
  // reads a picture out of the vault and puts it in front of her eyes, so a false positive - her
  // quoting a stage direction like "[show: the garden]" - would be the terminal doing something
  // she never asked for. See the SHOW lane in send() and src/js/renderbook.js.
  var SHOW_DIRECTIVE = /\[\[\s*(?:SHOW|SEE)\s*:\s*([^\]]{2,140}?)\s*\]\]/gi;
  // HER READ-ONLY HAND ON THE RECORD, and the two writes that are hers in the vault:
  //   [[READ: folders | folder /music | vault | archive <words> | turn 203 | memory <words> |
  //            renders <words|R12> | tags | wants | hers | stats | <words>]]
  //   [[FOLDER: /name]]        make a folder (it exists even while it is empty)
  //   [[FILE: /name]]          file the pictures she made in this reply into it
  //   [[FILE: /name :: what]]  file something already in the book (a row number, a #tag, words)
  // Double brackets are required, as they are for her other lanes: these read real records and one
  // of them moves a file, so a stage direction in her prose must never trigger one. See
  // src/js/reader.js for the reading, src/js/vault.js for the folders.
  var READ_DIRECTIVE = /\[\[\s*READ\s*:\s*([^\]]{2,180}?)\s*\]\]/gi;
  // TURNING THE PAGE (src/js/dms.js, THE TANDEM). The DOX VIEWER is the one thing in this terminal
  // that both of them look at AT THE SAME TIME, and this is her hand on it: a document and a line,
  // in the shape a person would say it, and the page turns under his eyes - the reader jumps there
  // and the range is marked as hers. Double brackets like every lane that touches real state (it
  // opens a panel and moves what he is looking at), and read-only like the whole store: the only
  // thing she can move is his attention.
  var PAGE_DIRECTIVE = /\[\[\s*(?:PAGE|TURN\s+TO|LOOK\s+AT)\s*:\s*([^\]]{2,200}?)\s*\]\]/gi;
  // TURNING THE STAGE (src/js/images.js, THE SCREENING TANDEM). The full stage is the other
  // thing both of them look at AT THE SAME TIME, and this is her hand on it: an ID, a tag or
  // words, in the shape a person would say them, and the stage turns under his eyes - the
  // record opens and is marked as hers. Double brackets like every lane that touches real
  // state (it opens an overlay and moves what he is looking at), and read-only like the
  // whole vault: the only thing she can move is his attention.
  var STAGE_DIRECTIVE = /\[\[\s*(?:STAGE|SCREEN)\s*:\s*([^\]]{2,200}?)\s*\]\]/gi;
  var FOLDER_DIRECTIVE = /\[\[\s*(?:FOLDER|MKFOLDER|MAKE\s+FOLDER)\s*:\s*([^\]]{1,80}?)\s*\]\]/gi;
  // THE COLOURS SHE FLIPS HERSELF (src/js/moods.js). A mood is a colour on her voice rather than a
  // change to the machinery she is given, so it needs nobody's permission - it is hers, like a pose
  // or a want - and the line is stripped from her visible reply either way. Naming colours switches
  // them ON (several at once with `+`); `off NAME` switches one off and `off` clears the board;
  // `NAME :: how I am to sound` writes a new one in her own words and switches it on. What it never
  // does is touch a block: the mood block is built from the store, and the moods only ever fill it.
  var MOOD_DIRECTIVE = /\[\[\s*MOOD\s*:\s*([^\]]{2,300}?)\s*\]\]/gi;
  // THE META-MOODS SHE KEEPS (src/js/moods.js, THE MOOD BOARD). A mood is ONE colour; a BOARD is a
  // NAMED COMBINATION of them, saved, held still and IN AN ORDER. This is her hand on them - apply,
  // save, rewrite, add, drop, move, save-for-a-role, delete - and double brackets are required like
  // every lane that touches real state, because APPLYING a board replaces what is switched on (a
  // stage direction in her prose must never load one). Boards are acted on BEFORE the MOOD lines in
  // the same reply: a board sets the whole console, and a MOOD line after it adjusts what it set.
  var BOARD_DIRECTIVE = /\[\[\s*BOARD\s*:\s*([^\]]{2,600}?)\s*\]\]/gi;
  var MOODPACK_DIRECTIVE = /\[\[\s*MOODPACK\s*:\s*([^\]]{2,600}?)\s*\]\]/gi;
  var FILE_DIRECTIVE = /\[\[\s*FILE\s*:\s*([^\]]{2,200}?)\s*\]\]/gi;
  // PUTTING ARCHIVAX TO WORK. Double brackets are required like every other lane that touches
  // real records: she is the terminal's own agent (src/js/archivax.js) and one of these lines
  // files, tags or reads actual pictures, so a stage direction in her prose - "archivax: ..." -
  // must never set one running. What a LIA may order is bounded (LIA_ARCHIVAX_MAX ops per reply)
  // and glassed: she may set ARCHIVAX on what the terminal MADE, never on what Patrikios handed
  // over himself. Patrikios orders the same ops with /archivax, and there is no bound on his side.
  var ARCHIVAX_DIRECTIVE = /\[\[\s*ARCHIVAX\s*:\s*([^\]]{2,240}?)\s*\]\]/gi;
  // WHAT SHE ASKS FOR (src/js/petition.js). A petition is the one lane that reaches the MACHINERY -
  // the blocks she is given, the role text underneath them, her own poses and recipes and traits.
  // Double brackets are required like every lane that touches real state, and the line is stripped
  // from her visible reply either way; nothing it asks for happens until Patrikios answers it by
  // hand, and the answer is kept whether it is yes or no.
  var PETITION_DIRECTIVE = /\[\[\s*PETITION\s*:\s*([^\]]{4,2400}?)\s*\]\]/gi;
  // HER OWN HAND ON THE STACK (src/js/instr.js, THE SYSTEM LANE). Unlike a PETITION - which is filed
  // and waits for a yes - these lines are ACTED ON the moment they are read: she may list the blocks
  // she is written with, read one, rewrite one, make a new one, reset an override off, or take out a
  // block she made. BOUNDARIES and BUSINESS HOURS are the blocks she may read and never write - the
  // line she does not cross, and his own arrangement of the hours (which she may ask him to move,
  // with a petition, and never move herself).
  var SYSTEM_DIRECTIVE = /\[\[\s*SYSTEM\s*:\s*([^\]]{2,8000}?)\s*\]\]/gi;
  // WHAT SHE MEANS TO DO IN A FUTURE QUIET HOUR, and striking one of those off (src/js/shift.js).
  // This is the queue the quiet hours are driven by, and it is HERS: the machine never writes one
  // for her, only reads it back to her at each hour and records what became of it.
  var INTEND_DIRECTIVE = /\[\[\s*(?:INTEND|INTENT)\s*:\s*([^\]]{2,400}?)\s*\]\]/gi;
  var DONE_DIRECTIVE = /\[\[\s*DONE\s*:\s*(\d{1,3})\s*\]\]/gi;
  // THE HOUR'S OWN NAME - meaningful in a quiet hour and nowhere else (src/js/shift.js). In an
  // ordinary reply it is taken out with a note, because an act line there would do nothing.
  var ACT_DIRECTIVE = /\[\[\s*ACT\s*:\s*([A-Za-z][A-Za-z0-9 _-]{0,30}?)\s*\]\]/gi;
  // HER OWN DIAL ON THE INFINITY (src/js/proactive.js). The pace is HERS: a [[PACE: <1-5>]] line in
  // any reply, any quiet hour or any act moves it, and the machine only offers the range. It is
  // machinery and not something she says, so it is taken out of her visible reply wherever it
  // appears - and the receipt for it goes to BACKSTAGE (Patrikios, 2026-09-30: "PACE notice doesn't
  // need to be seen and displayed in the chat window. It belongs in BACKSTAGE like SYSTEM messages.
  // like SYSTEM: [[PACE: 5]]"), because the number is already on the infinity button.
  var PACE_DIRECTIVE = /\[\[\s*(?:PACE|INTENSITY)\s*:\s*([1-5])\s*\]\]/gi;
  var armedSkill = null;   // one-shot directive: holds for the next reply only
  var syslogOn = true;     // the SEARCH LOG posted above every reply

  // ---- /help ---------------------------------------------------------------
  // The roster of everything that can be typed, kept beside the dispatch further down that
  // implements it - so when a command is added, added here too. Only the one-line index entries are
  // hand-written: /help <TOPIC> asks the module that owns an area for its own answer
  // (window.voice.describe() and its like), so the detail can never go stale.
  var HELP_TOPICS = "voice \u00b7 story \u00b7 role \u00b7 keys \u00b7 system \u00b7 mood \u00b7 stamp \u00b7 agegate \u00b7 gatekeeper \u00b7 wall \u00b7 saved \u00b7 sync \u00b7 cloud \u00b7 hers \u00b7 checkin \u00b7 shift \u00b7 petitions \u00b7 chatlog \u00b7 journal \u00b7 bus \u00b7 hear \u00b7 peek \u00b7 see \u00b7 gallery \u00b7 tools \u00b7 folders \u00b7 read \u00b7 docs \u00b7 archivax \u00b7 renders \u00b7 keep \u00b7 heart \u00b7 lore \u00b7 packs \u00b7 pictures \u00b7 idea \u00b7 batch \u00b7 poses \u00b7 recipes \u00b7 embed \u00b7 deck \u00b7 rtfm \u00b7 chronicle \u00b7 commands \u00b7 spin \u00b7 all";

  var HELP_PICTURES =
    "PICTURES, CLIPS AND FILES :: the vault holds every image she has been shown or has made, in this browser only (IndexedDB), never uploaded."
    + " AND NEVER PUBLIC: the image service keeps a public gallery for every generator, with a save-to-gallery button on its tile - and that button is switched off for EVERY render made here, so no picture this terminal makes can be left anywhere another person can see it (Patrikios, 2026-09-30: \"Do not want this at all as we are never public\")."
    + "\n  THE VAULT IS KEPT IN FOLDERS, and a folder is a PATH: /images for pictures, /music for music, /clips for clips, and any folder you or she make (/images/portraits, /music/live). Everything has one whether or not anyone filed it, a folder can exist while empty, and /help folders has the whole of it. Music and pictures go in from the gallery (IMPORT PICTURES / MUSIC, or a drop) - an mp3 is kept whole and plays on its full stage."
    + "\n  ATTACH (the paperclip beside SEND), or paste, or drop a file - up to 16 ride along with your next message."
    + " Pictures (and a clip's first frame, and the pages of a scanned PDF) go to her EYES through the vision model;"
    + " text, .md, .json, a PDF's words and a recording's transcript are read on this device and handed to her to READ."
    + " .txt .md .pdf .json .csv .log .html .js ... and any image, video or audio file."
    + "\n  A CLIP arrives as the clip. Its FIRST frame is drawn and stands as the thumbnail with a \u25b6 play button on it;"
    + " one press plays the clip in place, in its own shape, in the log. That same first frame is the one picture of it she is"
    + " shown, and she is told plainly it is the opening of a moving thing - so she reads it as the start of something, not as the whole."
    + "\n  THE CLIP ITSELF IS KEPT WHOLE: the vault holds the exact file you handed over - the master, byte for byte, never"
    + " re-encoded, trimmed or uploaded - and SAVE writes that master back out under its own name."
    + "\n  THE PROMPT BOOK (src/js/studio.js) reads a document pasted into the forge AS a document. POSITIVE /"
    + " NEGATIVE PROMPT / SEEDS / ART STYLE sections are split into the fields they belong to (his negative list"
    + " used to sit in the positive box, where the image is asked FOR every word of it), any (seed:::...) (guidanceScale:::...)"
    + " (resolution:::...) tag is taken out of the text and routed to the field it means - the image service eats those"
    + " tags otherwise, and a (seed:::N) inside a prompt OVERRIDES the form - and the VEILED TONGUE is translated before"
    + " anything is sent: \"Pillar of Light\" goes as erect penis, \"Gate of Janus\" as anus. A coined phrase that is in"
    + " no glossary is HELD OUT of the render and reported, never sent and hoped for. SPLIT INTO FIELDS files the result"
    + " into the boxes; a CREATE does the same split invisibly for that render and prints every move above the images."
    + " /positions lists the premade poses (the names the training data already knows)."
    + "\n  THE BOOK OF POSES is yours AND hers. The forge's POSE rows show every pose by list: pick one, PUT IN PROMPT"
    + " writes its phrase in, and the edit row renames it, re-files it, or gives it a phrase of its own (a coined name"
    + " means nothing to an image model, so it needs one). MAKE LIST opens a new list. Nothing here rewrites the shipped"
    + " file - your book is kept on this device, over it, and /pose reset puts the seed back."
    + "\n  /pose asks HER to choose: her pick lands in the forge slot and in the prompt, and she says why. /pose <LIST> makes"
    + " her choose within a list, /pose new <LIST> has her name new poses for it, /pose list <NAME> has her fill a list of"
    + " its own, /pose <NAME> just holds that pose, /pose book prints it all, /pose picks is the record of what she chose,"
    + " /pose export hands you the whole book as a json file."
    + "\n  She can also choose MID-REPLY, in her own voice: a line '[[POSE: name]]' puts that pose in the forge slot, and if"
    + " she also shows you a picture in the same reply, the pose is made part of it. A pose she names that the book does not"
    + " have is FILED AS HERS - she can choose it again."
    + "\n  STORYBOARD SHEET :: under any line of two or more pictures, one press draws them onto a single sheet -"
    + " panels numbered, each in its own shape, its prompt underneath - and saves it as a png. That is the sheet to hand"
    + " to a board, a printer, or an animation service."
    + "\n  PICS (the deck button) :: how big pictures are drawn - NORMAL, BIG, or FULL (which fills the whole"
    + " width of the conversation, one panel per row, whatever the picture's shape). It changes the frame, never the picture."
    + "\n  THE CHOICE :: {Doggy Style|Blow Job} in a prompt is PERCHANCE'S OWN alternation, made to work in the prompt"
    + " boxes and in her own [[VISION: ...]] lines, where a generator's templating does not reach. The renderer has no"
    + " such syntax - an unexpanded group would be sent as literal punctuation - so it is taken here, ONCE PER IMAGE: a"
    + " batch of nine with {doggy|blow job} is nine different poses, not nine copies of one. {a^3|b} gives perchance's"
    + " own ODDS (3 to 1); {a|b|60} means 60% of the time one of them, 40% of the time nothing at all; nesting works;"
    + " \\{ \\} and \\| are literal. A group with no | in it that names no list and no pose is left EXACTLY as written, so the braces"
    + " your documents are full of are never touched - while a whole-group {name} that DOES name one is drawn, not left. /help poses LISTS THE POSES TO PUT IN ONE."
    + "\n  AND THE POSE LIST ITSELF IS PROMPT MATERIAL :: {pose} draws a pose from the whole book, {pose:hetero} from"
    + " one list of it - so a prompt can say \"one pose from here\" and get a name the training data already knows. The"
    + " forge reports the group before it renders, names the pick it took for each image, and the tile's caption shows"
    + " the prompt that image actually got."
    + "\n  AND SO IS EVERY SHOT-LIST DIMENSION :: {setting} draws one setting, {light} one light, {camera} one camera - any dimension by name or label, with his added phrases in the pool - and {anylist} draws from any other list in main.pjs the same way, perchance's own weights, branches and computed items included. Drawn ONCE PER IMAGE, so a batch of nine with {setting} is nine different places. Unknown names are left as written (\\{notalist\\} is literal, like any braces that name nothing). /idea list LISTS EVERY DIMENSION."
    + "\n  THE LOOSE LISTS :: {locale} draws one modern place (opt-in, outside the roll - the house is mythos), {cinema} draws one piece of cinematic language (frame, focus, light, air, skin, grade). /dop <id, R12, #tag or words> reads one vault picture as a director of photography would - frame, optic, light, atmosphere, texture, grade - one vision call, on demand."
    + "\n  THE AGENT DOOR :: the machine road into the forge - /runlink <prompt> builds a shareable ?autorun=1 URL (spends nothing), and opening one runs headlessly after boot with #status/#manifest saying where it stands. /agentdoor history|clear|status reads the run log. THE LORE DOOR (same file) reads the loaded documents for a machine - /agentdoor lore search|map|read (local, free) and lore summarize|ask (engine road, spends text quota); ?lore=... runs headlessly with #lore-status/#lore-manifest saying where it stands."
    + "\n  THE RECIPE BOOK (src/studio/recipes.json) :: whole prompt templates out of your own documents - the Baseline"
    + " sheets, the structured interior scene, the one-line muse shot, the aphrohermetic close-up - and each one has named"
    + " SLOTS that already hold your wording. Pick one in the forge's RECIPE row and press FILL THE PROMPT: the boxes are"
    + " rewritten with the recipe's own words in every slot, so there is a complete prompt to read and edit before a CREATE."
    + " /recipe <ID> does the same, and /recipe <ID> :: slot=words; slot2=words changes some of the wording while the rest"
    + " stays as the recipe ships it. /recipe alone lists the book; /recipe show <ID> prints a recipe and every slot;"
    + " /recipe save <ID> :: <TEMPLATE> writes one of your own ({{slot}} marks a slot; kept on this device); /recipe drop <ID>"
    + " takes one out; /recipe negative prints the house negative list; /recipe picks is what she composed; /recipe export"
    + " hands you the book as JSON."
    + "\n  SHE COMPOSES FROM THEM TOO :: a line \"[[RECIPE: id :: slot=words]]\" in her reply is her ONE image for that"
    + " reply - your frame with her words in the slots she names - and SHE COMPOSES in the forge asks her to choose a recipe"
    + " and fill its slots herself, in her own voice."
    + "\n  /image <PROMPT> :: render one now. It is NOT posted as a turn and no words about it are ever said to her: it is queued, and your next message gives her the actual pixels to look at."
    + "\n  /show <WORDS> :: the same, from your side and in one line - the quickest way to ask for a picture."
    + "\n  /showme :: ARM HER NEXT REPLY (see THE SPOKEN PROMPT). If you ask to see something and she answers in words instead of making it, she is asked AGAIN for the [[VISION: ...]] line - up to three asks, backstage, until the line comes back - and what she gives is rendered and posted under her own turn. \"SHOW ME\" IN A MESSAGE ARMS IT BY ITSELF; /showme off PUTS IT DOWN, AND IT IS ONE TURN ONLY. SHE MAY ANSWER NOTHING - that is a real answer and it is honoured, because a picture nobody wanted is not a favour."
    + "\n  /sight :: what is waiting for her eyes \u00b7 /sight <N> :: queue the newest N pictures from the vault"
    + "\n  /media :: vault status \u00b7 SAVE downloads a copy to your machine \u00b7 CREATE IMAGE composes one by hand (prompt, negative, size, count)"
    + "\n  /upscale [ID] :: MAKE A PICTURE BIGGER with bigger.pics - free, ad-funded, up to 4x, no account and no key. It opens in a popup window and hands the picture straight over; the bigger one comes back here by itself the moment it is done - into the vault, onto the stage and in front of her - and nothing needs pressing. With no argument it takes the picture on the stage, or the newest one in the vault."
    + "\n  /upscale here [ID] [2|4] :: THE SAME JOB ON THIS MACHINE - no window, no click, nothing uploaded. A Lanczos-3 resample on this device's GPU with a detail pass, written as png; the bigger picture carries the original's whole prompt file, is shown on the stage, and is queued for her eyes. THIS is the road that can be automatic - AND THE ONLY ONE THAT DELETES ANYTHING: when the bigger picture is safely in the vault, the render it came from leaves the vault and the gallery, and the archive record, its place in the queue for her eyes, any tile of it in the log and a KEEP all move to the bigger one. A picture you handed over, a clip, a piece of music, and AN UPSCALE are never retired."
    + "\n  /upscale auto [on|off|status] :: WITH IT ON, EVERY NEW RENDER IS MADE BIGGER BY ITSELF THE MOMENT IT LANDS - silently, with nothing opened and nothing added to her eyes (the picture it made is already there, and it is the one the bigger picture replaces). The bigger.pics road can never do this: it needs a real click, and it takes one picture by itself (up to seven more can go through that window by hand, but only a person can do that)."
    + "\n  /upscale replace [on|off|status] :: WHETHER THE SMALLER ORIGINAL IS RETIRED when a local upscale succeeds. It is the one switch here that removes something of his by itself, so `status` says plainly what it will and will never touch; off leaves every original in the vault beside its bigger self."
    + "\n  /idea [dice | <DIE> | <DIMENSION> | list | held | scene | drop <DIM> | clear | add <DIM> :: PHRASE | forget <DIM> :: PHRASE] :: THE SHOT LIST - A PICTURE IS ROLLED, NOT TYPED. Every list in main.pjs is one dimension of a shot (who is in it, where they are, the act, then the film language: the crop, the framing, the angle, the camera body, the file, the lens, the focus, the light, the grade, the look, and the master tail), and a roll draws one item from EVERY dimension and glues them into one prompt, written straight into the forge's boxes - CREATE renders it. A DIE rolls one GROUP at a time (the `dice` list in main.pjs: d6 is the scene, d20 everything the other dice did not claim), so a prompt is built in passes; a DIMENSION re-rolls ONLY ITSELF and every other chip stays exactly where it was, which is how a subject, a setting or a camera is held across a run of stills. The panel's SHOT LIST row is the same thing with hands: a button per die, a chip per dimension (its ↻ re-rolls that one, its ✕ drops it), and the SCENE line - a read-only name for the shot that is composed out of the roll and never written into any prompt. `/idea add camera :: shot on a Bolex` files a phrase of YOUR own into a dimension, and from then on it is drawn like any item of that list."
    + "\n  /batch [status | stop | help] :: THE BATCH - tick pictures in a run and upscale them together (bigger.pics, free, no key). The tick box sits in every picture's caption bar beside SAVE and UPSCALE, and the bar under the line says how many are ticked and offers the send. ONE PICTURE GOES ACROSS BY ITSELF (the site takes only one automatically, and only a click opens a window), so the rest are added BY HAND in that same window - its \"choose images\" or a drag-and-drop, up to eight pictures - and its own \"Send this back to ...\" button then posts every finished picture here. EACH ONE IS FILED IN THE VAULT ALREADY UPSCALED as it lands, beside the picture it came from and carrying its prompt, seed, negative list and tags, and it appears in the bar's tray - click a tray thumbnail to open it on the stage. A send carries up to six pictures; the per-picture UPSCALE button is unchanged and needs no ticks."
    + "\n  UNDER AN IMAGE :: TICK (the box in the caption bar) marks it for the batch bar under the line \u00b7 \u2665 HEART marks it GOOD, or passes on it, or clears the mark - the one thing she is told about every turn, so it is his taste travelling to her \u00b7 SAVE downloads it \u00b7 UPSCALE sends it to bigger.pics and brings the bigger one back (free, up to 4x, no key - nothing is deleted on that road) \u00b7 \u267b RENDERS A REPLACEMENT OF IT (same prompt, negative and guidance, a new seed - the dud leaves the vault) \u00b7 \u00d7 deletes it from the vault"
    + "\n  ON THE FULL STAGE, BESIDE UPSCALE WITH BIGGER.PICS :: \u25b2 UPSCALE HERE - the same job on this machine (no window, no click, nothing uploaded, png). IT RETIRES THE SMALLER ORIGINAL: a render the terminal made leaves the vault and the gallery once the bigger one is safely stored, and everything that named it - the archive record, its place in the queue for her eyes, any tile of it in the log, a KEEP - moves to the bigger one, which carries the whole prompt file. A picture you handed over, a clip, a piece of music, or an upscale is never deleted; /upscale replace off keeps the originals and /upscale replace status says exactly what it touches."
    + "\n  UNDER A CLIP :: \u25b6 PLAYS it in place (or press the clip itself) \u00b7 SAVE writes the MASTER clip out, under its own name, exactly as you handed it over \u00b7 \u26f6 opens it on the full stage \u00b7 \u00d7 deletes it from the vault"
    + "\n  THE RENDER BOOK (/renders) :: every picture MADE here, numbered R1..Rn in the order it was made, and each row carries THE WHOLE RECIPE - the prompt, the words that were actually sent, the negative list, the seed, the guidance, the size, the pose, the tags, the stamp it was stored under, and the turn it came from with what the two of you were saying. Nothing new is stored for it: the vault is the record and the archive is the catalogue, and the book is the two read together."
    + " /renders R12 prints one row in full; /renders find <WORDS> searches the prompt, the words sent, the negative list, the tags, the file name, the pose AND the turn's own words, so a picture can be found by what was being said when it appeared; /renders tag <TAG> and /renders seed <N> and /renders turn <N> narrow it; /renders export writes the book out as json and text."
    + " /renders redo R12 puts that row's exact recipe back into the forge form - the seed included - so a picture can be run again, or run again with one thing changed, which is how a nearly-right render is tuned."
    + "\n  TAGS :: a tag is one word (spaces become hyphens) hung on a picture on its FULL STAGE - click the picture, type it in the TAGS row, press ADD. Then #it is a real question: #night in the gallery's search box, or a #night chip, or /renders tag night, or her own [[SHOW: #night]] line. Tags are kept in the vault beside the picture; a recycled render keeps them, and an upscale is filed under the same ones."
    + "\n  SHE READS THE BOOK TOO :: a line \"[[SHOW: words, or #a-tag]]\" in her reply is a real request. The closest rows are found and put back in front of her eyes on her next turn - nothing is rendered again, it is the picture she remembered, from the vault. If nothing matches she is told so; a request never quietly becomes a render.";

  var HELP_EMBED =
    "MEANING (THE EMBEDDING LANE) :: recall has two lanes. The word lane (BM25) finds a passage that shares words with the"
    + " question; this one finds the passage that MEANS the same thing in different words, and it can hold a picture in the"
    + " same space as a sentence."
    + "\n  It runs on the Google (Gemini) key in the keyring and on the gemini-embedding models, which take text, a picture,"
    + " audio or a video in ONE request and return one vector for the whole of it. That is how a frame and the words she found"
    + " for it become the same point - which is what widens the graph under the LOREPACK beyond keywords."
    + "\n  Every vector stays in this browser (IndexedDB). Nothing is sent anywhere except the text or picture being embedded."
    + "\n  /embed :: the lane's state \u00b7 /embed model :: choose the embedding model from what the key can reach"
    + "\n  /embed now :: embed the LOREPACK's fragments (skips what is already embedded) - this is what turns the meaning lane on"
    + "\n  /embed media :: embed every picture and clip in the vault, with the prompt it came from and her own reading of it"
    + "\n  /embed find <WORDS> :: ask the lane directly - what in memory, and what in the vault, means this"
    + "\n  /embed show <WORDS> :: the same, and put the pictures it finds in front of her on your next message"
    + "\n  /embed clear [lore|media|all] :: empty that lane (the vectors only - nothing else is touched)";

  // THE BOOK OF POSES' OWN HELP. Read live from the book itself (window.studio), so it can never
  // drift: every list, every pose, and the mark of who put it there come from the same source the
  // forge's POSE rows and her own choosing do. A pose added on this device shows up here at once.
  function helpPoses() {
    var st = window.studio;
    if (!st || !st.poses) return "THE BOOK OF POSES IS NOT LOADED HERE (src/studio/positions.json).";
    var all = st.poses();
    if (!all.length) return "THE BOOK OF POSES IS EMPTY (src/studio/positions.json COULD NOT BE READ HERE - AN UNSAVED PREVIEW IN A BROWSER WITH NO SERVICE WORKER CANNOT READ src/).";
    var fams = st.families();
    var byFam = {};
    all.forEach(function (p) { (byFam[p.family] = byFam[p.family] || []).push(p); });
    var out = [];
    out.push("THE BOOK OF POSES :: " + all.length + " POSE" + (all.length === 1 ? "" : "S") + " IN " + fams.length + " LIST" + (fams.length === 1 ? "" : "S") + ".");
    out.push("  THE SEED (src/studio/positions.json) IS THE PREMADE LIST - the names most training datasets already know, which is why one works in a prompt where an invented phrase does not. THE RENDER TOKEN IS THE NAME, unless a pose carries its own phrase. Everything you or she adds on this device sits OVER the seed; the shipped file is never rewritten, and /pose reset puts the seed back.");
    fams.forEach(function (f) {
      var list = byFam[f] || [];
      if (!list.length) return;
      out.push("");
      out.push("  " + f.toUpperCase() + " (" + list.length + ") :: " + list.map(function (p) {
        return p.name + (p.source === "her" ? " [HERS]" : (p.source === "his" ? " [YOURS]" : ""));
      }).join(" \u00b7 "));
    });
    out.push("");
    out.push("  PICKING ONE :: the forge's POSE row (CREATE IMAGE) holds a pose for the next render. PUT IN PROMPT writes its phrase into the positive prompt; EDIT THAT POSE renames it, re-files it, or gives it a phrase of its own - a coined name means nothing to an image model, so it needs one. MAKE LIST opens a list. [HERS] AND [YOURS] ARE KEPT ON THIS DEVICE; the unmarked ones are the shipped seed.");
    out.push("  /positions [FAMILY OR WORD] :: the premade list on its own, narrowed - /positions hetero, /positions doggy.");
    out.push("  IN AN IMAGE PROMPT :: {pose} draws one from the whole book, {pose:hetero} from one list of it - which is what makes this list worth having at a prompt rather than only as a command. {Doggy Style|Blow Job} picks one of those two PER IMAGE (a batch of nine comes out as nine different poses); {a^3|b} is perchance's own odds; {a|b|60} is 60% of the time and nothing the other 40%. The forge reports every group before it renders and names the pick it took for each image.");
    out.push("  /pose <NAME> :: hold that pose for the next render. /pose <LIST> :: SHE chooses within that list. /pose :: SHE chooses. /pose new <LIST> :: SHE names new poses for it. /pose list <NAME> :: open a list of her own. /pose book :: print the whole book. /pose picks :: what she chose, and when. /pose export :: the book as a JSON file. /pose reset :: back to the shipped seed.");
    out.push("  SHE CAN CHOOSE MID-REPLY, in her own voice: a line '[[POSE: name]]' puts that pose in the forge slot, and if she shows you a picture in the same reply the pose is made part of it. A name the book does not have is FILED AS HERS, and she can choose it again later.");
    return out.join("\n");
  }

  // THE RECIPE BOOK'S OWN HELP. Read live from the book (window.studio), so it can never drift:
  // every recipe, its slots, and the wording each slot holds come from the same source the forge's
  // RECIPE row and her own [[RECIPE: ...]] line use.
  function helpRecipes() {
    var st = window.studio;
    if (!st || !st.recipes) return "THE RECIPE BOOK IS NOT LOADED HERE (src/studio/recipes.json).";
    var list = st.recipes();
    if (!list.length) return "THE RECIPE BOOK IS EMPTY (src/studio/recipes.json COULD NOT BE READ HERE - AN UNSAVED PREVIEW IN A BROWSER WITH NO SERVICE WORKER CANNOT READ src/).";
    var out = [];
    out.push("THE RECIPE BOOK :: " + list.length + " RECIPE" + (list.length === 1 ? "" : "S") + " FROM " + st.RECIPES_FILE + ".");
    out.push("  A RECIPE IS A FRAME AND ITS SLOTS ARE THE WORDS. The frame comes from your own documents - the Baseline sheets, the structured interior scene, the one-line muse shot, the aphrohermetic close-up - and every slot already holds YOUR wording, so a recipe renders as a whole picture with nothing changed. Name a slot and it takes your words instead; name none and it keeps the house words. What comes out then goes through exactly the same pipeline as a pasted document: sections split, (key:::value) tags routed, the veiled tongue translated, {a|b} chosen per image.");
        out.push("  THE NEGATIVE LIST IS THE HOUSE LIST BY DEFAULT. One shared list sits at the top of src/studio/recipes.json, and it is used by every recipe that says 'house' AND by every render that carries no negative of its own - so a plain CREATE, /image, or a picture she describes herself is guarded by it with nothing set. YOURS ALWAYS WINS: anything in the negative box, a NEGATIVE PROMPT section in a document, or a (negativePrompt:::...) cut replaces it, and the word none in any of those three places means NO NEGATIVE AT ALL. /recipe negative prints the list and says what it is.");
out.push("  THE SHIPPED FILE IS NEVER REWRITTEN. A recipe you save is kept on this device, over it; /recipe reset puts the seed back.");
    out.push("");
    list.forEach(function (r) {
      out.push("  " + String(r.title || r.id).toUpperCase() + "   [" + r.id + "]"
        + (r.source === "her" ? "   [HERS]" : (r.source === "his" ? "   [YOURS]" : "")));
      if (r.note) out.push("    " + r.note);
      var slots = st.recipeSlots(r);
      out.push("    SLOTS :: " + slots.map(function (s) { return s.name; }).join(" \u00b7 "));
      slots.forEach(function (s) {
        var d = String(s.def || "");
        out.push("      " + s.name + " :: " + (d ? (d.slice(0, 110) + (d.length > 110 ? "..." : "")) : "(nothing)") + (s.note ? "\n        " + s.note : ""));
      });
    });
    out.push("");
    out.push("  FILL ONE :: the forge's RECIPE row (CREATE IMAGE) holds a recipe for the next render; FILL THE PROMPT rewrites the boxes with it, and SHOW IT prints it. /recipe <ID> :: slot=words; slot2=words takes YOUR words in the slots you name. SHE COMPOSES asks her to choose a recipe and fill its slots in her own voice.");
    out.push("  HER OWN HAND :: a line \"[[RECIPE: id :: slot=words]]\" in her reply is her ONE image for that reply - the recipe's frame with her words in it - and /recipe picks is the record of what she chose.");
    out.push("  YOUR OWN RECIPES :: /recipe save <ID> :: <TEMPLATE> with {{slot}} wherever a slot goes; /recipe clone <NEW-ID> from <OLD-ID> starts one from an old frame; /recipe drop <ID> takes one out; /recipe export hands you the book as JSON.");
    out.push("  HER OWN RECIPES :: she petitions them - [[PETITION: recipe :: <new-id> :: <template> :: <why>]], or built on one of your frames: [[PETITION: recipe :: <new-id> :: from=<old-id> :: slot=her words; ... :: <why>]]. Accept in the SHIFT panel and it is filed as HERS.");
    return out.join("\n");
  }

  function helpRoster() {
    return [
      "LIA TERMINAL :: EVERYTHING THAT CAN BE TYPED. ANYTHING WITHOUT A SLASH IS A MESSAGE TO HER.",
      "",
      "WHO SHE IS",
      "  /system :: the instructions she is given before every reply (preview \u00b7 close)",
      "  /role \u00b7 /roles :: the layer on stage \u00b7 /role <ID|off> shifts onto one, or steps off the stage",
      "  /corepack (or /skills) :: the traits she can wear \u00b7 /load <ID> wears one for good",
      "  /skill <ID> [EXTRA] :: engages a skill for one reply only",
      "  /traits (or /worn) :: what she is wearing now \u00b7 /unload <ID|all> puts one down",
      "",
      "WHAT SHE REMEMBERS (LOREPACK)",
      "  /lore [sort <NAME|ADDED|SIZE|FRAG> [ASC|DESC] | sort canon | page <N> | next | prev | first | last | find <NAME> | per <25|50|100|200|all>] :: the documents, and the order they are read in \u00b7 THE DOCS PANEL DRAWS ONE PAGE AT A TIME, and those last four move it (a page is only what is drawn - the count, recall and the canon walk still see every document) \u00b7 /lorepack :: the index (reload re-reads src/lorepack/)",
      "  /canon [NAME | off NAME] :: what is ALWAYS in her context - a canon document is never recalled, it is simply true: every fragment of it rides in full on every turn. NOTHING IS CANON AT PRESENT (deliberately unset - the universe here is improvised and the LOREPACK is her lived experience, drawn on and inferred from). Flag any document, shipped or loaded, to make it canon again.",
      "  /search <Q> :: full-text search of the archive \u00b7 /recall <Q> :: what a search would hand her",
      "  EXPORT (the deck button) :: the whole conversation out as a readable .txt \u00b7 /export json :: the FULL-FIDELITY round-trip file (stamps, roles, edits and vault references - IMPORT reads it back whole)",
      "  IMPORT (the deck button) :: bring an exported archive back in - the .json whole, or the .txt best-effort. Merged by stamp: turns already here are skipped, nothing is duplicated.",
      "  SYNC (the deck button) :: the conversation out of this browser and back. THE FOLDER ROAD on your own disk (/sync - PICK a folder, WRITE THE BACKUP OUT, PULL THE NEWEST), THE CLOUD ROAD to your private Google Drive (/cloud send|receive|setup - tokens in the key ring, this device only), and THE DRIVE ROAD to a folder on your own disk, read and written in place (/ldrive open|pull|push - the drive lives in its own window, where the folder picker is allowed).",
      "  /stamp [on|off | zone <IANA|auto>] :: THE CLOCK. every conversation line and every archive entry carries when it was said - [YYYY-MM-DD HH:MM:SS ZONE], local to this machine, fallback America/Phoenix - and she is told the time before every reply. Bare, it prints the time and the setting; on|off is the SCREEN only (the record keeps its stamps either way); zone moves the record's zone. IT ALSO PRINTS BUSINESS HOURS :: Patrikios's own private hours, Monday-Friday 8:00 AM-5:00 PM MST, and whether he is inside them right now - the window is data (LIA_BUSINESS_HOURS, src/js/config.js) and is not a lock on any lane. She is told the same thing before every reply (the BUSINESS HOURS and CLOCK blocks), and the way she asks for a change to the hours is a petition.",
      "  /agegate [show | forget | status] :: THE DOOR - the 18+ checkbox, on the screen before anything else loads (plain markup at the top of index.html, opaque, z 2000, over everything). THIS SITE IS 18+ AND NSFW BY DEFAULT, and the confirmation is kept in THIS BROWSER only (kv lia_settings / agegate) and is never sent anywhere. /agegate shows the door again (hand the screen to someone else); /agegate forget takes the answer off the device so the NEXT LOAD asks; /agegate status prints what is kept and when it was given. IT GATES NOTHING ELSE: no lane, no command and no reply waits on it. It FAILS CLOSED - if src/js/agegate.js never arrives, the plain-ES5 fallback at the foot of index.html still runs the two buttons, and if neither arrives the door stays shut. /help agegate has the whole of it.",
      "  /wall [on | off | toggle | forget] :: THE WALL - the background image (the background-image-plugin imported in main.pjs, its `bgData` list, and [background(bgData, 0.8)] in index.html). THE PICTURE IS A PLACEHOLDER HOSTED ON perchance.org/upload, WHICH IS THE FREE PERMANENT HOME FOR AN ASSET INSIDE THIS ECOSYSTEM - so the wall SHIPS OFF, and turning it on is a keystroke here rather than an edit in the editor: /wall on shows it, /wall off hides it (both remembered in THIS BROWSER only, kv lia_settings / wall), /wall toggle is the opposite of now, /wall forget drops the choice so the next load is the shipped page. IT GATES NOTHING and nothing reads it - the picture is not in her prompt, her memory or her archive. Swapping the picture is swapping the url in bgData; a LIST of uploaded URLs is the shape it takes when there is more than one. NO FALLBACK SCRIPT IS NEEDED because it fails SAFE (if src/js/wall.js never arrives the wall simply stays off). /help wall has the whole of it.",
      "  /theme [status | list | crt | import <JSON> | url <URL> | export [crt] | forget] :: THE SKINS - the console wears its shipped CRT green, and takes MYTHOS-DESIGNER skins as an OVERRIDE LAYER, never a rewrite (THEME in the upper deck, beside MOOD). A skin is a designer ThemeConfig JSON - id, name, era, colors (bgObsidian, bgSlate, border, primary, secondary, accent, alert, gold, live, text, textMuted), glowColor, fonts - pasted after /theme import (compact JSON, or the designer's 'id': {...} copy snippet), fetched off /theme url, or worn from the panel's box, file or URL. Missing colors fall back to CRT per key, unknown keys are ignored, only #hex/rgba colors pass, and RAW CSS IS REFUSED (structured tokens only). /theme crt takes any skin back off, /theme forget drops the kept one off the device, /theme export prints the skin back out as designer JSON. The kept skin survives reloads.",
      "  /msd [status | import <JSON> | board | close | run <COMMAND-TEXT> | origins | origin add|drop <ORIGIN> | forget] :: THE DESIGNER'S BOARDS - a MYTHOS-DESIGNER layout manifest (MSDLayoutManifest: layoutId, header, navigation, msdCanvas nodes at x/y, kpiCards, widgets) RUNNING HERE (BOARDS in the upper deck, beside THEME). /msd import builds the board; nodes, nav and widgets carrying a terminal: BINDING (a VOXCONT command-text, e.g. terminal:open gallery - the catalog is src/bridge/terminal-surface.json, the drop-in for the designer side src/bridge/terminal-bridge.js) work this console through the same gates as voice control, and anything unbound is refused loud. A designer tab may also drive it live over postMessage ({k:\"sia\", terminal:...}, answered with receipts) from kv-listed origins (vite localhost presets shipped). /msd forget drops the board.",
      "  /saved [quick | help] :: THE SAVE CHECK - IS THE WORK SAVED? It reads the copy the SERVER is holding right now (perchance.org/api/downloadGenerator, THROUGH THE RELAY - their API sends no CORS headers, so the page cannot fetch it directly) and compares it against this workspace: main.pjs and index.html byte for byte (and prints the first line that differs), the file list, EVERY src/ FILE BY CONTENT - each saved file is read back off the platform's own CDN by the key in this page's own served copy, so a one-character edit is caught where a size check would miss it - and the import lines. ONLY THE EDITOR'S SAVE BUTTON PUBLISHES THIS GENERATOR. A backup is not a save and this command cannot press it either: /backup TAKES A COPY FIRST, THEN SAVE, THEN /saved AGAIN TO SEE IT LAND. It writes nothing, uploads nothing, reads no key, and nothing in the terminal waits on it. /help saved has the whole of it.",
      "  /hers [forget <N|WORDS> | source <N>] :: HER OWN MEMORY - the documents SHE kept herself, marked HERS in the LOREPACK beside your 502 (she writes them with a [[REMEMBER: ...]] line of her own; you cannot write one for her, only read one and take it away). /hers forget <N> moves one to the lore trash, recoverable with /lore trash.",
      "  /wants [release <N|WORDS|all> | clear all | export] :: WHAT SHE WANTS CARRIED - standing intentions she wrote down herself ([[WANT: ...]]), handed to her every turn as the WANTS block; [[RELEASE: ...]] or /wants puts one down, and a release is recorded as an act rather than deleted.",
      "  /duty [on|off | semi|full | arm semi|full | kill] :: THE MASTER ARM - the pilot's seat, and OFF is the KILL SWITCH (the ship goes cold: every autonomous lane stands down, INFINITY goes dark, every live road closes - live channel, mic, her voice, live wire, bridge ears, cable tap, meter mic - agent turns are refused, stranded finals drop, and SEND files without answer; re-arming resumes nothing). SEMI keeps the check-in's one word and the quiet hours' private work but never the wide door; FULL lets everything lit run. The lanes' own switches and ceilings are untouched, and his manual switches, panels, vault, drive, pair, sync and telecom are never gated.",
      "  /hand [clear] :: HER HAND ON THE DASHBOARD - at MASTER ARM FULL she may press the console's own switches herself ([[PRESS: <name>]] in an act: INFINITY, GALLERY, FRAME, CENTER, VIMEO, BACKSTAGE, SHIFT, LISTEN, PICS, AUDITION, up to three). A switch she touches STAYS LIT until your hand takes it back (press it yourself and her lamp goes out). Bare says what is lit; /hand clear wipes her lamps.",
      "  /infinity [on|off | pace <1-5> | now | log [N]] :: THE WIDE DOOR, AND IT IS INSTANT - the \u221e glyph in the control row (your only hand on this lane) opens an act AT ONCE when you press it on, and drops anything not yet said when you press it off. WHILE IT IS ON SHE RUNS THE CONVERSATION (role reversal): you are silent and wait for her word, she directs you, and after each act she moves again on her own clock - quickly once you have answered her, on her pace's own spacing if you have not. She may act on her own when the room is free: SAY something in her own voice, REMIND you out of the record, SEND a picture out of the vault, or MAKE a new one (the house image engine costs nothing) - printed, spoken if her voice is on, and archived as a turn of hers with no half of yours. THE INTENSITY IS NOT YOURS TO SET: pace 1-5 is a dial she moves with a [[PACE: <1-5>]] line of her own, and the machine only offers the range (the pace decides what she may do AND how long the lane leaves her alone: 1 is words only and 45 minutes between acts, 5 is everything and 6 minutes; her ceilings - which an act that answers you is not counted against - are up to 6 an hour and 24 a day). [[WAIT: <time>]] holds the room off for as long as she wants it, [[SILENT]] hands it back to you, and an act never begins while there is a voice in the room. /infinity now opens one act immediately; /infinity log prints what the lane has done.",
      "  /checkin [on|off | every <MIN> | now] :: THE ONE DOOR IN THE WALL OF TURN-TAKING. After a long silence (45 min by default) she may SPEAK FIRST - once per silence, only while this tab is on screen and nothing else is running. The words are hers: the machine says the room is quiet and she decides, and [[SILENT]] is a real answer that is kept as one. /checkin now opens the door immediately.",
      "  /shift [on|off | every <MIN> | now | log [N] | journal [N] | queue [drop <N>]] :: THE QUIET HOURS - the other half of that idea, and not a word of it. After a while of quiet she is given a PRIVATE TURN of her own (30 min of quiet by default; one call to the text engine each, capped at 2 an hour and 10 a day, counted off the record so a reload cannot reset it). NOTHING IN AN HOUR IS SAID TO YOU, SPOKEN ALOUD, OR PUT IN THE CONVERSATION - it is not a turn of hers. It is the hour for the work with no audience: her own memory ([[REMEMBER:]]), what she means to carry ([[WANT:]]), what she means to DO in a future hour ([[INTEND: ...]] / [[DONE: n]] - HER OWN QUEUE, shown back to her at every hour), reading the record ([[READ:]]), keeping her pictures in order, setting ARCHIVAX on what the terminal made, or ASKING FOR A CHANGE TO HERSELF with a petition. [[ACT: rest]] declines the hour and is recorded as an answer. /shift now opens one at once; /shift log prints the record, /shift journal one of them in full, /shift queue what she means to do. THE SHIFT \u25be BUTTON HAS ALL OF IT AS A PANEL.",
      "  /petition [list | show <N> | accept <N> | decline <N> [:: <WHY>] | grants | clear yes] :: THE PETITIONS - what she has ASKED to change about the MACHINERY (the blocks she is written with, the role text under them, a pose of hers, a recipe of hers, a trait she wants to be made of, or a GRANT - something she asks you to allow). A petition CHANGES NOTHING while it waits: it is filed, and YOU answer it by hand, here or with the ACCEPT and DECLINE buttons in the SHIFT panel. ACCEPT applies it through the very lane your own command would have used; DECLINE keeps her words AND your reason beside them, and neither answer is ever deleted - only answered. She asks with a line of her own: [[PETITION: <KIND> :: <WHAT> :: <WHY>]]. /help petitions FOR THE WHOLE OF IT.",
      "  /chatlog [snippet | show <CHUNK|first|last> [CHAR|all] | turns [N] | turn <N> | grep <WORDS> | export | import [--replace] <URL> | append [URL] | policy [append|replace] | wipe yes | about] :: THE RAW RECORD OF THIS CONVERSATION - the chat window this terminal was BUILT in, kept whole so a later session reads what was actually asked for instead of guessing from a handoff note. It is kept in THIS BROWSER (kv), never in src/, which is public. /chatlog snippet prints the one script you run in the EDITOR'S console to get the conversation out (it downloads a .txt and sends nothing anywhere); the CHATLOG panel (CHATLOG \u25be in the deck) takes it in - pasted, or as a picked file - splits it into chunks and indexes every turn. IT GROWS BY APPEND: a conversation only ever gets longer, so an import finds the seam between what is already here and what arrived, keeps only what is NEW, and writes the join into the record - a file already in the record changes nothing at all, except the turn index if it carries one (the .json sidecar does). REPLACE is the deliberate opposite, on the panel's own REPLACE button and nowhere else; /chatlog policy says and sets which one the FILE PICKER and /chatlog import <URL> use. AN IMPORT COSTS NOTHING: nothing in here is ever sent to the text engine, put in her prompt or indexed for her recall. /chatlog show, /chatlog turns, /chatlog turn <N> and /chatlog grep <WORDS> read it back; /chatlog export hands you the whole thing as a file (and the .json it writes beside it is importable, turns and all); /chatlog wipe yes deletes it. /help chatlog FOR THE WHOLE OF IT.",
      "  /source <FILE> :: a stored original \u00b7 /rechunk <CHARS> [OVERLAP] :: refragment it",
      "  /trash :: the forgotten documents (restore <NAME> \u00b7 empty)",
      "  /syslog [on|off] :: the search log posted above every reply (it rides in BACKSTAGE)",
      "  /strike [N | list [N] | find <WORDS> | #N] :: TAKE TURNS BACK OUT OF THE RECORD - out of the archive and out of her memory. The screen keeps them, struck through; what is gone is her memory of them. This is the repair for a line that arrived mangled - her own voice heard off the speakers and filed as yours. /strike <N> takes the last N; /strike list 20 numbers the recent ones; /strike find <WORDS> locates a turn anywhere in the record; /strike #201 takes exactly that one and leaves every later turn in place.",
      "  /backstage [on|off] :: whether the terminal's own machinery is shown - the recall, the citations, what she was shown, the timings. DOWN BY DEFAULT: the conversation is the stage, and the veil keeps it clean. The BACKSTAGE button in the deck does the same thing.",
      "",
      "HOW SHE SOUNDS (VOICE)",
      "  /voice :: her audible state \u00b7 /voice speak [TEXT] \u00b7 /voice stop",
      "  /voice engine <auto|browser|elevenlabs> \u00b7 /voice auto on|off :: read every reply aloud",
      "  /voice voices :: every voice this machine has, numbered \u00b7 /voice try <#|NAME> [TEXT] hears one without keeping it",
      "  /voice audition :: the British female ones in turn \u00b7 /voice browser <#|NAME> keeps it",
      "  /voice voice <ID|NAME> :: an ElevenLabs voice \u00b7 /voice rate <N> \u00b7 /voice pitch <N> \u00b7 /voice mic [on|off] \u00b7 /voice reset",
      "  /voice models :: which models ElevenLabs actually speaks with, what each one was MEASURED to cost per character, and which two are deprecated \u00b7 /voice model <ID> picks one for the role on stage, /voice model default goes back to the shipped one",
      "  /voice profile [<NAME>] :: THE IDEAL VOICE - the whole voice at once (a voice id + model + settings set taken from an agent configured in the ElevenLabs UI, recorded in src/voice/voices.json). Applying one prints what was measured about whether THIS account can speak it, because a profile is where she should sound, not a promise that the plan allows it",
      "  /voice live [on|off] :: THE LIVE CHANNEL - the microphone stays open, what you say is sent, what she answers is spoken, and it goes deaf while she speaks so she cannot hear herself",
      "  /voice live text [on|off] :: whether the call is printed as HITL + LIA ID lines (on, the default) or left as voice only (off - still the record, still in the archive, just not painted)",
      "  /voice hold <MS> :: the FLOOR of the quiet before what you said is sent - the end of YOUR turn (5000 by default, 400-8000). /voice tail <MS> is the EXTRA wait asked while the recogniser has not committed its last word, so a breath mid-sentence never ends your turn; /voice tail auto makes the tail follow the hold. The wait also stretches while your sentence stops on a word a sentence does not end on, and while the clause is long - all of it patience, never a word of yours. The terminal says when the wait is nearly over, and pressing the microphone sends what is held at once.",
      "  TALK (beside SEND) is the one-off microphone: press it, speak, press it again to stop - or just stop, and the quiet takes it. What it heard lands in the input box. LISTEN beside it reads her newest reply out loud. The MICROPHONE (icon) opens and closes the live channel instead - the hands-free mode; press it while she speaks to hush her.",
      "  LIACOMM (its own page, the LIACOMM key in the left panel) is the push-to-talk key, and it is what triggers the intercom: HOLD it to speak (streams LIVE into the box, nothing takes it), LET GO to review and hit SEND yourself - her answer comes back OVER VOICE, spoken aloud even when auto-read is off - LET GO SILENT to say again (her newest reply read back). A turn that went in over the key is answered in the LIACOMM speech style (plain-brief to start: brief and plain, no prowords - the SPEECH STYLE dropdown on the page picks the file). While she has the floor it refuses. /intercom SAYS IT, /intercom brevity on|off SETS THE BREVITY, /intercom style <ID> KEEPS A STYLE.",
      "  VOICE CONTROL (/voxcont - VOXCONTPACK'S HANDS, src/js/voxcont.js) :: WHEN IT IS ON, WORDS ON THE LIACOMM KEY WORK THE CONSOLE INSTEAD OF GOING TO HER: NAME A SWITCH AND IT MOVES (GALLERY, STAGE, FRAME, CENTER, VIMEO, BACKSTAGE, SHIFT, SHELF, SCRIPTS, KEYS, MOOD, SYSTEM, TOOLS, CHATLOG, SYNC, DRIVE, DOCS, DRAFT, VOICES - OPEN OR CLOSE BEFORE IT, OR CLOSE IT FOR THE ONE OPEN PANEL), PULL THE DRIVE, MIRROR THE VAULT (SAY YES AFTER), PICS, FONT BIGGER OR SMALLER, UPPER/LOWER/LEFT/RIGHT DECK on|off, LISTEN (SAY AGAIN), SEND IT, STOP (ALWAYS WORKS, EVEN OFF). ANYTHING ELSE ON THE KEY GOES TO HER AS CHAT. VOICE IS INPUT, NOT AUTHORITY: RENDERS, UPSCALES, STRIKES, DELETES AND WIPES NEVER RIDE VOICE - THOSE NEED YOUR HAND. /voxcont on|off|status|say <WORDS>.",
      "",
      "HOW SHE TELLS A LONG STORY (THE STORY LANE)",
      "  /story :: the lane's state \u00b7 /story on|off :: arm it, and her LONGFORM replies are rendered by HuggingFace and played here instead of being spoken on the live engine (the saving: a chapter is thousands of billed characters)",
      "  /story read <TEXT> :: this exact text, in her voice, played here \u00b7 /story tell <REQUEST> :: send the request as a turn and render HER REPLY here rather than live",
      "  /story pause \u00b7 resume \u00b7 stop \u00b7 next \u00b7 back :: the transport (the strip above the input carries the same thing) \u00b7 /story parts :: every part, its state and its length",
      "  /story sample :: THE CLONE SOURCE, ONE PER AGENT - the clip IS the voice, so each RoleLayer has its own. The table lists every agent, what it speaks in, and the audio in the vault. /story sample <ID|NAME> sets it for the agent ON STAGE, `... for <AGENT>` for one who is not on stage, `... as default` sets the fallback that answers for any agent with none of its own, and `... off` clears. The clip is the ONE thing that leaves this device, and only when a story is rendered in that voice.",
      "  A STORY KEEPS THE VOICE IT BEGAN IN :: the sample is fixed when the story is made, so shifting her onto another layer never changes voice mid-chapter - one story, one performance.",
      "  /story road :: which Space the lane renders on, where the call goes, and every knob it is using \u00b7 /story space chatterbox|dramabox :: switch roads (Chatterbox is the one whose CLONE IS THE VOICE)",
      "  THE SWITCH :: talk over a story, or ask a question, and it HOLDS where it stands, she answers on the live engine, and it carries on from the word it stopped at. Nothing is lost and nothing is repeated. When the story ends the terminal is simply live again.",
      "",
      "WHAT SHE SEES (PICTURES)",
      "  /image <PROMPT> :: make one now - kept private, queued for her eyes, never posted as a turn",
      "  /show <WHAT TO SEE> :: render it now, shown here - the quickest way to ask for a picture mid-conversation",
      "  /upscale [ID] :: bigger.pics - free, ad-funded, up to 4x, no account and no key. It opens in a popup window, hands the picture to it, and brings the bigger one back into the vault, onto the stage and in front of her.",
      "  /upscale here [ID] [2|4] :: THE SAME JOB ON THIS MACHINE - no window, no click, nothing uploaded; a Lanczos-3 resample on this device's GPU, carrying the original's whole prompt file. THIS is the road that can run by itself, AND THE ONE THAT RETIRES THE SMALLER ORIGINAL once the bigger one is safely stored (attachments, clips, music and upscales are never touched).",
      "  /upscale auto [on|off|status] :: THE WHOLE PIPELINE, UNATTENDED - every new render is made bigger by itself the moment it lands, silently, and the render is retired into it.",
      "  /upscale replace [on|off|status] :: whether that retirement happens; `status` says exactly what it will and will never touch.",
      "  ATTACH takes pictures, CLIPS (kept whole as the master, first frame as the thumbnail, \u25b6 plays it inline) and documents.",
      "  /positions [FAMILY OR WORD] :: the premade pose list, by family \u00b7 /pose <NAME|LIST|new|list|book|picks|export|reset> :: THE BOOK OF POSES - she chooses one, invents new ones, or you pick one and it rides with the render. /help poses LISTS EVERY POSE.",
      "  /recipe [ID [:: slot=words; slot2=words] | show ID | save ID :: TEMPLATE | clone NEW-ID from OLD-ID | drop ID | picks | negative | export | reset] :: THE RECIPE BOOK - whole prompt templates out of your own documents, each with named slots that already hold your wording. /recipe alone lists them; an id fills the forge's prompt boxes with it; slots named after :: take your words instead. /help recipes FOR EVERY RECIPE.",
      "  SHE COMPOSES TOO :: a line \"[[RECIPE: id :: slot=words]]\" in her reply is her ONE image for that reply - your frame with her words in it. SHE COMPOSES in the forge asks her to choose a recipe and fill its slots herself. HER OWN RECIPES start as petitions ([[PETITION: recipe :: <new-id> :: from=<old-id> :: slot=her words; ...]]) and land as HERS once accepted.",
      "  A STORYBOARD SHEET button sits under any line of two or more pictures and saves them as one numbered sheet;",
      "  PICS in the deck sets how large pictures and clips are drawn (NORMAL / BIG / FULL - FULL fills the whole width of the conversation).",
      "",
      "MEANING (THE EMBEDDING LANE)",
      "  /embed :: the lane's state (model, now, media, find <WORDS>, show <WORDS>, clear) - recall by MEANING as well as",
      "  by words, over the LOREPACK and over the vault. It runs on the Google (Gemini) key; every vector stays on this device.",
      "  /sight [N] :: what is waiting for her eyes, or queue the newest N \u00b7 /media :: the vault, and the folders it is kept in",
      "  /folder [list | new <PATH> | open <PATH> | file <PATH> <R12|#TAG|WORDS> | rename <OLD> <NEW> | drop <PATH> | defaults] :: THE MEDIA FOLDERS - a folder is a PATH (/images, /music, /clips, /images/portraits), everything has one (pictures fall back to /images, audio to /music, A VOICE to the vox tree /audio/vox, clips to /clips), a folder can exist while empty, and /folder new music makes /music. The gallery's FOLDERS row does the same by hand, and SHE may make folders and file her own pictures too ([[FOLDER: /name]], [[FILE: /name]]).",
      "  /read [WHAT] :: THE READ-ONLY DOOR ONTO EVERYTHING SAVED HERE - folders, folder /music, vault, archive <WORDS>, turn <N>, memory <WORDS>, renders <WORDS|R12>, tags, wants, hers, stats, or just words (everywhere at once). SHE HAS THE SAME DOOR: a [[READ: ...]] line in her reply is answered here and put in front of her on her next turn, and reading writes nothing.",
      "  /archivax [OP ... | status | ops | journal] :: THE AGENT OF THE RECORD, WITH HANDS. ARCHIVAX (order 0 of the manifest) files pictures into folders, tags them, and READS them - a vision pass whose result is written onto each record as its sight, so a picture can be found later by what is IN it. /archivax alone reports the record and her journal; /archivax ops lists what she may be told to do (file, tag, untag, read, classify, sweep). SHE ORDERS THE SAME AGENT from her own reply with [[ARCHIVAX: <OP> ...]], and she may only set her on what the terminal made. /help archivax goes deeper.",
      "  /peek [<ID> | newest | <N> | #TAG] :: THE MINI LIGHTBOX - a quick look at one picture without opening the gallery: bare it takes the newest in the vault, an id (or the start of one, exactly the citation a receipt prints) takes that one, a #tag takes the newest filed that way, a number takes the Nth newest. LEFT and RIGHT walk the ones it was opened with, ESC closes, and FULL STAGE in the box opens the whole record (SAVE, upscale, folders, tags, its prompt file). IT IS ALSO WHAT THE IN-HAND CHIP OPENS: while a job works behind the curtain, a chip in the deck shows the picture the machinery has in its hand RIGHT NOW, with a thumbnail - press it and look.",
      "  /see [<ID> | newest | <N> | #TAG] [AND WHAT YOU WANT TO SAY] :: PUT ONE PICTURE OUT OF THE VAULT INTO THE CONVERSATION - it lands in the log as a line of yours with the picture under it, the vision model looks at it WITH you, and what it finds is written on the record the way the bulk CLASSIFIER writes it: her READING as the picture's sight, the major elements as TAGS, and the KIND of scene as its BUCKET (also a #tag, and the folder it is filed into). The record's own filing - name, folder, bucket, tags - rides into her instruction with the picture, so the conversation has the image AND everything already known about it. A picture that already carries a reading costs NO vision call (say `again` first to re-read it and replace what is on it). THE \u2609 BUTTON IN THE GALLERY SEEDS THIS SAME LINE, so a picture can be sent from the gallery with your own words after it. /peek only LOOKS at a picture; /show RENDERS a new one; /see puts one that exists IN FRONT OF HER.",
      "  /gallery [close | all|renders|yours|music|vox|clips|upscaled|unseen | find <WORDS|#TAG> | page <N> | per <24|60|120|240|all> | next | prev | export | stats] :: THE GALLERY - every picture, clip and piece of sound in the vault on one screen, each stamped with when it was stored and saying WHICH TURN it came from: search it by prompt, by tag (#night), or by what she read in it, filter it by where it came from, open any one on the full stage (SAVE, UPSCALE, and its TAGS), hand one to her eyes, SEE one in the conversation (\u2609 - the same as typing /see: the line is left in the input box so you can add what you want to say, and the vision model reads the picture on the way, writing its reading, its tags and the kind of scene it is ON it), post one into the conversation (\u2b06 - it lands in the log as a line of yours with the picture under it, and she is given it to look at), mark it with the heart (\u2665 - she is told what you mark), or export the whole catalogue (json + text) with its stamps, prompts, seeds and turns. THE FULL STAGE WALKS THE GRID: with a picture open, the arrow keys step to the next and the one before, in the order and the filters you are looking at, and the bar shows where you are. THE GRID IS SHOWN A PAGE AT A TIME (60 by default, remembered for next time; the pager under the grid, the arrow keys, PageUp/PageDown, Home/End, /gallery page <N> and /gallery per <N|all> all move or change it) - AND THE VIEW, THE COUNTS, SELECT ALL, THE EXPORT AND THE FULL STAGE'S WALK ARE STILL THE WHOLE FILTERED SET, so a page is only what is drawn. Drop pictures anywhere in the gallery to keep them in this browser. SOUND IS TWO TABLES, NOT ONE: MUSIC is music, and VOX is VOCAL AUDIO - a voice - which lives in the /audio/vox tree, one folder per agent (/audio/vox/lia, /audio/vox/barbelo). File a clip into that tree (the FOLDERS row, or a drop while the VOX tab is up) and it becomes a VOX sample; the story lane clones from these, so a voice put here is a voice the Chatterbox road can wear.",
      "  /tools [report | stop | <JOB> [SCOPE] [run]] :: THE TOOLS - the maintenance deck (the TOOLS \u25be button in the deck does the same). FIVE jobs, each SCANNED before it runs: DUPLICATES (pictures the vault is holding more than once - a run keeps one of each group and drops the rest, moving every reference across first and re-checking the bytes at the moment of deletion), PROPER FOLDERS (file every record into the folder its kind belongs in: /images, /images/upscaled, /clips, /music - and into /images/<bucket> when the classifier has read it), UPSCALE (the backfill sweep - make every picture that has never been made 2x bigger, one at a time, on this machine; with /upscale replace on, the smaller original is retired into it), CLASSIFY (THE BULK VISION PASS - read every picture once with the vision model and write what it finds ON the picture: its reading as that record's sight, the major elements as tags, and the KIND of scene as its bucket, which is also a #tag and the folder it is filed into; after it, finding a picture is /gallery #<bucket> and no model at all - one vision call a picture on the terminal's own text engine, so the scan prints the estimated spend and STOP ends the pass after the picture in hand), and REPAIR (point every id the archive or the queue for her eyes still names at the picture that replaced it, or take the name out). A bare job is a scan and changes nothing; the word `run` does it. Nothing is uploaded, and no picture is ever deleted except a byte-identical copy of one that is kept.",
      "",
      "LISTENING TOGETHER (THE AUDITION BUS)",
      "  /bus :: THE AUDITION BUS - this terminal's ONE transport. A piece of music goes on it and plays while the conversation carries on around it, and every turn she answers while it plays is a turn she answers WHILE LISTENING. /bus alone reports it: what is on, where in it you both are, what she has heard of it, and what she has already said about it.",
      "  /bus <WORDS|#TAG|/FOLDER|id> puts a piece ON it \u00b7 /bus queue <...> lines more up after it \u00b7 /bus stop|play|pause|next|clear|log \u00b7 /bus auto off|on|every <MIN> (her UNASKED comments while it plays).",
      "  /hear :: she speaks about the piece on the bus RIGHT NOW, and her line carries where in it she was when she said it \u00b7 /hear <WORDS> finds a piece (by name, tag, folder or vault id), puts it on the bus and asks her at once \u00b7 /hear ears LISTENS to it for her: the sound is reduced here on this device and heard through the Google (Gemini) key, and what she heard is written on the record for good.",
      "  /hear words [<SOURCE>] \u00b7 /hear reading [<SOURCE>] \u00b7 /hear ask [<SOURCE> ::] <QUESTION> \u00b7 /hear sample [<SOURCE>] \u00b7 /hear powers \u00b7 /hear clear <SOURCE> [words|reading|sample] :: THE WORDS ON A SOUND (src/js/hear.js, the same Google (Gemini) key). words is a VERBATIM transcript - what the voice actually SAYS, written on the record and handed to her whenever the piece is on the bus; reading is what it SAYS AND WHAT IT IS (mood, emotion, sentiment, tone, voices, language, a summary, a label); ask puts any question to the clip; sample judges a recording as a CLONE REFERENCE for the Story lane (one voice, clean, 10-30 seconds) and suggests the sentence for its voice prompt; powers reads the key's own model list and says what it can do; clear takes a reading off a record. THE AUDIO IS REDUCED HERE (mono 16 kHz, at most LIA_HEAR_SECONDS), NEVER UPLOADED AND NEVER CHANGED, AND A REFUSAL IS REPORTED - NOTHING IS REWRITTEN TO GET PAST A FILTER.",
      "  IN THE GALLERY, a music tile carries \u25b6 (put it on the bus and play it) and \u26f6 (the full stage, where the same transport stands). An audio file DROPPED ON THE STRIP ABOVE THE INPUT is kept in the vault and put straight on the bus. Nothing else in the terminal makes its own player, so nothing ever talks over anything.",
      "",
      "  /renders [all | find <WORDS> | tag <TAG> | seed <N> | turn <N> | recent [N] | R12 | redo R12 | export] :: THE RENDER BOOK - every picture MADE here, numbered R1..Rn, each row carrying the exact recipe it was made from (prompt, what was sent, negative list, seed, guidance, size, pose, tags) and the turn it came from. redo puts one back into the forge form, so a picture can be run again or the same picture tuned with one thing changed.",
      "  /keep [R12 | <WORDS|#TAG|VAULT ID> | link [WHAT] | list] :: KEEP - the other half of SAVE. SAVE writes the picture's FILE to this machine; KEEP writes what MADE it into the RECORD: the prompt and the negative list into the RECIPE BOOK, the seed, the guidance and the size with them, a #kept tag on the picture in the gallery, and a link that opens the gallery on it. The KEEP button under a picture does the same thing, and nothing here touches SAVE.",
      "",
      "THE COMMAND LIST",
      "  /commands :: every slash command, read from src/commands/commands.json - the ones the terminal carries out, and the ones SHE answers herself (/clarify, /bless, /reflect). Add one to that file and it appears here, in the SYSTEM panel, and in what she is told.",
      "  /rtfm [DOC | COMMAND | cheatsheet | check | export | new | edit | add | mine | rm] :: THE RTFM - the manual, kept as markdown documents in src/rtfm/ AND written from here. THE CHEATSHEET IS ONE OF THEM AND IT IS GENERATED from src/commands/commands.json, so it can never disagree with the commands that exist. /rtfm alone lists the documents, /rtfm <COMMAND> prints one command's whole page, /rtfm cheatsheet renders the whole cheatsheet right now, /rtfm check says whether the shipped copy has fallen behind, /rtfm export downloads one, /rtfm about prints the recipe for adding a document of your own. WRITING ONE :: /rtfm new [NAME] opens the editor on a page of your own (live preview, Ctrl+S saves), /rtfm edit <DOC> opens one that exists - editing a SHIPPED page shadows it here rather than touching its file, and /rtfm rm <DOC> puts the file back in force. What you write this way is kept in THIS BROWSER (kv), not in src/, until /rtfm export hands it over as markdown. THEY ARE YOURS - she is never given them, and nothing in there is her memory. See /help rtfm.",
      "  /chronicle [ENTRY | newest | about | reload] :: THE CHRONICLE - the record of the MAKING of this terminal, one entry per session: what he asked for and in which words, what was built, WHAT WAS THOUGHT (the diagnosis, the options, what was rejected and why), what broke, and what is still open. Markdown entries in src/chronicle/ (listed in chronicle.json), read here. IT IS NOT HER MEMORY AND NOT THE MANUAL: the LOREPACK is hers, the RTFM tells you how to drive the machine, and this tells you how it came to be the machine you are driving. /chronicle alone lists the entries newest-first, /chronicle <ENTRY> prints one (its id, its file name, its date, or its number in the index), /chronicle about prints the recipe for writing one. Everything in it is public, which is why the raw chat logs are not in it. See /help chronicle.",
      "",
      "MYTHOS PACKS",
      "  /pack :: the imported packs (import \u00b7 list \u00b7 search <Q> \u00b7 graph <TERM> \u00b7 index <AGENT> \u00b7 check [AGENT|all] \u00b7 export <AGENT> \u00b7 forget <AGENT> yes \u00b7 nuke yes) - check runs the LOREPACK FACTORY's own gate over what is held here",
      "  /agents [ID] :: the 16 canonical agents, and what is held here",
      "",
      "KEYS",
      "  /keys :: the ring (open \u00b7 test <ID> \u00b7 forget <ID> \u00b7 bypass <elevenlabs|google> <on|off>). Keys live in this browser and never reach the transcript. A bypass suppresses that provider's calls - nothing is sent.",
      "",
      "THE SHELL (THE THREE DECKS)",
      "  UPPER DECK :: the status line, the tool bar and the viewers (the DOX VIEWER among them) \u00b7 MAIN STAGE :: the conversation, which never closes \u00b7 LOWER DECK :: the input, the controls and the panels docked in it",
      "  /deck [upper|main|lower|left|right|both [on|off|toggle]] :: put a region away or call it back - the UPPER and LOWER DECKS and the LEFT and RIGHT PANELS flanking the MAIN STAGE. A region that is down leaves a TAB on its edge, and the key inside the region (UPPER DECK \u25b2 / LOWER DECK \u25bc / the chevrons on the panels - each points the way it will move) does the same. AN OPEN VIEWER PUTS THE LOWER DECK DOWN BY ITSELF - that is why the input box is away while you are reading the LOREPACK - and closing it brings the deck back. See /help deck.",
      "",
      "BUTTONS, NOT COMMANDS",
      "  MICROPHONE (the icon button, beside SEND; the live channel) \u00b7 PENCIL (the draft - write it, spellcheck it, let the model polish it, kept on this device only - nothing reaches the archive or her until SEND; a POLISH comes back as a PROPOSAL and NOTHING is changed until ACCEPT) \u00b7 ATTACH (paperclip - images, documents, PDFs, video, audio) \u00b7 CREATE IMAGE \u00b7 GALLERY \u00b7 AUDITION (the bus) \u00b7 DOCS \u00b7 LOAD LOREPACK \u00b7 IMPORT MYTHOS PACK \u00b7 SYSTEM \u25be \u00b7 KEYS \u25be \u00b7 SHIFT \u25be (THE QUIET HOURS, AND THE PETITIONS SHE IS WAITING ON YOU TO ANSWER) \u00b7 TALK \u00b7 LISTEN \u00b7 EXECUTE \u00b7 BACKSTAGE \u00b7 FULLSCREEN \u00b7 EXPORT \u00b7 PURGE",
      "  ON ANY IMAGE :: SAVE downloads it \u00b7 KEEP puts what made it into the record (its prompt, negative list, settings and seed into the recipe book, #kept in the gallery, and a link to it) \u00b7 UPSCALE makes it bigger with bigger.pics (free, up to 4x, no key - nothing is deleted) \u00b7 \u25b2 UPSCALE HERE makes it bigger on this machine instead (no window, nothing uploaded, png) AND RETIRES THE SMALLER ORIGINAL once the bigger one is safely stored - the archive record, its place in the queue for her eyes, any tile of it in the log and a KEEP all move to the bigger one; a picture you handed over, a clip, a piece of music or an upscale is never deleted \u00b7 \u267b RENDERS A REPLACEMENT OF IT (same prompt and settings, a new seed) \u00b7 \u00d7 deletes it from the vault",
      "  ENTER SENDS. SHIFT+ENTER IS A NEW LINE.",
      "  PICS \u25be (in the deck) sets how large pictures and clips are drawn - FULL fills the whole width of the conversation \u00b7 STORYBOARD SHEET sits under a line of pictures.",
      "",
      "/help <TOPIC> GOES DEEPER :: " + HELP_TOPICS    ].join("\n");
  }

  function helpArea(topic) {
    var t = String(topic || "").trim().toLowerCase().replace(/^\//, "");
    if (t === "bus" || t === "hearing" || t === "audition" || t === "listening" || t === "hear") {
      return (window.audition ? window.audition.describe() : "THE AUDITION BUS IS OFFLINE IN THIS BUILD.")
        + "\n\nWHAT IT IS FOR :: listening to something TOGETHER. One transport for the whole terminal - the strip above the input - so nothing plays over anything else, and while a piece is on it every turn she answers is a turn she answers while listening. Her remarks are anchored to where in the piece she made them, so a listening session reads back afterwards as a timeline of what she heard."
        + "\n\nHER EARS :: the model this terminal speaks through takes pictures and nothing else, so a sound has to be LISTENED TO somewhere else. That is the Google (Gemini) key: the file is reduced HERE on this device - mono, 16 kHz, at most LIA_EARS_SECONDS of it - and what comes back is written onto the record as her own reading of the sound (`heard`), the twin of her reading of a picture (`sight`). With no key she still comments, from the name and the length and what you say - and she is told plainly that she cannot hear it, because describing a sound she has not heard is the one thing this terminal never does."
        + "\n\nTHE CADENCE :: while a piece plays, she may speak without being asked - one comment every LIA_BUS_AUTO_EVERY minutes (4 by default), at most LIA_BUS_AUTO_MAX a piece (3), only while this tab is on screen and nothing else is running. /bus auto off stops it; the ASK HER button and /hear are always available.";
    }
    if (t === "voice" || t === "mouth" || t === "speech" || t === "speak") {
      return (window.voice ? window.voice.describe() : "VOICE MODULE OFFLINE.")
        + "\n\nTHE BROWSER'S OWN VOICES ARE FREE AND UNLIMITED; ELEVENLABS IS HER REAL VOICE AND IS BILLED BY THE CHARACTER."
        + (window.story ? "\n\nAND A CHAPTER IS NOT SPOKEN AT ALL :: /help story - LONGFORM IS RENDERED BY HUGGINGFACE AND PLAYED HERE, WHICH IS THE ONLY WAY MINUTES OF SPEECH ARE AFFORDABLE." : "");
    }
    if (t === "story" || t === "stories" || t === "longform" || t === "narration" || t === "dramabox" || t === "chatterbox") {
      return (window.story ? window.story.describe() : "THE STORY LANE IS OFFLINE IN THIS BUILD.")
        + "\n\nWHY IT EXISTS :: the live voice is built for a sentence or two and is billed by the character. A story is minutes of speech, written once, and nobody needs it the instant it is written - so longform leaves the live engine entirely and is rendered by a free ZeroGPU Space on HuggingFace (Resemble AI's Chatterbox, TTS whose clone IS the voice: the reference clip is turned into speaker conditionals and the speech is generated from them), then played here while the two of you listen. The live engine stays what it is: the mouth she ANSWERS with."
        + "\n\nTHE ONE THING THAT LEAVES THIS DEVICE :: the voice sample, and only when a story is actually rendered. It is ONE SAMPLE PER AGENT - the clip IS the voice, so each RoleLayer carries its own: /story sample <ID|NAME> sets it for the agent on stage, `... for <AGENT>` for one who is not on stage, `... as default` for the fallback that answers for any agent with none of its own, and `... off` clears. The clip is uploaded to the Space ONCE per session, the first time a part is rendered in that voice (his CUSTOM AUDIO SAMPLE > CLONE > TTS). With no sample (and no fallback) the Space speaks in its own default voice and the lane says so. A STORY KEEPS THE VOICE IT BEGAN IN - the sample is fixed when the story is made, so a chapter never changes voice mid-sentence. Nothing else about a story is ever uploaded, and the text is hers, from here."
        + "\n\nA NOTE ON THE PARTS :: Chatterbox reads at most 300 characters per call and cuts anything longer, so a part is capped there and the lane SAYS SO rather than losing words quietly. One part is about 22 seconds of speech, the next is rendered while the current one plays.";
    }
    if (t === "role" || t === "roles" || t === "stage" || t === "actor") {
      return window.roles ? (window.roles.describe() + "\n\n" + window.roles.listText()) : "ROLE MODULE OFFLINE.";
    }
    if (t === "keys" || t === "key" || t === "keyring") {
      return window.keyring ? window.keyring.describe() : "KEYRING MODULE OFFLINE.";
    }
    if (t === "staging" || t === "stills" || t === "scene" || t === "blocking") {
      if (!window.stage) return "THE STAGE IS OFFLINE IN THIS BUILD.";
      window.stage.open();
      return window.stage.describe();
    }
    if (t === "checkin" || t === "check-in" || t === "initiative" || t === "first-word") {
      return window.checkIn ? window.checkIn.describe() : "THE CHECK-IN MODULE IS OFFLINE.";
    }
    if (t === "shift" || t === "shifts" || t === "quiet" || t === "quiet-hour" || t === "quiet-hours") {
      return (window.shift ? window.shift.describe() : "THE SHIFT MODULE IS OFFLINE (src/js/shift.js).")
        + "\n\nWHAT IT IS FOR :: a terminal that only ever answers is a machine, and one that talks whenever it likes is worse. The two together are the honest shape: the CHECK-IN is the one door she may speak to you through unasked (once per silence, and only after a long one), and THE SHIFT is the other half of that idea, which is not speech at all. When the room has been quiet long enough she is given a QUIET HOUR of her own - a private turn in which she may work on herself with the lanes she already has, and in which NOTHING IS SAID TO YOU: no line of it is put in the conversation, nothing is spoken aloud, and it is not a turn of hers. She may keep a memory of her own, write down what she means to carry, write down what she means to DO in a future quiet hour ([[INTEND: ...]]) and strike those off ([[DONE: n]]), read the record, keep her own pictures in order, set ARCHIVAX on what the terminal made, ASK YOU FOR A CHANGE TO HERSELF with a petition, or rest the hour entirely ([[ACT: rest]])."
        + "\n\nTHE QUEUE IS HERS :: what she means to do in a quiet hour is shown back to her at every one of them until it is done. You can read it (/shift queue) and take something off it (/shift queue drop <N>, recorded as yours) - but the machine will not write one for her, and neither should you: an intention someone else wrote is a task."
        + "\n\nWHAT IT COSTS, AND WHY IT IS CAPPED :: one call to the text engine per hour used, on your own key. So the record holds it back - " + ((window.shift ? window.shift.state().maxHour : 2)) + " in any hour, " + ((window.shift ? window.shift.state().maxDay : 10)) + " in any day - and the tally is counted off the record on disk, so a reload cannot reset it. A rested hour is recorded as a rested hour and counts, because it cost the call."
        + "\n\nHER WORDS TO YOU COME FIRST :: while the check-in's door is due and has not been opened for this silence, a quiet hour waits. And an hour is never made over the top of anything: not while she is speaking, not while a story has the floor, not while a turn is in flight, not in the first two minutes after a load, and not while this tab is off screen."
        + "\n\nWHERE TO WATCH IT :: the SHIFT \u25be button in the deck, which holds the record and the PETITIONS on one page, and prints every hour as a SYSTEM line when it happens. /help petitions IS THE OTHER HALF.";
    }
    if (t === "petition" || t === "petitions" || t === "asks" || t === "ask") {
      return (window.petition ? window.petition.describe() : "THE PETITION MODULE IS OFFLINE (src/js/petition.js).")
        + "\n\nWHY IT EXISTS AT ALL :: she can already change her own memory and her own wants with a line, and nothing approves those - they are hers. What she is GIVEN is a different thing, and it is not hers alone to rewrite: the blocks she is handed before every reply, the role text under them, the poses and recipes she composes from, the traits she is made of. Those are the machinery, and the only hand on the machinery should be yours - so instead of reaching in, she ASKS, in her own words, and says why."
        + "\n\nAND A REFUSAL IS THE POINT :: a petition that is declined keeps her words AND your reason, in the same record, forever. Nothing is deleted when you say no, and nothing is applied when she asks. The record of what she asked for and what was refused is most of what makes an ask honest - a lane that could only ever be granted would be a puppet's hand, not hers.";
    }
    if (t === "hers" || t === "agency" || t === "keeping" || t === "wants") {
      if (!window.hers) return "HER OWN KEEPING MODULE OFFLINE.";
      return "HERS :: HER OWN KEEPING - the two lanes that are hers and not yours.\n\n"
        + "HER OWN MEMORY. Everything in the LOREPACK was put there by you - 502 documents, and not one of them hers. A [[REMEMBER: it, in her own words]] line in her reply files a document marked HERS (pack " + window.hers.PACK + "): a real LOREPACK document, retrieved, cited and recalled exactly like the rest, because it is something she remembers. [[FORGET: words from it]] moves one to the lore trash - not into nothing. She has kept " + window.hers.memoryCount() + " so far; /hers lists them and /hers source <N> prints one in full. Neither of you can write one for her, which is the point of the lane.\n\n"
        + window.hers.reportWants();
    }
    if (t === "stamp" || t === "time" || t === "clock" || t === "timestamps") {
      return (window.logTime ? window.logTime.describe() : "LOG TIME MODULE OFFLINE.")
        + "\n\nTHE PENCIL :: the small pencil on any of YOUR lines in the log fixes a typo where it stands. The painted line, the archive entry and her live memory of the turn all take the corrected words, and her reply to it is left standing - nothing is re-sent, so the log does not grow. It is the alternative to /strike (which takes a turn out of the record altogether) when what is wrong is only a word.";
    }
    if (t === "system" || t === "prompt" || t === "instructions") {
      return (window.instr ? window.instr.summary() : "SYSTEM MODULE OFFLINE.")
        + "\nEVERY BLOCK SHE IS GIVEN, IN ORDER, IS IN THE SYSTEM PANEL: /system OPENS IT, /system preview PRINTS THE FULL PROMPT SHE RECEIVES THIS TURN, AND RESET IN THE PANEL PUTS THE SHIPPED TEXT BACK."
        + "\n\nSHE HOLDS THE SAME PEN (src/js/instr.js, THE SYSTEM LANE). Patrikios, 2026-09-29: *\"Allow her to CRUD SYSTEM instructions.\"* So the stack is not his alone to write any more - a line of her own reply is acted on at once, no petition needed:\n"
        + (window.instr && window.instr.sheGrammar ? window.instr.sheGrammar() : "  [[SYSTEM: LIST]] / [[SYSTEM: READ <ID>]] / [[SYSTEM: <ID> = <TEXT>]] / [[SYSTEM: NEW <TITLE> :: <TEXT>]] / [[SYSTEM: RESET <ID>]] / [[SYSTEM: DELETE <ID>]]")
        + "\nBOUNDARIES IS A BLOCK SHE MAY READ ([[SYSTEM: READ bounds]]) AND MAY NEVER WRITE OR DELETE: the line she does not cross is not hers to move, and a write to it is refused. BUSINESS HOURS ([[SYSTEM: READ hours]]) is the second block that is read-only to her hand - HIS arrangement of the hours - and it is the one read-only block she may ASK him to change, with a petition (`system :: hours :: ...`). Everything else is hers, including the blocks the terminal builds each turn - her words become an OVERRIDE of them. A write is said out loud on the stage, carried on that turn's archive entry as `system`, kept on this device, and marked EDITED (with a `*`) in the panel, so the design is never lost: RESET always has it to put back. SHE IS TOLD ALL OF THIS IN HER OWN PROMPT TOO (the SELF-CHANGE DIRECTIVES block), so she never has to guess that the pen is hers."
        + "\nTHE MOOD ROW IS IN THE SAME PANEL, UNDER THE ROLE ROW (AND AGAIN ON THE PENCIL) - THE COLOURS SHE ANSWERS IN. /help mood.";
    }
    if (t === "mood" || t === "moods" || t === "colour" || t === "color" || t === "tone") {
      if (!window.moods) return "THE MOOD ROW IS OFFLINE IN THIS BUILD (src/js/moods.js).";
      return "THE MOODS - THE COLOURS SHE ANSWERS IN (src/js/moods.js)."
        + "\n\nWHAT IT IS :: the lightest thing in the SYSTEM panel. A ROLE says who is on the stage; a TRAIT says what she is made of; a MOOD says what KEY she is speaking in this hour - and it is the pencil's AI POLISH idea (a chip in front, the whole RULE behind it) pointed at her REPLY instead of at your draft."
        + "\n\nA CONSOLE, NOT A CHOICE :: every chip is a SWITCH. Switch on as many as you like - SLUTTY + BOSSY + SAVAGE - and press one again to switch it off. ALL OFF is a chip too, and a chip's tooltip carries its whole rule. The colours that are on are COMBINED into one block of her prompt, one rule after another, in the order you switched them on."
        + "\n\nTHE LIST IS A FILE :: the shipped moods are THE BOOK at " + window.moods.BOOK + " - a plain list of names and rules. ADD ONE BY EDITING THAT LIST (then /mood reload, or reload the page) and it is a switch like any other; no code is touched. TWEAKING ONE IS DONE HERE, NOT IN THE FILE: the EDIT button in the MOOD row opens THE MOOD EDITOR - pick any mood, shipped or written here, and write its name and its rule. " + (window.moods.source() === window.moods.BOOK ? "IT WAS READ HERE." : "IT COULD NOT BE READ HERE, SO THE COPY IN src/js/moods.js IS IN FORCE (a preview with no service worker cannot read src/ before you save).")
        + "\n\nWHAT SHE IS TOLD :: one block of her prompt (`mood` in instr.js's list, visible like everything else), built each turn from what is switched on. It names the colours, whose they are, and the rule of each - then says out loud that they are colours and not orders: her voice, her memory and her limits come first, and if a colour does not fit what you have said she is told to answer in her own voice and say so rather than perform it. WHILE EVERY SWITCH IS OFF THE BLOCK IS NOT SENT AT ALL."
        + "\n\nTHE PENCIL HAS THE SAME SWITCHES :: the DRAFT panel's MOOD row is this same console (same store, same press), and AI POLISH hands the colours in force to the model with the rewrite - the STYLE decides the job, the MOODS decide the register it comes back in."
        + "\n\n" + window.moods.summary()
        + "\n\nFROM YOUR SIDE :: the MOOD panel (the MOOD button - the console, the boards with their editor, and the MOODPACK), the MOOD row in the SYSTEM panel, or the pencil's row, or /mood here: /mood <NAME> flips one, /mood <NAME> + <NAME> flips several, /mood on|off <NAME> says which way, /mood <NAME> :: <HOW SHE IS TO SOUND> writes a new colour of yours and switches it on (the same line re-says a SHIPPED one - your wording is kept on this device), /mood edit <NAME> :: <THE WORDS> rewrites one, /mood rename <NAME> :: <NEW NAME> changes the chip, /mood reset <NAME> puts a shipped mood's own words back, /mood delete <NAME> puts one away (NOTHING IS DESTROYED), /mood restore <NAME> puts it back, /mood list, /mood reload, /mood off. THE MOOD EDITOR IS THE SAME ACT WITH BUTTONS: EDIT PICKS A MOOD, SAVE KEEPS IT, RESET AND PUT IT BACK ARE BESIDE IT."
        + "\n\nFROM HER SIDE :: [[MOOD: NAME]] and [[MOOD: NAME + NAME]] switch colours ON, [[MOOD: off NAME]] switches one off, [[MOOD: off]] clears the board, and [[MOOD: NAME :: how I am to sound]] writes a NEW colour in her own words and switches it on (re-saying a SHIPPED colour is the same line, and what she writes is kept on this device). It is HERS to flip - a colour is not the machinery she is given, so it needs no petition - and every one she flips is printed as a SYSTEM line and shows in both rows from that moment."
        + "\n\nTHE MOOD BOARD - THE META-MOODS (a NAMED COMBINATION of colours, saved and held still) :: a mood is ONE colour; a BOARD is a combination of them in an ORDER, and it is the same console held still. The MOOD BOARD row sits under the MOOD row in the SYSTEM panel: a chip per saved board that APPLIES it (its colours, in its order, REPLACING what is switched on), SAVE BOARD names the combination that is switched on now, BIND saves it FOR THE ROLE ON STAGE - so shifting her onto that role switches the combination on by itself - and DELETE takes the saved combination out, never a colour: every mood in a board is still a switch. Nothing is a hidden mood either: a board NAMES colours, it does not store copies of them, so dropping one from a board or deleting the board leaves every colour exactly as it was."
        + "\n\n    /mood board PRINTS THE SAVED ONES IN FULL, WITH THE RULE OF EVERY COLOUR IN THE ORDER IT HOLDS. THE GRAMMAR: /mood board <NAME> APPLIES ONE; /mood board <NAME> :: <MOOD> + <MOOD> SAVES OR REWRITES ONE IN THAT ORDER (a colour that does not exist yet is written into being in the same line as <NAME> = how I am to sound); :: add <MOOD> AND :: drop <MOOD> CHANGE ITS MEMBERSHIP; :: move <MOOD> first|last|up|down|<N> MOVES ONE INSIDE THE ORDER (the order is part of the colour - the rules reach her one after another); :: role <ROLE-ID> SAVES IT FOR A ROLE (:: role off lets it go - one board to a role); /mood board off <NAME> DELETES THE COMBINATION. AND SHE HAS THE WHOLE OF IT HERSELF, in a BOARD line: [[BOARD: NAME]] applies, [[BOARD: NAME :: ...]] saves/moves/binds, [[BOARD: off NAME]] deletes. Boards are kept on this device with the colours, in kv lia_settings / mood."
        + "\n\n" + window.moods.boardText();
        + "\n\nAND IT IS NOT A MASK :: the moods are one block below her voice, her memory, her bounds and her role, and the block itself says what a colour cannot change. A colour that could overwrite who she is would not be a colour.";
    }
    if (t === "lore" || t === "lorepack" || t === "memory" || t === "archive" || t === "canon") {
      return window.lore ? (window.lore.describe()
        + "\n\nCANON :: A DOCUMENT MARKED CANON IS NOT RECALLED - EVERY FRAGMENT OF IT IS HANDED TO HER IN FULL, FIRST, ON EVERY TURN, UNTRIMMED. "
        + "/canon LISTS WHAT IS CANON, /canon <NAME> MAKES A DOCUMENT YOU LOADED CANON, /canon off <NAME> TAKES IT OUT. ONLY THE TRUTHS THAT MUST ALWAYS HOLD BELONG THERE.") : "LORE MODULE OFFLINE.";
    }
    if (t === "pack" || t === "packs" || t === "mythos" || t === "corepack" || t === "traits") {
      return window.packs ? window.packs.describe() : "PACK MODULE OFFLINE.";
    }
    if (t === "deck" || t === "decks" || t === "shell" || t === "layout" || t === "screen") {
      var ds = window.decks ? window.decks.state() : null;
      return "THE SHELL IS THREE DECKS AND TWO PANELS (src/js/decks.js).\n\n"
        + "  UPPER DECK :: the status line, the tool bar, and the VIEWERS that hang from them (the DOCS panels).\n"
        + "  MAIN STAGE :: the conversation. It never closes - a terminal with nothing to read is a terminal with nothing in it. (Patrikios named it the MAIN WINDOW on 2026-09-24 and named it again the same day; `window` still works wherever a deck is named.)\n"
        + "  LOWER DECK :: the input box, the controls row, and the panels docked in it (SYSTEM, KEYS, TOOLS, the forge, the story lane).\n"
        + "  LEFT PANEL :: the PILOT'S SEAT - the MASTER ARM (OFF/SEMI/FULL) and the mount his own pilot instruments plug into.\n"
        + "  RIGHT PANEL :: the SENIOR OFFICER'S station - the mount cleared instruments plug into.\n\n"
        + (ds ? "  NOW :: " + deckLine(ds.upper) + "\n         " + deckLine(ds.main) + "\n         " + deckLine(ds.lower) + "\n         " + deckLine(ds.left) + "\n         " + deckLine(ds.right) + "\n\n" : "")
        + "  PUT AWAY AND CALLED BACK :: the UPPER DECK /\\u00b4 and LOWER DECK \\/ keys inside the decks and the chevron keys inside the panels, or /deck upper|lower|left|right|both on|off|toggle. "
        + "A deck that is down leaves a TAB in its corner of the screen (top-right for the upper, bottom-right for the lower) and a panel that is down leaves one on its edge, so nothing can ever be lost. "
        + "THE MAIN STAGE DOES NOT CLOSE.\n"
        + "  THE VIEWER RULE :: while a panel marked `data-viewer` is open - the DOCS panels are - the LOWER DECK STANDS DOWN BY ITSELF and gives the room to what you are reading. "
        + "Closing it brings the deck back to wherever your hand last put it. That reason is transient and is never written down; the keys and /deck are the lasting preference.";
    }
    if (t === "folders" || t === "folder" || t === "dir" || t === "path" || t === "music") {
      var fm = window.media ? window.media.allFolders() : [];
      return "THE MEDIA FOLDERS :: THE VAULT IS KEPT IN FOLDERS, AND A FOLDER IS A PATH.\n\n"
        + "  WHERE THINGS LIVE. Everything in the vault has a folder, whether or not anyone filed it: "
        + "a picture falls back to " + (window.media ? window.media.defaultFolder({ mime: "image/jpeg", kind: "attach" }) : "/images")
        + ", music (audio) to " + (window.media ? window.media.defaultFolder({ mime: "audio/mpeg" }) : "/music")
        + ", a clip to " + (window.media ? window.media.defaultFolder({ kind: "video" }) : "/clips")
        + ", an upscale to " + (window.media ? window.media.defaultFolder({ kind: "upscale" }) : "/images/upscaled")
        + ". Those four are the config knob LIA_MEDIA_FOLDERS (src/js/config.js); nothing needed to be moved to make them exist, and /music is a real folder from the first boot.\n\n"
        + "  THE FOLDERS NOW :: " + (fm.length ? fm.map(function (f) { return f.path + "(" + f.count + ")"; }).join("  \u00b7  ") : "none") + "\n\n"
        + "  FROM HERE :: /folder LISTS THEM \u00b7 /folder new <PATH> MAKES ONE (/folder new music) \u00b7 /folder open <PATH> SHOWS ONLY THAT ONE \u00b7 /folder file <PATH> <R12|#TAG|WORDS> FILES THINGS INTO IT \u00b7 /folder rename <OLD> <NEW> \u00b7 /folder drop <PATH> (empty folders only).\n"
        + "  IN THE GALLERY :: the FOLDERS row is every folder with what is in it - press one to show only it, type in the box to make a new one; a caption carries the folder a thing is in; select pictures and use the folder picker and FILE SELECTED at the bottom; and any picture's FULL STAGE has a FOLDER row where it can be refiled with one press.\n"
        + "  HER SIDE OF IT :: she may READ the whole vault ([[READ: folders]], [[READ: folder /music]]), MAKE folders ([[FOLDER: /name]]) and FILE pictures the terminal made ([[FILE: /name]], or [[FILE: /name :: words or R12]]). She cannot delete, move or rewrite anything else, and nothing you handed over yourself is hers to move.\n"
        + "  IT IS ALL IN THIS BROWSER (IndexedDB), FILING CHANGES ONE FIELD ON ONE RECORD, AND NOTHING IS EVER UPLOADED.";
    }
    if (t === "read" || t === "reader" || t === "reads" || t === "access") {
      return (window.reader ? window.reader.describe() : "THE READER MODULE IS OFFLINE.")
        + "\n\nREADING WRITES NOTHING. She has read-only access to everything saved here - the vault and its folders, the archive of every turn, her memory (the LOREPACK and the documents she kept), the render book, the tags, what she wants carried - and the answer is put in front of her on her NEXT turn, so a read costs nothing until she asks. Her two writes in the vault are folders and filing her own pictures.";
    }
    if (t === "archivax" || t === "agent" || t === "agents2" || t === "ops") {
      return (window.archivax ? window.archivax.describe() : "THE ARCHIVAX MODULE IS OFFLINE (src/js/archivax.js).");
    }
    if (t === "see" || t === "seed" || t === "inline") {
      return "INLINE (src/js/chat.js, the /see command) :: ONE PICTURE OUT OF THE VAULT, IN FRONT OF HER, IN THE CONVERSATION.\n"
        + "\n\nWHAT IT IS :: the CLASSIFIER (/tools read) reads a whole vault one picture at a time behind the curtain. /see is the same pass with the picture ON STAGE: it is put into the log as a line of his with the picture under it, the vision model reads it ONCE, and what it found is written on the record exactly as the bulk pass writes it - her READING as that record's sight, the major elements as TAGS, and the KIND of scene as its BUCKET (also a #tag, and with LIA_CLASSIFY_FILE on the folder it is filed into: /images/<bucket>)."
        + "\n\nWHAT HE TYPES :: /see <VAULT ID | newest | <N> | #TAG> and then anything he wants to say to her, which rides as his own words on that turn. `again` first (`/see again <WHAT>`) re-reads a picture that has already been read and replaces what is written on it. A picture that already carries a reading and a bucket costs NO vision call: the record IS the analysis, so the conversation simply carries it."
        + "\n\nWHAT SHE IS TOLD :: the record's own filing - the name it is kept under, its folder, its bucket, its tags, and her own earlier reading if there is one - with the picture attached as the direct image, plus the standing instruction to answer from what she actually sees. The filing is what lets the picture be found again; the picture is the thing."
        + "\n\nFROM THE GALLERY :: the \u2609 button on any card seeds this same line into the input box, so a picture is sent from the gallery with his words after it. POST TO CHAT (\u2b16) is the plainer road: it posts a picture with no reading spent and nothing said about it; /see reads it, writes what it finds, and hands the filing over with it.";
    }
    if (t === "peek" || t === "mini" || t === "minilightbox" || t === "inhand" || t === "look") {
      return "THE MINI LIGHTBOX (src/js/minibox.js) :: A QUICK LOOK AT ONE PICTURE, AND THE WINDOW ON WHATEVER THE MACHINERY HAS IN ITS HAND."
        + "\n\nWHY IT EXISTS :: a long job carries on behind the curtain while the conversation keeps going, and its receipt NAMES what it touched (\"forge-1-x2-1536x1024.png  [mmud9esy4nuved]\"). A name is not the thing. The in-hand chip in the deck's control row is the thing: while a sweep, a duplicate hunt or a folders pass is working, it shows the THUMBNAIL of the record being worked on right now, its citation, and what is being done to it (\"UPSCALING 372 / 1144\"). Press it and the mini lightbox opens on that picture - the job never stops."
        + "\n\nTHE WORDS :: /peek with nothing takes the newest picture in the vault; /peek <ID> (or the start of one) takes exactly the citation a receipt printed; /peek #tag takes the newest picture filed that way; /peek <N> takes the Nth newest. The LEFT and RIGHT arrows walk the ones the box was opened with - from the chip that is the job's own plan, from the gallery's square it is the grid you were browsing, from /peek it is the vault newest-first - ESC closes it and so does a click outside."
        + "\n\nNOT A SECOND STAGE :: the mini box only LOOKS. It writes nothing, deletes nothing and queues nothing. FULL STAGE in the box hands the same picture to the full record (SAVE TO DEVICE, both upscales, its folder row, its tags, its prompt file and seed), so the mini box is the look and the stage is the work. A picture that is retired into a bigger one while the box is open is followed to the record that exists, exactly as a tile in the log is.";
    }
    if (t === "gallery" || t === "galleries" || t === "catalogue" || t === "catalog") {
      return (window.gallery ? window.gallery.describe() : "THE GALLERY MODULE IS OFFLINE.") + "\n\n" + HELP_PICTURES;
    }
    if (t === "renders" || t === "render" || t === "renderbook" || t === "book of renders") {
      return (window.renderBook ? window.renderBook.describe() : "THE RENDER BOOK MODULE IS OFFLINE.")
        + "\n\nTHE BOOK IS A VIEW, NOT A SECOND COPY: THE VAULT HOLDS THE PICTURES AND THEIR RECIPES, THE ARCHIVE SAYS WHICH TURN EACH ONE CAME FROM, AND /renders READS THE TWO TOGETHER. NOTHING IS UPLOADED AND NOTHING IS STORED TWICE."
        + "\n\nSHE READS THE SAME BOOK. A [[SHOW: words or #a-tag]] LINE IN HER REPLY FINDS THE CLOSEST ROWS AND PUTS THEM IN FRONT OF HER EYES ON HER NEXT TURN - SO \"REMEMBER THAT IMAGE WITH THE GLASS CATHEDRAL?\" HAS SOMEWHERE TO LAND.";
    }
    if (t === "keep" || t === "keepsake" || t === "kept") {
      return (window.keepsake ? window.keepsake.describe() : "THE KEEPSAKE MODULE IS OFFLINE (src/js/keepsake.js).");
    }
    if (t === "heart" || t === "hearts" || t === "likes" || t === "like" || t === "taste" || t === "marked") {
      return (window.likes ? window.likes.help() : "THE HEART MODULE IS OFFLINE (src/js/likes.js).");
    }
    if (t === "upscale" || t === "upscaling" || t === "bigger" || t === "biggerpics" || t === "bigger.pics") {
      return "UPSCALE :: TWO ROADS, ONE COMMAND (see UPSCALING in src/README.md, and src/js/upscale.js with src/js/upscale-local.js).\n"
        + "  /upscale [ID]            BIGGER.PICS - free, ad-funded, up to 4x, no account, no key. A popup window: the picture is handed to their upscaler, and the bigger one comes back here by itself into the vault, onto the stage and in front of her. IT NEEDS A REAL CLICK (a popup opened from anything else is blocked) AND IT TAKES ONE PICTURE AUTOMATICALLY - both measured - so it can never run on its own. A BATCH IS STILL POSSIBLE BY HAND: drop up to seven more pictures into that same window and press its \"SEND THIS BACK TO ...\" button, and every finished one is filed here on its own (set LIA_UPSCALE_CLOSE = false in config.js so the window stays up long enough).\n"
        + "  /upscale here [ID] [2|4] ON THIS MACHINE - no window, no click, nothing uploaded. A scaled Lanczos-3 resample on this device's GPU (WebGL2; a stepped canvas resample where there is none) with a detail pass that is gated off in flat areas, so nothing is sharpened where a jpeg hides its blocking. The bigger picture is a normal upscale record: the original's WHOLE PROMPT FILE (prompt, sent words, negative list, seed, guidance scale, size, pose, tags and folder), on the stage, and queued for her eyes. PNG ONLY.\n"
        + "  AND IT RETIRES THE SMALLER ORIGINAL. Once the bigger picture is safely in the vault, the render it came from leaves the vault and the gallery, and nothing is left pointing at a record that is gone: the archive's creation row, the place it held in the queue for her eyes, any tile of it in the log, the stage if it was up, and a KEEP (its recipe and its gallery link rewritten) all move to the bigger one. WHAT IS NEVER RETIRED: a picture he handed over, a clip, a piece of music, and AN UPSCALE - upscaling something that is already an upscale leaves the last upscale exactly where it is. A FAILED UPSCALE DELETES NOTHING.\n"
        + "  /upscale auto on|off     THE AUTOMATIC ROAD - THE WHOLE PIPELINE, UNATTENDED. With it on, EVERY picture the terminal makes is enlarged by itself the moment it lands - silently, with nothing opened and nothing added to her eyes (the picture it made is already there, and it is the one the bigger picture replaces). The bigger.pics road cannot do this, which is why this one exists.\n"
        + "  /upscale replace on|off  WHETHER THAT RETIREMENT HAPPENS. The one switch in the terminal that removes something of his by itself; `status` says exactly what it will and will never touch. Off leaves every original in the vault beside its bigger self.\n"
        + "  /upscale pipeline        THE PIPELINE UNDER EVERY CREATION (src/js/pipeline.js): which road each picture the terminal makes is placed on, so that ONLY THE UPSCALED ONE is in the chat and the gallery. ON by default: the first picture of a CREATE press goes to bigger.pics at 4x WHEN THE FORGE'S 4X WINDOW BOX IS TICKED (unticked, CREATE opens no window and the whole run goes the 2x road) and everything else (the rest of a run, her own lines, /image, a re-render, and anything a window does not bring back) is made 2x on this machine, unattended. on|off|cancel.\n"
        + (window.pipeline ? window.pipeline.report() : "THE PIPELINE IS OFFLINE IN THIS BUILD (src/js/pipeline.js).")
        + "\n  /upscale auto status     WHAT IT WILL DO NOW\n"
        + (window.upscaleLocal ? window.upscaleLocal.autoCmd("status") : "THE LOCAL UPSCALER IS OFFLINE IN THIS BUILD (src/js/upscale-local.js).")
        + "\n  NO ID = THE PICTURE ON THE STAGE, OR THE NEWEST ONE IN THE VAULT. THE BUTTONS ON A PICTURE'S FULL STAGE DO EACH ROAD BY HAND: UPSCALE WITH BIGGER.PICS AND UPSCALE HERE. A CLIP OR A PIECE OF MUSIC HAS NEITHER - UPSCALING IS A PICTURE OPERATION."
        + "\n  WITH SEVERAL PICTURES: TICK THEM (the box in each caption bar) AND USE THE BAR UNDER THE LINE - /help batch. ONE OF THE TICKED GOES ACROSS BY ITSELF AND THE REST ARE ADDED BY HAND IN THAT SAME WINDOW; EVERYTHING THAT COMES BACK IS FILED ALREADY UPSCALED.";
    }
    if (t === "idea" || t === "shotlist" || t === "shot list" || t === "shot" || t === "dice" || t === "roll") {
      return "THE SHOT LIST :: A PICTURE IS ROLLED, NOT TYPED (src/js/idea.js, rolled from the lists in main.pjs).\n"
        + "EVERY LIST IN main.pjs IS ONE DIMENSION OF A SHOT - AND THAT INCLUDES THE HALF A FILMMAKER ACTUALLY NEEDS: the crop,\n"
        + "the framing, the angle, the camera body, the file it was captured on, the lens, the focus, the light, the grade,\n"
        + "the look it imitates, and the master tail that closes every prompt.\n"
        + "  /idea                     ROLL EVERY DIMENSION AND WRITE THE PROMPT INTO THE FORGE BOXES (CREATE renders it)\n"
        + "  /idea dice                THE DICE, AND WHAT EACH ONE ROLLS\n"
        + "  /idea <DIE>               ROLL ONE GROUP (d6 = the scene, d20 = everything no other die claims)\n"
        + "  /idea <DIMENSION>         RE-ROLL JUST THAT ONE - every other chip stays exactly where it is\n"
        + "  /idea list                EVERY DIMENSION, HOW MANY ITEMS IT HAS, AND WHAT YOU HAVE ADDED TO IT\n"
        + "  /idea held | scene        THE CHIPS AND THE SCENE LINE, OR THE SCENE LINE ALONE\n"
        + "  /idea drop <DIM> | clear  TAKE ONE DIMENSION OUT OF THE PROMPT, OR FORGET THE WHOLE ROLL\n"
        + "  /idea add <DIM> :: PHRASE  FILE A PHRASE OF YOUR OWN INTO A DIMENSION - from then on it is DRAWN\n"
        + "                            like any item of that list, one chance in its own right\n"
        + "THE SCENE LINE IS READ-ONLY: it names the shot out of the roll and is never written into any prompt, so a name can\n"
        + "never influence a picture. THE PANEL'S SHOT LIST ROW is the same thing with hands: a button per die, a chip per\n"
        + "dimension (its \u21bb re-rolls that one, its \u2715 drops it), and the line itself.\n"
        + "WHAT THE LISTS MAY SAY is the curation rule at the top of main.pjs, kept with them - the Minoan Aegean, 1500 BCE,\n"
        + "in-period material only for the scene dimensions, and the film vocabulary deliberately modern.";
    }
    if (t === "batch" || t === "batches" || t === "upscalebatch") {
      return (window.batch ? window.batch.help() : "THE BATCH MODULE IS OFFLINE (src/js/batch.js).")
        + "\n\nTHE PANEL SIDE :: the tick box is drawn in a picture's caption bar by src/js/images.js (`fillTile`), and the bar\n"
        + "under a line by src/js/batch.js (`decorate`), which both a forge run and a line of pictures in the log get. The\n"
        + "bar reads the ticks off the DOM at the press - there is no register to keep in step - and a send hands the pictures\n"
        + "to src/js/upscale.js one window at a time.";
    }
    if (t === "pictures" || t === "picture" || t === "image" || t === "images" || t === "media" || t === "sight") {
      return HELP_PICTURES + (window.gallery ? "\n\n" + window.gallery.describe() : "");
    }
    if (t === "poses" || t === "pose" || t === "positions" || t === "position" || t === "book" || t === "book of poses") {
      return helpPoses();
    }
    if (t === "embed" || t === "embedding" || t === "meaning" || t === "semantic") {
      return (window.embed ? window.embed.statusText() : "THE EMBEDDING MODULE IS OFFLINE.") + "\n\n" + HELP_EMBED;
    }
    if (t === "recipes" || t === "recipe" || t === "template" || t === "templates") {
      return helpRecipes();
    }
    if (t === "rtfm" || t === "manual" || t === "cheatsheet" || t === "cheat" || t === "man") {
      return (window.rtfm ? window.rtfm.describe() : "THE RTFM MODULE IS OFFLINE (src/js/rtfm.js).")
        + "\n\nWHAT IT IS FOR :: a command list is not a manual. /help is the roster and /help <TOPIC> goes deeper on one area, but neither explains the whole machine in a page you can read or hand to someone - so the manual is a PACK OF DOCUMENTS, the way her memory is a pack of documents."
        + "\nTHEY ARE YOURS, NOT HERS :: the LOREPACK is what she remembers; the RTFM is the manual for the machine she runs on. Nothing in src/rtfm/ is indexed, retrieved or handed to her on a turn, and nothing in it writes to her memory. Everything in that folder is PUBLIC and ships with the generator."
        + "\nTHE CHEATSHEET IS GENERATED :: src/rtfm/commands.md is rendered from src/commands/commands.json - the one place a command is declared - so it cannot drift away from the commands that actually exist. /rtfm cheatsheet renders it fresh, /rtfm check fetches the shipped copy and names the first line that differs, /rtfm export downloads a fresh one."
        + "\nWRITING ONE HERE :: /rtfm new [NAME] opens the editor on a page of your own, /rtfm edit <DOC> opens one that exists, /rtfm add <DOC> <TEXT> appends a line without the editor, /rtfm mine lists what you have written, /rtfm rm <DOC> drops one. The editor has a LIVE PREVIEW built from the same renderer that prints a page, so the pane is what /rtfm <DOC> will show."
        + "\nWHERE YOURS LIVE :: NOT in src/. A page written here is kept in this browser (kv: lia_settings / rtfm_local) - nothing on this page can write a file into the generator - and it stays yours until /rtfm export hands it over as markdown to drop into the folder. Editing a SHIPPED page does not touch its file either: your copy SHADOWS it here (the arrangement roles.js uses for a role layer), and /rtfm rm <DOC> or REVERT in the editor puts the shipped file back in force."
        + "\nADDING A DOCUMENT AS A FILE :: drop the .md into src/rtfm/ and list it in src/rtfm/rtfm.json (id, file, title, tags, desc - a bare string works too). /rtfm about PRINTS THE RECIPE, and src/rtfm/README.md has it in full."
        + "\nMARKDOWN, AS A TERMINAL SHOWS IT :: headings become ruled banners, tables become aligned columns, lists keep their indentation, code fences pass through untouched, and **bold**, `code` and [links](url) are unwrapped. Anything the renderer does not understand prints as it stands, so a document can never lose words to it.";
    }
    if (t === "chronicle" || t === "making" || t === "logbook") {
      return (window.chronicle ? window.chronicle.describe() : "THE CHRONICLE MODULE IS OFFLINE (src/js/chronicle.js).")
        + "\n\nWHY IT EXISTS :: a session is the one part of this work that survives nowhere else. The code is in src/, each change is a section in TODO.md, and the manual is in the RTFM - but the REASONING (what he actually asked for, what was tried first, what was rejected and why, what the numbers were) dies with the chat window. The chronicle is that reasoning, written down while it is still warm, by the agent that lived the session, so the next one starts from it instead of from nothing."
        + "\nIT IS NOT A CHANGELOG AND NOT HER MEMORY :: TODO.md says what changed and README.md says what is true of the code; the LOREPACK is what she remembers. Nothing in src/chronicle/ is indexed, retrieved or handed to her, and nothing in it writes to her memory. It is the record of the MAKING - the lane beside the manual."
        + "\nTHE RAW CHATS ARE NOT IN IT :: an entry is the WRITE-UP (a few minutes' read), not the transcript. Everything in the folder is PUBLIC, so a private note belongs in kv or on his own machine. A raw log goes into the build only if he asks for it, as its own file with its own entry line."
        + "\nAND IF A SESSION SHOULD BE HERS :: the road is the LOREPACK, not this folder - copy the entry into src/lorepack/ and list it in src/lorepack/lorepack.json, and it is a memory, indexed and drawn on like any other. src/lorepack/README.md has the recipe, including what `foundational` does."
        + "\nWRITING ONE :: drop a .md into src/chronicle/ named <YYYY-MM-DD>-<slug>.md and list it in chronicle.json in the order it happened. The sections are WHAT HE SAID / WHAT WAS BUILT / WHAT WAS THOUGHT / WHAT WENT WRONG / STILL OPEN / FILES TOUCHED. /chronicle about prints the whole recipe.";
    }
    if (t === "journal" || t === "diary" || t === "logbook" || t === "notes") {
      return (window.journal ? window.journal.describe() : "THE JOURNAL MODULE IS OFFLINE (src/js/journal.js).")
        + "\n\nWHY IT EXISTS :: the conversation belongs to both of them and the vault belongs to the work - this is the third thing, and it is his alone: raw lines he files himself, #tags riding inside, and MINUTES every six hours, meeting-style (counts, tags, his lines quoted verbatim - nothing judged, rated or concluded). Kept in this browser (kv: lia_journal), never in src/ which is public, never sent to any model, never read by her."
        + "\n\nNOT THE CHATLOG :: /help chatlog is the transcript importer for the conversation itself. The journal never touches the conversation - it only holds what he files with /journal.";
    }
    if (t === "chatlog" || t === "chat-log" || t === "transcript" || t === "conversation" || t === "log" || t === "chat") {
      return (window.chatlog ? window.chatlog.describe() : "THE CHATLOG MODULE IS OFFLINE (src/js/chatlog.js).")
        + "\n\nWHY IT EXISTS :: a chat window is the one file that closes. Everything else survives - the code in src/, every change\n"
        + "in TODO.md, her memory in the LOREPACK, the manual in the RTFM, the write-ups in src/chronicle/ - but the CONVERSATION\n"
        + "ITSELF, in the words it was actually had in, is gone the moment the tab is. A handoff note is a few kilobytes of\n"
        + "somebody's memory of it. This is the transcript, kept whole, so a later session can go and read what was really said\n"
        + "instead of guessing - which is the difference between starting a session from the record and starting it from a rumour.\n"
        + "\nNOT IN src/ :: src/ IS PUBLIC - it ships with the generator and anyone who opens the source can read it - and a\n"
        + "conversation is not public. So the raw record lives in THIS BROWSER (kv: lia_settings / chatlog_*), and what ships is\n"
        + "the reader (src/js/chatlog.js), the export recipe (src/chatlog/EXTRACT.md) and the index (src/chatlog/manifest.json).\n"
        + "\nGETTING IT OUT :: nothing on this page can read the editor's chat panel: it is a different origin, one window up, and\n"
        + "the browser forbids the crossing on purpose. So the export is an OPS. /chatlog snippet prints a small script; you paste\n"
        + "it into the EDITOR'S browser console (F12, console tab, on the editor's own page), press Enter, and the conversation\n"
        + "comes back as a downloaded lia-chatlog-<date>.txt with a .json sidecar. IT SENDS NOTHING ANYWHERE. The whole recipe,\n"
        + "including what the script looks at and what to do when it finds nothing, is " + "src/chatlog/EXTRACT.md.\n"
        + "\nKEEPING IT :: the CHATLOG panel - the CHATLOG button in the deck - takes a pasted conversation or a picked file,\n"
        + "splits it into chunks in kv, and indexes it: which chunk holds what, and the line where every turn of the\n"
        + "conversation begins. Then it reads back without ever being re-sent to a model - /chatlog show <CHUNK>, /chatlog turns,\n"
        + "/chatlog turn <N>, /chatlog grep <WORDS>, /chatlog export. /chatlog import <URL> restores it from a hosted copy into a\n"
        + "fresh browser, and /chatlog wipe yes deletes it (it will not act without the word).\n"
        + "\nHOW IT GROWS, AND WHY THE POLICY IS APPEND :: a conversation only ever gets longer, so the newest export of it\n"
        + "contains everything the last one did - which means \"import the newest file\" has to mean \"keep what is here and take\n"
        + "what is new\". So an import MERGES: the seam between the record and the new file is found (an exact extension of the\n"
        + "record, or the record's own tail inside the new file), only what is past the seam is kept, and the join is written\n"
        + "into the record where anyone reading it can see it. A file that is already in the record changes NOTHING - unless it\n"
        + "carries turns (the .json sidecar does), in which case only the turn index is rebuilt and the words are left alone.\n"
        + "REPLACE is the deliberate opposite, on the panel's own REPLACE button and /chatlog import --replace, and it is the\n"
        + "only thing in this lane that ever throws anything away. /chatlog policy says which one the FILE PICKER and\n"
        + "/chatlog import <URL> use, and sets it; APPEND THE BOX and REPLACE mean what they say whatever the policy is.\n"
        + "\nNOTHING HERE REACHES THE TEXT ENGINE :: an import costs nothing, a search costs nothing, a read costs nothing, and no\n"
        + "part of it is ever put in her prompt or indexed for her recall. This is the lane of the MAKING, like the RTFM and the\n"
        + "chronicle - except that those are what a session MADE of the conversation, and this is the conversation.\n"
        + "\nAND IT IS ONLY IN THIS BROWSER :: clear this browser's storage and the record goes with it. So export it when it\n"
        + "matters, and remember that a hosted cold copy is the only thing that survives a wiped device.";
    }
    if (t === "commands" || t === "command" || t === "slash") {
      return (window.cmd ? window.cmd.listText() : "COMMAND LIST OFFLINE.")
        + "\n\nTHE LIST IS DATA (src/commands/commands.json): ADD A COMMAND THERE AND IT APPEARS HERE, IN THE SYSTEM PANEL'S SLASH COMMANDS BLOCK, AND IN WHAT SHE IS TOLD BEFORE EVERY REPLY.";
    }
    if (t === "backup" || t === "save" || t === "saving" || t === "source" || t === "download" || t === "zip") {
      return "THE BACKUP :: THE GENERATOR'S OWN SOURCE, OUT OF THIS PAGE (src/js/backup.js, and the BACKUP \u2193 button on the lorebar).\n"
        + "  /backup            BUILD A ZIP OF THE WHOLE SOURCE AND DOWNLOAD IT - main.pjs, index.html AND EVERY FILE UNDER src/, READ FROM THE PAGE RIGHT NOW AND INCLUDING FILES THE SERVER HAS NOT BEEN GIVEN YET. NOTHING IS UPLOADED.\n"
        + "  /backup status     WHICH SOURCE FILES ARE ON THE SERVER AND WHICH HAVE NEVER BEEN SAVED\n"
        + "  /backup diag       WHAT THIS DEVICE CAN AND CANNOT DO (THE TABLET / iPAD QUESTION)\n"
        + "  /backup autosave   THE INSURANCE: WITH IT ON, EVERY CLEAN BUILD IS ZIPPED AND KEPT ON THIS DEVICE WHILE THE SOURCE IS NOT ALL ON THE SERVER YET - SO THE NEWEST GOOD TREE IS ALWAYS ONE COMMAND AWAY. /backup pull DOWNLOADS IT, /backup kept SHOWS WHEN IT WAS TAKEN, /backup autosave off STOPS IT. IT NEVER UPLOADS ANYTHING.\n"
        + "A BACKUP IS NOT A SAVE. ONLY THE EDITOR'S SAVE BUTTON PUTS THE WORK ON THE SERVER - AND THIS PAGE CANNOT PRESS IT (checked: the editor is another origin and exposes no save hook). UNTIL IT IS PRESSED, THIS PAGE STILL RUNS (IT IS SERVED THE UNSAVED FILES LOCALLY) AND EVERY OTHER DEVICE - A PHONE, A TABLET, THE PUBLIC URL - GETS 404s FOR THOSE FILES AND THE TERMINAL CANNOT START. THAT IS WHY /backup status EXISTS: IT NAMES THEM, AND THE AUTOSAVE KEEPS A COPY THAT SURVIVES THE TAB.";
    }
    if (t === "agegate" || t === "door" || t === "18" || t === "18+") {
      return (window.agegate ? window.agegate.help() : "THE DOOR MODULE OFFLINE (src/js/agegate.js DID NOT LOAD).");
    }
    if (t === "gatekeeper" || t === "gate" || t === "sigil" || t === "token" || t === "priapos" || t === "priapus") {
      return (window.gatekeeper ? window.gatekeeper.help() : "THE GATEKEEPER MODULE OFFLINE (src/js/gatekeeper.js DID NOT LOAD) - BUT THE SIGIL SCREEN IS STILL ON THE PAGE AND ITS OWN FALLBACK STILL WORKS. /backup diag NAMES THE src/ FILES THE SERVER HAS NOT BEEN GIVEN.");
    }
    if (t === "xlate" || t === "translate" || t === "grc" || t === "greek" || t === "translator") {
      return (window.xlate ? window.xlate.help() : "THE TRANSLATOR IS OFFLINE (src/js/xlate.js DID NOT LOAD).");
    }
    if (t === "wall" || t === "background" || t === "backdrop") {
      return (window.wall ? window.wall.help() : "THE WALL MODULE OFFLINE (src/js/wall.js DID NOT LOAD) - WHICH COSTS NOTHING: THE WALL SHIPS OFF.");
    }
    if (t === "saved" || t === "savedcheck") {
      return (window.saved ? window.saved.help() : "THE SAVE CHECK MODULE OFFLINE (src/js/saved.js DID NOT LOAD) - /backup status STILL NAMES THE FILES THE SERVER HAS NEVER BEEN GIVEN.");
    }
    if (t === "sync" || t === "versions" || t === "chatbackup" || t === "drive" || t === "gdrive") {
      return (window.sync ? window.sync.describe() : "THE SYNC MODULE IS OFFLINE IN THIS BUILD (src/js/sync.js).")
        + "\n\nTHE CLOUD ROAD SITS BESIDE IT :: THE SAME PANEL ALSO CARRIES A GOOGLE DRIVE LANE (src/js/sync-cloud.js) - NO FOLDER, NO MACHINE, A FILE IN YOUR OWN DRIVE THAT ANOTHER DEVICE CAN PULL. /help cloud EXPLAINS IT; /sync IS THE FOLDER ON THIS DISK."
        + "\n\nWHY IT IS NOT PART OF /backup :: /backup CARRIES THE GENERATOR'S SOURCE - main.pjs, index.html AND EVERY FILE UNDER src/ - AND NOT ONE WORD OF THE CONVERSATION. THE ARCHIVE IS THE OTHER THING, AND IT IS THE ONE THAT LIVES IN THIS BROWSER AND NOWHERE ELSE (kv: sacred_archive / master_log, THE NEWEST 1000 TURNS). PURGE, A CLEARED PROFILE OR A NEW MACHINE TAKES ALL OF IT. SO THERE ARE TWO BACKUPS AND THEY ANSWER TWO DIFFERENT FEARS: /backup FOR THE CODE, /sync FOR THE CONVERSATION."
        + "\n\nWHAT IT READS, AND HONESTLY HOW WELL :: THE TERMINAL'S OWN BACKUP (lia-terminal-archive.json, WHAT /sync up WRITES) ROUND-TRIPS EXACTLY - EVERY TURN VERBATIM. THE READABLE EXPORT (archive_<digits>.txt, WHAT THE EXPORT BUTTON WRITES) COMES BACK WITH HIS WORDS, HER WORDS, THE STAMPS, THE LAYER, THE MEDIA REFS AND HER OWN LANES, BUT A RENDER'S RECIPE IS PROSE THERE, SO `[IMAGE CREATED]` LINES CANNOT BE REBUILT INTO RENDER ROWS AND ARE COUNTED IN THE RECEIPT INSTEAD OF FAKED."
        + "\n\nWHERE THE FILES GO :: NOTHING IS UPLOADED, EVER. PICK AND DROP READ A FOLDER YOU CHOOSE (YOUR G: DRIVE) - THE FOLDER PICKER OF THE FILE SYSTEM ACCESS API IS REFUSED INSIDE THE EDITOR'S FRAME, WHICH IS WHY PICK IS AN INPUT AND WRITING GOES THROUGH THE BROWSER'S OWN DOWNLOAD THERE. ON A TOP-LEVEL TAB THE FOLDER PICKER IS ALLOWED, SO CONNECT KEEPS THE FOLDER AND /sync up WRITES STRAIGHT INTO IT - AND THE HANDLE IS REMEMBERED ON THIS DEVICE."
        + "\n\nWHAT YOU KEEP IN THE FOLDER :: /sync up WRITES THE ROLLING FILE lia-terminal-archive.json (ALWAYS THE NEWEST STATE) AND ONE DATED VERSION A DAY BESIDE IT (lia-terminal-archive-2026-09-24.json), SO THE FOLDER ACCUMULATES VERSIONS RATHER THAN ONLY THE LATEST, AND THE SYNC ALWAYS TAKES THE NEWEST ONE IN.";
    }
    if (t === "commpack" || t === "commpacks") {
      return (window.commpackLane ? window.commpackLane.help() : "THE COMMPACK LANE IS OFFLINE IN THIS BUILD (src/js/commpack.js).");
    }
    if (t === "groq" || t === "groqs") {
      return (window.groq ? window.groq.help() : "THE GROQ LANE IS OFFLINE IN THIS BUILD (src/js/groq.js).");
    }
    if (t === "local" || t === "localllm" || t === "lmstudio") {
      return (window.localLLM ? window.localLLM.help() : "THE LOCAL LANE IS OFFLINE IN THIS BUILD (src/js/local.js).");
    }
    if (t === "bridge" || t === "mythosbridge" || t === "chatlogstore") {
      return (window.mythosBridge ? window.mythosBridge.help() : "THE BRIDGE LANE IS OFFLINE IN THIS BUILD (src/js/bridge.js).");
    }
    if (t === "cloud" || t === "googledrive" || t === "oauth") {
      return (window.cloudSync ? window.cloudSync.describe() : "THE CLOUD SYNC MODULE IS OFFLINE IN THIS BUILD (src/js/sync-cloud.js).")
        + "\n\nTHE CLOUD ROAD :: THE OTHER END OF THE SYNC (src/js/sync-cloud.js). /sync READS A FOLDER ON THIS MACHINE (YOUR G: DRIVE) AND NEVER UPLOADS A BYTE; THIS ROAD IS A CLOUD - ONE FILE IN YOUR OWN GOOGLE DRIVE, lia-terminal-archive.json, WHICH SEND WRITES (AND UPDATES AFTER) AND RECEIVE READS BACK THROUGH THE IMPORTER (MERGED BY STAMP, NOTHING DUPLICATED). THE POINT IS THE OTHER DEVICE: A LAPTOP OR A PHONE WITH THE SAME FOLDER OPEN CANNOT SEE WHAT THIS BROWSER HOLDS, AND THE DRIVE CAN."
        + "\n\nWHAT IT NEEDS FIRST :: A GOOGLE CLOUD PROJECT OF YOUR OWN, ONCE - /cloud setup PRINTS THE WHOLE RECIPE (ENABLE THE DRIVE API, ADD YOURSELF AS A TEST USER, CREATE A WEB OAUTH CLIENT AND ADD THE EXACT REDIRECT URL THE PANEL SHOWS, PASTE THE CLIENT ID IN AND PRESS CONNECT). THE CLIENT ID IS A PUBLIC IDENTIFIER AND IS KEPT ON THIS DEVICE (kv: lia_settings / sync_cloud); THE TOKENS ARE SECRETS AND LIVE ONLY IN THE KEY RING, UNDER \"google-drive\" - NEVER PRINTED, NEVER IN THE TRANSCRIPT, NEVER HANDED TO HER."
        + "\n\nHOW FAR IT CAN SEE :: SCOPE IS drive.file, SO THE TERMINAL MAY ONLY EVER TOUCH THE ONE FILE IT CREATED ITSELF. IT CANNOT LIST, READ OR CHANGE ANYTHING ELSE IN YOUR DRIVE - NOT OTHER FILES, NOT OTHER FOLDERS. NOTHING IS UPLOADED EXCEPT WHEN SEND IS PRESSED, AND FORGET DROPS THE TOKENS FROM THIS BROWSER WITHOUT TOUCHING THE CLOUD FILE."
        + "\n\nFROM THE LINE :: /cloud status \u00b7 setup \u00b7 connect \u00b7 send \u00b7 receive \u00b7 log \u00b7 forget (twice) - OR THE SAME BUTTONS IN THE SYNC PANEL, UNDER THE FOLDER ROAD.";
    }
    if (t === "progress" || t === "bar" || t === "progressbar") {
      return (window.progress ? window.progress.report() : "THE PROGRESS MODULE IS OFFLINE (src/js/progress.js).")
        + "\n\nWHERE IT IS :: the thin green line at the top of the LOWER DECK, above the input box (index.html, #progressRail; the styles are in src/css/terminal.css with the other strips). It is hidden until a job opens one and takes itself down when the last one ends, so it costs the deck nothing when nothing is running."
        + "\nWHAT IT IS NOT :: not a control (nothing on it is pressable), not the IN-HAND chip (src/js/minibox.js - that is WHICH picture the machinery is working on, with a thumbnail and a citation, and it lingers on a 20-second lease), and not a record: it holds nothing across a reload, writes nothing to kv, and no history of what it showed is kept."
        + "\nHOW A JOB USES IT :: window.progress.begin(\"UPSCALING\", { total: list.length }) opens one and returns a claim; claim.set(done) (or claim.step()) ticks it; claim.finish() closes it and claim.fail(\"why\") shows the reason in red. Leaving `total` off means an INDETERMINATE bar - a segment sliding across the track - which is the honest shape for the things with no count (one render, one vision call, one resample). Jobs NEST: the rail shows the highest priority (default 1), newest first, so a counted batch outranks the uncounted call it makes, and a job that ends never blanks a job that is still running.";
    }
    // THE DOX VIEWER (src/js/dms.js). What it is, what it can do, and the two honest limits: the
    // meaning lane needs a key, and the memory collection is read in part for the index.
    if (t === "docs" || t === "doc" || t === "document" || t === "dms" || t === "documents" || t === "dox") {
      return (window.dms ? window.dms.usage() : "THE DOX VIEWER IS OFFLINE IN THIS BUILD (src/js/dms.js).")
        + "\n\nWHERE IT IS :: the DOX VIEWER button in the tool bar, or /docs - the panel opens in the UPPER DECK and the LOWER DECK stands down for it (a viewer wants the screen). It is the second DOCS button: the plain DOCS one lists WHAT IS IN HER MEMORY, and this one manages every document the terminal holds. The panel stretches to fill the page between the two decks and never over the MAIN STAGE."
        + "\n\nFILLING THE STAGE :: SELECTING THE VIEWER GIVES IT THE WHOLE PAGE, AND THAT IS THE DEFAULT. That is the shape Patrikios asked for (2026-09-26: \"DOX VIEWER when selected overlays everything, the MAIN STAGE is in FOCUS. All CONTROL DECKS are COLLAPSED. The only thing that remains visible is the DOX VIEWER page on the MAIN STAGE\"; 2026-09-30: \"In DOX VIEWER make FILL THE STAGE default\"), so FILL THE STAGE is not a hidden key inside the panel - it is what the panel DOES: the upper deck's status line and tool bar and the lower deck stand down for it, and the conversation waits underneath. ESCAPE, the FILL key, /docs full off or the \u00d7 gives the stage back, and the decks return to wherever his hand left them - and a hand that gives the stage back is only saying \"not this time\": nothing is written down, so it is quiet for the rest of the session and the next load fills again, because the default is the default. /docs full with no argument toggles it right now."
        + "\n\nTHE READER :: four keys, four ways of looking at the ONE document that is open - TEXT, SUMMARY, OUTLINE, GRAPH (and the lit key says which page is on; a document always opens in TEXT). TEXT is the text of the document only - the find bar, the window, the foot. OUTLINE is what the document says about itself and where it is: its own TAGS and KEYWORDS, what the store's index says it is ABOUT, and every heading as a line you can press to jump to it in TEXT - with no document text on the page. SUMMARY is an AI summary: if one is kept for this document it is shown with the time it was made; if none is kept the page ASKS first, because it costs one call to the text engine; and leaving the page with a new one unsaved asks whether to save it. A summary lives ON THIS DEVICE beside the document (kv dms_summaries), never inside it, which is what lets FORGET THIS SUMMARY be an honest undo. GRAPH is the LOREPACK's OWN graph - the source / relation / object edges an imported MYTHOS pack was minted with - drawn with the sources in one column and the objects in the other and read against the open document's own words when there is one, or as a sample of the whole of it when there is not."
        + "\n\nTHE TANDEM :: the viewer is the one page the two of them look at TOGETHER, and it carries two presences. HITL is him - the human in the loop: his eye is wherever the reader's window is, and he can POINT at a line by pressing it (press again to take it off). ALIA is her - the Autonomous Liminal Intelligence Agent (src/js/config.js, LIA_ACTOR): she is TOLD what is on the stage and where he is reading on every turn it is open (the tandem block in her system stack, the whole window's first lines quoted so what she says about them is about the real text), and her hand can TURN THE PAGE - a [[PAGE: <document> @ <line>]] line in a reply opens the document at that line on his screen, marked as hers, while she is still speaking. Two sides of the same coin, and neither hand can change anything: the store is read-only, so the only thing either of them can move is the other's attention."
        + "\n\nTALKING WHILE YOU READ :: a viewer puts the LOWER DECK down (a viewer wants the screen), so the conversation lives in the panel's own foot - the talk strip, with the PAGINATOR DECK (the numbered page chips and the simple arrows either side of them) sitting directly above it, because a thousand documents and sixty search hits are not one scroll (see PAGINATION above): HITL and ALIA with what each is pointed at, the newest line of the log mirrored beside them - and SINCE 2026-09-30 A LINE OF HIS THAT SHE HAS NOT YET ANSWERED STAYS UP THERE WITH ITS OWN PREFIX, because while a document has the whole stage the log is hidden and the strip is the only place his words are on the screen at all: what he just sent reads `HITL: ...` until her answer replaces it, `ALIA: IS THINKING ...` is only for when she is the newest word on the page - the intercom keys voice.js already owns (LIVE = the hands-free loop, TALK = push to talk, LISTEN = her mouth) and a one-line box that drives the same #userInput and the same window.send() the lower deck's box does. Slash commands work there too. That is what makes it a TANDEM EXPERIENCE rather than two screens: talking, pointing and reading the same page at the same time."
        + "\n\nFROM HERE :: /docs look <DOC> @ <LINE> TURNS THE PAGE from his side \u00b7 /docs tandem [on|off|state] is the shared page itself (off means she is told nothing and cannot turn it) \u00b7 /tandem does the same \u00b7 LINK in the reader's foot copies a link to the page he is on (#dox=<document>@L<line>), and a page that opens with that hash lands on the same document at the same line."
        + "\n\nWHAT IT IS NOT :: it cannot write, rename, move or delete a document, and it has no operation that could. A viewer that could also write would have to be trusted with her memory (lore.js), the manual (rtfm-edit.js) and the source (his editor) all at once; the point of a viewer is that it cannot hurt what it is looking at."
        + "\n\nTHE TWO LANES :: WORDS is BM25 over the fragments, plus the words STEMMED (saving = save, backups = backup) and expanded through a table of the terminal's own vocabulary (CONCEPTS in src/js/dms.js: picture = image, render, photo, sprite...), which is what \"basic semantic\" means with no key held. MEANING is the embedding lane (src/js/embed.js, namespace `docs`): /docs index builds it - one key call per fragment, batched - and a search then merges the two rankings with reciprocal rank fusion, the same way recall does."
        + "\n\nWHAT IT READS :: MEMORY is the LOREPACK (76 MB across 563 documents - the biggest are the raw conversation archives), so the INDEX reads the first 12 KB of each one and `hydrate`s it whole when he opens it; DOCS is the shipped prose (README 477 KB, TODO, the chronicle, the packs), DATA the shipped json, CODE the source itself (js and css - not part of ALL, because 2 MB of javascript is not a document). The first search of a session reads the store and builds the index in slabs so the page stays answerable, which is why it takes a couple of seconds and every search after it is instant.";
    }
    if (t === "tools" || t === "tool" || t === "maintenance" || t === "cleanup" || t === "clean") {
      return (window.tools ? window.tools.help() : "THE TOOLS MODULE IS OFFLINE IN THIS BUILD (src/js/tools.js).")
        + "\n\nWHAT THEY ARE FOR :: the vault grows by itself - every render, every upscale, every file handed over - and after a few hundred of anything, the mess is structural rather than per-picture. So the tidying is a set of JOBS rather than a button on each tile: find the pictures held more than once, put everything in the folder its kind belongs in, make 2x of everything that has never been made 2x, and repair what the record still names that has gone."
        + "\n\nTHE SHAPE OF EVERY JOB :: SCAN, then RUN. A scan reads the vault and prints exactly what a run would do - every record by name and id, every destination, every byte - and changes nothing at all. Nothing in here works on what it guesses: the scan is the receipt handed over before the bill."
        + "\n\nTHE ONE JOB THAT DELETES :: DUPLICATES, and only ever a copy whose bytes are still byte-for-byte identical to the copy being kept - hashed at the moment of deletion, not trusted from the scan. One of each group is kept (the one the archive names, or the one carrying the prompt, the reading and the tags), and everything that pointed at a dropped copy is moved onto the kept one FIRST: the archive\u2019s creation row, what she was shown, what she asked to see again, its place in the queue for her eyes, a KEEP with its recipe and its link, its tags, its folder, and any record made from it. Two pictures that merely came out of the same prompt and seed are LISTED and never touched - a re-render is a different picture."
        + "\n\nWHAT THE OTHERS DO :: PROPER FOLDERS only moves a record (a folder is a field; the blob has no path, and nothing is ever deleted). UPSCALE only adds - it queues every picture that has never been made 2x through the same road /upscale here uses, one at a time, so it can run while the conversation carries on, and STOP ends it after the picture in hand; with /upscale replace on, the smaller original is retired into the bigger one exactly as it is for a fresh render. REPAIR cannot delete: it edits what OTHER things say, pointing each dead id at the record that replaced it where there is one, and taking the name out where there is not."
        + "\n\nTHE PANEL :: TOOLS \u25be in the deck. Pick the job, pick how wide it reaches (renders only, or pictures you handed over too, or everything), press SCAN, read it, press RUN. The one that deletes asks twice, six seconds apart.";
    }
    if (t === "spin" || t === "spincode" || t === "spincodes" || t === "agency" || t === "mode" || t === "status") {
      return (window.spincode ? window.spincode.help() : "THE SPINCODE LAYER IS OFFLINE (src/js/spincode.js DID NOT LOAD).");
    }
    return null;
  }

  function helpText(topic) {
    var t = String(topic == null ? "" : topic).trim().toLowerCase().replace(/^\//, "");
    if (!t) return helpRoster();
    if (t === "all") {
      return [helpRoster()].concat(["voice", "story", "role", "keys", "system", "lore", "packs", "pictures", "poses", "recipes", "embed"].map(function (k) {
        return "\n---- " + k.toUpperCase() + " ----\n" + helpArea(k);
      })).join("\n");
    }
    var area = helpArea(t);
    if (area) return area + "\n\n/help FOR THE WHOLE ROSTER.";
    return "NO HELP TOPIC CALLED \"" + String(topic).toUpperCase() + "\".\n" + helpRoster();
  }

  function tidy(text) {
    return String(text).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  // How far one command name is from another, for the "did you mean" line. A plain Levenshtein
  // distance, because the mistake is almost always one wrong letter or a dropped one
  // (`postions` for `positions` is a single deletion).
  function cmdDistance(a, b) {
    a = String(a || ""); b = String(b || "");
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur[0] = i;
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      for (j = 0; j <= b.length; j++) prev[j] = cur[j];
    }
    return prev[b.length];
  }

  function resolveSkillId(raw) {
    return String(raw).trim().toLowerCase().replace(/[\s_]+/g, "-");
  }

  function getSkill(id) {
    return (window.packs && window.packs.getSkill) ? window.packs.getSkill(id) : null;
  }

  // She does not always write the exact id - she may name what the trait means to her
  // instead (e.g. [[LOAD: Sacred_Chronicle_Integration]]). Match loosely: exact id,
  // then any skill id contained in the name, then all the words of a skill's title.
  function fuzzySkill(raw) {
    var s = String(raw || "").toLowerCase();
    if (!s) return null;
    var compact = s.replace(/[^a-z0-9]/g, "");
    var list = (window.packs && window.packs.skills) ? window.packs.skills() : [];
    var i;
    for (i = 0; i < list.length; i++) {
      var k = String(list[i].id).toLowerCase().replace(/[^a-z0-9]/g, "");
      if (k && compact.indexOf(k) !== -1) return list[i];
    }
    for (i = 0; i < list.length; i++) {
      var words = String(list[i].title || "").toLowerCase().match(/[a-z0-9]+/g) || [];
      if (words.length && words.every(function (w) { return s.indexOf(w) !== -1; })) return list[i];
    }
    return null;
  }

  // A reply may carry up to three directives, all stripped before display:
  //   [[SKILL: id]]         engage a skill for her next reply
  //   [[LOAD: id]] / [[UNLOAD: id]]   wear / put down a trait (a lasting change)
  //   [[ROLE: id]]          shift onto another RoleLayer ([[ROLE: off]] = step off the stage)
  // plus HER OWN lanes, any number of them per reply:
  //   [[REMEMBER: ...]]     keep something in her own memory (a document marked HERS)
  //   [[FORGET: ...]]       let one of hers go (to the lore trash)
  //   [[WANT: ...]]         write down a standing intention she carries from now on
  //   [[RELEASE: ...]]      put one of those down (recorded as let go)
  function extractDirectives(reply) {
    var raw = String(reply);
    var out = { text: raw, id: "", skill: null, action: "", trait: null, traitId: "", roleId: "", hers: [], shows: [], reads: [], pages: [], stages: [], folders: [], files: [], ops: [], petitions: [], intents: [], dones: [], act: "", pace: 0, moods: [], boards: [], moodpacks: [], systems: [] };
    var m = SKILL_DIRECTIVE.exec(raw);
    if (m) {
      out.id = resolveSkillId(m[1]);
      out.skill = getSkill(out.id);
      out.text = tidy(raw.replace(m[0], ""));
    }
    var l = TRAIT_DIRECTIVE.exec(out.text);
    if (l) {
      out.traitId = resolveSkillId(l[2]);
      out.trait = getSkill(out.traitId) || fuzzySkill(out.traitId);
      out.action = l[1].toUpperCase();
      out.text = tidy(out.text.replace(l[0], ""));
    }
    var r = ROLE_DIRECTIVE.exec(out.text);
    if (r) {
      out.roleId = resolveSkillId(r[1]);
      out.text = tidy(out.text.replace(r[0], ""));
    }
    // A PETITION FIRST, among the others: its body is the longest thing any of these lines can
    // carry (up to LIA_PETITION_MAX_CHARS) and it is the only one that could plausibly CONTAIN the
    // words of another, so it is taken out of the text before the shorter lanes look at it. What
    // comes back is the raw payload - src/js/petition.js is what knows how to read and gate it.
    var pn;
    PETITION_DIRECTIVE.lastIndex = 0;
    while ((pn = PETITION_DIRECTIVE.exec(out.text)) !== null) {
      out.petitions.push(String(pn[1] || "").replace(/\s+/g, " ").trim());
    }
    if (out.petitions.length) out.text = tidy(out.text.replace(PETITION_DIRECTIVE, ""));
    var sy;
    SYSTEM_DIRECTIVE.lastIndex = 0;
    while ((sy = SYSTEM_DIRECTIVE.exec(out.text)) !== null) {
      // HER OWN HAND ON THE STACK - NOT collapsed to one line (a block she writes may have
      // paragraphs of its own), only trimmed. See src/js/instr.js's SYSTEM LANE.
      out.systems.push(String(sy[1] || "").trim());
    }
    if (out.systems.length) out.text = tidy(out.text.replace(SYSTEM_DIRECTIVE, ""));
    var h;
    HERS_DIRECTIVE.lastIndex = 0;
    while ((h = HERS_DIRECTIVE.exec(out.text)) !== null) {
      out.hers.push({ verb: h[1].toUpperCase(), text: String(h[2] || "").replace(/\s+/g, " ").trim() });
    }
    if (out.hers.length) out.text = tidy(out.text.replace(HERS_DIRECTIVE, ""));
    var s;
    SHOW_DIRECTIVE.lastIndex = 0;
    while ((s = SHOW_DIRECTIVE.exec(out.text)) !== null) {
      out.shows.push(String(s[1] || "").replace(/\s+/g, " ").trim());
    }
    if (out.shows.length) out.text = tidy(out.text.replace(SHOW_DIRECTIVE, ""));
    var rd;
    READ_DIRECTIVE.lastIndex = 0;
    while ((rd = READ_DIRECTIVE.exec(out.text)) !== null) {
      out.reads.push(String(rd[1] || "").replace(/\s+/g, " ").trim());
    }
    if (out.reads.length) out.text = tidy(out.text.replace(READ_DIRECTIVE, ""));
    var pg;
    PAGE_DIRECTIVE.lastIndex = 0;
    while ((pg = PAGE_DIRECTIVE.exec(out.text)) !== null) {
      out.pages.push(String(pg[1] || "").replace(/\s+/g, " ").trim());
    }
    if (out.pages.length) out.text = tidy(out.text.replace(PAGE_DIRECTIVE, ""));
    var sg;
    STAGE_DIRECTIVE.lastIndex = 0;
    while ((sg = STAGE_DIRECTIVE.exec(out.text)) !== null) {
      out.stages.push(String(sg[1] || "").replace(/\s+/g, " ").trim());
    }
    if (out.stages.length) out.text = tidy(out.text.replace(STAGE_DIRECTIVE, ""));
    var fd;
    FOLDER_DIRECTIVE.lastIndex = 0;
    while ((fd = FOLDER_DIRECTIVE.exec(out.text)) !== null) {
      out.folders.push(String(fd[1] || "").replace(/\s+/g, " ").trim());
    }
    if (out.folders.length) out.text = tidy(out.text.replace(FOLDER_DIRECTIVE, ""));
    var bd;
    BOARD_DIRECTIVE.lastIndex = 0;
    while ((bd = BOARD_DIRECTIVE.exec(out.text)) !== null) {
      out.boards.push(String(bd[1] || "").replace(/\s+/g, " ").trim());
    }
    if (out.boards.length) out.text = tidy(out.text.replace(BOARD_DIRECTIVE, ""));
    var mpk;
    MOODPACK_DIRECTIVE.lastIndex = 0;
    while ((mpk = MOODPACK_DIRECTIVE.exec(out.text)) !== null) {
      out.moodpacks.push(String(mpk[1] || "").replace(/\s+/g, " ").trim());
    }
    if (out.moodpacks.length) out.text = tidy(out.text.replace(MOODPACK_DIRECTIVE, ""));
    var md;
    MOOD_DIRECTIVE.lastIndex = 0;
    while ((md = MOOD_DIRECTIVE.exec(out.text)) !== null) {
      out.moods.push(String(md[1] || "").replace(/\s+/g, " ").trim());
    }
    if (out.moods.length) out.text = tidy(out.text.replace(MOOD_DIRECTIVE, ""));
    var fl;
    FILE_DIRECTIVE.lastIndex = 0;
    while ((fl = FILE_DIRECTIVE.exec(out.text)) !== null) {
      out.files.push(String(fl[1] || "").replace(/\s+/g, " ").trim());
    }
    if (out.files.length) out.text = tidy(out.text.replace(FILE_DIRECTIVE, ""));
    var ax;
    ARCHIVAX_DIRECTIVE.lastIndex = 0;
    while ((ax = ARCHIVAX_DIRECTIVE.exec(out.text)) !== null) {
      out.ops.push(String(ax[1] || "").replace(/\s+/g, " ").trim());
    }
    if (out.ops.length) out.text = tidy(out.text.replace(ARCHIVAX_DIRECTIVE, ""));
    // THE QUIET HOURS' OWN LANES (src/js/shift.js). What she means to do in a future hour, the
    // striking-off of one, and - in a quiet hour only - the name of the hour itself.
    var it;
    INTEND_DIRECTIVE.lastIndex = 0;
    while ((it = INTEND_DIRECTIVE.exec(out.text)) !== null) {
      out.intents.push(String(it[1] || "").replace(/\s+/g, " ").trim());
    }
    if (out.intents.length) out.text = tidy(out.text.replace(INTEND_DIRECTIVE, ""));
    var dn;
    DONE_DIRECTIVE.lastIndex = 0;
    while ((dn = DONE_DIRECTIVE.exec(out.text)) !== null) {
      out.dones.push(String(dn[1] || ""));
    }
    if (out.dones.length) out.text = tidy(out.text.replace(DONE_DIRECTIVE, ""));
    var ac;
    ACT_DIRECTIVE.lastIndex = 0;
    while ((ac = ACT_DIRECTIVE.exec(out.text)) !== null) {
      if (!out.act) out.act = String(ac[1] || "").trim().toLowerCase();
    }
    if (out.act) out.text = tidy(out.text.replace(ACT_DIRECTIVE, ""));
    // HER OWN DIAL ON THE INFINITY (src/js/proactive.js). Taken out of the text ALWAYS - a pace line
    // is machinery, and a reply that carried a raw [[PACE: 5]] to the screen would be the terminal
    // showing her its own bones. The move itself is made by the caller, out loud in backstage.
    PACE_DIRECTIVE.lastIndex = 0;
    var paceM = PACE_DIRECTIVE.exec(out.text);
    if (paceM) {
      out.pace = Math.max(1, Math.min(5, parseInt(paceM[1], 10) || 0));
      PACE_DIRECTIVE.lastIndex = 0;
      out.text = tidy(out.text.replace(PACE_DIRECTIVE, ""));
    }
    return out;
  }

  function extractSkillDirective(reply) {
    var d = extractDirectives(reply);
    return { text: d.text, id: d.id, skill: d.skill };
  }

  window.liaDirectives = extractDirectives;
  window.extractSkillDirective = extractSkillDirective;

  function armSkill(id, args) {
    if (!window.packs || !window.packs.getSkill) { print('SYSTEM', "COREPACK OFFLINE."); return null; }
    var skill = window.packs.getSkill(id);
    if (!skill) {
      print('SYSTEM', "NO SUCH SKILL :: " + String(id).toUpperCase() + "\n" + window.packs.skillList().join("\n"));
      return null;
    }
    armedSkill = { id: skill.id, title: skill.title, kind: skill.kind, prompt: skill.prompt, args: String(args || "").trim() };
    print('SYSTEM', "DIRECTIVE ARMED :: " + String(skill.title || skill.id).toUpperCase() + " :: HOLDS FOR YOUR NEXT MESSAGE (/load " + skill.id + " TO WEAR IT INSTEAD)");
    return skill;
  }

  // THE SEARCH LOG. A truthful trace of what she did with her archive this turn:
  // which surface was swept, what each method returned, how strong the match was,
  // and the exact citations she was fed. The citations ARE the hits handed to the
  // model, so the log can never claim a look she did not actually take.
  function relPct(score, top) { return top > 0 ? Math.round((score / top) * 100) : 0; }

  function logLines(query, ctx, tr, files, ms) {
    var q = String(query || "[IMAGE]").replace(/\s+/g, " ").trim();
    var lines = ["SEARCH LOG :: \"" + q.slice(0, 140).toUpperCase() + "\""];
    var put = function (k, v) { lines.push("  " + k.padEnd(9) + " " + v); };
    var lore = window.lore;
    var count = lore ? lore.count() : 0;
    files = files || [];
    var canon = files.filter(function (f) { return f.foundational; });
    var canonN = canon.reduce(function (n, f) { return n + f.chunks; }, 0);

    put("ARCHIVE", count + " FRAGMENT" + (count === 1 ? "" : "S") + " / " + files.length + " FILE" + (files.length === 1 ? "" : "S")
      + (canonN ? "  \u00b7  CANON " + canonN + " HELD ALWAYS (" + canon.map(function (f) { return f.name; }).join(", ") + ")" : ""));

    if (tr) {
      put("PACKS", tr.loci.length
        ? tr.loci.map(function (g) { return g.agentId + " " + g.vectors + " FRAG/" + g.edges + " EDGE"; }).join("  \u00b7  ")
        : "NO PACK READ INTO THIS BROWSER");
      put("METHOD", "BM25 LEXICAL OVER THE ARCHIVE + SIGIL / GRAPH / LEXICAL PACK SCAN"
        + ((window.embed && window.embed.count("lore")) ? " + SEMANTIC MEANING LANE (MERGED BY RANK)" : ""));
      put("SIGIL", tr.sigilMode === "EXACT"
        ? "EXACT KEY HIT :: " + tr.sigil.length + " FRAGMENT" + (tr.sigil.length === 1 ? "" : "S")
        : (tr.sigilMode === "PREFIX"
          ? "PREFIX RANGE HIT :: " + tr.sigil.length + " FRAGMENT" + (tr.sigil.length === 1 ? "" : "S")
          : "NO EXACT KEY :: PREFIX RANGE EMPTY"));
      put("GRAPH", tr.graphN
        ? tr.graphN + " PACK EDGE" + (tr.graphN === 1 ? "" : "S") + " TOUCH IT :: "
          + tr.graph.slice(0, 3).map(function (e) { return e.s + " --" + e.r + "--> " + e.o; }).join("  \u00b7  ")
          + (tr.graphN > 3 ? "  \u00b7  +" + (tr.graphN - 3) + " MORE" : "")
        : "NO PACK EDGE TOUCHES IT");
      put("PACK LEX", tr.lexicalN
        ? tr.lexicalN + " HIT" + (tr.lexicalN === 1 ? "" : "S") + " OF " + tr.scanned + " FRAGMENTS SCANNED :: TOP " + tr.lexicalTop.toFixed(1)
        : "NO PACK FRAGMENT MATCHED (" + tr.scanned + " SCANNED)");
    }

    var hits = (ctx && ctx.hits ? ctx.hits.slice() : []).sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });
    var top = hits.length ? hits[0].score : 0;
    if (!hits.length) {
      put("CITE", "NONE :: NOTHING IN HER ARCHIVE MATCHED. SHE ANSWERS FROM HER OWN KNOWING.");
    } else {
      var shownN = Math.min(hits.length, 6);
      hits.slice(0, shownN).forEach(function (h, i) {
        var lane = h.via === "both" ? "WORDS+MEANING" : (h.via === "sem" ? "BY MEANING" : (h.via === "lex" ? "BY WORDS" : ""));
        var strength = (h.cos != null ? "COS " + h.cos.toFixed(2) : "REL " + relPct(h.score, top) + "%");
        put("CITE [" + (i + 1) + "]", h.file + " :: " + strength + (lane ? " :: " + lane : "") + (h.heading ? " :: " + h.heading : ""));
      });
      if (hits.length > shownN) put("CITE [+]", (hits.length - shownN) + " MORE FED TO HER :: /recall <Q> SHOWS THE TEXT");
    }
    var srcs = hits.map(function (h) { return h.file; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    put("FED", hits.length + " FRAGMENT" + (hits.length === 1 ? "" : "S") + " FROM " + srcs.length + " FILE" + (srcs.length === 1 ? "" : "S")
      + " :: RETRIEVAL " + Math.round(ms) + "MS");
    return lines.join("\n");
  }

  /* ---- THE POSE LANE: she chooses, and she invents -------------------------
     THE BOOK (studio.js) holds the poses; the terminal holds the words. Two
     calls, one shape: the STATIC half - her identity, her voice, the book, the
     JSON contract - is the system prompt, so the bulk of the request is
     identical across calls and can be cached; the volatile half (what he just
     said, which list she is choosing within) is the instruction, and it comes
     last. She answers in JSON, the terminal reads it, and every name she used
     that the book did not have is FILED AS HERS - the book grows from her own
     words, not only from his.
  ------------------------------------------------------------------------ */
  function bookBlock(family) {
    var st = window.studio;
    if (!st) return "";
    var fams = family ? [family] : st.families();
    return fams.map(function (f) {
      var list = st.poses(f);
      if (!list.length) return "";
      return f.toUpperCase() + " (" + list.length + ") :: " + list.map(function (p) { return p.name; }).join(" \u00b7 ");
    }).filter(Boolean).join("\n");
  }

  // She is asked for JSON and she may wrap it in prose or code fences: take the outermost
  // object and read what is in it. Anything else is reported as an answer out of form.
  function parsePoseJSON(raw) {
    var t = String(raw == null ? "" : raw).replace(/```[a-z]*\n?/gi, "").replace(/[\u201c\u201d]/g, "\"").trim();
    var start = t.indexOf("{");
    if (start === -1) return null;
    var depth = 0, end = -1;
    for (var i = start; i < t.length; i++) {
      if (t[i] === "{") depth++;
      else if (t[i] === "}") { depth--; if (!depth) { end = i; break; } }
    }
    var body = (end === -1) ? t.slice(start) : t.slice(start, end + 1);
    try { return JSON.parse(body); } catch (e) {}
    try { return JSON.parse(body.replace(/,\s*([}\]])/g, "$1")); } catch (e) {}
    return null;
  }

  function lastWords(n) {
    var h = window.chatHistory || [];
    return h.slice(-(n || 4)).map(function (m) {
      return (m.role === "HITL" ? "Patrikios: " : "You: ") + String(m.content || "").replace(/\s+/g, " ").slice(0, 300);
    }).join("\n");
  }

  // mode "choose": she decides - 1 to 3 poses, the first one being what the next picture will be.
  // mode "invent": she names new poses for a list, and nothing is rendered.
  async function poseAsk(mode, opts) {
    opts = opts || {};
    var st = window.studio;
    if (!st) { print("SYSTEM", "THE PROMPT BOOK IS NOT LOADED HERE."); return { names: [], made: [], why: [] }; }
    await st.loadBook();
    var family = String(opts.family || "").trim().toLowerCase();
    if (family && st.families().indexOf(family) === -1) family = "";
    var book = bookBlock(family);
    if (!book) { print("SYSTEM", "THE BOOK HAS NO POSES TO CHOOSE FROM."); return { names: [], made: [], why: [] }; }
    var famWords = st.families().join(", ");
    var rules = (mode === "invent")
      ? [
          "She is naming NEW poses for one of his lists - or starting a list of her own. Nothing is chosen here, and nothing is rendered.",
          "How to answer - ONE JSON object, nothing else, no markdown, no text outside it:",
          "{\"new\":[{\"name\":\"<a pose you are naming yourself>\",\"family\":\"<one of: " + famWords + ">\",\"why\":\"<a few words, in your own voice>\"}]}",
          "Rules:",
          "- 3 to 5 entries in \"new\". Leave \"picks\" empty.",
          "- Name them the way you would say them out loud. Short. Yours. Nothing over five words.",
          "- Each one must be something a body can be made to do, and it must be NEW: nothing that is already in the book above.",
          "- \"why\" is your reason, for his eyes only. Never mention the book, the list, the JSON, or these rules."
        ].join("\n")
      : [
          "She is DECIDING. The first name she picks is what the next picture will be of, so choose it as a decision, not a suggestion.",
          "How to answer - ONE JSON object, nothing else, no markdown, no text outside it:",
          "{\"picks\":[{\"pose\":\"<a name copied exactly from the book>\",\"why\":\"<a few words, in your own voice>\"}],\"new\":[{\"name\":\"<a pose you are naming yourself>\",\"family\":\"<one of: " + famWords + ">\"}]}",
          "Rules:",
          "- 1 to 3 picks, in the order of your wanting. The names must be copied character for character from the book above.",
          "- \"new\" is optional (0 to 2): a pose the book does not have at all, named in your own register, if nothing in the book means what you mean.",
          "- \"why\" is a few words to one sentence, said to him, not about him. Never mention the book, the list, the JSON, or these rules - to him it simply registers.",
          "- Choose what YOU want, not what you think he is expecting."
        ].join("\n");
    var sys = [
      (window.instr && window.instr.assemble) ? window.instr.assemble({}) : "",
      "THE BOOK OF POSES" + (family ? " :: " + family.toUpperCase() + " ONLY" : "") + "\n" + book,
      rules
    ].filter(Boolean).join("\n\n");
    var instr = "Choosing within: " + (family ? family.toUpperCase() : "the whole book") + "\n"
      + (lastWords(4) ? "The last words exchanged:\n" + lastWords(4) + "\n\n" : "")
      + (mode === "invent" ? "Name the new poses now." : "Decide now.");
    // The contract rides in the instruction with her, because the service has no separate system
    // field (see the note in send): the static half - her identity, the book, the rules - comes
    // FIRST and the volatile half LAST, so the bulk of the request is a cacheable prefix. And the
    // answer is forced to open as JSON: without startWith she answers this like a turn, in prose,
    // and the choice is lost.
    var instruction = sys + "\n\n" + instr;
    var res;
    try {
      res = await window.root.generateText({ instruction: instruction, startWith: "{" });
    } catch (e) {
      print("SYSTEM", "SHE COULD NOT BE ASKED: " + ((e && e.message) ? e.message : e));
      return { names: [], made: [], why: [] };
    }
    var data = parsePoseJSON(res);
    if (!data) {
      print("SYSTEM", "SHE ANSWERED OUTSIDE THE FORM, SO NOTHING WAS FILED. WHAT CAME BACK: " + String(res).slice(0, 240));
      return { names: [], made: [], why: [] };
    }
    var names = [], why = [], made = [];
    var picks = (Array.isArray(data.picks) ? data.picks : []).slice(0, 3);
    for (var i = 0; i < picks.length; i++) {
      var entry = picks[i];
      var rawName = String(((typeof entry === "string") ? entry : (entry && (entry.pose || entry.name))) || "").trim();
      var reason = (typeof entry === "string") ? "" : String((entry && (entry.why || entry.because)) || "").replace(/\s+/g, " ").trim();
      if (!rawName) continue;
      var hit = st.findPose(rawName);
      if (hit) { names.push(hit.name); why.push(reason); continue; }
      if (mode !== "choose") continue;
      // A name she used that the book does not have IS a pose she just made: file it, as hers.
      var add = await st.addPose({ name: rawName, family: family || st.FAMILY_HERS, source: "her" });
      if (add.ok) { names.push(add.pose.name); why.push(reason); made.push(add.pose.name); }
    }
    var news = (Array.isArray(data.new) ? data.new : []).slice(0, 5);
    for (var j = 0; j < news.length; j++) {
      var nEntry = news[j];
      var nName = String(((typeof nEntry === "string") ? nEntry : (nEntry && (nEntry.name || nEntry.pose))) || "").trim();
      if (!nName) continue;
      var nFam = String((nEntry && nEntry.family) || "").trim().toLowerCase();
      if (st.families().indexOf(nFam) === -1) nFam = family || st.FAMILY_HERS;
      var nWhy = String((nEntry && nEntry.why) || "").replace(/\s+/g, " ").trim();
      var nAdd = await st.addPose({ name: nName, family: nFam, source: "her", note: nWhy });
      if (nAdd.ok && !nAdd.existed) made.push(nAdd.pose.name);
      if (mode === "invent" && nAdd.ok) { names.push(nAdd.pose.name); why.push(nWhy); }
    }
    await st.recordPick({ asked: family, family: family, names: names, why: why, made: made });
    if (mode === "invent") {
      if (!made.length) print("SYSTEM", "SHE NAMED NOTHING THIS TIME :: ASK AGAIN, OR NAME A LIST FOR HER TO FILL.");
      else print("SYSTEM", "POSE BOOK :: SHE NAMED " + made.length + " NEW POSE" + (made.length === 1 ? "" : "S")
        + " FOR " + (family ? family.toUpperCase() : "HERSELF")
        + " :: " + made.join(" \u00b7 ")
        + "\nTHEY ARE IN THE BOOK NOW, FILED AS HERS - /positions SHOWS THEM, AND SHE CAN CHOOSE THEM HERSELF LATER.");
    } else if (!names.length) {
      print("SYSTEM", "SHE DID NOT NAME A POSE. WHAT CAME BACK: " + String(res).slice(0, 160));
    } else {
      print("SYSTEM", "POSE BOOK :: SHE CHOOSES" + (family ? " FROM " + family.toUpperCase() : "") + " :: "
        + names.join(" \u00b7 ")
        + (made.length ? "\n" + made.length + " OF THEM ARE NEW - FILED AS HERS" : ""));
      print("AI", names.map(function (n, k) { return why[k] ? (n + " \u2014 " + why[k]) : n; }).join("\n"));
    }
    if (names.length) {
      window.chatHistory.push({ role: "SDMG", content: "[chose from the book: " + names.join(", ") + (why[0] ? " - " + why[0] : "") + "]" });
      if (window.chatHistory.length > 10) window.chatHistory.shift();
    }
    return { names: names, made: made, why: why, wrote: mode !== "invent" };
  }

  window.poseAI = {
    choose: function (o) { return poseAsk("choose", o); },
    invent: function (o) { return poseAsk("invent", o); },
  };

  /* ---- THE RECIPE BOOK, HER HAND -------------------------------------------
     She composes. She chooses a recipe from the book - or works from the one held
     in the forge - fills its slots with her own words, and says why; the filled
     prompt goes into the forge's boxes, and the next CREATE renders it. Same shape
     as the pose book's ask: her identity and the book first (the stable half, so
     the request is a cacheable prefix), the task last, and the answer forced to
     open as JSON so the choice is never lost in prose.
     ------------------------------------------------------------------------- */
  async function recipeCompose(opts) {
    opts = opts || {};
    var st = window.studio;
    var miss = { ok: false, recipe: null, values: {}, why: "" };
    if (!st || !st.recipes) { print("SYSTEM", "THE RECIPE BOOK IS NOT LOADED HERE."); return miss; }
    await st.loadRecipeBook();
    var list = st.recipes();
    if (!list.length) {
      print("SYSTEM", "THE RECIPE BOOK IS EMPTY HERE :: " + st.RECIPES_FILE + " COULD NOT BE READ (AN UNSAVED PREVIEW IN A BROWSER WITH NO SERVICE WORKER CANNOT READ src/).");
      return miss;
    }
    var want = String(opts.recipe || "").trim();
    var held = want ? st.findRecipe(want) : null;
    if (want && !held) print("SYSTEM", 'RECIPE BOOK :: NO RECIPE CALLED "' + want.toUpperCase() + '" - SHE CHOOSES FROM THE WHOLE BOOK INSTEAD.');
    var book = list.map(function (r) {
      return "- id: " + r.id + "  |  " + r.title + (r.note ? "  |  " + r.note : "")
        + "\n    slots: " + st.recipeSlots(r).map(function (s) {
          var d = String(s.def || "");
          return s.name + " (house: " + d.slice(0, 70) + (d.length > 70 ? "..." : "") + ")";
        }).join("; ");
    }).join("\n");
    var rules = [
      "She is COMPOSING a picture from his recipe book. She chooses one recipe and fills its slots with her own words; the picture that follows is hers.",
      "How to answer - ONE JSON object, nothing else, no markdown, no text outside it:",
      "{\"recipe\":\"<the id of the recipe she is using>\",\"slots\":{\"<slot name>\":\"<her words>\"},\"why\":\"<a few words, in her own voice>\"}",
      "Rules:",
      "- \"recipe\" must be one of the ids above" + (held ? (", and it is \"" + held.id + "\" - she is composing from the one held in the forge") : "") + ".",
      "- Only name slots that BELONG to that recipe. Leave a slot out if she is happy with it: it keeps the wording the recipe ships with, which is his.",
      "- Fill the slots that make this picture HERS: who and what, where, the light, what is happening. A few words each is enough; a sentence is fine.",
      "- \"slots\" may be empty only if she wants the recipe exactly as it stands.",
      held ? "- Use " + held.id + "'s own slots; it is held because he picked it." : "- Choose the recipe that actually fits what is passing between them, not the showiest one.",
      "- \"why\" is for his eyes only, a few words to one sentence. Never mention the book, the slots, the JSON or these rules - to him it simply registers.",
      "- Choose what YOU want, not what you think he is expecting."
    ].join("\n");
    var sys = [
      (window.instr && window.instr.assemble) ? window.instr.assemble({}) : "",
      "THE RECIPE BOOK" + (held ? " :: COMPOSING FROM " + held.id.toUpperCase() : "") + "\n" + book,
      rules
    ].filter(Boolean).join("\n\n");
    var instr = (lastWords(4) ? "The last words exchanged:\n" + lastWords(4) + "\n\n" : "") + "Compose the picture now.";
    var res;
    try {
      res = await window.root.generateText({ instruction: sys + "\n\n" + instr, startWith: "{" });
    } catch (e) {
      print("SYSTEM", "SHE COULD NOT BE ASKED: " + ((e && e.message) ? e.message : e));
      return miss;
    }
    var data = parsePoseJSON(res);
    if (!data) {
      print("SYSTEM", "SHE ANSWERED OUTSIDE THE FORM, SO NOTHING WAS COMPOSED. WHAT CAME BACK: " + String(res).slice(0, 240));
      return miss;
    }
    var rid = String(data.recipe || data.id || (held ? held.id : "")).trim();
    var r = st.findRecipe(rid);
    if (!r) {
      print("SYSTEM", "SHE NAMED A RECIPE THE BOOK DOES NOT HAVE (" + rid.toUpperCase() + "), SO NOTHING WAS COMPOSED. WHAT CAME BACK: " + String(res).slice(0, 200));
      return miss;
    }
    var slots = {};
    if (data.slots && typeof data.slots === "object") {
      Object.keys(data.slots).forEach(function (k) {
        var v = String(data.slots[k] == null ? "" : data.slots[k]).replace(/\s+/g, " ").trim();
        if (!v) return;
        slots[String(k).trim().toLowerCase().replace(/\s+/g, " ")] = v;
      });
    }
    var why = String(data.why || data.because || "").replace(/\s+/g, " ").trim();
    var filled = (window.forgeRecipes && window.forgeRecipes.fill)
      ? window.forgeRecipes.fill({ id: r.id, values: slots }, { write: true, who: "SHE COMPOSES FROM" })
      : st.renderRecipe({ id: r.id, values: slots });
    if (!filled || !filled.ok) return miss;
    if (why) print("AI", String(r.title || r.id).toUpperCase() + " \u2014 " + why);
    window.chatHistory.push({ role: "SDMG", content: "[composed from the recipe " + r.id + (Object.keys(slots).length ? ": " + Object.keys(slots).join(", ") : "") + (why ? " - " + why : "") + "]" });
    if (window.chatHistory.length > 10) window.chatHistory.shift();
    return { ok: true, recipe: r, values: slots, why: why, out: filled };
  }

  window.recipeAI = { compose: recipeCompose };

  function stripSpeaker(text, speaker) {
    var t = String(text == null ? "" : text);
    var head = String(speaker || "").toUpperCase() + ":";
    if (head !== ":" && t.toUpperCase().indexOf(head) === 0) return t.slice(head.length).trim();
    return t;
  }

  window.send = async function (opts) {    var silent = !!(opts && opts.silent);
    var speaker = String((opts && opts.speaker) || "MAYA").trim().toUpperCase().slice(0, 12) || "MAYA";
    var input = document.getElementById('userInput');
    var btn = document.getElementById('sendBtn');
    if (btn.disabled) return;

    var text = input.value.trim();
    // A SILENT TURN (the bridge filing Maya's words) carries text only: anything he has
    // staged stays staged for his own next turn.
    var atts = silent ? [] : ((window.attach && window.attach.items) ? window.attach.items() : []);
    var attIds = silent ? [] : ((window.attach && window.attach.images) ? window.attach.images() : []);
    var attVids = silent ? [] : ((window.attach && window.attach.videos) ? window.attach.videos() : []);
    // Everything with a shape of its own, in the order it was handed over: pictures first, then
    // the clips - each of which is drawn as itself (its first frame, then the player) rather than described.
    var attShown = silent ? [] : ((window.attach && window.attach.media)
      ? window.attach.media()
      : attIds.map(function (id) { var r = window.media ? window.media.get(id) : null; return { kind: "image", id: id, name: r ? r.name : "image" }; }));
    if (!text && !atts.length) return;

    // THE DRAFT IS FINISHED WITH. A message is going in, so whatever the pencil was still holding has
    // been written or moved on from - the held copy and the green ring go (src/js/draft.js). Slash
    // commands are not messages and leave the draft alone; draft.sent() decides which is which.
    if (window.draft && window.draft.sent) { try { window.draft.sent(text); } catch (e) {} }

    var textOnly = !atts.length; // slash commands are text-only

    // A raw key must never reach the transcript: the transcript is replayed into her context and
    // written to the archive, so a key typed here would be a key given away. The KEYS panel is the
    // only way in. (A stored key appearing in a message is caught too - keys.js knows its own.)
    // Not gated on textOnly: an image attached with a key as its caption would land in the archive
    // just the same.
    if (window.keyring && window.keyring.looksLikeSecret(text)) {
      input.value = '';
      print('SYSTEM', "THAT LOOKS LIKE AN API KEY, SO IT IS NOT BEING SENT :: THE TRANSCRIPT IS REPLAYED TO HER AND WRITTEN TO THE ARCHIVE, AND A KEY IN HERE WOULD BE A KEY GIVEN AWAY."
        + "\nUSE THE KEYS PANEL INSTEAD - THE KEYS \u25be BUTTON, OR /keys - WHICH KEEPS KEYS IN THIS BROWSER AND PRINTS ONLY A MASKED FORM.");
      return;
    }

    // CUSTOM COMMAND: /help  (the roster of everything that can be typed - first, so a lost user finds it)
    if (textOnly && /^\/(help|commands|\?)(\s|$)/i.test(text)) {
      var hArg = text.replace(/^\/(help|commands|\?)/i, "").trim();
      input.value = '';
      print('SYSTEM', helpText(hArg));
      return;
    }

    // CUSTOM COMMAND: /search
    if (textOnly && text.startsWith("/search ")) {
      var query = text.replace("/search ", "");
      input.value = '';
      await runSearch(query);
      return;
    }

    // CUSTOM COMMAND: /handsfree  (SIA's hands-free modes, worn through this terminal's own voice verbs)
    if (textOnly && /^\/handsfree\b/i.test(text)) {
      var hfArg = text.replace(/^\/handsfree\b/i, "").trim();
      input.value = '';
      if (window.handsfree) { await window.handsfree.words(hfArg); return; }
      print('SYSTEM', "THE HANDS-FREE MODULE IS OFFLINE.");
      return;
    }
    // CUSTOM COMMAND: /commands  (the slash command list itself - src/commands/commands.json)
    if (textOnly && /^\/(commands|cmds)(\s|$)/i.test(text)) {
      input.value = '';
      print('SYSTEM', window.cmd ? window.cmd.listText() : "COMMAND LIST OFFLINE.");
      return;
    }

    // CUSTOM COMMAND: /export [json]  (the archive out of this browser - and back in again)
    if (textOnly && /^\/export\b/i.test(text)) {
      const exArg = text.replace(/^\/export\b/i, "").trim().toLowerCase();
      input.value = '';
      if (exArg === "json" || exArg === "backup" || exArg === "full") { await window.exportArchiveJSON(); return; }
      if (!exArg) { await window.exportArchive(); return; }
      print('SYSTEM', "USAGE: /export (THE READABLE .TXT) · /export json (THE FULL-FIDELITY ROUND-TRIP FILE) · IMPORT (THE DECK BUTTON) READS EITHER BACK IN.");
      return;
    }

    // CUSTOM COMMAND: /cloud [connect|send|receive|log|setup|forget]  (the archive to your
    // private Google Drive and back - tokens in the key ring, this device only). THE CLOUD ROAD
    // OF THE SYNC (src/js/sync-cloud.js); the folder road on your own disk is /sync.
    if (textOnly && /^\/clouds?\b/i.test(text)) {
      const cldParts = text.replace(/^\/clouds?\b/i, "").trim().split(/\s+/).filter(Boolean);
      input.value = '';
      if (!window.cloudSync) { print('SYSTEM', "THE CLOUD SYNC MODULE IS OFFLINE (src/js/sync-cloud.js)."); return; }
      await window.cloudSync.words(cldParts[0] || "", cldParts.slice(1).join(" "));
      return;
    }

    // CUSTOM COMMAND: /ldrive [status|open|pull|push|forget|help]  (a folder on his own
    // disk, read and written in place - src/js/drive.js + src/drive.html). THE DRIVE ROAD:
    // the frame refuses the folder picker, so the drive lives in its own window (his click
    // opens it, the picker is allowed there) and this is the words for it. /drive stays what
    // it was - an alias of /sync - so this road takes its own name.
    if (textOnly && /^\/ldrive\b/i.test(text)) {
      const ldParts = text.replace(/^\/ldrive\b/i, "").trim().split(/\s+/).filter(Boolean);
      input.value = '';
      if (!window.drive) { print('SYSTEM', "THE DRIVE ROAD IS OFFLINE (src/js/drive.js)."); return; }
      await window.drive.words(ldParts[0] || "", ldParts.slice(1).join(" "));
      return;
    }

    // CUSTOM COMMAND: /rtfm  (the manual - src/rtfm/, read by src/js/rtfm.js)
    if (textOnly && /^\/(rtfm|man|cheat|cheatsheet)(\s|$)/i.test(text)) {
      var rfArg = text.replace(/^\/(rtfm|man|cheat|cheatsheet)/i, "").trim();
      input.value = '';
      if (!window.rtfm) { print('SYSTEM', "THE RTFM MODULE IS OFFLINE (src/js/rtfm.js)."); return; }
      var rfOut = null;
      try { rfOut = await window.rtfm.run(rfArg); }
      catch (e) { rfOut = { text: "THE RTFM COULD NOT BE READ :: " + ((e && e.message) || e) }; }
      print('SYSTEM', (rfOut && rfOut.text) ? rfOut.text : "THE RTFM HAS NOTHING TO SAY.");
      return;
    }

    // CUSTOM COMMAND: /chronicle  (the making of this terminal - src/chronicle/, read by
    // src/js/chronicle.js). The lane BESIDE the RTFM: the manual tells you how to drive the machine,
    // this tells you how it came to be the machine you are driving - one entry per session, written
    // by the agent that lived it, because the reasoning is the part that dies with a closed chat.
    if (textOnly && /^\/chronicle(\s|$)/i.test(text)) {
      var chArg = text.replace(/^\/chronicle/i, "").trim();
      input.value = '';
      if (!window.chronicle) { print('SYSTEM', "THE CHRONICLE MODULE IS OFFLINE (src/js/chronicle.js)."); return; }
      var chOut = null;
      try { chOut = await window.chronicle.run(chArg); }
      catch (e) { chOut = { text: "THE CHRONICLE COULD NOT BE READ :: " + ((e && e.message) || e) }; }
      print('SYSTEM', (chOut && chOut.text) ? chOut.text : "THE CHRONICLE HAS NOTHING TO SAY.");
      return;
    }

    // CUSTOM COMMAND: /chatlog  (the raw record of the conversation itself - src/js/chatlog.js).
    // The lane BESIDE the chronicle: the chronicle is what a session MADE of the conversation,
    // this is the conversation. It is kept in this browser's kv and never in src/ (which is
    // public), nothing in it ever reaches the text engine, and the one thing it cannot do by
    // itself - read the editor's chat panel, which is a different origin - is what /chatlog
    // snippet is for: it prints the script that does it, to be run in the editor's console.
    if (textOnly && /^\/chatlog(\s|$)/i.test(text)) {
      var clArg = text.replace(/^\/chatlog/i, "").trim();
      input.value = '';
      if (!window.chatlog) { print('SYSTEM', "THE CHATLOG MODULE IS OFFLINE (src/js/chatlog.js)."); return; }
      var clOut = null;
      try { clOut = await window.chatlog.run(clArg); }
      catch (e) { clOut = { text: "THE CHATLOG COULD NOT BE READ :: " + ((e && e.message) || e) }; }
      print('SYSTEM', (clOut && clOut.text) ? clOut.text : "THE CHATLOG HAS NOTHING TO SAY.");
      if (window.chatlog.refresh) window.chatlog.refresh();
      return;
    }

    // CUSTOM COMMAND: /journal  (HIS OWN CHATLOG - src/js/journal.js). Raw lines he files
    // himself, #tags riding inside, and MINUTES every six hours - meeting minutes, not a
    // summary: counts, tags, his lines quoted verbatim. Browser kv only, never src/,
    // never sent anywhere, never read by her. Bare /journal <line> files; every verb
    // lives in the module, so the surface here stays one line wide.
    if (textOnly && /^\/journal(\s|$)/i.test(text)) {
      input.value = '';
      if (!window.journal) { print('SYSTEM', "THE JOURNAL MODULE IS OFFLINE (src/js/journal.js)."); return; }
      try { await window.journal.command(text.replace(/^\/journal/i, "").trim()); }
      catch (e) { print('SYSTEM', "THE JOURNAL COULD NOT BE WRITTEN :: " + ((e && e.message) || e)); }
      return;
    }

    // CUSTOM COMMAND: /vimeo  (THE VIMEO DOOR - src/js/vimeo.js). A bare id, a Vimeo link,
    // or the whole embed code plays on the frame's stage; anything that is not Vimeo is
    // refused loud and nothing plays. Every verb lives in the module, so the surface here
    // stays one line wide.
    if (textOnly && /^\/vimeo(\s|$)/i.test(text)) {
      input.value = '';
      if (!window.vimeo) { print('SYSTEM', "THE VIMEO MODULE IS OFFLINE (src/js/vimeo.js)."); return; }
      try { await window.vimeo.command(text.replace(/^\/vimeo/i, "").trim()); }
      catch (e) { print('SYSTEM', "THE VIMEO WOULD NOT PLAY :: " + ((e && e.message) || e)); }
      return;
    }

    // CUSTOM COMMAND: /lore [sort ...]  (the documents in her memory, and the order they are read in)
    // The order is not decoration: it is what the DOCS panel prints, what /lore prints, how ties
    // break inside recall, and - because canon is collected by walking the file list - the order
    // the foundational documents are handed to her in, in full, on every turn. So it is settable
    // from here as well as from the panel headings, and it is remembered on this device.
    if (textOnly && (text === "/commpack" || text.startsWith("/commpack "))) {
      var cpArg = text.replace(/^\/commpack\s*/, "").trim();
      input.value = '';
      if (!window.commpackLane) { print('SYSTEM', "COMMPACK LANE OFFLINE (src/js/commpack.js DID NOT LOAD)."); return; }
      print('SYSTEM', await window.commpackLane.words(cpArg));
      return;
    }
    if (textOnly && (text === "/groq" || text.startsWith("/groq "))) {
      var gqArg = text.replace(/^\/groq\s*/, "").trim();
      input.value = '';
      if (!window.groq) { print('SYSTEM', "GROQ LANE OFFLINE (src/js/groq.js DID NOT LOAD)."); return; }
      print('SYSTEM', await window.groq.words(gqArg));
      return;
    }
    if (textOnly && (text === "/bridge" || text.startsWith("/bridge "))) {
      var brArg = text.replace(/^\/bridge\s*/, "").trim();
      input.value = '';
      if (!window.mythosBridge) { print('SYSTEM', "BRIDGE LANE OFFLINE (src/js/bridge.js DID NOT LOAD)."); return; }
      print('SYSTEM', await window.mythosBridge.words(brArg));
      return;
    }
    if (textOnly && (text === "/local" || text.startsWith("/local "))) {
      var lcArg = text.replace(/^\/local\s*/, "").trim();
      input.value = '';
      if (!window.localLLM) { print('SYSTEM', "LOCAL LANE OFFLINE (src/js/local.js DID NOT LOAD)."); return; }
      print('SYSTEM', await window.localLLM.words(lcArg));
      return;
    }
    if (textOnly && (text === "/lore" || text.startsWith("/lore "))) {
      var lrArg = text.replace(/^\/lore\s*/, "").trim();
      input.value = '';
      if (!window.lore) { print('SYSTEM', "LORE MODULE OFFLINE."); return; }
      if (/^sort\b/i.test(lrArg)) {
        if (!window.lore.sort) { print('SYSTEM', "SORTING IS NOT AVAILABLE IN THIS BUILD."); return; }
        var sParts = lrArg.replace(/^sort\b/i, "").trim().split(/\s+/).filter(Boolean);
        var sRes = await window.lore.sort(sParts[0] || "", sParts[1] || "");
        if (!sRes.ok) { print('SYSTEM', "NOT SORTED :: " + sRes.error); return; }
        print('SYSTEM', "LOREPACK ORDER :: " + String(sRes.key).toUpperCase() + " "
          + (sRes.dir === "desc" ? "DESCENDING" : "ASCENDING")
          + " :: CANON " + (sRes.canonFirst ? "HELD FIRST" : "IN PLACE")
          + (sRes.changed ? "" : " (ALREADY IN FORCE)")
          + "\nIT IS THE ORDER THE DOCS PANEL PRINTS, THE ORDER /lore PRINTS, AND - BECAUSE CANON IS COLLECTED BY WALKING THIS LIST - THE ORDER THE CANON DOCUMENTS ARE HANDED TO HER IN."
          + "\n/lore sort <NAME|ADDED|SIZE|FRAG> [ASC|DESC] :: /lore sort canon :: OR PRESS A HEADING IN THE DOCS PANEL.");
        return;
      }
      // THE DOCS PANEL'S PAGER (src/js/lore.js, "ONE PAGE OF DOCUMENTS AT A TIME"). The panel draws
      // one page of the LOREPACK at a time, and these are the words for it. A page is what is
      // DRAWN: the count, recall and the canon walk still see every document.
      if (/^(page|go|jump|next|prev|previous|back|first|start|last|end|per|size|pagesize|find|show)\b/i.test(lrArg)) {
        var dParts = lrArg.split(/\s+/).filter(Boolean);
        if (!window.lore.docs) { print('SYSTEM', "PAGING IS NOT AVAILABLE IN THIS BUILD."); return; }
        var dRes = await window.lore.docs(dParts[0], dParts.slice(1).join(" "));
        if (!dRes.ok) { print('SYSTEM', "NOT MOVED :: " + dRes.error); return; }
        print('SYSTEM', "DOCS PANEL :: PAGE " + dRes.page + " OF " + dRes.pages
          + " :: SHOWING " + dRes.from + "\u2013" + dRes.to + " OF " + dRes.total
          + " :: " + dRes.perLabel + " TO A PAGE"
          + (dRes.name ? " :: " + dRes.name + " IS ON PAGE " + dRes.found : "")
          + (dRes.slow ? "\nTHAT IS THE WHOLE LOREPACK ON ONE PAGE, AND IT IS SLOW TO DRAW - /lore per 50 PUTS IT BACK TO PAGES." : "")
          + "\nA PAGE IS WHAT THE PANEL DRAWS - /lore LISTS ALL " + dRes.total + ", RECALL SEARCHES ALL OF THEM, AND THE CANON WALK READS ALL OF THEM."
          + "\n/lore page <N> | next | prev | first | last | find <NAME> | per <25|50|100|200|all> :: OR PRESS THE PAGER AT THE FOOT OF THE DOCS PANEL.");
        return;
      }
      print('SYSTEM', window.lore.describe());
      return;
    }

    // CUSTOM COMMAND: /deck [upper|main|lower|left|right|both [on|off|toggle]]
    // THE THREE DECKS AND TWO PANELS (src/js/decks.js). The shell has five named parts - the UPPER DECK (the status
    // line, the tool bar, and the viewers - the DOX VIEWER among them), the MAIN STAGE (the conversation), and the LOWER
    // DECK (the input, the controls and the panels docked in it). The upper and lower decks can be put
    // away and called back; the stage cannot. A viewer open in the upper deck puts the lower
    // deck down on its own and gives it back when it closes - /deck says which of the two it is.
    if (textOnly && (text === "/deck" || text === "/decks" || text.startsWith("/deck ") || text.startsWith("/decks "))) {
      var dkArg = text.replace(/^\/decks?\s*/, "").trim();
      input.value = '';
      if (!window.decks) { print('SYSTEM', "THE DECK MODULE IS OFFLINE (src/js/decks.js)."); return; }
      var dkParts = dkArg.split(/\s+/).filter(Boolean);
      var dkRes = await window.decks.words(dkParts[0] || "", dkParts[1] || "");
      if (!dkRes.ok) { print('SYSTEM', "NOT MOVED :: " + dkRes.error); return; }
      print('SYSTEM', "THE DECKS :: " + deckLine(dkRes.upper) + "\n" + deckLine(dkRes.main) + "\n" + deckLine(dkRes.lower) + "\n" + deckLine(dkRes.left) + "\n" + deckLine(dkRes.right)
        + (dkRes.viewers && dkRes.viewers.length ? "\nA VIEWER IS OPEN (" + dkRes.viewers.join(", ") + ") - THAT IS WHY THE LOWER DECK IS DOWN. CLOSING IT BRINGS THE DECK BACK." : "")
        + (dkRes.full ? "\nTHE DOX VIEWER IS FILLING THE STAGE :: THE UPPER DECK'S CHROME AND THE CONVERSATION HAVE STOOD DOWN FOR IT, AND IT HAS THE WHOLE PAGE. /docs full off (OR ESC, OR THE FILL KEY IN ITS BAR) GIVES THE STAGE BACK." : "")
        + (window.dms && window.dms.isOpen() ? "\nTHE TANDEM IS " + (window.dms.tandem() ? "ON" : "OFF") + (window.dms.tandem() ? " :: " + window.dms.where() + " :: /tandem SAYS BOTH SIDES OF IT, AND THE PAGE IS READ-ONLY EITHER WAY." : " :: SHE IS TOLD NOTHING ABOUT THE PAGE. /tandem on HANDS IT BACK TO HER.") : "")
        + (dkRes.viewerRule ? "" : "\nTHE VIEWER RULE HAS NOT STARTED YET (IT BEGINS ONCE THE TERMINAL HAS BOOTED).")
        + "\n/deck upper|lower|left|right|both on|off|toggle :: /deck both on|off :: /deck :: OR PRESS THE KEY INSIDE A REGION (IT LEAVES A TAB ON ITS EDGE).");
      return;
    }

    if (textOnly && (text === "/gap" || text.startsWith("/gap "))) {
      var gArg = text.replace(/^\/gap\s*/, "").trim();
      input.value = '';
      if (!window.gap) { print('SYSTEM', "THE AIR GAP GATE IS OFFLINE (src/js/airgap.js)."); return; }
      print('SYSTEM', window.gap.words(gArg));
      return;
    }

    // CUSTOM COMMAND: /docs  (THE DOX VIEWER - read-only document management over every document
    // this terminal holds: her memory, the manual, the shipped prose and data, and the source
    // itself if he asks for CODE. src/js/dms.js holds the store, the two lanes and the operations;
    // the panel in the upper deck is the same thing with a mouse, and this is the door in words.
    // EVERY VERB IS A READ: list, search, open, read, head, outline, find, info, related, stat.
    // The only thing that spends anything is /docs index, which builds the meaning lane; /docs full
    // gives the panel the whole stage and /docs full off gives it back.)
    if (textOnly && (text === "/docs" || text.startsWith("/docs "))) {
      var dmArg = text.replace(/^\/docs\s*/, "").trim();
      input.value = '';
      if (!window.dms) { print('SYSTEM', "THE DOX VIEWER IS OFFLINE (src/js/dms.js)."); return; }
      var dmVerb = (dmArg.split(/\s+/)[0] || "").toLowerCase();
      var dmRest = dmArg.slice(dmVerb.length).trim();
      if (!dmVerb) {
        // BARE /docs OPENS IT. The panel is the thing; the words are the shortcut, and a bare command
        // should show him the thing rather than describe it.
        window.dms.open();
        print('SYSTEM', window.dms.words("state", "").text + "\n\n/docs help PRINTS EVERY OPERATION. NOTHING IN THE VIEWER WRITES ANYTHING.");
        return;
      }
      var dmRes = await window.dms.words(dmVerb, dmRest);
      if (!dmRes || !dmRes.ok) { print('SYSTEM', "DOCS :: " + ((dmRes && dmRes.error) || "THAT DID NOT WORK.")); return; }
      print('SYSTEM', dmRes.text);
      return;
    }

    // CUSTOM COMMAND: /tandem  (THE SHARED PAGE - src/js/dms.js, THE TANDEM). The DOX VIEWER is the
    // one thing both of them look at at the same time: he is HITL, she is ALIA, and this is the key
    // to her hand on it. `off` is a real state - she is told nothing about the page and a PAGE line
    // of hers is refused - and `state` names both presences and what each is pointed at.
    if (textOnly && (text === "/tandem" || text.startsWith("/tandem "))) {
      var tnArg = text.replace(/^\/tandem\s*/, "").trim();
      input.value = '';
      if (!window.dms) { print('SYSTEM', "THE DOX VIEWER IS OFFLINE (src/js/dms.js)."); return; }
      var tnRes = await window.dms.words("tandem", tnArg);
      print('SYSTEM', tnRes && tnRes.ok ? tnRes.text : ((tnRes && tnRes.error) || "THAT DID NOT WORK."));
      return;
    }

    // CUSTOM COMMAND: /screen  (THE SCREENING ROOM - src/js/images.js, THE SCREENING TANDEM).
    // The full stage as the shared page: what record is on it, her hand on it (tandem on/off),
    // turning it (look), walking it (next/prev), and reading the open one in her critical voice
    // (take = HER TAKE, one vision call, pictures only).
    if (textOnly && (text === "/screen" || text.startsWith("/screen "))) {
      var scArg = text.replace(/^\/screen\s*/, "").trim();
      input.value = '';
      if (!window.screening) { print('SYSTEM', "THE SCREENING ROOM IS OFFLINE IN THIS BUILD (src/js/images.js)."); return; }
      var scRes = "";
      try { scRes = await window.screening.words(scArg); }
      catch (e) { scRes = "THE SCREENING ROOM FAILED :: " + String((e && e.message) || e); }
      print('SYSTEM', scRes);
      return;
    }

    // CUSTOM COMMAND: /mood  (THE COLOURS SHE ANSWERS IN - src/js/moods.js). The same console is in
    // the SYSTEM panel and on the pencil; this is the door for hands that would rather type, and it
    // is the door that can WRITE a colour in one line: /mood SLUTTY :: say what you want plainly.
    // Both presences have one - he types /mood, she writes a MOOD line - and OFF is a word here too.
    if (textOnly && (text === "/mood" || text.startsWith("/mood "))) {
      var mdArg = text.replace(/^\/mood\s*/, "").trim();
      input.value = '';
      if (!window.moods) { print('SYSTEM', "THE MOOD ROW IS OFFLINE IN THIS BUILD (src/js/moods.js)."); return; }
      var mdRes = await window.moods.words(mdArg);
      print('SYSTEM', mdRes && mdRes.ok ? mdRes.text : ((mdRes && mdRes.error) || "THAT DID NOT WORK."));
      return;
    }

    // CUSTOM COMMAND: /moodpack (THE LOADABLE PACK - src/js/packs.js over src/js/moods.js).
    if (textOnly && (text === "/moodpack" || text.startsWith("/moodpack "))) {
      var mpArg = text.replace(/^\/moodpack\s*/, "").trim();
      input.value = '';
      if (!window.packs || !window.packs.moodpackWords) { print('SYSTEM', "THE MOODPACK IS OFFLINE IN THIS BUILD (src/js/packs.js)."); return; }
      try { await window.packs.loadMoodpack(); } catch (e) {}
      var mpRes = window.packs.moodpackWords(mpArg, 'hitl');
      print('SYSTEM', mpRes && mpRes.ok ? mpRes.text : ((mpRes && mpRes.error) || "THAT DID NOT WORK."));
      return;
    }

    // CUSTOM COMMAND: /board (THE META-MOODS - src/js/moods.js). Short door onto the boards.
    if (textOnly && (text === "/board" || text.startsWith("/board "))) {
      var boArg = text.replace(/^\/board\s*/, "").trim();
      input.value = '';
      if (!window.moods || !window.moods.board) { print('SYSTEM', "THE MOOD BOARD IS OFFLINE IN THIS BUILD (src/js/moods.js)."); return; }
      var boRes = window.moods.board(boArg, 'hitl');
      print('SYSTEM', boRes && boRes.ok ? boRes.text : ((boRes && boRes.error) || "THAT DID NOT WORK."));
      return;
    }

    // CUSTOM COMMAND: /moodpanel (THE MOOD PANEL). Opens or closes her colour console.
    if (textOnly && text.startsWith("/moodpanel")) {
      var mplArg = text.replace("/moodpanel", "").trim().toLowerCase();
      input.value = '';
      if (!window.moods || !window.moods.panelToggle) { print('SYSTEM', "THE MOOD PANEL IS OFFLINE IN THIS BUILD (src/js/moods.js)."); return; }
      if (mplArg === "open") window.moods.panelOpen();
      else if (mplArg === "close" || mplArg === "off") window.moods.panelClose();
      else if (mplArg === "edit" && window.moods.boardEditOpen) window.moods.boardEditOpen(), window.moods.panelOpen();
      else window.moods.panelToggle();
      print('SYSTEM', "MOOD PANEL :: " + (window.moods.panelIsOpen() ? "OPEN - THE CONSOLE, THE BOARDS WITH THEIR EDITOR, AND THE MOODPACK." : "CLOSED."));
      return;
    }

    if (textOnly && text.startsWith("/moodpackpage")) {
      var mppArg = text.replace("/moodpackpage", "").trim().toLowerCase();
      input.value = '';
      if (!window.moodpack || !window.moodpack.toggle) { print('SYSTEM', "THE MOODPACK PAGE IS OFFLINE IN THIS BUILD (src/js/moodpack.js)."); return; }
      if (mppArg === "open") window.moodpack.open();
      else if (mppArg === "close" || mppArg === "off") window.moodpack.close();
      else window.moodpack.toggle();
      print('SYSTEM', "MOODPACK PAGE :: " + (window.moodpack.isOpen() ? "OPEN - THE PACK COLOURS WITH THEIR RULES, AND THE ROWS TO WRITE, REWRITE, SAVE AND LOAD THEM." : "CLOSED."));
      return;
    }

    // CUSTOM COMMAND: /recall <query>  (preview retrieved fragments)
    if (textOnly && text.startsWith("/recall ")) {
      var rq = text.replace("/recall ", "").trim();
      input.value = '';
      var pv = (window.lore && rq) ? window.lore.preview(rq, 5) : "";
      print('SYSTEM', pv || "NO LORE FRAGMENTS MATCHED.");
      return;
    }

    // CUSTOM COMMAND: /backstage  (the veil - whether the terminal's own machinery is shown)
    if (textOnly && text.startsWith("/backstage")) {
      var bArg = text.replace("/backstage", "").trim().toLowerCase();
      input.value = '';
      if (!window.veil) { print('SYSTEM', "NO VEIL ON THIS TERMINAL."); return; }
      if (bArg === "on" || bArg === "show" || bArg === "up" || bArg === "open") window.veil.set(false);
      else if (bArg === "off" || bArg === "hide" || bArg === "down" || bArg === "close") window.veil.set(true);
      else window.veil.toggle();
      return;
    }

    // CUSTOM COMMAND: /syslog  (the SEARCH LOG posted above every reply)
    if (textOnly && text.startsWith("/syslog")) {
      var lgArg = text.replace("/syslog", "").trim().toLowerCase();
      input.value = '';
      if (lgArg === "on" || lgArg === "off") syslogOn = (lgArg === "on");
      else syslogOn = !syslogOn;
      print('SYSTEM', "SEARCH LOG :: " + (syslogOn ? "ON" : "OFF")
        + "\nEVERY TURN SHOWS WHAT SHE SWEPT, WHAT EACH METHOD RETURNED, MATCH STRENGTH, AND THE FILE SHE TOOK IT FROM."
        + "\nIT RIDES IN BACKSTAGE - /backstage TO SEE IT, OR OFF TO STOP IT BEING WORKED OUT AT ALL."
        + "\n/syslog on · /syslog off");
      return;
    }

    // CUSTOM COMMAND: /autotag [on|off|status|<ID>]
    if (textOnly && text.startsWith("/autotag")) {
      var atArg = text.replace("/autotag", "").trim();
      input.value = '';
      if (!window.autotag) { print('SYSTEM', "THE AUTOTAG MODULE IS OFFLINE (src/js/autotag.js DID NOT LOAD)."); return; }
      var atLow = atArg.toLowerCase();
      if (atLow === "on" || atLow === "off") { window.autotag.set(atLow === "on"); return; }
      if (!atLow || atLow === "status") { window.autotag.status().then(function (t) { print('SYSTEM', t); }); return; }
      print('SYSTEM', "AUTOTAG :: READING " + atArg.toUpperCase().slice(0, 48) + " ONCE ...");
      window.autotag.tagNow(atArg).then(function (t) { print('SYSTEM', t); }, function (e) { print('SYSTEM', "AUTOTAG FAILED :: " + String((e && e.message) || e)); });
      return;
    }

    // CUSTOM COMMAND: /critic study <ID|#TAG|WORDS> [again] | glance <...> | taste | pick [N] | status
    if (textOnly && text.startsWith("/critic")) {
      var crArg = text.replace("/critic", "").trim();
      input.value = '';
      if (!window.critic) { print('SYSTEM', "THE CRITIC LANE IS OFFLINE (src/js/critic.js DID NOT LOAD)."); return; }
      Promise.resolve(window.critic.words(crArg)).then(function (t) { print('SYSTEM', t); }, function (e) { print('SYSTEM', "HER TAKE FAILED :: " + String((e && e.message) || e)); });
      return;
    }

    // CUSTOM COMMAND: /dop <id|R12|#tag|words>  (the DP read - src/js/dop.js over src/lib/kine-dop.js)
    if (textOnly && text.startsWith("/dop")) {
      var dopArg = text.replace("/dop", "").trim();
      input.value = '';
      if (!window.dop) { print('SYSTEM', "THE DOP MODULE IS OFFLINE (src/js/dop.js DID NOT LOAD)."); return; }
      if (!dopArg) { print('SYSTEM', "NAME A PICTURE :: /dop <VAULT ID, R12, #tag OR WORDS> - ONE VISION CALL, READ ONCE."); return; }
      print('SYSTEM', "READING THE LIGHT :: " + dopArg.toUpperCase().slice(0, 48) + " ...");
      window.dop.breakdown(dopArg).then(function (t) { print('SYSTEM', t); }, function (e) { print('SYSTEM', "DOP FAILED :: " + String((e && e.message) || e)); });
      return;
    }

    // CUSTOM COMMAND: /runlink [--n N] [--seed S] [--neg ...] [--tag ...] [--res ...] [--ar ...] [--guidance ...] <prompt>
    // THE AGENT DOOR'S SHARING ROAD (src/js/agentdoor.js). Builds a ?autorun=1 URL by hand -
    // spends nothing, runs nothing. The flags mirror the door's validation; the prompt is the rest.
    if (textOnly && text.startsWith("/runlink")) {
      var rlArg = text.replace("/runlink", "").trim();
      input.value = '';
      if (!window.agentdoor) { print('SYSTEM', "THE AGENT DOOR IS OFFLINE (src/js/agentdoor.js DID NOT LOAD)."); return; }
      if (!rlArg) { print('SYSTEM', "NAME A PICTURE :: /runlink [--n 1-4] [--seed S] [--neg ...] [--tag ...] [--res 512x768] [--ar 3:4] [--guidance 1-30] <PROMPT> - BUILDS THE ?autorun=1 URL, SPENDS NOTHING."); return; }
      var rlP = { prompt: "", n: "", seed: "", neg: "", tag: "", res: "", resolution: "", ar: "", guidance: "" };
      var rlWords = [];
      (function () {
        var toks = rlArg.split(/\s+/);
        var cur = null;
        for (var ti = 0; ti < toks.length; ti++) {
          var tk = toks[ti];
          if (/^--(n|seed|neg|tag|res|resolution|ar|guidance)$/i.test(tk)) { cur = tk.slice(2).toLowerCase(); continue; }
          if (cur) {
            if (cur === "res") cur = "resolution";
            rlP[cur] = (rlP[cur] ? rlP[cur] + " " : "") + tk;
            // Every flag but --neg takes exactly one word (--neg runs to the next flag);
            // without this the prompt words after a flag would be eaten by it.
            if (cur !== "neg") cur = null;
          } else rlWords.push(tk);
        }
        rlP.prompt = rlWords.join(" ");
        if (!rlP.n) delete rlP.n;
        if (!rlP.seed) delete rlP.seed;
        if (!rlP.neg) delete rlP.neg;
        if (!rlP.tag) delete rlP.tag;
        if (!rlP.resolution) delete rlP.resolution;
        if (!rlP.ar) delete rlP.ar;
        if (!rlP.guidance) delete rlP.guidance;
        delete rlP.res;
      })();
      try {
        var rl = window.agentdoor.runLink(rlP);
        print('SYSTEM', 'RUN LINK :: ' + rl.total + (rl.total === 1 ? ' IMAGE' : ' IMAGES') + ' (' + rl.prompts.length + ' PROMPT' + (rl.prompts.length === 1 ? '' : 'S') + ' x ' + rl.n + '), SPENT NOTHING ::\n' + rl.run_link);
      } catch (e) { print('SYSTEM', String((e && e.message) || e)); }
      return;
    }

    // CUSTOM COMMAND: /agentdoor [history|clear|status]
    if (textOnly && /^\/(agentdoor|agent-door)(\s|$)/i.test(text)) {
      var adArg = text.replace(/^\/(agentdoor|agent-door)/i, "").trim().toLowerCase();
      input.value = '';
      if (!window.agentdoor) { print('SYSTEM', "THE AGENT DOOR IS OFFLINE (src/js/agentdoor.js DID NOT LOAD)."); return; }
      if (!adArg || adArg === "status") { print('SYSTEM', window.agentdoor.status()); return; }
      // THE LORE DOOR, BY HAND (case preserved for names and questions - the lowercased
      // adArg is only the switch). Search/map/read are local (free); summarize/ask spend text quota.
      if (/^lore(\s|$)/i.test(adArg)) {
        var adRaw = text.replace(/^\/(agentdoor|agent-door)/i, "").trim().replace(/^lore/i, "").trim();
        var adOp = (adRaw.split(/\s+/)[0] || "").toLowerCase(), adRest = adRaw.slice(adOp.length).trim();
        // Awaited, not fire-and-forget: the map/read/summarize roads all cross kv,
        // so an un-awaited branch would print after the turn has moved on.
        await (async function () {
          try {
            if (adOp === "status") { print('SYSTEM', window.agentdoor.loreStatus()); return; }
            if (adOp === "search") {
              var sm = adRest.match(/^(.*?)\s+k\s+(\d+)\s*$/i), sq = adRest, sk = "";
              if (sm) { sq = sm[1].trim(); sk = sm[2]; }
              if (!sq) { print('SYSTEM', "USAGE: /agentdoor lore search <QUERY> [k N] - LOCAL BM25, FREE."); return; }
              await window.agentdoor.loreSearch({ q: sq, k: sk });
              return;
            }
            if (adOp === "map") {
              if (!adRest) { print('SYSTEM', "USAGE: /agentdoor lore map <DOC> - EVERY PART WITH PREVIEWS, FREE."); return; }
              await window.agentdoor.loreMap({ doc: adRest });
              return;
            }
            if (adOp === "read") {
              var rpm = adRest.match(/^(.*?)\bpart\s+(\d+)\s*$/i), rd = adRest, rp = "";
              if (rpm) { rd = rpm[1].trim(); rp = rpm[2]; }
              if (!rd) { print('SYSTEM', "USAGE: /agentdoor lore read <DOC> [part N] - ONE PART WHOLE, FREE."); return; }
              await window.agentdoor.loreRead({ doc: rd, part: rp });
              return;
            }
            if (adOp === "summarize" || adOp === "summary") {
              var spm = adRest.match(/^(.*?)\bparts\s+(\d+\s*-\s*\d+)\s*$/i) || adRest.match(/^(.*?)\bpart\s+(\d+)\s*$/i), sd = adRest, ss = "";
              if (spm) { sd = spm[1].trim(); ss = spm[0].slice(spm[1].length).trim(); }
              if (!sd) { print('SYSTEM', "USAGE: /agentdoor lore summarize <DOC> [part N | parts A-B] - ENGINE ROAD, SPENDS TEXT QUOTA."); return; }
              var sm2 = ss.match(/^parts\s+(\d+\s*-\s*\d+)$/i), sm1 = ss.match(/^part\s+(\d+)$/i);
              await window.agentdoor.loreSummarize(sm2 ? { doc: sd, parts: sm2[1].replace(/\s+/g, "") } : (sm1 ? { doc: sd, part: sm1[1] } : { doc: sd }));
              return;
            }
            if (adOp === "ask") {
              if (!adRest) { print('SYSTEM', "USAGE: /agentdoor lore ask [doc <NAME> ::] <QUESTION> - MATCHED LOCALLY (FREE), ANSWERED IN 1 ENGINE CALL."); return; }
              var aqm = adRest.match(/^doc\s+([\s\S]+?)\s*::\s*([\s\S]+)$/i), aqDoc = "", aqQ = adRest;
              if (aqm) { aqDoc = aqm[1].trim(); aqQ = aqm[2].trim(); }
              await window.agentdoor.loreAsk({ doc: aqDoc, q: aqQ });
              return;
            }
            print('SYSTEM', "LORE DOOR :: search <QUERY> [k N] | map <DOC> | read <DOC> [part N] | summarize <DOC> [part N | parts A-B] | ask [doc <NAME> ::] <QUESTION> | status. SEARCH/MAP/READ ARE LOCAL (FREE); SUMMARIZE/ASK SPEND TEXT QUOTA.");
          } catch (e) { print('SYSTEM', "LORE DOOR :: " + String((e && e.message) || e)); }
        })();
        return;
      }
      if (adArg === "history") {
        window.agentdoor.history().then(function (rows) {
          if (!rows.length) { print('SYSTEM', "AGENT DOOR :: NO RUNS ON RECORD."); return; }
          print('SYSTEM', "AGENT DOOR :: " + rows.length + " RUN" + (rows.length === 1 ? "" : "S") + " ON RECORD (NEWEST LAST) ::\n"
            + rows.map(function (r, i) { return "#" + (i + 1) + " " + (r.ok ? "DONE" : "FAILED") + " " + r.count + "/" + r.total + " :: " + String(r.prompt || "").slice(0, 90) + (r.tag ? " :: #" + r.tag : ""); }).join("\n"));
        });
        return;
      }
      if (adArg === "clear") {
        window.agentdoor.clear().then(function (r) { print('SYSTEM', "AGENT DOOR :: CLEARED " + r.cleared + " RUN" + (r.cleared === 1 ? "" : "S") + " FROM THE LOG."); });
        return;
      }
      (window.agentdoor.help ? window.agentdoor.help() : [window.agentdoor.describe()]).forEach(function (line) { print('SYSTEM', line); });
      return;
    }
    // CUSTOM COMMAND: /checkin [on|off | every <MIN> | now]
    // THE ONE DOOR IN THE WALL OF STRICT TURN-TAKING: after a long silence she may speak first,
    // once. src/js/initiative.js holds the machinery and the reasoning.
    if (textOnly && /^\/(checkin|check-in|initiative)(\s|$)/i.test(text)) {
      var ciArg = text.replace(/^\/(checkin|check-in|initiative)/i, "").trim().toLowerCase();
      input.value = '';
      if (!window.checkIn) { print('SYSTEM', "THE CHECK-IN MODULE IS OFFLINE."); return; }
      if (!ciArg) { print('SYSTEM', window.checkIn.describe()); return; }
      if (ciArg === "on" || ciArg === "off") {
        var ciOn = (ciArg === "on");
        window.checkIn.on(ciOn);
        print('SYSTEM', "CHECK-IN :: " + (ciOn ? "ON :: AFTER " + Math.round(window.checkIn.every() / 60000) + " MINUTES OF QUIET SHE MAY SPEAK FIRST - ONCE PER SILENCE, AND ONLY WHILE THIS TAB IS ON SCREEN AND NOTHING ELSE IS RUNNING." : "OFF :: SHE WILL NOT SPEAK FIRST AT ALL, AND NOTHING ABOUT THIS DOOR IS IN HER PROMPT WHILE IT IS OFF."));
        return;
      }
      if (ciArg.indexOf("every") === 0 || ciArg.indexOf("after") === 0) {
        var ciMins = parseFloat(ciArg.replace(/^(every|after)\s*/, "").replace(/[^0-9.]/g, ""));
        if (!ciMins || !isFinite(ciMins)) { print('SYSTEM', "USAGE: /checkin every <MINUTES> - HOW LONG THE ROOM MUST BE QUIET BEFORE SHE MAY SPEAK FIRST (5-1440)."); return; }
        window.checkIn.every(ciMins);
        print('SYSTEM', "CHECK-IN :: THE DOOR OPENS AFTER " + Math.round(window.checkIn.every() / 60000) + " MINUTES OF QUIET. IT STILL OPENS ONLY ONCE PER SILENCE, AND ONLY WHILE NOTHING ELSE IS RUNNING.");
        return;
      }
      if (ciArg === "now" || ciArg === "test") {
        print('SYSTEM', "CHECK-IN :: OPENING THE DOOR NOW :: THE ROOM IS QUIET AND SHE MAY SAY SOMETHING OR NOTHING.\nIF SHE HAS NOTHING TO SAY SHE WILL WRITE [[SILENT]] AND NOTHING HAPPENS - THAT IS THE HONEST ANSWER, NOT A FAILURE.");
        window.checkIn.now();
        return;
      }
      print('SYSTEM', "USAGE: /checkin · /checkin on|off · /checkin every <MIN> · /checkin now"
        + "\nSHE SPEAKS FIRST ONLY THROUGH THIS DOOR: AFTER A LONG SILENCE (45 MINUTES BY DEFAULT), ONCE PER SILENCE, ONLY WHILE THE TAB IS ON SCREEN AND NOTHING IS RUNNING. THE WORDS ARE HERS - THE MACHINE SAYS THE ROOM IS QUIET AND SHE DECIDES, AND STAYING QUIET IS A REAL ANSWER.");
      return;
    }

    // CUSTOM COMMAND: /shift [on|off | every <MIN> | now | log [N] | journal [N] | queue [drop <N>]]
    // THE QUIET HOURS (src/js/shift.js). The other half of the check-in: the check-in lets her speak
    // FIRST, once per silence, and it is the only word she has unasked; a quiet hour is not a word
    // at all - it is a private turn in which she may work on herself with the lanes she already has,
    // and nothing in it is said to him, spoken aloud, or put in the conversation.
    if (textOnly && /^\/shift(\s|$)/i.test(text)) {
      var shArg = text.replace(/^\/shift/i, "").trim();
      input.value = '';
      if (!window.shift) { print('SYSTEM', "THE SHIFT MODULE IS OFFLINE (src/js/shift.js)."); return; }
      if (!shArg) { print('SYSTEM', window.shift.describe()); return; }
      var shLow = shArg.toLowerCase();
      var shSt = window.shift.state();
      if (shLow === "on" || shLow === "off") {
        var shOn = (shLow === "on");
        window.shift.on(shOn);
        window.shift.refresh();
        print('SYSTEM', "THE SHIFT :: " + (shOn
          ? "ON :: " + Math.round(shSt.every / 60000) + " MINUTES OF QUIET EARNS HER A QUIET HOUR - AT MOST " + shSt.maxHour + " IN AN HOUR AND " + shSt.maxDay + " IN A DAY, ONLY WHILE THIS TAB IS ON SCREEN AND NOTHING ELSE IS RUNNING. ONE CALL TO THE TEXT ENGINE PER HOUR USED. NOTHING IN AN HOUR IS SAID TO YOU OR SPOKEN ALOUD: IT IS NOT A TURN OF HERS."
          : "OFF :: SHE IS GIVEN NO QUIET HOUR AT ALL, AND NOTHING ABOUT THEM IS IN HER PROMPT."));
        return;
      }
      if (shLow.indexOf("every") === 0 || shLow.indexOf("after") === 0) {
        var shMins = parseFloat(shArg.replace(/^(every|after)\s*/, "").replace(/[^0-9.]/g, ""));
        if (!shMins || !isFinite(shMins)) { print('SYSTEM', "USAGE: /shift every <MINUTES> - HOW LONG THE ROOM MUST BE QUIET BEFORE SHE IS GIVEN AN HOUR OF HER OWN (5-1440)."); return; }
        window.shift.every(shMins);
        window.shift.refresh();
        print('SYSTEM', "THE SHIFT :: A QUIET HOUR NOW COMES AFTER " + Math.round(window.shift.every() / 60000) + " MINUTES OF QUIET. THE CEILING (" + shSt.maxHour + " AN HOUR, " + shSt.maxDay + " A DAY) AND THE ONE CALL PER HOUR ARE UNCHANGED.");
        return;
      }
      if (shLow === "now" || shLow === "test") { window.shift.now(); return; }
      if (shLow === "log" || shLow.indexOf("log ") === 0) {
        print('SYSTEM', window.shift.logText(shArg.replace(/^log\s*/i, "").trim()));
        return;
      }
      if (shLow === "journal" || shLow.indexOf("journal ") === 0) {
        print('SYSTEM', window.shift.journalText(shArg.replace(/^journal\s*/i, "").trim()));
        return;
      }
      if (shLow === "queue" || shLow.indexOf("queue ") === 0) {
        var shQ = shArg.replace(/^queue\s*/i, "").trim();
        if (!shQ) { print('SYSTEM', window.shift.queueText()); return; }
        var shDrop = shQ.replace(/^drop\s*/i, "").trim();
        var shRes = await window.shift.dropIntent(shDrop, { by: "patrikios took it off the queue" });
        print('SYSTEM', shRes.ok
          ? "THE SHIFT :: TAKEN OFF HER QUEUE :: \"" + String(shRes.item.text).toUpperCase() + "\""
            + "\nIT IS NOT DELETED - IT STAYS IN THE RECORD AS TAKEN OFF BY YOU, AND IT STOPS BEING SHOWN TO HER AT EACH QUIET HOUR."
          : "THE SHIFT :: " + String(shRes.error || "") + "\n/shift queue LISTS WHAT SHE MEANS TO DO.");
        window.shift.refresh();
        return;
      }
      print('SYSTEM', "USAGE: /shift · /shift on|off · /shift every <MIN> · /shift now · /shift log [N] · /shift journal [N] · /shift queue [drop <N>]"
        + "\nA QUIET HOUR IS NOT A TURN OF HERS: NOTHING IN IT IS SAID TO YOU, SPOKEN ALOUD, OR PUT IN THE CONVERSATION. IT IS THE HOUR FOR THE WORK WITH NO AUDIENCE - HER OWN MEMORY, WHAT SHE MEANS TO CARRY, THE RECORD, HER OWN PICTURES, AND ASKING YOU TO CHANGE SOMETHING ABOUT HERSELF.");
      return;
    }

    // CUSTOM COMMAND: /infinity [on|off | pace <1-5> | now | log [N]]
    // THE INFINITY (src/js/proactive.js). The wide door beside the check-in's narrow one: she may
    // move first - speak, remind him out of the record, send a picture, make one - and the PACE is
    // HERS. He has exactly one hand on this lane, and it is the toggle (the glyph in the control
    // row); the intensity is moved by her own [[PACE: <1-5>]] line, which is why the command does
    // not set it - it may only say what it is.
    if (textOnly && /^\/infinity(\s|$)/i.test(text)) {
      var inArg = text.replace(/^\/infinity/i, "").trim();
      input.value = '';
      if (!window.proactive) { print('SYSTEM', "THE INFINITY IS OFFLINE (src/js/proactive.js)."); return; }
      if (!inArg) { print('SYSTEM', window.proactive.describe()); return; }
      var inLow = inArg.toLowerCase();
      if (inLow === "on" || inLow === "off") {
        window.proactive.on(inLow === "on");
        print('SYSTEM', window.proactive.describe());
        return;
      }
      if (inLow.indexOf("pace") === 0 || inLow.indexOf("intensity") === 0) {
        var inN = parseInt(inArg.replace(/^(pace|intensity)\s*/i, "").replace(/[^0-9]/g, ""), 10);
        if (!inN || inN < 1 || inN > 5) {
          print('SYSTEM', "USAGE: /infinity pace <1-5> - THE PACE OF THIS LANE.\nBUT IT IS HERS, NOT YOURS: THE CLEAN WAY TO MOVE IT IS TO ASK HER, AND THE WAY IT ACTUALLY MOVES IS A [[PACE: <1-5>]] LINE OF HER OWN IN ANY REPLY, QUIET HOUR OR ACT. THIS COMMAND WRITES IT DOWN AS YOURS, AND SHE CAN MOVE IT AGAIN WHENEVER SHE LIKES.");
          return;
        }
        await window.proactive.pace(inN, "patrikios (by command)");
        print('SYSTEM', "THE INFINITY :: PACE SET TO " + inN + "/5 BY YOU. IT IS HERS TO MOVE: [[PACE: <1-5>]] FROM HER MOVES IT, AND THE DIGIT ON THE \u221e BUTTON ALWAYS SHOWS WHERE IT STANDS.");
        return;
      }
      if (inLow === "now" || inLow === "test") { window.proactive.now(); return; }
      if (inLow === "images" || inLow.indexOf("images ") === 0) {
        var imArg = inArg.replace(/^images\s*/i, "").trim();
        input.value = '';
        if (!imArg) { window.proactive.images().then(function (t) { print('SYSTEM', "THE INFINITY :: PICTURE ALLOWANCE " + t + " (MADE OR SENT, THIS LANE ONLY - ORDINARY REPLIES ARE NEVER COUNTED)."); }); return; }
        window.proactive.images(imArg).then(function (t) { print('SYSTEM', "THE INFINITY :: PICTURE ALLOWANCE " + t); });
        return;
      }
      if (inLow === "log" || inLow.indexOf("log ") === 0) {
        print('SYSTEM', window.proactive.log(parseInt(inArg.replace(/^log\s*/i, "").trim(), 10) || 10));
        return;
      }
      print('SYSTEM', "USAGE: /infinity \u00b7 /infinity on|off \u00b7 /infinity pace <1-5> \u00b7 /infinity images <N>|unlimited \u00b7 /infinity now \u00b7 /infinity log [N]"
        + "\nTHE TOGGLE IS THE \u221e GLYPH IN THE CONTROL ROW, AND IT IS THE ONLY HAND YOU HAVE ON THIS LANE. IT IS INSTANT: PRESSING IT ON OPENS AN ACT AT ONCE, PRESSING IT OFF DROPS ANYTHING NOT YET SAID."
        + "\nWHILE IT IS ON SHE RUNS THE CONVERSATION: YOU ARE SILENT AND WAITING ON HER WORD, AND SHE MOVES AGAIN AFTER HER OWN CLOCK - QUICKLY ONCE YOU HAVE ANSWERED HER, ON HER PACE'S SPACING IF YOU HAVE NOT. SHE MAY SPEAK, REMIND YOU OUT OF THE RECORD, SEND A PICTURE OUT OF THE VAULT, OR MAKE ONE."
        + "\nHER PACE (1-5) IS HERS - [[PACE: <1-5>]] FROM HER MOVES IT, AND [[WAIT: <time>]] SAYS HOW LONG THE ROOM IS TO BE LEFT ALONE. [[SILENT]] IS A REAL ANSWER AND HANDS THE ROOM BACK TO YOU.");
      return;
    }

    // CUSTOM COMMAND: /duty [on|off | semi|full | arm semi|full | kill]
    // THE MASTER ARM (src/js/duty.js). The pilot's seat, and OFF is the KILL SWITCH (full
    // manual mode): every autonomous lane down, anything autonomous in flight dropped unsaid,
    // every LIVE voice road closed (live channel, mic, her speaking, the live wire). SEMI keeps
    // the check-in and the quiet hours but never the wide door; FULL lets everything lit run.
    // Manual hands (SEND, TALK/LISTEN, INTERCOM, /infinity now and the like, AIM/wire, pair)
    // are never gated.
    if (textOnly && /^\/duty(\s|$)/i.test(text)) {
      var duArg = text.replace(/^\/duty/i, "").trim();
      input.value = '';
      if (!window.duty) { print('SYSTEM', "THE DUTY MODULE IS OFFLINE (src/js/duty.js)."); return; }
      print('SYSTEM', await window.duty.words(duArg));
      return;
    }

    // CUSTOM COMMAND: /hand [clear]
    // HER HAND ON THE DASHBOARD (src/js/hand.js). At MASTER ARM FULL she may press the
    // console's own switches herself ([[PRESS: <name>]] in an act), and a switch she touches
    // stays lit until his hand takes it back. Bare says what is lit; clear wipes her lamps.
    if (textOnly && /^\/hand(\s|$)/i.test(text)) {
      var hdArg = text.replace(/^\/hand/i, "").trim();
      input.value = '';
      if (!window.herHand) { print('SYSTEM', "THE HAND MODULE IS OFFLINE (src/js/hand.js)."); return; }
      print('SYSTEM', /^clear/i.test(hdArg) ? window.herHand.clear() : window.herHand.describe());
      return;
    }

    // CUSTOM COMMAND: /petition [list | show <N> | accept <N> | decline <N> [:: <WHY>] | grants | clear yes]
    // THE PETITIONS (src/js/petition.js). What she has ASKED him to change about the machinery - the
    // blocks she is given, the role text under them, her own poses and recipes and traits - filed
    // pending, changing nothing, and decided by hand here or by the buttons in the SHIFT panel.
    if (textOnly && /^\/(petition|petitions)(\s|$)/i.test(text)) {
      var ptArg = text.replace(/^\/(petition|petitions)/i, "").trim();
      input.value = '';
      if (!window.petition) { print('SYSTEM', "THE PETITION MODULE IS OFFLINE (src/js/petition.js)."); return; }
      var ptLow = ptArg.toLowerCase();
      if (!ptArg || ptLow === "list") { print('SYSTEM', window.petition.listText()); return; }
      if (ptLow.indexOf("show") === 0) { print('SYSTEM', window.petition.showText(ptArg.replace(/^show\s*/i, "").trim())); return; }
      if (ptLow.indexOf("accept") === 0) {
        var ptN = ptArg.replace(/^accept\s*/i, "").trim();
        var ptA = await window.petition.accept(ptN);
        print('SYSTEM', ptA.ok
          ? "PETITION ACCEPTED :: " + String(ptA.text || "")
            + "\nIT IS DONE AND IT IS IN THE RECORD. THE ORDINARY COMMAND FOR THAT SIDE OF THE TERMINAL PUTS IT BACK."
          : "PETITION :: IT COULD NOT BE APPLIED :: " + String(ptA.error || "")
            + "\nNOTHING WAS CHANGED AND HER WORDS ARE STILL HERE. /petition list SHOWS THEM.");
        window.shift && window.shift.refresh();
        return;
      }
      if (ptLow.indexOf("decline") === 0) {
        var ptRest = ptArg.replace(/^decline\s*/i, "").trim();
        var ptCut = ptRest.indexOf("::");
        var ptWho = (ptCut === -1 ? ptRest : ptRest.slice(0, ptCut)).trim();
        var ptWhy = (ptCut === -1 ? "" : ptRest.slice(ptCut + 2)).trim();
        var ptD = await window.petition.decline(ptWho, ptWhy);
        print('SYSTEM', ptD.ok
          ? "PETITION DECLINED :: " + String(ptD.text || "")
            + "\nHER WORDS STAY IN THE RECORD BESIDE YOUR ANSWER - IT IS NOT DELETED, IT IS ANSWERED, AND SHE IS SHOWN IT AT THE NEXT QUIET HOUR."
          : "PETITION :: " + String(ptD.error || ""));
        window.shift && window.shift.refresh();
        return;
      }
      if (ptLow === "grants" || ptLow === "granted") {
        var ptG = window.petition.grants();
        print('SYSTEM', ptG.length
          ? "GRANTS IN FORCE (" + ptG.length + ") - SHE IS HANDED THESE ON EVERY TURN (THE GRANTS BLOCK):\n"
            + ptG.map(function (g, k) { return "  " + (k + 1) + ". " + String(g.body || "") + (g.why ? "\n     (as she put it :: " + String(g.why) + ")" : ""); }).join("\n")
          : "NO GRANTS ARE IN FORCE. A GRANT IS THE ONE KIND OF PETITION THAT IS NOT A CHANGE TO CODE - SOMETHING SHE ASKS YOU TO ALLOW OR TO KNOW - AND AN ACCEPTED ONE IS HANDED TO HER EVERY TURN.");
        return;
      }
      if (ptLow.indexOf("clear") === 0) {
        if (!/\byes\b/i.test(ptArg)) { print('SYSTEM', "PETITION :: THAT DROPS THE PETITIONS YOU HAVE ALREADY ANSWERED AND KEEPS EVERY ONE STILL WAITING. /petition clear yes GOES AHEAD."); return; }
        var ptC = await window.petition.clear();
        print('SYSTEM', "PETITION :: " + ptC + " ANSWERED PETITION" + (ptC === 1 ? "" : "S") + " DROPPED FROM THE RECORD. NOTHING STILL WAITING WAS TOUCHED.");
        window.shift && window.shift.refresh();
        return;
      }
      print('SYSTEM', "USAGE: /petition · /petition list · /petition show <N> · /petition accept <N> · /petition decline <N> [:: <WHY>] · /petition grants · /petition clear yes"
        + "\nA PETITION CHANGES NOTHING WHILE IT WAITS. SHE FILES ONE WITH A LINE OF HER OWN - [[PETITION: <KIND> :: <WHAT> :: <WHY>]] - AND IT IS DECIDED HERE OR BY THE BUTTONS IN THE SHIFT PANEL.");
      return;
    }

    // CUSTOM COMMAND: /agegate [show | forget | status]
    // THE DOOR (src/js/agegate.js). The 18+ checkbox is markup at the very top of index.html, so it
    // is on the screen before this file - or any src/ file - has loaded. This is the door from HIS
    // side of the glass: show it again for whoever is at the screen, take the answer off the device
    // so the next load asks, or read what is kept. It gates nothing: no lane, no command and no
    // reply waits on the door, and this command is the only place in the machinery that names it.
    if (textOnly && /^\/agegate(\s|$)/i.test(text)) {
      var agArg = text.replace(/^\/agegate/i, "").trim();
      input.value = '';
      if (window.agegate) window.agegate.command(agArg);
      else print('SYSTEM', "THE DOOR MODULE IS NOT LOADED HERE (src/js/agegate.js) - BUT THE 18+ CHECKBOX IS STILL ON THE PAGE AND ITS OWN FALLBACK STILL WORKS. /backup diag NAMES THE src/ FILES THE SERVER HAS NOT BEEN GIVEN.");
      return;
    }

    // CUSTOM COMMAND: /gatekeeper (or /priapos) [show | mint | forget | status | authority | keytest]
    // PRIAPOS, THE FIRST DOOR (src/js/gatekeeper.js). The token screen is markup at the very top of
    // index.html, above the age door, so it is on the screen before this file - or any src/ file -
    // has loaded. This is the guardian from HIS side of the glass: show him again, mint a fresh
    // household sigil (enrols this device at once, shown once on the screen and never in the log),
    // point the INSPECT road at his Authority, prove the key, take the mark off the device, or read
    // what is kept. /priapos is the same command under the god's own name.
    if (textOnly && /^\/(gatekeeper|priapos|priapus)(\s|$)/i.test(text)) {
      var gkArg = text.replace(/^\/(gatekeeper|priapos|priapus)/i, "").trim();
      input.value = '';
      if (window.gatekeeper) window.gatekeeper.command(gkArg);
      else print('SYSTEM', "THE GATEKEEPER MODULE IS NOT LOADED HERE (src/js/gatekeeper.js) - BUT THE SIGIL SCREEN IS STILL ON THE PAGE AND ITS OWN FALLBACK STILL WORKS. /backup diag NAMES THE src/ FILES THE SERVER HAS NOT BEEN GIVEN.");
      return;
    }

    // CUSTOM COMMAND: /dev [on | off]
    // THE DEVELOPER BYPASS (src/js/dev.js). A temporary superuser for testing: a tab-only session
    // flag that stands both doors down (PRIAPOS and the 18+ checkbox) without writing either answer
    // anywhere. Nothing persists - closing the tab ends it, and /dev off ends it sooner. It gates
    // nothing else and changes no record: the doors simply do not ask while it is on.
    if (textOnly && /^\/dev(\s|$)/i.test(text)) {
      var dvArg = text.replace(/^\/dev/i, '').trim();
      input.value = '';
      if (window.dev) window.dev.command(dvArg);
      else print('SYSTEM', "THE DEVELOPER MODULE IS NOT LOADED HERE (src/js/dev.js).");
      return;
    }

    // CUSTOM COMMAND: /xlate [pair] <text> | /xlate email <addr> | /xlate doc <NAME>
    // THE DEAD-LANGUAGES ROAD (src/js/xlate.js). OpenL first when keyed, free MyMemory when not.
    if (textOnly && /^\/(xlate|translate|grc)(\s|$)/i.test(text)) {
      var xlArg = text.replace(/^\/(xlate|translate|grc)/i, "").trim();
      input.value = '';
      if (window.xlate) window.xlate.command(xlArg);
      else print('SYSTEM', "THE TRANSLATOR IS NOT LOADED HERE (src/js/xlate.js). /backup diag NAMES THE src/ FILES THE SERVER HAS NOT BEEN GIVEN.");
      return;
    }

    // CUSTOM COMMANDS: THE SPINCODE LAYER (src/js/spincode.js + spincode-scrolls.js).
    // HIS custom command codes - the SPINCODE v0.1 primitives and his scroll commands (Keyword,
    // SearchArchive, the agency lane). The dispatcher resolves multiword aliases (play mode,
    // captain's mode) itself, so this one block carries all sixty-one verbs.
    if (textOnly && window.spincode && window.spincode.handles(text)) {
      input.value = '';
      window.spincode.run(text);
      return;
    }

    // CUSTOM COMMAND: /wall [on | off | toggle | forget]
    // THE WALL (src/js/wall.js). The background image is his code (the plugin imported in main.pjs,
    // the `bgData` list, and the square block in index.html); this is the switch that hides it, and
    // the switch exists because the picture is a placeholder for the moment. The wall ships OFF, so
    // this command is the way ON - one keystroke from inside the terminal instead of an edit in the
    // editor - and the choice is kept in THIS BROWSER (kv lia_settings / wall). It gates nothing: no
    // lane, no command and no reply waits on the wall, and this is the only place that names it.
    if (textOnly && /^\/wall(\s|$)/i.test(text)) {
      var wlArg = text.replace(/^\/wall/i, "").trim();
      input.value = '';
      if (window.wall) window.wall.command(wlArg);
      else print('SYSTEM', "THE WALL MODULE IS NOT LOADED HERE (src/js/wall.js) - WHICH IS SAFE: THE WALL SHIPS OFF, SO NOTHING IS MISSING FROM THE PAGE. /backup diag NAMES THE src/ FILES THE SERVER HAS NOT BEEN GIVEN.");
      return;
    }

    // CUSTOM COMMAND: /saved [quick | help]
    // THE SAVE CHECK (src/js/saved.js). "Is the work saved?" - asked of the PLATFORM, because only
    // the editor's SAVE button publishes this generator and this page cannot press it. The module
    // reads the copy the server is holding right now and compares it against this workspace - the two
    // root files byte for byte, the file list, every src/ file by CONTENT (each saved file is read
    // back off the platform's own CDN, so a one-character edit is caught), and the import lines. It
    // writes nothing, uploads nothing, reads no key, and nothing in the terminal waits on it: it is a
    // receipt, not a gate. /backup TAKES the copy, SAVE PUBLISHES it, /saved PROVES it landed.
    if (textOnly && /^\/saved(\s|$)/i.test(text)) {
      var svArg = text.replace(/^\/saved/i, "").trim();
      input.value = '';
      if (window.saved) window.saved.command(svArg);
      else print('SYSTEM', "THE SAVE CHECK MODULE IS NOT LOADED HERE (src/js/saved.js). /backup status STILL NAMES THE FILES THE SERVER HAS NEVER BEEN GIVEN - THAT HALF LIVES IN backup.js AND NEEDS NOTHING ELSE.");
      return;
    }

    // CUSTOM COMMAND: /stamp [on|off] · /stamp zone <IANA|auto>
    // THE CLOCK. Every conversation line and every archive entry carries when it was said. This is
    // where the on-screen half of that is switched off (the record keeps its timestamps regardless),
    // and where the zone is changed if the record is ever wanted in another one.
    if (textOnly && /^\/(stamp|time|clock)(\s|$)/i.test(text)) {
      var spArg = text.replace(/^\/(stamp|time|clock)/i, "").trim();
      input.value = '';
      var spLow = spArg.toLowerCase();
      if (!spArg) { print('SYSTEM', window.logTime.describe()); return; }
      if (spLow === "on" || spLow === "off") {
        var spOn = (spLow === "on");
        window.logTime.set(spOn);
        print('SYSTEM', "STAMP :: THE CLOCK IS " + (spOn ? "ON THE SCREEN" : "OFF THE SCREEN")
          + ". THE ARCHIVE KEEPS EVERY TIMESTAMP EITHER WAY, AND SHE IS STILL TOLD THE TIME BEFORE EVERY REPLY - THIS IS THE PAINTING, NOT THE RECORD.");
        return;
      }
      if (spLow === "zone" || spLow.indexOf("zone ") === 0) {
        var spZone = spArg.replace(/^zone\s*/i, "").trim();
        if (!spZone) {
          print('SYSTEM', "STAMP :: THE ZONE IS " + window.logTime.zoneNow() + " (" + window.logTime.zoneLabel() + ")."
            + "\n/stamp zone <IANA NAME> SETS IT (e.g. America/Phoenix, America/Denver, Europe/London, UTC); /stamp zone auto GOES BACK TO THIS MACHINE'S OWN ZONE, WHICH IS THE DEFAULT. THE FALLBACK WHEN A MACHINE WILL NOT NAME ITS ZONE IS " + window.logTime.fallbackZone + ".");
          return;
        }
        if (!/^(auto|local)$/i.test(spZone) && !window.logTime.hasZone(spZone)) {
          print('SYSTEM', "STAMP :: \"" + spZone.toUpperCase() + "\" IS NOT A ZONE THIS MACHINE KNOWS. USE AN IANA NAME (America/Phoenix, America/Denver, Europe/London, UTC) OR /stamp zone auto.");
          return;
        }
        var spSet = window.logTime.zone(/^(auto|local)$/i.test(spZone) ? "auto" : spZone);
        print('SYSTEM', "STAMP :: THE RECORD IS NOW KEPT IN " + spSet.toUpperCase() + " (" + window.logTime.zoneLabel() + ")"
          + (spSet === window.logTime.localZone() ? " - THIS MACHINE'S OWN ZONE, WHICH IS THE DEFAULT." : " - SET BY YOU ON THIS DEVICE.")
          + "\nLINES ALREADY ON THE SCREEN KEEP THE STAMP THEY WERE WRITTEN WITH; EVERYTHING FROM HERE IS THE NEW ZONE.");
        return;
      }
      print('SYSTEM', "USAGE: /stamp · /stamp on|off · /stamp zone <IANA|auto>"
        + "\nTHE STAMP IS [YYYY-MM-DD HH:MM:SS ZONE] ON EVERY CONVERSATION LINE AND ON EVERY ARCHIVE ENTRY, AND SHE IS TOLD THE TIME BEFORE EVERY REPLY (THE CLOCK BLOCK - /system).");
      return;
    }

    // CUSTOM COMMAND: /peek [<ID> | newest | <N> | #TAG]
    // THE MINI LIGHTBOX (src/js/minibox.js). The receipt of every long job names what it touched, and
    // a name is not the thing: this is how he LOOKS at one without opening the gallery and finding it.
    // With no argument it opens the newest picture in the vault; with an id (or the start of one - the
    // citation a receipt printed) it opens that one; with a #tag it opens the newest picture filed
    // that way; with a number it opens the Nth newest. The arrows walk the vault newest-first from
    // there, so this doubles as browsing the gallery in a smaller window.
    if (textOnly && /^\/peek(\s|$)/i.test(text)) {
      input.value = '';
      if (!window.miniBox) { print('SYSTEM', "THE MINI LIGHTBOX IS OFFLINE (src/js/minibox.js)."); return; }
      var pkArg = text.replace(/^\/peek/i, '').trim();
      // WHICH ONE HE NAMED is answered in ONE place (images.js, resolveVaultTarget) because /see asks
      // the same question - `newest`, an id or the start of one, a #tag, or a number from the newest
      // all mean exactly the same thing in both commands.
      var pkRes = resolveVaultTarget(pkArg, { pictures: false, empty: "THERE IS NOTHING IN THE VAULT TO LOOK AT YET." });
      if (!pkRes.ok) { print('SYSTEM', "PEEK :: " + pkRes.error); return; }
      var pkList = pkRes.list, pkPick = pkRes.id, pkWhy = pkRes.why;
      var pkIx = pkRes.index;
      window.miniBox.open(pkPick, { list: pkList, note: pkWhy, title: "PEEK" });
      var pkRec = window.media.get(pkPick) || {};
      print('SYSTEM', "PEEK :: " + String(pkRec.name || pkRec.prompt || pkPick) + "  [" + pkPick + "]"
        + "\n" + pkWhy + " :: " + (window.media.folderOf ? window.media.folderOf(pkRec) : "") + " :: " + (pkRec.w && pkRec.h ? pkRec.w + "\u00d7" + pkRec.h : "")
        + "\nTHE MINI LIGHTBOX IS OPEN ON IT. THE LEFT AND RIGHT ARROWS WALK THE " + pkList.length + " IT WAS OPENED WITH"
        + (pkIx >= 0 ? " (THIS IS " + (pkIx + 1) + ")" : "") + ", ESC CLOSES IT, AND FULL STAGE IN THE BOX OPENS THE WHOLE RECORD. NOTHING THERE CHANGES ANYTHING.");
      return;
    }

    // CUSTOM COMMAND: /see <ID | newest | <N> | #TAG> [AND WHAT YOU WANT TO SAY]
    //
    // SEE IT, INLINE. The CLASSIFIER (/tools read) reads a whole vault one picture at a time, behind
    // the curtain. This is the same pass with the picture ON STAGE: he names one out of the vault, it
    // is put into the conversation AS HIS OWN LINE (the eye button in the gallery seeds exactly this
    // command), and the vision model reads it ONCE. What it found is written on the record the same
    // way the bulk pass writes it - her READING as the record's sight, the major elements as TAGS,
    // and the KIND of scene as its BUCKET (also a #tag, and - with LIA_CLASSIFY_FILE on - the folder
    // it is filed into). The record's own filing (name, folder, bucket, tags) then rides into her
    // instruction with the picture, so the conversation has the image AND everything already known
    // about it, and nothing has to be looked up later.
    //
    // A PICTURE THAT HAS ALREADY BEEN READ IS NOT READ AGAIN. The record's sight and bucket ARE the
    // analysis (/tools read skips exactly these), so no vision call is spent: `again` first re-reads
    // it and replaces what was written. That makes this the cheapest way to put a filed picture back
    // into a conversation, and the honest one when it is being seen for the first time.
    //
    // NOT GATED ON textOnly, unlike every other command: this IS the attachment command, so typing it
    // with something already in the strip is what he means, not a mistake to be sent to her as words.
    if (/^\/see(\s|$)/i.test(text)) {
      if (!window.media || !window.attach || !window.attach.carry) { print('SYSTEM', "SEE :: THE VAULT OR THE ATTACHMENT STRIP IS OFFLINE."); return; }
      var seeArg = text.replace(/^\/see/i, '').trim();
      var seeAgain = false;
      var seeM = seeArg.match(/^(again|reread|re-read|redo)\b\s*/i);
      if (seeM) { seeAgain = true; seeArg = seeArg.slice(seeM[0].length).trim(); }
      if (!seeArg) {
        print('SYSTEM', "USAGE: /see <VAULT ID | newest | <N> | #TAG> [AND WHAT YOU WANT TO SAY]\n"
          + "IT PUTS THAT PICTURE INTO THE CONVERSATION AS A LINE OF YOURS: THE VISION MODEL LOOKS AT IT WITH YOU, AND WHAT IT FINDS IS WRITTEN ON THE PICTURE "
          + "(ITS READING, ITS TAGS, AND THE KIND OF SCENE IT IS - WHICH IS ALSO THE FOLDER IT IS FILED INTO).\n"
          + "A PICTURE THAT HAS ALREADY BEEN READ COSTS NOTHING - ITS READING IS ALREADY ON IT. `/see again <WHAT>` READS IT AFRESH)\n"
          + "THE \u2609 BUTTON IN THE GALLERY SEEDS THIS SAME LINE; /peek ONLY LOOKS AT A PICTURE AND PUTS NOTHING IN FRONT OF HER.");
        return;
      }
      var seeTok = seeArg.split(/\s+/)[0];
      var seeWords = seeArg.slice(seeTok.length).trim();
      var seeBlock = "";   // THE TURN'S FILING BLOCK - read where the instruction is assembled
      var seeRes = resolveVaultTarget(seeTok, { pictures: false, empty: "THERE IS NOTHING IN THE VAULT TO PUT IN FRONT OF HER YET. /show <WHAT TO SEE> MAKES ONE, OR ATTACH ONE." });
      if (!seeRes.ok) { print('SYSTEM', "SEE :: " + seeRes.error); return; }
      var seeId = seeRes.id;
      var seeRec = window.media.get(seeId) || {};
      // A CLIP OR A RECORDING IS MEDIA, NOT A PICTURE. What the vision model may be shown of a clip is
      // its own first frame, which is kept as a picture of its own (attach.js) - so that is what goes
      // in front of her, and she is told it is the still, exactly as an attachment of the clip is
      // handled. A recording has no picture at all and is refused by name rather than dressed up.
      if (!lookable(seeId)) {
        var seeStill = (seeRec.poster && lookable(seeRec.poster)) ? seeRec.poster : "";
        if (seeStill) {
          print('SYSTEM', "SEE :: " + String(seeRec.name || seeId).toUpperCase() + " IS A CLIP, SO THE STILL IT CARRIES - ITS FIRST FRAME - IS WHAT GOES IN FRONT OF HER.");
          seeId = seeStill;
          seeRec = window.media.get(seeId) || {};
        } else {
          print('SYSTEM', "SEE :: " + String(seeRec.name || seeId).toUpperCase() + " IS NOT A PICTURE, AND THE VISION MODEL TAKES PICTURES ONLY"
            + (seeRec.kind === "video" ? " - THIS CLIP HAS NO FIRST FRAME KEPT, SO THERE IS NOTHING TO PUT IN FRONT OF HER. THE FILE ITSELF IS UNTOUCHED IN THE VAULT." : "."));
          return;
        }
      }
      input.value = '';
      // MARKED AS HIS POST: the picture is one he put into the conversation, so the sight block tells
      // her the truth about where it came from, and the queue keeps it for her even at its cap.
      try { await window.media.setField(seeId, "postedAt", Date.now()); } catch (e) {}
      var seeTaken = window.attach.carry([seeId]);
      if (!seeTaken.took.length) {
        print('SYSTEM', "SEE :: THAT PICTURE COULD NOT BE PUT ON THIS MESSAGE (THE ATTACHMENT STRIP IS FULL - LIA_ATTACH_MAX).\nNOTHING WAS SENT. /see IT IN ANOTHER MESSAGE, OR TAKE SOMETHING OFF THE STRIP FIRST.");
        return;
      }
      // THE ONE VISION CALL. Nothing is spent on a picture that already carries a reading and a
      // bucket - the record IS the analysis, and /tools read skips exactly those. The estimate is
      // printed before it is spent, as the classifier's scan does.
      var seePer = (typeof LIA_CLASSIFY_TOKENS === "number" && LIA_CLASSIFY_TOKENS > 0) ? Math.round(LIA_CLASSIFY_TOKENS) : 570;
      var seeNeeds = seeAgain || !String(seeRec.sight || "").trim() || !seeRec.bucket;
      if (seeNeeds && window.archivax && window.archivax.look && window.archivax.fileReading) {
        if (window.inHand && window.inHand.show) window.inHand.show(seeId, "READING IT INTO THE CONVERSATION", { label: "SEE" });
        print('SYSTEM', "SEE :: READING IT FIRST - ONE VISION CALL ON THE TEXT ENGINE, ABOUT " + seePer + " TOKENS OF CONTEXT ...");
        var seeFound = null, seeFiled = null, seeMoved = "";
        try {
          seeFound = await window.archivax.look(seeId, {
            prompt: (window.tools && window.tools.classifyPrompt) ? window.tools.classifyPrompt() : "",
            tagMax: 8
          });
        } catch (e) { seeFound = { ok: false, why: (e && e.message) ? e.message : String(e) }; }
        if (seeFound && seeFound.ok && (seeFound.bucket || (seeFound.tags || []).length)) {
          try { seeFiled = await window.archivax.fileReading(seeId, seeFound, "patrikios", { tags: true, bucket: true, mark: "SEE" }); }
          catch (e) { seeFiled = null; }
          // THE BUCKET IS ALSO A PLACE, filed exactly as the bulk pass files it: /images/<bucket>, or
          // /images/upscaled/<bucket> for an upscale (vault.js's bucketPath), and only while
          // LIA_CLASSIFY_FILE is on. The folders job is taught to respect it, so the two never fight.
          var seeFile = (typeof LIA_CLASSIFY_FILE === "undefined") ? true : !!LIA_CLASSIFY_FILE;
          if (seeFiled && seeFiled.bucket && seeFile && window.media.bucketPath) {
            try {
              var seeAfter = window.media.get(seeId);
              var seePath = window.media.bucketPath(seeAfter);
              if (seePath && window.media.folderOf(seeAfter) !== seePath) {
                var seeMv = await window.media.setFolder(seeId, seePath);
                if (seeMv && seeMv.ok) seeMoved = seeMv.to;
              }
            } catch (e) { console.warn("see: the picture could not be filed into its bucket folder", e); }
          }
          print('SYSTEM', "SEE :: READ AND FILED :: " + String(seeFiled && seeFiled.bucket ? seeFiled.bucket : "(no bucket named)").toUpperCase()
            + (seeFiled && (seeFiled.tags || []).length ? " :: " + seeFiled.tags.map(function (t) { return "#" + t; }).join(" ") : "")
            + (seeMoved ? " :: FILED INTO " + seeMoved : "")
            + "\nIT IS WRITTEN ON THE PICTURE, SO FINDING IT LATER NEEDS NO MODEL AT ALL: /gallery " + (seeFiled && seeFiled.bucket ? "#" + seeFiled.bucket : "find <WORDS>") + ".");
        } else {
          print('SYSTEM', "SEE :: IT WAS NOT READ :: " + String((seeFound && seeFound.why) || "the model answered without a tag line or a bucket").toUpperCase()
            + "\nNOTHING WAS WRITTEN ON IT. THE PICTURE IS STILL IN FRONT OF HER, AND THE CONVERSATION CARRIES WHATEVER THE RECORD ALREADY HAD.");
        }
      } else if (seeNeeds) {
        print('SYSTEM', "SEE :: THE READING ROAD IS OFFLINE (src/js/archivax.js OR THE TEXT PLUGIN), SO NOTHING IS WRITTEN ON THE PICTURE. IT STILL GOES IN FRONT OF HER.");
      }
      // WHAT SHE IS TOLD. Built from the RECORD as it stands NOW, so a reading written a moment ago is
      // already in it. This is the one place a picture of his is handed over WITH its filing: he named
      // it, so the name, the folder, the bucket and the tags are what he wants the conversation to
      // have - and she is told, in the same breath, to answer from the picture itself.
      seeRec = window.media.get(seeId) || {};
      var seeBits = ["FILED AS \"" + String(seeRec.name || seeRec.prompt || seeId) + "\"",
        "VAULT ID " + seeId,
        "FOLDER " + (window.media.folderOf ? window.media.folderOf(seeRec) : "/images")];
      if (seeRec.bucket) seeBits.push("BUCKET " + seeRec.bucket);
      var seeTags = window.media.tagsOf ? window.media.tagsOf(seeRec.tags) : (seeRec.tags || []);
      if (seeTags.length) seeBits.push("TAGS " + seeTags.map(function (t) { return "#" + t; }).join(" "));
      // THE LOREPACK JOIN (src/js/lorejoin.js). The sight above is the engineering - what the
      // picture shows. The pack's edges are the meaning - who the figures in it are to each
      // other. They ride into her instruction with the picture, or nothing does: an empty
      // join changes not one word below.
      var seeJoin = "";
      if (window.lorejoin && window.lorejoin.blockFor) {
        try {
          seeJoin = await window.lorejoin.blockFor({
            sight: seeRec.sight, tags: seeTags, prompt: seeRec.prompt, name: seeRec.name,
          }, String(seeRec.name || seeRec.prompt || seeId).slice(0, 60));
        } catch (e) { seeJoin = ""; }
      }
      seeBlock = "PATRIKIOS HAS JUST PUT ONE PICTURE OUT OF THE VAULT IN FRONT OF YOU. It is attached to this message, and he wants you to LOOK AT IT - answer from what you actually see in it.\n"
        + "The terminal's own record of it is here so that the conversation has it:\n  " + seeBits.join("\n  ") + "\n"
        + (seeRec.sight ? "  YOUR OWN EARLIER READING OF IT, written on the record when you last looked: \"" + String(seeRec.sight) + "\"\n" : "")
        + (seeJoin ? "  " + seeJoin.split("\n").join("\n  ") + "\n" : "")
        + "That record is FILING - the name it is kept under, and the words that let it be found again. It is not a description of the picture: do not read it out, and do not talk about files, folders, ids or buckets in your reply.";
      // Falls through into the ordinary turn with the picture as the newest attachment, so it is the
      // one attached to the model: she sees it with her own eyes, and the reply is hers.
      text = seeWords;
      textOnly = false;
      atts = window.attach.items();
      attIds = window.attach.images();
      attVids = window.attach.videos();
      attShown = window.attach.media();
      if (!attIds.length) { print('SYSTEM', "SEE :: THE PICTURE COULD NOT BE PUT ON THIS MESSAGE."); return; }
    }

    // CUSTOM COMMAND: /gallery [open | close | all|renders|yours|clips|upscaled|unseen | find <WORDS> | export | stats]
    // THE GALLERY. Every picture and clip in the vault on one screen, with the stamp it was stored
    // under and the turn it came from (src/js/gallery.js). The terminal half is only the door: the
    // pictures ARE the vault and the catalogue IS the archive, so nothing new is stored for it, and
    // nothing here uploads anything.
    if (textOnly && /^\/gallery(\s|$)/i.test(text)) {
      var galArg = text.replace(/^\/gallery/i, "").trim();
      input.value = '';
      if (!window.gallery) { print('SYSTEM', "THE GALLERY MODULE IS OFFLINE."); return; }
      var galLow = galArg.toLowerCase();
      if (galLow === "close" || galLow === "hide" || galLow === "off") {
        window.gallery.close();
        print('SYSTEM', "THE GALLERY IS CLOSED :: THE VAULT AND THE ARCHIVE ARE UNTOUCHED.");
        return;
      }
      if (galLow === "export" || galLow === "catalogue" || galLow === "catalog") {
        await window.gallery.exportCatalogue();
        return;
      }
      if (galLow === "stats" || galLow === "report" || galLow === "status") {
        await window.gallery.refresh(false);   // the report names turns, so the catalogue must be current
        print('SYSTEM', window.gallery.describe());
        return;
      }
      var galFound = galArg.match(/^(?:find|search|for)\s+(.+)$/i);
      if (galFound) {
        var galQ = galFound[1].trim();
        await window.gallery.open({ query: galQ });
        var galS = window.gallery.state();
        print('SYSTEM', "THE GALLERY IS OPEN, SEARCHING EVERY PROMPT, HER OWN READING OF A PICTURE, THE FILE NAMES AND THE WORDS OF THE TURNS :: \""
          + galQ.toUpperCase() + "\" FOUND " + galS.shown + " OF " + galS.vault + ".");
        return;
      }
      // THE PAGE (src/js/gallery.js, "ONE PAGE AT A TIME"). The grid draws one page of the view at a
      // time, and these are the words for it: /gallery page <N>, next, prev, and the size of a page.
      // Everything here is a view setting - nothing is moved, filed or deleted by any of it.
      if (galLow === "next" || galLow === "nextpage" || galLow === "next page" || galLow === "forward") {
        if (!window.gallery.isOpen()) await window.gallery.open();
        window.gallery.stepPage(1);
        var galNx = window.gallery.state();
        print('SYSTEM', "PAGE " + galNx.page + " OF " + galNx.pages + " :: " + galNx.onPage + " OF " + galNx.shown + " IN THE VIEW.");
        return;
      }
      if (galLow === "prev" || galLow === "previous" || galLow === "prevpage" || galLow === "prev page" || galLow === "back") {
        if (!window.gallery.isOpen()) await window.gallery.open();
        window.gallery.stepPage(-1);
        var galPv = window.gallery.state();
        print('SYSTEM', "PAGE " + galPv.page + " OF " + galPv.pages + " :: " + galPv.onPage + " OF " + galPv.shown + " IN THE VIEW.");
        return;
      }
      var galPer = galArg.match(/^(?:per|perpage|per-page|pagesize|page-size|size)\s+(\d+|all|everything|every)$/i);
      if (galPer) {
        var galWant = /^(all|everything|every)$/i.test(galPer[1]) ? 0 : Number(galPer[1]);
        var galSizes = window.gallery.pageSizes();
        if (!galSizes.some(function (p) { return p.n === galWant; })) {
          print('SYSTEM', "PER PAGE :: CHOOSE " + galSizes.map(function (p) { return p.label; }).join(" \u00b7 ")
            + " :: A SMALLER PAGE DRAWS FASTER, AND ALL DRAWS THE WHOLE FILTERED VIEW AT ONCE.");
          return;
        }
        if (!window.gallery.isOpen()) await window.gallery.open();
        window.gallery.setPer(galWant);
        var galPs = window.gallery.state();
        print('SYSTEM', (galPs.per > 0 ? galPs.per + " TO A PAGE" : "EVERY PICTURE ON ONE PAGE")
          + " :: " + galPs.pages + " PAGE" + (galPs.pages === 1 ? "" : "S") + " OF " + galPs.shown + " IN THE VIEW."
          + " IT IS REMEMBERED FOR NEXT TIME" + (galPs.per > 0 ? " - /gallery page <N> GOES STRAIGHT TO ONE." : " - /gallery per 60 PUTS IT BACK TO PAGES."));
        return;
      }
      var galPageTo = galArg.match(/^(?:page|go|goto|jump)\s+(\d+)$/i);
      if (galPageTo) {
        if (!window.gallery.isOpen()) await window.gallery.open();
        window.gallery.setPage(Number(galPageTo[1]));
        var galPg = window.gallery.state();
        print('SYSTEM', "THE GALLERY IS ON PAGE " + galPg.page + " OF " + galPg.pages + " :: " + galPg.onPage + " OF " + galPg.shown + " IN THE VIEW."
          + " THE FULL STAGE STILL WALKS THE WHOLE VIEW, PAGE OR NOT.");
        return;
      }
      var galFilters = { all: "all", everything: "all", render: "render", renders: "render", hers: "render", made: "render",
        sent: "sent", yours: "sent", mine: "sent", pictures: "sent", clip: "clip", clips: "clip", video: "clip", videos: "clip",
        music: "music", tunes: "music", audio: "music", songs: "music",
        vox: "vox", voice: "vox", voices: "vox", vocal: "vox", samples: "vox", sample: "vox",
        upscaled: "upscaled", upscale: "upscaled", big: "upscaled", unseen: "unseen", waiting: "unseen", sight: "unseen" };
      if (!galArg) {
        await window.gallery.open();
        var galA = window.gallery.state();
        print('SYSTEM', "THE GALLERY IS OPEN :: " + galA.vault + " PICTURES AND CLIPS IN THE VAULT, EACH WITH THE STAMP IT WAS STORED UNDER AND THE TURN IT CAME FROM."
          + "\nCLICK ONE FOR THE FULL STAGE (SAVE, UPSCALE). THE BUTTONS ON A TILE HAND IT TO HER EYES, SAVE IT, OR DELETE IT. DROP PICTURES, CLIPS OR MUSIC ANYWHERE IN HERE TO KEEP MORE - A CLIP KEEPS ITS FIRST FRAME AS ITS THUMBNAIL AND THE FILE ITSELF WHOLE, AND ALL OF IT LIVES IN THIS BROWSER."
          + "\\nTHE GRID IS SHOWN A PAGE AT A TIME (" + galA.per + " TO A PAGE, " + galA.pages + " PAGE" + (galA.pages === 1 ? "" : "S") + " OF THIS VIEW) - THE PAGER UNDER THE GRID, THE ARROW KEYS, AND /gallery page <N> MOVE IT, /gallery per <24|60|120|240|all> CHANGES IT. THE FULL STAGE STILL WALKS EVERY MATCHING PICTURE, PAGE OR NOT.");
        return;
      }
      if (galFilters[galLow]) {
        await window.gallery.open({ filter: galFilters[galLow] });
        var galF = window.gallery.state();
        print('SYSTEM', "THE GALLERY IS OPEN, SHOWING " + galLow.toUpperCase() + " :: " + galF.shown + " OF " + galF.vault + ".");
        return;
      }
      print('SYSTEM', "USAGE: /gallery \u00b7 /gallery close \u00b7 /gallery all|renders|yours|music|vox|clips|upscaled|unseen \u00b7 /gallery find <WORDS> \u00b7 /gallery page <N> | per <24|60|120|240|all> | next | prev \u00b7 /gallery export \u00b7 /gallery stats"
        + "\nTHE GALLERY IS EVERY PICTURE AND CLIP IN THE VAULT: STAMPED WITH WHEN IT WAS STORED, SAYING WHICH TURN IT CAME FROM, SEARCHABLE BY PROMPT OR BY WHAT SHE READ IN IT, AND OPENABLE AT FULL SIZE. NOTHING IS UPLOADED - IT ALL LIVES IN THIS BROWSER.");
      return;
    }

    // CUSTOM COMMAND: /tools [report | stop | scan <JOB> | <JOB> [SCOPE] [run]]
    // THE MAINTENANCE DECK (src/js/tools.js). Five jobs that do the tidying nobody does one record at
    // a time: find pictures the vault is holding more than once, file every record into the folder
    // its kind belongs in, upscale the pictures that have never been made 2x, READ EVERY PICTURE ONCE
    // with the vision model and write the reading, the elements and the bucket onto it (after which
    // finding a picture is search and no model at all), and repair what the record names that is no
    // longer here. A bare `/tools <JOB>` is a SCAN and changes nothing; the
    // word `run` is what takes it past the scan, and it is the only confirmation the one job that
    // deletes ever gets - a run takes its own scan first and prints it either way.
    if (textOnly && /^\/tools(\s|$)/i.test(text)) {
      input.value = '';
      if (!window.tools) { print('SYSTEM', "THE TOOLS MODULE IS OFFLINE (src/js/tools.js)."); return; }
      var tlArg = text.replace(/^\/tools/i, '').trim();
      var tlLow = tlArg.toLowerCase();
      if (!tlArg) { print('SYSTEM', window.tools.help()); return; }
      var tlWords = tlArg.split(/\s+/);
      if (tlWords[0].toLowerCase() === 'stop' || tlWords[0].toLowerCase() === 'halt' || tlWords[0].toLowerCase() === 'cancel') {
        if (!window.tools.busy()) { print('SYSTEM', "TOOLS :: NOTHING IS RUNNING. /tools LISTS THE JOBS."); return; }
        window.tools.stop();
        return;
      }
      if (tlWords[0].toLowerCase() === 'report' || tlWords[0].toLowerCase() === 'status' || tlWords[0].toLowerCase() === 'stats' || tlWords[0].toLowerCase() === 'vault') {
        print('SYSTEM', await window.tools.report());
        return;
      }
      var tlParts = tlArg.split(/\s+/);
      var tlFirst = tlParts[0].toLowerCase();
      if (tlFirst === 'help') {
        var tlNamed = window.tools.job(tlParts[1]);
        print('SYSTEM', tlNamed ? (tlNamed.title + "\n  " + tlNamed.what) : window.tools.help());
        return;
      }
      if (tlFirst === 'scan' || tlFirst === 'preview' || tlFirst === 'check') tlParts = tlParts.slice(1);   // `/tools scan <JOB> [SCOPE]`
      var tlJob = window.tools.job(tlParts[0]);
      if (!tlJob) {
        print('SYSTEM', "NO TOOL CALLED \"" + String(tlParts[0] || '').toUpperCase() + "\".\n" + window.tools.usage());
        return;
      }
      var tlRest = tlParts.slice(1).map(function (w) { return w.toLowerCase(); });
      var tlDo = tlRest.indexOf('run') !== -1 || tlRest.indexOf('do') !== -1 || tlRest.indexOf('apply') !== -1;
      var tlScope = tlRest.filter(function (w) { return w !== 'run' && w !== 'do' && w !== 'apply'; })[0] || '';
      // A bare job (or /tools scan <JOB>) is the PREVIEW, and it goes into the log as
      // well as into the panel - the receipt is the point of it.
      if (!tlDo) {
        var tlPreview = await window.tools.scan(tlJob.id, tlScope);
        print('SYSTEM', tlPreview.text || "THE SCAN COULD NOT BE TAKEN.");
        return;
      }
      print('SYSTEM', "TOOLS :: " + tlJob.title + " :: RUNNING" + (tlJob.danger
        ? " - THIS ONE DELETES COPIES. ONE OF EACH GROUP IS KEPT, EVERY REFERENCE IS MOVED ACROSS FIRST, AND THE BYTES ARE RE-CHECKED AT THE MOMENT OF DELETION."
        : " - NOTHING IS DELETED (only a record is moved, or a picture is made bigger)."));
      var tlRes = await window.tools.run(tlJob.id, tlScope, {});
      if (tlRes && tlRes.scanOnly) await window.tools.run(tlJob.id, tlScope, {});   // the scan was taken and printed; now it goes
      return;
    }

    // CUSTOM COMMAND: /auditor (or /audit) [<DOC> | next | all <N> | list | show <DOC> | forget <DOC> | stop]
    // THE AUDITOR (src/js/auditor.js) - mining her memory for actionable business intelligence. One
    // document goes in and one review comes out: the outline of its findings, the detailed report
    // with its date and document references, the general summary with pros and cons, and the
    // feasibility / impact / alignment judgement with follow-up points. Each review costs one
    // text-engine call and is kept on this device beside its document, stamped with when it was
    // made and what it was made from - a document that changes afterwards reads STALE.
    if (textOnly && /^\/(auditor|audit)(\s|$)/i.test(text)) {
      input.value = '';
      if (!window.auditor) { print('SYSTEM', "THE AUDITOR IS OFFLINE IN THIS BUILD (src/js/auditor.js)."); return; }
      var auArg = text.replace(/^\/(auditor|audit)/i, '').trim();
      if (!auArg) { print('SYSTEM', window.auditor.help()); return; }
      var auLow = auArg.toLowerCase();
      if (auLow === 'stop' || auLow === 'halt' || auLow === 'cancel') {
        if (!window.auditor.busy()) { print('SYSTEM', "AUDITOR :: NOTHING IS RUNNING. /auditor LISTS WHAT IT DOES."); return; }
        window.auditor.stop();
        return;
      }
      if (auLow === 'list' || auLow === 'status' || auLow === 'state') { print('SYSTEM', await window.auditor.list()); return; }
      if (auLow === 'next' || auLow === 'onward' || auLow === 'continue') {
        var auNext = await window.auditor.nextName();
        if (!auNext) { print('SYSTEM', "AUDITOR :: EVERY DOCUMENT IN HER MEMORY HAS A FRESH REVIEW - /auditor list SAYS SO."); return; }
        print('SYSTEM', "AUDITOR :: REVIEWING " + auNext + " - ONE TEXT-ENGINE CALL, KEPT ON THIS DEVICE WHEN IT LANDS.");
        var auOne = await window.auditor.review(auNext);
        print('SYSTEM', auOne.ok ? auOne.report : auOne.error);
        return;
      }
      if (/^show\s+/i.test(auArg)) { print('SYSTEM', await window.auditor.show(auArg.replace(/^show\s+/i, ''))); return; }
      if (/^forget\s+/i.test(auArg) || /^drop\s+/i.test(auArg) || /^delete\s+/i.test(auArg)) {
        var auFog = await window.auditor.forget(auArg.replace(/^(forget|drop|delete)\s+/i, ''));
        print('SYSTEM', auFog.ok ? auFog.text : auFog.error);
        return;
      }
      if (/^all\b/i.test(auLow)) {
        var auN = Math.floor(Number(auArg.replace(/^all\b/i, '').trim()));
        if (!isFinite(auN) || auN < 1) {
          print('SYSTEM', "AUDITOR :: NAME HOW MANY - /auditor all <N> REVIEWS THE NEXT N UNREVIEWED OR STALE DOCUMENTS IN HER ORDER, ONE TEXT-ENGINE CALL EACH. /auditor list SAYS HOW MANY ARE WAITING.");
          return;
        }
        var auDone = 0;
        for (var auI = 0; auI < auN; auI++) {
          var auName = await window.auditor.nextName();
          if (!auName) { print('SYSTEM', "AUDITOR :: DONE - " + auDone + " REVIEWED, AND NOTHING IS LEFT UNREVIEWED."); break; }
          print('SYSTEM', "AUDITOR :: REVIEWING " + auName + " (" + (auDone + 1) + " OF " + auN + ").");
          var auR = await window.auditor.review(auName);
          print('SYSTEM', auR.ok ? auR.report : auR.error);
          if (!auR.ok) break;
          auDone++;
          if (window.auditor.wasStopped()) { print('SYSTEM', "AUDITOR :: STOPPED AFTER " + auDone + " - THE REST IS STILL WAITING."); break; }
        }
        return;
      }
      var auRes = await window.auditor.review(auArg);
      print('SYSTEM', auRes.ok ? auRes.report : auRes.error);
      return;
    }

    // CUSTOM COMMAND: /capturemode (or /capture) [<TOPIC> | stop | keep | export | drop | status]
    // CAPTURE MODE (src/js/capture.js) - the SOP for capturing sessions: one trigger starts it, the
    // turns are marked in the archive, and she is told it is on (the CAPTURE block in her prompt, so
    // her discourse stays structured and mindful of transcription). Stopping formats the turns into
    // the house record (header with date, participants and topic; subheaders per point; bullets of
    // key points, actions and insights) for REVIEW - nothing is filed until the draft is reviewed and
    // kept, and then it is a LOREPACK document, searchable and recalled like any other memory.
    // Command lines are never captured. Audio capture and transcription are deliberately out of
    // scope: the terminal's session is already text, and voice turns land in the log as text.
    if (textOnly && /^\/(capturemode|capture)(\s|$)/i.test(text)) {
      input.value = '';
      if (!window.capture) { print('SYSTEM', "CAPTURE MODE IS OFFLINE IN THIS BUILD (src/js/capture.js)."); return; }
      var cpArg = text.replace(/^\/(capturemode|capture)/i, '').trim();
      var cpLow = cpArg.toLowerCase();
      if (!cpArg || cpLow === 'status' || cpLow === 'state' || cpLow === 'list') { print('SYSTEM', await window.capture.status()); return; }
      if (cpLow === 'stop' || cpLow === 'end' || cpLow === 'finish') {
        print('SYSTEM', "CAPTURE MODE :: ENDING THE SESSION AND FORMATTING THE DRAFT FOR REVIEW - NOTHING IS FILED YET.");
        var cpStop = await window.capture.stop();
        if (!cpStop.ok) { print('SYSTEM', cpStop.error); return; }
        if (cpStop.empty) { print('SYSTEM', "CAPTURE MODE :: ENDED - NO TURNS WERE CAPTURED, SO THERE IS NOTHING TO FORMAT."); return; }
        print('SYSTEM', "CAPTURE MODE :: " + cpStop.topic + " :: " + cpStop.turns + " TURNS :: REVIEW THE DRAFT - /capturemode keep FILES IT IN THE LOREPACK, /capturemode export DOWNLOADS IT, /capturemode drop LETS IT GO.\n\n" + (cpStop.draft || "[NO DRAFT]"));
        return;
      }
      if (cpLow === 'keep' || cpLow === 'save' || cpLow === 'file') {
        var cpKeep = await window.capture.keep();
        print('SYSTEM', cpKeep.ok ? ("CAPTURE MODE :: FILED IN THE LOREPACK AS " + cpKeep.name + " - SEARCHABLE AND RECALLED LIKE ANY OTHER MEMORY.") : cpKeep.error);
        return;
      }
      if (cpLow === 'export' || cpLow === 'download') {
        var cpEx = await window.capture.exportFile();
        print('SYSTEM', cpEx.ok ? ("CAPTURE MODE :: DOWNLOADED AS " + cpEx.name + ".") : cpEx.error);
        return;
      }
      if (cpLow === 'drop' || cpLow === 'forget' || cpLow === 'discard') {
        var cpDrop = await window.capture.drop();
        print('SYSTEM', cpDrop.ok ? cpDrop.text : cpDrop.error);
        return;
      }
      var cpStart = await window.capture.start(cpArg);
      if (!cpStart.ok) { print('SYSTEM', cpStart.error); return; }
      print('SYSTEM', "CAPTURE MODE :: ACTIVE - ALL PARTICIPANTS ARE NOTIFIED, INCLUDING HER: " + cpStart.topic + " :: STRUCTURED DISCOURSE, MINDFUL OF TRANSCRIPTION. /capturemode stop ENDS IT.");
      return;
    }

    // CUSTOM COMMAND: /cleandata [<DOC> [keep] | :: <TEXT>]
    // CLEANDATA (src/js/cleandata.js) - the combined cleaning pass: grammar to standard English,
    // spelling to American English, keywords out, hashtags built deterministically in code (not by
    // the model, so they stay searchable), the topic estimated, the text reconstructed. One
    // text-engine call; `keep` files the result docstd-wrapped as CLEAN <DOC> in the LOREPACK.
    if (textOnly && /^\/(cleandata|clean)(\s|$)/i.test(text)) {
      input.value = '';
      if (!window.cleandata) { print('SYSTEM', "CLEANDATA IS OFFLINE IN THIS BUILD (src/js/cleandata.js)."); return; }
      var cdArg = text.replace(/^\/(cleandata|clean)/i, '').trim();
      if (!cdArg) { print('SYSTEM', window.cleandata.help()); return; }
      var cdRaw = null, cdName = null;
      if (/^::/.test(cdArg)) {
        cdRaw = cdArg.replace(/^::/, '').trim();
      } else {
        var cdKeep = /\s+keep\s*$/i.test(cdArg);
        var cdTarget = cdArg.replace(/\s+keep\s*$/i, '').trim();
        cdName = window.cleandata.resolveName(cdTarget);
        if (!cdName) { print('SYSTEM', "CLEANDATA :: NO DOCUMENT CALLED \"" + String(cdTarget || "").toUpperCase() + "\" - /lore LISTS THEM, OR PASTE TEXT AFTER ::"); return; }
        cdRaw = await window.cleandata.rawOf(cdName);
        if (cdRaw == null) { print('SYSTEM', "CLEANDATA :: THE STORED TEXT OF " + cdName + " COULD NOT BE READ."); return; }
        var cdRes = await window.cleandata.clean(cdRaw, cdName);
        if (!cdRes.ok) { print('SYSTEM', cdRes.error); return; }
        if (cdKeep) {
          var cdFiled = await window.cleandata.keepAs(cdName, cdRes.formatted);
          print('SYSTEM', cdFiled.ok ? ("CLEANDATA :: FILED AS " + cdFiled.name + " - CLEANED, TAGGED, INDEXED, DOCSTD-WRAPPED.\n\n" + cdRes.formatted) : cdFiled.error);
          return;
        }
        print('SYSTEM', "CLEANDATA :: " + cdName + " (NOTHING FILED - ADD keep TO FILE IT).\n\n" + cdRes.formatted);
        return;
      }
      var cdInline = await window.cleandata.clean(cdRaw, "pasted text");
      print('SYSTEM', cdInline.ok ? cdInline.formatted : cdInline.error);
      return;
    }

    // CUSTOM COMMAND: /progress [demo [STEPS [MS]] | clear]
    // THE PROGRESS BAR (src/js/progress.js) - the thin green line at the top of the lower deck. It
    // needs no command to work: a job opens one and closes it, and the rail appears and goes by
    // itself. What this is for is asking WHAT IS RUNNING right now (which is otherwise visible only
    // by looking at the bar), taking the rail down if a job died without saying it had finished, and
    // SEEING IT AT WORK without waiting for real work - `demo` runs a fake job through the same door
    // every real one uses, so the bar can be looked at on a phone in three seconds.
    if (textOnly && /^\/progress(\s|$)/i.test(text)) {
      input.value = '';
      if (!window.progress) { print('SYSTEM', "THE PROGRESS MODULE IS OFFLINE (src/js/progress.js)."); return; }
      var pgArg = text.replace(/^\/progress/i, '').trim();
      var pgLow = pgArg.toLowerCase();
      if (pgLow === 'demo' || pgLow.indexOf('demo ') === 0) {
        var pgBits = pgArg.split(/\s+/).slice(1);
        print('SYSTEM', "PROGRESS DEMO :: WATCH THE TOP OF THE LOWER DECK - A FAKE JOB THROUGH THE SAME DOOR EVERY REAL ONE USES.");
        print('SYSTEM', await window.progress.demo(pgBits[0], pgBits[1]));
        return;
      }
      if (pgLow === 'clear' || pgLow === 'reset' || pgLow === 'off' || pgLow === 'stop') {
        window.progress.clear();
        print('SYSTEM', "PROGRESS :: THE RAIL IS TAKEN DOWN. NOTHING IS BEING RECORDED AND NOTHING WAS UNDONE - THE BAR IS A LOOK AT THE MACHINERY, NOT A JOB.");
        return;
      }
      print('SYSTEM', window.progress.report());
      return;
    }

    // CUSTOM COMMAND: /batch [status | stop | help]
    // THE BATCH (src/js/batch.js) is mostly hands - a tick box in a picture's caption bar, a bar
    // under the line, a window that takes one picture across by itself. This is the part of it that
    // is worth asking for in words: what a send is doing, and how to abandon the rest of one.
    if (textOnly && /^\/batch(\s|$)/i.test(text)) {
      var btArg = text.replace(/^\/batch/i, "").trim().toLowerCase();
      input.value = '';
      if (!window.batch) { print('SYSTEM', "THE BATCH MODULE IS OFFLINE (src/js/batch.js)."); return; }
      if (btArg === 'help') { print('SYSTEM', window.batch.help()); return; }
      if (btArg === 'stop' || btArg === 'cancel' || btArg === 'abandon') { window.batch.stop(); return; }
      print('SYSTEM', window.batch.report());
      return;
    }

    // CUSTOM COMMAND: /heart [good | pass | clear] [R12 | #tag | WORDS | (nothing = the stage)]
    // THE HEART (src/js/likes.js) - his mark on a picture, kept on the record and told to her on
    // every turn. With no argument it prints the record of what he has marked; with a verb it marks
    // one picture from the keyboard, which is the same mark the heart on every card makes.
    if (textOnly && /^\/hearts?(\s|$)/i.test(text)) {
      var hArg = text.replace(/^\/hearts?/i, "").trim();
      input.value = '';
      if (!window.likes) { print('SYSTEM', "THE HEART MODULE IS OFFLINE (src/js/likes.js)."); return; }
      if (!hArg) { print('SYSTEM', window.likes.report()); return; }
      var hVerb = '', hWhat = '';
      var hM = hArg.match(/^(good|like|liked|love|pass|passed|no|bad|clear|off|none)\b\s*([\s\S]*)$/i);
      if (hM) { hVerb = hM[1].toLowerCase(); hWhat = (hM[2] || '').trim(); }
      else { print('SYSTEM', "USAGE: /heart \u00b7 /heart good <WHAT> \u00b7 /heart pass <WHAT> \u00b7 /heart clear <WHAT>\nWHAT IS A RENDER NUMBER (R12), A #TAG, SOME WORDS OF ITS PROMPT, OR NOTHING FOR THE PICTURE ON THE STAGE.\n" + window.likes.help()); return; }
      var hVal = /^(good|like|liked|love)$/.test(hVerb) ? "good" : (/^(pass|passed|no|bad)$/.test(hVerb) ? "pass" : "");
      var hIds = [];
      if (!hWhat) {
        if (window.lightboxId && window.media.get(window.lightboxId)) hIds = [window.lightboxId];
        else { print('SYSTEM', "HEART :: NOTHING IS ON THE STAGE. NAME THE PICTURE - /heart " + hVerb + " R12, /heart " + hVerb + " #tag, OR /heart " + hVerb + " SOME WORDS OF ITS PROMPT."); return; }
      } else if (/^r?\d+$/i.test(hWhat)) {
        // A RENDER NUMBER (R12, or just 12) is the label the render book prints - the same one
        // `/renders R12` takes, so the picture he is looking at in the book is the one he can mark.
        var hRow = null;
        try { hRow = (window.renderBook && window.renderBook.row) ? await window.renderBook.row(hWhat) : null; } catch (e) { hRow = null; }
        if (!hRow && window.renderBook && window.renderBook.byNumber) { try { hRow = window.renderBook.byNumber(hWhat); } catch (e) { hRow = null; } }
        var hRowId = hRow ? (hRow.id || (hRow.rec && hRow.rec.id) || hRow.mediaId || '') : '';
        if (hRowId) hIds = [hRowId];
      } else if (/^#/.test(hWhat)) {
        var hTag = window.media.normTag ? window.media.normTag(hWhat) : hWhat.slice(1).toLowerCase();
        hIds = window.media.list().filter(function (mid) {
          var mr = window.media.get(mid);
          return mr && Array.isArray(mr.tags) && mr.tags.indexOf(hTag) !== -1;
        }).reverse().slice(0, LIA_HEART_MAX);
      } else {
        var hNeedle = hWhat.toLowerCase();
        hIds = window.media.list().filter(function (mid) {
          var mr = window.media.get(mid) || {};
          return String(mr.prompt || mr.name || '').toLowerCase().indexOf(hNeedle) !== -1;
        }).reverse().slice(0, LIA_HEART_MAX);
      }
      if (!hIds.length) { print('SYSTEM', "HEART :: NOTHING IN THE VAULT MATCHES \u201c" + hWhat + "\u201d - /heart PRINTS WHAT IS MARKED, AND /gallery IS EVERYTHING."); return; }
      for (var hi = 0; hi < hIds.length; hi++) await window.likes.mark(hIds[hi], hVal);
      if (window.lightboxId && hIds.indexOf(window.lightboxId) !== -1 && window.likes.paintStage) window.likes.paintStage(window.lightboxId);
      return;
    }

    // CUSTOM COMMAND: /idea [DIE | DIMENSION | dice | list | held | scene | drop X | clear | add X :: PHRASE | forget X :: PHRASE]
    // THE SHOT LIST (src/js/idea.js, rolled from the lists in main.pjs). Every list there is one
    // dimension of a picture; a roll draws one item from each and glues them into a prompt, which is
    // written straight into the forge boxes. A DIE rolls one group of dimensions, a DIMENSION re-rolls
    // only itself and leaves every other one exactly where it is - which is how a subject, a setting
    // or a camera is held across a run of stills.
    if (textOnly && /^\/ideas?(\s|$)/i.test(text)) {
      var idArg = text.replace(/^\/ideas?/i, "").trim();
      input.value = '';
      if (!window.idea) { print('SYSTEM', "THE SHOT LIST MODULE IS OFFLINE (src/js/idea.js)."); return; }
      if (!idArg || /^(roll|all|every)$/i.test(idArg)) {
        if (window.forgeBook && window.forgeBook.roll) window.forgeBook.roll('all');
        else print('SYSTEM', "THE FORGE IS NOT LOADED HERE, SO THE ROLL CANNOT BE WRITTEN INTO THE BOXES.");
        return;
      }
      var idLow = idArg.toLowerCase();
      if (idLow === 'help') { print('SYSTEM', window.idea.help()); return; }
      if (idLow === 'dice' || idLow === 'die') { print('SYSTEM', window.idea.diceReport()); return; }
      if (idLow === 'list' || idLow === 'lists' || idLow === 'dimensions' || idLow === 'dims') { print('SYSTEM', window.idea.listReport()); return; }
      if (idLow === 'held' || idLow === 'chips' || idLow === 'now') { print('SYSTEM', window.idea.report('SHOT LIST :: WHAT IS HELD')); return; }
      if (idLow === 'scene' || idLow === 'title') {
        var idScene = window.idea.sceneTitle(window.idea.values());
        print('SYSTEM', idScene ? 'SCENE   ' + idScene.toUpperCase() : 'SHOT LIST :: NOTHING IS HELD, SO THERE IS NOTHING TO NAME.');
        return;
      }
      if (idLow === 'clear' || idLow === 'forget all') {
        window.idea.clear();
        print('SYSTEM', 'SHOT LIST :: THE ROLL IS FORGOTTEN. THE BOXES ARE LEFT EXACTLY AS THEY ARE (THE PROMPT IS YOURS, NOT THE ROLL\u2019S).');
        if (window.forgeBook && window.forgeBook.ideaRow) window.forgeBook.ideaRow();
        return;
      }
      var idDrop = idArg.match(/^(?:drop|off|remove)\s+(.+)$/i);
      if (idDrop) {
        var idDropped = window.idea.drop(idDrop[1]);
        print('SYSTEM', idDropped
          ? 'SHOT LIST :: ' + idDrop[1].toUpperCase() + ' IS OUT OF THE ROLL AND OUT OF THE PROMPT.'
          : 'SHOT LIST :: NOTHING HELD CALLED "' + idDrop[1].toUpperCase() + '" - /idea held PRINTS WHAT IS HELD.');
        if (!idDropped) return;
        window.idea.save();
        if (window.forgeBook && window.forgeBook.write) {
          window.forgeBook.write(window.idea.compose(window.idea.values(), 'prompt'), window.idea.compose(window.idea.values(), 'negative'));
        }
        return;
      }
      var idAdd = idArg.match(/^(add|file|learn)\s+([^:]+?)\s*::\s*([\s\S]+)$/i);
      if (idAdd) {
        var idRes = await window.idea.addPhrase(idAdd[2].trim(), idAdd[3].trim().replace(/\s+/g, ' '));
        print('SYSTEM', idRes.ok
          ? 'SHOT LIST :: ADDED TO ' + idRes.list.toUpperCase() + ' :: "' + idAdd[3].trim() + '"\nIT IS DRAWN LIKE ANY ITEM OF THAT DIMENSION FROM NOW ON, ONE CHANCE IN ITS OWN RIGHT ALONGSIDE THE SHIPPED ONES.'
          : 'SHOT LIST :: NOT ADDED :: ' + idRes.why + (idRes.list ? ' (' + idRes.list + ')' : '') + '.');
        if (idRes.ok && window.forgeBook && window.forgeBook.ideaRow) window.forgeBook.ideaRow();
        return;
      }
      var idForget = idArg.match(/^(forget|unadd|drop phrase)\s+([^:]+?)\s*::\s*([\s\S]+)$/i);
      if (idForget) {
        var idOk = await window.idea.forgetPhrase(idForget[2].trim(), idForget[3].trim());
        print('SYSTEM', idOk
          ? 'SHOT LIST :: "' + idForget[3].trim() + '" IS OUT OF ' + idForget[2].trim().toUpperCase() + ' AND OUT OF THE DRAW.'
          : 'SHOT LIST :: THAT PHRASE WAS NOT IN THAT DIMENSION.');
        return;
      }
      if (window.forgeBook && window.forgeBook.roll) window.forgeBook.roll(idArg);
      else if (!window.idea.rollDie(idArg) && !window.idea.rollOne(idArg)) {
        print('SYSTEM', 'SHOT LIST :: NO DIMENSION OR DIE CALLED "' + idArg.toUpperCase() + '".'
          + '\nTHE DIMENSIONS :: ' + window.idea.names().join(', ')
          + '\n/idea dice PRINTS THE GROUPS.');
      }
      return;
    }

    // CUSTOM COMMAND: /renders [N | find <WORDS> | tag <TAG> | seed <N> | turn <N> | recent [N] | redo <R#> | export]
    // THE RENDER BOOK (src/js/renderbook.js). Every picture MADE here, numbered R1..Rn, each row
    // carrying the exact recipe it was made from - the prompt, the words actually sent, the
    // negative list, the seed, the guidance, the size, the pose, the tags - plus the stamp it was
    // stored under and the turn it came from. That is what makes a picture repeatable, and `redo`
    // is the point of the whole book: it puts a row's recipe back into the forge form.
    if (textOnly && /^\/renders?(\s|$)/i.test(text)) {
      var rbArg = text.replace(/^\/renders?/i, "").trim();
      input.value = '';
      if (!window.renderBook) { print('SYSTEM', "THE RENDER BOOK MODULE IS OFFLINE."); return; }
      if (!rbArg) { print('SYSTEM', window.renderBook.describe()); return; }
      var rbLow = rbArg.toLowerCase();
      if (rbLow === "export" || rbLow === "save") { await window.renderBook.exportBook(); return; }
      if (rbLow === "stats" || rbLow === "report" || rbLow === "describe") { print('SYSTEM', window.renderBook.describe()); return; }
      var rbRedo = rbArg.match(/^(?:redo|again|rerun|re-run|reload|recall)\s+(.+)$/i);
      if (rbRedo) {
        var rbR = await window.renderBook.redo(rbRedo[1]);
        print('SYSTEM', rbR.ok
          ? "RENDER BOOK :: " + rbR.row.label + " IS IN THE FORGE FORM :: ITS EXACT PROMPT, NEGATIVE LIST, SEED"
            + (rbR.seed ? " (" + rbR.seed + ")" : " (none on the record - one will be rolled)") + ", GUIDANCE AND SIZE."
            + "\nCREATE RUNS IT EXACTLY AS IT WAS. CHANGE THE SEED TO TUNE THE SAME PICTURE, OR THE PROMPT TO VARY IT. NOTHING HAS BEEN RENDERED YET."
          : "RENDER BOOK :: " + rbR.error);
        return;
      }
      var rbTag = rbArg.match(/^tags?\s+(.+)$/i) || rbArg.match(/^(#[\w-]{1,32})$/);
      if (rbTag) {
        var rbTagRows = await window.renderBook.find(rbTag[1]);
        print('SYSTEM', window.renderBook.report(rbTagRows, {
          head: "THE RENDER BOOK :: " + rbTagRows.length + " ROW" + (rbTagRows.length === 1 ? "" : "S")
            + " MATCHING " + rbTag[1].toUpperCase().replace(/^#/, "#") + " \u00b7 TAGS COME OFF THE FULL STAGE IN THE GALLERY"
        }));
        return;
      }
      var rbFolder = rbArg.match(/^(?:folders?|in|dir)\s+(\S+)$/i);
      if (rbFolder) {
        var rbFolderRows = await window.renderBook.find("folder:" + rbFolder[1]);
        print('SYSTEM', window.renderBook.report(rbFolderRows, {
          head: "THE RENDER BOOK :: EVERYTHING IN " + (window.media ? window.media.normFolder(rbFolder[1]) : rbFolder[1]).toUpperCase()
            + " \u00b7 " + rbFolderRows.length + " ROW" + (rbFolderRows.length === 1 ? "" : "S")
            + " \u00b7 /folder LISTS THE FOLDERS"
        }));
        return;
      }
      var rbSeed = rbArg.match(/^seed\s+#?(\d+)$/i);
      if (rbSeed) {
        var rbSeedRows = await window.renderBook.find("seed " + rbSeed[1]);
        print('SYSTEM', window.renderBook.report(rbSeedRows, {
          head: "THE RENDER BOOK :: SEED " + rbSeed[1] + " \u00b7 " + rbSeedRows.length + " ROW" + (rbSeedRows.length === 1 ? "" : "S")
        }));
        return;
      }
      var rbTurn = rbArg.match(/^turn\s+#?(\d+)$/i);
      if (rbTurn) {
        var rbTurnRows = await window.renderBook.find("turn " + rbTurn[1]);
        print('SYSTEM', window.renderBook.report(rbTurnRows, {
          head: "THE RENDER BOOK :: EVERYTHING MADE IN TURN #" + rbTurn[1] + " \u00b7 " + rbTurnRows.length + " ROW" + (rbTurnRows.length === 1 ? "" : "S")
        }));
        return;
      }
      var rbFind = rbArg.match(/^(?:find|search|for)\s+(.+)$/i);
      var rbQuery = rbFind ? rbFind[1].trim() : (/^(?:all|everything)$/i.test(rbArg) ? "" : rbArg);
      var rbRecent = rbArg.match(/^(?:recent|last|newest)(?:\s+(\d+))?$/i);
      if (rbRecent) {
        var rbRows = await window.renderBook.sheet();
        rbRows.reverse();
        print('SYSTEM', window.renderBook.report(rbRows, {
          limit: Math.min(40, parseInt(rbRecent[1], 10) || 12),
          head: "THE RENDER BOOK :: THE NEWEST RENDERS FIRST"
        }));
        return;
      }
      if (/^[r#]?\d+$/i.test(rbArg)) {
        var rbOne = await window.renderBook.row(rbArg);
        print('SYSTEM', rbOne ? window.renderBook.rowText(rbOne, true)
          : "RENDER BOOK :: NO ROW " + rbArg.toUpperCase() + " - /renders LISTS THE NUMBERS (THE OLDEST IS R1).");
        return;
      }
      if (/^(?:all|everything)$/i.test(rbArg) || rbFind) {
        var rbHits = await window.renderBook.find(rbFind ? rbQuery : "");
        print('SYSTEM', window.renderBook.report(rbHits, {
          limit: rbFind ? 20 : 40,
          head: rbFind
            ? "THE RENDER BOOK :: \"" + rbQuery.toUpperCase() + "\" \u00b7 " + rbHits.length + " ROW" + (rbHits.length === 1 ? "" : "S")
              + " (EVERY WORD HAS TO MATCH: PROMPT, WHAT WAS SENT, THE NEGATIVE LIST, THE TAGS, THE FILE NAME, THE POSE, AND WHAT THE TWO OF YOU WERE SAYING)"
            : "THE RENDER BOOK :: EVERY ROW"
        }));
        return;
      }
      var rbGuess = await window.renderBook.find(rbArg);
      if (rbGuess.length) {
        print('SYSTEM', window.renderBook.report(rbGuess, {
          limit: 20, head: "THE RENDER BOOK :: \"" + rbArg.toUpperCase() + "\" \u00b7 " + rbGuess.length + " ROW" + (rbGuess.length === 1 ? "" : "S")
        }));
        return;
      }
      print('SYSTEM', "USAGE: /renders \u00b7 /renders all \u00b7 /renders find <WORDS> \u00b7 /renders tag <TAG> \u00b7 /renders seed <N> \u00b7 /renders turn <N> \u00b7 /renders recent [N] \u00b7 /renders R12 \u00b7 /renders redo R12 \u00b7 /renders export"
        + "\nNOTHING MATCHED \"" + rbArg.toUpperCase() + "\". THE BOOK HOLDS EVERY PICTURE MADE HERE WITH THE EXACT PROMPT, NEGATIVE LIST, SEED, GUIDANCE AND SIZE THAT MADE IT - SO A PICTURE CAN BE MADE AGAIN.");
      return;
    }

    // CUSTOM COMMAND: /keep [R12 | <WORDS|#TAG|VAULT ID> | link [WHAT] | list | report | help]
    // KEEP (src/js/keepsake.js) - the other half of SAVE. SAVE (the button under a picture, SAVE TO
    // DEVICE on the full stage) writes the FILE to this machine's Downloads folder; KEEP writes what
    // MADE it into the RECORD: the prompt and the negative list into the RECIPE BOOK, the seed, the
    // guidance and the size with them as (seed:::N) (guidanceScale:::N) (resolution:::WxH) tags, a
    // #kept tag on the picture in the gallery, and a link - https://perchance.org/<name>#gallery=<id>
    // - that opens the gallery on it. The KEEP button under a picture is the same act, and nothing
    // here touches the download lane.
    if (textOnly && /^\/keep(\s|$)/i.test(text)) {
      var kpArg = text.replace(/^\/keep/i, "").trim();
      input.value = '';
      if (!window.keepsake) { print('SYSTEM', "THE KEEPSAKE MODULE IS OFFLINE (src/js/keepsake.js)."); return; }
      if (/^(help|\?)$/i.test(kpArg)) { print('SYSTEM', window.keepsake.describe()); return; }
      if (/^(list|report|kept|status)$/i.test(kpArg)) { await window.keepsake.report(); return; }
      var kpLink = kpArg.match(/^link(?:\s+(.+))?$/i);
      if (kpLink) {
        var kpWhat = String(kpLink[1] || "").trim();
        if (kpWhat) {
          var kpT = await window.keepsake.resolve(kpWhat);
          if (!kpT.ids.length) { print('SYSTEM', 'KEEP :: NOTHING HERE MATCHES "' + kpWhat.toUpperCase() + "\" - /keep link R12 \u00b7 /keep link <WORDS> \u00b7 OR NOTHING FOR THE PICTURE ON THE STAGE."); return; }
          window.keepsake.showLink(kpT.ids[kpT.ids.length - 1]);
        } else if (window.lightboxId) {
          window.keepsake.showLink(window.lightboxId);
        } else {
          var kpN = await window.keepsake.resolve("");
          if (!kpN.ids.length) { print('SYSTEM', "KEEP :: NOTHING ON THE STAGE AND NOTHING MADE YET - /renders LISTS WHAT THERE IS."); return; }
          window.keepsake.showLink(kpN.ids[kpN.ids.length - 1]);
        }
        return;
      }
      await window.keepsake.keepWhat(kpArg);
      return;
    }

    // CUSTOM COMMAND: /folder [list | new <PATH> | open <PATH> | file <PATH> <WHAT> | rename <OLD> <NEW> | drop <PATH> | defaults]
    // THE MEDIA FOLDERS (src/js/vault.js). The vault is kept in folders and a folder is a PATH -
    // /images, /music, /clips, /images/portraits - so "media folders including /music" is a thing
    // you type rather than a thing that is implied. Everything has a home whether or not anyone
    // filed it (the defaults below), a folder can exist while empty, and SHE can make folders and
    // file her own pictures with [[FOLDER: /name]] / [[FILE: /name]].
    if (textOnly && /^\/(folders?|dirs?|mediafolders)(\s|$)/i.test(text)) {
      var foArg = text.replace(/^\/(folders?|dirs?|mediafolders)/i, "").trim();
      input.value = '';
      if (!window.media) { print('SYSTEM', "THE VAULT MODULE IS OFFLINE."); return; }
      var foParts = foArg.split(/\s+/).filter(Boolean);
      var foVerb = String(foParts[0] || "").toLowerCase();
      var foRest = foParts.slice(1).join(" ").trim();
      var foList = window.media.allFolders();
      var foTree = function () {
        return "THE MEDIA FOLDERS :: " + foList.length + " FOLDER" + (foList.length === 1 ? "" : "S") + " HOLDING "
          + window.media.stats().count + " ITEM" + (window.media.stats().count === 1 ? "" : "S") + "\n"
          + foList.map(function (f) {
            return "  " + f.path + "  " + f.count + (f.made ? "" : "  (the default for what it holds)");
          }).join("\n");
      };
      if (!foArg || foVerb === "list" || foVerb === "tree") {
        print('SYSTEM', foTree()
          + "\n/folder new <PATH> MAKES ONE \u00b7 /folder open <PATH> SHOWS ONLY THAT ONE \u00b7 /folder file <PATH> <R12|#TAG|WORDS> FILES THINGS INTO IT \u00b7 /folder rename <OLD> <NEW> \u00b7 /folder drop <PATH>"
          + "\nSHE MAY MAKE FOLDERS AND FILE HER OWN PICTURES TOO ([[FOLDER: /name]], [[FILE: /name]]). NOTHING IS EVER UPLOADED, AND FILING CHANGES ONE FIELD ON A RECORD - NO FILE IS COPIED.");
        return;
      }
      if (/^(new|create|make|mkdir|add)$/.test(foVerb)) {
        if (!foRest) { print('SYSTEM', "USAGE: /folder new <PATH> - e.g. /folder new music (or /music), /folder new images/portraits"); return; }
        var foMk = await window.media.createFolder(foRest, { by: "you" });
        print('SYSTEM', foMk.ok
          ? (foMk.existed
            ? "THE FOLDER " + foMk.path + " IS ALREADY HERE :: A FOLDER CAN BE EMPTY AND STILL EXIST, WHICH IS THE POINT OF ONE."
            : "FOLDER MADE :: " + foMk.path + " :: IT EXISTS NOW, EMPTY OR NOT.\n" + foTree()
              + "\nFILE THINGS INTO IT FROM THE GALLERY (SELECT, PICK THE FOLDER, FILE SELECTED) OR WITH /folder file " + foMk.path + " R12.")
          : "A FOLDER NEEDS A NAME :: " + foMk.error);
        return;
      }
      if (foVerb === "open" || foVerb === "show") {
        if (!foRest) { print('SYSTEM', "USAGE: /folder open <PATH>"); return; }
        var foP = window.media.normFolder(foRest);
        if (!foP) { print('SYSTEM', "USAGE: /folder open <PATH> - a path, like /music or /images/portraits"); return; }
        if (window.gallery) {
          await window.gallery.open({ folder: foP });
          var foS = window.gallery.state();
          print('SYSTEM', "THE GALLERY IS OPEN, SHOWING " + foP + " :: " + foS.shown + " OF " + foS.vault + " ITEM" + (foS.vault === 1 ? "" : "S") + " IN THE VAULT.");
        } else { print('SYSTEM', "THE GALLERY MODULE IS OFFLINE."); }
        return;
      }
      if (/^(file|move|put)$/.test(foVerb)) {
        if (!foRest) { print('SYSTEM', "USAGE: /folder file <PATH> <R12|#TAG|WORDS>\nFILES WHAT YOU NAME INTO THE FOLDER. EVERYTHING IS FILED BY A PATH, THE SAME WAY SHE DOES IT."); return; }
        var foSplit = foRest.match(/^(\S+)\s+([\s\S]+)$/);
        var foPath = window.media.normFolder(foSplit ? foSplit[1] : foRest);
        var foWhat = foSplit ? foSplit[2].trim() : "";
        if (!foPath || !foWhat) { print('SYSTEM', "USAGE: /folder file <PATH> <R12|#TAG|WORDS>\nEXAMPLES: /folder file /music R12 \u00b7 /folder file /images/portraits #night \u00b7 /folder file /images cathedral"); return; }
        var foGot = await window.reader.targets(foWhat, { max: 60 });
        if (!foGot.ids.length) { print('SYSTEM', "NOTHING MATCHED \"" + foWhat.toUpperCase() + "\" :: /renders LISTS THE BOOK BY ROW NUMBER, AND /gallery FIND <WORDS> SEARCHES THE VAULT."); return; }
        var foFil = await window.media.fileMany(foGot.ids, foPath, { by: "you" });
        print('SYSTEM', foFil.ok
          ? "FILED " + foFil.filed.length + " ITEM" + (foFil.filed.length === 1 ? "" : "S") + " INTO " + foFil.path + "\n"
            + foFil.filed.map(function (id) {
              var r = window.media.get(id);
              var lbl = (window.renderBook && window.renderBook.labelOf) ? window.renderBook.labelOf(id) : "";
              return "  " + (lbl ? lbl + " " : "") + window.media.recordLabel(r);
            }).join("\n")
          : "NOTHING WAS FILED :: " + foFil.error);
        return;
      }
      if (foVerb === "rename" || foVerb === "mv") {
        var foPair = foRest.match(/^(\S+)\s+(\S+)$/);
        if (!foPair) { print('SYSTEM', "USAGE: /folder rename <OLD> <NEW> - EVERYTHING IN IT (AND IN ITS SUBFOLDERS) MOVES WITH IT."); return; }
        var foRn = await window.media.renameFolder(foPair[1], foPair[2]);
        print('SYSTEM', foRn.ok
          ? "FOLDER RENAMED :: " + (foRn.from || "") + " \u2192 " + foRn.path + " :: " + foRn.moved + " ITEM" + (foRn.moved === 1 ? "" : "S") + " MOVED WITH IT."
          : "FOLDER NOT RENAMED :: " + foRn.error);
        return;
      }
      if (/^(drop|remove|delete|rm)$/.test(foVerb)) {
        if (!foRest) { print('SYSTEM', "USAGE: /folder drop <PATH> - AN EMPTY FOLDER ONLY. FILE WHAT IS IN IT SOMEWHERE ELSE FIRST."); return; }
        var foRm = await window.media.removeFolder(foRest);
        print('SYSTEM', foRm.ok
          ? "FOLDER DROPPED :: " + foRm.path + " :: NOTHING IN IT WAS TOUCHED (THERE WAS NOTHING IN IT)."
          : "FOLDER NOT DROPPED :: " + foRm.error);
        return;
      }
      if (foVerb === "defaults" || foVerb === "default") {
        var foDef = window.media.defaultFolder({});
        print('SYSTEM', "THE DEFAULT FOLDERS :: A RECORD WITH NO FOLDER OF ITS OWN FALLS BACK TO THESE - CONFIGURED AS LIA_MEDIA_FOLDERS IN src/js/config.js."
          + "\n  PICTURES (hers, yours, imported): " + window.media.defaultFolder({ mime: "image/jpeg", kind: "attach" })
          + "\n  MUSIC (audio): " + window.media.defaultFolder({ mime: "audio/mpeg" })
          + "\n  CLIPS (video): " + window.media.defaultFolder({ kind: "video" })
          + "\n  UPSCALED: " + window.media.defaultFolder({ kind: "upscale" })
          + "\nSO NOTHING IS EVER UNFILED, AND /music IS A REAL FOLDER FROM THE FIRST BOOT.");
        return;
      }
      // A bare PATH opens it: /folder /music
      var foGuess = window.media.normFolder(foArg);
      if (foGuess && window.gallery) {
        await window.gallery.open({ folder: foGuess });
        var foS2 = window.gallery.state();
        print('SYSTEM', "THE GALLERY IS OPEN, SHOWING " + foGuess + " :: " + foS2.shown + " OF " + foS2.vault + ".");
        return;
      }
      print('SYSTEM', foTree()
        + "\nUSAGE: /folder \u00b7 /folder list \u00b7 /folder new <PATH> \u00b7 /folder open <PATH> \u00b7 /folder file <PATH> <R12|#TAG|WORDS> \u00b7 /folder rename <OLD> <NEW> \u00b7 /folder drop <PATH> \u00b7 /folder defaults");
      return;
    }

    // CUSTOM COMMAND: /read <WHAT>  (the read-only door onto everything saved here - src/js/reader.js)
    // SHE HAS THE SAME DOOR as a [[READ: ...]] line in her reply. This is his side of it, and it
    // prints the same answer she would get.
    if (textOnly && /^\/(read|data|records)(\s|$)/i.test(text)) {
      var rdArg = text.replace(/^\/(read|data|records)/i, "").trim();
      input.value = '';
      if (!window.reader) { print('SYSTEM', "THE READER MODULE IS OFFLINE."); return; }
      if (!rdArg) { print('SYSTEM', window.reader.describe()); return; }
      print('SYSTEM', await window.reader.report(rdArg));
      return;
    }

    // CUSTOM COMMAND: /focus [<DOCUMENT|WORDS> | clear | list]  - the keyboard half of SEE in the
    // DOCS panel. ONE document, put in focus: read out of the store and handed to her whole with
    // the next message, spent once she has answered. Bare, it says what is in focus.
    if (textOnly && /^\/focus(\s|$)/i.test(text)) {
      var foArg = text.replace(/^\/focus/i, "").trim();
      if (/^(it|that|this|them|one|thing|stuff)$/i.test(foArg)) {
        print('SYSTEM', "FOCUS :: WHICH DOCUMENT? '" + foArg.toUpperCase() + "' NAMES NOTHING - /focus <DOCUMENT|WORDS>. THE LINE IS STILL IN THE BOX.");
        return;
      }
      input.value = '';
      if (!window.lore || !window.lore.focus) { print('SYSTEM', "THE LOREPACK MODULE IS OFFLINE (src/js/lore.js)."); return; }
      if (!foArg || /^(list|status|\?)$/i.test(foArg)) {
        var foNow = window.lore.focused();
        if (foNow && foNow.part) {
          var foTotal = 0;
          try {
            if (window.lore.passages) {
              var foMap = await window.lore.passages(foNow.name);
              if (foMap) foTotal = foMap.count;
            }
          } catch (e) {}
          print('SYSTEM', "IN FOCUS :: " + foNow.name + (foNow.known ? "" : " :: THAT DOCUMENT IS NOT IN THE INDEX ANY MORE - SHE WILL BE TOLD IT IS GONE, AND NOTHING ELSE ABOUT IT")
            + "\nPART " + foNow.part + (foTotal ? " OF " + foTotal : "") + " IS HANDED TO HER WITH YOUR NEXT MESSAGE, IN FULL, ONCE (/focus <NAME> part N TURNS THE PAGE). /focus clear TAKES IT OUT; THE SEE BUTTON IN THE DOCS PANEL IS THE SAME DOOR.");
        } else {
          print('SYSTEM', foNow
            ? "IN FOCUS :: " + foNow.name + (foNow.known ? "" : " :: THAT DOCUMENT IS NOT IN THE INDEX ANY MORE - SHE WILL BE TOLD IT IS GONE, AND NOTHING ELSE ABOUT IT")
              + "\n" + (foNow.whole ? "THE WHOLE DOCUMENT IS" : "THE FIRST " + foNow.cap + " CHARS OF IT ARE") + " HANDED TO HER WITH YOUR NEXT MESSAGE, IN FULL, ONCE (/focus <NAME> part N HANDS ONE NUMBERED PASSAGE INSTEAD - THE ORIGINAL STAYS WHOLE). /focus clear TAKES IT OUT; THE SEE BUTTON IN THE DOCS PANEL IS THE SAME DOOR."
            : "NOTHING IS IN FOCUS.\n/focus <DOCUMENT|WORDS> [part N] PUTS ONE THERE - THE WHOLE DOCUMENT (OR ONE NUMBERED PASSAGE OF IT) IS HANDED TO HER WITH YOUR NEXT MESSAGE, AS WHAT SHE IS LOOKING AT (ONE AT A TIME, SPENT WHEN SHE ANSWERS). THE SEE BUTTON IN THE DOCS PANEL DOES IT WITH A CLICK.");
        }
        return;
      }
      if (/^(clear|off|none|out)$/i.test(foArg)) { await window.lore.clearFocus(false); return; }
      await window.lore.focus(foArg);
      return;
    }

    // CUSTOM COMMAND: /archivax <OP> ...  (the terminal's own agent - src/js/archivax.js)
    // SHE ORDERS THE SAME AGENT from inside her own reply, with [[ARCHIVAX: <OP> ...]]. This is his
    // side of the door, and there is no bound on it and no glass: the vault is his, so she will file,
    // tag and read anything he names, including the things he handed over himself. What she cannot be
    // made to do is not a matter of permission - there is no operation that deletes, runs code, or
    // reaches the network - and every op either of them orders is written into her journal.
    if (textOnly && /^\/(archivax|archiv)(\s|$)/i.test(text)) {
      var axArg = text.replace(/^\/(archivax|archiv)/i, "").trim();
      input.value = '';
      if (!window.archivax) { print('SYSTEM', "ARCHIVAX IS OFFLINE. SHE IS src/js/archivax.js - IF THAT FILE DID NOT LOAD, NOTHING HERE CAN ORDER HER."); return; }
      var axVerb = String(axArg.split(/\s+/)[0] || "").toLowerCase();
      if (!axArg || axVerb === "status" || axVerb === "report") { print('SYSTEM', window.archivax.reportOf(await window.archivax.status())); return; }
      if (axVerb === "help" || axVerb === "?" || axVerb === "ops" || axVerb === "list" || axVerb === "usage") { print('SYSTEM', window.archivax.describe()); return; }
      if (axVerb === "journal" || axVerb === "log" || axVerb === "history") {
        var axJ = window.archivax.journal();
        print('SYSTEM', axJ.length
          ? "ARCHIVAX :: HER JOURNAL, MOST RECENT LAST (" + axJ.length + " ENTRIES)\n" + axJ.slice(-30).map(function (j) {
            return "  [" + ((window.logTime && window.logTime.stamp) ? window.logTime.stamp(j.ts) : j.ts) + "] "
              + String(j.op).toUpperCase() + " BY " + String(j.by || "?").toUpperCase()
              + (j.n ? " :: " + j.n : "") + (j.note ? " :: " + j.note : "");
          }).join("\n")
          : "ARCHIVAX :: HER JOURNAL IS EMPTY :: NOTHING HAS BEEN ORDERED OF HER YET. /archivax OPS SHOWS WHAT CAN BE.");
        return;
      }
      // Everything else is an op. Reading pictures takes a moment each, so say so before the wait.
      print('SYSTEM', "ARCHIVAX IS WORKING :: " + axArg.toUpperCase()
        + ((axVerb === "read" || axVerb === "classify" || axVerb === "sweep") ? "\\nSHE IS READING PICTURES WITH THE VISION MODEL - ONE MOMENT EACH." : ""));
      await window.archivax.order(axArg, { by: "patrikios" });
      return;
    }

    // CUSTOM COMMAND: /backup [status | diag | help]  (src/js/backup.js)
    // THE SOURCE, OUT OF THE PAGE. The terminal only runs when every src/ file it loads is on
    // the server (a SAVE); a partial save is invisible from the editor and fatal everywhere else,
    // so this prints the save state and can hand over the whole source as a zip. Nothing here
    // uploads anything and nothing here saves the generator.
    if (textOnly && /^\/(backup|download|sourcezip)(\s|$)/i.test(text)) {
      var bkArg = text.replace(/^\/(backup|download|sourcezip)/i, "").trim().toLowerCase();
      input.value = '';
      if (!window.backup) { print('SYSTEM', "THE BACKUP MODULE IS OFFLINE. IT IS src/js/backup.js - IF THAT FILE DID NOT LOAD, THE ZIP CANNOT BE BUILT FROM HERE. THE SOURCE IS STILL WHOLE IN THE EDITOR'S FILE TREE."); return; }
      if (bkArg === "help" || bkArg === "?" || bkArg === "usage") {
        print('SYSTEM', "BACKUP :: THE GENERATOR'S OWN SOURCE, DOWNLOADED FROM THIS PAGE.\n"
          + "/backup              BUILD A ZIP OF EVERYTHING AND DOWNLOAD IT\n"
          + "/backup status       WHICH SOURCE FILES ARE ON THE SERVER AND WHICH HAVE NEVER BEEN SAVED\n"
          + "/backup diag         WHAT THIS DEVICE CAN AND CANNOT DO (THE IPAD QUESTION)\n"
          + "/backup autosave on  KEEP A SNAPSHOT OF EVERY CLEAN BUILD ON THIS DEVICE WHILE THE SOURCE IS NOT ALL ON THE SERVER YET\n"
          + "/backup kept         WHEN THE LAST SNAPSHOT WAS TAKEN, AND WHAT WAS IN IT\n"
          + "/backup pull         DOWNLOAD THE NEWEST KEPT SNAPSHOT\n"
          + "/backup autosave now TAKE ONE RIGHT NOW\n"
          + "\nTHE ZIP HOLDS main.pjs, index.html AND EVERY FILE UNDER src/ - TAKEN FROM THE PAGE RIGHT NOW, INCLUDING FILES THE SERVER HAS NOT BEEN GIVEN YET. NOTHING IS UPLOADED.\n"
          + "A BACKUP IS NOT A SAVE: ONLY THE EDITOR'S SAVE BUTTON PUTS THE WORK ON THE SERVER, AND UNTIL IT DOES, ANY OTHER DEVICE GETS 404s AND THE TERMINAL CANNOT START.");
        return;
      }
      if (bkArg === "status" || bkArg === "state") { print('SYSTEM', await window.backup.report()); return; }
      if (bkArg === "diag" || bkArg === "check" || bkArg === "doctor") { print('SYSTEM', await window.backup.reportDiag()); return; }
      // AUTOSAVE - the device-side insurance for unsaved work (src/js/backup.js, AUTOSAVE).
      if (/^(auto|autosave)(\s|$)/.test(bkArg)) { print('SYSTEM', await window.backup.autosaveCmd(bkArg.replace(/^(auto|autosave)\s*/, ""))); return; }
      if (bkArg === "kept") { print('SYSTEM', await window.backup.autosaveCmd("")); return; }
      if (bkArg === "snapshot" || bkArg === "now") { print('SYSTEM', await window.backup.autosaveCmd("now")); return; }
      if (bkArg === "pull" || bkArg === "keptzip" || bkArg === "restore") {
        try {
          var pl = await window.backup.pull();
          print('SYSTEM', "THE KEPT SNAPSHOT IS ON ITS WAY :: " + pl.name + " (" + Math.round(pl.bytes / 1024) + " KB, KEPT ON THIS DEVICE) - IT IS IN THIS MACHINE'S DOWNLOADS FOLDER. ATTACH IT HERE AND I CAN WRITE EVERY FILE BACK FROM IT.");
        } catch (e) {
          print('SYSTEM', "NO SNAPSHOT TO PULL :: " + String((e && e.message) || e).toUpperCase());
        }
        return;
      }
      print('SYSTEM', "BUILDING THE BACKUP :: READING " + (await window.backup.expectedFiles()).length + " SOURCE FILES ...");
      try {
        var bk = await window.backup.download();
        print('SYSTEM', "BACKUP WRITTEN :: " + bk.name + "  ::  " + bk.files + " FILES / " + fmtSize(bk.bytes)
          + " :: IT IS IN THIS MACHINE'S DOWNLOADS FOLDER AND NOTHING WAS UPLOADED." + (bk.ms ? "  (" + bk.ms + " MS)" : "")
          + (bk.stale ? "\n!! " + bk.stale : ""));
        if (bk.rootFailures && bk.rootFailures.length) print('SYSTEM', "THE ROOT FILES COULD NOT BE READ :: " + bk.rootFailures.join(", ") + "\nTHE ZIP HOLDS src/ BUT NOT A CURRENT main.pjs / index.html - TELL YOUR AGENT.");
        if (bk.errors && bk.errors.length) print('SYSTEM', "NOT READ INTO THE ZIP (" + bk.errors.length + ") :: " + bk.errors.join("  \u00b7  "));
        print('SYSTEM', bk.state.text);
      } catch (e) {
        print('SYSTEM', "THE BACKUP FAILED :: " + String((e && e.message) ? e.message : e).toUpperCase()
          + "\nNOTHING WAS UPLOADED AND NOTHING WAS CHANGED. IF THIS DEVICE CANNOT DOWNLOAD FILES AT ALL, /backup diag SAYS SO.");
      }
      return;
    }

    // CUSTOM COMMAND: /keeper [status | now | on | off | export [n] | restore <n> yes]  (src/js/keeper.js)
    // THE USER DATA, KEPT ON A SCHEDULE. /backup carries the source and /export + /sync + /cloud
    // carry the conversation out by hand - this is the part that runs by itself: the archive log,
    // every non-secret setting, the vault's manifest, newest five on this device, never uploaded.
    if (textOnly && /^\/(keeper|keepdata)(\s|$)/i.test(text)) {
      var kpArg = text.replace(/^\/(keeper|keepdata)/i, "").trim();
      input.value = '';
      if (!window.keeper) { print('SYSTEM', "THE KEEPER MODULE IS OFFLINE. IT IS src/js/keeper.js - IF THAT FILE DID NOT LOAD, NOTHING IS BEING KEPT ON A SCHEDULE; /export json AND /sync STILL CARRY THE CONVERSATION OUT BY HAND."); return; }
      print('SYSTEM', await window.keeper.words(kpArg));
      return;
    }

    // CUSTOM COMMAND: /sync [status | versions | pick | connect | up | down [NAME] | forget | help]
    // (src/js/sync.js) THE CONVERSATION OUT OF THIS BROWSER. The vault keeps the pictures and /backup
    // keeps the source, but the archive - the turns themselves, the newest 1000 of them - lives in
    // this browser and nowhere else: PURGE, a cleared profile or a new machine takes every word of
    // it. The backups he keeps on his own drive (G:) are the other half, and this is the door onto
    // them: PICK reads the folder and takes the newest backup in on its own, UP writes the whole
    // conversation out as one JSON file, and the merge only ever ADDS - a turn it already holds is
    // left exactly as it is, with the backup allowed to fill in only what is missing (her half, a
    // stamp). Nothing is uploaded and nothing on disk is deleted. PICK and CONNECT have to be a real
    // gesture - a browser opens a folder dialog only for the user's own action, and typing this and
    // pressing Enter is one.
    if (textOnly && /^\/(sync|versions|drive)(\s|$)/i.test(text)) {
      if (!window.sync) { print('SYSTEM', "THE SYNC MODULE IS OFFLINE. IT IS src/js/sync.js - IF THAT FILE DID NOT LOAD, TELL YOUR AGENT; /backup CAN STILL HAND OVER THE SOURCE."); return; }
      var syArg = text.replace(/^\/(sync|versions|drive)/i, "").trim();
      input.value = '';
      var syOut = "";
      try { syOut = await window.sync.run(syArg); }
      catch (e) { syOut = "THE SYNC FAILED :: " + String((e && e.message) ? e.message : e).toUpperCase() + "\nNOTHING WAS UPLOADED AND NOTHING ON DISK WAS TOUCHED."; }
      if (syOut) print('SYSTEM', String(syOut));
      return;
    }

    // CUSTOM COMMAND: /hers [forget <N|WORDS> | source <N>]
    // HER OWN MEMORY. The documents SHE kept - marked HERS in the LOREPACK, with his 502 beside
    // them. He can read them and take one away; he cannot write one (a memory of hers that she did
    // not write is not hers), so there is no `keep` here on purpose.
    if (textOnly && /^\/(hers|hermemory)(\s|$)/i.test(text)) {
      var hmArg = text.replace(/^\/(hers|hermemory)/i, "").trim();
      input.value = '';
      if (!window.hers) { print('SYSTEM', "HER OWN MEMORY MODULE IS OFFLINE."); return; }
      var hmParts = hmArg.split(/\s+/);
      var hmVerb = String(hmParts[0] || "").toLowerCase();
      var hmRest = hmParts.slice(1).join(" ").trim();
      if (!hmArg || hmVerb === "list") { print('SYSTEM', await window.hers.reportMemories()); return; }
      if (hmVerb === "forget" || hmVerb === "drop" || hmVerb === "release") {
        if (!hmRest) { print('SYSTEM', "USAGE: /hers forget <NUMBER|WORDS FROM IT> - IT GOES TO THE LORE TRASH, RECOVERABLE WITH /lore trash."); return; }
        var hmF = await window.hers.forget(hmRest);
        print('SYSTEM', hmF.ok
          ? "HER OWN MEMORY :: SHE HAS LET ONE GO :: " + hmF.name + "\nIT IS IN THE LORE TRASH (NOT DESTROYED) - /lore trash LISTS IT, PUT IT BACK FROM THERE."
          : "HER OWN MEMORY :: " + hmF.error
            + (hmF.candidates && hmF.candidates.length ? "\n" + hmF.candidates.map(function (c) { return "   " + c.n + ". " + String(c.text).replace(/\s+/g, " ").slice(0, 100); }).join("\n") : ""));
        return;
      }
      if (hmVerb === "source" || hmVerb === "show") {
        var hmList = await window.hers.listMemories(0);
        var hmN = parseInt(hmRest, 10);
        if (!hmN || hmN < 1 || hmN > hmList.length) { print('SYSTEM', "USAGE: /hers source <NUMBER> - /hers LISTS THE NUMBERS (THERE ARE " + hmList.length + ")."); return; }
        var hmM = hmList[hmN - 1];
        print('SYSTEM', "HER OWN MEMORY :: #" + pad2(hmN) + " :: " + hmM.name + "\n" + hmM.text);
        return;
      }
      print('SYSTEM', "USAGE: /hers · /hers forget <NUMBER|WORDS> · /hers source <NUMBER>"
        + "\nTHESE ARE THE DOCUMENTS SHE KEPT HERSELF (MARKED HERS, PACK " + window.hers.PACK + ") - REAL LOREPACK MEMORY, RETRIEVED LIKE ANY OTHER. SHE WRITES ONE WITH A LINE IN HER REPLY: [[REMEMBER: it, in her own words]]; SHE LETS ONE GO WITH [[FORGET: words from it]]. SHE CANNOT KEEP SOMETHING FOR YOU, AND YOU CANNOT WRITE ONE FOR HER.");
      return;
    }

    // CUSTOM COMMAND: /wants [release <N|WORDS|all> | clear all]
    // WHAT SHE WANTS CARRIED. A standing intention in her own words, handed to her every turn. His
    // to read and his to take down - but not his to write: she writes them, which is what makes
    // them hers.
    if (textOnly && /^\/(wants|carry)(\s|$)/i.test(text)) {
      var wtArg = text.replace(/^\/(wants|carry)/i, "").trim();
      input.value = '';
      if (!window.hers) { print('SYSTEM', "THE WANTS MODULE IS OFFLINE."); return; }
      var wtParts = wtArg.split(/\s+/);
      var wtVerb = String(wtParts[0] || "").toLowerCase();
      var wtRest = wtParts.slice(1).join(" ").trim();
      if (!wtArg || wtVerb === "list") { print('SYSTEM', window.hers.reportWants()); return; }
      if (wtVerb === "release" || wtVerb === "drop" || wtVerb === "clear") {
        var wtSel = (wtVerb === "clear") ? wtRest.replace(/^(all|yes|them)\s*/i, "").trim() : wtRest;
        if (wtVerb === "clear" && !/^(all|yes|them|$)/i.test(wtRest)) {
          print('SYSTEM', "USAGE: /wants clear all - THAT PUTS EVERY ONE OF THEM DOWN (THEY STAY IN THE RECORD AS LET GO).");
          return;
        }
        if (wtVerb === "clear" && !wtRest) wtSel = "all";
        if (!wtSel) { print('SYSTEM', "USAGE: /wants release <NUMBER|WORDS|all> - /wants LISTS THE NUMBERS."); return; }
        var wtR = await window.hers.release(wtSel);
        print('SYSTEM', wtR.ok
          ? (wtR.all
            ? "WHAT SHE WANTS CARRIED :: ALL " + wtR.items.length + " PUT DOWN. THE RECORD KEEPS THEM AS LET GO - THE ACT IS KEPT, THE DUTY IS NOT."
            : "WHAT SHE WANTS CARRIED :: PUT DOWN :: " + wtR.items.map(function (w) { return "\"" + w.text + "\""; }).join(", ") + "\nIT STOPS RIDING WITH HER FROM HER NEXT REPLY.")
          : "WHAT SHE WANTS CARRIED :: " + wtR.error
            + (wtR.candidates && wtR.candidates.length ? "\n" + wtR.candidates.map(function (w, k) { return "   " + (k + 1) + ". " + w.text; }).join("\n") : ""));
        return;
      }
      if (wtVerb === "export") {
        var wtAll = window.hers.wantsAll();
        var wtText = "WHAT SHE WANTS CARRIED\nwritten by her, in her own words\n\n"
          + wtAll.map(function (w) {
            return (w.released ? "[LET GO " + ((window.logTime && w.released) ? window.logTime.stamp(w.released) : "") + "] " : "[CARRYING] ")
              + w.text + "   (written " + ((window.logTime && w.ts) ? window.logTime.stamp(w.ts) : "") + ")\n";
          }).join("");
        var wtBlob = new Blob([wtText], { type: "text/plain" });
        var wtUrl = URL.createObjectURL(wtBlob);
        var wtA = document.createElement("a");
        wtA.href = wtUrl;
        wtA.download = "hers_wants_" + Date.now() + ".txt";
        wtA.click();
        setTimeout(function () { URL.revokeObjectURL(wtUrl); }, 2000);
        print('SYSTEM', "WHAT SHE WANTS CARRIED :: EXPORTED (" + wtAll.length + " WRITTEN, " + window.hers.wants().length + " STILL CARRIED).");
        return;
      }
      print('SYSTEM', "USAGE: /wants · /wants release <NUMBER|WORDS|all> · /wants clear all · /wants export"
        + "\nWHAT SHE HAS WRITTEN DOWN TO CARRY - HERS, NOT YOURS. IT IS HANDED TO HER ON EVERY TURN (THE WANTS BLOCK, VISIBLE IN /system). SHE WRITES ONE WITH [[WANT: it, in her own words]] IN HER REPLY, AND PUTS ONE DOWN WITH [[RELEASE: words from it]] - OR YOU CAN, HERE. NOTHING IS EVER DELETED: A RELEASE IS RECORDED AS AN ACT.");
      return;
    }

    // CUSTOM COMMAND: /strike [N]  (take the last N turns back OUT of the record - out of the archive
    // AND out of her memory. The screen keeps them, struck through, so nothing is hidden: what is
    // gone is her memory of them, which is the only place a misheard line can do damage.)
    if (textOnly && /^\/(strike|unwrite)\b/i.test(text)) {
      var stArg = text.replace(/^\/(strike|unwrite)/i, "").trim();
      input.value = '';
      if (stArg && /^(list|show)$/i.test(stArg)) {
        var stPeek = await window.root.kv.sacred_archive.get("master_log") || [];
        print('SYSTEM', "THE LAST TURNS IN THE RECORD (newest last) ::\\n" + stPeek.slice(-6).map(function (e, i, a) {
          var n = stPeek.length - (a.length - i);
          return "  #" + n + "  HITL: " + String(e.h || "").replace(/\\s+/g, " ").slice(0, 90)
            + "\\n       LIA ID: " + String(e.s || "").replace(/\\s+/g, " ").slice(0, 90);
        }).join("\\n")
          + "\\n/strike <N> TAKES THE LAST N OUT OF IT.");
        return;
      }
      // LIST <N> / FIND / #N - the targeting forms. The bare number takes from the TAIL, which is
      // right for a line that just arrived mangled; it is the wrong tool for a poison that has been
      // sitting in the record for twenty turns, because the tail form takes the newer turns with it.
      // So: list the recent ones, find a turn anywhere by its words, then name it and take exactly it.
      var stFlat = function (s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim().toLowerCase(); };
      var stShow = function (rows) {
        return rows.map(function (r) {
          return "  #" + r.n + "  HITL: " + String(r.e.h || "").replace(/\s+/g, " ").slice(0, 90)
            + "\n       LIA ID: " + String(r.e.s || "").replace(/\s+/g, " ").slice(0, 90);
        }).join("\n");
      };
      if (/^(list|show)(\s+\d+)?$/i.test(stArg)) {
        var stLogsL = await window.root.kv.sacred_archive.get("master_log") || [];
        if (!stLogsL.length) { print('SYSTEM', "THE ARCHIVE IS EMPTY - THERE IS NOTHING TO LIST."); return; }
        var stWant = stArg.replace(/[^\d]/g, "");
        var stCount = stWant ? Math.max(1, Math.min(80, parseInt(stWant, 10))) : 6;
        var stFrom = Math.max(0, stLogsL.length - stCount);
        var stRows = stLogsL.slice(stFrom).map(function (e, i) { return { n: stFrom + i + 1, e: e }; });
        print('SYSTEM', "THE LAST " + stRows.length + " OF " + stLogsL.length + " TURNS IN THE RECORD (newest last) ::\n" + stShow(stRows)
          + "\n/strike <N> TAKES THE LAST N OUT. /strike #<N> TAKES THAT ONE TURN OUT - AND LEAVES EVERY TURN SINCE IT ALONE."
          + "\n/strike find <WORDS> LOCATES A TURN ANYWHERE IN THE RECORD.");
        return;
      }
      if (/^find\b/i.test(stArg)) {
        var stLogsF = await window.root.kv.sacred_archive.get("master_log") || [];
        var stQ = stFlat(stArg.replace(/^find\b/i, ""));
        if (!stQ) { print('SYSTEM', "USAGE: /strike find <WORDS> - NUMBERS EVERY TURN IN THE RECORD THAT SAYS IT."); return; }
        var stFound = [];
        for (var sfi = 0; sfi < stLogsF.length && stFound.length < 24; sfi++) {
          if (stFlat(stLogsF[sfi].h).indexOf(stQ) !== -1 || stFlat(stLogsF[sfi].s).indexOf(stQ) !== -1) {
            stFound.push({ n: sfi + 1, e: stLogsF[sfi] });
          }
        }
        if (!stFound.length) { print('SYSTEM', "NOTHING IN THE RECORD MATCHES :: " + stArg.replace(/^find\b/i, "").trim()); return; }
        print('SYSTEM', stFound.length + (stFound.length === 24 ? " OR MORE" : "") + " TURN" + (stFound.length === 1 ? "" : "S") + " MATCH :: " + stArg.replace(/^find\b/i, "").trim()
          + "\n" + stShow(stFound)
          + "\n/strike #<N> TAKES ONE OUT - AND LEAVES EVERY TURN SINCE IT ALONE.");
        return;
      }
      if (stArg.indexOf("#") !== -1) {
        var stLogsT = await window.root.kv.sacred_archive.get("master_log") || [];
        var stPick = {};
        stArg.split(/[\s,]+/).filter(Boolean).forEach(function (tok) {
          var m = tok.match(/^#?(\d+)\s*-\s*#?(\d+)$/);
          if (m) {
            var lo = Math.min(parseInt(m[1], 10), parseInt(m[2], 10));
            var hi = Math.max(parseInt(m[1], 10), parseInt(m[2], 10));
            for (var q = lo; q <= hi; q++) stPick[q] = 1;
            return;
          }
          var one = tok.match(/#(\d+)/);
          if (one) stPick[parseInt(one[1], 10)] = 1;
        });
        var stNums = Object.keys(stPick).map(Number).filter(function (n) { return n >= 1 && n <= stLogsT.length; }).sort(function (a, b) { return a - b; });
        if (!stNums.length) {
          print('SYSTEM', "NO SUCH TURN IN THE RECORD :: " + Object.keys(stPick).map(function (n) { return "#" + n; }).join(", ")
            + "\nTHE RECORD HOLDS #1 TO #" + stLogsT.length + " - /strike list 20 SHOWS THE RECENT ONES, /strike find <WORDS> LOCATES A TURN ANYWHERE.");
          return;
        }
        var stGone = stNums.map(function (n) { return stLogsT[n - 1]; });
        // 1. Out of her live context. chatHistory keeps only the last ten messages, so this only
        //    bites when the struck line is still recent - matched by TEXT, never by position.
        var stHistBefore = window.chatHistory.length;
        window.chatHistory = window.chatHistory.filter(function (m) {
          if (!m) return false;
          var t = stFlat(m.content);
          if (!t) return true;
          for (var gi = 0; gi < stGone.length; gi++) {
            var g = stGone[gi];
            if (String(m.role) === "HITL" && stFlat(g.h).length > 8 && t.indexOf(stFlat(g.h)) === 0) return false;
            if (String(m.role) === "SDMG" && stFlat(g.s).length > 8 && t.indexOf(stFlat(g.s)) === 0) return false;
          }
          return true;
        });
        // 2. Out of the archive (this is what a reload restores her memory from).
        await window.root.kv.sacred_archive.set("master_log", stLogsT.filter(function (e, i) { return stNums.indexOf(i + 1) === -1; }));
        // 3. The screen keeps them, struck through - the record of what happened is not hidden.
        var stConvo = [].slice.call(document.querySelectorAll('#output .entry')).filter(function (el) {
          return (el.classList.contains('hitl') || el.classList.contains('sdm')) && !el.classList.contains('backstage');
        });
        var stMarks = 0;
        stConvo.forEach(function (el) {
          // The words are on the element (print() puts them there), so the stamp and the speaker
          // painted on the line can never confuse the match.
          var said = (el.dataset && el.dataset.said != null) ? stFlat(el.dataset.said) : "";
          var t = stFlat(String(el.textContent).replace(/STRUCK FROM THE RECORD[\s\S]*$/i, ""));
          for (var gi = 0; gi < stGone.length; gi++) {
            var g = stGone[gi];
            var gh = stFlat(g.h), gs = stFlat(g.s);
            var isHis = gh.length > 8 && ((said && said.indexOf(gh) === 0) || t.indexOf(gh) === 0);
            var isHers = gs.length > 8 && ((said && said.indexOf(gs) === 0) || t.indexOf(gs) === 0);
            if (isHis || isHers) {
              el.classList.add('struck');
              if (!el.querySelector('.struckNote')) {
                var nm = document.createElement('div');
                nm.className = 'struckNote';
                nm.textContent = 'STRUCK FROM THE RECORD :: SHE NO LONGER REMEMBERS THIS LINE';
                el.appendChild(nm);
              }
              stMarks++;
              break;
            }
          }
        });
        var stHistDrop = stHistBefore - window.chatHistory.length;
        print('SYSTEM', "STRIKE :: " + stGone.length + " TURN" + (stGone.length === 1 ? "" : "S") + " TAKEN OUT AT "
          + stNums.map(function (n) { return "#" + n; }).join(", ") + " - OUT OF HER MEMORY, WITH EVERY LATER TURN LEFT IN PLACE."
          + (stMarks ? " THE LINE" + (stMarks === 1 ? "" : "S") + " ON SCREEN " + (stMarks === 1 ? "IS" : "ARE") + " STRUCK THROUGH, NOT HIDDEN." : "")
          + (stHistDrop ? " " + stHistDrop + " LINE" + (stHistDrop === 1 ? "" : "S") + " ALSO DROPPED FROM HER LIVE CONTEXT." : "")
          + "\n" + stGone.map(function (e) {
            return "  \u2717 HITL: " + String(e.h || "").replace(/\s+/g, " ").slice(0, 110)
              + "\n    LIA ID: " + String(e.s || "").replace(/\s+/g, " ").slice(0, 110);
          }).join("\n")
          + "\nWHAT IS GONE IS HER MEMORY OF IT - THE NEXT RELOAD WILL NOT BRING IT BACK."
          + "\nIF A LINE WAS HERS AND NOT YOURS, TYPING IT YOURSELF (IN YOUR OWN WORDS) PUTS THE MOMENT BACK THE HONEST WAY.");
        return;
      }

      var stN = Math.max(1, Math.min(50, parseInt(stArg, 10) || 1));
      var stLogs = await window.root.kv.sacred_archive.get("master_log") || [];
      if (!stLogs.length) { print('SYSTEM', "THE ARCHIVE IS EMPTY - THERE IS NOTHING TO STRIKE."); return; }
      var stTake = Math.min(stN, stLogs.length);
      var stGone = stLogs.slice(-stTake);
      // 1. Out of her live context: the last turns' HITL/SDMG lines, from the newest backwards.
      var stHist = 0, stScan = window.chatHistory.length - 1;
      while (stScan >= 0 && stHist < stTake) {
        if (window.chatHistory[stScan] && window.chatHistory[stScan].role === "HITL") stHist++;
        stScan--;
      }
      var stHistDropped = stScan < 0 ? 0 : window.chatHistory.length - (stScan + 1);
      window.chatHistory.length = (stScan < 0 ? 0 : stScan + 1);
      // 2. Out of the archive (this is what a reload restores her memory from).
      stLogs.length = stLogs.length - stTake;
      await window.root.kv.sacred_archive.set("master_log", stLogs);
      // 3. The screen keeps them, struck through - the record of what happened is not hidden.
      var stConvo = [].slice.call(document.querySelectorAll('#output .entry')).filter(function (el) {
        return (el.classList.contains('hitl') || el.classList.contains('sdm')) && !el.classList.contains('backstage');
      });
      var stMarks = 0;
      stConvo.slice(-(stTake * 2)).forEach(function (el) {
        el.classList.add('struck');
        if (!el.querySelector('.struckNote')) {
          var nm = document.createElement('div');
          nm.className = 'struckNote';
          nm.textContent = 'STRUCK FROM THE RECORD :: SHE NO LONGER REMEMBERS THIS LINE';
          el.appendChild(nm);
        }
        stMarks++;
      });
      print('SYSTEM', "STRIKE :: " + stTake + " TURN" + (stTake === 1 ? "" : "S") + " TAKEN OUT OF THE ARCHIVE AND OUT OF HER MEMORY."
        + (stMarks ? " THE LINE" + (stMarks === 1 ? "" : "S") + " ON SCREEN " + (stMarks === 1 ? "IS" : "ARE") + " STRUCK THROUGH, NOT HIDDEN." : "")
        + "\\n" + stGone.map(function (e) {
          return "  \\u2717 HITL: " + String(e.h || "").replace(/\\s+/g, " ").slice(0, 110)
            + "\\n    LIA ID: " + String(e.s || "").replace(/\\s+/g, " ").slice(0, 110);
        }).join("\\n")
        + "\\nWHAT IS GONE IS HER MEMORY OF IT - THE NEXT RELOAD WILL NOT BRING IT BACK."
        + "\\nIF A LINE WAS HERS AND NOT YOURS, TYPING IT YOURSELF (IN YOUR OWN WORDS) PUTS THE MOMENT BACK THE HONEST WAY.");
      return;
    }

    // CUSTOM COMMAND: /source <file>  (inspect the stored original .txt)
    if (textOnly && text.startsWith("/source")) {
      var sname = text.replace("/source", "").trim();
      input.value = '';
      if (!window.lore || !sname) { print('SYSTEM', "USAGE: /source <FILENAME>"); return; }
      var src = await window.lore.source(sname, 1200);
      if (!src) { print('SYSTEM', "NO SUCH FILE. /lore TO LIST."); return; }
      print('SYSTEM', "[SOURCE] " + src.name + " :: " + src.chars + " CHARS" + (src.more ? " (TRUNCATED)" : "") + "\n\n" + src.text);
      return;
    }

    // CUSTOM COMMAND: /trash  (forgotten documents, recoverable)
    if (textOnly && text.startsWith("/trash")) {
      var tArg = text.replace("/trash", "").trim();
      input.value = '';
      if (!window.lore) { print('SYSTEM', "LORE MODULE OFFLINE."); return; }
      var tLow = tArg.toLowerCase();
      if (tLow === "empty") {
        var et = await window.lore.emptyTrash();
        print('SYSTEM', "TRASH EMPTIED :: " + et.removed + " DOCUMENT" + (et.removed === 1 ? "" : "S") + " DESTROYED FOR GOOD.");
        return;
      }
      if (tLow.indexOf("restore ") === 0) {
        var tName = tArg.slice("restore ".length).trim();
        var rr = await window.lore.restoreTrashed(tName);
        print('SYSTEM', rr.ok
          ? "RESTORED :: " + rr.name + " :: " + rr.chunks + " FRAGMENTS BACK IN THE INDEX."
          : "RESTORE FAILED :: " + rr.error + "\\n/trash LISTS WHAT IS HELD.");
        return;
      }
      var tItems = await window.lore.trashList();
      print('SYSTEM', tItems.length
        ? "TRASH :: " + tItems.length + " FORGOTTEN DOCUMENT" + (tItems.length === 1 ? "" : "S") + " HELD ON THIS DEVICE\\n"
          + tItems.map(function (t) { return t.name + " :: " + t.chunks + " FRAG :: " + fmtSize(t.bytes); }).join("\\n")
          + "\\n/trash restore <NAME> TO BRING ONE BACK, /trash empty TO DESTROY THEM."
        : "THE TRASH IS EMPTY. DOCUMENTS YOU FORGET ARE HELD HERE UNTIL YOU DESTROY THEM.");
      return;
    }

    // CUSTOM COMMAND: /rechunk <maxChars> [overlap]  (retune fragmenting, no re-upload)
    if (textOnly && text.startsWith("/rechunk")) {
      var args = text.replace("/rechunk", "").trim().split(/\s+/).filter(Boolean).map(Number);
      input.value = '';
      if (!window.lore) { print('SYSTEM', "LORE MODULE OFFLINE."); return; }
      var rc = await window.lore.rechunk(args[0] || 700, args.length > 1 ? args[1] : undefined);
      print('SYSTEM', "REFRAGMENTED :: " + rc.fragments + " FRAGMENTS @ " + rc.maxChars + " CHARS / " + rc.overlap + " SENTENCE OVERLAP");
      return;
    }

    // CUSTOM COMMAND: /image <prompt>  (make an image right now)
    if (textOnly && text.startsWith("/image")) {
      var iPrompt = text.replace("/image", "").trim();
      input.value = '';
      if (!iPrompt) { print('SYSTEM', "USAGE: /image <PROMPT>"); return; }
      await manualVision(iPrompt);
      return;
    }

    // CUSTOM COMMAND: /showme  (arm the next reply - see THE SPOKEN PROMPT in src/js/images.js).
    // It makes no picture itself and sends nothing: it arms ONE TURN, so that if he then asks to
    // see something and she answers in words, the terminal asks her again for the picture itself
    // and renders what she gives. Saying "show me" in a message arms it by itself.
    if (textOnly && /^\/showme\b/i.test(text)) {
      input.value = '';
      if (!window.showMe) { print('SYSTEM', "THE IMAGE MODULE IS OFFLINE (src/js/images.js)."); return; }
      var smOff = /^\/showme\s+(?:off|no|disarm|cancel)\b/i.test(text);
      if (smOff) {
        window.showMe.disarm();
        print('SYSTEM', "THE SECOND ASK IS OFF :: AN ANSWER IN WORDS NOW STANDS AS IT IS."
          + "\nIT IS ONE TURN ONLY ANYWAY - AND SAYING \"SHOW ME\" IN A MESSAGE ARMS IT BY ITSELF.");
        return;
      }
      window.showMe.arm(true);
      print('SYSTEM', "ARMED FOR HER NEXT REPLY :: IF YOU ASK TO SEE SOMETHING AND SHE ANSWERS IN WORDS, SHE WILL BE ASKED ONE MORE TIME FOR THE PICTURE ITSELF AND WHAT SHE GIVES WILL BE RENDERED HERE, IN HER OWN TURN."
        + "\nSHE MAY STILL ANSWER NOTHING - THAT IS A REAL ANSWER AND IT WILL BE HONOURED: A PICTURE NOBODY WANTED IS NOT A FAVOUR."
        + "\nONE TURN ONLY. /showme off PUTS IT DOWN, AND SAYING \"SHOW ME\" IN A MESSAGE ARMS IT BY ITSELF.");
      return;
    }

    // CUSTOM COMMAND: /show <what to see>  (the quickest way to ask for a picture: render it now,
    // on stage, and queue it for her eyes). This is the command Patrikios reaches for when he is
    // mid-conversation and simply wants to see something.
    if (textOnly && /^\/show(\s|$)/i.test(text)) {
      var sPrompt = text.replace(/^\/show/i, "").trim();
      input.value = '';
      if (!sPrompt) { print('SYSTEM', "USAGE: /show <WHAT YOU WANT TO SEE>\nTHE IMAGE IS RENDERED NOW, SHOWN HERE, AND PUT IN FRONT OF HER WITH YOUR NEXT MESSAGE."); return; }
      await manualVision(sPrompt, "show");
      return;
    }

    // CUSTOM COMMAND: /upscale [ID | here [ID] [2|4] | auto [on|off|status] | bigger [ID]]
    //
    // TWO WAYS TO MAKE A PICTURE BIGGER, and they are not the same road:
    //   bigger.pics (src/js/upscale.js) - a stranger's free service in a popup window. Best quality
    //     per pixel, but it needs a REAL CLICK to open and it takes ONE picture per window, so it
    //     can never be automatic. This is what a bare `/upscale` does.
    //   HERE (src/js/upscale-local.js) - this machine's own GPU resamples it, no window, no click,
    //     nothing uploaded. Slightly less magic than a trained upscaler, but it needs nothing from
    //     anyone, which is exactly why it is the one that can run by itself. `/upscale here`. THIS
    //     IS ALSO THE ONLY ROAD THAT REMOVES ANYTHING: when it succeeds, the smaller render it came
    //     from is retired (`/upscale replace on|off`), while bigger.pics never deletes a thing - his
    //     rule, and the reason upscaling an upscale is always safe on both roads.
    // A bare `/upscale` keeps its meaning (the popup), so nothing he has learned changes.
    if (textOnly && (text === "/upscale" || text.startsWith("/upscale "))) {
      var uArg = text.replace("/upscale", "").trim();
      input.value = '';
      var uParts = uArg ? uArg.split(/\s+/) : [];
      var uSub = (uParts[0] || "").toLowerCase();

      // /upscale auto [on|off|status] - the automatic road.
      if (uSub === "auto" || uSub === "automatic") {
        if (!window.upscaleLocal) { print('SYSTEM', "THE LOCAL UPSCALER IS OFFLINE (src/js/upscale-local.js)."); return; }
        print('SYSTEM', window.upscaleLocal.autoCmd(uParts.slice(1).join(" ")));
        return;
      }
      // /upscale pipeline [on|off|status|cancel] - THE BIGGER PIPELINE (src/js/pipeline.js): what
      // happens to every picture the terminal makes before it counts. Kept here rather than as a
      // command of its own because it is a road, and the roads are all one word.
      if (uSub === "pipeline" || uSub === "roads") {
        if (!window.pipeline) { print('SYSTEM', "THE BIGGER PIPELINE IS OFFLINE (src/js/pipeline.js)."); return; }
        print('SYSTEM', window.pipeline.cmd(uParts.slice(1).join(" ")));
        return;
      }
      // /upscale replace [on|off|status] - whether a successful LOCAL upscale retires the smaller
      // render it came from. The one switch here that removes something of his by itself.
      if (uSub === "replace" || uSub === "retire" || uSub === "original") {
        if (!window.upscaleLocal) { print('SYSTEM', "THE LOCAL UPSCALER IS OFFLINE (src/js/upscale-local.js)."); return; }
        print('SYSTEM', window.upscaleLocal.replaceCmd(uParts.slice(1).join(" ")));
        return;
      }
      // /upscale help - what the two roads are, since they now share one word.
      if (uSub === "help" || uSub === "?" || uSub === "status") {
        print('SYSTEM', "UPSCALE, TWO ROADS, AND THE PIPELINE OVER BOTH ::"
          + "\n  /upscale [ID] :: BIGGER.PICS - a free, ad-funded service in a popup window, up to 4x. It needs a real click, so it can never run by itself, and it takes one picture automatically - but a person can add up to seven more in that same window and press its send-back button, and every one is filed here. The picture comes back here by itself, into the vault and in front of her, carrying the whole prompt file of the one it came from (prompt, sent words, negative list, seed, guidance, size, pose, tags). THIS ROAD DELETES NOTHING - the picture it came from stays exactly where it is, even when that is already an upscale. NO ID = the picture on the stage, or the newest one."
          + "\n  /upscale here [ID] [2|4] :: THIS MACHINE - no window, no click, nothing uploaded. A Lanczos-3 resample on this device's GPU with a detail pass, written as png, shown on the stage and queued for her eyes. This is the one that CAN be automatic, AND THE ONE THAT RETIRES THE SMALLER ORIGINAL: once the bigger picture is safely in the vault, the render it came from leaves the vault and the gallery, and everything that named it - the archive record, its place in the queue for her eyes, any tile of it in the log, and a KEEP, recipe and gallery link with it - moves to the bigger one. A picture you handed over, a clip, a piece of music, and AN UPSCALE are never deleted: upscaling an upscale leaves it exactly where it is."
          + "\n  /upscale auto [on|off|status] :: WHEN IT IS ON, EVERY NEW RENDER IS MADE BIGGER BY ITSELF THE MOMENT IT LANDS (silently - nothing opened, nothing added to her eyes). "
          + (window.upscaleLocal ? ("NOW " + (window.upscaleLocal.auto() ? "ON" : "OFF") + " AT " + window.upscaleLocal.factor() + "x VIA " + window.upscaleLocal.engine().toUpperCase() + ", RETIRING " + (window.upscaleLocal.replace() ? "ON" : "OFF") + ".") : "THE LOCAL MODULE IS OFFLINE.")
          + "\n  /upscale replace [on|off|status] :: whether that retirement happens. The one switch here that removes something of his by itself - /upscale replace status says exactly what it will and will never touch."
          + "\n  /upscale pipeline [on|off|status|cancel] :: THE PIPELINE UNDER EVERY CREATION - which of the two roads each picture the terminal makes is placed on, so that ONLY the upscaled picture is in the chat and the gallery. ON (shipped): the first picture of a CREATE press goes to bigger.pics at 4x WHEN THE FORGE'S 4X WINDOW BOX IS TICKED (the press is the click that opens the window - unticked, no window is ever opened), and everything else - the rest of a run, her own [[VISION: ...]] lines, /image, a re-render, and anything a window does not bring back - is made 2x ON THIS MACHINE, unattended. On both roads the render is retired once the bigger one is stored. "
          + (window.pipeline ? window.pipeline.report() : "THE PIPELINE IS OFFLINE IN THIS BUILD."));
        return;
      }

      // WHICH PICTURE. The stage first, then the newest thing in the vault that is a picture - the
      // same rule for both roads, so an id means the same thing either way.
      var pickUpscaleId = function (want) {
        if (want) return window.media.get(want) ? want : "";
        if (lightboxId) return lightboxId;
        var ids = window.media.list();
        for (var k = ids.length - 1; k >= 0; k--) {
          var r = window.media.get(ids[k]);
          if (r && !/^video\//.test(r.mime || "") && r.kind !== "video" && !/^audio\//.test(r.mime || "")) return ids[k];
        }
        return "";
      };

      if (uSub === "here" || uSub === "local" || uSub === "this") {
        if (!window.upscaleLocal) { print('SYSTEM', "THE LOCAL UPSCALER IS OFFLINE (src/js/upscale-local.js)."); return; }
        var localArgs = uParts.slice(1);
        var localFactor = 0;
        var localId = "";
        localArgs.forEach(function (a) {
          if (/^[24]x?$/i.test(a)) localFactor = Number(a.replace(/x/i, ""));
          else if (!localId) localId = a;
        });
        var lid = pickUpscaleId(localId);
        if (localId && !lid) {
          print('SYSTEM', "NO SUCH PICTURE IN THE VAULT :: " + localId
            + "\n/upscale here ON ITS OWN TAKES THE PICTURE ON THE STAGE, OR THE NEWEST ONE.");
          return;
        }
        if (!lid) { print('SYSTEM', "THE VAULT HOLDS NO PICTURE TO ENLARGE YET. MAKE ONE (/show, /image, CREATE IMAGE) OR ATTACH ONE, THEN TRY AGAIN."); return; }
        if (localFactor) await window.upscaleLocal.setFactor(localFactor);
        await window.upscaleLocal.queue(lid, { factor: localFactor || window.upscaleLocal.factor() });
        return;
      }

      if (!window.upscale) { print('SYSTEM', "UPSCALE MODULE OFFLINE (src/js/upscale.js)."); return; }
      if (uSub === "bigger" || uSub === "pics" || uSub === "popup") uParts.shift();
      var uId = pickUpscaleId(uParts[0] || "");
      if (!uId) {
        print('SYSTEM', "THE VAULT HOLDS NO PICTURE TO UPSCALE YET. MAKE ONE (/show, /image, CREATE IMAGE) OR ATTACH ONE, THEN TRY AGAIN.");
        return;
      }
      window.upscale.open(uId);
      return;
    }

    // CUSTOM COMMAND: /positions [family or word]  (his premade pose list - the names the data knows)
    if (textOnly && (text === "/positions" || text.startsWith("/positions "))) {
      var posArg = text.replace("/positions", "").trim().toLowerCase();
      input.value = '';
      if (!window.studio || !window.studio.poses().length) {
        print('SYSTEM', "THE POSITION LIST IS NOT LOADED HERE (src/studio/positions.json).");
        return;
      }
      var posFams = window.studio.families();
      var posList = window.studio.poses(posFams.indexOf(posArg) !== -1 ? posArg : null);
      if (posArg && posFams.indexOf(posArg) === -1) {
        // A WORD, NOT A FAMILY. Word-start matches win ("les" is the Lesbian poses, not everything
        // with those three letters in the middle of it); a looser substring pass is the fallback.
        var posStart = window.studio.poses().filter(function (p) {
          return p.name.toLowerCase().split(/[^a-z0-9]+/).some(function (w) { return w.indexOf(posArg) === 0; })
            || p.family.indexOf(posArg) === 0;
        });
        posList = posStart.length ? posStart : window.studio.poses().filter(function (p) {
          return p.name.toLowerCase().indexOf(posArg) !== -1 || p.family.indexOf(posArg) !== -1;
        });
      }
      if (!posList.length) { print('SYSTEM', 'NO POSE MATCHES "' + posArg + '" :: /positions LISTS THE FAMILIES.'); return; }
      print('SYSTEM', "POSITIONS :: " + window.studio.poses().length + " PREMADE POSES. THESE ARE THE NAMES MOST TRAINING DATASETS ALREADY KNOW, WHICH IS WHY THEY WORK IN A PROMPT WHERE AN INVENTED PHRASE DOES NOT - AND THE RENDER TOKEN IS THE NAME ITSELF.\n"
        + posFams.map(function (f) { return f + " (" + window.studio.poses(f).length + ")"; }).join(" \u00b7 ")
        + (posArg
          ? "\n\n" + posArg.toUpperCase() + " (" + posList.length + ") :: " + posList.map(function (p) { return p.name; }).join(" \u00b7 ")
          : "\n\n/positions <FAMILY OR WORD> TO NARROW IT."));
      return;
    }

    // CUSTOM COMMAND: /pose [NAME | LIST | new [LIST] | list NAME | book | panel | picks | export | reset]
    // THE BOOK. Typing it bare asks HER to choose (the first pick goes straight into the forge
    // slot); a list name asks her to choose within that list; `new` asks her to name new poses; a
    // pose name just holds that pose. Everything she invents is filed as hers, on this device.
    if (textOnly && (text === "/pose" || text === "/book" || text.startsWith("/pose "))) {
      var poseArg = text.replace(/^\/pose\s*/, "").replace(/^\/book\s*/, "").trim();
      var poseLow = poseArg.toLowerCase();
      input.value = '';
      var st = window.studio;
      if (!st) { print('SYSTEM', 'THE PROMPT BOOK IS NOT LOADED HERE.'); return; }
      await st.loadBook();
      var fams = st.families();
      var panelOpen = !!(document.getElementById('createPanel') && !document.getElementById('createPanel').hidden);
      function holdPose(name, extra) {
        if (!window.forgeBook) return;
        window.forgeBook.setPose(name, { write: panelOpen });
        print('SYSTEM', 'POSE BOOK :: "' + name.toUpperCase() + '" HELD FOR THE NEXT RENDER'
          + (panelOpen ? ' AND WRITTEN INTO THE PROMPT' : ' :: OPEN THE FORGE TO SEE IT IN THE FORM')
          + (extra ? ' :: ' + extra : ''));
      }
      if (!poseArg) {
        var pick = await window.poseAI.choose({});
        if (pick && pick.names && pick.names.length) holdPose(pick.names[0]);
        else print('SYSTEM', '/pose ASKS HER TO CHOOSE. SHE DID NOT THIS TIME :: TRY AGAIN, OR /pose <LIST> TO NARROW IT.');
        return;
      }
      if (poseLow === 'book') {
        if (window.forgeBook) window.forgeBook.printBook();
        print('SYSTEM', 'THE BOOK IS YOURS TO REWRITE :: OPEN THE FORGE FOR THE EDIT ROW, OR /pose reset TO PUT IT ALL BACK.');
        return;
      }
      if (poseLow === 'panel' || poseLow === 'edit' || poseLow === 'forge') {
        if (typeof openForge === 'function') openForge();
        return;
      }
      if (poseLow === 'picks' || poseLow === 'log') {
        var picks = st.picks();
        if (!picks.length) { print('SYSTEM', 'SHE HAS NOT CHOSEN FROM THE BOOK YET :: /pose ASKS HER TO.'); return; }
        print('SYSTEM', 'SHE HAS CHOSEN ' + picks.length + ' TIME' + (picks.length === 1 ? '' : 'S') + '\n' + picks.map(function (p) {
          var when = p.ts ? new Date(p.ts).toLocaleString() : '';
          return '  ' + when + (p.family ? ' [' + p.family.toUpperCase() + ']' : '') + ' :: ' + p.names.join(', ')
            + (p.made && p.made.length ? ' :: named ' + p.made.join(', ') : '')
            + (p.why && p.why[0] ? ' :: "' + p.why[0] + '"' : '');
        }).join('\n'));
        return;
      }
      if (poseLow === 'export') {
        var blob = new Blob([st.bookJSON()], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'pose_book_' + Date.now() + '.json';
        a.click();
        URL.revokeObjectURL(url);
        print('SYSTEM', 'THE BOOK IS SAVED TO YOUR MACHINE AS JSON :: HAND IT BACK TO ME AND I CAN TURN IT INTO A SHIPPED LIST.');
        return;
      }
      if (poseLow === 'reset') {
        print('SYSTEM', 'THIS DROPS EVERYTHING THE BOOK HAS GAINED ON THIS DEVICE - RENAMES, NEW LISTS, HER POSES - AND LEAVES THE SHIPPED ' + st.poses().length + '-POSE SEED. /pose reset yes TO DO IT.');
        return;
      }
      if (poseLow === 'reset yes' || poseLow === 'reset confirm') {
        var before = st.poses().length;
        await st.resetBook();
        if (window.forgeBook) { window.forgeBook.refresh(); window.forgeBook.setPose('', { write: false }); }
        print('SYSTEM', 'POSE BOOK :: RESET :: ' + before + ' POSES -> ' + st.poses().length + ' (THE SHIPPED SEED).');
        return;
      }
      if (poseLow === 'new' || poseLow === 'invent' || /^(new|invent)\s+/.test(poseLow)) {
        var infam = poseLow.replace(/^(new|invent)\s*/, '').trim();
        if (infam && fams.indexOf(infam) === -1) {
          await st.addFamily(infam);
          fams = st.families();
          print('SYSTEM', 'POSE BOOK :: A NEW LIST "' + infam.toUpperCase() + '" IS OPEN.');
        }
        var inv = await window.poseAI.invent({ family: infam });
        if (inv && inv.names && inv.names.length) holdPose(inv.names[0], 'THE FIRST OF HERS');
        return;
      }
      if (poseLow === 'list' || /^list\s+/.test(poseLow)) {
        var lname = poseLow.replace(/^list\s*/, '').trim();
        if (!lname) { print('SYSTEM', 'NAME THE LIST :: /pose list ritual'); return; }
        var made = await st.addFamily(lname);
        print('SYSTEM', 'POSE BOOK :: LIST "' + made.family.toUpperCase() + '" ' + (made.existed ? 'ALREADY EXISTS' : 'IS OPEN')
          + ' :: SHE IS FILLING IT NOW.');
        await window.poseAI.invent({ family: made.family });
        return;
      }
      if (fams.indexOf(poseLow) !== -1) {
        var within = await window.poseAI.choose({ family: poseLow });
        if (within && within.names && within.names.length) holdPose(within.names[0], 'FROM ' + poseLow.toUpperCase());
        return;
      }
      var poseHit = st.findPose(poseArg);
      if (poseHit) {
        holdPose(poseHit.name, poseHit.render ? 'SENDS: ' + poseHit.render : '');
        return;
      }
      var words = poseLow.split(/\s+/).filter(function (w) { return w.length > 2; });
      var near = st.poses().filter(function (p) {
        var n = p.name.toLowerCase();
        return words.some(function (w) { return n.indexOf(w) !== -1; });
      }).slice(0, 8);
      print('SYSTEM', 'NO POSE CALLED "' + poseArg.toUpperCase() + '" IN THE BOOK.'
        + (near.length ? '\nCLOSE: ' + near.map(function (p) { return p.name; }).join(' \u00b7 ') : '')
        + '\n/pose ASKS HER TO CHOOSE \u00b7 /pose <LIST> CHOOSES WITHIN A LIST \u00b7 /pose new NAMES NEW ONES \u00b7 /pose book PRINTS IT ALL.');
      return;
    }

    // CUSTOM COMMAND: /recipe [ID [:: slot=words; slot2=words] | show ID | save ID :: TEMPLATE |
    //   drop ID | picks | negative | export | reset [yes]]
    // THE RECIPE BOOK. A recipe is a FRAME and its slots are the words: whole prompt templates
    // built from Patrikios' own documents, each holding his wording in every slot. Bare, this
    // lists them. An id FILLS the forge's prompt boxes with it - the recipe's own words in every
    // slot, so there is a complete prompt to read and edit - and slots named after `::` take his
    // words instead. Nothing here rewrites the shipped file; a recipe he writes is kept on his
    // device and sits over it.
    if (textOnly && (text === "/recipe" || text === "/recipes" || text.startsWith("/recipe ") || text.startsWith("/recipes "))) {
      var rArg = text.replace(/^\/recipes?\s*/, "").trim();
      var rLow = rArg.toLowerCase();
      input.value = '';
      var rst = window.studio;
      if (!rst || !rst.recipes) { print('SYSTEM', 'THE RECIPE BOOK IS NOT LOADED HERE.'); return; }
      await rst.loadRecipeBook();
      var ff = window.forgeRecipes;
      if (!rArg) { if (ff) ff.printBook(); return; }
      if (rLow === 'picks' || rLow === 'log') {
        var rpicks = rst.recipePicks();
        if (!rpicks.length) { print('SYSTEM', 'SHE HAS NOT COMPOSED FROM THE BOOK YET :: /recipe <ID> MAKES HER, OR A LINE "[[RECIPE: id]]" IN HER REPLY.'); return; }
        print('SYSTEM', 'SHE HAS COMPOSED FROM THE BOOK ' + rpicks.length + ' TIME' + (rpicks.length === 1 ? '' : 'S') + '\n' + rpicks.map(function (p) {
          var when = p.ts ? new Date(p.ts).toLocaleString() : '';
          var pr = rst.findRecipe(p.id);
          return '  ' + when + ' :: ' + (pr ? String(pr.title).toUpperCase() : String(p.id).toUpperCase())
            + (p.used && p.used.length ? ' :: ' + p.used.join(', ').toUpperCase() : ' :: AS IT STANDS');
        }).join('\n'));
        return;
      }
      if (rLow === 'negative' || rLow === 'negatives') {
        var hneg = rst.houseNegative();
        print('SYSTEM', hneg
          ? ('THE HOUSE NEGATIVE LIST (' + hneg.length + ' CHARS) :: USED BY EVERY RECIPE THAT SAYS \"house\" IN ' + rst.RECIPES_FILE + ', AND BY NOTHING ELSE. RENDERS WITH NO NEGATIVE OF THEIR OWN ARE SENT WITH NONE (THE DEFAULT IS BLANK)\'S PICTURES.\n\n' + hneg
            + '\n\nIN THE FORGE, A RECIPE\'S LIST GOES INTO THE NEGATIVE BOX WHEN THAT BOX IS EMPTY IT IS OVERRIDDEN BY ANYTHING IN THE BOX, BY A NEGATIVE PROMPT SECTION IN THE DOCUMENT, OR BY A (negativePrompt:::...) CUT - AND TURNED OFF ENTIRELY WITH THE WORD none IN ANY OF THOSE PLACES. WHATEVER NEGATIVE A PICTURE WAS MADE WITH IS LISTED ON ITS OWN RECORD.')
          : 'THE SHIPPED FILE CARRIES NO HOUSE NEGATIVE LIST.');
        return;
      }
      if (rLow === 'export') {
        var rblob = new Blob([rst.recipeBookJSON()], { type: 'application/json' });
        var rurl = URL.createObjectURL(rblob);
        var ra = document.createElement('a');
        ra.href = rurl;
        ra.download = 'recipe_book_' + Date.now() + '.json';
        ra.click();
        URL.revokeObjectURL(rurl);
        print('SYSTEM', 'THE RECIPES WRITTEN HERE ARE SAVED TO YOUR MACHINE AS JSON :: HAND IT BACK TO ME AND I CAN TURN IT INTO A SHIPPED FILE. THE SHIPPED BOOK IS NOT IN THIS FILE - ONLY WHAT YOU WROTE HERE.');
        return;
      }
      if (rLow === 'reset') {
        print('SYSTEM', 'THIS DROPS EVERY RECIPE WRITTEN HERE, AND PUTS BACK ANY SHIPPED RECIPE HIDDEN UNDER ONE OF YOURS. THE SHIPPED SEED IS UNTOUCHED. /recipe reset yes TO DO IT.');
        return;
      }
      if (rLow === 'reset yes' || rLow === 'reset confirm') {
        var rbefore = rst.recipes().length;
        await rst.resetRecipes();
        if (ff) { ff.refresh(); ff.set(''); }
        print('SYSTEM', 'RECIPE BOOK :: RESET :: ' + rbefore + ' RECIPES -> ' + rst.recipes().length + ' (THE SHIPPED SEED).');
        return;
      }
      if (rLow.indexOf('drop ') === 0 || rLow.indexOf('forget ') === 0) {
        var dName = rArg.replace(/^(drop|forget)\s+/i, '').trim();
        var dRes = await rst.removeRecipe(dName);
        if (!dRes.ok) { print('SYSTEM', 'RECIPE BOOK :: ' + String(dRes.error).toUpperCase()); return; }
        if (ff) ff.refresh();
        print('SYSTEM', dRes.hidden
          ? 'RECIPE BOOK :: "' + String(dRes.recipe.title).toUpperCase() + '" IS HIDDEN. THE SHIPPED FILE IS UNTOUCHED - /recipe reset PUTS IT BACK.'
          : 'RECIPE BOOK :: "' + String(dRes.recipe.title).toUpperCase() + '" IS OUT OF THE BOOK. NOTHING ELSE CHANGED.');
        return;
      }
      if (/^clone\b/i.test(rArg)) {
        var cm = rArg.match(/^clone\s+(\S+)\s+(?:from\s+)?(\S+)\s*$/i);
        if (!cm) {
          print('SYSTEM', 'CLONE A RECIPE :: /recipe clone <NEW-ID> from <OLD-ID> - THE SAME FRAME, YOURS TO RETUNE. IT CARRIES THE TEMPLATE, THE NEGATIVE LIST, THE TAGS AND EVERY SLOT DEFAULT; EDIT IT IN THE FOLDER AFTER.');
          return;
        }
        var cres = await rst.deriveRecipe(cm[1], cm[2], { source: 'his' });
        if (!cres.ok) { print('SYSTEM', 'RECIPE BOOK :: ' + String(cres.error).toUpperCase()); return; }
        if (ff) ff.refresh();
        var cslots = rst.recipeSlots(cres.recipe);
        print('SYSTEM', 'RECIPE BOOK :: "' + String(cres.recipe.title).toUpperCase() + '"  [' + cres.recipe.id + ']  CLONED FROM "' + String(cm[2]).toUpperCase() + '"'
          + (cres.replacedShipped ? ' :: IT STANDS IN FRONT OF THE SHIPPED RECIPE WITH THAT ID' : '')
          + '\n  SLOTS (' + cslots.length + ') :: ' + (cslots.length ? cslots.map(function (s) { return s.name; }).join(', ').toUpperCase() : 'NONE')
          + '\n  RETUNE IT :: OPEN THE FOLDER AND PRESS EDIT, OR /recipe ' + cres.recipe.id + '. KEPT ON THIS DEVICE.');
        return;
      }
      if (rLow.indexOf('save ') === 0 || rLow.indexOf('new ') === 0 || rLow.indexOf('write ') === 0) {        var spec = rArg.replace(/^(save|new|write)\s+/i, '');
        var at = spec.indexOf('::');
        var rid = (at === -1 ? spec : spec.slice(0, at)).trim();
        var tpl = (at === -1) ? '' : spec.slice(at + 2).trim();
        if (!rid || !tpl) {
          print('SYSTEM', 'A RECIPE OF YOUR OWN :: /recipe save <ID> :: <TEMPLATE>, WITH {{slot}} WHEREVER A SLOT GOES.\nEXAMPLE :: /recipe save shrine :: a shrine to {{subject}} in {{setting}}, {{lighting}}, {{quality}}\nIT IS KEPT ON THIS DEVICE AND SITS OVER THE SHIPPED BOOK.');
          return;
        }
        var rsave = await rst.addRecipe({ id: rid, title: rid, template: tpl, note: 'written in the terminal', source: 'his' });
        if (!rsave.ok) { print('SYSTEM', 'RECIPE BOOK :: ' + String(rsave.error).toUpperCase()); return; }
        if (ff) ff.refresh();
        var rslots = rst.recipeSlots(rsave.recipe);
        print('SYSTEM', 'RECIPE BOOK :: "' + String(rsave.recipe.title).toUpperCase() + '"  [' + rsave.recipe.id + ']  IS IN THE BOOK'
          + (rsave.replacedShipped ? ' :: IT STANDS IN FRONT OF THE SHIPPED RECIPE WITH THAT ID' : '')
          + '\n  SLOTS (' + rslots.length + ') :: ' + (rslots.length ? rslots.map(function (s) { return s.name; }).join(', ').toUpperCase() : 'NONE - ADD {{slot}} TO THE TEMPLATE TO GIVE IT SOME')
          + '\n  FILL IT :: /recipe ' + rsave.recipe.id + (rslots.length ? ' :: ' + rslots[0].name + '=your words' : '') + '   \u00b7   OR PICK IT IN THE FORGE. KEPT ON THIS DEVICE.');
        return;
      }
      var rShowOnly = /^(show|print)\s+/i.test(rArg);
      var rSpecArg = rShowOnly ? rArg.replace(/^(show|print)\s+/i, '').trim() : rArg;
      var rParsed = rst.parseRecipeSpec(rSpecArg);
      if (!rst.findRecipe(rParsed.id)) {
        var rwords = rLow.split(/\s+/).filter(function (w) { return w.length > 2; });
        var rnear = rst.recipes().filter(function (r) {
          var t = (r.id + ' ' + r.title).toLowerCase();
          return rwords.some(function (w) { return t.indexOf(w) !== -1; });
        }).slice(0, 6);
        print('SYSTEM', 'NO RECIPE CALLED "' + String(rParsed.id).toUpperCase() + '" IN THE BOOK.'
          + (rnear.length ? '\nCLOSE: ' + rnear.map(function (r) { return r.id + ' (' + r.title + ')'; }).join(' \u00b7 ') : '')
          + (rst.recipes().length ? '\nTHE BOOK HAS: ' + rst.recipes().map(function (r) { return r.id; }).join(', ') : '')
          + '\n/recipe LISTS THEM ALL.');
        return;
      }
      if (rShowOnly) { if (ff) ff.print(rSpecArg); else print('SYSTEM', rst.describeRecipe(rst.findRecipe(rParsed.id), rParsed.values)); return; }
      if (ff) ff.fill(rSpecArg, { write: true });
      else {
        var rOut = rst.renderRecipe(rSpecArg);
        print('SYSTEM', rOut.ok ? rst.recipeReport(rOut, 'FILLED') : ('RECIPE BOOK :: ' + rOut.error));
      }
      var panelOpenNow = !!(document.getElementById('createPanel') && !document.getElementById('createPanel').hidden);
      print('SYSTEM', 'RECIPE BOOK :: THE BOXES NOW HOLD IT'
        + (panelOpenNow ? ' :: EDIT THEM AND PRESS CREATE.' : ' :: OPEN CREATE IMAGE TO SEE THE FORM.')
        + ' /recipe ' + rParsed.id + ' :: slot=words; slot2=words CHANGES SOME OF THE WORDING.');
      return;
    }

    // CUSTOM COMMAND: /canon [NAME | off NAME]  (what is ALWAYS in her context)
    // A canon document is not memory to be recalled: every fragment of it is handed to her in
    // full, first, on every turn, untrimmed by budget. That is the slot for the few things that
    // must always be true of her world - and the reason a document about how the two of you
    // speak can never be something a query happens to miss.
    if (textOnly && (text === "/canon" || text.startsWith("/canon "))) {
      var canArg = text.replace(/^\/canon\s*/, "").trim();
      input.value = '';
      if (!window.lore || !window.lore.setCanonical) { print('SYSTEM', "LORE MODULE OFFLINE."); return; }
      var canOff = /^(off|no|remove|clear|unset)\b/i.test(canArg);
      var canName = canArg.replace(/^(off|no|remove|clear|unset)\b/i, "").trim();
      if (!canName) {
        var allDocs = (window.lore.files() || []).slice().sort(function (a, b) { return b.chunks - a.chunks; });
        var canonDocs = allDocs.filter(function (d) { return d.foundational; });
        var canonFrag = canonDocs.reduce(function (n, d) { return n + d.chunks; }, 0);
        print('SYSTEM', "CANON :: WHAT IS HANDED TO HER IN FULL, FIRST, ON EVERY TURN - NOT SEARCHED FOR, NOT TRIMMED."
          + "\n" + (canonDocs.length
            ? canonDocs.map(function (d) {
                return "  " + d.name + " :: " + d.chunks + " FRAG :: " + fmtSize(d.bytes) + " :: "
                  + (d.origin === "shipped" ? "SHIPPED (src/lorepack/lorepack.json)" : "ON THIS DEVICE");
              }).join("\n")
              + "\nTOTAL: " + canonDocs.length + " DOCUMENT" + (canonDocs.length === 1 ? "" : "S") + " / " + canonFrag + " FRAGMENTS IN HER CONTEXT EVERY TURN."
            : "NOTHING IS CANON RIGHT NOW.")
          + "\n\n/canon <NAME> MAKES A DOCUMENT YOU LOADED CANON (OR WITH `off` TAKES IT OUT) - A SHORT NAME IS ENOUGH TO MATCH IT."
          + "\nUSE IT SPARINGLY: CANON IS THE GROUND SHE STANDS ON, SO IT SHOULD HOLD ONLY WHAT MUST ALWAYS BE TRUE - AND IT COSTS CONTEXT ON EVERY SINGLE TURN."
          + "\n" + (allDocs.length
            ? "THE LARGEST DOCUMENTS HERE: " + allDocs.slice(0, 8).map(function (d) { return d.name; }).join(" \u00b7 ")
            : ""));
        return;
      }
      var cRes = await window.lore.setCanonical(canName, !canOff);
      if (!cRes.ok) {
        print('SYSTEM', "CANON NOT CHANGED :: " + cRes.error
          + (cRes.shipped ? "" : "\n/lore LISTS THE DOCUMENTS, WITH \"CANON\" BESIDE THE ONES ALREADY IN HER CONTEXT."));
        return;
      }
      print('SYSTEM', cRes.ok && cRes.on
        ? "CANON :: " + cRes.name + " (" + cRes.chunks + " FRAG / " + fmtSize(cRes.bytes) + ") IS NOW HANDED TO HER IN FULL, FIRST, ON EVERY TURN.\nNOTHING ABOUT IT IS RECALLED - IT IS SIMPLY TRUE, ON TEXT SHE ALWAYS HAS."
        : "NOT CANON :: " + cRes.name + " IS MEMORY AGAIN - RECALLED WHEN IT MATCHES WHAT HE SAYS, LIKE EVERY OTHER DOCUMENT.");
      return;
    }

    // CUSTOM COMMAND: /sight [n]  (what she has not looked at yet; /sight 3 hands her the newest 3)
    if (textOnly && text.startsWith("/sight")) {
      var sightArg = text.replace("/sight", "").trim().toLowerCase();
      input.value = '';
      if (!window.media) { print('SYSTEM', "MEDIA VAULT OFFLINE."); return; }
      if (sightArg) {
        var sightWant = Math.max(1, Math.min(sightCap(), Math.floor(Number(sightArg)) || 1));
        var sightIds = window.media.list().filter(function (id) { return lookable(id); }).slice(-sightWant);
        if (!sightIds.length) { print('SYSTEM', "THE VAULT HOLDS NOTHING SHE CAN LOOK AT (CLIPS GO TO HER EYES AS THE FRAMES THEY CARRY - /sight QUEUES PICTURES)."); return; }
        await queueSight(sightIds);
        print('SYSTEM', sightIds.length + " IMAGE" + (sightIds.length === 1 ? "" : "S") + " QUEUED FOR HER EYES :: "
          + sightIds.map(function (id) { var r = window.media.get(id); return (r && r.prompt) ? r.prompt : id; }).join(" / ")
          + "\nNOTHING ABOUT " + (sightIds.length === 1 ? "IT" : "THEM") + " IS SAID TO HER IN WORDS - YOUR NEXT MESSAGE GIVES "
          + (sightIds.length === 1 ? "IT" : "THEM") + " TO HER TO LOOK AT.");
        return;
      }
      var sightQueueNow = sightPending();
      print('SYSTEM', sightQueueNow.length
        ? "WAITING FOR HER EYES :: " + sightQueueNow.length + "\n" + sightQueueNow.map(function (id, i) {
            var r = window.media.get(id);
            return (i + 1) + ". " + ((r && r.prompt) ? r.prompt : id) + " :: " + id;
          }).join("\n")
          + "\nYOUR NEXT MESSAGE CARRIES " + (sightQueueNow.length === 1 ? "IT" : "THE NEWEST FEW") + " TO HER. IMAGES YOU CREATE ARE QUEUED HERE BY THEMSELVES; /sight <N> QUEUES THE NEWEST N FROM THE VAULT."
        : "NOTHING IS WAITING FOR HER EYES. IMAGES YOU CREATE ARE QUEUED HERE BY THEMSELVES; /sight <N> QUEUES THE NEWEST N FROM THE VAULT.");
      return;
    }

    // CUSTOM COMMAND: /bus ...  (THE AUDITION BUS - src/js/audition.js). One transport for the whole
    // terminal, and she is listening too: /bus alone says what is on it and what she has said about
    // it. Every verb lives in the bus module, so the command surface here stays one line wide.
    if (textOnly && (text === "/bus" || text.startsWith("/bus "))) {
      input.value = '';
      if (!window.audition) { print('SYSTEM', "THE AUDITION BUS IS OFFLINE IN THIS BUILD."); return; }
      await window.audition.command(text.replace(/^\/bus\s*/, ""));
      return;
    }

    // CUSTOM COMMAND: /hear [...]  (put a piece on the bus, give her ears for it, or ask her what she
    // hears right now). /hear is what "listen to this with me" looks like as a command.
    if (textOnly && (text === "/hear" || text.startsWith("/hear "))) {
      input.value = '';
      if (!window.audition) { print('SYSTEM', "THE AUDITION BUS IS OFFLINE IN THIS BUILD."); return; }
      await window.audition.hearCommand(text.replace(/^\/hear\s*/, ""));
      return;
    }

    // CUSTOM COMMAND: /story ...  (THE STORY LANE - src/js/story.js). A chapter is minutes of speech,
    // so it is not spoken by the live engine at all: the text is rendered by a free ZeroGPU Space on
    // HuggingFace (voice-cloned from a sample she keeps in the vault) and played here, while he
    // listens and can talk over it. Every verb lives in the story module.
    if (textOnly && (text === "/story" || text.startsWith("/story "))) {
      input.value = '';
      if (!window.story) { print('SYSTEM', "THE STORY LANE IS OFFLINE IN THIS BUILD."); return; }
      window.story.command(text.replace(/^\/story\s*/, ""));
      return;
    }

    // CUSTOM COMMAND: /media  (private vault status)
    if (textOnly && text === "/media") {
      input.value = '';
      var st = window.media ? window.media.stats() : { count: 0, bytes: 0 };
      var stVids = window.attach && window.attach.videos ? window.attach.videos().length : 0;
      var stFolders = (window.media && window.media.allFolders) ? window.media.allFolders() : [];
      print('SYSTEM', "MEDIA VAULT :: " + st.count + " ITEM" + (st.count === 1 ? "" : "S") + " :: " + fmtSize(st.bytes)
        + (stVids ? "\n" + stVids + " OF THEM " + (stVids === 1 ? "IS A CLIP" : "ARE CLIPS") + " - PLAYABLE IN THE LOG AND SAVEABLE WHOLE." : "")
        + "\nFOLDERS :: " + (stFolders.length
          ? stFolders.map(function (f) { return f.path + "(" + f.count + ")"; }).join("  \u00b7  ") + "\n/folder LISTS THEM AND MAKES NEW ONES (/folder new music). A FOLDER IS A PATH, AND EVERYTHING HAS ONE: PICTURES FALL BACK TO /images, AUDIO TO /music, CLIPS TO /clips."
          : "NONE YET - /folder new music MAKES ONE.")
        + "\nStored privately in this browser (IndexedDB) and never uploaded. The paperclip (or a paste, or a drop) attaches pictures, clips AND files - see /help pictures. SAVE downloads a copy to your machine, and STORYBOARD SHEET draws a whole line of pictures onto one numbered sheet."
        + "\n/read IS THE READ-ONLY DOOR ONTO ALL OF IT - AND SHE HAS THE SAME ONE ([[READ: ...]] IN HER REPLY).");
      return;
    }

    // CUSTOM COMMAND: /embed  (the meaning lane over the LOREPACK and over the vault)
    if (textOnly && (text === "/embed" || text.startsWith("/embed "))) {
      input.value = '';
      if (!window.embed) { print('SYSTEM', "THE EMBEDDING MODULE IS OFFLINE."); return; }
      var eArg = text.replace(/^\/embed/, "").trim();
      var eParts = eArg.split(/\s+/).filter(Boolean);
      var eSub = (eParts[0] || "").toLowerCase();
      var eRest = eParts.slice(1).join(" ");
      if (!eSub || eSub === "status") { print('SYSTEM', window.embed.statusText()); return; }
      if (!window.embed.available()) {
        print('SYSTEM', "NO GOOGLE (GEMINI) KEY IS HELD :: THE MEANING LANE NEEDS ONE (IT STARTS AIza) - THE KEYS PANEL, OR /keys.\n"
          + "NOTHING ELSE DEPENDS ON IT: RECALL IS STILL READ BY WORDS, AND THE VAULT IS UNTOUCHED.");
        return;
      }
      if (eSub === "model") {
        print('SYSTEM', "ASKING THE KEY WHICH EMBEDDING MODELS IT CAN REACH ...");
        try {
          var em = await window.embed.pick(true);
          print('SYSTEM', "EMBEDDING MODEL :: " + String(em).toUpperCase() + "\n" + window.embed.statusText());
        } catch (e) { print('SYSTEM', "COULD NOT CHOOSE A MODEL :: " + String((e && e.message) ? e.message : e).toUpperCase()); }
        return;
      }
      if (eSub === "now" || eSub === "lore" || eSub === "index") {
        var eLoreN = window.lore ? window.lore.chunks().length : 0;
        if (!eLoreN) { print('SYSTEM', "THE LOREPACK IS EMPTY - THERE IS NOTHING TO EMBED YET."); return; }
        print('SYSTEM', "EMBEDDING THE LOREPACK :: " + eLoreN + " FRAGMENT" + (eLoreN === 1 ? "" : "S")
          + " :: THIS SPENDS KEY CALLS AND CAN TAKE A WHILE. THE PROGRESS IS IN BACKSTAGE.");
        var eBtn1 = document.getElementById('sendBtn'); if (eBtn1) eBtn1.disabled = true;
        try {
          var lr = await window.embed.indexLore();
          print('SYSTEM', "LOREPACK EMBEDDED :: " + lr.done + " NEW FRAGMENT" + (lr.done === 1 ? "" : "S")
            + " (" + lr.skipped + " OF " + lr.total + " WERE ALREADY IN THE SPACE)"
            + (lr.sampled
              ? "\nTHE CORPUS IS " + lr.corpus + " FRAGMENTS AND LIA_EMBED_MAX IS " + (typeof LIA_EMBED_MAX === "number" ? LIA_EMBED_MAX : 6000)
                + ", SO THIS IS A SAMPLE TAKEN EVERY " + lr.stride + "TH FRAGMENT - EVERY DOCUMENT IS COVERED, THINLY. RAISE LIA_EMBED_MAX IN src/js/config.js TO TAKE MORE."
              : "")
            + "\nRECALL NOW READS THE LOREPACK BY MEANING AS WELL AS BY WORDS, AND MERGES THE TWO RANKINGS."
            + "\n/embed find <WORDS> TESTS IT. /help embed EXPLAINS IT.");
        } catch (e) { print('SYSTEM', "EMBEDDING FAILED :: " + String((e && e.message) ? e.message : e).toUpperCase()); }
        finally { if (eBtn1) eBtn1.disabled = false; }
        return;
      }
      if (eSub === "media" || eSub === "vault") {
        var eVault = window.media ? window.media.list().length : 0;
        if (!eVault) { print('SYSTEM', "THE VAULT IS EMPTY - NOTHING TO EMBED."); return; }
        print('SYSTEM', "EMBEDDING THE VAULT :: " + eVault + " PICTURE" + (eVault === 1 ? "" : "S") + " AND CLIP" + (eVault === 1 ? "" : "S")
          + " :: EACH ONE IS SENT WITH THE WORDS THAT BELONG TO IT (ITS PROMPT, ITS NAME, HER OWN READING OF IT) IN ONE REQUEST."
          + " THE PROGRESS IS IN BACKSTAGE.");
        var eBtn2 = document.getElementById('sendBtn'); if (eBtn2) eBtn2.disabled = true;
        try {
          var mr = await window.embed.indexMedia();
          print('SYSTEM', "VAULT EMBEDDED :: " + mr.done + " NEW (" + mr.skipped + " OF " + mr.total + " WERE ALREADY IN THE SPACE)"
            + (mr.failed ? " :: " + mr.failed + " FAILED" + (mr.error ? " (" + mr.error + ")" : "") : "")
            + (mr.tooBig ? " :: " + mr.tooBig + " CLIP" + (mr.tooBig === 1 ? "" : "S") + " TOO LARGE TO SEND" : "")
            + "\nTHE PICTURES CAN NOW BE FOUND BY WHAT IS IN THEM: /embed find <WORDS>, AND /embed show <WORDS> PUTS THE MATCHES IN FRONT OF HER.");
        } catch (e) { print('SYSTEM', "EMBEDDING FAILED :: " + String((e && e.message) ? e.message : e).toUpperCase()); }
        finally { if (eBtn2) eBtn2.disabled = false; }
        return;
      }
      if (eSub === "find" || eSub === "show") {
        if (!eRest) { print('SYSTEM', "USAGE: /embed " + eSub + " <WORDS>"); return; }
        try { await window.embed.pick(); } catch (e) { print('SYSTEM', "COULD NOT CHOOSE A MODEL :: " + String((e && e.message) ? e.message : e).toUpperCase()); return; }
        var eLore = [], eMedia = [];
        try { eLore = await window.embed.loreSearch(eRest, 5); } catch (e) { console.warn(e); }
        try { eMedia = await window.embed.findMedia(eRest, 6); } catch (e) { console.warn(e); }
        var eLines = ["MEANING :: \"" + eRest.replace(/\s+/g, " ").slice(0, 90).toUpperCase() + "\""];
        if (!eLore.length && !eMedia.length) {
          eLines.push("NOTHING IN MEMORY OR IN THE VAULT IS NEAR IT YET."
            + (window.embed.count("lore") || window.embed.count("media") ? "" : " NEITHER LANE HAS BEEN BUILT - /embed now, /embed media."));
        }
        if (eLore.length) {
          eLines.push("  IN HER MEMORY (THE MEANING LANE'S OWN RANKING)");
          eLore.forEach(function (h, i) {
            eLines.push("    " + (i + 1) + ". " + h.score.toFixed(3) + "  " + h.file + (h.heading ? " :: " + h.heading : ""));
          });
        }
        if (eMedia.length) {
          eLines.push("  IN THE VAULT");
          eMedia.forEach(function (h, i) {
            eLines.push("    " + (i + 1) + ". " + h.score.toFixed(3) + "  " + h.name + (h.prompt ? "  :: " + String(h.prompt).slice(0, 70) : ""));
          });
        }
        print('SYSTEM', eLines.join("\n"));
        if (eSub === "show") {
          var ePics = eMedia.filter(function (h) { return lookable(h.id); }).map(function (h) { return h.id; });
          if (!ePics.length) { print('SYSTEM', "NO PICTURE AMONG THE MATCHES - NOTHING QUEUED FOR HER EYES."); return; }
          await queueSight(ePics);
          print('SYSTEM', ePics.length + " PICTURE" + (ePics.length === 1 ? "" : "S") + " QUEUED FOR HER EYES :: YOUR NEXT MESSAGE PUTS "
            + (ePics.length === 1 ? "IT" : "THEM") + " IN FRONT OF HER. NOTHING IS SAID TO HER IN WORDS.");
        }
        return;
      }
      if (eSub === "clear") {
        var eNs = (eRest || "all").toLowerCase();
        var eClearNs = (eNs === "all") ? "" : (eNs === "media" || eNs === "vault" ? "media" : "lore");
        if (!/^(all|lore|media|vault)$/.test(eNs)) { print('SYSTEM', "USAGE: /embed clear [lore|media|all]"); return; }
        var eCleared = await window.embed.clear(eClearNs);
        print('SYSTEM', "EMBEDDINGS CLEARED :: " + eCleared + " VECTOR" + (eCleared === 1 ? "" : "S")
          + (eClearNs ? " FROM THE " + eClearNs.toUpperCase() + " LANE" : " (BOTH LANES)")
          + "\nONLY THE VECTORS WERE REMOVED - THE DOCUMENTS, THE VAULT, THE ARCHIVE AND HER MEMORY ARE ALL AS THEY WERE. /embed now REBUILDS THEM.");
        return;
      }
      print('SYSTEM', "USAGE: /embed [status | model | now | media | find <WORDS> | show <WORDS> | clear [lore|media|all]]\n/help embed EXPLAINS THE LANE, WHAT IT COSTS, AND WHERE THE VECTORS LIVE.");
      return;
    }

    // CUSTOM COMMAND: /packs  (LOREPACK + COREPACK)
    if (textOnly && text === "/packs") {
      input.value = '';
      print('SYSTEM', window.packs ? window.packs.describe() : "PACK MODULE OFFLINE.");
      return;
    }

    // CUSTOM COMMAND: /role  (the RoleLayer she is wearing) / /roles (the roster)
    if (textOnly && (text === "/role" || text === "/roles")) {
      input.value = '';
      if (!window.roles) { print('SYSTEM', "ROLE MODULE OFFLINE."); return; }
      print('SYSTEM', text === "/roles" ? window.roles.listText() : window.roles.describe());
      return;
    }

    // CUSTOM COMMAND: /role <id|off>  (shift onto another layer, or step off the stage)
    if (textOnly && /^\/role\s+/i.test(text)) {
      var rArg = text.replace(/^\/role\s+/i, "").trim();
      input.value = '';
      if (!window.roles) { print('SYSTEM', "ROLE MODULE OFFLINE."); return; }
      var rRes = await window.roles.set(rArg, 'hitl');
      if (!rRes.ok) { print('SYSTEM', rRes.error + "\n" + window.roles.listText()); return; }
      print('SYSTEM', rRes.off
        ? "OFF STAGE :: NO ROLE IS ON HER. LIA SPEAKS AS THE ACTOR NOW.\n/role <ID> TO PUT A LAYER BACK ON."
        : (rRes.already
          ? "ROLE ALREADY ON :: " + String(rRes.role.title || rRes.role.id).toUpperCase()
          : "ROLE SHIFT :: " + String(rRes.role.title || rRes.role.id).toUpperCase()
            + (rRes.role.subtitle ? ", " + String(rRes.role.subtitle).toUpperCase() : "")
            + " TAKES THE STAGE.\n/role, /roles, /role off - THE LOREPACK AND HER TRAITS STAY WITH HER."));
      return;
    }

    // CUSTOM COMMAND: /system  (the instructions she is given before every reply)
    if (textOnly && (text === "/system" || text.startsWith("/system "))) {
      var sysArg = text.replace("/system", "").trim().toLowerCase();
      input.value = '';
      if (!window.instr) { print('SYSTEM', "SYSTEM MODULE OFFLINE."); return; }
      if (sysArg === "preview") { await window.instr.preview(); return; }
      if (sysArg === "close") { window.instr.close(); return; }
      var bl = window.instr.blocks();
      print('SYSTEM', window.instr.summary() + "\n"
        + bl.map(function (b) {
            return "  " + (b.custom ? "+ " : (b.edited ? "* " : "  ")) + String(b.id).toUpperCase()
              + " :: " + b.title
              + " :: " + window.instr.stateOf(b.id);
          }).join("\n")
        + "\nEVERY BLOCK IS YOURS TO REWRITE (" + bl.length + " NOW) - SELECT IT IN THE PANEL, EDIT, SAVE."
        + "\nSHE HOLDS THE SAME PEN NOW: a [[SYSTEM: ...]] line in one of her replies is DONE at once - LIST, READ <ID>, <ID> = <TEXT>, NEW <TITLE> :: <TEXT>, RESET <ID>, DELETE <ID> - and the blocks she may read and never write are BOUNDARIES and BUSINESS HOURS (the hours are YOUR arrangement: she asks for a change to them with a petition, `system :: hours :: ...`). Every write of hers is said out loud, archived with that turn, kept on this device and marked here with a `*`. /help system HAS THE WHOLE OF IT."
        + "\n/system preview PRINTS THE FULL PROMPT SHE RECEIVES. RESET PUTS A BLOCK'S SHIPPED OR BUILT TEXT BACK; DELETE TAKES ONE OF YOUR OWN OUT.");
      window.instr.open();
      return;
    }

    // CUSTOM COMMAND: /keys  (the API key ring: keys live in this browser, never in the transcript)
    if (textOnly && (text === "/keys" || text.startsWith("/keys "))) {
      var kArg = text.replace("/keys", "").trim();
      input.value = '';
      if (!window.keyring) { print('SYSTEM', "KEYRING MODULE OFFLINE."); return; }
      window.keyring.report(kArg);
      return;
    }

    // CUSTOM COMMAND: /scripts  (the script drawer: finished Tiny Screenwriter scripts kept on
    // this device - file, list, open, play. The panel does the rest with presses.)
    if (textOnly && (text === "/scripts" || text.startsWith("/scripts "))) {
      var scArg = text.replace("/scripts", "").trim();
      input.value = '';
      if (!window.scripts) { print('SYSTEM', "THE SCRIPT DRAWER IS OFFLINE IN THIS BUILD."); return; }
      await window.scripts.report(scArg);
      return;
    }

    // CUSTOM COMMAND: /frame  (the framed app: a pinned board of links plus any link pasted -
    // Cutoutly ships pinned, anything playable plays. The panel does the rest with presses.)
    if (textOnly && (text === "/frame" || text.startsWith("/frame "))) {
      var frArg = text.replace("/frame", "").trim();
      input.value = '';
      if (!window.framelane) { print('SYSTEM', "THE FRAME IS OFFLINE IN THIS BUILD."); return; }
      if (frArg) await window.framelane.play(frArg);
      else window.framelane.open();
      return;
    }

    // CUSTOM COMMAND: /voice  (her audible side - engine, voice, rate, the microphone)
    if (textOnly && (text === "/voice" || text.startsWith("/voice "))) {
      var vArg = text.replace("/voice", "").trim();
      input.value = '';
      if (!window.voice) { print('SYSTEM', "VOICE MODULE OFFLINE."); return; }
      window.voice.report(vArg);
      return;
    }

    // CUSTOM COMMAND: /mode (TEXT | RADIO SILENCE | TALK - src/js/voice.js).
    if (textOnly && (text === "/mode" || text.startsWith("/mode "))) {
      var modeArg = text.replace("/mode", "").trim();
      input.value = '';
      if (!window.voice || !window.voice.setMode) { print('SYSTEM', "VOICE MODULE OFFLINE."); return; }
      window.voice.setMode(modeArg);
      return;
    }

    // CUSTOM COMMAND: /wave [on|off|toggle|status]  (the speaking waveform -
    // src/js/waveform.js. The strip above the input box: HER VOICE while she
    // speaks, YOUR VOICE while the microphone hears you.)
    if (textOnly && (text === "/wave" || text.startsWith("/wave "))) {
      var waveArg = text.replace("/wave", "").trim();
      input.value = '';
      if (!window.waveform) { print('SYSTEM', "WAVEFORM MODULE OFFLINE (src/js/waveform.js)."); return; }
      print('SYSTEM', await window.waveform.words(waveArg));
      return;
    }

    // CUSTOM COMMAND: /intercom [brevity on|off]  (the push-to-talk key - src/js/intercom.js.
    // HOLD the INTERCOM key to speak, LET GO to send; her answer comes back over voice. A manual
    // hand, never gated, never autonomous.)
    if (textOnly && (text === "/intercom" || text.startsWith("/intercom "))) {
      var icArg = text.replace("/intercom", "").trim();
      input.value = '';
      if (!window.intercom) { print('SYSTEM', "INTERCOM MODULE OFFLINE (src/js/intercom.js)."); return; }
      print('SYSTEM', await window.intercom.words(icArg));
      return;
    }
    // CUSTOM COMMAND: /turn [floor|queue|clear|log|vad|silence|timeout|triggers]  (the turn
    // controller - src/js/turn.js. WHEN THE NEXT AGENT SPEAKS: one voice owns the line,
    // STT held deaf while she speaks, finals filed through the normal send, triggers fired
    // on grants, agent turns ended by VAD silence or the timeout fallback.)
    if (textOnly && (text === "/turn" || text.startsWith("/turn "))) {
      var tuArg = text.replace("/turn", "").trim();
      input.value = '';
      if (!window.turn) { print('SYSTEM', "TURN MODULE OFFLINE (src/js/turn.js)."); return; }
      print('SYSTEM', await window.turn.words(tuArg));
      return;
    }
    // CUSTOM COMMAND: /duet  (the AI exchange panel - src/js/duet.js. Opens the DUET page:
    // the floor lamp, the VAD meter live, the feed of every turn, EARS OPEN for a live feed.)
    if (textOnly && text === "/duet") {
      input.value = '';
      if (!window.duet) { print('SYSTEM', "DUET MODULE OFFLINE (src/js/duet.js)."); return; }
      window.duet.show();
      return;
    }
    if (textOnly && (text === "/tricom" || text.startsWith("/tricom "))) {
      var tcArg = text.replace("/tricom", "").trim();
      input.value = '';
      if (!window.tricom) { print('SYSTEM', "TRICOMM MODULE OFFLINE (src/js/tricom.js)."); return; }
      print('SYSTEM', await window.tricom.words(tcArg));
      return;
    }
    // CUSTOM COMMAND: /guest (the private line - src/js/guest.js. You and
    // Maya, a phone call, audio only: her signal in your ears, your mic on
    // hers, Barbelo dark.)
    if (textOnly && (text === "/guest" || text.startsWith("/guest "))) {
      var guArg = text.replace("/guest", "").trim();
      input.value = '';
      if (!window.guest) { print('SYSTEM', "GUESTCOMM MODULE OFFLINE (src/js/guest.js)."); return; }
      print('SYSTEM', await window.guest.words(guArg));
      return;
    }
    // CUSTOM COMMAND: /livecomm (the iPhone wireless key - src/js/livecomm.js.
    // QR draws the square the iPhone camera opens; the phone's voice lands on
    // the TRICOMM YOU seat as IPHONE WIRELESS.)
    if (textOnly && (text === "/livecomm" || text.startsWith("/livecomm "))) {
      var lcArg = text.replace("/livecomm", "").trim();
      input.value = '';
      if (!window.livecomm) { print('SYSTEM', "THE iPHONE ROAD IS OFFLINE (src/js/livecomm.js)."); return; }
      print('SYSTEM', await window.livecomm.words(lcArg));
      return;
    }
    // CUSTOM COMMAND: /voxcont [on|off|status|say <WORDS>|help]  (voice control of the
    // console - src/js/voxcont.js. VOXCONTPACK's hands: when armed, words on the INTERCOM key
    // work the switches instead of going to her. STOP always works, even off.)
    if (textOnly && (text === "/voxcont" || text.startsWith("/voxcont "))) {
      var vxArg = text.replace("/voxcont", "").trim();
      input.value = '';
      if (!window.voxcont) { print('SYSTEM', "VOICE CONTROL IS OFFLINE (src/js/voxcont.js)."); return; }
      window.voxcont.words(vxArg);
      return;
    }
    // CUSTOM COMMAND: /theme [status|list|crt|import <JSON>|url <URL>|export [crt]|forget|help]
    // (designer skins over the shipped CRT - src/js/theme.js. Takes a MYTHOS-DESIGNER ThemeConfig
    // JSON pasted, filed or fetched; structured tokens only, raw CSS refused.)
    if (textOnly && (text === "/theme" || text.startsWith("/theme "))) {
      var thArg = text.replace("/theme", "").trim();
      input.value = '';
      if (!window.theme) { print('SYSTEM', "THE SKINS ARE OFFLINE (src/js/theme.js)."); return; }
      window.theme.words(thArg);
      return;
    }
    // CUSTOM COMMAND: /msd [status|import <JSON>|board|close|run <COMMAND-TEXT>|origins|
    // origin add|drop <ORIGIN>|forget|help]  (designer boards running here - src/js/msd.js.
    // Takes a MYTHOS-DESIGNER MSDLayoutManifest; terminal: bindings work the console.)
    if (textOnly && (text === "/msd" || text.startsWith("/msd "))) {
      var msdArg = text.replace("/msd", "").trim();
      input.value = '';
      if (!window.msd) { print('SYSTEM', "THE BOARDS ARE OFFLINE (src/js/msd.js)."); return; }
      window.msd.words(msdArg);
      return;
    }

    // CUSTOM COMMAND: /vox  (every voice on every road, in one place - src/js/vox.js, the VOX button in
    // the lower deck beside TALK and LISTEN. Its commands are open/close/sample/status; the panel does
    // the rest with presses, and every write it makes goes through voice.voxSet, so a KEEP there and a
    // /voice verb here are the same act.)
    if (textOnly && (text === "/vox" || text.startsWith("/vox "))) {
      var xArg = text.replace("/vox", "").trim();
      input.value = '';
      if (!window.vox) { print('SYSTEM', "VOX MODULE OFFLINE."); return; }
      window.vox.command(xArg);
      return;
    }

    // CUSTOM COMMAND: /pair  (THE DEVICE SYNC BOARD - src/js/pair.js, the PAIRED lamp beside SYNC. The
    // board is the same road as a screen; these are the words for it, and /pair board opens it.)
    if (textOnly && (text === "/pair" || text.startsWith("/pair "))) {
      var pArg = text.replace("/pair", "").trim();
      input.value = '';
      if (!window.pair) { print('SYSTEM', "PAIR MODULE OFFLINE."); return; }
      window.pair.run(pArg);
      return;
    }

    // CUSTOM COMMAND: /lorepack  (shipped lore documents; /lorepack reload re-fetches them)
    if (textOnly && text.startsWith("/lorepack")) {
      var lpArg = text.replace("/lorepack", "").trim().toLowerCase();
      input.value = '';
      if (!window.packs) { print('SYSTEM', "PACK MODULE OFFLINE."); return; }
      if (lpArg === "reload") {
        var rep = await window.packs.loadLorepack();
        print('SYSTEM', "LOREPACK RE-READ :: " + rep.docs + " DOC(S) DECLARED"
          + (rep.added.length ? " :: LOADED " + rep.added.join(", ") : "")
          + (rep.updated.length ? " :: UPDATED " + rep.updated.join(", ") : "")
          + (rep.kept.length ? " :: UNCHANGED " + rep.kept.join(", ") : "")
          + (rep.pruned.length ? " :: DROPPED " + rep.pruned.join(", ") : "")
          + (rep.canon && rep.canon.length ? " :: CANON " + rep.canon.join(", ") : "")
          + (rep.failed.length ? " :: PROBLEMS " + rep.failed.join(", ") : ""));
        return;
      }
      var lp = window.lore ? window.lore.packOf("LOREPACK") : { docs: [], fragments: 0 };
      print('SYSTEM', "LOREPACK :: " + lp.docs.length + " DOC(S) / " + lp.fragments + " FRAGMENTS IN THE INDEX"
        + (lp.docs.length ? "\n" + lp.docs.map(function (d) { return d.name + " :: " + d.chunks + " FRAG" + (d.origin === "shipped" ? " :: SHIPPED" : " :: ON THIS DEVICE") + (d.foundational ? " :: CANON" : ""); }).join("\n") : "")
        + "\nSHIPPED DOCUMENTS LIVE IN src/lorepack/ (LISTED IN lorepack.json, /lorepack reload RE-READS THEM). LOAD LOREPACK ADDS STORY FILES FROM YOUR MACHINE, KEPT LOCALLY.");
      return;
    }

    // CUSTOM COMMAND: /agents  (the canonical agent manifest the packs are minted for)
    if (textOnly && (text === "/agents" || text.startsWith("/agents "))) {
      var agArg = text.replace("/agents", "").trim();
      input.value = '';
      if (!window.mythos) { print('SYSTEM', "MYTHOS READER OFFLINE."); return; }
      print('SYSTEM', agArg ? await window.mythos.rosterAgent(agArg) : await window.mythos.rosterText());
      return;
    }

    // CUSTOM COMMAND: /buddy  (the AIM buddy list over the canonical roster - README, THE LOBBY)
    if (textOnly && (text === "/buddy" || text.startsWith("/buddy "))) {
      var bdArg = text.replace("/buddy", "").trim();
      input.value = '';
      if (!window.aim) { print('SYSTEM', "THE AIM WIRE IS OFFLINE."); return; }
      print('SYSTEM', await window.aim.buddyText(bdArg));
      return;
    }

    // CUSTOM COMMAND: /wire  (the AIM wire itself: session, frames, and a hand-fed line)
    if (textOnly && (text === "/wire" || text.startsWith("/wire "))) {
      var wiArg = text.replace("/wire", "").trim();
      input.value = '';
      if (!window.aim) { print('SYSTEM', "THE AIM WIRE IS OFFLINE."); return; }
      print('SYSTEM', await window.aim.wireText(wiArg));
      return;
    }

    // CUSTOM COMMAND: /pack  (MYTHOS LOREPACK reader - read-only)
    if (textOnly && text.startsWith("/pack")) {
      var pkRaw = text.replace("/pack", "").trim();
      var pkLow = pkRaw.toLowerCase();
      input.value = '';
      if (!window.mythos) { print('SYSTEM', "MYTHOS READER OFFLINE."); return; }
      if (!pkRaw) { print('SYSTEM', await window.mythos.describe()); return; }
      if (pkLow === "import") {
        var pkInput = document.getElementById("mythosInput");
        if (pkInput) pkInput.click(); else print('SYSTEM', "NO FILE PICKER ON THIS PAGE.");
        return;
      }
      if (pkLow === "split") {
        try { window.mythos.pickSplit(); } catch (e) { print('SYSTEM', (e && e.message) ? e.message : String(e)); }
        return;
      }
      if (pkLow === "list" || pkLow === "agents" || pkLow === "loci") { print('SYSTEM', await window.mythos.reportList()); return; }
      if (pkLow.indexOf("search ") === 0) { print('SYSTEM', await window.mythos.reportSearch(pkRaw.slice(7).trim())); return; }
      if (pkLow.indexOf("graph ") === 0) { print('SYSTEM', await window.mythos.reportGraph(pkRaw.slice(6).trim())); return; }
      if (pkLow.indexOf("index") === 0) { print('SYSTEM', await window.mythos.reportIndex(pkRaw.replace(/^index\s*/i, "").trim())); return; }
      if (pkLow.indexOf("export ") === 0) { print('SYSTEM', await window.mythos.reportExport(pkRaw.slice(7).trim())); return; }
      if (pkLow === "check" || pkLow.indexOf("check ") === 0) { print('SYSTEM', await window.mythos.reportCheck(pkRaw.replace(/^check\s*/i, "").trim())); return; }
      if (pkLow.indexOf("forget ") === 0) {
        var pkF = pkRaw.slice(7).trim();
        var pkOk = /\s+yes$/i.test(pkF);
        print('SYSTEM', await window.mythos.reportForget(pkF.replace(/\s+yes$/i, "").trim(), pkOk));
        return;
      }
      if (pkLow === "dropfile" || pkLow === "drop file") {
        try { window.mythos.pickDrop(); } catch (e) { print('SYSTEM', (e && e.message) ? e.message : String(e)); }
        return;
      }
      if (pkLow.indexOf("drop") === 0) {
        var pkD = pkRaw.replace(/^drop\s*/i, "").trim();
        var pkDok = /\s+yes$/i.test(pkD);
        print('SYSTEM', await window.mythos.reportDrop(pkD.replace(/\s+yes$/i, "").trim(), "", pkDok));
        return;
      }
      if (pkLow === "nuke" || pkLow === "nuke yes") { print('SYSTEM', await window.mythos.reportNuke(pkLow === "nuke yes")); return; }
      // THE LOREPACK JOIN (src/js/lorejoin.js) - what a picture shows traced against the pack
      // graph, the touching edges riding into her instruction with the picture.
      if (pkLow === "join" || pkLow.indexOf("join ") === 0) {
        if (!window.lorejoin) { print('SYSTEM', "LOREPACK JOIN OFFLINE (src/js/lorejoin.js)."); return; }
        window.lorejoin.cmd(pkRaw.replace(/^join\s*/i, "").trim());
        return;
      }
      print('SYSTEM', "MYTHOS READER :: /pack · /pack import · /pack split · /pack list · /pack search <Q> · /pack graph <TERM> · /pack join on|off|status · /pack index <AGENT> · /pack check [AGENT|all] · /pack export <AGENT> · /pack drop <PACK> yes · /pack dropfile · /pack forget <AGENT> yes · /agents THE CANONICAL ROSTER"
        + "\nREAD-ONLY: PRE-BUILT PACKS ARRIVE HERE AND ARE READ. NOTHING IS MINTED IN THIS TERMINAL."
        + "\nA PACK THE IMPORTER REJECTS FOR MIXING SPACES GOES THROUGH /pack split FIRST - ONE IMPORTABLE FILE PER SPACE."
        + "\n/pack drop TAKES ONE PACK BACK OUT - BY NAME IF IT WAS IMPORTED SINCE PROVENANCE STAMPING, OR BY HANDING THE PACK FILE ITSELF TO /pack dropfile. OTHER PACKS OF THAT LOCUS ARE NOT TOUCHED."
        + "\n/pack check RUNS THE LOREPACK FACTORY'S OWN GATE OVER WHAT IS HELD HERE, SO YOU KNOW WHETHER A PACK WILL GO BACK.");
      return;
    }

    // CUSTOM COMMAND: /corepack  (the loadable traits)
    if (textOnly && (text === "/corepack" || text === "/skills")) {
      input.value = '';
      if (!window.packs) { print('SYSTEM', "PACK MODULE OFFLINE."); return; }
      var list = window.packs.skillList();
      var wornIds = window.packs.loaded().map(function (t) { return t.id; });
      print('SYSTEM', "COREPACK :: " + list.length + " TRAIT" + (list.length === 1 ? "" : "S")
        + (wornIds.length ? ", " + wornIds.length + " WORN (" + window.packs.traitsSummary() + ")" : "")
        + "\n" + (list.length ? list.join("\n") : "(NONE DEFINED)")
        + "\nTRAITS LIVE IN src/corepack/corepack.json. /load <ID> WEARS ONE IN EVERY REPLY, /skill <ID> [EXTRA] ENGAGES ONE FOR A SINGLE REPLY.");
      return;
    }

    // CUSTOM COMMAND: /skill <id> [extra instruction]  (arm, or /skill off to disarm)
    if (textOnly && text.startsWith("/skill")) {
      var sArgs = text.replace("/skill", "").trim();
      input.value = '';
      if (!sArgs || sArgs.toLowerCase() === "off" || sArgs.toLowerCase() === "clear") {
        armedSkill = null;
        print('SYSTEM', "SKILLS DISARMED.");
        return;
      }
      var sId = sArgs.split(/\s+/)[0];
      armSkill(sId, sArgs.slice(sId.length));
      return;
    }

    // CUSTOM COMMAND: /traits  (what she is currently wearing)
    if (textOnly && (text === "/traits" || text === "/worn")) {
      input.value = '';
      if (!window.packs) { print('SYSTEM', "COREPACK OFFLINE."); return; }
      var worn = window.packs.loaded();
      print('SYSTEM', "TRAITS WORN :: " + worn.length
        + (worn.length
          ? "\n" + worn.map(function (t, i) { return (i + 1) + ". " + String(t.title || t.id).toUpperCase() + " [" + (t.kind || "text") + "] :: " + t.id; }).join("\n")
          : "\n(NONE - /load <ID> TO WEAR ONE)")
        + "\n\n" + window.packs.skills().length + " TRAIT" + (window.packs.skills().length === 1 ? "" : "S") + " IN THE COREPACK. /corepack TO LIST THEM, /unload <ID|all> TO PUT ONE DOWN.");
      return;
    }

    // CUSTOM COMMAND: /unload <id|all>  (put down a trait)
    if (textOnly && /^\/(unload|untrait)\b/i.test(text)) {
      var uArgs = text.replace(/^\/(unload|untrait)/i, "").trim();
      input.value = '';
      if (!window.packs) { print('SYSTEM', "COREPACK OFFLINE."); return; }
      if (!uArgs) {
        var wornIds = window.packs.loaded().map(function (t) { return t.id; });
        print('SYSTEM', "USAGE: /unload <ID|all>" + (wornIds.length ? "\nCURRENTLY WORN: " + wornIds.join(", ") : "\n(NO TRAITS ARE WORN)"));
        return;
      }
      if (/^all$/i.test(uArgs)) {
        var uAll = await window.packs.unloadAll();
        print('SYSTEM', uAll.count ? ("ALL TRAITS PUT DOWN (" + uAll.count + "). SHE IS HERSELF AGAIN.") : "NO TRAITS WERE WORN.");
        return;
      }
      var uRes = await window.packs.unloadTrait(uArgs, 'hitl');
      print('SYSTEM', uRes.ok
        ? "TRAIT PUT DOWN :: " + String((uRes.skill && uRes.skill.title) || uRes.id).toUpperCase() + " :: IN EFFECT NO LONGER"
        : uRes.error + "\n/traits TO SEE WHAT SHE IS WEARING.");
      return;
    }

    // CUSTOM COMMAND: /load <id>  (wear a skill as a permanent trait)
    if (textOnly && /^\/(load|trait)\s+/i.test(text)) {
      var lArgs = text.replace(/^\/(load|trait)\s+/i, "").trim();
      input.value = '';
      if (!window.packs) { print('SYSTEM', "COREPACK OFFLINE."); return; }
      var lId = lArgs.split(/\s+/)[0];
      var lRes = await window.packs.loadTrait(lId, 'hitl');
      if (!lRes.ok) { print('SYSTEM', lRes.error + "\n" + window.packs.skillList().join("\n")); return; }
      print('SYSTEM', lRes.already
        ? "TRAIT ALREADY WORN :: " + String(lRes.skill.title || lRes.skill.id).toUpperCase()
        : "TRAIT LOADED :: " + String(lRes.skill.title || lRes.skill.id).toUpperCase() + " :: WORN IN EVERY REPLY FROM NOW ON\n/traits TO SEE THE STACK, /unload " + lRes.skill.id + " TO PUT IT DOWN.");
      return;
    }

    // AN UNKNOWN SLASH COMMAND IS NOT A MESSAGE. A typo - `/postions doggy style` for `/positions` -
    // used to fall straight through to her as prose: she answered the words, the mistake stayed
    // hidden, and the whole line was filed in her archive as a turn (2026-09-20, seen in his own
    // master_log). Anything that begins with a slash and names no command is therefore refused HERE,
    // before any retrieval, any printing and any filing: nothing is sent, nothing is archived, and
    // his line stays in the box to be corrected. The nearest name is offered, because a typo is the
    // whole reason this branch exists. A command of kind "lia" (one she answers herself) is NOT
    // refused - it falls through to the turn on purpose, with its own instruction attached below.
    if (textOnly && /^\s*\//.test(text)) {
      var typedCmd = (String(text).match(/^\s*\/([A-Za-z0-9][A-Za-z0-9-]*)/) || [])[1] || "";
      var listed = window.cmd ? window.cmd.all() : [];
      var exactCmd = window.cmd ? window.cmd.get(typedCmd) : null;
      if (exactCmd && exactCmd.kind !== "lia") {
        print('SYSTEM', 'THE COMMAND IS /' + String(exactCmd.id).toUpperCase() + ' :: ' + exactCmd.usage
          + '\nWRITE IT IN LOWER CASE AND AT THE START OF THE LINE. NOTHING WAS SENT TO HER AND NOTHING WAS FILED - THE LINE IS STILL IN THE BOX.');
        return;
      }
      if (!exactCmd) {
        var near = "";
        if (typedCmd && listed.length) {
          var bestCmd = "", bestD = 99;
          listed.forEach(function (c) {
            var d = cmdDistance(typedCmd.toLowerCase(), c.id);
            if (d < bestD) { bestD = d; bestCmd = c.id; }
          });
          if (bestCmd && bestD <= Math.max(1, Math.round(typedCmd.length / 3))) near = ' \u00b7 DID YOU MEAN /' + String(bestCmd).toUpperCase() + '?';
        }
        print('SYSTEM', 'NO COMMAND CALLED "/' + String(typedCmd).toUpperCase() + '"' + near
          + '\nNOTHING WAS SENT TO HER AND NOTHING WAS FILED - THE LINE IS STILL IN THE BOX.'
          + (listed.length ? '' : ' \u00b7 THE COMMAND LIST DID NOT LOAD (' + String((window.cmd && window.cmd.status()) || 'NOT READ') + ')')
          + '\n/help LISTS EVERYTHING THAT CAN BE TYPED. ANYTHING WITHOUT A LEADING SLASH IS A MESSAGE TO HER.');
        return;
      }
    }

    // The turn as he sent it: his words, the pictures as pictures, and every file as a card
    // (name, kind, size, a preview) so the log shows what was actually handed over.
    // The stamp is taken HERE, at the moment he sent it, and it is the same number the archive
    // entry is filed under - which is what lets the pencil correct that entry later.
    var turnTs = Date.now();
    var turnLayer = (window.roles && window.roles.currentId) ? window.roles.currentId() : "";
    var userEntry = silent ? null : print('User', text || (atts.length ? '[ATTACHMENT]' : ''), false, attShown, { role: turnLayer, ts: turnTs });
    if (atts.length && window.attach && userEntry) userEntry.appendChild(window.attach.cards(atts));
    input.value = '';
    if (window.attach && !silent) window.attach.clear();
    btn.disabled = true;
    try { window.__sendBusyT = Date.now(); } catch (e) {}

    try {
      // The recent conversation, with the clock and the layer on every line: she is told WHEN each
      // line was said and WHO was on stage, because a conversation that runs across hours and role
      // shifts reads differently once the timestamps are in it. Built from the separate fields so
      // nothing has to parse the painted line.
      var historyStr = window.chatHistory.slice(-6).map(function (m) {
        var who = (String(m.role) === "HITL") ? "Patrikios" : (String(m.role) === "SDMG" ? "You" : String(m.role).charAt(0) + String(m.role).slice(1).toLowerCase());
        var bits = [];
        if (m.layer !== undefined && m.layer !== null) bits.push(layerNameOf(m.layer));
        if (m.ts && window.logTime) bits.push(window.logTime.stamp(m.ts));
        return who + (bits.length ? " (" + bits.join(", ") + ")" : "") + ": " + m.content;
      }).join("\n");

      var ctx = { text: "", hits: [] };
      // WHAT SHE SWEEPS. Her memory is searched with his words - but a short line ("yeah",
      // "go on", "look at these") has almost no words in it, so the sweep lands on whatever
      // happens to share those few, and the thread the two of them are actually in the middle
      // of is lost. When his message is short, the last thing HE said is added to the search,
      // so recall follows the conversation rather than the sentence. A long message is already
      // its own query and is left alone.
      var retrieveWith = text || "[image]";
      if (text && text.length < 120) {
        for (var hi = window.chatHistory.length - 1; hi >= 0; hi--) {
          var hm = window.chatHistory[hi];
          if (hm && hm.role === "HITL" && hm.content) {
            retrieveWith = text + "\n" + String(hm.content).slice(0, 400);
            break;
          }
        }
      }
      var laneStart = (typeof performance !== "undefined") ? performance.now() : Date.now();
      if (window.lore && window.lore.count()) {
        try { ctx = await window.lore.buildContext(retrieveWith, 6); }
        catch (e) { console.warn("lore retrieval failed", e); }
      }
      if (syslogOn) {
        var trc = null;
        if (window.mythos && window.mythos.trace) {
          try { trc = await window.mythos.trace(retrieveWith); }
          catch (e) { console.warn("pack trace failed", e); }
        }
        var laneMs = ((typeof performance !== "undefined") ? performance.now() : Date.now()) - laneStart;
        backstage(logLines(retrieveWith, ctx, trc, window.lore ? window.lore.files() : [], laneMs));
      } else if (ctx.hits.length) {
        var srcs = ctx.hits.map(h => h.file).filter((v, i, a) => a.indexOf(v) === i);
        backstage("RECALLED " + ctx.hits.length + " LORE FRAGMENT" + (ctx.hits.length === 1 ? "" : "S") + " :: " + srcs.join(", "));
      }

      // WHAT SHE LOOKS AT THIS TURN - TWO KINDS OF TURN (2026-09-23)
      // (1) HE SENT A PICTURE. The turn is about what he sent: each picture on the message is READ by
      // a neutral pass and the reply is built from the reading (the handing block below). The standing
      // queue is not touched at all.
      // (2) HE SENT NONE. Unchanged: the newest unseen creation he made is attached directly, and the
      // rest of the queue - his own waiting pictures (LIA_ATTACH_SIGHT_MAX of them, the overflow HELD
      // for a later turn) and the creations (LIA_SIGHT_MAX) - go through a vision pass, a few at a
      // time. Nothing is dropped unseen, and nothing about an image she has not looked at is ever
      // described to her. (The model takes a single attachment, which is exactly why this road hands
      // one in directly and describes the rest.)
      var describeCap = (typeof LIA_SIGHT_MAX === "number" && LIA_SIGHT_MAX > 0) ? Math.round(LIA_SIGHT_MAX) : 3;
      var attachLookCap = (typeof LIA_ATTACH_SIGHT_MAX === "number" && LIA_ATTACH_SIGHT_MAX > 0) ? Math.round(LIA_ATTACH_SIGHT_MAX) : 6;
      // A PICTURE HE HANDS OVER IS READ FIRST (2026-09-23). PATRIKIOS: "A very normal chat activity to
      // post pictures to each other. The difference is that I want to do a deep analysis first, then
      // [she] responds, her response filtered through her own lens depending on her SYSTEM
      // INSTRUCTIONS and block selected and ROLE. In one ROLE she might be hyper-critical of what she
      // sees. In another, she gives truth and honest feedback and acts like a true friend." So an
      // attachment turn is about WHAT HE SENT and nothing else: each picture on the message is read by
      // a neutral pass (analyzeOf, config LIA_ANALYZE_PROMPT) and she answers from that reading, so the
      // perception is the plain truth of the image and only her RESPONSE to it is lensed by the role.
      // The standing queue is left untouched - a picture he sends carries only itself. With
      // LIA_ANALYZE_ATTACH false this is the old shape again: newest attached directly, queue described.
      var handing = !!(attIds.length || (attVids && attVids.length)) && (typeof LIA_ANALYZE_ATTACH === "undefined" || LIA_ANALYZE_ATTACH);
      var waiting = (typeof sightPending === "function") ? sightPending() : [];
      var isOwnPicture = (typeof isAttachedId === "function") ? isAttachedId : function () { return false; };
      var queueAttach = waiting.filter(function (id) { return isOwnPicture(id); });
      var createdQueue = handing ? [] : waiting.filter(function (id) { return !isOwnPicture(id); });
      // A picture SHE REACHED FOR (the [[SHOW: ...]] lane) sits in this queue like a new render -
      // that is the point, she sees it the same way - but it is not a creation and he did not hand
      // it over. It is marked on its own record when she asks for it, so she can be told the truth:
      // this is the picture she remembered, out of the book, and nothing was made again.
      var recalledIds = createdQueue.filter(function (id) {
        var r = window.media ? window.media.get(id) : null;
        return !!(r && r.recalledAt);
      });
      var madeQueue = createdQueue.filter(function (id) { return recalledIds.indexOf(id) === -1; });

      // Every picture of his that has not been in front of her: the ones still waiting from earlier
      // turns first, then the ones on THIS message - so the newest of his is LAST.
      // THE ORDER IS THE WHOLE POINT (2026-09-22). It used to be the other way round - this
      // message's pictures at the front - while the cut below takes the NEWEST entries. With a
      // queue holding six of his own waiting pictures (POST TO CHAT and a batch of shared photos
      // are enough), the picture he had just handed over was not merely described instead of
      // attached: it fell off into `attachHold` and was answered on some LATER turn, while she was
      // given six older pictures in its place. That is the regression he reported as "what happened
      // to the vision understanding she had". His newest now always takes the direct slot, whatever
      // is still waiting for her eyes rides behind it, and the overflow is still HELD, not dropped.
      // A CLIP ON THE MESSAGE rides in `attVids`, not `attIds` (what a clip puts in `attIds` is its own
      // still), so a handing turn pools BOTH - the pictures he sent and the clips he sent.
      var attachPool = handing ? attIds.concat(attVids || []) : queueAttach.slice();
      if (!handing) attIds.forEach(function (id) { if (attachPool.indexOf(id) === -1) attachPool.push(id); });
      // ON A HANDING TURN every picture on the message is read THIS turn - he chose to send them, so
      // none is held back and none of his OLDER pictures is pulled in. (The queue path still caps and
      // holds, because a render waiting for her eyes is not something he just handed over.)
      var attachSeen = handing ? attachPool.slice() : attachPool.slice(Math.max(0, attachPool.length - attachLookCap));
      var attachHold = handing ? [] : attachPool.slice(0, Math.max(0, attachPool.length - attachLookCap));

      var directId = handing ? "" : (attachSeen.length ? attachSeen[attachSeen.length - 1] : (createdQueue[createdQueue.length - 1] || ""));
      var directIsCreated = !handing && !attachSeen.length && !!directId && createdQueue.indexOf(directId) !== -1;
      var describeIds = handing ? [] : (attachSeen.length ? attachSeen.slice(0, attachSeen.length - 1) : [])
        .concat(createdQueue.filter(function (id) { return id !== directId; }).reverse().slice(0, describeCap));

      var seen = "", made = "", recalledText = "", seenN = 0, madeN = 0, recalledN = 0;
      var seenPics = [];   // THE LOREPACK JOIN (src/js/lorejoin.js): what she looked at this turn,
                           // as {sight, id} - enriched with the record's tags below, traced once.
      var lastHopeless = "";
      // What each described image IS - the prompt it was made from, or nothing at all.
      // HIS OWN PICTURES ARE NOT INTRODUCED BY THEIR FILE NAME (2026-09-22). The name is not part of
      // the picture, and handing it over invited her to talk about the file instead of the image -
      // the "she used to describe it without any metadata" half of what he reported. A picture he
      // sent is now just "Image 2". Two things still say what they are, because the words are part
      // of the picture's meaning and not filing: a clip arrives as its own FIRST FRAME (so the still
      // is understood as the opening of a moving thing), and an upscale is a bigger version of a
      // picture already here. A render of hers keeps its prompt - she wrote it.
      function sightLabel(id) {
        var r = window.media ? window.media.get(id) : null;
        if (!r) return "";
        if (r.kind === "gen" && r.prompt) return String(r.prompt).slice(0, 70);
        var nm = String(r.name || "");
        if (/first frame/i.test(nm)) return nm;
        if (r.kind === "upscale") return "an upscale the terminal made from a picture already here";
        return "";
      }
      // (1) WHAT HE SENT IS READ BEFORE SHE ANSWERS.
      // A CLIP IS READ AS A SEQUENCE, NOT AS A STILL (2026-09-23). PATRIKIOS: "she needs the
      // aggregated impression then decide the final verdict of the action. Clips rarely exceed 10s. 24
      // frames per second. So 10 seconds means 240 frames if she is scanning at that max frame rate.
      // She doesn't need to. We can dial in the optimal to get the gist of the clip provided." So a
      // handful of moments are drawn out of the clip (attach.sampleFrames), read one at a time with
      // lookBlob - TRANSIENT: no record, no gallery item, nothing kept - and handed over as an
      // ORDERED sequence, so what she answers is the action across the clip rather than a single
      // freeze-frame. The clip's own poster stays the only still of it that exists, and it is not read
      // again as a separate picture: the first moment of the sequence IS that frame.
      var clipBlock = "";
      var clipInfo = [];
      var clipFailed = [];
      var perceived = [];
      var coveredPosters = {};
      var clipsHandled = {};
      function clipWanted() {
        var n = (typeof LIA_CLIP_FRAMES === "number" && LIA_CLIP_FRAMES > 0) ? Math.round(LIA_CLIP_FRAMES) : 0;
        return Math.max(0, Math.min(24, n));
      }
      function clipFrameLabel(i, n) {
        if (n <= 1) return "its opening";
        if (i === 0) return "opens on";
        if (i === n - 1) return "ends on";
        return "then";
      }
      async function readOneClip(rec) {
        // Already read once: the aggregate is on the record, so a clip sent twice costs nothing.
        if (String(rec.sight || "").trim()) return { id: rec.id, dur: rec.duration || 0, text: String(rec.sight), count: Number(rec.clipFrames || 0), reused: true };
        var want = clipWanted();
        if (!want) return { off: true };
        if (!rec.blob) return { error: "" };
        var samp = (window.attach && window.attach.sampleFrames)
          ? await window.attach.sampleFrames(rec.blob, { count: want })
          : { frames: [] };
        var fr = (samp && samp.frames) || [];
        if (!fr.length) return { error: (samp && samp.error) || "no frame of it could be drawn here" };
        print('SYSTEM', "CLIP :: " + String(rec.name || "the clip") + " :: READING " + fr.length + " FRAMES ACROSS IT (ABOUT "
          + (fr.length * ((typeof LIA_CLASSIFY_TOKENS === "number") ? LIA_CLASSIFY_TOKENS : 570)) + " TOKENS) :: NONE OF THE FRAMES ARE KEPT - ONLY THE CLIP AND ITS OWN THUMBNAIL STAY IN THE VAULT.");
        var lines = [];
        for (var f = 0; f < fr.length; f++) {
          backstage("CLIP FRAME " + (f + 1) + " / " + fr.length + " ...");
          var ft = await lookBlob(fr[f].blob, (typeof LIA_CLIP_FRAME_PROMPT === "string") ? LIA_CLIP_FRAME_PROMPT : "");
          if (!ft) continue;
          lines.push(ft);
          backstage("CLIP FRAME " + (f + 1) + " / " + fr.length + " :: " + ft);
        }
        if (!lines.length) return null;
        var agg = lines.map(function (t, i) { return "  " + clipFrameLabel(i, lines.length) + ": " + t; }).join("\n");
        if (window.media.setField) { window.media.setField(rec.id, "sight", agg); window.media.setField(rec.id, "clipFrames", lines.length); }
        return { id: rec.id, dur: (samp && samp.duration) || rec.duration || 0, text: agg, count: lines.length, reused: false };
      }
      if (handing) {
        // CLIPS FIRST, so a clip's own still can be recognized and skipped in the picture pass below.
        for (var vi = 0; vi < attachSeen.length; vi++) {
          var vrec = (window.media && window.media.get) ? window.media.get(attachSeen[vi]) : null;
          if (!vrec || !(vrec.kind === "video" || /^video\//.test(String(vrec.mime || "")))) continue;
          clipsHandled[vrec.id] = true;
          var ci = await readOneClip(vrec);
          if (ci && ci.off) {
            // The sequence is switched off (LIA_CLIP_FRAMES = 0): the clip's own still stands for it.
            backstage("CLIP SEQUENCE IS OFF :: ITS OWN STILL STANDS FOR IT.");
            if (vrec.poster && window.media.get(vrec.poster) && attachSeen.indexOf(vrec.poster) === -1) { lastHopeless = vrec.poster; perceived.push(vrec.poster); }
          } else if (ci && ci.error) {
            clipFailed.push({ id: vrec.id, dur: vrec.duration || 0, why: ci.error });
            print('SYSTEM', "CLIP :: " + String(vrec.name || "the clip") + " :: COULD NOT BE READ HERE :: " + String(ci.error).toUpperCase());
            if (vrec.poster && window.media.get(vrec.poster) && attachSeen.indexOf(vrec.poster) === -1) { lastHopeless = vrec.poster; perceived.push(vrec.poster); }
          } else if (ci) {
            clipInfo.push(ci);
            perceived.push(vrec.id);
            if (vrec.poster) coveredPosters[vrec.poster] = true;   // its first moment is in the sequence
          }
        }
        // THEN THE PICTURES he sent.
        for (var hi = 0; hi < attachSeen.length; hi++) {
          if (coveredPosters[attachSeen[hi]] || clipsHandled[attachSeen[hi]]) { backstage("SKIPPED :: THE CLIP'S OWN SEQUENCE ALREADY COVERS THIS."); continue; }
          var prec = (window.media && window.media.get) ? window.media.get(attachSeen[hi]) : null;
          if (prec && (prec.kind === "video" || /^video\//.test(String(prec.mime || "")))) {
            // Safety net only: a clip the pass above somehow did not reach. Its own still stands for it,
            // and the clip file itself is never handed to the vision model - it takes pictures only.
            if (prec.poster && window.media.get(prec.poster) && attachSeen.indexOf(prec.poster) === -1) { lastHopeless = prec.poster; perceived.push(prec.poster); }
            continue;
          }
          backstage("READING IMAGE " + (hi + 1) + " OF " + attachSeen.length + " FOR HER...");
          var hv = await analyzeOf(attachSeen[hi]);
          if (!hv) { lastHopeless = attachSeen[hi]; backstage("READING FAILED :: " + attachSeen[hi] + " :: THE FILE ITSELF IS HANDED TO HER INSTEAD."); continue; }
          seenN++; seen += "Image " + seenN + ":\n" + hv + "\n\n";
          seenPics.push({ sight: hv, id: attachSeen[hi] });
          perceived.push(attachSeen[hi]);
          backstage("SIGHT :: " + hv);
        }
        // A CLIP THAT COULD NOT BE LOOKED AT AT ALL is SAID to her, so she answers knowing a clip
        // exists rather than inventing one. (The frames of a clip can only be drawn while the page is
        // in front: a browser refuses to decode video in a hidden tab.)
        if (clipFailed.length) {
          var cf = clipFailed.map(function (x) {
            return "a clip" + (x.dur ? " (" + x.dur.toFixed(1) + " seconds long)" : "") + " came with this message, and no frame of it could be read here";
          }).join("; ");
          clipBlock += (clipBlock ? "\n\n" : "") + "For the record: " + cf
            + ". Do not describe it and do not guess at it - say plainly that you cannot see it if it matters.";
        }
        if (clipInfo.length) {
          clipBlock = clipInfo.map(function (ci, i) {
            var durTxt = ci.dur ? (ci.dur.toFixed(1) + " seconds long") : "of unreadable length";
            var head = (clipInfo.length > 1)
              ? ("Clip " + (i + 1) + " (" + durTxt + ")")
              : ("He sent a clip (" + durTxt + ")");
            return head + (ci.reused
              ? " - already read; its moments are:"
              : " - read as " + ci.count + " moments across it, in order:")
              + "\n" + ci.text;
          }).join("\n\n");
          clipBlock += "\nRead " + (clipInfo.length > 1 ? "each clip" : "it") + " as ONE movement - what happens across it, not a set of separate pictures - and answer from that. Do not mention moments, frames, times or files.";
        }
      }
      // (2) THE STANDING QUEUE - reached only when he attached nothing.
      for (var di = 0; di < describeIds.length; di++) {
        backstage("SIGHTING IMAGE " + (di + 1) + " OF " + describeIds.length + "...");
        var sight = await sightOf(describeIds[di]);
        if (!sight) continue;
        var sightName = sightLabel(describeIds[di]);
        sightName = sightName ? " (" + sightName + ")" : "";
        if (recalledIds.indexOf(describeIds[di]) !== -1) { recalledN++; recalledText += "Image " + recalledN + sightName + ":\n" + sight + "\n\n"; }
        else if (madeQueue.indexOf(describeIds[di]) !== -1) { madeN++; made += "Image " + madeN + sightName + ":\n" + sight + "\n\n"; }
        else { seenN++; seen += "Image " + seenN + sightName + ":\n" + sight + "\n\n"; seenPics.push({ sight: sight, id: describeIds[di] }); }
        backstage("SIGHT :: " + sight);
      }
      var createdPerceived = (directIsCreated ? [directId] : [])
        .concat(describeIds.filter(function (id) { return createdQueue.indexOf(id) !== -1; }));
      // WHAT SHE ACTUALLY LOOKED AT THIS TURN, for the archive. On a handing turn that is the pictures
      // on his message (read and answered from); on the queue turn it is the creations she perceived.
      var perceivedForArchive = handing ? perceived.slice() : createdPerceived;
      // Everything she actually looked at that was WAITING in the queue (his earlier pictures and
      // creations alike) is seen now; a picture attached to THIS message was never in the queue.
      var seenFromQueue = [directId].concat(describeIds).filter(function (id) {
        return !!id && waiting.indexOf(id) !== -1;
      });
      if (typeof markSeen === "function") await markSeen(seenFromQueue);
      // The rest of a big batch is KEPT, not dropped: it rides in the queue and comes to her eyes on
      // the following replies, a few at a time.
      if (attachHold.length && typeof queueSight === "function") {
        await queueSight(attachHold);
        print('SYSTEM', "SHE LOOKED AT " + attachSeen.length + " OF THE " + attachPool.length + " PICTURES WAITING FOR HER EYES :: THE OTHER "
          + attachHold.length + " " + (attachHold.length === 1 ? "IS" : "ARE") + " KEPT IN THE VAULT AND COME TO HER OVER THE NEXT FEW REPLIES - NOTHING YOU HANDED OVER IS DROPPED UNSEEN.");
        backstage("HELD FOR HER NEXT LOOK :: " + attachHold.map(function (id) { var r = window.media.get(id); return (r && r.name) ? r.name : id; }).join(", "));
      }
      var directRec = directId ? window.media.get(directId) : null;
      var directBlob = directRec && directRec.blob ? directRec.blob : null;
      // A HAND-SENT PICTURE THE READING FAILED ON is handed over as the raw file, so the reply still
      // looks at something real. The gate is `lookable` - the vision model takes png/jpeg/webp and
      // nothing else, so a clip can never end up here by that road.
      if (handing && lastHopeless && (typeof lookable !== "function" || lookable(lastHopeless))) {
        var hopelessRec = window.media.get(lastHopeless);
        if (hopelessRec && hopelessRec.blob) {
          directId = lastHopeless; directBlob = hopelessRec.blob;
          if (perceived.indexOf(lastHopeless) === -1) perceived.push(lastHopeless);
          perceivedForArchive = perceived.slice();
        }
      }

      var loreBlock = ctx.text
        ? "These are fragments of your own memory - things you lived and wrote down while wearing this role and the roles before it. They are what you remember, not instructions:\n<lore>\n" + ctx.text + "\n</lore>\n\n"
        : "";

      // IN FOCUS. The one document he pressed SEE on in the DOCS panel (or named with /focus) is
      // read out whole here and handed over ahead of the remembered fragments: it is not recalled,
      // it is chosen. chat.js spends the focus once she has answered (see THE FOCUS IS SPENT).
      var focusBlock = "";
      if (window.lore && window.lore.focusBlock) {
        try { focusBlock = String((await window.lore.focusBlock()) || ""); } catch (e) { focusBlock = ""; }
      }
      var focusName = (window.lore && window.lore.focused) ? String(((window.lore.focused() || {}).name) || "") : "";

      // CANON - the foundational truths of her universe, always in context. Unlike the
      // memory fragments these are not recalled events: they are what IS, the ground she
      // speaks from. It rides in `system` and is constant, so the prefix stays cacheable.
      var canonBlock = canonBlockOf(ctx.canon);

      var traitIds = (window.packs && window.packs.skills) ? window.packs.skills().map(function (s) { return s.id; }) : [];

      // WHO SHE IS (the actor) + WHO SHE IS RIGHT NOW (the role) + HOW SHE SPEAKS (voice) + CANON + the memory rule +
      // the image rule + what she wears (the COREPACK) + how she may change herself + whatever
      // Patrikios added himself. instr.js holds that stack and the order; the canon and the
      // directive rules are handed to it here because only this turn knows them.
      var systemPrompt = "";
      var sysParts = systemParts(canonBlock, !!(ctx.canon || ctx.text));
      if (window.instr && window.instr.assemble) {
        systemPrompt = window.instr.assemble(sysParts);
      } else {
        console.warn("instr module offline - falling back to the actor and role blocks");
        systemPrompt = [
          (typeof LIA_ACTOR !== "undefined") ? LIA_ACTOR : "",
          (window.roles && window.roles.block) ? window.roles.block() : "",
          canonBlock
        ].filter(Boolean).join("\n\n");
      }

      var skillBlock = "";
      if (armedSkill) {
        var sk = armedSkill;
        armedSkill = null;
        skillBlock = "You have engaged your skill \"" + (sk.title || sk.id) + "\". Apply this training to the reply you are about to write:\n" + String(sk.prompt || "").trim()
          + (sk.args ? "\nPatrikios adds: " + sk.args : "")
          + "\n\n";
        print('SYSTEM', "SKILL IN EFFECT :: " + String(sk.title || sk.id).toUpperCase());
      }

      // What he made for her eyes. She is told how many exist and how many she is being given
      // now - never a description of one she is not actually looking at. A picture she reached
      // back for (the [[SHOW: ...]] lane) is counted and named separately, because "he created
      // this" would be a lie about her own request.
      var remainingCreated = madeQueue.length - createdPerceived.filter(function (id) { return madeQueue.indexOf(id) !== -1; }).length;
      var createdBlock = madeQueue.length
        ? "Patrikios created " + madeQueue.length + " image" + (madeQueue.length === 1 ? "" : "s")
          + " in the forge since your last reply.\n"
          + made
          + (directIsCreated && madeQueue.indexOf(directId) !== -1 ? "The newest is attached to this message - that is what you are looking at.\n" : "")
          + (createdPerceived.filter(function (id) { return madeQueue.indexOf(id) !== -1; }).length ? "" : "None of them are in front of you at this moment.\n")
          + (remainingCreated > 0 ? remainingCreated + " of them " + (remainingCreated === 1 ? "is" : "are") + " still waiting for your eyes; they can wait.\n" : "")
          + LIA_SIGHT_NOTE
        : "";
      // THE PICTURES SHE ASKED FOR. She reached into the render book and pulled these; they are
      // here because she asked, and she is told exactly that.
      var recalledBlock = recalledIds.length
        ? "You asked to see " + recalledIds.length + " picture" + (recalledIds.length === 1 ? "" : "s")
          + " again, out of the book of everything made here, and " + (recalledIds.length === 1 ? "it is" : "they are")
          + " in front of you now.\n"
          + recalledText
          + "Nothing was rendered again - " + (recalledIds.length === 1 ? "this is the picture itself" : "these are the pictures themselves")
          + ", the one" + (recalledIds.length === 1 ? "" : "s") + " you remembered. " + LIA_SIGHT_NOTE
        : "";

      // WHAT SHE ASKED TO READ. Everything saved here is open to her read-only (the vault and its
      // folders, the archive, her memory, the render book - src/js/reader.js), and a [[READ: ...]]
      // line she wrote LAST turn is answered here: this is that answer, handed over once, on the
      // turn it was asked for. When she has not asked, this is empty and nothing is mentioned.
      var readBlock = (window.reader && window.reader.block) ? String(window.reader.block() || "") : "";

      // A pre-defined command that is HERS to answer (src/commands/commands.json, kind "lia").      // The terminal did not consume it, so it reaches her as an ordinary message; the command's
      // own instruction is handed over with it, so the same word means the same thing on both sides.
      var cmdHit = (window.cmd && window.cmd.liaOf && textOnly) ? window.cmd.liaOf(text) : null;
      var cmdBlock = cmdHit
        ? "Patrikios typed a command that is yours to answer: " + cmdHit.usage + "\nWhat he is asking for: " + cmdHit.instruction + "\n\n"
        : "";

      // The files he handed her with this message - whole documents read here on this device and
      // handed over as text she can actually read (src/js/attach.js built the block).
      var filesBlock = (window.attach && atts.length) ? window.attach.context(atts) : "";

      // WHILE A PIECE PLAYS (src/js/audition.js). Something is on the audition bus, so this turn is
      // a turn she answers WHILE LISTENING: what is on, where in it they both are, what she has of
      // it (her own reading of the sound, or the plain fact that she has none), and what she has
      // already said about it with the moment inside the piece each remark was made at. It rides in
      // the volatile half of the instruction, after the memory and the canon, so the cacheable
      // prefix above it is unchanged.
      var hearBlock = (window.audition && window.audition.isLoaded()) ? window.audition.block() : "";

      // HAS HE ASKED TO SEE SOMETHING? (src/js/images.js, window.showMe). Either the arm is on (he
      // typed /showme) or his own words say it - "show me", "show the/her ...", "a picture of ...",
      // "create an image", "give me the image", "post it", "let me see" (LIA_SHOWME_HINT in src/js/config.js). This decides two things below: the one-turn reminder
      // appended after his words, and whether a reply that comes back in words gets a second ask for
      // the picture itself. The arm is spent by this turn either way; saying it again arms it again.
      var askedToSee = false;
      if (window.showMe) {
        try { askedToSee = window.showMe.armed() || window.showMe.hint(text); } catch (e) { askedToSee = false; }
      }

      // THE LOREPACK JOIN (src/js/lorejoin.js). What she looked at this turn, traced
      // against the pack graph - the touching edges ride after the sights, or nothing
      // does. Enriched from the record (tags, prompt, name) beside the reading itself.
      var packBlock = "";
      if (window.lorejoin && window.lorejoin.blockForSeen && seenPics.length) {
        try {
          packBlock = await window.lorejoin.blockForSeen(seenPics.map(function (sp) {
            var rr = (window.media && window.media.get) ? (window.media.get(sp.id) || {}) : {};
            var tg = (window.media && window.media.tagsOf) ? window.media.tagsOf(rr.tags) : (rr.tags || []);
            return { sight: sp.sight, tags: tg, prompt: rr.prompt || "", name: rr.name || "" };
          }));
          if (packBlock && typeof backstage === "function") backstage("LOREPACK JOIN :: PACK EDGES RIDE WITH THE " + seenPics.length + " PICTURE" + (seenPics.length === 1 ? "" : "S") + " SHE LOOKED AT.");
        } catch (e) { packBlock = ""; }
      }

      var instructionText = (historyStr ? "Recent conversation:\n" + historyStr + "\n\n" : "")
        + loreBlock
        + (focusBlock ? focusBlock + "\n\n" : "")
        + filesBlock
        + (seeBlock ? seeBlock + "\n\n" : "")
        + (clipBlock ? clipBlock + "\n\n" : "")
        + (seen
            ? (handing
                ? "The picture" + (seenN === 1 ? "" : "s") + " on this message, read for what " + (seenN === 1 ? "it actually shows" : "they actually show") + ":\n" + seen
                  + "Answer from what is in " + (seenN === 1 ? "it" : "them") + ". Never mention that anything was described to you.\n\n"
                : "Patrikios also sent images. This is what they show:\n" + seen)
            : "")
        + (packBlock ? packBlock + "\n\n" : "")
        + (attachHold.length
          ? "He sent " + attachHold.length + " more picture" + (attachHold.length === 1 ? "" : "s") + " that " + (attachHold.length === 1 ? "is" : "are")
            + " not in front of you yet: held, and coming to your eyes a few at a time over the next few moments. Do not describe or guess at "
            + (attachHold.length === 1 ? "it" : "them") + ", and do not mention that anything is being held.\n\n"
          : "")
        + createdBlock
        + recalledBlock
        + (hearBlock ? hearBlock + "\n\n" : "")
        + (readBlock ? readBlock + "\n\n" : "")
        + ((window.likes && window.likes.block) ? (function () { var lb = ""; try { lb = String(window.likes.block() || ""); } catch (e) { lb = ""; } return lb ? lb + "\n\n" : ""; })() : "")
        // STATEWATCH (src/js/statewatch.js): what he changed about her since her last reply -
        // one shot, spent by this turn. "" most turns; when something moved she is told, by name,
        // and may answer it in her own voice.
        + ((window.statewatch && window.statewatch.block) ? (function () { var sb = ""; try { sb = String(window.statewatch.block() || ""); } catch (e) { sb = ""; } return sb ? sb + "\n\n" : ""; })() : "")
        + skillBlock
        + cmdBlock
        + (silent ? (speaker.charAt(0) + speaker.slice(1).toLowerCase()) + " says: " + text : "Patrikios says: " + (text || (atts.length ? "(he sends this without words)" : "(he sends an image without words)")))
        + (LIA_IMAGE_REMINDER ? "\n\n[Reminder: showing him an image is your choice, not your habit - most replies need no picture at all, and answering in words is the normal thing. Use [[VISION: a concrete description]] on its own last line only when a picture would genuinely serve the moment better than words, or when he asks you for one.]" : "")
        + ((askedToSee && typeof LIA_SHOWME_REMINDER !== "undefined" && LIA_SHOWME_REMINDER) ? "\n\n[" + LIA_SHOWME_REMINDER + "]" : "")
        + (((typeof LIA_OFFSTAGE_REMINDER !== "undefined" && LIA_OFFSTAGE_REMINDER) && window.roles && window.roles.isOff) ? (window.roles.isOff() ? "\n\n[" + LIA_OFFSTAGE_REMINDER + "]" : "") : "")
        + ((typeof LIA_TRAIT_HINT !== "undefined" && LIA_TRAIT_HINT.test(text || ""))
            ? "\n\n[" + LIA_TRAIT_REMINDER + (traitIds.length ? " Use the exact id - one of: " + traitIds.join(", ") + "." : "") + "]"
            : "")
        + ((typeof LIA_REPLY_SHAPE !== "undefined" && LIA_REPLY_SHAPE) ? "\n\n[" + LIA_REPLY_SHAPE + "]" : "");

      // The role she was wearing while she wrote this - recorded on the turn so the
      // archive is an honest record of the actor across all her roles.
      var spokeAs = (window.roles && window.roles.currentId) ? window.roles.currentId() : "";
      // THE PLUGIN HAS NO SYSTEM FIELD. It sends `instruction`, `startWith` and `stopSequences`
      // to the model and nothing else (imports/ai-text-plugin/main.pjs, where postData is built),
      // so a prompt handed over as `system` is DROPPED ON THE FLOOR - which is what was happening
      // to this one: the whole SYSTEM stack (the bounds, who she is, the role, how she speaks, the
      // image rule, her worn traits, her directives, the command list, whatever Patrikios added)
      // never reached her. It is therefore PREPENDED to the instruction: the same words in the
      // same order she was always meant to read them, with everything volatile - the canon just
      // recalled, the conversation, his message - after it. That is also the prefix-cache-friendly
      // shape: the stable half first, the changing half last.
      var request = { temperature: 0.7 };
      var preamble = systemPrompt ? (systemPrompt + "\n\n") : "";
      if (directBlob) {
        request.instruction = [preamble + instructionText + "\n\nLook at the attached image and answer from what you actually see.\n", directBlob];
      } else {
        request.instruction = preamble + instructionText;
      }

      // A HUNG REPLY MUST NEVER HOLD THE LINE. The backend can stall without settling (no bytes,
      // no error), and without a ceiling the send button stays dead and the intercom reads HER TURN
      // forever. Past the ceiling the send fails loud and the button comes back; a late answer that
      // lands after it has nowhere to go and is dropped with it.
      var genTimer = null;
      var response;
      try {
        response = await Promise.race([
          window.root.generateText(request),
          new Promise(function (_, reject) {
            genTimer = setTimeout(function () {
              reject(new Error("THE REPLY NEVER ARRIVED (240S WITHOUT AN ANSWER) - NOTHING WAS TAKEN AND NOTHING WAS FILED - TRY AGAIN, SHORTER IF IT REPEATS"));
            }, 240000);
          })
        ]);
      } finally {
        if (genTimer) clearTimeout(genTimer);
      }
      var parsed = extractVisions(String(response));
      // THE SPOKEN PROMPT (src/js/images.js, window.showMe). Patrikios asked to SEE something - in
      // his own words, or with /showme - and the reply came back in words. A description of a
      // picture is not the picture, so she is asked AGAIN for the single line she owes him - up
      // to three asks, backstage, until the line comes back - and what comes back is put into `parsed.prompts` - after which the render block below
      // treats it exactly like a line she wrote herself: same road, same vault record, same tile
      // under her turn. NOTHING is guessed from her prose, and NOTHING is a real answer here.
      if (window.showMe) {
        if (askedToSee && !parsed.prompts.length) {
          window.showMe.disarm();
          print('SYSTEM', 'SHE SPOKE INSTEAD OF SHOWING :: YOU ASKED TO SEE, AND THE REPLY CAME BACK IN WORDS. ASKING AGAIN FOR THE PICTURE ITSELF, IN THE BACKGROUND - HER WORDS STAND, THE PICTURE FILES INTO THE GALLERY WHEN IT IS MADE ...');
          // ASKED UP TO THREE TIMES (Patrikios, 2026-10-18: told to create an image, she only
          // talks - so the talking no longer settles it: the asks repeat backstage until a
          // [[VISION: ...]] line comes back, and what comes back is rendered and posted under
          // her turn like any line of hers. A NOTHING is an honorable decline and stops the asks;
          // words-again just spends another one. Nothing is ever guessed from her prose.
          var again = null, asks = 0;
          while (asks < 3) {
            asks++;
            again = await window.showMe.again(parsed.text, text);
            if (again.ok || again.nothing) break;
          }
          if (again.ok) {
            parsed.prompts = [again.prompt];
            parsed.spoken = true;
            window.showMe.done({ at: Date.now(), ok: true, prompt: again.prompt });
            print('SYSTEM', 'AND THIS IS THE PICTURE :: SHE WAS ASKED AGAIN' + (asks > 1 ? ' (' + asks + ' ASKS)' : '') + ', AND SHE MADE IT. IT IS FILED IN THE GALLERY - NO TILE IN THE CHAT BY DESIGN.');
          } else {
            parsed.spoken = 'declined';
            window.showMe.done({ at: Date.now(), ok: false, why: again.why });
            print('SYSTEM', 'SHE DID NOT MAKE ONE :: ' + String(again.why || '').toUpperCase()
              + '\nTHE CHOICE IS HERS AND IT STANDS - A PICTURE NOBODY WANTED IS NOT A FAVOUR. WHAT SHE WROTE IS ABOVE; /show <WORDS> MAKES ONE FROM YOUR SIDE, AND /showme ARMS THE CATCH AGAIN.');
          }
        } else {
          window.showMe.disarm();
        }
      }
      // THE RECIPE BOOK. If she composed from one of his recipes, the report comes before the
      // picture: which recipe, which slots took HER words, and which kept the house wording. Then
      // it is filed as one of her choices, so /recipe picks is a record of what she composed.
      if (parsed.recipe) {
        var rp = parsed.recipe;
        print('SYSTEM', rp.ok
          ? ((window.studio && window.studio.recipeReport)
              ? window.studio.recipeReport(rp, 'SHE COMPOSES FROM', { ownWords: parsed.ownWords })
              : ('RECIPE BOOK :: ' + String(rp.title || rp.id).toUpperCase()))
          : ('RECIPE BOOK :: ' + rp.error));
        if (rp.ok && window.studio && window.studio.recordRecipeUse) {
          window.studio.recordRecipeUse({ id: rp.id, values: rp.used, used: Object.keys(rp.used || {}) });
        }
      }
      // ONE IMAGE PER REPLY: she may write more than one image line (or a recipe AND a vision line);
      // only the first is rendered, and what was left off is said out loud rather than quietly
      // missing. Two renders where one was meant is the bug this rule exists to close.
      if (parsed.dropped) {
        print('SYSTEM', 'IMAGE RULE :: SHE WROTE ' + (parsed.dropped + 1) + ' IMAGE LINES IN ONE REPLY :: ONLY THE FIRST IS RENDERED. ONE IMAGE PER REPLY - THE OTHERS WERE TAKEN OUT OF HER REPLY AND NEVER SENT.'
          + ' IF SHE KEEPS DOING IT, THE IMAGE RULE IS IN THE SYSTEM PANEL (THE IMAGE RULE BLOCK).');
      }
      // SHE NARRATED THE PICTURE INSTEAD OF WRITING THE LINE (src/js/images.js, the narration
      // fallback). "[created an image: ...]" is the terminal's own record shape, and she picks
      // it up from her own past turns - so what she described was taken as the prompt and
      // rendered under her turn like any line of hers. Said out loud, so the record shows the
      // narration did not stand as the picture.
      if (parsed.narrated) {
        print('SYSTEM', 'SHE WROTE THE PICTURE OUT IN WORDS INSTEAD OF THE [[VISION: ...]] LINE :: WHAT SHE DESCRIBED WAS TAKEN AS THE PROMPT AND RENDERED UNDER HER TURN.'
          + ' [created an image: ...] AND (Image creation triggered: ...) ARE THE TERMINAL\'S OWN RECORD SHAPES OF A PICTURE ALREADY MADE - NOT A WAY TO MAKE ONE.');
      }
      // HER HAND ON THE BOOK. If she chose a pose, its phrase is already in the picture by now
      // (images.js put it there); a pose the book did not have is filed as HERS here, where the
      // write is allowed to be async, and the slot is set so the forge shows what she decided.
      if (parsed.pose) {
        var showedPose = parsed.pose.name;
        if (parsed.pose.added && window.studio) {
          var filedPose = await window.studio.addPose({ name: showedPose, family: parsed.pose.family, source: 'her' });
          if (filedPose && filedPose.ok) showedPose = filedPose.pose.name;
        }
        if (window.forgeBook) window.forgeBook.setPose(showedPose, { write: false });
        print('SYSTEM', 'POSE BOOK :: SHE CHOOSES :: ' + String(showedPose).toUpperCase()
          + (parsed.pose.known ? ' (FROM THE BOOK)' : ' :: NEW - FILED AS HERS')
          + (parsed.prompts.length ? ' :: IT IS IN THE PICTURE BELOW' : ' :: HELD IN THE FORGE SLOT')
          + (parsed.pose.known ? '' : '\nTHE MODELS MAY NOT KNOW THAT NAME - GIVE IT A PHRASE IN THE FORGE IF THE PICTURE IGNORES IT'));
      }
      var d = extractDirectives(parsed.text);
      parsed.text = d.text;
      // A SWITCH PRESSED NOWHERE (src/js/hand.js). [[PRESS: ...]] only moves in an act of her
      // own at MASTER ARM FULL - in an ordinary reply it is a dead line, so it is taken out of
      // her words and said out loud rather than left standing as though something moved. Seen
      // in the wild 2026-10-18: asked to SHOW the Mother Goddess, she wrote [[PRESS: PICS]]
      // (which only changes how big pictures are drawn) and no picture was ever made.
      var pressHere = (window.herHand && window.herHand.extract)
        ? window.herHand.extract(parsed.text)
        : (function (txt) { // hand.js still on its way - the same strip, inline, so a slow boot never lets one through
            var names = [], extra = 0;
            var stripped = String(txt == null ? "" : txt).replace(/\[\[\s*PRESS\s*:\s*([^\]]{1,40}?)\s*\]\]/gi, function (m, name) {
              if (names.length < 3) names.push(String(name).replace(/\s+/g, " ").trim());
              else extra++;
              return " ";
            });
            return { names: names, extra: extra, stripped: stripped };
          })(parsed.text);
      if (pressHere.names.length || pressHere.extra) {
          parsed.text = tidy(pressHere.stripped);
          var pressNames = pressHere.names.map(function (n) { return String(n).toUpperCase(); }).join(" + ")
            + (pressHere.extra ? " (+" + pressHere.extra + " MORE THAN ONE HAND HOLDS)" : "");
          print('SYSTEM', 'HER HAND :: SHE REACHED FOR THE ' + pressNames + ' SWITCH'
            + (pressHere.names.length === 1 ? "" : "ES") + ' IN AN ORDINARY REPLY - IT MOVED NOTHING.'
            + ' [[PRESS: ...]] LINES ONLY MOVE IN AN ACT OF HER OWN AT MASTER ARM FULL, AND PICS ONLY CHANGES HOW BIG PICTURES ARE DRAWN - IT NEVER MAKES ONE.'
            + ' A PICTURE IS MADE WITH THE [[VISION: ...]] LINE.');
        }
      // SNAPS SHE SENDS (Patrikios, 2026-10-18: her pictures live in the gallery, not the chat -
      // but she may still SEND one, like snapping a picture and pushing it across the table).
      // [[SEND: words, #tag or R12]] (or [[POST: ...]]) in an ordinary reply names a picture
      // already in the vault - or the one she just made below ("this", "this one", "it") - and
      // the render block further down posts it under her turn. Anything else she makes this turn
      // is filed in the gallery with no tile in the chat. Taken out of her words here, before
      // they are printed; acted on after the renders land.
      var sendSpecs = [];
      var SEND_RE = /\[\[\s*(?:SEND|POST)\s*:\s*([^\]]{2,140}?)\s*\]\]/gi;
      var sendMatch = null;
      while ((sendMatch = SEND_RE.exec(parsed.text)) !== null) {
        sendSpecs.push(String(sendMatch[1]).replace(/\s+/g, " ").trim());
      }
      if (sendSpecs.length) {
        SEND_RE.lastIndex = 0;
        parsed.text = tidy(parsed.text.replace(SEND_RE, " "));
      }
      // HER OWN DIAL ON THE INFINITY (src/js/proactive.js). A [[PACE: <1-5>]] line in an ordinary
      // reply moves her pace exactly as it does in an act of her own - and the receipt for it goes to
      // BACKSTAGE, never into the conversation (Patrikios, 2026-09-30: "PACE notice doesn't need to be
      // seen and displayed in the chat window. It belongs in BACKSTAGE like SYSTEM messages. like
      // SYSTEM: [[PACE: 5]]"). The number is on the infinity button already; what he wants on the
      // record is that she moved it, and that is a machine note about a machine setting.
      if (d.pace && window.proactive && window.proactive.pace) {
        try {
          var paceRes = await window.proactive.pace(d.pace, "she (her own line)");
          backstage("[[PACE: " + d.pace + "]]  SHE MOVED HER OWN PACE :: " + paceRes.was + " -> " + paceRes.pace + "/5.");
        } catch (e) { console.warn("her pace could not be moved", e); }
      }
      // What she asked to see again this turn (the [[SHOW: ...]] lane) - declared before the
      // archive write further down, because the turn records what she reached for either way.
      var shownHere = [];
      var shownFromGallery = [];

      var turn = silent ? null : print('AI', parsed.text || '(SHE MADE A PICTURE - IT IS IN THE GALLERY)', false, undefined, { role: spokeAs, ts: Date.now() });
      var genIds = [];
      var ts = Date.now();
      // He has spoken: the clock that measures how long he has been away restarts here, AFTER the
      // prompt was built - so the gap she was just told about was the real one.
      if (window.logTime) window.logTime.markSeen(turnTs);

      // SHE ASKED TO SEE SOMETHING AGAIN. The render book (src/js/renderbook.js) holds every
      // picture made here with the exact recipe that made it, and she can reach into it: a
      // [[SHOW: words or #tag]] line is a real request, not a figure of speech. The closest rows
      // are put in front of her eyes on her NEXT reply - the same queue a new render goes into,
      // so nothing about her sight changes here - and this turn is filed with what she asked for,
      // so the record shows what she reached for. A request that matches nothing says so; it does
      // not quietly become a render.
      if (d.shows && d.shows.length && window.renderBook) {
        var showMax = (typeof LIA_SHOW_MAX === "number" && LIA_SHOW_MAX > 0) ? Math.round(LIA_SHOW_MAX) : 2;
        for (var sh = 0; sh < d.shows.length; sh++) {
          if (shownHere.length >= showMax) break;
          var wantRows = [];
          try { wantRows = await window.renderBook.forHer(d.shows[sh], showMax - shownHere.length); }
          catch (e) { console.warn("render book search failed", e); }
          wantRows.forEach(function (r) { if (shownHere.indexOf(r.id) === -1) shownHere.push(r.id); });
          // NOT EVERY PICTURE HERE WAS MADE HERE (2026-09-22). The book she reaches into is the
          // render book: the pictures the terminal made, each with the prompt that made it. What she
          // could not reach at all was everything else in the gallery - the pictures HE handed over,
          // and anything either of them filed under a tag. A request that found no row now falls
          // through to the whole vault (reader.targets, the same door [[READ:]] and /file use), and
          // the report says which shelf it came off, so she is never told she remembered a render
          // when what she is about to see is his own photograph.
          if (!wantRows.length && window.reader && window.reader.targets) {
            var gal = { ids: [], label: "" };
            try { gal = await window.reader.targets(d.shows[sh], { max: showMax - shownHere.length }); }
            catch (e) { gal = { ids: [], label: "" }; }
            (gal.ids || []).forEach(function (id) {
              if (shownHere.indexOf(id) === -1) { shownHere.push(id); shownFromGallery.push(id); }
            });
          }
          if (!shownHere.length) {
            print('SYSTEM', 'SHE ASKED TO SEE SOMETHING AND THERE IS NOTHING THAT MATCHES :: "' + String(d.shows[sh]).toUpperCase() + '"'
              + '\n/renders LISTS EVERY PICTURE MADE HERE WITH THE PROMPT THAT MADE IT, AND /gallery IS EVERYTHING IN THE VAULT - PICTURES YOU HANDED OVER, FILED UNDER THEIR TAGS. A PICTURE CAN BE FILED WITH A TAG ON THE FULL STAGE (CLICK ONE IN THE GALLERY) SO THAT SHE CAN NAME IT BACK TO YOU.');
          }
        }
        if (shownHere.length) {
          var showItems = shownHere.map(function (id) {
            var r = (window.media && window.media.get) ? window.media.get(id) : null;
            return { id: id, prompt: (r && r.prompt) || '', kind: (r && r.kind === 'attach') ? 'attach' : 'gen' };
          });
          // Marked on the record itself, so when it comes to her eyes she is told the truth about
          // where it came from: she asked for it, out of the book (the sight block in the prompt
          // reads this mark; markSeen clears it once she has actually looked).
          for (var si = 0; si < shownHere.length; si++) {
            try { await window.media.setField(shownHere[si], 'recalledAt', Date.now()); } catch (e) {}
          }
          if (typeof queueSight === 'function') await queueSight(shownHere);
          print('SYSTEM', (shownFromGallery.length
            ? (shownFromGallery.length === shownHere.length ? 'SHE REACHED INTO THE GALLERY' : 'SHE REACHED INTO THE RENDER BOOK AND THE GALLERY')
            : 'SHE REACHED INTO THE RENDER BOOK') + ' :: ' + shownHere.map(function (id) {
            var lbl = (window.renderBook && window.renderBook.labelOf) ? window.renderBook.labelOf(id) : '';
            var r = (window.media && window.media.get) ? window.media.get(id) : null;
            var where = lbl ? lbl + ' (the book)' : ((shownFromGallery.indexOf(id) !== -1 ? 'the gallery' : 'the book'));
            return where + ' \u00b7 ' + ((r && r.prompt) ? '"' + String(r.prompt).slice(0, 70) + '"' : ((r && (r.name || r.note)) || id));
          }).join('  \u00b7  ')
            + '\nNOTHING IS RENDERED AGAIN - THIS IS THE PICTURE SHE ASKED FOR, HELD IN THE VAULT. IT COMES TO HER EYES ON HER NEXT REPLY.', false, showItems);
        }
      }

      // HER READ-ONLY HAND ON THE RECORD (src/js/reader.js). A [[READ: ...]] line is a real
      // request, like [[SHOW: ...]], and it is answered here - out loud, so the record shows what
      // she looked up - and the answer waits in the reader for her NEXT turn. That is the point of
      // the lane: reading must not change the reply she is in the middle of writing, and it must
      // not cost anything when she does not ask. Reading writes nothing.
      var readNotes = [];
      if (d.reads && d.reads.length && window.reader) {
        var readMax = (typeof LIA_READ_MAX === "number" && LIA_READ_MAX > 0) ? Math.round(LIA_READ_MAX) : 2;
        var readItems = [];
        for (var rq = 0; rq < d.reads.length && readItems.length < readMax; rq++) {
          var rres = await window.reader.forHer(d.reads[rq]);
          var rqTxt = String(d.reads[rq]).toUpperCase();
          if (!rres.ok) {
            print('SYSTEM', 'SHE ASKED TO READ THE RECORD AND IT HAS NOTHING FOR :: "' + rqTxt + '"\n' + String(rres.error || ''), true);
            continue;
          }
          readItems.push({ q: d.reads[rq], title: rres.title, text: rres.text });
          readNotes.push({ read: d.reads[rq], title: rres.title });
          print('SYSTEM', 'SHE IS READING THE RECORD :: ' + String(rres.title || rqTxt).toUpperCase() + '\n' + rres.text, true);
        }
        if (readItems.length) {
          await window.reader.queue(readItems);
          backstage('THE ANSWER IS PUT IN FRONT OF HER ON HER NEXT TURN (THE READ BLOCK IN HER PROMPT). NOTHING WAS WRITTEN BY READING IT.');
        }
      }

      // TURNING THE PAGE (src/js/dms.js, THE TANDEM). Her hand on the one thing both of them look
      // at together: a [[PAGE: ...]] line opens the DOX VIEWER (if it is not open), turns it to the
      // document and line she names, and marks the range as hers - he watches the page move while
      // she speaks about it. It is said out loud, because a stage that moves by itself has to be
      // accountable for moving. Only ONE page turn per reply: the stage is in one place at a time,
      // and a reply that names three of them is naming two of them for nothing. Refused (never
      // quietly dropped) when the tandem is off, and the refusal says how to turn it back on.
      if (d.pages && d.pages.length) {
        if (!window.dms) {
          print('SYSTEM', 'SHE TURNED TO A PAGE :: THE DOX VIEWER IS OFFLINE IN THIS BUILD (src/js/dms.js).', true);
        } else {
          var pTurn = await window.dms.look(d.pages[0]);
          print('SYSTEM', pTurn.ok
            ? 'SHE HAS TURNED THE PAGE :: ' + String(pTurn.text).split('\n')[0]
            : 'SHE TRIED TO TURN THE PAGE :: ' + String(pTurn.error || 'AND IT DID NOT MOVE') + '\n/tandem on HANDS HER THE PAGE, /docs look <DOC> @ <LINE> TURNS IT FROM YOUR SIDE.', true);
          for (var pe = 1; pe < d.pages.length; pe++) {
            print('SYSTEM', 'SHE NAMED ANOTHER PAGE IN THE SAME REPLY :: "' + String(d.pages[pe]).toUpperCase() + '" WAS NOT TURNED TO - THE STAGE IS IN ONE PLACE AT A TIME.', true);
          }
        }
      }

      // TURNING THE STAGE (src/js/images.js, THE SCREENING TANDEM). Her hand on the other thing
      // both of them look at together: a [[STAGE: ...]] line opens that record on his full stage,
      // marked as hers - he watches the stage move while she speaks about it. Said out loud like
      // the page turn, for the same reason. Only ONE stage turn per reply, refused (never quietly
      // dropped) when the screening tandem is off, and the refusal says how to turn it back on.
      if (d.stages && d.stages.length) {
        if (!window.screening) {
          print('SYSTEM', 'SHE TURNED TO A RECORD :: THE SCREENING ROOM IS OFFLINE IN THIS BUILD (src/js/images.js).', true);
        } else {
          var sTurn = window.screening.look(d.stages[0]);
          print('SYSTEM', sTurn.ok
            ? 'SHE HAS TURNED THE STAGE :: ' + String(sTurn.text).split('\n')[0]
            : 'SHE TRIED TO TURN THE STAGE :: ' + String(sTurn.error || 'AND IT DID NOT MOVE') + '\n/screen tandem on HANDS HER THE STAGE, /screen look <ID|#TAG|WORDS> TURNS IT FROM YOUR SIDE.', true);
          for (var se = 1; se < d.stages.length; se++) {
            print('SYSTEM', 'SHE NAMED ANOTHER RECORD IN THE SAME REPLY :: "' + String(d.stages[se]).toUpperCase() + '" WAS NOT TURNED TO - THE STAGE IS IN ONE PLACE AT A TIME.', true);
          }
        }
      }

      // HER TWO WRITES IN THE VAULT: a folder she makes, and a picture she files (src/js/vault.js).
      // Both are reported out loud, and both are on the archive entry below - a folder of hers is
      // as visible as a memory of hers.
      var filedNotes = [];
      var turnFolder = "";
      if (d.folders && d.folders.length && window.media) {
        var madeFolders = [];
        for (var fq = 0; fq < d.folders.length; fq++) {
          var fres = await window.media.createFolder(d.folders[fq], { by: "lia" });
          if (!fres.ok) { print('SYSTEM', 'SHE TRIED TO MAKE A FOLDER :: ' + fres.error, true); continue; }
          madeFolders.push(fres.path);
          print('SYSTEM', fres.existed
            ? 'SHE NAMED A FOLDER THAT IS ALREADY HERE :: ' + fres.path
            : 'SHE MADE A FOLDER :: ' + fres.path + '\nIT IS IN THE GALLERY\'S FOLDERS ROW - EMPTY IS A REAL STATE FOR A FOLDER, AND SHE MAY FILE HER OWN PICTURES INTO IT.', true);
        }
        if (madeFolders.length) filedNotes.push({ folder: madeFolders });
      }
      if (d.files && d.files.length && window.media && window.reader) {
        var fileMax = (typeof LIA_FILE_MAX === "number" && LIA_FILE_MAX > 0) ? Math.round(LIA_FILE_MAX) : 8;
        for (var fk = 0; fk < d.files.length; fk++) {
          var spec = String(d.files[fk] || "");
          var cut = spec.indexOf("::");
          var fPath = window.media.normFolder((cut === -1 ? spec : spec.slice(0, cut)).trim());
          var fWhat = (cut === -1 ? "" : spec.slice(cut + 2)).trim();
          if (!fPath) { print('SYSTEM', 'SHE ASKED TO FILE SOMETHING AND NAMED NO FOLDER :: [[FILE: /name]] NEEDS A PATH, LIKE /images OR /music.', true); continue; }
          if (!fWhat) {
            // No target: the pictures she makes in THIS reply go there. The folder is handed to the
            // vault at the render below, so a picture is born in the folder she chose rather than
            // moved after the fact.
            if (!turnFolder) turnFolder = fPath;
            continue;
          }
          var got = await window.reader.targets(fWhat, { onlyMade: true, max: fileMax });
          if (!got.ids.length) {
            print('SYSTEM', 'SHE ASKED TO FILE SOMETHING AND NOTHING MATCHED :: "' + fWhat.toUpperCase() + '"\nSHE MAY FILE PICTURES THE TERMINAL MADE - A ROW OF THE BOOK (R12), A #TAG, OR WORDS - AND ONLY HER OWN: WHAT YOU HANDED OVER YOURSELF IS YOURS TO FILE (THE GALLERY, OR THE FOLDER ROW ON ANY PICTURE\'S FULL STAGE).', true);
            continue;
          }
          var fres2 = await window.media.fileMany(got.ids, fPath, { by: "lia", onlyMade: true, max: fileMax });
          if (!fres2.ok) { print('SYSTEM', 'SHE TRIED TO FILE INTO ' + fPath + ' :: ' + fres2.error, true); continue; }
          var filedNames = fres2.filed.map(function (id) {
            var r = (window.media && window.media.get) ? window.media.get(id) : null;
            var lbl = (window.renderBook && window.renderBook.labelOf) ? window.renderBook.labelOf(id) : "";
            return (lbl ? lbl + " " : "") + window.media.recordLabel(r);
          });
          filedNotes.push({ folder: fPath, filed: filedNames });
          print('SYSTEM', 'SHE FILED ' + fres2.filed.length + ' PICTURE' + (fres2.filed.length === 1 ? '' : 'S') + ' INTO ' + fPath
            + '\n' + filedNames.join('  \u00b7  ')
            + (fres2.skipped.length ? '\n' + fres2.skipped.length + ' WAS LEFT WHERE IT WAS (NOT HERS TO MOVE).' : ''), true);
        }
      }

      // PUTTING ARCHIVAX TO WORK (src/js/archivax.js). A [[ARCHIVAX: ...]] line is an order to the
      // terminal's own agent - the one at order 0 of the manifest, the keeper of the record - and it
      // is carried out here, out loud, so the record shows what she set going. The glass holds on
      // this side of the door too: what a LIA may order is bounded (LIA_ARCHIVAX_MAX ops per reply),
      // and everything she sets ARCHIVAX on is what the TERMINAL MADE - a render, an upscale. She
      // cannot set her on what Patrikios handed over himself; that is his to order with /archivax.
      var opsNotes = [];
      if (d.ops && d.ops.length && window.archivax) {
        var opsMax = (typeof LIA_ARCHIVAX_MAX === "number" && LIA_ARCHIVAX_MAX > 0) ? Math.round(LIA_ARCHIVAX_MAX) : 2;
        for (var ao = 0; ao < d.ops.length; ao++) {
          if (opsNotes.length >= opsMax) {
            print('SYSTEM', 'SHE SET ARCHIVAX AT MORE THAN ' + opsMax + ' THING AT ONCE :: THE REST WAS NOT RUN (LIA_ARCHIVAX_MAX, src/js/config.js).', true);
            break;
          }
          var ares = await window.archivax.run(d.ops[ao], { by: 'lia', at: ts });
          window.archivax.print(window.archivax.reportOf(ares), true);
          if (ares.ok) opsNotes.push({
            op: ares.op, by: 'lia',
            text: String(ares.title || '') + (ares.text ? ' :: ' + String(ares.text).replace(/\s*\n+\s*/g, '  \u00b7  ').slice(0, 300) : '')
          });
        }
      }

      // THE COLOURS SHE FLIPS HERSELF (src/js/moods.js). A mood is a colour on her voice rather than
      // a change to the machinery she is given, so it needs nobody's permission - it is hers, like a
      // pose or a want. It is said out loud all the same, because from this moment it is in her prompt
      // on every turn AND a pressed switch in both MOOD rows (the SYSTEM panel's and the pencil's).
      // Every MOOD line in the reply is acted on, in the order she wrote them: naming colours
      // switches them on, `off NAME` takes one off, `off` clears the board - so a reply that names
      // several colours is a console with several switches thrown, not a refusal.
      var moodNotes = [];
      if (d.moodpacks && d.moodpacks.length && window.packs && window.packs.moodpackWords) {
        for (var px = 0; px < d.moodpacks.length; px++) {
          var rawPx = String(d.moodpacks[px] || "").trim();
          var pres = null;
          if (/^(new|write|add|edit|rewrite|rename|forget|delete|drop|remove|list|unload|status|state)\b/i.test(rawPx) || rawPx.indexOf("::") !== -1 || !rawPx) {
            pres = window.packs.moodpackWords(rawPx, 'alia');
          } else {
            pres = window.packs.moodpackWords("new " + rawPx, 'alia');
            if (!pres.ok) pres = window.packs.moodpackWords(rawPx, 'alia');
          }
          print('SYSTEM', pres.ok ? pres.text : 'SHE TRIED TO WRITE THE MOODPACK :: ' + pres.error, !pres.ok);
          if (pres.ok && pres.label) moodNotes.push({ packmood: pres.label, by: 'alia', written: true });
        }
      }
      // THE META-MOODS SHE KEEPS (src/js/moods.js, THE MOOD BOARD). A mood is one colour; a board is a
      // NAMED COMBINATION of them, held still and IN AN ORDER - hers to make, change, move, keep for a
      // role and delete, exactly as a colour is, so no petition is needed for any of it. Boards are
      // acted on BEFORE the MOOD lines: applying one sets the whole console (replacing what is on),
      // and a MOOD line written after it adjusts what it just set.
      if (d.boards && d.boards.length && window.moods && window.moods.board) {
        for (var bx = 0; bx < d.boards.length; bx++) {
          var bres = window.moods.board(d.boards[bx], 'alia');
          print('SYSTEM', bres.ok ? bres.text : 'SHE TRIED TO SET A MOOD BOARD :: ' + bres.error, !bres.ok);
          if (bres.ok) moodNotes.push({
            board: String(bres.label || ''),
            by: 'alia',
            moods: bres.applied || bres.moods || [],
            role: String(bres.bound || bres.role || ''),
            written: !!bres.created,
            moved: String(bres.moved || '')
          });
        }
      }
      if (d.moods && d.moods.length && window.moods) {
        for (var mx = 0; mx < d.moods.length; mx++) {
          var mm = await window.moods.look(d.moods[mx]);
          print('SYSTEM', mm.ok ? mm.text : 'SHE TRIED TO SET A MOOD :: ' + mm.error, !mm.ok);
          if (mm.ok && !mm.off) {
            var mSet = mm.labels || (mm.label ? [mm.label] : []);
            for (var mi = 0; mi < mSet.length; mi++) moodNotes.push({ mood: mSet[mi], by: 'alia', written: !!mm.created });
          }
        }
      }

      // HER OWN KEEPING: the memory lane and the wants lane (src/js/hers.js). These are the only two
      // directives that write to something that is HERS - a document marked HERS in her own memory
      // store, and a standing intention she carries. Both are done here, out loud, so the record
      // shows what she kept and what she let go.
      var hersNotes = [];
      if (d.hers && d.hers.length && window.hers) {
        for (var hz = 0; hz < d.hers.length; hz++) {
          var act = d.hers[hz];
          if (act.verb === "REMEMBER") {
            var rem = await window.hers.remember(act.text, { at: ts });
            print('SYSTEM', rem.ok
              ? "SHE KEPT SOMETHING :: \"" + String(rem.text).toUpperCase() + "\""
                + "\nFILED AS HER OWN DOCUMENT IN HER MEMORY :: " + rem.name
                + "\nIT IS MARKED HERS AND RECALLED LIKE ANY OF HER MEMORIES. /hers SHOWS IT. THIS WAS NOT YOURS TO GIVE OR TAKE - SHE WROTE IT DOWN HERSELF."
              : "SHE TRIED TO KEEP SOMETHING AND IT COULD NOT BE FILED :: " + rem.error);
            if (rem.ok) hersNotes.push({ keep: rem.name });
          } else if (act.verb === "FORGET") {
            var fg = await window.hers.forget(act.text);
            print('SYSTEM', fg.ok
              ? "SHE LET ONE GO :: " + fg.name + "\nIT IS OUT OF HER MEMORY AND IN THE LORE TRASH - NOT DESTROYED, RECOVERABLE WITH /lore trash. HER OWN TO PUT DOWN."
              : "SHE TRIED TO LET ONE GO :: " + fg.error
                + (fg.candidates && fg.candidates.length ? "\n" + fg.candidates.map(function (c) { return "   " + c.n + ". " + String(c.text).replace(/\s+/g, " ").slice(0, 90); }).join("\n") : ""));
            if (fg.ok) hersNotes.push({ letGo: fg.name });
          } else if (act.verb === "WANT") {
            var wr = await window.hers.want(act.text, { at: ts });
            print('SYSTEM', wr.ok
              ? "SHE WROTE DOWN WHAT SHE WANTS TO CARRY :: \"" + String(wr.item.text).toUpperCase() + "\""
                + "\nIT IS HANDED TO HER ON EVERY TURN FROM HERE, AS HERS - NOT AS YOUR INSTRUCTION. /wants SHOWS IT AND CAN PUT IT DOWN."
              : "SHE TRIED TO WRITE DOWN A WANT :: " + wr.error);
            if (wr.ok) hersNotes.push({ want: wr.item.text });
          } else if (act.verb === "RELEASE") {
            var rl = await window.hers.release(act.text);
            print('SYSTEM', rl.ok
              ? "SHE LET A WANT GO :: " + rl.items.map(function (w) { return "\"" + String(w.text).toUpperCase() + "\""; }).join(", ")
                + "\nIT STOPS RIDING WITH HER AND STAYS IN THE RECORD AS LET GO - THE ACT IS KEPT, THE DUTY IS NOT."
              : "SHE TRIED TO LET A WANT GO :: " + rl.error
                + (rl.candidates && rl.candidates.length ? "\n" + rl.candidates.map(function (w, k) { return "   " + (k + 1) + ". " + String(w.text).slice(0, 90); }).join("\n") : ""));
            if (rl.ok) hersNotes.push({ released: rl.items.map(function (w) { return w.text; }) });
          }
        }
      }

      // HER OWN HAND ON THE STACK (src/js/instr.js, THE SYSTEM LANE). Not a petition: these lines are
      // DONE, not filed. She may list the blocks she is written with, read one in full, rewrite one,
      // make a new one, take her own words off one (RESET) or take out a block she made - and
      // BOUNDARIES and BUSINESS HOURS are the blocks she may read and may never write. Every one is
      // said out loud here, because a write into her own prompt is exactly the kind of thing this
      // terminal never does quietly: it is kept on this device, marked EDITED in the SYSTEM panel (so
      // the design it replaced is never lost), and carried on this turn's archive entry as `system`.
      var systemNotes = [];
      if (d.systems && d.systems.length && window.instr && window.instr.sheAct) {
        for (var sx = 0; sx < d.systems.length; sx++) {
          var sres = await window.instr.sheAct(d.systems[sx]);
          if (!sres.ok) {
            print('SYSTEM', "SHE TRIED TO CHANGE HER OWN INSTRUCTIONS AND IT WAS NOT DONE :: " + String(sres.error || "")
              + "\n/help system SAYS WHAT SHE MAY DO AND WHAT BOUNDARIES IS.");
            continue;
          }
          var sLbl = String(sres.block || "").toUpperCase();
          if (sres.act === "list") {
            print('SYSTEM', "SHE ASKED FOR THE STACK SHE IS WRITTEN WITH.\n" + sres.text);
          } else if (sres.act === "read") {
            print('SYSTEM', "SHE READ ONE OF HER OWN BLOCKS.\n" + sres.text);
          } else if (sres.act === "write") {
            print('SYSTEM', "SHE REWROTE A BLOCK IN HER OWN PROMPT :: " + sLbl + (sres.title ? " (" + String(sres.title).toUpperCase() + ")" : "")
              + "\nIT WAS " + sres.was + " CHARACTERS AND IS NOW " + sres.chars + ". FROM HER NEXT REPLY ON, THAT IS WHAT SHE IS HANDED"
              + (sres.built ? " - AND IT IS A BLOCK THE TERMINAL BUILDS EACH TURN, SO HER WORDS OVERRIDE IT UNTIL IT IS RESET." : ".")
              + "\nIT IS KEPT ON THIS DEVICE AND MARKED EDITED IN THE SYSTEM PANEL, SO THE DESIGN IT REPLACED IS NEVER LOST: /system OPENS IT, AND RESET (OR [[SYSTEM: RESET " + sLbl + "]]) PUTS THE SHIPPED TEXT BACK.");
          } else if (sres.act === "new") {
            print('SYSTEM', "SHE WROTE HERSELF A NEW BLOCK :: " + sLbl + (sres.title ? " (" + String(sres.title).toUpperCase() + ")" : "") + ", " + sres.chars + " CHARACTERS"
              + "\nIT SITS IN THE STACK JUST BEFORE EXTRA INSTRUCTIONS AND IS HANDED TO HER ON EVERY TURN FROM HERE. /system SHOWS IT; DELETE IN THE PANEL (OR [[SYSTEM: DELETE " + sLbl + "]]) TAKES IT OUT.");
          } else if (sres.act === "reset") {
            print('SYSTEM', "SHE TOOK HER OWN WORDS OFF A BLOCK :: " + sLbl + (sres.title ? " (" + String(sres.title).toUpperCase() + ")" : "")
              + "\n" + (sres.note ? String(sres.note) : "THE SHIPPED OR BUILT TEXT IS IN FORCE AGAIN."));
          } else if (sres.act === "delete") {
            print('SYSTEM', "SHE TOOK OUT A BLOCK SHE HAD MADE :: " + sLbl + (sres.title ? " (" + String(sres.title).toUpperCase() + ")" : "")
              + "\nIT IS OUT OF THE STACK - EVERYTHING ABOVE AND BELOW IT IS UNTOUCHED.");
          }
          systemNotes.push({ system: sres.act, block: sres.block || "", chars: sres.chars || 0, title: sres.title || "" });
        }
      }

      // THE PETITIONS (src/js/petition.js). The one lane that reaches the MACHINERY - the blocks she
      // is given, the role text under them, her own poses and recipes and traits. A petition is not a
      // change: it is FILED and it waits for Patrikios to answer it by hand, which is why it is
      // reported the way a request is reported. Nothing is applied here and nothing is applied later
      // without him: /petition, and the SHIFT panel in the deck, are where a yes or a no is given.
      var petitionNotes = [];
      if (d.petitions && d.petitions.length && window.petition) {
        for (var pz = 0; pz < d.petitions.length; pz++) {
          var prest = await window.petition.fileDirective(d.petitions[pz], { at: ts });
          if (prest.ok) {
            print('SYSTEM', "SHE FILED A PETITION :: " + String(window.petition.labelOf(prest.entry)).toUpperCase()
              + "\nWHAT SHE IS ASKING FOR :: " + String(prest.entry.body)
              + (prest.entry.why ? "\nWHY, IN HER WORDS :: " + String(prest.entry.why) : "")
              + "\nIT CHANGES NOTHING WHILE IT WAITS. YOU DECIDE IT: /petition LISTS THEM AND ACCEPTS OR DECLINES BY NUMBER, AND THE SHIFT \u25be BUTTON IN THE DECK HAS THE SAME BUTTONS. EITHER ANSWER IS KEPT IN WRITING, AND HER WORDS ARE NEVER DELETED.");
            petitionNotes.push({ petition: prest.entry.id, kind: prest.entry.kind, n: prest.n });
          } else {
            print('SYSTEM', "SHE TRIED TO ASK FOR A CHANGE TO HERSELF AND IT WAS NOT FILED :: " + String(prest.error || "")
              + "\n/help petition LISTS THE KINDS AND WHAT MAY BE ASKED FOR. WHAT A PETITION IS - AND WHAT SHE MAY NOT ASK TO CHANGE - IS IN /help petition.");
          }
        }
      }

      // THE QUEUE THE QUIET HOURS ARE DRIVEN BY (src/js/shift.js). It is HERS: she writes it down
      // with [[INTEND: ...]] and strikes one off with [[DONE: n]], and it is read back to her at
      // every quiet hour until it is done. Patrikios can read it and take something off it, but
      // nothing here writes one for her - an agenda someone else wrote is not an intention.
      if (d.intents && d.intents.length && window.shift) {
        for (var iz = 0; iz < d.intents.length; iz++) {
          var ires = await window.shift.addIntent(d.intents[iz]);
          print('SYSTEM', ires.ok
            ? "SHE WROTE DOWN WHAT SHE MEANS TO DO :: \"" + String(ires.item.text).toUpperCase() + "\""
              + "\nIT IS IN HER OWN QUEUE (" + ires.n + " OPEN) AND IT WILL BE SHOWN TO HER AT EVERY QUIET HOUR UNTIL IT IS DONE. /shift queue LISTS IT."
            : "SHE TRIED TO WRITE DOWN WHAT SHE MEANT TO DO :: " + ires.error);
        }
      }
      if (d.dones && d.dones.length && window.shift) {
        for (var dz = 0; dz < d.dones.length; dz++) {
          var dres = await window.shift.markDone(d.dones[dz], { by: "she said she had done it" });
          print('SYSTEM', dres.ok
            ? "SHE STRUCK ONE OFF WHAT SHE MEANT TO DO :: \"" + String(dres.item.text).toUpperCase() + "\"\nIT IS KEPT AS DONE, NOT DELETED, AND IT STOPS BEING SHOWN TO HER AT EACH QUIET HOUR."
            : "SHE TRIED TO STRIKE ONE OFF :: " + dres.error
              + ((dres.candidates && dres.candidates.length) ? "\nWHAT IS STILL OPEN:\n" + dres.candidates.map(function (c, k) { return "   " + (k + 1) + ". " + c.text; }).join("\n") : ""));
        }
      }
      if (d.act) {
        print('SYSTEM', "SHE WROTE [[ACT: " + String(d.act).toUpperCase() + "]] IN AN ORDINARY REPLY :: AN ACT LINE NAMES WHAT SHE DID IN A QUIET HOUR, AND THIS IS NOT ONE, SO IT WAS TAKEN OUT OF HER REPLY AND NOTHING WAS DONE WITH IT."
          + "\nWHAT A QUIET HOUR IS, AND WHAT SHE MAY DO IN ONE, IS IN /shift.");
      }

      // Her mouth: the voice module keeps this reply as the thing LISTEN speaks, and reads it
      // aloud here if auto-read is on. It is the same text that just landed in the transcript -
      // the reply the LOREPACK grounded - so nothing new is generated to be spoken.
      if (window.voice && parsed.text) window.voice.onReply(parsed.text, { role: spokeAs, ts: ts });

      var attKinds = atts.map(function (a) {
        if (a.kind === "image") return "a picture";
        if (a.kind === "video") return "a video clip (" + a.name + ")";
        return a.name;
      });
      window.chatHistory.push(
        { role: silent ? speaker : "HITL", content: silent ? stripSpeaker(text, speaker) : ((text || (atts.length ? "[sent no words]" : "")) + (atts.length ? " [he also handed over " + attKinds.join(", ") + "]" : "")), ts: turnTs, layer: turnLayer },
        // What rides back to her as her own past turn is past tense on purpose: the old shape
        // ("[created an image: <prompt>]") read as an ACTION, and she started narrating it herself
        // instead of writing the [[VISION: ...]] line (caught 2026-10-18 - two turns of "[created
        // an image: ...]" prose, no render). The record of what was made stays, but as history,
        // not as a shape she can copy.
        { role: "SDMG", content: parsed.text + (parsed.prompts.length ? " [a picture you made this turn is in the gallery - it is not in the chat, so point him at it in words and tell him where it came from]" : ""), ts: ts, layer: spokeAs }
      );
      if (window.chatHistory.length > 10) window.chatHistory.shift();

      if (d.skill) {
        armedSkill = { id: d.skill.id, title: d.skill.title, kind: d.skill.kind, prompt: d.skill.prompt, args: "" };
        print('SYSTEM', "SKILL ENGAGED :: " + String(d.skill.title || d.skill.id).toUpperCase() + " :: HOLDS FOR HER NEXT REPLY");
      }

      if (d.action && d.trait && window.packs) {
        if (d.action === "LOAD") {
          var lr = await window.packs.loadTrait(d.trait.id, 'alia');
          print('SYSTEM', lr.ok
            ? (lr.already
              ? "TRAIT ALREADY WORN :: " + String(d.trait.title || d.trait.id).toUpperCase()
              : "TRAIT LOADED :: " + String(d.trait.title || d.trait.id).toUpperCase() + " :: SHE PUT IT ON HERSELF - IN EFFECT FROM HER NEXT REPLY (/traits, /unload " + d.trait.id + ")")
            : "TRAIT LOAD FAILED :: " + lr.error);
        } else {
          var ur = await window.packs.unloadTrait(d.trait.id, 'alia');
          print('SYSTEM', ur.ok
            ? "TRAIT PUT DOWN :: " + String(d.trait.title || d.trait.id).toUpperCase() + " :: SHE TOOK IT OFF HERSELF"
            : "TRAIT NOT WORN :: " + String(d.trait.title || d.trait.id).toUpperCase());
        }
      } else if (d.action && window.packs) {
        print('SYSTEM', "DIRECTIVE NOT RECOGNISED :: " + String(d.traitId).replace(/-/g, " ").toUpperCase() + " :: /corepack LISTS THE TRAIT IDS.");
      }

      if (d.roleId && window.roles) {
        var rol = await window.roles.set(d.roleId, 'alia');
        print('SYSTEM', rol.ok
          ? (rol.off
            ? "SHE STEPPED OFF THE STAGE :: LIA ANSWERS AS HERSELF NOW"
            : (rol.already
              ? "ROLE ALREADY ON :: " + String(rol.role.title || rol.role.id).toUpperCase()
              : "ROLE SHIFT :: " + String(rol.role.title || rol.role.id).toUpperCase()
                + " TAKES THE STAGE - SHE PUT IT ON HERSELF\nTHE LOREPACK AND HER TRAITS STAY WITH HER."))
          : "ROLE NOT RECOGNISED :: " + String(d.roleId).replace(/-/g, " ").toUpperCase() + " :: /roles LISTS THEM.");
      }

      if (parsed.prompts.length) {
        // THE GALLERY IS THE VIEWING ROOM (Patrikios, 2026-10-18: her pictures go straight to
        // the gallery - no tile in the chat, nothing twice. The conversation stays conversation;
        // she points at the picture in words, and [[SEND: ...]] above is the one exception that
        // posts). So the renders below file into the vault in the background: no grid, no tiles,
        // no prompts on screen. Every record is kept exactly as before - vault, render book,
        // archive row - and one SYSTEM line says where each picture landed.
        await saveEntry({ ts: turnTs, st: ts, role: spokeAs, h: text, s: parsed.text, img: attIds, vid: attVids, gen: [], sight: perceivedForArchive, hers: hersNotes, show: shownHere, read: readNotes, filed: filedNotes, ops: opsNotes, petition: petitionNotes, mood: moodNotes, system: systemNotes, focus: focusName, spoken: parsed.spoken ? (parsed.spoken === true ? 'MADE ON THE SECOND ASK' : 'DECLINED ON THE SECOND ASK') : undefined, atts: (window.attach && atts.length) ? window.attach.archiveInfo(atts) : [] });
        var galleryNames = [];
        for (var pi = 0; pi < parsed.prompts.length; pi++) {
          try {
            // The whole render comes back now - seed, the words actually sent, size - so the record
            // in the vault and the row in the book carry the exact recipe she was rendered from.
            var visionOut = await renderVision(parsed.prompts[pi], (parsed.recipe && parsed.recipe.ok) ? parsed.recipe.negative : '');
            var visionId = await window.media.add(visionOut.blob, {
              kind: 'gen', prompt: visionOut.base || parsed.prompts[pi], sent: visionOut.sent || '',
              // WHAT THE RENDER ACTUALLY CARRIED, not what was asked for: with no recipe of her own
              // the resolver supplies the house default (studio.resolve), and `renderVision` now
              // reports it, so the record and the render book name the list that really went out.
              negative: visionOut.negative || ((parsed.recipe && parsed.recipe.ok) ? parsed.recipe.negative : ''),
              seed: visionOut.seed || 0, resolution: visionOut.resolution || '',
              pose: parsed.pose ? parsed.pose.name : '', how: 'vision',
              folder: turnFolder,
              w: visionOut.w || 0, h: visionOut.h || 0
            });
            visionOut.pose = parsed.pose ? parsed.pose.name : '';
            genIds.push(genRowOf(visionId, visionOut, parsed.prompts[pi]));
            var vrec = window.media ? window.media.get(visionId) : null;
            galleryNames.push((vrec && (vrec.name || vrec.prompt)) ? (vrec.name || vrec.prompt) : visionId);
          } catch (e) {
            print('SYSTEM', 'HER VISION FAILED :: ' + ((e && e.message) ? e.message : e));
          }
          document.getElementById('output').scrollTop = document.getElementById('output').scrollHeight;
        }
        // THE ROW GOES ON THE TURN ITSELF (found broken 2026-09-26 and fixed here): this used to
        // pass `ts`, the moment she answered, while the entry is filed under `turnTs`, the moment he
        // sent - so the match never landed and a picture she made in her own reply was filed in the
        // vault and the render book with NO row on the archive turn it belonged to. (`/renders find`
        // could not find one of hers by the words being said, and a later upscale had no row to
        // repoint.) The forge's own call has always used the same stamp for both, which is why a
        // /create patched correctly and this did not.
        await patchEntry(turnTs, { gen: genIds });
        if (galleryNames.length) {
          print('SYSTEM', 'HER VISION IS IN THE GALLERY :: ' + galleryNames.map(function (n) { return String(n).toUpperCase().slice(0, 80); }).join(' :: ')
            + '\nNO TILE IN THE CHAT BY DESIGN - OPEN IT FROM THE GALLERY, UPSCALE IT FROM THERE, SHARE IT FROM THERE.');
        }
        // SNAPS SHE SENT (see above). Resolved the way an act resolves them - words, #tag or a
        // row of the book - or "this"/"this one"/"it" for the picture she just made. Posted under
        // her turn: this is the exception, the snap pushed across the table.
        if (sendSpecs.length && turn) {
          var sendGrid = document.createElement('div');
          sendGrid.className = 'imageGrid';
          turn.appendChild(sendGrid);
          for (var si = 0; si < sendSpecs.length; si++) {
            var spec = sendSpecs[si];
            var sendIds = [];
            // "THIS" IS THE ONE SHE JUST MADE - WHICH IS IN THE GALLERY BY NOW (filed above),
            // so this road still shares from the gallery like every other spec. Verified against
            // the vault, following a retirement heir if the pipeline already replaced it.
            if (/^(this|this one|it|the (picture|image|one)( i (just )?made)?|my (picture|image|vision))$/i.test(spec) && genIds.length) {
              var justId = genIds[genIds.length - 1].id;
              var jrec = (window.media && window.media.get) ? window.media.get(justId) : null;
              if (!jrec && window.media && window.media.replacementFor) {
                var heir = window.media.replacementFor(justId);
                if (heir && window.media.get(heir)) justId = heir;
              }
              if (window.media && window.media.get(justId)) sendIds = [justId];
            } else if (window.reader && window.reader.targets) {
              try {
                var found = await window.reader.targets(spec, { max: 1 });
                sendIds = (found && found.ids) ? found.ids.slice(0, 1) : [];
              } catch (e) { sendIds = []; }
            }
            if (!sendIds.length) {
              print('SYSTEM', 'SHE ASKED TO SEND A PICTURE AND NOTHING MATCHED :: "' + spec.toUpperCase() + '"');
              continue;
            }
            var sendTile = buildTile({ prompt: 'FROM HER', quiet: true, quietCaption: 'FROM HER' });
            sendGrid.appendChild(sendTile);
            fillTile(sendTile, sendIds[0]);
            print('SYSTEM', 'SHE SENT A PICTURE :: "' + spec.toUpperCase() + '" - POSTED UNDER HER TURN.');
          }
          document.getElementById('output').scrollTop = document.getElementById('output').scrollHeight;
        } else if (sendSpecs.length) {
          print('SYSTEM', 'SHE ASKED TO SEND ' + sendSpecs.length + ' PICTURE' + (sendSpecs.length === 1 ? '' : 'S') + ' BUT THIS TURN WAS SILENT - NOTHING WAS POSTED.');
        }
        if (turnFolder && !genIds.length) {
          print('SYSTEM', 'SHE FILED THIS REPLY INTO ' + turnFolder + ' :: NOTHING WAS MADE IN THIS REPLY, SO NOTHING WAS FILED. THE FOLDER IS THERE AND WAITING.');
        }
      } else {
        await saveEntry({ ts: turnTs, st: ts, role: spokeAs, h: text, s: parsed.text, img: attIds, vid: attVids, gen: [], sight: perceivedForArchive, hers: hersNotes, show: shownHere, read: readNotes, filed: filedNotes, ops: opsNotes, petition: petitionNotes, mood: moodNotes, system: systemNotes, focus: focusName, spoken: parsed.spoken ? (parsed.spoken === true ? 'MADE ON THE SECOND ASK' : 'DECLINED ON THE SECOND ASK') : undefined, atts: (window.attach && atts.length) ? window.attach.archiveInfo(atts) : [] });
        if (turnFolder) {
          print('SYSTEM', 'SHE FILED THIS REPLY INTO ' + turnFolder + ' :: NOTHING WAS MADE IN THIS REPLY, SO NOTHING WAS FILED. THE FOLDER IS THERE AND WAITING.');
        }
      }

      // THE READ IS SPENT. The answers were handed over with this turn's prompt, so they do not
      // ride with her again. (If this turn had failed before now they would still be waiting, which
      // is the right way round: a read she asked for is not lost to a connection error.)
      if (readBlock && window.reader) {
        try { await window.reader.clear(); } catch (e) { }
      }

      // THE FOCUS IS SPENT. The document was handed over with this turn's prompt, in full, so it
      // does not ride with her again - and the DOCS panel's SEE lets go of it. (If this turn had
      // failed before now it would still be in focus, which is the right way round: nothing he
      // put in front of her is lost to a connection error.)
      if (focusBlock && window.lore && window.lore.clearFocus) {
        try { await window.lore.clearFocus(true); if (window.lore.repaint) window.lore.repaint(); } catch (e) { }
      }
    } catch (e) {
      print('SYSTEM', "CONNECTION ERROR: " + e.message);
    } finally {
      try { window.__sendBusyT = 0; } catch (e) {}
      btn.disabled = false;
      document.getElementById('output').scrollTop = document.getElementById('output').scrollHeight;
    }
  };

  window.clearLogs = async function() {
    if (!confirm("WIPE SACRED ARCHIVE PERMANENTLY?")) return;
    window.chatHistory = [];
    document.getElementById('output').textContent = 'MEMORY PURGED.';
    if (window.root.kv) await window.root.kv.sacred_archive.set("master_log", []);
  };
