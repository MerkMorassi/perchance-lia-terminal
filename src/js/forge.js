  /* ---- IMAGE FORGE: your own prompt, negative prompt, size and batch count ---- */

  var IMAGE_SIZES = [
    { res: "768x512", label: "Landscape (768x512)", hint: "16:9 - matches the display stage" },
    { res: "512x768", label: "Portrait (512x768)", hint: "9:16 - tall" },
    { res: "512x512", label: "Square (512x512)", hint: "fastest" },
    { res: "768x768", label: "Large Square (768x768)", hint: "biggest, most detail" },
  ];
  function isImageSize(res) {
    for (var i = 0; i < IMAGE_SIZES.length; i++) if (IMAGE_SIZES[i].res === res) return true;
    return false;
  }
  var IMAGE_COUNTS = [1, 2, 3, 6, 9, 12, 15, 18, 21, 24];
  var IMAGE_GUIDANCE = [];
  for (var gstep = 1; gstep <= 30; gstep++) IMAGE_GUIDANCE.push(gstep);
  var DEFAULT_COUNT = 6;
  var DEFAULT_GUIDANCE = 7;
  var forge = {
    prompt: "", negative: "", count: DEFAULT_COUNT,
    resolution: isImageSize(LIA_IMAGE_RESOLUTION) ? LIA_IMAGE_RESOLUTION : "768x512",
    guidance: DEFAULT_GUIDANCE, seed: "", pose: "", recipe: "",
    // 4X WINDOW (the bigger.pics road) is OPT-IN per press row, and OFF is the shipped shape:
    // unticked, CREATE only renders - no window, no site, nothing uploaded - and the pipeline
    // still enlarges every picture on this machine (2x) before it counts. Ticked, the press opens
    // the bigger.pics window for the run's first picture at 4x (a real click is the only thing that
    // can open one, which is why the press does it). A choice, not prose, so it comes back by itself.
    bigWindow: false,
  };
  var forgeRunning = false;

  // WHAT THE FORM REMEMBERS, AND WHAT IT DOES NOT. The prompt and the negative list are TEXT HE TYPED,
  // and text he typed is never put back into a box by itself any more: a reload (which is what a SAVE
  // is) used to open the forge with yesterday's prompt already in it. They are kept here instead, and
  // offered - one press on RECALL LAST PROMPT puts them back. THE SETTINGS STILL COME BACK BY
  // THEMSELVES (size, count, guidance, seed and pose are choices, not prose), and the RECIPE BOOK and
  // `/renders redo` still fill the boxes on purpose, which is what they are for.
  var lastForm = { prompt: "", negative: "" };

  function forgeStore() {
    return (window.root && window.root.kv && window.root.kv.lia_settings) || null;
  }

  async function loadForge() {
    var s = forgeStore();
    if (!s) return;
    try {
      var saved = await s.get("image_form");
      if (!saved) return;
      if (typeof saved.prompt === "string") lastForm.prompt = saved.prompt;
      if (typeof saved.negative === "string") lastForm.negative = saved.negative;
      if (isImageSize(saved.resolution)) forge.resolution = saved.resolution;
      if (IMAGE_COUNTS.indexOf(saved.count) !== -1) forge.count = saved.count;
      if (IMAGE_GUIDANCE.indexOf(saved.guidance) !== -1) forge.guidance = saved.guidance;
      if (typeof saved.seed === "string") forge.seed = saved.seed;
      if (typeof saved.pose === "string") forge.pose = saved.pose;
      if (typeof saved.recipe === "string") forge.recipe = saved.recipe;
      if (typeof saved.big === "boolean") forge.bigWindow = saved.big;
    } catch (e) { console.warn("could not restore the image forge form", e); }
  }

  async function saveForge() {
    var s = forgeStore();
    if (!s) return;
    // THE PAIR IS ONLY REPLACED BY ANOTHER PAIR. Opening the forge and closing it again leaves the boxes
    // empty (that is the whole point of the LAST TIME row), and a blank box must not wipe the offer -
    // otherwise a glance at the forge destroys the thing the row exists to hand back.
    if (String(forge.prompt || "").trim() || String(forge.negative || "").trim()) {
      lastForm = { prompt: String(forge.prompt || ""), negative: String(forge.negative || "") };
    }
    try {
      await s.set("image_form", {
        prompt: lastForm.prompt, negative: lastForm.negative,
        resolution: forge.resolution, count: forge.count,
        guidance: forge.guidance, seed: forge.seed, pose: forge.pose, recipe: forge.recipe,
        big: !!forge.bigWindow,
      });
    } catch (e) { console.warn("could not remember the image forge form", e); }
    paintRecall();
  }

  // THE OFFER. The row is only there when there is something to offer, and the note says plainly that
  // the boxes were left alone.
  function paintRecall(filled) {
    var row = document.getElementById('cpRecallRow');
    var note = document.getElementById('cpRecallNote');
    if (!row) return;
    var has = !!(lastForm.prompt || lastForm.negative);
    row.hidden = !has;
    if (note) note.textContent = filled ? 'RECALLED - EDIT IT BEFORE A CREATE' : 'NOT PUT IN THE BOXES FOR YOU';
  }

  function recallLast() {
    var p = document.getElementById('cpPrompt'), n = document.getElementById('cpNegative');
    var put = [];
    if (p && !String(p.value || '').trim() && lastForm.prompt) { p.value = lastForm.prompt; put.push('THE PROMPT'); }
    if (n && !String(n.value || '').trim() && lastForm.negative) { n.value = lastForm.negative; put.push('THE NEGATIVE LIST'); }
    if (p) forge.prompt = p.value;
    if (n) forge.negative = n.value;
    if (typeof print === "function") print('SYSTEM', 'IMAGE FORGE :: ' + (put.length
      ? 'THE LAST PAIR IS BACK IN THE BOXES (' + put.join(' AND ') + '). IT IS YOURS TO EDIT BEFORE A CREATE.'
      : 'THE BOXES ALREADY HOLD WORDS, SO NOTHING WAS OVERWRITTEN - THIS ONLY FILLS AN EMPTY BOX.'));
    paintRecall(put.length > 0);
    if (put.length && p) try { p.focus(); } catch (e) {}
  }

  function buildForgeChips() {
    var sizes = document.getElementById('cpSizes');
    sizes.textContent = '';
    IMAGE_SIZES.forEach(function (size) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = size.label;
      b.title = size.res + ' - ' + size.hint;
      b.dataset.size = size.res;
      b.onclick = function () { forge.resolution = size.res; syncForgeChips(); saveForge(); };
      sizes.appendChild(b);
    });
    var counts = document.getElementById('cpCounts');
    counts.textContent = '';
    IMAGE_COUNTS.forEach(function (n) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = String(n);
      b.title = n + (n === 1 ? ' image' : ' images');
      b.dataset.count = String(n);
      b.onclick = function () { forge.count = n; syncForgeChips(); saveForge(); };
      counts.appendChild(b);
    });
    var gsel = document.getElementById('cpGuidance');
    gsel.textContent = '';
    IMAGE_GUIDANCE.forEach(function (g) {
      var o = document.createElement('option');
      o.value = String(g);
      o.textContent = String(g) + (g === DEFAULT_GUIDANCE ? ' (default)' : '');
      gsel.appendChild(o);
    });
    gsel.value = String(forge.guidance);
    gsel.onchange = function () {
      forge.guidance = Number(gsel.value) || DEFAULT_GUIDANCE;
      saveForge();
    };
  }

  function syncForgeChips() {
    document.querySelectorAll('#cpSizes button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.size === forge.resolution);
    });
    document.querySelectorAll('#cpCounts button').forEach(function (b) {
      b.classList.toggle('on', Number(b.dataset.count) === forge.count);
    });
  }

  /* ---- THE BOOK in the forge: the pose slot, the editor, the lists ---------
     A pose is PROMPT MATERIAL, not a setting: choosing one holds it in the slot and (when he
     asks, or when a render uses it) writes its phrase into the positive prompt like any other
     words. The slot is remembered with the rest of the form, so the pose he last chose is still
     there tomorrow. Everything the book knows lives in studio.js; this is the hands. */
  function poseName() { return forge.pose || ""; }
  function posePhraseOf(name) {
    var st = window.studio;
    if (!st) return "";
    return st.posePhrase(name || forge.pose) || "";
  }

  function buildPoseRows() {
    var sel = document.getElementById('cpPose');
    var famSel = document.getElementById('cpPoseFamily');
    var st = window.studio;
    if (!sel || !famSel) return;
    sel.textContent = '';
    var none = document.createElement('option');
    none.value = '';
    none.textContent = '\u2014 no pose \u2014';
    sel.appendChild(none);
    var fams = st ? st.families() : [];
    fams.forEach(function (family) {
      var group = document.createElement('optgroup');
      group.label = family.toUpperCase();
      var list = st.poses(family);
      if (!list.length) return;
      list.forEach(function (pose) {
        var o = document.createElement('option');
        o.value = pose.name;
        o.textContent = pose.name + (pose.source === 'her' ? ' \u00b7 hers' : (pose.source === 'his' ? ' \u00b7 yours' : ''));
        o.title = pose.name + ' \u2192 ' + (pose.render || pose.name) + (pose.note ? ' :: ' + pose.note : '');
        group.appendChild(o);
      });
      sel.appendChild(group);
    });
    famSel.textContent = '';
    fams.forEach(function (family) {
      var o = document.createElement('option');
      o.value = family;
      o.textContent = family;
      famSel.appendChild(o);
    });
    var hers = document.createElement('option');
    hers.value = (st && st.FAMILY_HERS) ? st.FAMILY_HERS : 'hers';
    hers.textContent = 'a list of her own';
    if (!fams.length) famSel.appendChild(hers);
  }

  function syncPoseRows() {
    var st = window.studio;
    var sel = document.getElementById('cpPose');
    var note = document.getElementById('cpPoseNote');
    var bookNote = document.getElementById('cpBookNote');
    if (!sel) return;
    var book = st ? st.bookData() : null;
    var list = st ? st.poses() : [];
    // A pose that has been renamed or removed since it was chosen must not go stale in the slot.
    if (forge.pose && !(st && st.findPose(forge.pose))) forge.pose = '';
    sel.value = forge.pose || '';
    var cur = (forge.pose && st) ? st.findPose(forge.pose) : null;
    var nameEl = document.getElementById('cpPoseName');
    var famEl = document.getElementById('cpPoseFamily');
    var renderEl = document.getElementById('cpPoseRender');
    var addEl = document.getElementById('cpListKey');
    if (nameEl) nameEl.value = cur ? cur.name : '';
    if (renderEl) renderEl.value = cur ? (cur.render || '') : '';
    if (famEl && cur) famEl.value = cur.family;
    if (addEl && !addEl.dataset.touched) addEl.value = '';
    if (note) {
      note.textContent = forge.pose
        ? ('held for the next render \u00b7 sends: ' + (posePhraseOf() || forge.pose))
        : (list.length + ' in the book');
    }
    if (bookNote && st) {
      var made = (book.poses || []).length;
      var edited = Object.keys(book.edit || {}).length;
      var hidden = (book.hide || []).length;
      bookNote.textContent = list.length + ' poses in ' + st.families().length + ' lists'
        + ((made || edited || hidden) ? (' \u00b7 ' + (made ? made + ' added' : '') + (made && (edited || hidden) ? ', ' : '') + (edited ? edited + ' edited' : '') + (edited && hidden ? ', ' : '') + (hidden ? hidden + ' removed' : '') + ' here') : ' \u00b7 all shipped');
    }
  }

  // What the pose slot contributes to a prompt: the phrase appended once, plus what was actually
  // added (empty when the phrase was already in the text). Pure, so a CREATE and a test agree.
  function poseIntoPrompt(prompt) {
    var held = forge.pose || '';
    var phrase = held ? posePhraseOf() : '';
    if (!phrase) return { prompt: prompt, pose: held, phrase: '' };
    if (String(prompt).toLowerCase().indexOf(String(phrase).toLowerCase()) !== -1) {
      return { prompt: prompt, pose: held, phrase: '' };
    }
    return { prompt: String(prompt).replace(/[\s,]+$/, '') + ', ' + phrase, pose: held, phrase: phrase };
  }

  // Hold a pose in the slot. `write` also puts its phrase into the positive prompt - once: if the
  // phrase is already in the box (or the pose was chosen from her own reply) nothing is added twice.
  function setPose(name, opts) {
    opts = opts || {};
    var st = window.studio;
    forge.pose = String(name || '');
    if (opts.write && forge.pose) {
      var phrase = posePhraseOf();
      var box = document.getElementById('cpPrompt');
      if (phrase && box && String(box.value).toLowerCase().indexOf(String(phrase).toLowerCase()) === -1) {
        var text = box.value.replace(/[\s,]+$/, '');
        box.value = text ? (text + ', ' + phrase) : phrase;
        forge.prompt = box.value;
        print('SYSTEM', 'PROMPT BOOK :: POSE :: ' + forge.pose.toUpperCase() + ' ADDED TO THE PROMPT AS "' + phrase + '"');
      }
      buildPoseRows();
    }
    syncPoseRows();
    saveForge();
    return forge.pose;
  }

  // SAVE edits THE POSE THAT IS SELECTED (rename it, move it to another list, give it a phrase).
  // NEW POSE files what is in the fields as a pose the book did not have. Two buttons instead of
  // one guess: renaming a pose and adding a second one look identical from the fields alone.
  async function savePoseEdit(asNew) {
    var st = window.studio;
    if (!st) { print('SYSTEM', 'THE PROMPT BOOK IS NOT LOADED HERE.'); return; }
    var cur = (forge.pose && st.findPose(forge.pose)) || null;
    var name = document.getElementById('cpPoseName').value.trim();
    var family = document.getElementById('cpPoseFamily').value.trim();
    var render = document.getElementById('cpPoseRender').value.trim();
    if (!name) { print('SYSTEM', 'A POSE NEEDS A NAME.'); return; }
    var out;
    if (!asNew && cur) {
      var twin = st.findPose(name);
      if (twin && twin.key !== cur.key) {
        print('SYSTEM', 'THE BOOK ALREADY HAS A POSE CALLED "' + twin.name.toUpperCase() + '" ('
          + twin.family.toUpperCase() + ') :: PICK IT ABOVE TO EDIT IT, OR PRESS + NEW POSE WITH A DIFFERENT NAME.');
        return;
      }
      out = await st.editPose(cur.key, { name: name, family: family || cur.family, render: render });
      if (out.ok) forge.pose = name;
    } else {
      out = await st.addPose({ name: name, family: family || ((st && st.FAMILY_HERS) || 'hers'), render: render, source: 'his' });
      if (out.ok) forge.pose = out.pose ? out.pose.name : name;
    }
    if (!out || !out.ok) { print('SYSTEM', 'THE BOOK REFUSED THAT: ' + ((out && out.error) || 'unknown')); return; }
    buildPoseRows();
    syncPoseRows();
    saveForge();
    print('SYSTEM', 'POSE BOOK :: ' + (!asNew && cur ? 'UPDATED' : 'FILED') + ' "' + name.toUpperCase() + '"'
      + (family ? ' IN ' + family.toUpperCase() : '')
      + (render ? ' \u00b7 SENDS: ' + render : ' \u00b7 SENDS: ' + name)
      + ' :: KEPT ON THIS DEVICE.');
  }

  async function removePoseRow() {
    var st = window.studio;
    if (!st) return;
    var cur = (forge.pose && st.findPose(forge.pose)) || null;
    if (!cur) { print('SYSTEM', 'NOTHING SELECTED TO REMOVE :: PICK A POSE ABOVE FIRST.'); return; }
    await st.removePose(cur.key);
    print('SYSTEM', 'POSE BOOK :: "' + cur.name.toUpperCase() + '" REMOVED FROM THE BOOK. THE SHIPPED FILE IS UNTOUCHED - /pose reset PUTS EVERYTHING BACK.');
    forge.pose = '';
    buildPoseRows();
    syncPoseRows();
    saveForge();
  }

  async function makeList() {
    var st = window.studio;
    if (!st) return;
    var el = document.getElementById('cpListKey');
    var key = el.value.trim();
    if (!key) { print('SYSTEM', 'NAME THE LIST FIRST (ONE WORD IS ENOUGH).'); el.focus(); return; }
    var out = await st.addFamily(key, '');
    if (!out.ok) { print('SYSTEM', 'THE BOOK REFUSED THAT: ' + out.error); return; }
    el.value = '';
    delete el.dataset.touched;
    buildPoseRows();
    syncPoseRows();
    print('SYSTEM', 'POSE BOOK :: LIST "' + out.family.toUpperCase() + '" IS OPEN'
      + (out.existed ? ' ALREADY' : '')
      + ' :: FILE POSES INTO IT WITH THE EDIT ROW ABOVE, OR ASK HER TO FILL IT.');
  }

  // Hand the choosing to her: the AI call lives in chat.js (that is where her voice, her
  // instructions and generateText live), so this only carries the intent and the list.
  async function askHer(kind) {
    var st = window.studio;
    if (!st) { print('SYSTEM', 'THE PROMPT BOOK IS NOT LOADED HERE.'); return; }
    if (!window.poseAI) { print('SYSTEM', 'SHE CANNOT BE ASKED HERE :: THE CHAT SIDE IS NOT LOADED.'); return; }
    var famSel = document.getElementById('cpPoseFamily');
    var family = famSel && !famSel.disabled ? famSel.value : '';
    var btn = document.getElementById(kind === 'invent' ? 'cpPoseNew' : 'cpPoseAsk');
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = kind === 'invent' ? 'SHE IS WRITING...' : 'SHE IS CHOOSING...';
    try {
      var out = kind === 'invent' ? await window.poseAI.invent({ family: family })
                                  : await window.poseAI.choose({ family: family });
      if (out && out.names && out.names.length) {
        buildPoseRows();
        setPose(out.names[0], { write: out.wrote !== false });
      }
      return out;
    } catch (e) {
      print('SYSTEM', 'SHE COULD NOT BE ASKED: ' + ((e && e.message) ? e.message : e));
    } finally {
      btn.disabled = false;
      btn.textContent = label;
      syncPoseRows();
    }
  }

  function printBook() {
    var st = window.studio;
    if (!st) { print('SYSTEM', 'THE PROMPT BOOK IS NOT LOADED HERE.'); return; }
    var lines = ['THE BOOK :: ' + st.poses().length + ' POSES IN ' + st.families().length + ' LISTS'];
    st.families().forEach(function (family) {
      var list = st.poses(family);
      lines.push('  ' + family.toUpperCase() + ' (' + list.length + ') :: ' + list.map(function (p) {
        return p.name + (p.render ? ' \u2192 ' + p.render : '') + (p.source === 'her' ? ' [HERS]' : (p.source === 'his' ? ' [YOURS]' : ''));
      }).join(' \u00b7 '));
    });
    var book = st.bookData();
    if (book.picks && book.picks.length) {
      lines.push('  SHE HAS CHOSEN ' + book.picks.length + ' TIME' + (book.picks.length === 1 ? '' : 'S')
        + ' :: LAST :: ' + book.picks[book.picks.length - 1].names.join(', ').toUpperCase());
    }
    print('SYSTEM', lines.join('\n'));
  }

  window.forgeBook = {
    refresh: function () { buildPoseRows(); syncPoseRows(); },
    rebuild: function () { buildPoseRows(); syncPoseRows(); },
    setPose: setPose,
    setSlot: function (name, opts) {
      var st = window.studio;
      // Whatever she chose is in the book by the time it gets here (images.js filed it if it was
      // new), so the slot can simply hold it.
      var shown = (st && st.findPose(name)) ? st.findPose(name).name : String(name || '');
      return setPose(shown, opts || {});
    },
    pose: poseName,
    phrase: posePhraseOf,
    printBook: printBook,
    choose: function () { return askHer('choose'); },
    invent: function () { return askHer('invent'); },
    // THE SHOT LIST WRITES THROUGH HERE (src/js/idea.js). A roll is prompt material, so it is
    // written into the boxes exactly the way the recipe book writes a filled recipe: the positive
    // prompt outright (that IS the roll), and the negative list only into an EMPTY negative box -
    // nothing Patrikios wrote there is ever overwritten by a roll. `{negative: 'force'}` writes the
    // negative anyway, for the one case that wants it (a bare `/idea negative`).
    write: function (text, negative, opts) {
      opts = opts || {};
      if (!document.getElementById('cpPrompt')) return { prompt: forge.prompt, negative: forge.negative };
      var box = document.getElementById('cpPrompt');
      if (typeof text === 'string') { box.value = text; forge.prompt = text; }
      var negBox = document.getElementById('cpNegative');
      if (negative && negBox && (!negBox.value.trim() || opts.negative === 'force')) {
        negBox.value = negative;
        forge.negative = negative;
      }
      saveForge();
      syncIdeaRow();
      return { prompt: forge.prompt, negative: forge.negative };
    },
    // What the form holds, for anything that needs to read it without touching the DOM.
    form: function () {
      return {
        prompt: forge.prompt, negative: forge.negative, count: forge.count,
        resolution: forge.resolution, guidance: forge.guidance, seed: forge.seed,
        pose: forge.pose, recipe: forge.recipe,
      };
    },
    // One roll of the shot list, from anywhere (the panel buttons and `/idea` both land here):
    // a die name, a dimension name, or nothing/'all' for every dimension. Rolled, saved, written
    // into the boxes, reported, and the panel's chips repainted.
    roll: function (what) { return rollIdea(what); },
    ideaRow: function () { syncIdeaRow(); },
  };

  if (window.studio && window.studio.onBookChange) window.studio.onBookChange(function () { buildPoseRows(); syncPoseRows(); });

  /* ---- THE RECIPE BOOK in the forge ----------------------------------------
     A recipe is a FRAME and its slots are the words. FILL puts the whole filled
     prompt into the boxes - every slot at the wording the recipe ships with, so
     there is always a complete prompt to read and edit before a CREATE - and
     /recipe <id> :: slot=words does the same with some of it changed. One recipe
     is held for the next render, the way one pose is. The shipped book lives in
     src/studio/recipes.json; a recipe he writes is kept on this device, over it.
     ------------------------------------------------------------------------- */
  function recipeIntoPrompt(text) {
    // A pose already held is prompt material: it is written in after the recipe, once.
    if (!forge.pose) return text;
    var phrase = posePhraseOf();
    if (!phrase) return text;
    if (String(text).toLowerCase().indexOf(String(phrase).toLowerCase()) !== -1) return text;
    return String(text).replace(/[\s,]+$/, '') + ', ' + phrase;
  }

  function buildRecipeRows() {
    var sel = document.getElementById('cpRecipe');
    var st = window.studio;
    if (!sel) return;
    var list = st ? st.recipes() : [];
    sel.textContent = '';
    var none = document.createElement('option');
    none.value = '';
    none.textContent = '\u2014 no recipe \u2014';
    sel.appendChild(none);
    list.forEach(function (r) {
      var o = document.createElement('option');
      o.value = r.id;
      o.textContent = String(r.title || r.id).toUpperCase() + (r.source === 'her' ? ' \u00b7 hers' : (r.source === 'his' ? ' \u00b7 yours' : ''));
      o.title = (r.note ? r.note + '\n\n' : '') + 'SLOTS :: ' + (st ? st.recipeSlots(r).map(function (s) { return s.name; }).join(', ') : '');
      sel.appendChild(o);
    });
  }

  function syncRecipeRows() {
    var st = window.studio;
    var sel = document.getElementById('cpRecipe');
    var note = document.getElementById('cpRecipeNote');
    if (sel) {
      if (forge.recipe && !(st && st.findRecipe(forge.recipe))) forge.recipe = '';
      sel.value = forge.recipe || '';
    }
    if (!note) return;
    if (!st) { note.textContent = 'the recipe book is not loaded here'; return; }
    var r = forge.recipe ? st.findRecipe(forge.recipe) : null;
    if (!r) { note.textContent = st.recipes().length + ' recipes in the book \u00b7 /help recipes for what they are'; return; }
    note.textContent = 'held for the next render \u00b7 ' + st.recipeSlots(r).length + ' slots \u00b7 FILL rewrites the prompt boxes';
  }

  // Fill `spec` - "scene", or "scene :: setting=...; action=...", or {id, values} - into the form.
  // `write:false` holds the recipe without touching the boxes (used by a bare "hold it").
  function fillRecipe(spec, opts) {
    opts = opts || {};
    var st = window.studio;
    if (!st || !st.renderRecipe) {
      print('SYSTEM', 'THE RECIPE BOOK IS NOT LOADED HERE (src/studio/recipes.json).');
      return null;
    }
    var out = (typeof spec === 'string') ? st.renderRecipe(spec || forge.recipe) : st.renderRecipe(spec);
    if (!out || !out.ok) {
      print('SYSTEM', 'RECIPE BOOK :: ' + ((out && out.error) || 'THAT COULD NOT BE FILLED.'));
      return null;
    }
    forge.recipe = out.id;
    var showedPose = (opts.write !== false && forge.pose && posePhraseOf()) ? forge.pose : '';
    if (opts.write !== false) {
      var text = recipeIntoPrompt(out.text);
      // HER COMPOSING carries the house look into the boxes where he can read it: the forge's
      // own CREATE road never appends style words (that append lives on her [[VISION: ...]]
      // road in images.js), so what she composed would otherwise render without them. Gated to
      // her composing - his own FILL writes exactly what the recipe filled, nothing added.
      if (opts.who === "SHE COMPOSES FROM" && typeof LIA_IMAGE_STYLE !== "undefined" && LIA_IMAGE_STYLE) {
        var houseLook = String(LIA_IMAGE_STYLE).trim().replace(/\s+/g, " ");
        if (houseLook && text.toLowerCase().indexOf(houseLook.toLowerCase()) === -1) {
          text = text.replace(/[\s,]+$/, "") + ", " + houseLook;
        }
      }
      var box = document.getElementById('cpPrompt');
      if (box) { box.value = text; forge.prompt = text; }
      // The negative goes in only when the negative box is EMPTY - nothing of his is ever
      // overwritten (the same rule the prompt book follows for a pasted document).
      var negBox = document.getElementById('cpNegative');
      if (out.negative && negBox && !negBox.value.trim()) { negBox.value = out.negative; forge.negative = out.negative; }
    }
    if (opts.quiet !== true) {
      print('SYSTEM', st.recipeReport(out, opts.who || 'FILLED', {
        extra: [showedPose ? ('THE HELD POSE ' + String(showedPose).toUpperCase() + ' IS WRITTEN IN AFTER IT') : '']
      }));
    }
    buildRecipeRows();
    syncRecipeRows();
    saveForge();
    return out;
  }

  function printRecipe(name) {
    var st = window.studio;
    if (!st) return;
    var arg = String(name == null ? '' : name).trim();
    if (!arg) { printRecipeBook(); return; }
    var parsed = st.parseRecipeSpec(arg);
    var r = st.findRecipe(parsed.id);
    if (!r) {
      print('SYSTEM', 'RECIPE BOOK :: NO RECIPE CALLED "' + String(parsed.id).toUpperCase() + '" IN THE BOOK.'
        + '\nTHE BOOK HAS: ' + st.recipes().map(function (x) { return x.id; }).join(', '));
      return;
    }
    print('SYSTEM', st.describeRecipe(r, parsed.values));
  }

  function printRecipeBook() {
    var st = window.studio;
    if (!st) { print('SYSTEM', 'THE RECIPE BOOK IS NOT LOADED HERE.'); return; }
    var list = st.recipes();
    var lines = ['THE RECIPE BOOK :: ' + list.length + ' RECIPE' + (list.length === 1 ? '' : 'S') + ' (' + st.RECIPES_FILE + ')'];
    if (!list.length) {
      lines.push('  THE SHIPPED FILE COULD NOT BE READ HERE - AN UNSAVED PREVIEW IN A BROWSER WITH NO SERVICE WORKER CANNOT READ src/.');
      print('SYSTEM', lines.join('\n'));
      return;
    }
    list.forEach(function (r) {
      lines.push('');
      lines.push('  ' + String(r.title || r.id).toUpperCase() + '  [' + r.id + ']'
        + (r.source === 'her' ? '  [HERS]' : (r.source === 'his' ? '  [YOURS]' : '')));
      if (r.note) lines.push('    ' + r.note);
      lines.push('    SLOTS :: ' + st.recipeSlots(r).map(function (s) { return s.name; }).join(', '));
    });
    lines.push('');
    lines.push('  FILL ONE :: pick it in the CREATE IMAGE panel and press FILL THE PROMPT, or type /recipe <id> - and /recipe <id> :: slot=words; slot2=words to change some of the wording. Whatever you do not name keeps the recipe\'s own words.');
    lines.push('  THE FOLDER :: PROMPT RECIPES under the RECIPE row works the same book visibly - every recipe as a row (FILL, SHOW, EDIT, EXPORT, DROP), + NEW, UPLOAD JSON, IMPORT .TXT, KEEP BOXES AS RECIPE, EXPORT MINE.');
    lines.push('  SHE USES THEM TOO :: a line "[[RECIPE: id :: slot=words]]" in her reply is her ONE image for that reply, composed from that recipe. /recipe picks is the record of what she composed.');
    lines.push('  /recipe save <id> :: <template> writes one of your own ({{slot}} marks a slot); /recipe clone <new-id> from <old-id> starts one from an old frame; /recipe drop <id> takes it out; /recipe export hands you the book as JSON.');
    print('SYSTEM', lines.join('\n'));
  }

  // Hand the composing to her: the AI call lives in chat.js (that is where her voice and
  // generateText live), so this only carries the intent and the recipe she starts from.
  async function askRecipe() {
    var st = window.studio;
    if (!st) { print('SYSTEM', 'THE RECIPE BOOK IS NOT LOADED HERE.'); return; }
    if (!window.recipeAI) { print('SYSTEM', 'SHE CANNOT BE ASKED HERE :: THE CHAT SIDE IS NOT LOADED.'); return; }
    var sel = document.getElementById('cpRecipe');
    var btn = document.getElementById('cpRecipeAsk');
    var label = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'SHE IS COMPOSING...'; }
    try {
      var out = await window.recipeAI.compose({ recipe: (sel && sel.value) || forge.recipe || '' });
      if (out && out.ok) { buildRecipeRows(); syncRecipeRows(); }
      return out;
    } catch (e) {
      print('SYSTEM', 'SHE COULD NOT BE ASKED: ' + ((e && e.message) ? e.message : e));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = label; syncRecipeRows(); }
    }
  }

  var recipeRowWired = false;
  function wireRecipeRow() {
    if (recipeRowWired) return;
    recipeRowWired = true;
    var on = function (id, fn) { var el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    on('cpRecipeUse', function () {
      var sel = document.getElementById('cpRecipe');
      fillRecipe((sel && sel.value) || forge.recipe, { write: true });
    });
    on('cpRecipeShow', function () {
      var sel = document.getElementById('cpRecipe');
      printRecipe((sel && sel.value) || forge.recipe);
    });
    on('cpRecipeClear', function () {
      forge.recipe = '';
      buildRecipeRows();
      syncRecipeRows();
      saveForge();
      print('SYSTEM', 'RECIPE BOOK :: NO RECIPE IS HELD FOR THE NEXT RENDER. THE PROMPT BOXES ARE UNTOUCHED.');
    });
    on('cpRecipeAsk', function () { askRecipe(); });
    var selEl = document.getElementById('cpRecipe');
    if (selEl) selEl.addEventListener('change', function () { forge.recipe = selEl.value || ''; syncRecipeRows(); saveForge(); });
  }

  window.forgeRecipes = {
    refresh: function () { buildRecipeRows(); syncRecipeRows(); },
    rebuild: function () { buildRecipeRows(); syncRecipeRows(); },
    fill: fillRecipe,
    print: printRecipe,
    printBook: printRecipeBook,
    ask: askRecipe,
    recipe: function () { return forge.recipe || ''; },
    set: function (id) {
      forge.recipe = String(id || '');
      buildRecipeRows();
      syncRecipeRows();
      saveForge();
      return forge.recipe;
    },
  };

  if (window.studio && window.studio.onRecipeChange) window.studio.onRecipeChange(function () { buildRecipeRows(); syncRecipeRows(); });

  /* ---- THE SHOT LIST in the forge (src/js/idea.js) -------------------------
     One row of dice, one row of chips, one scene line. The dice are built from
     the `dice` list in main.pjs, so a new die there is a new button here and
     nothing in this file changes. A chip is one dimension of the roll: its ↻
     draws that dimension again and leaves every other chip exactly where it is
     (which is how a subject, a setting or a camera is held across a run), and its
     ✕ drops the dimension from the prompt. Every roll writes the composed prompt
     into the boxes through `window.forgeBook.write` - nothing here renders
     anything, and nothing rolls on its own.
     ------------------------------------------------------------------------- */
  function ideaReady() { return !!(window.idea && window.idea.chips); }

  function buildDiceRow() {
    var box = document.getElementById('cpDice');
    if (!box) return;
    box.textContent = '';
    if (!ideaReady()) return;
    var all = window.idea.dice();
    var roll = document.createElement('button');
    roll.type = 'button';
    roll.textContent = '\uD83C\uDFB2 idea';
    roll.title = 'roll every dimension at once and write the prompt into the boxes';
    roll.onclick = function () { rollIdea('all'); };
    box.appendChild(roll);
    all.forEach(function (die) {
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.die = die.name;
      b.textContent = '\uD83C\uDFB2 ' + die.name;
      b.title = 'roll ' + die.rolls.length + ' dimension' + (die.rolls.length === 1 ? '' : 's') + (die.catchAll ? ' (everything no other die claims)' : '') + ': ' + die.rolls.join(', ');
      b.onclick = function () { rollIdea(die.name); };
      box.appendChild(b);
    });
  }

  function ideaChip(chip) {
    var wrap = document.createElement('span');
    wrap.className = 'ideaChip';
    wrap.title = chip.label.toUpperCase() + ' :: ' + chip.value;
    var name = document.createElement('b');
    name.textContent = chip.label;
    var text = document.createElement('span');
    text.className = 'ideaChipTxt';
    text.textContent = chip.head;
    var again = document.createElement('button');
    again.type = 'button';
    again.textContent = '\u21bb';
    again.title = 're-roll just ' + chip.label + ' - every other dimension stays exactly where it is';
    again.onclick = function (e) { e.stopPropagation(); rollIdea(chip.list); };
    var x = document.createElement('button');
    x.type = 'button';
    x.textContent = '\u00d7';
    x.title = 'drop ' + chip.label + ' from the prompt';
    x.onclick = function (e) {
      e.stopPropagation();
      window.idea.drop(chip.list);
      window.idea.save();
      syncIdeaRow();
      window.forgeBook.write(window.idea.compose(window.idea.values(), 'prompt'), window.idea.compose(window.idea.values(), 'negative'));
    };
    wrap.appendChild(name);
    wrap.appendChild(text);
    wrap.appendChild(again);
    wrap.appendChild(x);
    return wrap;
  }

  function syncIdeaRow() {
    var chips = document.getElementById('cpIdeaChips');
    if (!chips) return;
    chips.textContent = '';
    var rows = ideaReady() ? window.idea.chips() : [];
    rows.forEach(function (chip) { chips.appendChild(ideaChip(chip)); });
    var chipRow = document.getElementById('cpIdeaChipRow');
    if (chipRow) chipRow.hidden = rows.length === 0;
    var sceneRow = document.getElementById('cpSceneRow');
    var scene = document.getElementById('cpSceneLine');
    var title = ideaReady() ? window.idea.sceneTitle(window.idea.values()) : '';
    if (scene) scene.textContent = title ? title.toUpperCase() : '';
    if (sceneRow) sceneRow.hidden = !title;
    var note = document.getElementById('cpIdeaNote');
    if (note) {
      if (!ideaReady()) note.textContent = 'THE SHOT LIST MODULE IS NOT LOADED HERE';
      else if (!rows.length) note.textContent = 'NOTHING ROLLED YET :: ' + (window.idea.PARTS.length) + ' DIMENSIONS ARE WAITING';
      else note.textContent = rows.length + ' DIMENSION' + (rows.length === 1 ? '' : 'S') + ' HELD :: A CHIP\u2019S \u21bb RE-ROLLS ONLY THAT ONE';
    }
  }

  // One roll, then the report and the write, in that order. `what` is a die name,
  // a dimension, or 'all'.
  function rollIdea(what) {
    if (!ideaReady()) { print('SYSTEM', 'THE SHOT LIST MODULE IS NOT LOADED HERE (src/js/idea.js).'); return null; }
    var label = '';
    if (!what || what === 'all') {
      window.idea.rollAll();
      label = 'SHOT LIST :: ROLLED EVERY DIMENSION (' + window.idea.PARTS.length + ')';
    } else {
      var die = window.idea.dice().filter(function (d) { return d.name.toLowerCase() === String(what).toLowerCase(); })[0];
      if (die) {
        var res = window.idea.rollDie(die.name);
        if (!res) { print('SYSTEM', 'SHOT LIST :: NOTHING CAME BACK FROM ' + die.name.toUpperCase() + '.'); return null; }
        label = 'SHOT LIST :: ' + die.name.toUpperCase() + ' ROLLED ' + res.rolled.length + ' DIMENSION' + (res.rolled.length === 1 ? '' : 'S')
          + (res.catchAll ? ' (' + die.rolls.length + ', EVERYTHING NO OTHER DIE CLAIMS)' : '');
      } else {
        var one = window.idea.rollOne(what);
        if (!one) {
          print('SYSTEM', 'SHOT LIST :: NO DIMENSION OR DIE CALLED "' + String(what).toUpperCase() + '".'
            + '\nTHE DIMENSIONS :: ' + window.idea.names().join(', '));
          return null;
        }
        label = 'SHOT LIST :: RE-ROLLED ' + one.label.toUpperCase();
      }
    }
    window.idea.save();
    var wrote = window.forgeBook.write(window.idea.compose(window.idea.values(), 'prompt'), window.idea.compose(window.idea.values(), 'negative'));
    print('SYSTEM', window.idea.report(label) + '\nTHE PROMPT IS IN THE BOXES :: CREATE RENDERS IT.');
    syncIdeaRow();
    return { wrote: wrote };
  }

  function wireIdeaRow() {
    var roll = document.getElementById('cpIdeaRoll');
    var clr = document.getElementById('cpIdeaClear');
    if (roll) roll.onclick = function () { rollIdea('all'); };
    if (clr) clr.onclick = function () {
      if (!ideaReady()) return;
      window.idea.clear();
      print('SYSTEM', 'SHOT LIST :: THE ROLL IS FORGOTTEN. THE BOXES ARE LEFT EXACTLY AS THEY ARE.');
      syncIdeaRow();
    };
    if (window.idea && window.idea.onChange) window.idea.onChange(syncIdeaRow);
  }

  // The deck is fixed to the bottom of the screen, so the log's bottom padding has to track
  // its height or the newest messages hide behind it. When the forge panel is open we also
  // try to reserve room for it - but only on screens tall enough to spare it, otherwise the
  // panel just overlays the log rather than squeezing it into a sliver.
  function syncDeckSpace() {
    var deck = document.getElementById('command-deck');
    var out = document.getElementById('output');
    var panel = document.getElementById('createPanel');
    if (!deck || !out) return;
    var space = deck.offsetHeight + 24;
    if (panel && !panel.hidden) {
      // THE FORGE PANEL IS TALL NOW (the prompt book lives in it: split, pose, the lists), and its
      // dock is measured from the deck - so on a short screen its top rows could sit off the top of
      // the viewport. Give it the room above the deck, measured TWICE - from the deck's own top edge
      // and from the viewport minus the deck's height - and take the larger, because the deck's
      // reported height and its reported position can disagree for a moment while a panel opens
      // (measured: 490px against 241px on a phone, mid-open). The panel scrolls inside itself, so
      // the only thing this decides is how much of it is on screen at once.
      var deckTop = deck.getBoundingClientRect().top;
      var room = Math.max(deckTop > 40 ? (deckTop - 24) : 0, window.innerHeight - deck.offsetHeight - 24);
      panel.style.maxHeight = Math.max(180, Math.min(620, room)) + 'px';
      var extra = panel.offsetHeight + 12;
      if (out.clientHeight - extra > 180) space += extra;
    } else if (panel) {
      panel.style.maxHeight = '';
    }
    // THE STAGE'S BOTTOM RESERVE, published as the CSS variable the stage's own margin reads
    // (src/css/terminal.css `#output`). A measured number here and a fixed one in the stylesheet
    // would be two answers to one question; this is the only writer.
    document.documentElement.style.setProperty('--stage-reserve', space + 'px');
    out.scrollTop = out.scrollHeight;
  }

  // The deck's height is not a constant: the buttons wrap differently as the window narrows, a panel
  // opens or closes, the attach strip appears. Watch the deck itself so the log's reserve is never a
  // stale guess (the resize handler above stays as the fallback). THE WORK IS DONE ON THE NEXT FRAME,
  // not inside the observer's own delivery: this function writes `--stage-reserve` and a panel's
  // maxHeight while the deck it is measuring is the element being watched, and a write inside a delivery
  // is the one pattern the browser reports as "ResizeObserver loop completed with undelivered
  // notifications" (see the same reasoning in decks.js's measureSoon). Coalesced per frame.
  var deckSpaceQueued = false;
  function syncDeckSpaceSoon() {
    if (deckSpaceQueued) return;
    deckSpaceQueued = true;
    var run = function () { deckSpaceQueued = false; syncDeckSpace(); };
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(run);
    else window.setTimeout(run, 0);
  }

  if (typeof ResizeObserver !== 'undefined') {
    try { new ResizeObserver(function () { syncDeckSpaceSoon(); }).observe(document.getElementById('command-deck')); } catch (e) {}
  }

  var poseRowsWired = false;
  var bigWindowWired = false;
  function syncBigWindow() {
    var box = document.getElementById('cpBigWindow');
    if (box) box.checked = !!forge.bigWindow;
  }
  function wireBigWindow() {
    if (bigWindowWired) return;
    bigWindowWired = true;
    var box = document.getElementById('cpBigWindow');
    if (box) box.addEventListener('change', function () {
      forge.bigWindow = !!box.checked;
      saveForge();
      if (typeof print === "function") print('SYSTEM', 'IMAGE FORGE :: 4X WINDOW ' + (forge.bigWindow
        ? 'TICKED - THE NEXT CREATE PRESS OPENS A BIGGER.PICS WINDOW FOR THE RUN\u2019S FIRST PICTURE (4x).'
        : 'UNTICKED - CREATE ONLY RENDERS, AND EVERY PICTURE IS ENLARGED ON THIS MACHINE (2x, NOTHING UPLOADED).'));
    });
  }
  function wirePoseRows() {
    if (poseRowsWired) return;
    poseRowsWired = true;
    var on = function (id, fn) { var el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    on('cpPose', function () { setPose(document.getElementById('cpPose').value, { write: false }); });
    on('cpPoseUse', function () { setPose(forge.pose || document.getElementById('cpPose').value, { write: true }); });
    on('cpPoseClear', function () { setPose('', { write: false }); });
    on('cpPoseAsk', function () { askHer('choose'); });
    on('cpPoseNew', function () { askHer('invent'); });
    on('cpPoseSave', function () { savePoseEdit(false); });
    on('cpPoseAdd', function () { savePoseEdit(true); });
    on('cpPoseRemove', function () { removePoseRow(); });
    on('cpListAdd', function () { makeList(); });
    on('cpPoseBook', function () { printBook(); });
    on('cpRecall', function () { recallLast(); });
    var listKey = document.getElementById('cpListKey');
    if (listKey) listKey.addEventListener('input', function () { listKey.dataset.touched = '1'; });
  }

  function openForge() {
    try { if (window.instr && window.instr.close && (document.body.classList.contains("systemFull") || (window.instr.isOpen && window.instr.isOpen()))) window.instr.close(); } catch (e) {}
    try { if (window.moods && window.moods.panelIsOpen && window.moods.panelIsOpen()) window.moods.panelClose(); } catch (e) {}
    try { if (window.shelf && window.shelf.close && (document.body.classList.contains("shelfFull") || (window.shelf.isOpen && window.shelf.isOpen()))) window.shelf.close(); } catch (e) {}
    try { if (window.moodpack && window.moodpack.close && (document.body.classList.contains("moodpackFull") || (window.moodpack.isOpen && window.moodpack.isOpen()))) window.moodpack.close(); } catch (e) {}
    setFull(true);
    document.getElementById('cpPrompt').value = forge.prompt;
    document.getElementById('cpNegative').value = forge.negative;
    document.getElementById('cpSeed').value = forge.seed || '';
    document.getElementById('cpProgress').textContent = '';
    buildForgeChips();
    syncForgeChips();
    buildPoseRows();
    syncPoseRows();
    wirePoseRows();
    buildRecipeRows();
    syncRecipeRows();
    wireRecipeRow();
    buildDiceRow();
    wireIdeaRow();
    syncIdeaRow();
    paintRecall();
    syncBigWindow();
    wireBigWindow();
    // one deck panel at a time
    if (window.keyring && window.keyring.isOpen()) window.keyring.close();
    document.getElementById('createPanel').hidden = false;
    syncDeckSpace();
    document.getElementById('cpPrompt').focus();
  }

  function closeForge() {
    var panel = document.getElementById('createPanel');
    if (panel.hidden) { setFull(false); return; }
    forge.prompt = document.getElementById('cpPrompt').value;
    forge.negative = document.getElementById('cpNegative').value;
    forge.guidance = Number(document.getElementById('cpGuidance').value) || DEFAULT_GUIDANCE;
    forge.seed = document.getElementById('cpSeed').value.trim();
    saveForge();
    setFull(false);
    panel.hidden = true;
    syncDeckSpace();
  }

  var forgeHomeParent = null, forgeHomeNext = null, forgeFullKey = null;

  function setFull(on) {
    on = !!on;
    var p = document.getElementById('createPanel');
    if (on) {
      if (p && p.parentNode !== document.body) {
        if (!forgeHomeParent) { forgeHomeParent = p.parentNode; forgeHomeNext = p.nextSibling; }
        try { document.body.appendChild(p); } catch (e) {}
      }
      if (!forgeFullKey) {
        forgeFullKey = function (e) {
          if (e.key !== "Escape" && e.keyCode !== 27) return;
          try { closeForge(); } catch (x) {}
        };
        document.addEventListener("keydown", forgeFullKey, true);
      }
    } else {
      if (p && forgeHomeParent) {
        try { forgeHomeParent.insertBefore(p, forgeHomeNext); } catch (e) {}
        forgeHomeParent = null;
        forgeHomeNext = null;
      }
      if (forgeFullKey) {
        try { document.removeEventListener("keydown", forgeFullKey, true); } catch (e) {}
        forgeFullKey = null;
      }
    }
    try { document.body.classList.toggle("createFull", on); } catch (e) {}
    return on;
  }

  // The prompt book in front of the service: split the sections, route any (key:::value) tags to
  // the fields they mean, translate the veiled tongue, and put the negative list in the negative
  // box where it belongs. `writeBack` is false for a CREATE (his pasted text stays in the box,
  // the render gets the resolved form, and every move is printed) and true for the SPLIT button
  // (which files the result into the boxes so he can see and edit it).
  function splitPasted(writeBack) {
    var promptEl = document.getElementById('cpPrompt');
    var negativeEl = document.getElementById('cpNegative');
    var st = window.studio;
    var raw = promptEl.value.trim();
    if (!st) { print('SYSTEM', 'THE PROMPT BOOK IS NOT LOADED HERE.'); return null; }
    if (!raw) { print('SYSTEM', 'NOTHING TO SPLIT :: THE POSITIVE BOX IS EMPTY.'); return null; }
    var res = st.resolve(raw, {
      negative: negativeEl.value.trim(), seed: parseSeed(forge.seed),
      guidance: forge.guidance, resolution: forge.resolution,
      defaultGuidance: DEFAULT_GUIDANCE, defaultResolution: LIA_IMAGE_RESOLUTION,
    });
    st.reportLines(res.report).forEach(function (line) { print('SYSTEM', line); });
    if (!res.changed) print('SYSTEM', 'PROMPT BOOK :: NOTHING TO SPLIT OR ROUTE :: THE BOX IS ALREADY ONE CLEAN PROMPT.');
    var sent = res.positive.length;
    print('SYSTEM', 'PROMPT BOOK :: POSITIVE ' + sent + ' CHARS' + (res.negative ? ' :: NEGATIVE ' + res.negative.length + ' CHARS' : ''));
    if (writeBack) {
      promptEl.value = res.positive;
      forge.prompt = res.positive;
      if (res.negative) { negativeEl.value = res.negative; forge.negative = res.negative; }
      if (res.seed && !parseSeed(forge.seed)) { document.getElementById('cpSeed').value = String(res.seed); forge.seed = String(res.seed); }
      saveForge();
      print('SYSTEM', 'PROMPT BOOK :: THE BOXES NOW HOLD THE SPLIT FORM :: YOUR ORIGINAL PASTE IS IN THE UNDO HISTORY.');
    }
    return res;
  }

  // ONE BATCH AT A TIME, AND THE LOCK IS TAKEN BEFORE ANYTHING ASYNCHRONOUS HAPPENS. The body of
  // a CREATE reads the form, builds the tiles and AWAITS the archive write before it renders
  // anything - and `if (forgeRunning) return` used to sit at the top of that same function, so a
  // second press during the await sailed straight past the test and started a whole second batch:
  // one press of CREATE, two sets of images (the archive shows it - two create entries with the
  // same form, minutes apart, twelve images where six were asked for). A disabled button is not a
  // lock either: a double-tap on a phone, or CTRL+ENTER, arrives before the disable paints.
  async function createImages() {
    // THE PRESS THAT MAY OPEN A WINDOW (src/js/pipeline.js). Only when the forge's 4X WINDOW box
    // is ticked: this runs SYNCHRONOUSLY, before anything is awaited, because a browser only lets
    // a real click open a popup - so this is the only moment the bigger pipeline can get a
    // bigger.pics window for this run. The window is handed a promise for the first picture (it
    // does not exist yet), and the pipeline places everything this run makes: that first picture
    // at 4x, the rest of the batch through this machine at 2x, falling back the same way if the
    // window brings nothing back. Unticked, no window is ever opened and the whole run goes the
    // unattended road. `/upscale pipeline off` removes the pipeline entirely, box or no box.
    try {
      // THE PROMPT IS CHECKED FIRST, because a window that opens for a run that never starts would sit
      // there waiting for a picture that is never made. The check is synchronous (it is only the box),
      // so the click is still the click when the window opens.
      var pEl = document.getElementById('cpPrompt');
      if (forge.bigWindow && window.pipeline && pEl && String(pEl.value || "").trim()) window.pipeline.arm();
    } catch (e) { console.warn("the bigger pipeline could not be armed", e); }
    if (forgeRunning) return;
    forgeRunning = true;
    try {
      return await createImagesRun();
    } finally {
      forgeRunning = false;
    }
  }

  // Renders `forge.count` images from the form, one after another, filling each tile in
  // as it lands. A blank seed field means each render rolls its own random seed (so a
  // batch is never N copies of one image); a pinned seed is used as-is for the first
  // image and advanced by one for each following image, so a pinned run is reproducible.
  // Everything is stored in the vault and archived like her own visions.
  async function createImagesRun() {
    var promptEl = document.getElementById('cpPrompt');
    var negativeEl = document.getElementById('cpNegative');
    var prompt = promptEl.value.trim();
    var negative = negativeEl.value.trim();
    if (!prompt) { print('SYSTEM', 'A POSITIVE PROMPT IS REQUIRED.'); promptEl.focus(); return; }

    forge.prompt = promptEl.value;
    forge.negative = negativeEl.value;
    forge.guidance = Number(document.getElementById('cpGuidance').value) || DEFAULT_GUIDANCE;
    forge.seed = document.getElementById('cpSeed').value.trim();
    saveForge();

    var resolution = forge.resolution;
    var count = forge.count;
    var guidance = forge.guidance;
    var baseSeed = parseSeed(forge.seed);
    if (forge.seed && !baseSeed) {
      print('SYSTEM', 'SEED "' + forge.seed + '" IS NOT USABLE :: ENTER A WHOLE NUMBER BETWEEN 1 AND ' + SEED_CEILING + '.');
    }

    // THE POSE SLOT. A pose held from the book (his pick, or hers) is part of the prompt like any
    // other words: its phrase is appended once, and the report says so. A phrase already written
    // into the box is never duplicated.
    var pinned = poseIntoPrompt(prompt);
    prompt = pinned.prompt;
    var poseHeld = pinned.pose;
    var posePhrase = pinned.phrase;

    // Everything above is the form. This is the prompt book: the pasted text is read as the
    // document it is - sections split, (key:::value) tags routed to the fields they mean, the
    // veiled tongue translated - and every decision is printed before a single render starts.
    var st = window.studio;
    var res = st ? st.resolve(prompt, {
      negative: negative, seed: baseSeed, guidance: guidance, resolution: resolution,
      defaultGuidance: DEFAULT_GUIDANCE, defaultResolution: LIA_IMAGE_RESOLUTION,
    }) : null;
    if (res) {
      st.reportLines(res.report).forEach(function (line) { print('SYSTEM', line); });
      prompt = res.positive;
      negative = res.negative;
      resolution = res.resolution;
      guidance = res.guidance;
      if (res.seed && !baseSeed) {
        baseSeed = res.seed;
      }
      // The negative box is filled when it is empty (nothing of his is lost, and it saves him the
      // copy-paste). Everything else stays where it is: the report above says exactly what this
      // run uses, so a document's guidance or seed never silently sticks to the form for the
      // next file. SPLIT INTO FIELDS is there when he wants the boxes rewritten on purpose.
      // THE HOUSE DEFAULT IS NOT COPIED IN (2026-09-30): it is the fallback for a render that has no
      // negative, not a list of his, and a page and a half of terms appearing in his box on the first
      // CREATE - and being saved as his own form text - is not "saving him the copy-paste". The
      // report line above says the house list is in use, and the box stays as he left it.
      if (!negativeEl.value.trim() && res.negative && res.report.negativeFrom !== "house") { negativeEl.value = res.negative; forge.negative = res.negative; saveForge(); }
    }
    if (posePhrase) {
      print('SYSTEM', 'PROMPT BOOK :: POSE :: ' + poseHeld.toUpperCase() + ' IS IN THE PROMPT ("' + posePhrase + '")'
        + (poseHeld !== posePhrase ? ' :: IT RENDERS AS THAT, NOT AS ITS NAME' : ''));
    }

    var dims = resolution.split('x');
    var goBtn = document.getElementById('cpGo');
    var progressEl = document.getElementById('cpProgress');
    var log = document.getElementById('output');

    // A creation is not something that is said to her - it is something she is given to look
    // at (queueSight below). No HITL turn and no prompt text is posted, and this tool line is
    // SYSTEM output, which never reaches her context.
    print('SYSTEM', 'IMAGE FORGE :: ' + count + (count === 1 ? ' IMAGE' : ' IMAGES') + ' @ ' + resolution
      + ' :: GUIDANCE ' + guidance + (poseHeld ? ' :: POSE ' + poseHeld.toUpperCase() : '') + ' :: '
      + (baseSeed ? 'SEED ' + baseSeed + (count > 1 ? '-' + Math.min(SEED_CEILING, baseSeed + count - 1) : '') : 'SEED RANDOM'));

    var wrap = document.createElement('div');
    wrap.className = 'entry';
    var grid = document.createElement('div');
    grid.className = 'imageGrid' + (count > 1 ? ' batch' : '');
    var tiles = [];
    for (var i = 0; i < count; i++) {
      var tile = buildTile({ prompt: prompt, spin: count > 1 ? 'QUEUED ' + (i + 1) + '/' + count : 'RENDERING' });
      if (count > 1) {
        var capTxt = tile.querySelector('.capTxt');
        capTxt.textContent = '#' + (i + 1) + ' \u00b7 ' + prompt;
        capTxt.title = prompt;
      }
      grid.appendChild(tile);
      tiles.push(tile);
    }
    wrap.appendChild(grid);
    // The forge's own line of pictures carries the batch bar too (src/js/batch.js): the run that was
    // just made is exactly the thing worth ticking through (see the tick box `fillTile` draws).
    if (count > 1 && window.batch) { try { window.batch.decorate(grid); } catch (e) { console.warn("the batch bar could not be drawn", e); } }
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;

    var ts = Date.now();
    await saveEntry({
      ts: ts, kind: 'create', silent: true,
      h: '/create ' + prompt,
      s: '[IMAGE FORGE] ' + count + (count === 1 ? ' image' : ' images') + ' @ ' + resolution
        + ' :: guidance ' + guidance
        + (baseSeed ? ' :: seed ' + baseSeed : ' :: seed random')
        + (poseHeld ? ' :: pose: ' + poseHeld : '')
        + (negative ? ' :: negative: ' + negative : ''),
      img: [], gen: [],
    });

    goBtn.disabled = true;
    var produced = [];    var sentShown = false;
    // THE BAR (src/js/progress.js): the forge's own line in the panel head (#cpProgress) says the
    // same thing, but a batch of nine takes a while and the rail is where a glance finds it. It is
    // priority 1, so it outranks the no-count render call inside each picture - the batch's number is
    // the honest one to show.
    var P = null;
    try {
      if (window.progress) P = window.progress.begin('RENDERING', {
        id: 'forge', total: count,
        detail: count + (count === 1 ? ' image' : ' images') + ' @ ' + resolution + ' - the forge',
      });
    } catch (e) {}
    try {
      for (var k = 0; k < count; k++) {
        var seed = baseSeed ? Math.min(SEED_CEILING, baseSeed + k) : randomSeed();
        var capTxt = tiles[k].querySelector('.capTxt');
        var seedTag = ' \u00b7 SEED ' + seed;
        var spin = tiles[k].querySelector('.spin');
        if (spin) spin.textContent = 'RENDERING ' + (k + 1) + ' / ' + count + seedTag;
        goBtn.textContent = 'CREATING ' + (k + 1) + '/' + count;
        progressEl.textContent = 'RENDERING ' + (k + 1) + ' / ' + count + seedTag;
        if (P) P.set(k + 1);
        try {
          var out = await renderImage({
            prompt: prompt, negativePrompt: negative, resolution: resolution,
            seed: seed, guidanceScale: guidance, promptResolved: true,
          });
          // The ground truth: what the service itself was handed, read back from the plugin. Shown
          // once per run, so "what did it actually send?" is never a guess again.
          if (!sentShown && out.sent) {
            sentShown = true;
            print('SYSTEM', 'PROMPT BOOK :: SENT TO THE SERVICE (' + out.sent.length + ' CHARS) :: '
              + out.sent.slice(0, 220) + (out.sent.length > 220 ? ' ...' : ''));
          }
          var id = await window.media.add(out.blob, {
            kind: 'gen', prompt: out.prompt || prompt, sent: out.sent || '',
            negative: negative, seed: out.seed, guidanceScale: guidance,
            resolution: resolution, pose: poseHeld || '', recipe: forge.recipe || '',
            how: 'forge',
            w: out.w || Number(dims[0]) || 0, h: out.h || Number(dims[1]) || 0,
          });
          if (capTxt) {
            // The caption shows what THIS image was actually asked for - with a {a|b} Choice in the
            // prompt, that is the pose this one got, not the template all nine were made from.
            // A lone picture is not a numbered panel, so it gets no '#1' on it.
            capTxt.textContent = (count > 1 ? '#' + (k + 1) + ' \u00b7 ' : '') + (out.prompt || prompt);
            capTxt.title = (out.sent || prompt) + '\nseed ' + out.seed + ' :: guidance ' + guidance + ' :: ' + resolution;
          }
          fillTile(tiles[k], id);
          produced.push(genRowOf(id, out, prompt));
          await queueSight([id]);
          await patchEntry(ts, { gen: produced.slice() });
        } catch (e) {
          failTile(tiles[k], 'CREATION FAILED: ' + ((e && e.message) ? e.message : e));
        }
        log.scrollTop = log.scrollHeight;
      }
    } finally {
      goBtn.disabled = false;
      goBtn.textContent = 'CREATE';
      progressEl.textContent = produced.length + ' / ' + count + ' CREATED';
      if (P) { try { P.finish(); } catch (e) {} }
      log.scrollTop = log.scrollHeight;
    }
    print('SYSTEM', 'IMAGE FORGE COMPLETE :: ' + produced.length + ' / ' + count
      + (count === 1 ? ' IMAGE' : ' IMAGES') + ' RENDERED AND HELD IN THE VAULT.'
      + (produced.length
        ? '\nNOTHING ABOUT ' + (produced.length === 1 ? 'IT' : 'THEM') + ' IS SAID TO HER IN WORDS - YOUR NEXT MESSAGE GIVES HER '
          + (produced.length === 1 ? 'IT' : 'THE NEWEST FEW') + ' TO LOOK AT WITH HER OWN EYES.'
        : ''));
  }
