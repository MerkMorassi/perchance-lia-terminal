(function () {
  "use strict";

  var PREFIX = "LOCAL";
  var DEF_BASE = "http://127.0.0.1:8765";

  function say(msg) { return PREFIX + " :: " + msg; }

  function client(rawOpts) {
    var opts = rawOpts || {};
    var base = String(opts.base || DEF_BASE).replace(/\/+$/, "");
    var token = opts.token || "";

    function fetcher() {
      if (typeof opts.fetch === "function") return opts.fetch;
      try { if (typeof fetch === "function") return fetch.bind(null); } catch (e) {}
      return null;
    }
    function setToken(t) { token = String(t || ""); }
    function calls() { return { base: base, hasToken: !!token }; }

    async function call(path, body) {
      var f = fetcher();
      if (!f) return { ok: false, receipt: say("NO FETCH ON THIS HOST - CANNOT REACH THE DAEMON.") };
      var res = null;
      try {
        res = await f(base + path, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
          body: JSON.stringify(body || {})
        });
      } catch (e) {
        return { ok: false, receipt: say("DAEMON NOT RUNNING AT " + base + " - START mythos_daemon.py ON YOUR MACHINE. NOTHING RAN.") };
      }
      if (!res) return { ok: false, receipt: say("EMPTY ANSWER FROM THE DAEMON.") };
      if (res.status === 401) return { ok: false, receipt: say("TOKEN REFUSED - CHECK THE TOKEN THE DAEMON PRINTED.") };
      var data = null;
      try { data = await res.json(); } catch (e) {
        return { ok: false, receipt: say("THE DAEMON ANSWERED GARBAGE (STATUS " + res.status + ").") };
      }
      if (!data || typeof data !== "object") return { ok: false, receipt: say("THE DAEMON ANSWERED GARBAGE.") };
      if (data.ok === false && data.need === "confirm") {
        return { ok: false, need: "confirm", receipt: say(data.hint || "THE DAEMON WANTS confirm:true BEFORE IT ACTS.") };
      }
      if (data.ok === false) return { ok: false, receipt: say(String(data.error || "THE DAEMON REFUSED.").slice(0, 160).toUpperCase()) };
      data.receipt = say(String(data.receipt || "DONE."));
      return data;
    }

    function needConfirm(o, what) {
      if (o && o.confirm === true) return null;
      return { ok: false, need: "confirm", receipt: say(what + " - CALL AGAIN WITH confirm:true TO DO IT.") };
    }

    async function status() { return call("/api/status", {}); }
    async function ls(p) { return call("/api/fs", { op: "list", path: p || "" }); }
    async function stat(p) { return call("/api/fs", { op: "stat", path: p || "" }); }
    async function readFile(p, o) {
      o = o || {};
      return call("/api/fs", { op: "read", path: p || "", maxBytes: o.maxBytes, as: o.as });
    }
    async function find(o) {
      o = o || {};
      if (!o.root) return { ok: false, receipt: say("NO ROOT GIVEN - NOWHERE TO LOOK.") };
      if (!o.glob && !o.regex && !o.grep) return { ok: false, receipt: say("GIVE glob, regex, OR grep - NOTHING TO MATCH.") };
      return call("/api/find", { root: o.root, glob: o.glob, regex: o.regex, grep: o.grep, max: o.max, depth: o.depth });
    }
    async function writeFile(p, o) {
      o = o || {};
      var gate = needConfirm(o, "WRITING " + String(p || "FILE"));
      if (gate) return gate;
      return call("/api/fs", { op: "write", path: p || "", text: o.text, base64: o.base64, confirm: true });
    }
    async function mkdir(p, o) {
      o = o || {};
      var gate = needConfirm(o, "MAKING FOLDER " + String(p || ""));
      if (gate) return gate;
      return call("/api/fs", { op: "mkdir", path: p || "", confirm: true });
    }
    async function move(from, to, o) {
      o = o || {};
      var gate = needConfirm(o, "MOVING " + String(from) + " -> " + String(to));
      if (gate) return gate;
      return call("/api/fs", { op: "move", path: from, to: to, confirm: true });
    }
    async function copy(from, to, o) {
      o = o || {};
      var gate = needConfirm(o, "COPYING " + String(from) + " -> " + String(to));
      if (gate) return gate;
      return call("/api/fs", { op: "copy", path: from, to: to, confirm: true });
    }
    async function remove(p, o) {
      o = o || {};
      var gate = needConfirm(o, "REMOVING " + String(p || "PATH"));
      if (gate) return gate;
      return call("/api/fs", { op: "remove", path: p || "", recursive: !!(o && o.recursive), confirm: true });
    }
    async function exec(o) {
      o = o || {};
      if (!o.code && !o.cmd) return { ok: false, receipt: say("NOTHING TO RUN - GIVE code OR cmd.") };
      var gate = needConfirm(o, "RUNNING " + String(o.runner || "shell") + " JOB");
      if (gate) return gate;
      return call("/api/exec", { runner: o.runner || "shell", code: o.code, cmd: o.cmd, cwd: o.cwd, timeout: o.timeout, confirm: true });
    }
    async function sql(o) {
      o = o || {};
      if (!o.db) return { ok: false, receipt: say("NO DATABASE GIVEN - NOWHERE TO ASK.") };
      if (!o.sql) return { ok: false, receipt: say("NO SQL GIVEN - NOTHING ASKED.") };
      if (o.write) {
        var gate = needConfirm(o, "WRITING TO " + String(o.db));
        if (gate) return gate;
      }
      return call("/api/sql", { db: o.db, sql: o.sql, params: o.params, write: !!o.write, confirm: o.write ? true : undefined });
    }

    return {
      status: status, ls: ls, stat: stat, readFile: readFile, find: find,
      writeFile: writeFile, mkdir: mkdir, move: move, copy: copy, remove: remove,
      exec: exec, sql: sql, setToken: setToken, calls: calls
    };
  }

  var api = { client: client, DEF_BASE: DEF_BASE };
  if (typeof window !== "undefined") window.MythosLocal = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
