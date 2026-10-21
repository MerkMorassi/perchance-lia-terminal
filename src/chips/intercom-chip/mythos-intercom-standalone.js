(function () {
  "use strict";

  var HOSTS = { BARBELO: true, MAYA: true };

  var realClock = {
    now: function () { return Date.now(); },
    setTimeout: function (fn, ms) { return setTimeout(fn, ms); },
    clearTimeout: function (h) { return clearTimeout(h); }
  };

  function IntercomChip(opts) {
    opts = opts || {};
    this._floor = null;
    this._ticket = 0;
    this._currentTicket = 0;
    this._tailOwner = null;
    this._tailUntil = 0;
    this._watchdog = null;
    this._issued = {};
    this._listeners = [];
    this._tailMs = (opts.tailMs != null) ? opts.tailMs : 350;
    this._maxHoldMs = (opts.maxHoldMs != null) ? opts.maxHoldMs : 60000;
    this._clock = opts.clock || realClock;
  }

  IntercomChip.prototype.holder = function () {
    return this._floor;
  };

  IntercomChip.prototype.requestFloor = function (host) {
    this._assertHost(host);
    var now = this._clock.now();
    if (this._floor === host) return this._currentTicket;
    if (this._floor !== null) {
      this._emit({ type: "DENY", host: host, reason: "HELD", holder: this._floor, at: now });
      return null;
    }
    if (this._tailOwner !== null && this._tailOwner !== host && now < this._tailUntil) {
      this._emit({ type: "DENY", host: host, reason: "TAIL", holder: this._tailOwner, at: now });
      return null;
    }
    this._floor = host;
    this._tailOwner = null;
    this._currentTicket = ++this._ticket;
    this._issued[this._currentTicket] = host;
    var self = this;
    this._watchdog = this._clock.setTimeout(function () { self._release(host, "WATCHDOG"); }, this._maxHoldMs);
    this._emit({ type: "GRANT", host: host, ticket: this._currentTicket, at: now });
    return this._currentTicket;
  };

  IntercomChip.prototype.releaseFloor = function (host) {
    this._assertHost(host);
    if (this._floor === host) this._release(host, "DONE");
  };

  IntercomChip.prototype.isMicOpen = function (station) {
    return station !== "PATRIKIOS" && this._floor === station;
  };

  IntercomChip.prototype.hearsBus = function (_station) {
    return true;
  };

  IntercomChip.prototype.routeFinal = function (station, text, ticket) {
    var at = this._clock.now();
    var clean = String(text == null ? "" : text).trim();
    var self = this;
    var drop = function (reason) {
      self._emit({ type: "DROP", station: station, text: clean, reason: reason, at: at });
      return null;
    };
    if (!HOSTS[station]) return drop("MONITOR_NO_TRANSMIT");
    if (!clean) return drop("EMPTY");
    if (ticket === null || ticket === undefined || this._issued[ticket] !== station) return drop("NO_VALID_TICKET");
    return { label: station, text: clean, ticket: ticket, at: at };
  };

  IntercomChip.prototype.reset = function () {
    if (this._floor) this._release(this._floor, "RESET");
    this._tailOwner = null;
    this._tailUntil = 0;
  };

  IntercomChip.prototype.on = function (fn) {
    this._listeners.push(fn);
    var self = this;
    return function () {
      self._listeners = self._listeners.filter(function (l) { return l !== fn; });
    };
  };

  IntercomChip.prototype._release = function (host, reason) {
    if (this._floor !== host) return;
    if (this._watchdog !== null) this._clock.clearTimeout(this._watchdog);
    this._watchdog = null;
    this._floor = null;
    this._tailOwner = host;
    this._tailUntil = this._clock.now() + this._tailMs;
    this._emit({ type: "RELEASE", host: host, reason: reason, at: this._clock.now() });
  };

  IntercomChip.prototype._assertHost = function (host) {
    if (!HOSTS[host]) throw new Error("IntercomChip: " + host + " is not a host (monitor stations never transmit)");
  };

  IntercomChip.prototype._emit = function (e) {
    for (var i = 0; i < this._listeners.length; i++) {
      try { this._listeners[i](e); } catch (x) {}
    }
  };

  var api = { IntercomChip: IntercomChip, HOSTS: ["BARBELO", "MAYA"], MONITOR: "PATRIKIOS" };
  if (typeof window !== "undefined") window.MythosIntercom = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
