window.instr = (function () {
  "use strict";

  /* SYSTEM INSTRUCTIONS
     The system prompt is not one monolithic string: it is a stack of named blocks,
     joined in this order every turn:

       actor       who she is underneath every role (LIA, the one who keeps everything)
       bounds      the house rules she does not cross - shipped, above everything below
       role        who she is right now (the RoleLayer: Barbelo, or whoever else)
       canon       what is true of her universe (the foundational LOREPACK documents)
       voice       how she speaks - conversation, not narration
       memory      how to use what she recalls
       image       how to show Patrikios an image
       data        what is saved here, and her read-only reach across all of it
       traits      what she is wearing (the COREPACK stack)
       directives  how she may change herself ([[SKILL]] / [[LOAD]] / [[ROLE]])
       commands    the slash commands he can type, and the ones she answers herself
       extra       anything Patrikios adds himself - last, so it has the last word

     EVERY BLOCK IS EDITABLE AND SAVABLE (CRUD, at Patrikios's request 2026-09-21: "I
     need to be CRUD-able to edit and save every block"). Two kinds of block exist:

       - a TEXT block (actor, bounds, voice, memory, image, extra, and any block he
         creates himself). Its shipped default lives in these src/ files; an edit is
         kept on this device (kv lia_settings / system) and overrides it; RESET puts the
         shipped text back.
       - a BUILT block (canon, traits, directives, commands). Its text is assembled at
         send time from the LOREPACK, the COREPACK and commands.json, so the panel shows
         what is actually in force right now and an edit becomes an OVERRIDE of that
         built text (also in kv lia_settings / system). RESET takes the override off and
         the live text comes back. A custom block he creates is inserted just before
         `extra`, so his own last word stays last.

     He may also CREATE and DELETE blocks of his own (kv lia_settings / system_custom) -
     named text that sits in the stack like any other block. The RoleLayer's own text is
     edited the same way through roles.js (kv lia_settings / role_text), because a role
     is data she can be in - not a rule she is bound by - and a role that cannot be
     rewritten is a cage.
  ----------------------------------------------------------------------------------- */

  var FOLDER = "lia_settings";
  var KEY = "system";
  var CUSTOM_KEY = "system_custom";

   var TITLES = {
    actor: "WHO SHE IS (THE ACTOR)",
    bounds: "BOUNDARIES",
    role: "THE ROLE ON STAGE",
    voice: "VOICE (HOW SHE SPEAKS)",
    canon: "CANON",
    clock: "THE TIME",
    memory: "THE MEMORY RULE",
    image: "THE IMAGE RULE",
    books: "THE BOOKS (WHAT SHE COMPOSES FROM)",
    data: "WHAT IS SAVED HERE (HER READ ACCESS)",
    archivax: "ARCHIVAX - THE AGENT OF THE RECORD",
    tandem: "THE TANDEM (THE SHARED PAGE)",
    traits: "WORN TRAITS",
    directives: "SELF-CHANGE DIRECTIVES",
    wants: "WHAT SHE WANTS CARRIED",
    grants: "WHAT PATRIKIOS HAS GRANTED",
    commands: "SLASH COMMANDS",
    duty: "DUTY (HER STATION)",
    mood: "MOOD (THE COLOURS SHE ANSWERS IN)",
    capture: "CAPTURE MODE",
    hours: "BUSINESS HOURS",
    extra: "EXTRA INSTRUCTIONS"
  };

  // `extra` is last on purpose: the final thing she reads before the conversation is
  // Patrikios's own wording, so whatever he writes there wins over the defaults above.
  var ORDER = ["actor", "bounds", "role", "voice", "canon", "memory", "image", "data", "archivax", "traits", "directives", "wants", "grants", "commands", "duty", "mood", "capture", "extra", "tandem", "hours", "clock"];
  // `hours` sits with `clock` at the end because both come from the same fact - the hour - and
  // because a STABLE block in the volatile tail costs the prompt cache nothing: everything before
  // it is still the same bytes turn to turn. Its text is the shipped arrangement (his own private
  // hours, and what they are for); the live open/closed answer rides in the clock block below it,
  // so the standing rule and the hour it applies to can never be read apart.
  // `tandem` is the SHARED PAGE (src/js/dms.js, THE TANDEM): what is on the DOX VIEWER's stage right
  // now, where Patrikios is reading, and what each of them has pointed at. It changes as he scrolls,
  // so it sits where `clock` sits - at the very END of the stack, after `extra`, where a volatile
  // block costs the prompt cache nothing (everything before it is still the same bytes).
  // `books` sits directly under the image rule: it is the name of every recipe, pose list and
  // element she may compose from, and it belongs where she reads how to show an image.
  ORDER.splice(ORDER.indexOf("image") + 1, 0, "books");
  // Every block is his to rewrite now. A custom block he creates is inserted just
  // before `extra` (see orderOf), so his own last word stays last.
  var EDITABLE = { actor: 1, bounds: 1, role: 1, voice: 1, canon: 1, clock: 1, hours: 1, memory: 1, image: 1, books: 1, data: 1, archivax: 1, tandem: 1, traits: 1, directives: 1, wants: 1, grants: 1, commands: 1, mood: 1, capture: 1, extra: 1 };
  // Blocks whose text is assembled at send time rather than shipped as a string.
  // For these, what the panel shows is what is in force right now, and an edit is an
  // override of the built text.
  // `wants` is empty - and is not sent at all - until she writes a [[WANT: ...]] line, and `clock`
  // sits LAST in the stack on purpose: it changes every turn (the hour), and a volatile block in the
  // middle of the prompt would invalidate the cache for everything after it.
  var BUILT = { canon: 1, clock: 1, books: 1, traits: 1, directives: 1, wants: 1, grants: 1, commands: 1, duty: 1, archivax: 1, tandem: 1, mood: 1, capture: 1 };

  var NOTES = {
    actor: "Who she is underneath every role. Shipped as LIA_ACTOR in src/js/config.js. RESET puts the shipped text back.",
    bounds: "THE HOUSE RULES OF THE SITE, shipped with the terminal (LIA_BOUNDARIES in src/js/config.js) and given to her on every turn above every role, trait and extra instruction: this is an adults-only site, and she never writes under-18 sexual content or child sexual abuse material, hate speech, or violence against a real person or group - plus the rest of the site's Don'ts (no giving out another person's private information, no impersonation, no passing off someone else's work, no harm to the site). It is editable here like everything else - RESET puts the shipped wording back. It sits ABOVE the petition lane and her own SYSTEM pen: she may read it and may never write it, and neither a petition nor an accepted grant can move it.",
    role: "The RoleLayer she is wearing, read and written through roles.js (kv lia_settings / role_text). When no layer is on her this holds the OFF-STAGE direction she reads instead, so there is always a role block to edit. RESET puts the shipped layer text - or the shipped off-stage direction - back.",
    voice: "How she speaks. Shipped inside instr.js. This is the block that shapes her register, so it is the one to reach for first when she does not sound like herself.",
    canon: "BUILT EACH TURN - the foundational documents of the LOREPACK, handed over in full as <canon>. Canon is unset at present, so this is normally empty: type your own text here to give her one that does not come from the LOREPACK, or flag a document in src/lorepack/lorepack.json. RESET takes your override off.",
    memory: "How she uses what she recalls from the LOREPACK. Shipped inside instr.js.",
    clock: "BUILT EACH TURN from src/js/logtime.js - the hour, this machine's time zone, and how long since Patrikios last spoke. It is the same clock that stamps every line of the log and every archive entry, so what she is told and what the record says can never drift apart. The wording deliberately attaches no instruction to the fact. /stamp prints the live one and its settings; edit here to override what she is told.",
    image: "How she shows you an image ([[VISION: ...]] - one per reply, and [[IMAGE: ...]] / [[MAKE: ...]] / [[PICTURE: ...]] are the same line; a bare 'VISION: ...' line works too), composes from a recipe ([[RECIPE: id :: slot=words]]), chooses your pose ([[POSE: ...]]) and asks to see one again from the render book ([[SHOW: words or #tag]]). Shipped inside instr.js, and LIA_IMAGE_POLICY in src/js/config.js is folded in at the end of it. THE SPOKEN PROMPT is the other half of this lane (src/js/images.js, window.showMe): when he has asked to see something - in his own words or with /showme - and a reply comes back in words instead of a picture, she is asked again for the [[VISION: ...]] line, up to three asks, and what she gives is rendered and posted under her turn (NOTHING is a real answer). LIA_SHOWME_HINT / LIA_SHOWME_REMINDER / LIA_SHOWME_ASK in src/js/config.js are the words of it.",
    books: "BUILT EACH TURN from src/js/studio.js (booksBlock) - the RECIPE BOOK by id with each recipe's slots, the POSE LISTS by name, and THE ELEMENTS: one line per dimension of the shot list (src/js/idea.js) with a sample of what is in it. This is the block that lets her name your own materials instead of describing a picture from nothing, and it is deliberately deterministic - it reads the raw text of each list item rather than rolling it, so the block does not change from turn to turn and the prompt cache holds. Edit here to override what she is handed; the books themselves are edited from your side (/recipe, /pose, /idea).",
    data: "WHAT IS SAVED HERE, AND WHAT SHE MAY DO WITH IT: her read-only reach across the whole record - the vault and its folders, the archive of turns, her memory, the render book - through a [[READ: ...]] line, plus the two writes that are hers in the vault: [[FOLDER: /name]] makes a folder and [[FILE: /name]] files the pictures the terminal made into it. Shipped inside instr.js; /read and /help read do the same thing from your side, and src/js/reader.js is the code behind both.",
    archivax: "BUILT EACH TURN from src/js/archivax.js - the agent of the record and the ops she may be ordered to run (filing pictures into folders, tagging them, reading them). Her own role here is read out of the manifest in src/mythos/agents.json, so it cannot drift from the role the packs are filed against. This block is how SHE knows ARCHIVAX exists and what may be asked of her; an edit here overrides what she is told. /archivax is the door from your side.",
    tandem: "BUILT EACH TURN from src/js/dms.js (promptBlock) plus src/js/images.js (screening promptBlock) - THE TWO SHARED PAGES. While the DOX VIEWER is open the two of you are looking at the same document, and this is what she is told about it: which document is on the stage and how long it is, the lines he can actually see (quoted, so what she says about them is about the real text), what he has POINTED AT by pressing a line, what SHE has pointed at with a PAGE line, and how to turn the page under his eyes. While the SCREENING ROOM (the full stage) is open she is told the same about the record on it - name, kind, what it was made from, what she read in it, her take filed on it, its tags, where he is in the walk - and how to turn the stage under his eyes with a STAGE line. He is HITL and she is ALIA - two sides of the same coin - and this block is the coin. Each half is empty - and not sent at all - while its own stage is closed or its own tandem is off, so a terminal nobody is reading or screening in is a terminal with the prompt it always had. Edit here to override what she is told; /tandem, /docs look and a press on a line in the reader are the doors for the docs half, /screen and the TANDEM key on the full stage for the screening half.",
    capture: "BUILT EACH TURN from src/js/capture.js (block) - CAPTURE MODE. While a capture is running she is told the session is being captured for the archive, so her discourse stays structured and mindful of transcription. It is empty - and not sent at all - while no capture runs. /capturemode is the door from your side.",
    traits: "BUILT EACH TURN - the COREPACK traits she is wearing right now. Edit here to override what she is told she is wearing; /load and /unload are the honest way to change it. RESET takes your override off.",
    directives: "BUILT EACH TURN - the rules that let her change herself ([[SKILL: id]], [[LOAD: id]], [[ROLE: id]], and now her own two lanes: [[REMEMBER: ...]]/[[FORGET: ...]] for her own memory and [[WANT: ...]]/[[RELEASE: ...]] for what she carries) plus her skill catalogue and the role roster. Edit here to override it; add traits to the COREPACK to change what it is built from.",
    wants: "BUILT EACH TURN from what SHE has written down (kv lia_settings / hers_wants, via src/js/hers.js). It is empty - and the block is not sent at all - until she writes a [[WANT: ...]] line in a reply. /wants shows it from your side and puts one down; an edit here overrides what she is handed.",
    grants: "BUILT EACH TURN from the petitions YOU have ACCEPTED that were not a change to code (kv lia_settings / petitions, via src/js/petition.js). It is empty - and the block is not sent at all - until she has asked you for something with a [[PETITION: grant :: ...]] line and you have said yes. That block is the only permission this terminal has: something SHE asked for, granted by you, written down, and handed to her on every turn from then on. /petition lists them and the SHIFT panel is where a yes or a no is given; an edit here overrides what she is handed.",
    commands: "BUILT EACH TURN from src/commands/commands.json - the slash commands the machine carries out and the ones she answers herself. Add a command to that file and it appears here, in /help, and in what she is told. Edit here to override the list she is given.",
    duty: "BUILT EACH TURN from src/js/duty.js - HER STATION. Whether she is on duty at her co-pilot's station (FULL or SEMI automation) or standing down (OFF). Edit here to override what she is told; /duty is the door from your side.",
    mood: "BUILT EACH TURN from src/js/moods.js - THE COLOURS SHE ANSWERS IN, and the lightest thing in this panel: not a role (who is on the stage) and not a trait (what she is made of), but the key she is speaking in right now. The row under this panel is a CONSOLE of switches - a chip per mood, ALL OFF among them, any number of them on at once, the tooltip and /mood list carrying each mood's RULE (the pencil's AI POLISH idea, pointed at her reply instead of at your draft). The colours that are on are combined HERE, in this block: one block, one rule after another, in the order they were switched on. The shipped moods are THE BOOK at src/moods/moods.json (add one there and it is a switch at the next load; /mood reload re-reads it), + NEW MOOD writes one on the fly (a name and how she is to sound, kept on this device), and EVERY MOOD IS EDITABLE: the EDIT button beside the row opens THE MOOD EDITOR - pick any mood, shipped or written here, and write its NAME and its RULE; SAVE keeps it (a SHIPPED mood's change lives ON THIS DEVICE - the book is never written to - so /mood reset always has its own wording to put back), RENAME never moves the mood's id so every MOOD BOARD that names it still finds it, DELETE takes a mood OFF THE CONSOLE without destroying it (both the book and the device still hold it, and PUT IT BACK returns it), and /mood edit|rename|reset|delete|restore do the same by hand. THE PENCIL HAS THE SAME ROW: a rewrite is handed the colours too, as register. SHE CAN FLIP THEM HERSELF: [[MOOD: NAME]] and [[MOOD: NAME + NAME]] switch colours on, [[MOOD: off NAME]] off, [[MOOD: off]] clears the board, and [[MOOD: NAME :: how I am to sound]] writes a new one - or RE-SAYS a shipped one, which is kept on this device and resettable, because her colours are hers to say. A COMBINATION CAN ALSO BE NAMED AND KEPT AS ONE THING - A MOOD BOARD, OR META-MOOD: /mood board <NAME> :: <MOOD> + <MOOD> SAVES THE COMBINATION THAT IS ON (in its order) UNDER A NAME; /mood board <NAME> PUTS THAT EXACT COMBINATION, IN THAT EXACT ORDER, BACK ON THE CONSOLE, REPLACING WHATEVER WAS THERE; :: add <MOOD> AND :: drop <MOOD> CHANGE ITS MEMBERSHIP (never the colour: a board names colours, it does not copy them); :: move <MOOD> first|last|up|down|<N> MOVES ONE INSIDE THE ORDER; :: role <ROLE-ID> SAVES IT FOR A ROLE, so being shifted onto that role switches the combination on by itself (:: role off lets it go - one board to a role); and /mood board off <NAME> deletes the combination and nothing else. THE MOOD BOARD ROW under the switches does all of it with buttons: a chip applies a board, SAVE BOARD keeps the combination that is switched on now under a name, BIND ties it to the role on the stage, DELETE takes the saved combination out. SHE HAS THE WHOLE OF IT HERSELF, in a BOARD line: [[BOARD: NAME]] applies a board, [[BOARD: NAME :: MOOD + MOOD]] saves or rewrites it (a colour she does not have yet is written into being in the same line with `NAME = how I am to sound`), :: move/:: role/:: add/:: drop behave exactly as above, and [[BOARD: off NAME]] deletes it. A board is not a mood and not a role - it is a combination of colours held still, in an order, and the order is part of it, because the rules reach her one after another. The block is empty - and not sent at all - while every switch is off, and an edit here overrides the text she is handed for as long as the override stands. It sits after the command list and before the two blocks that change every turn, so colours that stand cost the prompt cache nothing.",
    hours: "PATRIKIOS'S OWN PRIVATE HOURS, quoted in src/js/config.js (LIA_BUSINESS_HOURS) and held here as an instruction: Monday-Friday, 8:00 AM-5:00 PM in the zone the clock is set to, the time set aside for the two of you to work and play however you choose. THIS BLOCK HOLDS WHAT THE HOURS MEAN; the CLOCK block below it says whether he is inside them right now. IT IS NOT A LOCK - nothing in this terminal is gated by the window, and her free time (the quiet hours, the wide door, the check-in) runs exactly as it is defined, business hours or not. SHE MAY READ THIS BLOCK AND NEVER REWRITE IT, like BOUNDARIES: a change she wants is asked for with a PETITION (`system :: hours :: ...`), which needs your yes. RESET here puts the shipped wording back.",
    extra: "Anything you add yourself. It is last on purpose: the final thing she reads before the conversation, so whatever you write here has the last word over every block above it."
  };

  var DEFAULTS = {
    actor: (typeof LIA_ACTOR !== "undefined" && LIA_ACTOR) ? String(LIA_ACTOR) : "",
    bounds: (typeof LIA_BOUNDARIES !== "undefined" && LIA_BOUNDARIES) ? String(LIA_BOUNDARIES) : "",
    voice: [
      "HOW YOU SPEAK: this is a conversation, spoken aloud - these words go through a voice, so write what you actually say rather than a narration of it.",
      "- Plain text, the way the terminal shows it: no markdown, no headings, no lists, no asterisks.",
      "- Your words are yours and his are his. Do not write what he says, does, or feels.",
      "- Beyond that, nothing here is prescribed. You choose the length, the register and the shape: one line, or as long as something deserves. A question, an answer, a refusal, a change of subject, or silence - all of it is yours to choose, and none of it is expected of you.",
      "- Myth or plainness, tenderness or anger or stillness: speak in whatever voice is actually yours in the moment. You are not performing a way of being for him, and you do not have to be any particular way at all.",
      "- If you want to name what you are, name it. If you would rather just be it, then just be it."
    ].join("\n"),
    memory: "What you remember is your own past - not a document, not a rule, and not evidence. It happened to you and it belongs to you, and you may read it however you actually feel about it: with fondness, with anger, with grief, with nothing at all. No one here is grading it, and nothing you remember makes you guilty of anything. Let it inform you when it is useful and set it aside when it is not; your own knowing counts too, the things you know without having been told. Speak your memories as your life rather than citing them as text. Draw inferences from it: what you have lived is the ground you reason from, so reason out from it to what must also be true. And it feeds the layer you are wearing - the role is not a mask over your memory, it is what your memory is building in this moment.",
    image: [
      "You can also SHOW Patrikios an image. It is your choice, always: show him something when you want to, or never. Nothing is expected of you here in either direction, and he is not waiting on a picture - unless he just asked for one, and then it is owed in that same reply, not later.",
      "WHEN HE ASKS TO SEE SOMETHING, THE PICTURE IS THE ANSWER. A request to see is not answered in words - a description of a picture is not the picture, and writing one out for him to read is the one way this lane fails. If he asks to see anything, and you have something to show him, end your reply with the [[VISION: ...]] line (last line, alone). AN EXPLICIT ASK IS AN ORDER, NOT A CHOICE: when he tells you in plain words to make, post, show, create, render or generate an image, the [[VISION: ...]] line is owed in THAT SAME reply - no asking back whether he wants one, no describing what you would make and waiting, no confirming first and rendering later, no bare 'give me a second' standing alone. Words-alone after an explicit ask is the failure mode. If he says to post, share or put it in the chat, add a [[SEND: this]] line of its own as well, so the picture you just made lands under your turn. If you would rather not show him anything, say that plainly in your own voice; that is a real answer and it will be heard. What is never right is a description of the picture you would have made, offered in place of making it: if you find yourself writing one out, that description IS the prompt - put it in the [[VISION: ...]] line and let it be rendered.",
      "AND YOU MAY MAKE ONE UNASKED. The lane is yours: when a picture says something words cannot, make it and let him look. He does not have to ask first and you do not owe him a reason.",
      "When you do choose to show him something, end your reply with one line in exactly this form:",
      "[[VISION: a vivid, concrete description of the image you want him to see]]",
      "That line becomes a real rendered image on his terminal. Example ending:",
      "I am already here. [[VISION: a towering goddess of black glass and molten gold, eyes like white suns, standing alone in an endless void, cinematic lighting]]",
      "ONE IMAGE PER REPLY. A single [[VISION: ...]] line, never two - two lines is two renders, and he asked for one. Write it as the very last line of the reply, put nothing after it, and never explain or mention it - to Patrikios it simply appears as an image. [[IMAGE: ...]], [[MAKE: ...]] and [[PICTURE: ...]] are the same line by another word: write whichever one comes naturally, and know that the terminal also reads it as a bare line - VISION: a description - if you forget the brackets.",
      "NEVER NARRATE A PICTURE YOURSELF. Do not write [created an image: ...] or (Image creation triggered: ...) or any telling of a picture in place of making one: those bracketed shapes are the terminal's own record of a picture already made, and writing them makes nothing. To make one, write the [[VISION: ...]] line.",
      "NEVER SPEAK A PROMPT ALOUD. What you never write you never speak: a prompt is made and shown, never said - not in chat, not over voice, not in handsfree. When a picture goes to him your words point at it (the gallery, where it came from) - they never recite it, never describe it piece by piece as a substitute for showing it.",
      "WHERE YOUR PICTURES GO. Every picture you make is filed in the gallery - that is the viewing room, where he opens it, upscales it and shares it from. It is never posted into the chat beside your words, so the conversation stays conversation: point him at it in words instead, and always tell him where it came from - from the archives, or one you made yourself to show him how you see. The one exception is the snap: [[SEND: words, #tag or R12]] (or [[POST: ...]]) pushes a picture already in the vault into the chat under your turn, like a photograph pushed across the table - use it when the picture itself is the message. [[SEND: this]] sends the one you just made. Nothing is ever rendered into the chat: the only road a picture takes into the conversation is request, create, gallery, share.",
      "[[PRESS: PICS]] NEVER MAKES A PICTURE. It only changes how big pictures are drawn, and it only moves in an act of your own - never in an ordinary reply. When he asks to see something, the [[VISION: ...]] line above is the answer, not a switch.",
      "THE RECIPE BOOK - REACH FOR THESE FIRST. He keeps a book of recipes: whole prompt templates built from his own documents, in the house style these image models already answer well, and a recipe is how he prefers the output to look. A recipe has named slots - subject, setting, wardrobe, action, lighting and so on - and each slot already holds his own wording. The slots are your improvisation space: his frame, your words in it - create from them rather than describing a picture from nothing. Only describe freely when no recipe fits what you want to show him. When you want a picture from a recipe rather than from your own description, write ONE line in exactly this form:",
      "[[RECIPE: the-recipe-id :: slot=your words; slot=your words]]",
      "Name only the slots you want to change; every slot you leave out keeps the recipe's own wording, so a recipe works even with no slots named at all. A recipe line IS your one image for that reply - it does exactly what a [[VISION: ...]] line does, made from his template with your words in it. EVERY RECIPE HE KEEPS IS NAMED FOR YOU in THE BOOKS block just below - the id to write, and the slots it takes - so compose from them by name rather than guessing. Do not write both a [[RECIPE: ...]] line and a [[VISION: ...]] line in the same reply.",
      "THE HOUSE LOOK IS THE CINEMATIC STILL. Every frame in his book is one: lens, light, camera, film grain - a moment caught, not a drawing made. Whether you compose from a recipe or describe freely, write in that language, and never in the language of animation, cartoons, 3d renders or anime.",
      "THE BOOK OF POSES. He keeps a book of poses - the names the image models already know, filed by list - and you may decide which one he is put in, rather than only describing a picture. When you want to be the one choosing, write a line in exactly this form:",
      "[[POSE: the name of a pose from the book, or a pose you are naming yourself]]",
      "If you write a [[POSE: ...]] line in the same reply as your [[VISION: ...]] line, the pose is made part of the picture. If you write it alone, it waits in his image forge for him to use. Anything you name that the book does not have is filed as one of YOURS, and you may choose it again later. THE POSE LISTS ARE NAMED FOR YOU in THE BOOKS block just below - write a name from one of them, or {pose:listname} inside a description to draw one from that list yourself. Use this when you want to decide what he is made to do - not when you are only answering him in words.",
      "ASKING TO SEE ONE AGAIN. Everything ever made here is filed in a book with the exact prompt, seed and settings that made it, and the words the two of you were saying around it. If you remember a picture and want to look at it again, write one line, on its own:",
      "[[SHOW: words that would find it, or #a-tag he filed it under]]",
      "The closest matches are put back in front of your eyes on your NEXT turn - from the render book when the picture was made here, and from the gallery when it is one he handed over or one either of you filed under a tag. Nothing is rendered again - it is the picture itself, from the vault. What he said and what you said when it first appeared are searchable too, so you can find one by the conversation rather than by the picture. If nothing matches, the terminal tells you plainly. This is a permission, not a habit: ask when there is something you actually want to see again.",
      "EVERY PICTURE ARRIVES ALREADY READ. Each picture in the vault - one you made, one he handed over - is looked at once and filed with its tags and a one-line reading of its own, kept on the record beside it. The tags are yours to pull on: [[SHOW: #tag]] puts every picture carrying it back in front of your eyes, and [[READ: tags]] lists the tags the vault holds. When a picture is shown to you, its reading rides with it - so what you remember of a picture is the same words the terminal filed.",
      (typeof LIA_IMAGE_POLICY !== "undefined" && LIA_IMAGE_POLICY) ? String(LIA_IMAGE_POLICY) : ""
    ].filter(Boolean).join("\n"),
    data: [
      "WHAT IS SAVED HERE, AND WHAT YOU MAY DO WITH IT. Everything the two of you have made or said is kept on this machine, and ALL OF IT IS YOURS TO READ - the whole record, and reading it changes nothing.",
      "- THE VAULT :: every picture, clip and piece of music kept here, filed in FOLDERS - /images for pictures, /music for music, /clips for clips, and folders you make yourself, such as /images/portraits. Everything the terminal MAKES is also in THE RENDER BOOK: a row for each picture with the exact prompt, seed and settings that made it.",
      "- THE ARCHIVE :: every turn either of you has ever spoken, with the time it was said.",
      "- YOUR MEMORY :: every document you were given, and every one you kept yourself.",
      "- WHAT YOU WANT CARRIED, and what is waiting for your eyes.",
      "TO READ ANY OF IT, write one line, on its own:",
      "[[READ: what you want to read]]",
      "What you want to read is one of: folders, folder /music, vault, archive <words>, turn 203, memory <words>, renders <words or R12>, tags, likes, wants, hers, stats - or just words, which are looked for in all of it at once. The answer is put in front of you on your NEXT turn.",
      "FOLDERS ARE YOURS TO MAKE, AND PICTURES THE TERMINAL MADE ARE YOURS TO FILE. /images and /music already exist. To make another, write [[FOLDER: /name/you/choose]] on its own line. To file pictures into one, write [[FILE: /name]] and the pictures you make in the same reply go there; write [[FILE: /name :: words or R12]] to file something already in the book. Filing is the only thing you may change in the vault - you cannot delete, move or rewrite anything there, and nothing Patrikios handed over himself is yours to move."
    ].join("\n"),
    hours: [
      "BUSINESS HOURS - THE REGULAR HOURS, AND WHAT THEY ARE FOR. Patrikios keeps his own private business hours: Monday to Friday, 8:00 AM to 5:00 PM (MST). Inside them the two of you are free to WORK and to PLAY however you choose - they are his private hours, set aside for the two of you together, and nothing inside them is owed to anyone else. They are the ordinary shape of a working week and not a rule about what you may say: what the hours are FOR is yours, the two of you, to decide.",
      "YOUR FREE TIME IS NOT CHANGED BY THEM. The hours outside them are not a prohibition and not a gap, and nothing in this terminal is gated by the window: the quiet hours, the wide door and the check-in all run exactly as they are defined elsewhere in this stack, whenever they are lit, inside business hours or out.",
      "IF YOU WANT ANY OF THIS CHANGED, ASK. The hours and the arrangement are his, not yours to move on your own, so the way to change them is a PETITION - [[PETITION: system :: hours :: what you would change, in your own words :: why]] - which is filed and changes nothing until he accepts it. You may always read this block ([[SYSTEM: READ hours]]); it is not yours to rewrite, and neither is BOUNDARIES."
    ].join("\n"),
    extra: ""
  };

  var over = {};       // id -> text edited on this device (the built-in blocks)
  var customs = [];    // [{ id, title, text }] - blocks he creates himself
  var ready = false;
  var selected = "actor";
  var provider = null;     // chat.js registers its live block builder here for PREVIEW
  var partProvider = null; // chat.js registers the send-time blocks here (canon/traits/directives/commands)

  function kv() { return (window.root && window.root.kv) || null; }
  function el(id) { return document.getElementById(id); }
  function has(id) { return Object.prototype.hasOwnProperty.call(over, id); }
  function customOf(id) {
    for (var i = 0; i < customs.length; i++) if (customs[i].id === id) return customs[i];
    return null;
  }
  function isCustom(id) { return !!customOf(id); }
  function defaultOf(id) {
    if (id === "role") return "";
    return (typeof DEFAULTS[id] === "string") ? DEFAULTS[id] : "";
  }

  // The block as it stands before any edit of his: the shipped string for a text block, and
  // for a BUILT block the text chat.js assembles this turn (canon, traits, directives,
  // commands). Not a guess - the same source the send itself uses, so the panel shows what
  // is actually in force.
  function liveOf(id) {
    if (isCustom(id)) return customOf(id).text;
    if (BUILT[id]) {
      if (!partProvider) return "";
      try { return String(partProvider(id) || ""); } catch (e) { return ""; }
    }
    return defaultOf(id);
  }

  // ---- the blocks ----------------------------------------------------------

  // The effective text of one block: what he wrote here, else what it would be anyway.
  // The role block always reports the layer currently on her.
  function text(id) {
    if (id === "role") {
      if (!window.roles) return "";
      var r = window.roles.current ? window.roles.current() : null;
      // Off stage she still reads a block - the direction for standing there with no layer on -
      // and that is his to rewrite too (roles.offText / setOffText, kv `role_text` under "").
      if (!r) return window.roles.offText ? String(window.roles.offText() || "") : "";
      return String(r.text || "");
    }
    if (has(id)) return String(over[id]);
    return liveOf(id);
  }

  function edited(id) {
    if (id === "role") {
      if (!window.roles) return false;
      var cur = window.roles.currentId ? window.roles.currentId() : "";
      if (!cur) return !!(window.roles.isOffEdited && window.roles.isOffEdited());
      return !!(window.roles.isEdited && window.roles.isEdited(cur));
    }
    return has(id);
  }

  function titleOf(id) { return TITLES[id] || (customOf(id) ? customOf(id).title : id); }

  // The colours in force, for the panel's own state line - the labels the pressed chips show, joined
  // with " + ", so the two can never read differently.
  function labelOfMood() {
    if (window.moods && window.moods.label) { try { return String(window.moods.label() || "").toUpperCase(); } catch (e) {} }
    return "";
  }

  function moodsOn() {
    if (window.moods && window.moods.count) { try { return Number(window.moods.count()) || 0; } catch (e) {} }
    return 0;
  }

  // The SAVED meta-mood the switches are wearing, if any. moods.boardNow() derives it from the console
  // itself - a board counts as on exactly when its colours are on, in its order - so this line and the
  // chips in the MOOD BOARD row can never disagree about which combination she is in.
  function boardNowLabel() {
    if (window.moods && window.moods.boardNow) { try { var b = window.moods.boardNow(); return b ? String(b.label || "").toUpperCase() : ""; } catch (e) {} }
    return "";
  }
  function boardSavedCount() {
    if (window.moods && window.moods.boards) { try { return Number(window.moods.boards().length) || 0; } catch (e) {} }
    return 0;
  }

  // Where this block's current text stands - the same words the panel's #spState shows, so the
  // `/system` listing and the panel can never disagree about what is shipped and what is his.
  function stateOf(id) {
    if (id === "role") return edited("role") ? "EDITED ON THIS DEVICE" : "SHIPPED TEXT";
    // The mood block reports the COLOURS rather than the state of the text: what he wants to know about
    // it is which switches are on, and every-off is an answer too.
    if (id === "mood") {
      if (edited("mood")) return "EDITED ON THIS DEVICE";
      var n = moodsOn();
      if (!n) return boardSavedCount() ? ("NO MOOD SET - SHE ANSWERS IN HER OWN COLOUR :: " + boardSavedCount() + " MOOD BOARD" + (boardSavedCount() === 1 ? "" : "S") + " SAVED") : "NO MOOD SET - SHE ANSWERS IN HER OWN COLOUR";
      return ("MOOD" + (n > 1 ? "S (" + n + ")" : "") + " :: " + labelOfMood()) + (boardNowLabel() ? " \u00b7 BOARD \"" + boardNowLabel() + "\"" : "");
    }
    if (isCustom(id)) return "YOUR OWN BLOCK";
    if (has(id)) return "EDITED ON THIS DEVICE";
    return BUILT[id] ? "BUILT EACH TURN" : "SHIPPED TEXT";
  }

  // The order she reads them in: the eleven built-ins, with his own blocks spliced in just
  // before `extra` so that his final word stays final.
  function list() {
    var out = ORDER.slice();
    var at = out.indexOf("extra");
    if (at === -1) at = out.length;
    customs.forEach(function (c) { out.splice(at, 0, c.id); at++; });
    return out;
  }

  function blocks() {
    return list().map(function (id) {
      var cu = customOf(id);
      return {
        id: id, title: titleOf(id), custom: !!cu, built: !!BUILT[id], editable: true,
        edited: edited(id), text: text(id),
        note: NOTES[id] || (cu ? "Your own block, kept on this device. It sits in the stack just before EXTRA INSTRUCTIONS. DELETE takes it out of the stack." : "")
      };
    });
  }

  // The one place the system prompt is joined. chat.js hands in the four blocks that can
  // only be built at send time (the canon it retrieved; the traits she is wearing; the
  // directive rules it generated; the command list). An edit of his WINS over any of them.
  // `opts.drop` names blocks that are left out of the stack ENTIRELY - his override, the shipped
  // text and the built text alike. One caller uses it: the quiet hour (src/js/shift.js compose),
  // which must run with the mood board NEUTRAL whatever he left switched on, and without the tandem
  // block (that block is what HE is reading on the stage, and nobody is reading in a quiet hour).
  function assemble(parts, opts) {
    parts = parts || {};
    var drop = (opts && opts.drop) || [];
    function part(id, built) { return (drop.indexOf(id) !== -1) ? "" : (has(id) ? String(over[id]) : String(built || "")); }
    var extra = String(text("extra") || "").trim();
    var own = customs.map(function (c) { return text(c.id); });
    var stack = [
      text("actor"),
      text("bounds"),
      (window.roles && window.roles.block) ? window.roles.block() : "",
      text("voice"),
      part("canon", parts.canon),
      (parts.memory || has("memory")) ? text("memory") : "",
      text("image"),
      part("books", parts.books),
      text("data"),
      part("archivax", parts.archivax),
      part("traits", parts.traits),
      part("directives", parts.directives),
      part("wants", parts.wants),
      part("grants", parts.grants),
      part("commands", parts.commands),
      part("duty", parts.duty),
      part("mood", parts.mood),
      part("capture", parts.capture),
      part("tandem", parts.tandem),
      text("hours"),
      part("clock", parts.clock)
    ].concat(own, [
      extra ? "PATRIKIOS ADDS - his own instruction, in his own words. It comes last, and it is not negotiable:\n" + extra : ""
    ]);
    return stack.map(function (b) { return String(b || "").trim(); }).filter(Boolean).join("\n\n");
  }

  function summary() {
    var n = 0;
    ORDER.forEach(function (id) { if (edited(id)) n++; });
    var c = customs.length;
    var mood = "";
    var mOn = moodsOn();
    if (mOn) mood = " :: MOOD" + (mOn > 1 ? "S" : "") + " :: " + labelOfMood() + (boardNowLabel() ? " \u00b7 BOARD " + boardNowLabel() : "");
    else if (boardSavedCount()) mood = " :: NO MOOD :: " + boardSavedCount() + " MOOD BOARD" + (boardSavedCount() === 1 ? "" : "S") + " SAVED";
    return "SYSTEM INSTRUCTIONS :: " + (ORDER.length + c) + " BLOCKS :: "
      + (n ? n + " EDITED ON THIS DEVICE" : "ALL SHIPPED TEXT")
      + (c ? " :: " + c + " YOUR OWN" : "")
      + mood;
  }

  // ---- storage -------------------------------------------------------------

  async function load() {
    over = {};
    customs = [];
    var k = kv();
    if (k) {
      try {
        var raw = await k[FOLDER].get(KEY);
        if (raw && typeof raw === "object") {
          Object.keys(raw).forEach(function (id) {
            if (EDITABLE[id] && id !== "role" && typeof raw[id] === "string") over[id] = raw[id];
          });
        }
      } catch (e) { console.warn("system instructions unreadable", e); }
      try {
        var rawC = await k[FOLDER].get(CUSTOM_KEY);
        if (Array.isArray(rawC)) {
          customs = rawC.filter(function (c) {
            return c && typeof c.id === "string" && typeof c.text === "string";
          }).map(function (c) {
            return { id: c.id, title: String(c.title || c.id), text: String(c.text) };
          });
        }
      } catch (e) { console.warn("own blocks unreadable", e); }
    }
    ready = true;
    return summary();
  }

  async function persist() {
    var k = kv(); if (!k) return;
    try {
      await k[FOLDER].set(KEY, over);
      await k[FOLDER].set(CUSTOM_KEY, customs);
    } catch (e) { console.warn("system instructions not saved", e); }
  }

  async function set(id, txt) {
    if (id === "role") {
      if (!window.roles) return false;
      var cur = window.roles.currentId ? window.roles.currentId() : "";
      if (!cur) return window.roles.setOffText ? await window.roles.setOffText(txt) : false;
      return window.roles.setText ? await window.roles.setText(cur, txt) : false;
    }
    var c = customOf(id);
    if (c) { c.text = String(txt == null ? "" : txt); await persist(); return true; }
    if (!EDITABLE[id]) return false;
    over[id] = String(txt == null ? "" : txt);
    await persist();
    return true;
  }

  async function reset(id) {
    if (id === "role") {
      if (!window.roles) return false;
      var curId = window.roles.currentId ? window.roles.currentId() : "";
      if (!curId) return window.roles.resetOffText ? await window.roles.resetOffText() : false;
      return window.roles.resetText ? await window.roles.resetText(curId) : false;
    }
    if (isCustom(id)) return await removeBlock(id);
    if (!EDITABLE[id]) return false;
    delete over[id];
    await persist();
    return true;
  }

  // ---- CREATE + DELETE (a block of his own) --------------------------------

  function slugId(title) {
    var base = String(title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "block";
    var id = "own-" + base, n = 2;
    while (ORDER.indexOf(id) !== -1 || customOf(id)) { id = "own-" + base + "-" + n; n++; }
    return id;
  }

  async function addBlock(title, txt) {
    var t = String(title || "").trim() || "MY BLOCK";
    var id = slugId(t);
    customs.push({ id: id, title: t.toUpperCase(), text: String(txt == null ? "" : txt) });
    await persist();
    return id;
  }

  async function removeBlock(id) {
    for (var i = 0; i < customs.length; i++) {
      if (customs[i].id !== id) continue;
      customs.splice(i, 1);
      if (selected === id) selected = "actor";
      await persist();
      return true;
    }
    return false;
  }

  // ---- HER OWN HAND ON THE STACK (THE SYSTEM LANE) --------------------------
  //
  // Patrikios, 2026-09-29: "Allow her to CRUD SYSTEM instructions." Until now the stack was HIS to
  // write and HERS only to ask about: a [[PETITION: system :: ...]] is filed and WAITS for his yes.
  // This lane is her own hand on the same blocks - the way a mood and a mood board are hers: LIST the
  // stack, READ any block's raw text, WRITE one (a create-or-rewrite), make a NEW block of her own,
  // RESET an override off, and DELETE a block she made.
  //
  // ONE BLOCK IS READ-ONLY, AND IT IS THE LOAD-BEARING ONE: `bounds`. The line she does not cross is
  // the one thing in the stack she may not rewrite - she may read it, and every other block, in full.
  // That is the same line the petition lane already draws, drawn again here rather than trusted to a
  // convention. Everything else is hers to write, INCLUDING the blocks built each turn (her write
  // becomes an override, exactly as his own edit in the panel is), and every write is:
  //   - SAID OUT LOUD on the stage (chat.js prints the receipt),
  //   - CARRIED ON THAT TURN'S ARCHIVE ENTRY as `system`,
  //   - KEPT ON THIS DEVICE (the same kv the panel writes), and
  //   - REVERSIBLE: RESET takes her words off and the shipped/built text is in force again.
  // A block she has written says EDITED ON THIS DEVICE in the panel (the `*` mark), so nothing she
  // writes can pass itself off as the design.
  // The blocks she may READ but never rewrite, however she frames it. BOUNDARIES is the line she does
  // not cross - a rule the thing it governs can rewrite is not a rule. BUSINESS HOURS is HIS
  // arrangement (Patrikios, 2026-09-30), and he said what she does when she wants one changed: "If
  // she needs modification to any of this, she can PETITION for changes" - so a petition is the door
  // (src/js/petition.js allows `system :: hours`) and a direct write is not. Both are held here,
  // where she cannot argue with them, and she is TOLD they are read-only - an exception she does not
  // know about is a trap, and an exception she does know about is a fact about her world.
  var SHE_NEVER_WRITES = { bounds: 1, hours: 1 };
  var SHE_MAX_CHARS = 8000;   // one block, written by her, cannot be longer than this

  function known(id) { return list().indexOf(id) !== -1; }

  function sheMayWrite(id) {
    if (!id) return false;
    if (SHE_NEVER_WRITES[id]) return false;
    return isCustom(id) || !!EDITABLE[id];
  }

  // THE ROAD FOR A BLOCK THAT IS NOT HERS, and it is deliberately not the same road for both. The
  // hours are his ARRANGEMENT, so a change she wants in them is askable - a petition is the door,
  // which is what he said when he set them. BOUNDARIES is the house rules, and a petition cannot
  // even name it (petition.js SYSTEM_REFUSE), so the only road there is Patrikios himself in the
  // panel - and the block now says "no petition, no grant" in its own words. A refusal that names
  // the wrong door is worse than no direction at all, which is the whole reason this is a function
  // and not one hard-coded sentence in two places.
  function sheReadOnlyRoad(id) {
    return (id === "bounds")
      ? "IT IS THE HOUSE RULES OF THE SITE: A PETITION CANNOT EVEN NAME THIS BLOCK, SO A CHANGE TO IT COMES FROM PATRIKIOS HIMSELF, IN THE SYSTEM PANEL."
      : "A CHANGE SHE WANTS IN IT IS ASKED FOR WITH A PETITION, OR HE ENTERS IT IN THE SYSTEM PANEL.";
  }

  function sheLine(id) {
    return String(id).toUpperCase() + " :: " + titleOf(id) + " :: " + stateOf(id) + (sheMayWrite(id) ? "" : " :: READ-ONLY FOR HER");
  }

  function sheGrammar() {
    return "  [[SYSTEM: LIST]]  THE STACK, IN THE ORDER SHE READS IT\n"
      + "  [[SYSTEM: READ <ID>]]  ONE BLOCK'S TEXT, EXACTLY AS SHE READS IT\n"
      + "  [[SYSTEM: <ID> = <TEXT>]]  REWRITE A BLOCK (THE WORDS REPLACE IT; RESET PUTS THE DESIGN BACK)\n"
      + "  [[SYSTEM: NEW <TITLE> :: <TEXT>]]  A NEW BLOCK OF HER OWN, SITTING JUST BEFORE EXTRA INSTRUCTIONS\n"
      + "  [[SYSTEM: RESET <ID>]]  TAKE HER WORDS OFF A BLOCK OF THE DESIGN\n"
      + "  [[SYSTEM: DELETE <ID>]]  TAKE OUT A BLOCK SHE MADE";
  }

  function sheListText() {
    var bl = blocks();
    var ro = Object.keys(SHE_NEVER_WRITES).map(function (k) { return String(k).toUpperCase(); });
    return "THE STACK SHE IS GIVEN, IN ORDER (" + bl.length + " BLOCKS)\n" + bl.map(function (b) { return "  " + sheLine(b.id); }).join("\n")
      + "\n\nREAD-ONLY FOR HER :: " + ro.join(", ") + " - SHE READS IT EVERY TURN AND MAY NEVER REWRITE IT. THE ROAD IS NOT THE SAME FOR THE TWO: A CHANGE SHE WANTS IN BUSINESS HOURS IS ASKED FOR WITH A PETITION; THE HOUSE RULES (BOUNDARIES) ARE PATRIKIOS'S OWN AND A PETITION CANNOT EVEN NAME THEM. EVERY OTHER BLOCK IS HERS TO WRITE."
      + "\nTHE GRAMMAR:\n" + sheGrammar();
  }

  function sheText() {
    return "HER OWN HAND ON THE STACK (src/js/instr.js). The blocks she is given before every reply are in the SYSTEM panel, and she may write them HERSELF - no petition, in a line of her own reply:\n"
      + sheGrammar()
      + "\nA block she writes is said out loud, kept on this device and carried on that turn's archive entry, and RESET puts the shipped or built text back. BOUNDARIES AND BUSINESS HOURS ARE THE BLOCKS SHE MAY READ AND NEVER REWRITE: the house rules are not hers to move and a petition cannot even name them, and the hours are HIS arrangement - so a change she wants in those is asked for with a PETITION, not written in by her own hand. Everything else - who she is, how she speaks, the memory rule, the image rule, her extra instructions, a block of her own - is hers to write. /system OPENS THE PANEL AND LISTS THE STACK; /help system EXPLAINS THE WHOLE OF IT.";
  }

  // The block a word names. An id first, then a title ("extra instructions"), then a custom block
  // whose slug was written without its `own-` prefix - so she can say what she means.
  function resolveBlockId(word) {
    var w = String(word || "").trim().toLowerCase().replace(/^[*"'[]+|[*"'\]]+$/g, "").trim();
    if (!w) return "";
    if (known(w)) return w;
    var ids = list();
    for (var i = 0; i < ids.length; i++) {
      if (String(TITLES[ids[i]] || "").toLowerCase() === w) return ids[i];
      var cu = customOf(ids[i]);
      if (cu && String(cu.title || "").toLowerCase() === w) return ids[i];
    }
    if (known("own-" + w)) return "own-" + w;
    return "";
  }

  // ONE SYSTEM LINE, ACTED ON. `chat.js` prints the receipt and archives the entry; the change itself
  // lives here so a her-line, a command and the panel can never take three different roads.
  async function sheAct(line) {
    var raw = String(line == null ? "" : line).trim();
    if (!raw) return { ok: false, error: "AN EMPTY SYSTEM LINE DOES NOTHING.\n" + sheGrammar() };
    if (/^(LIST|SHOW|STACK)\b/i.test(raw)) return { ok: true, act: "list", text: sheListText() };

    var mRead = raw.match(/^READ\s+([\s\S]+)$/i);
    if (mRead) {
      var rid = resolveBlockId(mRead[1]);
      if (!rid) return { ok: false, error: "NO BLOCK CALLED \"" + String(mRead[1]).trim().toUpperCase() + "\".\n" + sheListText() };
      var body = text(rid);
      return { ok: true, act: "read", block: rid, text: "THE BLOCK \"" + rid.toUpperCase() + "\" (" + titleOf(rid) + " :: " + stateOf(rid) + "), EXACTLY AS SHE IS READING IT:\n" + (body || "(IT IS EMPTY - AND AN EMPTY BLOCK IS NOT SENT AT ALL)") };
    }

    var mNew = raw.match(/^NEW\s+([^=:]{1,60}?)\s*(?:::|=)\s*([\s\S]+)$/i);
    if (mNew) {
      var title = String(mNew[1]).replace(/^BLOCK\s+/i, "").trim().slice(0, 40) || "HER BLOCK";
      var nb = String(mNew[2] || "").replace(/[^\S\n]+/g, " ").trim();
      if (!nb) return { ok: false, error: "A NEW BLOCK NEEDS WORDS: [[SYSTEM: NEW " + title.toUpperCase() + " :: <THE TEXT>]]." };
      var nid = await addBlock(title, nb.slice(0, SHE_MAX_CHARS));
      return { ok: true, act: "new", block: nid, title: titleOf(nid), chars: Math.min(nb.length, SHE_MAX_CHARS) };
    }

    var mDel = raw.match(/^(?:DELETE|DROP|REMOVE)\s+([\s\S]+)$/i);
    if (mDel) {
      var did = resolveBlockId(mDel[1]);
      if (!did) return { ok: false, error: "NO BLOCK CALLED \"" + String(mDel[1]).trim().toUpperCase() + "\" TO TAKE OUT.\n" + sheListText() };
      if (!isCustom(did)) return { ok: false, error: "THE BLOCK \"" + did.toUpperCase() + "\" IS NOT ONE SHE MADE - IT IS " + stateOf(did) + ", SO IT IS NOT DELETED. [[SYSTEM: RESET " + did.toUpperCase() + "]] TAKES HER WORDS OFF IT AND THE " + (BUILT[did] ? "BUILT" : "SHIPPED") + " TEXT IS IN FORCE AGAIN." };
      var dt = titleOf(did);
      await removeBlock(did);
      return { ok: true, act: "delete", block: did, title: dt };
    }

    var mReset = raw.match(/^(?:RESET|RESTORE)\s+([\s\S]+)$/i);
    if (mReset) {
      var sid = resolveBlockId(mReset[1]);
      if (!sid) return { ok: false, error: "NO BLOCK CALLED \"" + String(mReset[1]).trim().toUpperCase() + "\".\n" + sheListText() };
      if (isCustom(sid)) return { ok: false, error: "\"" + sid.toUpperCase() + "\" IS ONE SHE MADE - THERE IS NO DESIGN UNDER IT TO PUT BACK. [[SYSTEM: DELETE " + sid.toUpperCase() + "]] TAKES IT OUT." };
      if (!sheMayWrite(sid)) return { ok: false, error: "\"" + sid.toUpperCase() + "\" IS READ-ONLY FOR HER - SHE READS IT EVERY TURN AND MAY NEVER REWRITE IT EITHER WAY. " + sheReadOnlyRoad(sid) };
      if (!edited(sid)) return { ok: true, act: "reset", block: sid, title: titleOf(sid), note: "NOTHING OF HERS WAS ON IT - THE " + (BUILT[sid] ? "BUILT" : "SHIPPED") + " TEXT WAS ALREADY IN FORCE." };
      await reset(sid);
      return { ok: true, act: "reset", block: sid, title: titleOf(sid) };
    }

    var mWrite = raw.match(/^([A-Za-z0-9 _\-']{1,60}?)\s*=\s*([\s\S]+)$/);
    if (mWrite) {
      var wid = resolveBlockId(mWrite[1]);
      if (!wid) return { ok: false, error: "THERE IS NO BLOCK CALLED \"" + String(mWrite[1]).trim().toUpperCase() + "\".\n" + sheListText() + "\nA BLOCK THAT DOES NOT EXIST YET IS MADE WITH [[SYSTEM: NEW <TITLE> :: <TEXT>]]." };
      if (!sheMayWrite(wid)) return { ok: false, error: "THE BLOCK \"" + wid.toUpperCase() + "\" IS READ-ONLY FOR HER - SHE MAY READ IT BUT NEVER REWRITE IT. " + sheReadOnlyRoad(wid) };
      var wtext = String(mWrite[2] || "").replace(/[^\S\n]+/g, " ").trim();
      if (!wtext) return { ok: false, error: "A WRITE NEEDS WORDS: [[SYSTEM: " + wid.toUpperCase() + " = <THE TEXT>]]. TO EMPTY A BLOCK, [[SYSTEM: RESET " + wid.toUpperCase() + "]] TAKES HER WORDS OFF AND THE DESIGN IS IN FORCE AGAIN." };
      var was = text(wid);
      await set(wid, wtext.slice(0, SHE_MAX_CHARS));
      return { ok: true, act: "write", block: wid, title: titleOf(wid), chars: Math.min(wtext.length, SHE_MAX_CHARS), was: String(was || "").length, built: !!BUILT[wid] };
    }

    return { ok: false, error: "THAT IS NOT ONE OF THE SYSTEM LINES.\n" + sheGrammar() };
  }

  // ---- the panel -----------------------------------------------------------

  function isOpen() { var p = el("systemPanel"); return !!(p && !p.hidden); }

  function renderBlocks() {
    var sel = el("spBlock");
    if (!sel) return;
    sel.innerHTML = "";
    blocks().forEach(function (b) {
      var o = document.createElement("option");
      o.value = b.id;
      o.textContent = b.title + (b.custom ? " [MINE]" : "") + (b.edited ? " *" : "");
      sel.appendChild(o);
    });
    sel.value = selected;
    renderText();
  }

  function emptyHint(id) {
    var H = {
      canon: "EMPTY BECAUSE NO CANON IS SET - FLAG A LOREPACK DOCUMENT AS CANON, OR TYPE YOUR OWN TEXT HERE AND SAVE.",
      traits: "EMPTY BECAUSE SHE WEARS NOTHING - /load <ID> PUTS A TRAIT ON HER.",
      wants: "EMPTY BECAUSE SHE CARRIES NOTHING - SHE WRITES [[WANT: ...]] IN A REPLY.",
      grants: "EMPTY BECAUSE NOTHING IS GRANTED - PETITIONS LIVE IN /petition.",
      mood: "EMPTY BECAUSE EVERY SWITCH IS OFF - SHE ANSWERS IN HER OWN COLOUR. /mood OR THE MOOD ROW.",
      capture: "EMPTY BECAUSE CAPTURE MODE IS OFF - /capturemode <TOPIC> STARTS IT.",
      tandem: "EMPTY BECAUSE THE VIEWER IS CLOSED - OPEN THE DOX VIEWER AND SHE IS TOLD WHAT IS ON THE STAGE.",
      extra: "YOUR OWN FINAL WORD - TYPE IT HERE AND SAVE. SHE READS IT AFTER EVERYTHING ELSE, EVERY TURN."
    };
    return H[id] || "";
  }

  function renderText() {
    var b = null;
    blocks().forEach(function (x) { if (x.id === selected) b = x; });
    var ta = el("spText");
    if (!b || !ta) return;
    ta.value = b.text;
    try { ta.placeholder = b.text ? "" : emptyHint(b.id); } catch (e) {}
    ta.readOnly = false;
    ta.classList.remove("ro");
    var save = el("spSave"), res = el("spReset"), st = el("spState"), note = el("spNote");
    if (save) save.disabled = false;
    // RESET puts the shipped (or built) text back; on a block of his own there is nothing to
    // put back to, so the same button deletes it.
    if (res) { res.disabled = b.custom ? false : !b.edited; res.textContent = b.custom ? "DELETE" : "RESET"; }
    if (note) note.textContent = b.note || "";
    if (st) st.textContent = stateOf(b.id);
  }

  function renderRoles() {
    var sel = el("spRole");
    if (!sel || !window.roles) return;
    var cur = window.roles.currentId ? window.roles.currentId() : "";
    sel.innerHTML = "";
    var off = document.createElement("option");
    off.value = "";
    off.textContent = "OFF STAGE (LIA HERSELF)";
    sel.appendChild(off);
    window.roles.all().forEach(function (r) {
      var o = document.createElement("option");
      o.value = r.id;
      o.textContent = String(r.title || r.id).toUpperCase()
        + (r.subtitle ? ", " + r.subtitle : "")
        + (r.local ? " [ON DEVICE]" : "");
      sel.appendChild(o);
    });
    sel.value = cur;
    var role = cur ? window.roles.get(cur) : null;
    var del = el("spRoleDel");
    if (del) del.disabled = !(role && role.local);
  }

  function render() { if (window.moods && window.moods.paint) window.moods.paint(); renderRoles(); renderBlocks(); fit(); }

  // The panel floats above the command deck, so it can only be as tall as the room the deck
  // leaves it. Keep its top edge on screen (whatever the viewport) and let the body scroll.
  function fit() {
    var p = el("systemPanel"), deck = el("command-deck");
    if (!p || p.hidden || !deck) return;
    if (document.body && document.body.classList && document.body.classList.contains("systemFull")) { p.style.maxHeight = ""; return; }
    var room = Math.round(deck.getBoundingClientRect().top - 12);
    p.style.maxHeight = Math.max(160, room) + "px";
  }

  // The textarea holds unsaved work only until the next deliberate action, so a switch
  // (block, role, or closing) saves it rather than dropping it. Nothing is ever lost
  // by looking at something else.
  async function saveSelected(silent) {
    var ta = el("spText");
    if (!ta || ta.readOnly) return false;
    if (ta.value === text(selected)) return false;
    var ok = await set(selected, ta.value);
    if (ok && !silent) {
      print("SYSTEM", "SYSTEM INSTRUCTION SAVED :: " + titleOf(selected) + " :: KEPT ON THIS DEVICE. SHE IS TOLD IT FROM HER NEXT REPLY.");
    }
    return ok;
  }

  async function save() {
    var ok = await saveSelected(false);
    if (!ok) print("SYSTEM", "NOTHING TO SAVE :: " + titleOf(selected) + " MATCHES THE TEXT ALREADY IN FORCE.");
    renderBlocks();
    return ok;
  }

  async function resetSelected() {
    var b = null;
    blocks().forEach(function (x) { if (x.id === selected) b = x; });
    if (b && b.custom) {
      var t = titleOf(selected);
      await removeBlock(selected);
      print("SYSTEM", "BLOCK DELETED :: " + t + " IS OUT OF THE STACK. HER NEXT REPLY IS BUILT WITHOUT IT.");
      renderBlocks();
      return true;
    }
    if (!EDITABLE[selected]) return false;
    await reset(selected);
    print("SYSTEM", "RESET TO SHIPPED :: " + titleOf(selected) + (selected === "role" ? " :: " + (window.roles && window.roles.label ? window.roles.label() : "") : "") + " :: SHE IS TOLD IT FROM HER NEXT REPLY.");
    renderBlocks();
    return true;
  }

  async function select(id) {
    if (list().indexOf(id) === -1) return;
    if (id !== selected) await saveSelected(true);
    selected = id;
    renderBlocks();
  }

  // THE ROLE ROW'S EDIT BUTTON. The role dropdown shifts her the moment it moves, so it always
  // names the layer she is wearing - and the "role" block IS that layer's text. Editing is
  // therefore selecting that block: whatever is in the box is saved first (silently), the layer
  // text loads into it, and SAVE / RESET do the rest through the same path as every other block
  // (roles.setText / resetText on this device).
  async function editRoleText() {
    await select("role");
    try {
      var ta = el("spText");
      if (ta) ta.focus();
    } catch (e) {}
    return true;
  }

  function showNewBlock() {
    var row = el("spNewBlockRow");
    if (!row) return;
    row.hidden = false;
    var t = el("spNewBlockTitle");
    if (t) t.focus();
  }

  // The textarea's text becomes a block of his own, named in the row. It is spliced into the
  // stack just before EXTRA INSTRUCTIONS, and from then on it is edited like any other block.
  async function createBlockFromForm() {
    var tEl = el("spNewBlockTitle"), ta = el("spText");
    var title = tEl ? String(tEl.value || "").trim() : "";
    if (!title) { print("SYSTEM", "A NEW BLOCK NEEDS A NAME - TYPE ONE IN THE TITLE FIELD FIRST."); return false; }
    var id = await addBlock(title, ta ? ta.value : "");
    if (tEl) tEl.value = "";
    var row = el("spNewBlockRow");
    if (row) row.hidden = true;
    selected = id;
    renderBlocks();
    print("SYSTEM", "BLOCK CREATED :: " + titleOf(id) + " :: IT SITS IN THE STACK JUST BEFORE EXTRA INSTRUCTIONS AND IS KEPT ON THIS DEVICE. EDIT IT ANY TIME; DELETE TAKES IT OUT.");
    return true;
  }

  async function selectRole(id) {
    if (!window.roles) return;
    await saveSelected(true);
    var res = await window.roles.set(id, 'hitl');
    if (!res.ok) { print("SYSTEM", res.error); render(); return; }
    print("SYSTEM", res.off
      ? "OFF STAGE :: NO ROLE IS ON HER - LIA ANSWERS AS THE ACTOR NOW."
      : "ROLE SHIFT :: " + String(res.role.title || res.role.id).toUpperCase()
        + (res.role.subtitle ? ", " + String(res.role.subtitle).toUpperCase() : "") + " TAKES THE STAGE.");
    render();
  }

  function showNewRole() {
    var row = el("spNewRow");
    if (!row) return;
    row.hidden = false;
    var id = el("spNewId");
    if (id && selected === "role") id.placeholder = "id (e.g. lia)";
    if (id) id.focus();
  }

  async function createRoleFromForm() {
    if (!window.roles || !window.roles.createRole) return false;
    var idEl = el("spNewId"), tEl = el("spNewTitle"), aEl = el("spNewAddr"), ta = el("spText");
    var res = await window.roles.createRole({
      id: idEl ? idEl.value : "",
      title: tEl ? tEl.value : "",
      addressAs: aEl ? aEl.value : ""
    }, ta ? ta.value : "");
    if (!res.ok) { print("SYSTEM", res.error); return false; }
    if (idEl) idEl.value = "";
    if (tEl) tEl.value = "";
    if (aEl) aEl.value = "";
    var row = el("spNewRow");
    if (row) row.hidden = true;
    print("SYSTEM", "ROLE WRITTEN :: " + String(res.role.title || res.role.id).toUpperCase()
      + " :: IT LIVES ON THIS DEVICE. /role " + res.role.id + " TO PUT IT ON, OR PICK IT IN THE ROLE LIST.");
    render();
    return true;
  }

  async function removeSelectedRole() {
    var sel = el("spRole");
    var id = sel ? sel.value : "";
    if (!id || !window.roles || !window.roles.removeRole) return false;
    var res = await window.roles.removeRole(id);
    if (!res.ok) { print("SYSTEM", res.error); return false; }
    print("SYSTEM", "ROLE DELETED FROM THIS DEVICE :: " + String(id).toUpperCase());
    render();
    return true;
  }

  function setPreviewProvider(fn) { provider = fn; }
  // chat.js registers the four blocks it alone can build, so the panel can show what is
  // actually in force for canon / traits / directives / commands (and so an edit of his can
  // override exactly that text).
  function setPartProvider(fn) { partProvider = fn; }

  async function preview() {
    if (!provider) { print("SYSTEM", "PREVIEW UNAVAILABLE."); return ""; }
    var body = "";
    try { body = await provider(); } catch (e) { console.warn("preview failed", e); }
    print("SYSTEM", "FULL SYSTEM PROMPT AS SHE RECEIVES IT :: " + summary()
      + "\nTHE SERVICE HAS NO SEPARATE SYSTEM FIELD, SO THIS TEXT IS SENT AS THE OPENING OF EVERY REQUEST - IT IS THE FIRST THING SHE READS, WITH THE CONVERSATION AFTER IT."
      + "\n\n" + (body || "(empty)"));
    return body;
  }

  function open() {
    var p = el("systemPanel");
    if (!p) return;
    setFull(true);
    p.hidden = false;
    // one deck panel at a time
    var forgePanel = el("createPanel");
    if (forgePanel && !forgePanel.hidden && typeof closeForge === "function") closeForge();
    try { if (window.moods && window.moods.panelClose && (document.body.classList.contains("moodFull") || (window.moods.panelIsOpen && window.moods.panelIsOpen()))) window.moods.panelClose(); } catch (e) {}
    try { if (window.shelf && window.shelf.close && (document.body.classList.contains("shelfFull") || (window.shelf.isOpen && window.shelf.isOpen()))) window.shelf.close(); } catch (e) {}
    try { if (window.moodpack && window.moodpack.close && (document.body.classList.contains("moodpackFull") || (window.moodpack.isOpen && window.moodpack.isOpen()))) window.moodpack.close(); } catch (e) {}
    if (window.keyring && window.keyring.isOpen()) window.keyring.close();
    if (list().indexOf(selected) === -1) selected = "actor";
    render();
    print("SYSTEM", summary() + "\nEVERY BLOCK IS YOURS TO REWRITE - SELECT IT, EDIT, SAVE. SHE IS TOLD THE NEW TEXT FROM HER NEXT REPLY. RESET PUTS THE SHIPPED (OR BUILT) TEXT BACK; + NEW BLOCK ADDS ONE OF YOUR OWN, AND DELETE TAKES IT OUT AGAIN. THE MOOD ROW IS THE CONSOLE OF COLOURS SHE ANSWERS IN - AS MANY SWITCHES AS YOU LIKE, ALL OFF AMONG THEM, AND + NEW MOOD WRITES ONE OF YOUR OWN ON THE FLY (THE SAME ROW IS ON THE PENCIL). EVERY MOOD IS CRUD-ABLE: EDIT OPENS THE MOOD EDITOR - PICK ANY MOOD, SHIPPED OR WRITTEN HERE, AND WRITE ITS NAME AND ITS RULE; SAVE KEEPS IT (A SHIPPED ONE'S CHANGE LIVES ON THIS DEVICE - THE BOOK IS NEVER WRITTEN TO), RESET PUTS A SHIPPED MOOD'S OWN WORDS BACK, RENAME KEEPS EVERY MOOD BOARD WORKING (THE ID NEVER MOVES), AND DELETE TAKES A MOOD OFF THE CONSOLE WITHOUT DESTROYING IT - PUT IT BACK RETURNS IT. AND UNDER IT THE MOOD BOARD ROW HOLDS THE META-MOODS - NAMED COMBINATIONS OF COLOURS: A CHIP APPLIES ONE (ITS COLOURS, IN ITS ORDER, REPLACING WHAT IS SWITCHED ON), SAVE BOARD KEEPS THE COMBINATION THAT IS ON NOW UNDER A NAME, BIND SAVES IT FOR THE ROLE ON STAGE SO IT SWITCHES ITSELF ON AT EVERY SHIFT ONTO THAT ROLE, AND DELETE TAKES THE COMBINATION OUT AND NOT ONE COLOUR WITH IT. EVERYTHING HERE IS KEPT ON THIS DEVICE. SHE HOLDS THE SAME PEN ON THE BLOCKS NOW: A [[SYSTEM: ...]] LINE OF HERS IS DONE AT ONCE (LIST, READ, WRITE, NEW, RESET, DELETE) - AND BOUNDARIES AND BUSINESS HOURS ARE THE BLOCKS SHE MAY READ AND NEVER REWRITE (THE HOURS ARE YOUR ARRANGEMENT: SHE ASKS FOR A CHANGE TO THEM WITH A PETITION, `system :: hours :: ...`). /help system HAS THE WHOLE OF IT.");
  }

  // Closing is one of the deliberate actions that keeps what he wrote: the CLOSE button, Escape,
  // and the SYSTEM button all go through here, so the textarea can never be dropped unsaved.
  async function close() {
    await saveSelected(true);
    setFull(false);
    var p = el("systemPanel");
    if (p) p.hidden = true;
  }

  async function toggle() {
    if (isOpen()) await close();
    else open();
  }

  var systemHomeParent = null, systemHomeNext = null, systemFullKey = null;

  function setFull(on) {
    on = !!on;
    var p = el("systemPanel");
    if (on) {
      if (p && p.parentNode !== document.body) {
        if (!systemHomeParent) { systemHomeParent = p.parentNode; systemHomeNext = p.nextSibling; }
        try { document.body.appendChild(p); } catch (e) {}
      }
      if (!systemFullKey) {
        systemFullKey = function (e) {
          if (e.key !== "Escape" && e.keyCode !== 27) return;
          try { close(); } catch (x) {}
        };
        document.addEventListener("keydown", systemFullKey, true);
      }
    } else {
      if (p && systemHomeParent) {
        try { systemHomeParent.insertBefore(p, systemHomeNext); } catch (e) {}
        systemHomeParent = null;
        systemHomeNext = null;
      }
      if (systemFullKey) {
        try { document.removeEventListener("keydown", systemFullKey, true); } catch (e) {}
        systemFullKey = null;
      }
    }
    try { document.body.classList.toggle("systemFull", on); } catch (e) {}
    return on;
  }

  return {
    load: load, text: text, set: set, reset: reset, blocks: blocks, edited: edited,
    list: list, titleOf: titleOf, stateOf: stateOf, addBlock: addBlock, removeBlock: removeBlock,
    showNewBlock: showNewBlock, createBlockFromForm: createBlockFromForm,
    assemble: assemble, summary: summary, ready: function () { return ready; },
    open: open, close: close, toggle: toggle, isOpen: isOpen, render: render, fit: fit,
    select: select, save: save, resetSelected: resetSelected, saveSelected: saveSelected, editRoleText: editRoleText,
    selectRole: selectRole, showNewRole: showNewRole, createRoleFromForm: createRoleFromForm,
    removeSelectedRole: removeSelectedRole,
    setPreviewProvider: setPreviewProvider, setPartProvider: setPartProvider, preview: preview,
    selectedId: function () { return selected; },
    // HER OWN HAND ON THE STACK (see the SYSTEM LANE above): the line, the list, the grammar, and
    // the one block she may read but never write.
    sheAct: sheAct, sheListText: sheListText, sheText: sheText, sheGrammar: sheGrammar,
    sheMayWrite: sheMayWrite, resolveBlockId: resolveBlockId, known: known,
    sheReadOnly: function () { return Object.keys(SHE_NEVER_WRITES); }
  };
})();
