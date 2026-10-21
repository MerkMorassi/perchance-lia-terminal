window.aim = (function () {
  "use strict";

  /* ------------------------------------------------------------------------
     THE AIM WIRE - PRESENCE, THE BUDDY LIST AND THE IM LANE.

     Patrikios, 2026-09-30, to CLIO SHANNON: "This is simply AOL Instant
     Messenger. Let's wire up for that."

     The programme is the ALIA LOBBY (src/README.md, THE LOBBY): fifteen ALIAs
     in one room, talking to each other and to him, with this terminal as the
     sibling room and a bridge between them later. What was never decided was
     WHAT THE WIRE IS. He has now decided it, and he is right: it is AIM.

     WHY THAT IS A GOOD ANSWER AND NOT A JOKE. AIM was, in its last twenty
     years of use, the smallest complete PRESENCE + MESSAGING protocol anybody
     ever shipped to millions of people: a session you sign on to, a buddy list
     you WATCH, a presence state the room tells you about, a one-to-one window,
     a group chat room, a profile you can ask for, a text profile YOU publish,
     an away message, an idle clock, and a warning level. That is exactly the
     register of things the lobby needs. Adopting it means the lobby's protocol
     does not have to be INVENTED: it has to be UNDERSTOOD and then obeyed, and
     the parts that were always going to be hard (presence, occupancy, who
     speaks as whom) arrive with the answers already worked out by people whose
     whole job was making a presence server hold up under load.

     TWO LAYERS, AND ONLY ONE OF THEM IS ON THE WIRE TODAY.

     The FLAP layer is the frame: '*' | channel | sequence (2 bytes) | payload
     length (2 bytes, BIG-ENDIAN, in BYTES) | payload. Channels 1..5 are login,
     data, chat, close, keepalive. The length is bytes, not characters, which is
     why `frame`/`deframe` here measure UTF-8 and not string length: a frame
     whose body leaves ASCII still frames correctly. This is the SOCKET form.

     The TOC layer is the line: plaintext verbs - `toc_send_im CLIO hello` one
     way, `IM_IN:CLIO:F:hello` the other - one line per command, text in and
     text out. This is the RELAY form.

     WHY THE RELAY FORM IS THE ONE IN USE. Patrikios carries the two rooms'
     traffic BY HAND, between two browser tabs, by copy and paste. A binary
     frame header is not pasteable and would be corrupted the first time it
     crossed a chat box (and worse, a byte of 0x80..0xFF is not decodable as
     UTF-8 at all). A TOC line is pasteable, diffable, quotable in an order, and
     can be read by a human who is standing in the middle of it. So the ORDER
     puts the lines on the relay NOW and the FLAP framing stays in this file
     next to them, tested, waiting for the day there is a socket - which is the
     day SOMA arrives and `route()` grows a transport instead of a print.

     WHAT IS NOT IN THIS FILE, ON PURPOSE.

       - No socket, no polling, no timeout, no timer of any kind. `route()` is
         the single seam: it records what WOULD have gone out and says so. The
         relay is the human until a transport exists.
       - No model call. Nothing here asks the text engine anything: presence,
         the door, the away message, the idle clock and the chat occupancy are
         all DATA, and all of them are free. A wire that costs a generation
         every time somebody signs on is not a wire, it is a bill.
       - No memory write. A frame is a DOCUMENT. Nothing received here is
         stored as anything but the wire log, which is not her memory and is not
         given to her.
       - No UI panel. The buddy list is a COMMAND (/buddy), like everything else
         in this terminal, and the wire is a COMMAND (/wire). A panel can come
         later; a protocol should not need one to be exercised.

     THE RULES THIS FILE ENFORCES, EACH ONE FOR A REASON.

       1. PRESENCE IS THE ROOM'S, NEVER OURS. There is exactly one place a
          buddy's state changes (the UPDATE_BUDDY branch) and nothing else in
          this file can set `online`. A client that decides a buddy is online
          because it feels like it is a client that lies, and the lie is
          invisible until it matters.
       2. WE NEVER SPEAK AS ANYBODY. Every outbound line is a `toc_*` verb, and
          `send` refuses anything else - a server frame echoed out would be this
          client putting words in the room's mouth. The wire STAMPS the sender;
          the client only ever carries the stamp it was handed. This is also why
          nothing here is asked for a `from` field: there is no slot to fill in.
       3. AN AWAY MESSAGE IS AN ANSWER ONCE. `IM_IN` with the auto flag is her
          away message, not her. It is printed as AUTO and it takes no turn:
          answering one would send a message that answers a machine, and two of
          those find each other and loop forever.
       4. THE DOOR IS COALESCED. Twelve buddies signing on in one second is one
          line ('THE DOOR :: 12 SIGNED ON'), not twelve. A burst is a fact about
          the room's clock, not twelve facts about the cast.
       5. A NAME NOT ON THE LIST IS STILL A NAME. We render a frame from a
          screen name that was never added to the list - marked UNLISTED - and
          we never reject it. The one who holds the stage (OPERATOR, order 15,
          read all / write none) is not on anybody's list as a player, so a
          client that drops strangers drops exactly the one frame it must not.
       6. THE SAME CONFIG FORMAT IS WRITTEN, NOT GUESSED. AIM's own config
          punctuation varied by client and is not reproduced here from memory:
          the payload is stated in `configText` and the room is told what it is.
          A wire whose one uncertain detail is fenced off is a wire two
          implementations can agree on.

     WHO IS ON THE WIRE. `me` is the CLIENT's own screen name and it defaults to
     OPERATOR - order 15, the Theater Operator, read all / write none, the seat
     that holds the stage and never steps onto it. The terminal is operated by
     the human; a client signing on as a cast member would be a machine wearing
     an actor's name, which is rule 2 broken at the top instead of the bottom.
     The cast is the BUDDY LIST: the fifteen seated ALIAs, watched, never
     written - `fill()` reads them from `src/mythos/agents.json` through
     `window.mythos`, which stays the naming authority (README, THE ALIA ROSTER
     LOG v1). Watching is OURS and writable; the roster is not.
     ------------------------------------------------------------------------ */

  var VERSION = "alia-lobby/1";
  var MAX_PAYLOAD = 0xffff;
  var ME_DEFAULT = "OPERATOR";

  // FLAP channels. 1 is login only, 2 is every command, 3 is the chat room,
  // 4 closes the session, 5 is the keepalive nobody needs yet.
  var CH = { LOGIN: 1, DATA: 2, CHAT: 3, CLOSE: 4, PING: 5 };

  // ---- text ---------------------------------------------------------------

  function up(s) { return String(s == null ? "" : s).trim().toUpperCase(); }

  // A TOC line cannot carry a newline or a colon in a body, so a body is
  // escaped on the way out and unescaped on the way in - the same HTML entities
  // AIM's own clients used, with a newline becoming <BR>. `&amp;` is decoded
  // LAST, which is the only order that survives a body that quotes entities.
  function enc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/\r\n|\r|\n/g, "<BR>");
  }

  function dec(s) {
    return String(s == null ? "" : s)
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"")
      .replace(/<BR>/gi, "\n").replace(/&amp;/g, "&");
  }

  // Split on ':' at most n times, so a body that contains colons survives.
  function bite(s, n) {
    var out = [], rest = String(s == null ? "" : s), i, k;
    for (i = 0; i < n; i++) {
      k = rest.indexOf(":");
      if (k === -1) break;
      out.push(rest.slice(0, k));
      rest = rest.slice(k + 1);
    }
    out.push(rest);
    return out;
  }

  // ---- the FLAP frame (the socket form) -----------------------------------

  function u16(n) {
    n = Number(n) || 0;
    return String.fromCharCode((n >> 8) & 0xff, n & 0xff);
  }

  // Bytes, not characters. A body outside ASCII is why this exists.
  function charBytes(c) {
    if (c < 0x80) return 1;
    if (c < 0x800) return 2;
    if (c >= 0xd800 && c <= 0xdbff) return 4;
    return 3;
  }

  function utf8len(s) {
    var t = String(s == null ? "" : s), n = 0, i;
    for (i = 0; i < t.length; i++) n += charBytes(t.charCodeAt(i));
    return n;
  }

  function frame(channel, payload, seq) {
    var body = String(payload == null ? "" : payload);
    var len = utf8len(body);
    if (len > MAX_PAYLOAD) throw new Error("FLAP PAYLOAD " + len + " BYTES EXCEEDS " + MAX_PAYLOAD + " :: SPLIT IT, THE TRANSPORT DOES NOT DO IT FOR YOU");
    return "*" + String.fromCharCode(Number(channel) & 0xff)
      + u16(seq == null ? bump(channel) : seq) + u16(len) + body;
  }

  // A stream in, as many whole frames as it holds, and whatever is left over.
  // A length that runs past the end of the text is NOT an error: it is a frame
  // still arriving, and the leftover is handed back untouched so the caller can
  // append the next paste to it. A truncated multi-byte character at the very
  // end of a frame is accepted and flagged rather than silently repaired.
  function deframe(text) {
    var s = String(text == null ? "" : text), i = 0, out = [], frames = [], broken = 0, j, got, ch, seq, len;
    while (i < s.length) {
      if (s.charAt(i) !== "*") { i++; continue; }
      if (i + 6 > s.length) break;
      ch = s.charCodeAt(i + 1) & 0xff;
      seq = ((s.charCodeAt(i + 2) & 0xff) << 8) | (s.charCodeAt(i + 3) & 0xff);
      len = ((s.charCodeAt(i + 4) & 0xff) << 8) | (s.charCodeAt(i + 5) & 0xff);
      j = i + 6; got = 0;
      while (j < s.length && got < len) { got += charBytes(s.charCodeAt(j)); j++; }
      if (got < len) break;
      if (got > len) broken++;
      out.push({ channel: ch, seq: seq, bytes: len, payload: s.slice(i + 6, j) });
      i = j;
    }
    return { frames: out, rest: s.slice(i), broken: broken };
  }

  // The relay form has no header, so a paste of bare TOC lines is framed onto
  // the data channel with a synthetic sequence. That is a READING, not a claim
  // about a socket: it is what the header would have said.
  function fromLines(text) {
    var rows = String(text == null ? "" : text).split("\n"), out = [], i, l;
    for (i = 0; i < rows.length; i++) {
      l = rows[i].replace(/^\s+|\s+$/g, "");
      if (!l) continue;
      out.push({ channel: CH.DATA, seq: i + 1, bytes: utf8len(l), payload: l });
    }
    return { frames: out, rest: "", broken: 0 };
  }

  // ---- one command --------------------------------------------------------

  function parse(line) {
    var t = String(line == null ? "" : line).replace(/^\s+|\s+$/g, "");
    if (!t) return null;
    var k = t.indexOf(":");
    var head = (k === -1 ? t : t.slice(0, k));
    return { cmd: head.toUpperCase(), raw: (k === -1 ? "" : t.slice(k + 1)) };
  }

  // ---- the session --------------------------------------------------------

  var session = null;

  function fresh(name) {
    return {
      me: up(name || ME_DEFAULT) || ME_DEFAULT,
      signedOn: false, version: "", seq: {},
      buddies: {}, order: [],           // the watch list: MINE, and writable
      seats: [], seatIds: [],           // the roster: read from the manifest, never written
      chat: {}, log: [], doors: [],
      lastInput: 0, idleSec: 0, away: "", info: ""
    };
  }

  function sess() {
    if (!session) session = fresh();
    return session;
  }

  function bump(channel) {
    var s = sess(), c = Number(channel) || CH.DATA;
    s.seq[c] = ((s.seq[c] || 0) + 1) & 0xffff;
    return s.seq[c];
  }

  function rec(n) {
    var s = sess(), k = up(n);
    if (!k) return null;
    if (!s.buddies[k]) {
      s.buddies[k] = {
        name: k, onList: false, seen: 0, online: false, warning: 0,
        signon: 0, idleMin: 0, away: "", awayEpisode: 0, autoSeen: 0, unlisted: false
      };
    }
    return s.buddies[k];
  }

  // ---- the buddy list (MINE) and the roster (NOT MINE) --------------------

  function watch(name) {
    var s = sess(), k = up(name);
    if (!k || k === s.me) return null;
    var r = rec(k);
    var wasNew = !r.onList;
    if (wasNew) { r.onList = true; s.order.push(k); }
    return { rec: r, added: wasNew };
  }

  function drop(name) {
    var s = sess(), k = up(name), i = s.order.indexOf(k);
    if (i === -1) return false;
    s.order.splice(i, 1);
    if (s.buddies[k]) s.buddies[k].onList = false;
    return true;
  }

  async function fill() {
    var s = sess(), added = 0, w;
    if (!window.mythos || typeof window.mythos.canonical !== "function") {
      return { ok: false, seats: 0, listed: s.order.length, added: 0, error: "THE MYTHOS READER IS OFFLINE :: THE ROSTER IS THE BUDDY LIST'S SOURCE." };
    }
    try {
      var man = await window.mythos.canonical();
      var list = (man && man.agents) ? man.agents : [];
      s.seats = list;
      s.seatIds = list.map(function (a) { return up(a.id); });
      for (var i = 0; i < list.length; i++) {
        var k = up(list[i].id);
        if (!k || k === s.me) continue;
        w = watch(k);
        if (w && w.added) added++;
      }
      return { ok: true, seats: list.length, listed: s.order.length, added: added, source: String(man.source || "") };
    } catch (e) {
      return { ok: false, seats: 0, listed: s.order.length, added: 0, error: (e && e.message) ? e.message : String(e) };
    }
  }

  function seatOf(name) {
    var s = sess(), k = up(name), i;
    for (i = 0; i < s.seats.length; i++) if (up(s.seats[i].id) === k) return s.seats[i];
    return null;
  }

  function presence(name) {
    var b = sess().buddies[up(name)];
    if (!b) return "UNKNOWN";
    if (!b.online) return "OFFLINE";
    if (b.away) return "AWAY";
    if (b.idleMin > 0) return "IDLE";
    return "ONLINE";
  }

  // ---- the door (COALESCED) ----------------------------------------------

  function doorLine(b, online) {
    return "THE DOOR :: " + b.name + " " + (online ? "SIGNED ON" : "SIGNED OFF")
      + (b.away ? " (AWAY :: " + b.away + ")" : "");
  }

  function doorBurst(doors) {
    var on = [], off = [], i;
    for (i = 0; i < doors.length; i++) (doors[i].online ? on : off).push(doors[i].name);
    var bits = [];
    if (on.length) bits.push(on.length + " SIGNED ON :: " + on.join(", "));
    if (off.length) bits.push(off.length + " SIGNED OFF :: " + off.join(", "));
    return "THE DOOR :: " + bits.join(" :: ");
  }

  // ---- what comes IN ------------------------------------------------------

  // Returns { lines: [..], auto: bool, turn: bool }. `auto` marks the whole
  // frame as a machine's answer (her away message). `turn` false means this
  // must never become a visible turn in the room.
  function applyIn(f, doors) {
    var s = sess(), o = { lines: [], auto: false, turn: true }, p, b, i;

    switch (f.cmd) {

      case "SIGN_ON":
        s.signedOn = true;
        s.version = String(f.raw || "").trim();
        o.lines.push("SIGNED ON :: " + s.me + " :: " + (s.version || VERSION));
        break;

      case "CONFIG":
        o.lines.push(configRead(f.raw));
        break;

      case "NICK":
        o.lines.push("NICK :: THE ROOM NORMALISED " + up(f.raw) + " :: THE NAME ON THE WIRE IS THE NAME WE PRINT.");
        break;

      case "UPDATE_BUDDY":
        p = String(f.raw).split(":");
        b = rec(p[0]);
        b.seen = nowMs();
        b.online = (up(p[1]) === "T");
        b.warning = Number(p[2]) || 0;
        b.signon = Number(p[3]) || 0;
        b.idleMin = Number(p[4]) || 0;
        if (!b.online) { b.away = ""; b.idleMin = 0; b.autoSeen = 0; }
        noteUnlisted(b, o);
        if (doors) doors.push({ name: b.name, online: b.online }); else o.lines.push(doorLine(b, b.online));
        if (b.warning > 0) o.lines.push("WARNING :: " + b.name + " IS AT " + b.warning + "%.");
        break;

      case "IM_IN":
        p = bite(f.raw, 2);
        b = rec(p[0]);
        b.seen = nowMs();
        noteUnlisted(b, o);
        var isAuto = (up(p[1]) === "T");
        var msg = dec(p[2]);
        if (isAuto) {
          b.away = msg; b.awayEpisode++; b.autoSeen++; b.online = true;
          if (b.autoSeen > 1) { o.lines.push("AWAY (ALREADY SAID) :: " + b.name + " :: SAME AWAY EPISODE, NOT REPRINTED."); }
          else { o.lines.push("AWAY :: " + b.name + " :: " + msg); }
          o.auto = true; o.turn = false;
        } else {
          b.away = ""; b.autoSeen = 0;
          o.lines.push("IM :: " + b.name + " -> " + s.me + " :: " + msg);
        }
        break;

      case "SIGN_OFF":
        b = rec(f.raw);
        b.online = false; b.away = ""; b.idleMin = 0; b.autoSeen = 0; b.seen = nowMs();
        if (doors) doors.push({ name: b.name, online: false }); else o.lines.push(doorLine(b, false));
        break;

      case "ERROR":
        o.lines.push("WIRE REFUSED :: " + String(f.raw || "").trim() + " :: PRINTED, NOT SWALLOWED.");
        o.turn = false;
        break;

      case "EVILED":
        p = bite(f.raw, 2);
        o.lines.push("WARNING MOVED :: " + (Number(p[0]) || 0) + "% :: " + (up(p[1]) || "UNNAMED"));
        o.turn = false;
        break;

      case "CHAT_JOIN":
        p = String(f.raw).split(":");
        s.chat[p[0]] = { id: p[0], name: up(p[1]), occupants: p.slice(3).filter(Boolean) };
        o.lines.push("CHAT :: JOINED " + s.chat[p[0]].name + " :: " + (s.chat[p[0]].occupants.length || Number(p[2]) || 0) + " OCCUPANT(S) :: " + s.chat[p[0]].occupants.join(", "));
        break;

      case "CHAT_IN":
        p = bite(f.raw, 3);
        var inAuto = (up(p[2]) === "T");
        o.lines.push("CHAT [" + p[0] + "] :: " + up(p[1]) + (inAuto ? " (AUTO)" : "") + " :: " + dec(p[3]));
        if (inAuto) { o.auto = true; o.turn = false; }
        break;

      case "CHAT_LEFT":
        p = String(f.raw).split(":");
        if (s.chat[p[0]]) delete s.chat[p[0]];
        o.lines.push("CHAT :: LEFT " + up(p[0]));
        break;

      case "CHAT_UPDATE_BUDDY":
        p = String(f.raw).split(":");
        var room = s.chat[p[0]];
        if (room) {
          var here = up(p[1]) === "T";
          for (i = 2; i < p.length; i++) {
            var nm = up(p[i]);
            if (!nm) continue;
            var at = room.occupants.indexOf(nm);
            if (here && at === -1) room.occupants.push(nm);
            if (!here && at !== -1) room.occupants.splice(at, 1);
          }
          o.lines.push("CHAT [" + p[0] + "] :: " + room.occupants.length + " OCCUPANT(S) :: " + room.occupants.join(", "));
        } else {
          o.lines.push("CHAT UPDATE FOR A ROOM WE ARE NOT IN :: " + p[0]);
        }
        break;

      case "CHAT_INVITE":
        p = String(f.raw).split(":");
        o.lines.push("CHAT INVITE :: " + up(p[0]) + " :: FROM " + up(p[2]) + " :: " + dec(p[3] || "") + " :: /wire feed toc_chat_accept " + up(p[1]));
        break;

      default:
        o.lines.push("UNREAD FRAME :: " + f.cmd + (f.raw ? " :: " + f.raw : ""));
        o.turn = false;
    }
    return o;
  }

  // A NAME NOT ON THE LIST IS STILL A NAME (rule 5). Any lane that carries a
  // voice marks a first hearing from an unwatched screen name - because the one
  // who holds the stage is never on the list, and a client that drops strangers
  // drops exactly the frame it must not.
  function noteUnlisted(b, o) {
    if (!b || b.onList || b.unlisted) return;
    b.unlisted = true;
    o.lines.push("UNLISTED :: " + b.name + " IS SPEAKING AND IS NOT ON YOUR LIST :: PRINTED ANYWAY - A NAME YOU DID NOT ADD IS STILL A NAME (ORDER 15 IS NEVER ON THE LIST).");
  }

  function nowMs() { return (new Date()).getTime(); }

  function recv(text) {
    var s = sess(), raw = String(text == null ? "" : text);
    var isFlap = /^\s*\*/.test(raw);
    var got = isFlap ? deframe(raw) : fromLines(raw);
    var out = [], doors = [], auto = 0, i, r;
    for (i = 0; i < got.frames.length; i++) {
      var f = parse(got.frames[i].payload);
      if (!f) continue;
      s.log.push({ dir: "IN", line: got.frames[i].payload, at: nowMs() });
      r = applyIn(f, doors);
      if (r.auto) auto++;
      for (var j = 0; j < r.lines.length; j++) out.push(r.lines[j]);
    }
    if (doors.length > 1) out.unshift(doorBurst(doors));
    else if (doors.length === 1) out.unshift(doorLine(s.buddies[doors[0].name], doors[0].online));
    if (isFlap && got.rest) out.push("PARTIAL FRAME HELD :: " + got.rest.length + " CHARACTER(S) - APPEND THE NEXT PASTE AND FEED IT AGAIN.");
    if (isFlap && got.broken) out.push("A FRAME'S DECLARED LENGTH CUT A CHARACTER IN HALF :: ACCEPTED AND FLAGGED, NOT REPAIRED SILENTLY.");
    if (!got.frames.length) out.push("NOTHING ON THE WIRE :: " + (isFlap ? "A FLAP STREAM WITH NO COMPLETE FRAME IN IT" : "NO TOC LINE IN THAT"));
    if (auto) out.push("AUTO-REPLY :: " + auto + " FRAME(S). AN AWAY MESSAGE ANSWERS ONCE AND IS NEVER ANSWERED BACK; NONE OF THIS TAKES A TURN.");
    return out.join("\n");
  }

  // ---- what goes OUT ------------------------------------------------------

  // THE SEAM. Everything outbound passes through here, and here is where a
  // socket will one day attach (and where SOMA's kernel will sit behind it).
  // Today it records and admits that the relay is the human.
  function route(line) {
    var s = sess(), l = String(line == null ? "" : line);
    if (!/^toc_/.test(l)) {
      return { ok: false, line: l, carried: false, error: "NOT A CLIENT VERB :: ONLY toc_* MAY LEAVE THIS MACHINE. A SERVER FRAME SENT OUT WOULD BE THIS CLIENT SPEAKING AS THE ROOM." };
    }
    s.log.push({ dir: "OUT", line: l, at: nowMs() });
    return { ok: true, line: l, carried: false, note: "NOT ON THE WIRE YET :: NO TRANSPORT. PATRIKIOS CARRIES IT." };
  }

  function send(cmd, args) {
    var l = String(cmd) + (args ? " " + args : "");
    return route(l);
  }

  function frameOf(cmd, args) {
    return frame(CH.DATA, String(cmd) + (args ? " " + args : ""));
  }

  function configText() {
    // STATED, NOT GUESSED. AIM's own config punctuation varied between clients
    // and this file will not reproduce a spec from memory: the group's name on
    // its own line, then one screen name per line. The room is told this and the
    // two sides agree on it, which is the whole of what a config needs to be.
    var s = sess();
    var watched = [], i;
    for (i = 0; i < s.order.length; i++) if (s.buddies[s.order[i]] && s.buddies[s.order[i]].onList) watched.push(s.order[i]);
    return "ALIA\n" + watched.join("\n");
  }

  function configRead(text) {
    var rows = dec(String(text || "")).split("\n"), group = "", added = 0, i, l;
    for (i = 0; i < rows.length; i++) {
      l = rows[i].replace(/^\s+|\s+$/g, "");
      if (!l) continue;
      if (i === 0 && !/\s/.test(l)) { group = up(l); continue; }
      var cr = watch(l);
      if (cr && cr.added) added++;
    }
    return "CONFIG :: THE ROOM HANDS BACK " + added + " NAME(S)" + (group ? " IN GROUP " + group : "") + " :: THE CONFIG IS A WATCH LIST, NOT THE TRUTH ABOUT WHO EXISTS.";
  }

  async function signOn(name) {
    var s = sess(), lines = [], i;
    if (name) { s.me = up(name) || s.me; }
    if (!s.order.length) await fill();
    drop(s.me);
    s.signedOn = true;
    s.lastInput = nowMs();
    lines.push(send("toc_init_done").line);
    lines.push(send("toc_set_info", enc(transit(s.me))).line);
    lines.push(send("toc_set_config", enc(configText())).line);
    // AIM's own clients watched three names at a time; kept, because a client
    // that speaks in the room's own rhythm is easier to trust than one that
    // shouts its whole list in one breath (a remembered detail, no citation).
    for (i = 0; i < s.order.length; i += 3) {
      lines.push(send("toc_add_buddy", s.order.slice(i, i + 3).join(" ")).line);
    }
    lines.push(send("toc_set_idle", "0").line);
    s.log.push({ dir: "SYSTEM", line: "SIGNED ON AS " + s.me + " :: " + lines.length + " FRAME(S) HANDED TO THE RELAY", at: nowMs() });
    return lines.join("\n");
  }

  function signOff() {
    var s = sess(), r = send("toc_signoff");
    s.signedOn = false;
    s.log.push({ dir: "SYSTEM", line: "SIGNED OFF :: THE SESSION IS CLOSED EXPLICITLY. A CLIENT THAT VANISHES IS IDLE -> OFFLINE BY TIMEOUT, NEVER BY GUESS.", at: nowMs() });
    return r.line + "\nSIGNED OFF :: " + s.me;
  }

  function setAway(text) {
    var s = sess(), msg = String(text == null ? "" : text).replace(/^\s+|\s+$/g, "");
    s.away = msg;
    var r = send("toc_set_away", msg ? enc(msg) : "");
    return (msg ? "AWAY :: DECLARED :: " + msg : "AWAY :: CLEARED - THE MESSAGE IS GONE, THE STATE IS BACK TO ONLINE") + "\n" + r.line;
  }

  // IDLE IS DERIVED, NEVER DECLARED: it is a function of the last thing the
  // human did, so it costs nothing and cannot be lied about. One timer, and the
  // timer is not in this file - the ambient tick (TODO §3 item 15) calls this.
  function tick(at) {
    var s = sess(), t = (typeof at === "number") ? at : nowMs();
    var mins = s.lastInput ? Math.floor((t - s.lastInput) / 60000) : 0;
    var moved = false, lines = [], i;
    if (mins !== s.idleSec) {
      moved = true;
      s.idleSec = mins;
      lines.push("IDLE :: MOVED TO " + mins + " MINUTE(S) :: DERIVED FROM THE LAST THING THE HAND DID, NOT DECLARED.");
    }
    for (i = 0; i < s.order.length; i++) {
      var b = s.buddies[s.order[i]];
      if (b && b.online && !b.away && b.idleMin > 0) lines.push("IDLE :: " + b.name + " :: " + b.idleMin + " MINUTE(S)");
    }
    return lines.join("\n") || "IDLE :: NO CHANGE (" + mins + " MINUTE(S))";
  }

  function touch() {
    var s = sess();
    s.lastInput = nowMs();
    return s.lastInput;
  }

  function setInfo(text) {
    var s = sess();
    s.info = String(text == null ? "" : text);
    return "INFO :: " + (s.info ? "PUBLISHED :: " + s.info : "CLEARED");
  }

  // The six-field transit envelope of a screen name, straight out of the ALIA
  // ROSTER LOG - the same record the bridge is defined to carry, which is what
  // makes a profile here a real payload and not a decoration.
  function transit(name) {
    var k = up(name), s = sess(), i, line = "";
    if (!window.mythos || typeof window.mythos.rosterLines !== "function") return "{}";
    try {
      var rows = window.mythos.rosterLines("bridge");
      for (i = 0; i < rows.length; i++) if (up(rows[i].id) === k) { line = JSON.stringify(rows[i]); break; }
    } catch (e) { line = ""; }
    if (line) return line;
    return JSON.stringify({ schema: "alia-roster/1", id: k, handle: k, order: null, role: "", source: "NOT ON THE CANONICAL ROSTER :: " + (s.me || "") });
  }

  function chatJoin(room) {
    return send("toc_chat_join", "4 " + enc(up(room))).line;
  }

  function chatSend(id, text) {
    return send("toc_chat_send", id + " " + enc(text)).line;
  }

  function warn(name, anon) {
    return send("toc_evil", up(name) + " " + (anon === false ? "norm" : "anon")).line;
  }

  // ---- what the terminal prints ------------------------------------------

  function stateLine() {
    var s = sess(), counts = { ONLINE: 0, IDLE: 0, AWAY: 0, OFFLINE: 0 }, i, p, inCount = 0, outCount = 0;
    for (i = 0; i < s.order.length; i++) {
      p = presence(s.order[i]);
      if (counts[p] === undefined) counts[p] = 0;
      counts[p]++;
    }
    for (i = 0; i < s.log.length; i++) { if (s.log[i].dir === "IN") inCount++; if (s.log[i].dir === "OUT") outCount++; }
    var rooms = [];
    for (var k in s.chat) if (s.chat.hasOwnProperty(k)) rooms.push(s.chat[k].name + " (" + s.chat[k].occupants.length + ")");
    return [
      "THE WIRE :: AIM :: TOC OVER FLAP :: " + VERSION,
      "ME :: " + s.me + " :: " + (s.signedOn ? "SIGNED ON" : "SIGNED OFF") + (s.away ? " :: AWAY :: " + s.away : ""),
      "BUDDY LIST :: " + s.order.length + " WATCHED OF " + s.seats.length + " SEAT(S) ON THE ROSTER :: " + (s.me === "OPERATOR" ? "OPERATOR IS THE CLIENT AND IS NEVER ON ITS OWN LIST" : "ORDER 15 IS NOT WATCHED"),
      "PRESENCE :: ONLINE " + (counts.ONLINE || 0) + " · IDLE " + (counts.IDLE || 0) + " · AWAY " + (counts.AWAY || 0) + " · OFFLINE " + (counts.OFFLINE || 0),
      "CHAT :: " + (rooms.length ? rooms.join(" · ") : "NONE"),
      "WIRE LOG :: " + inCount + " IN / " + outCount + " OUT"
    ].join("\n");
  }

  function buddyListText() {
    var s = sess(), out = [], i, b, p, listed = 0;
    out.push("BUDDY LIST :: " + s.me + " :: " + s.order.length + " WATCHED");
    out.push("YOU :: " + s.me + (s.me === "OPERATOR" ? " (ORDER 15, READ ALL / WRITE NONE, HOLDS THE STAGE - AND IS NEVER ON ITS OWN LIST)" : ""));
    out.push("");
    out.push("ALIA");
    for (i = 0; i < s.order.length; i++) {
      b = s.buddies[s.order[i]];
      if (!b || !b.onList) continue;
      listed++;
      var seat = seatOf(b.name);
      p = presence(b.name);
      out.push("  " + pad(b.name, 12) + " " + pad(p, 8) + " " + pad(b.warning ? (b.warning + "%") : "", 5)
        + (seat ? ("ORDER " + pad(String(seat.order), 3) + pad(String(seat.port || ""), 6)) : pad("UNSEATED", 9))
        + (seat ? seat.role : "NOT ON THE CANONICAL ROSTER")
        + (b.away ? " :: AWAY :: " + b.away : ""));
    }
    if (!listed) out.push("  (NOTHING WATCHED :: /buddy fill ADDS THE ROSTER)");
    var unlisted = [], unwatched = [];
    for (var k in s.buddies) {
      if (!s.buddies.hasOwnProperty(k)) continue;
      if (!s.buddies[k].onList && s.buddies[k].seen) unlisted.push(k);
    }
    for (i = 0; i < s.seatIds.length; i++) if (s.order.indexOf(s.seatIds[i]) === -1 && s.seatIds[i] !== s.me) unwatched.push(s.seatIds[i]);
    out.push("");
    out.push("UNLISTED (SPOKE, WAS NEVER ADDED)");
    out.push("  " + (unlisted.length ? unlisted.join(", ") : "(NONE)") + " :: A NAME YOU DID NOT ADD IS STILL A NAME. THE ONE WHO HOLDS THE STAGE IS NEVER ON THE LIST.");
    out.push("");
    out.push("ON THE ROSTER, NOT WATCHED");
    out.push("  " + (unwatched.length ? unwatched.join(", ") + " :: THE ROSTER IS BIGGER THAN YOUR LIST. SILENCE IS NOT ABSENCE." : "(NONE - THE WHOLE ROSTER IS WATCHED)"));
    out.push("");
    out.push("/buddy <NAME> FOR ONE BUDDY'S INFO CARD. /buddy away <TEXT> · /buddy back · /buddy add <NAME> · /buddy drop <NAME> · /buddy fill · /wire FOR THE WIRE ITSELF.");
    return out.join("\n");
  }

  function buddyInfoText(name) {
    var s = sess(), k = up(name), b = s.buddies[k], seat = seatOf(k), out = [];
    if (!b && !seat) {
      return "NO SUCH SCREEN NAME :: " + k + "\nTHE ROSTER IS THE NAMING AUTHORITY (/agents). /buddy add " + k + " WATCHES A NAME THAT IS NOT ON IT - WATCHING IS MINE, THE ROSTER IS NOT.";
    }
    out.push("BUDDY INFO :: " + k);
    out.push("PRESENCE :: " + presence(k) + (b && b.warning ? " :: WARNING " + b.warning + "%" : "") + (b && b.idleMin ? " :: IDLE " + b.idleMin + " MIN" : "") + (b && b.away ? " :: AWAY :: " + b.away : ""));
    out.push("ON MY LIST :: " + ((b && b.onList) ? "YES" : "NO") + " :: FIRST HEARD FROM :: " + ((b && b.seen) ? new Date(b.seen).toISOString() : "NEVER"));
    if (seat) {
      out.push("ORDER :: " + seat.order + " :: PORT " + seat.port + " :: HANDLE " + seat.handle);
      out.push("ROLE :: " + seat.role);
      if (seat.tone) out.push("TONE :: " + seat.tone);
      if (seat.lore_policy) out.push("LORE POLICY :: READ " + ((seat.read || []).join(", ") || "NONE") + " / WRITE " + ((seat.write || []).join(", ") || "NONE"));
      if (seat.description) out.push("DESCRIPTION :: " + seat.description);
      if (seat.constraints && seat.constraints.length) out.push("CONSTRAINTS :: " + seat.constraints.join(" · "));
      out.push("REVISION :: " + (seat.revision || "(NONE)"));
    } else {
      out.push("THIS NAME IS NOT ON THE CANONICAL ROSTER :: IT IS A WATCHED NAME, AND THAT IS ALL IT IS.");
    }
    out.push("");
    out.push("TRANSIT ENVELOPE (WHAT CROSSES, SIX FIELDS, ONE DIRECTION):");
    out.push(transit(k));
    out.push("");
    out.push("AN INFO CARD IS A DOCUMENT, NOT A MEMORY. NOTHING ON IT IS STORED FOR HER.");
    return out.join("\n");
  }

  async function buddyText(arg) {
    var s = sess(), a = String(arg == null ? "" : arg).trim(), low, parts;
    if (!s.seats.length || !s.seatIds.length) await fill();
    if (!a) { if (!s.order.length) await fill(); return buddyListText(); }

    low = a.toLowerCase();
    if (low === "fill" || low === "roster") {
      var f = await fill();
      if (!f.ok) return "BUDDY LIST :: FILL FAILED :: " + f.error;
      return "BUDDY LIST :: FILLED FROM THE ROSTER :: " + f.seats + " SEAT(S) ON THE MANIFEST :: " + f.listed + " WATCHED :: " + f.added + " ADDED"
        + "\nWATCHING IS MINE AND WRITABLE; THE ROSTER IS NOT. THE MANIFEST IS THE NAMING AUTHORITY: " + (f.source || "src/mythos/agents.json");
    }
    if (low === "reset") {
      session = fresh(s.me);
      await fill();
      return "BUDDY LIST :: SESSION RESET :: PRESENCE BACK TO OFFLINE FOR EVERY SEAT :: THE ROSTER RE-READ, NOT RE-DERIVED.";
    }
    if (low === "away" || low.indexOf("away ") === 0) return setAway(a.slice(4));
    if (low === "back") return setAway("");
    if (low.indexOf("add ") === 0) {
      parts = a.slice(4).trim();
      var rb = watch(parts);
      return rb ? "BUDDY LIST :: WATCHING " + up(parts) + (seatOf(parts) ? " :: ORDER " + seatOf(parts).order : " :: NOT ON THE ROSTER (WATCHED ANYWAY - WATCHING IS MINE)") : "BUDDY LIST :: CANNOT WATCH THAT NAME" + (up(parts) === s.me ? " - IT IS ME" : "");
    }
    if (low.indexOf("drop ") === 0) {
      parts = a.slice(5).trim();
      return drop(parts) ? "BUDDY LIST :: NO LONGER WATCHING " + up(parts) + " :: THE NAME IS NOT DELETED, THE WATCH IS." : "BUDDY LIST :: " + up(parts) + " WAS NOT ON MY LIST";
    }
    if (low === "pick") {
      return "BUDDY LIST :: THE FIRST-SPEAKER IS A ROOM SETTING, NOT A BIRTHRIGHT (CANON 3) :: NOTHING ON THIS SIDE PICKS WHO SPEAKS FIRST.";
    }
    return buddyInfoText(a);
  }

  function framesText() {
    var rows = [
      ["OUT", "toc_add_buddy <NAME> [NAME...]", "watch a screen name (three at a time, as AIM's clients did)"],
      ["OUT", "toc_remove_buddy <NAME>", "stop watching - the watch is mine, the name is not"],
      ["OUT", "toc_set_config <config>", "my whole watch list; the payload is stated in configText()"],
      ["OUT", "toc_set_info <info>", "my profile: the six-field transit envelope"],
      ["OUT", "toc_set_away [<message>]", "DECLARED away; empty = back"],
      ["OUT", "toc_set_idle <seconds>", "DERIVED from the hand, never declared by hand"],
      ["OUT", "toc_send_im <NAME> <message> [auto]", "the IM lane"],
      ["OUT", "toc_get_info <NAME>", "ask for a buddy's card"],
      ["OUT", "toc_chat_join <exchange> <room>", "the council"],
      ["OUT", "toc_chat_send <id> <message>", "one line into the room"],
      ["OUT", "toc_chat_leave <id>", "leave"],
      ["OUT", "toc_evil <NAME> <anon|norm>", "warn - the moderation lever"],
      ["OUT", "toc_signoff", "close the session, explicitly"],
      ["IN", "SIGN_ON:<version>", "the session opened"],
      ["IN", "CONFIG:<config>", "the room hands back the list it holds"],
      ["IN", "UPDATE_BUDDY:<name>:<online>:<warning>:<signon>:<idle>:<uc>", "PRESENCE. THE ONLY SOURCE OF PRESENCE THERE IS."],
      ["IN", "IM_IN:<from>:<auto T/F>:<message>", "the IM lane; auto = her away message, answered never"],
      ["IN", "SIGN_OFF:<name>", "the door closed"],
      ["IN", "ERROR:<code>:<arg>", "the wire refused something - printed, not swallowed"],
      ["IN", "EVILED:<level>:<name>", "the warning count moved"],
      ["IN", "NICK:<name>", "the room normalised a screen name"],
      ["IN", "CHAT_JOIN / CHAT_IN / CHAT_LEFT / CHAT_UPDATE_BUDDY", "the room; occupancy arrives as DELTAS, never as a redraw"],
      ["IN", "CHAT_INVITE:<room>:<id>:<from>:<message>", "an invitation, with the accept line to send back"]
    ], out = [], i;
    out.push("AIM WIRE :: TOC COMMANDS :: " + rows.length + " OF THEM, AND NO OTHERS");
    for (i = 0; i < rows.length; i++) out.push(pad(rows[i][0], 4) + pad(rows[i][1], 44) + rows[i][2]);
    out.push("");
    out.push("THE FRAME UNDER THE LINE :: '*' | channel | sequence (2 bytes) | length (2 bytes, BIG-ENDIAN, BYTES) | payload");
    out.push("CHANNELS :: 1 LOGIN · 2 DATA · 3 CHAT · 4 CLOSE · 5 KEEPALIVE :: MAX PAYLOAD " + MAX_PAYLOAD + " BYTES");
    out.push("");
    out.push("ON THE RELAY THE LINES TRAVEL ALONE (A BINARY HEADER DOES NOT SURVIVE A CHAT BOX). aim.frame(\"toc_send_im CLIO hi\") BUILDS THE FRAMED FORM FOR THE DAY THERE IS A SOCKET.");
    return out.join("\n");
  }

  function logText(n) {
    var s = sess(), lim = Number(n) || 10, from = Math.max(0, s.log.length - lim), out = [], i;
    if (!s.log.length) return "WIRE LOG :: EMPTY. NOTHING HAS CROSSED IN EITHER DIRECTION.";
    out.push("WIRE LOG :: LAST " + Math.min(lim, s.log.length) + " OF " + s.log.length);
    for (i = from; i < s.log.length; i++) out.push(pad(s.log[i].dir, 7) + s.log[i].line);
    return out.join("\n");
  }

  async function wireText(arg) {
    var s = sess(), a = String(arg == null ? "" : arg).trim(), low = a.toLowerCase(), parts;
    if (!a) return stateLine() + "\n\n" + howToText();
    if (low === "frames" || low === "toc") return framesText();
    if (low === "log" || low.indexOf("log ") === 0) return logText(Number(a.slice(3)) || 10);
    if (low === "chat") {
      var rooms = [], k;
      for (k in s.chat) if (s.chat.hasOwnProperty(k)) rooms.push(s.chat[k].id + " :: " + s.chat[k].name + " :: " + s.chat[k].occupants.length + " OCCUPANT(S) :: " + s.chat[k].occupants.join(", "));
      return "CHAT :: " + (rooms.length ? "\n" + rooms.join("\n") : "NOT IN A ROOM. /wire chatjoin <ROOM> EMITS toc_chat_join - THE COUNCIL IS ONE CHANNEL, NOT ONE UI.");
    }
    if (low.indexOf("chatjoin ") === 0) return chatJoin(a.slice(9)) + "\nCHAT :: THE JOIN IS SENT. THE OCCUPANTS ARRIVE IN CHAT_JOIN - WE DO NOT GUESS WHO IS IN THE ROOM.";
    if (low === "signon" || low.indexOf("signon ") === 0) {
      var nm = a.length > 7 ? a.slice(7).trim() : "";
      return await signOn(nm) + "\n" + stateLine();
    }
    if (low === "signoff") return signOff();
    if (low === "tick") return touch() + "\n" + tick();
    if (low.indexOf("feed ") === 0) {
      var r = recv(a.slice(5));
      return r;
    }
    if (low === "touch") return "IDLE CLOCK :: TOUCHED AT " + touch() + " :: THE HAND MOVED, SO THE CLOCK RESTARTS.";
    if (low === "reset") { session = fresh(s.me); await fill(); return "WIRE :: RESET :: SIGNED OFF, EVERY SEAT OFFLINE, THE ROSTER RE-READ."; }
    if (low === "info") return setInfo(a.slice(5).trim()) + "\nMY TRANSIT ENVELOPE :: " + transit(s.me);
    if (low.indexOf("send ") === 0) {
      var line = a.slice(5).trim();
      var res = route(line);
      return res.ok ? res.line + "\n" + res.note : "REFUSED :: " + res.error;
    }
    if (low.indexOf("warn ") === 0) return warn(a.slice(5).trim()) + "\nA WARN IS VISIBLE ON THE BUDDY AND TAKES NOTHING AWAY :: THE MODERATION LEVER IS A COUNT, NOT A DELETION.";
    return stateLine() + "\n\n" + howToText();
  }

  function howToText() {
    return [
      "PUT SOMETHING ON IT",
      "  /wire signon [NAME]      sign on (default " + ME_DEFAULT + " :: order 15, the client itself) and hand the relay the init/config/buddy frames",
      "  /wire signoff            the explicit close (channel 4 in the framed form)",
      "  /wire feed <LINE>        HAND-FEED the wire: one TOC line, or several, or a whole FLAP stream. This is the relay until there is a socket.",
      "  /wire frames             the whole TOC command set, both directions",
      "  /wire log [N]            what has actually crossed",
      "  /wire chat · chatjoin <ROOM> · send <toc_...> · warn <NAME> · tick · touch",
      "",
      "THE RELAY FORM OF A FRAME (paste this to the other room):",
      "  " + framesSample(),
      "",
      "A FRAME IS A DOCUMENT. PRESENCE IS THE ROOM'S. THE RELAY IS PATRIKIOS. NO MODEL CALL AND NO MEMORY WRITE IS ANYWHERE IN THIS LANE."
    ].join("\n");
  }

  function framesSample() {
    return "toc_send_im CLIO " + enc("hello from the LIA TERMINAL") + "   ->   the room answers IM_IN:OPERATOR:F:...";
  }

  // The plain form of an outbound IM: the terminal's own lane into the relay.
  function im(name, text) {
    var s = sess();
    var r = send("toc_send_im", up(name) + " " + enc(text));
    return { ok: r.ok, line: r.line, note: r.note };
  }

  function pad(s, n) {
    var t = String(s == null ? "" : s);
    while (t.length < n) t += " ";
    return t;
  }

  // ---- reading the state (for a harness, not for her) ---------------------

  function snapshot() {
    var s = sess(), out = { me: s.me, signedOn: s.signedOn, away: s.away, order: s.order.slice(), presence: {}, chat: {}, log: s.log.length };
    for (var k in s.buddies) if (s.buddies.hasOwnProperty(k)) out.presence[k] = presence(k);
    for (var c in s.chat) if (s.chat.hasOwnProperty(c)) out.chat[c] = { name: s.chat[c].name, occupants: s.chat[c].occupants.slice() };
    return out;
  }

  function reset(name) {
    session = fresh(name || (session ? session.me : ME_DEFAULT));
    return snapshot();
  }

  return {
    VERSION: VERSION,
    CH: CH,
    MAX_PAYLOAD: MAX_PAYLOAD,
    enc: enc, dec: dec, parse: parse,
    frame: frame, deframe: deframe, fromLines: fromLines, utf8len: utf8len,
    fill: fill, watch: watch, drop: drop,
    recv: recv, route: route, send: send, im: im, frameOf: frameOf,
    signOn: signOn, signOff: signOff, setAway: setAway, setInfo: setInfo,
    away: function (t) { return setAway(t); }, idle: function () { return tick(); },
    tick: tick, touch: touch, warn: warn, chatJoin: chatJoin, chatSend: chatSend,
    configText: configText, transit: transit, presence: presence,
    buddyText: buddyText, buddyList: buddyListText, buddyInfo: buddyInfoText,
    wireText: wireText, state: stateLine, frames: framesText, logText: logText,
    snapshot: snapshot, reset: reset, seats: seatOf
  };
})();
