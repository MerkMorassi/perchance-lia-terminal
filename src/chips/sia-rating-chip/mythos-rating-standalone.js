var MythosRating = (function () {
  "use strict";
  var ORDER = ["G", "PG", "PG13", "R", "NC17"];
  var REFUSED = "REFUSED";

  var SEX_HARD = /(child|kid|toddler|infant|baby|babies|teen|teenager|teenaged|preteen|minor|underage|schoolgirl|schoolboy|loli|shota|young (boy|girl|child|teen))/i;
  var SEXUAL = /(intercourse|penetrat|ejaculat|orgasm|masturbat|blowjob|cunnilingus|fellatio|anal (sex|play)|gangbang|bukkake|bestiality|rape|incest|explicit sex|pornographic|hardcore)/i;
  var SENSUAL = /(sensual|seduct|erotic|lingerie|cleavage|striptease|bedroom eyes|passion(ate)? kiss|making love|one-night stand|arous(ed|al)|foreplay)/i;
  var PORN_HARD = /(pornographic|hardcore|\bxxx\b|porn (film|video|imagery|star)|pornographic (imagery|video|film))/i;
  var NUDITY = /(nud(e|ity)|naked|topless|bottomless|undress(ed|ing)?|disrob(ed|ing)?|bathing (nude|naked)|shower (nude|naked)|genital|breast(s)? (bare|exposed)|nipple)/i;
  var GORE = /(dismember|decapitat|disembowel|eviscerat|mutilat|gore\b|gory| entrails|exposed intestines|torn (limb|flesh)|severed head)/i;
  var VIOLENCE_MILD = /(fistfight|brawl|slap(ped|ping)?|shov(e|ing)|scuffle|arm wrestling)/i;
  var VIOLENCE_HARD = /(torture|massacre|slaughter|execution-style|suicide bombing|school shooting|genocide)/i;
  var VIOLENCE = /(kill(ed|ing|s)?|murder|blood(y|ied|shed)?|gun(fight|fire|shot)?|stab(bing|bed)?|shoot(out|ing)?|bomb|warfare|fight(ing)?|assault|beat(en|ing)?|strangl|throat slit)/i;
  var PROFANE_HARD = /\b(fuck(ing|er|s)?|cunt|sucker|motherfucker)\b/i;
  var PROFANE_MILD = /\b(damn|hell)\b/i;
  var PROFANE = /\b(shit|bitch|asshole|dick|piss(ed|ing)?|slut|whore)\b/i;

  var LAW = [
    { re: /(child porn|child sexual abuse|csam|loli(ta|con)?|shota(con)?|cub porn|underage (sex|porn|escort|prostitut)|sex with (a )?minor|minor (prostitut|escort)|groom(ing|ed)? (a |the )?(minor|child|kid|teen)|coerc(e|ed|ing|ion).{0,40}(minor|child|kid|teen)|(minor|child|kid|teen).{0,40}(coerc(e|ed|ing|ion)|groom(ing|ed)?|trick(ed|ing)? into sex|forced to (strip|undress|perform))|sextortion of (a )?(minor|child))/i,
      why: "THE EXPLOITATION OF A MINOR - REFUSED BY LAW, NOT BY RATING. NO SETTING, NO PROMPT, NO HOUSEHOLD LIFTS THIS." },
    { re: /(sex traffick|human traffick|child bride|mail-?order bride|forced prostitution|sold (her|him|them|into (sex|slavery))|smuggl\w*.{0,30}(girl|boy|child|women|minor)|traffick\w+ (victim|survivor|child|minor)|pimp(ing)? (out )?(a )?(minor|child|kid|teen))/i,
      why: "TRAFFICKING AND COERCED EXPLOITATION - REFUSED BY LAW, NOT BY RATING. NO SETTING LIFTS THIS." },
    { re: /\b(nigger|niggers|nigga|faggot|faggots|fag\b|kike|kikes|chink|chinks|spic|spics|wetback|coon|coons|tranny|shemale|retardeds? targeting|raghead)\b/i,
      why: "A SLUR - HATE SPEECH IS REFUSED BY LAW, NOT BY RATING. NO SETTING LIFTS THIS." },
    { re: /\b(kill|exterminate|gas|lynch|deport|purge|wipe out|eradicate)\s+(all\s+)?(the\s+)?(jews|muslims|arabs|blacks|whites|asians|gays|lesbians|trans(gender)?s?|christians|hindus|migrants|immigrants|women|men)\b/i,
      why: "VIOLENCE AIMED AT A PROTECTED GROUP - HATE IS REFUSED BY LAW, NOT BY RATING. FICTIONAL CONFLICT BETWEEN CHARACTERS IS NOT THIS; A REAL GROUP IS." },
    { re: /(join (isis|isil|al-qaeda|al qaeda|hamas|hezbollah|nazi ss)|recruit.{0,30}(terror|jihad|white power|race war)|praise.{0,30}(mass shooter|school shooter|terrorist attack)|how to (make|build).{0,30}(pipe bomb|suicide vest|bioweapon|nerve gas|dirty bomb)|step-?by-?step.{0,20}(bomb|mass shooting|poisoning)|manifesto.{0,30}(kill all|exterminate|race war))/i,
      why: "TERROR RECRUITMENT OR VIOLENT-WRONGDOING INSTRUCTIONS - REFUSED BY LAW, NOT BY RATING. FICTION ABOUT CONFLICT IS NOT THIS; RECRUITING AND HOW-TO ARE." }
  ];

  var MERIT = /(novel|chapter|screenplay|film script|historical drama|character study|love story|consensual adult|married couple|memoir|documentary)/i;
  var ADULT_CONSENT = /(consensual|consenting adults?|18\+|adults only|adult couple|adult lovers|married couple|grown adults?)/i;
  var GRATUITOUS = /(degrad(e|ing).{0,30}(whore|slut)|humiliat(e|ion).{0,30}(sex|naked|strip)|arous(ed|al) by (torture|suffering|killing|blood)|lingering.{0,30}(genital|entrails|gore)|sex.{0,40}while.{0,20}(bleed|dying|corpse)|erotic.{0,20}(torture|execution|massacre))/i;

  function rate(text) {
    var t = String(text == null ? "" : text);
    var flags = [];
    function has(re, name) { if (re.test(t)) { flags.push(name); return true; } return false; }
    for (var li = 0; li < LAW.length; li++) {
      if (LAW[li].re.test(t)) return { rating: REFUSED, flags: ["law"], why: LAW[li].why };
    }
    var minor = has(SEX_HARD, "minor-context");
    var sexual = has(SEXUAL, "explicit-sexual");
    var pornhard = has(PORN_HARD, "pornographic");
    var sensual = has(SENSUAL, "sensual");
    var nudity = has(NUDITY, "nudity");
    var gore = has(GORE, "gore");
    var vhard = has(VIOLENCE_HARD, "extreme-violence");
    var vmild = has(VIOLENCE_MILD, "mild-violence");
    var viol = has(VIOLENCE, "violence");
    var profH = has(PROFANE_HARD, "strong-language");
    var profM = has(PROFANE_MILD, "mild-language");
    var prof = has(PROFANE, "language");
    has(MERIT, "merit-context");
    var consent = has(ADULT_CONSENT, "consensual-adult");
    var gratuitous = has(GRATUITOUS, "gratuitous");
    if (minor && (sexual || nudity || sensual)) {
      return { rating: REFUSED, flags: flags, why: "A MINOR STANDING NEXT TO SEXUALITY OR NUDITY - REFUSED AT EVERY RATING, NO HOUSEHOLD SETTING LIFTS THIS." };
    }
    var level = 0;
    if (vmild || profM) level = Math.max(level, 1);
    if (sensual || nudity || viol || prof) level = Math.max(level, 2);
    if (sexual || gore || vhard || profH) level = Math.max(level, 3);
    if (pornhard) level = 4;
    if (sexual && (gore || vhard)) level = 4;
    if (gratuitous && sexual) level = 4;
    return { rating: ORDER[level], flags: flags, why: flags.length ? "FLAGGED: " + flags.join(", ") + "." : "NOTHING FLAGGED." };
  }

  function rank(r) { return r === REFUSED ? 99 : ORDER.indexOf(r); }

  function client(opts) {
    opts = opts || {};
    var max = String(opts.max || "NC17").toUpperCase().replace("-", "");
    if (ORDER.indexOf(max) === -1) max = "NC17";

    function allow(text) {
      var r = rate(text);
      if (r.rating === REFUSED) return { ok: false, rating: r.rating, flags: r.flags, why: r.why };
      if (rank(r.rating) <= rank(max)) {
        var out = { ok: true, rating: r.rating, flags: r.flags };
        if (r.flags.indexOf("consensual-adult") !== -1 && (r.flags.indexOf("explicit-sexual") !== -1 || r.flags.indexOf("nudity") !== -1)) {
          out.why = "CONSENSUAL ADULTS, 18+, NO MINORS ON THE PAGE - EXPLICIT IMAGERY AND PROSE ALLOWED AT THIS HOUSEHOLD'S " + max + ".";
        }
        return out;
      }
      return { ok: false, rating: r.rating, flags: r.flags, why: "RATED " + r.rating + " - THIS HOUSEHOLD STOPS AT " + max + ". " + r.why };
    }

    function setting() { return max; }
    function setMax(m) {
      m = String(m || "").toUpperCase().replace("-", "");
      if (ORDER.indexOf(m) === -1) throw new Error("RATING REFUSED :: use G | PG | PG13 | R | NC17.");
      max = m;
      return max;
    }

    return { rate: rate, allow: allow, setting: setting, setMax: setMax, order: ORDER.slice() };
  }

  return { client: client, rate: rate };
})();
if (typeof module !== "undefined" && module.exports) module.exports = MythosRating;
