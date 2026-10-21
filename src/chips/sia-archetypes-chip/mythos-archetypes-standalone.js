window.MythosArchetypes = (function () {
  "use strict";
  var A = [["self","Self","psyche","Unified, Whole, Centered — To achieve individuation and inner balance.","The Inflated Ego"],["shadow","Shadow","psyche","Repressed, Primitive, Instinctual — To contain disowned aspects of the psyche.","The Projected Monster"],["anima","Anima","psyche","Feminine, Relational, Emotional — To mediate between ego and unconscious.","The Femme Fatale"],["animus","Animus","psyche","Masculine, Rational, Directive — To provide logos and assertive structure.","The Tyrant"],["persona","Persona","psyche","Adaptive, Social, Performative — To function within society.","The False Self"],["king","King","crown","Ordering, Blessing, Centered — To create order and generativity.","The Tyrant / The Weakling"],["warrior","Warrior","blade","Disciplined, Decisive, Loyal — To protect and advance the mission.","The Sadist / The Masochist"],["magician","Magician","craft","Insightful, Strategic, Initiatory — To access and apply hidden knowledge.","The Detached Manipulator"],["lover","Lover","love","Sensual, Connected, Vital — To experience aliveness and intimacy.","The Addicted Lover / The Impotent Lover"],["architect","Architect","craft","Systemic, Visionary, Structural — To design enduring systems.","The Over-Controller"],["engineer","Engineer","craft","Analytical, Practical, Efficient — To make systems function reliably.","The Saboteur"],["judge","Judge","crown","Fair, Authoritative, Discerning — To uphold justice and balance.","The Corrupt Official"],["detective","Detective","veil","Observant, Cynical, Persistent — To uncover the hidden truth.","The Voyeur"],["hacker","Hacker (Modern Trickster)","veil","Subversive, Intelligent, Invisible — To bypass systems and expose weaknesses.","The Cyber-Terrorist"],["accountant","Accountant","coin","Precise, Methodical, Conservative — To maintain order and accuracy in resources.","The Penny-Pinching Miser"],["achiever","Achiever","crown","Driven, Competitive, Goal-Oriented — To prove worth through success.","The Burnout"],["addict","Addict","shadow","Compulsive, Dependent, Escapist — To numb pain or avoid inner emptiness.","The Self-Destructor"],["advocate","Advocate","crown","Defensive, Loyal, Protective — To stand up for others or a cause.","The Self-Righteous Crusader"],["alchemist","Alchemist","craft","Transformative, Integrative, Visionary — To transmute inner and outer realities.","The False Guru"],["anarchist","Anarchist","shadow","Disruptive, Anti-Authoritarian, Chaotic — To tear down corrupt structures.","The Nihilist"],["master-builder","Master Builder","craft","Systemic, Strategic, Visionary — To design coherent structures.","The Control Freak"],["artist","Artist","craft","Expressive, Sensitive, Imaginative — To externalize inner truth.","The Self-Indulgent Dreamer"],["avenger","Avenger","blade","Retributive, Intense, Moralistic — To punish perceived injustice.","The Vigilante"],["beggar","Beggar","wild","Dependent, Humble, Needy — To survive through appeal to others.","The Emotional Manipulator"],["bully","Bully","shadow","Dominating, Aggressive, Insecure — To mask vulnerability with power.","The Coward"],["caregiver","Caregiver","hearth","Compassionate, Protective, Self-Sacrificing — To nurture, protect, and serve others.","The Martyr"],["casanova","Casanova","love","Charming, Seductive, Restless — To pursue pleasure and romantic conquest.","The Empty Seducer"],["champion","Champion","blade","Confident, Competitive, Resilient — To win honor through excellence.","The Arrogant Victor"],["child","Child","hearth","Innocent, Curious, Dependent — To be safe, loved, and guided.","The Eternal Child"],["clown","Clown","trick","Playful, Disarming, Irreverent — To bring joy and relieve tension.","The Foolish Buffoon"],["con-artist","Con Artist","trick","Deceptive, Persuasive, Opportunistic — To gain advantage through manipulation.","The Fraud"],["creator","Creator","craft","Imaginative, Driven, Innovative — To bring something new into existence.","The Perfectionist"],["critic","Critic","veil","Analytical, Judgmental, Sharp — To identify flaws and enforce standards.","The Destroyer"],["dark-lord","Dark Lord","shadow","Dominating, Fear-Inducing, Strategic — To control through power and fear.","The Fallen King"],["defender","Defender","blade","Protective, Loyal, Steadfast — To guard people, values, or territory.","The Paranoid Sentinel"],["destroyer","Destroyer","shadow","Forceful, Uncompromising, Transformative — To clear the way for renewal through destruction.","The Annihilator"],["diplomat","Diplomat","crown","Tactful, Balanced, Composed — To maintain harmony and negotiated peace.","The Appeaser"],["dreamer","Dreamer","spirit","Imaginative, Idealistic, Escapist — To envision a better reality.","The Delusional Escapist"],["gambler","Gambler","coin","Risk-Taking, Hopeful, Addictive — To beat the odds and win big.","The Loser"],["giver","Giver","hearth","Generous, Supportive, Selfless — To provide for others and create goodwill.","The Self-Erasing Martyr"],["guardian","Guardian","blade","Protective, Vigilant, Duty-Bound — To defend people, places, or principles.","The Paranoid Watcher"],["guide","Guide","voyage","Wise, Supportive, Experienced — To help others find their way.","The Manipulative Mentor"],["healer","Healer","hearth","Compassionate, Restorative, Empathic — To mend wounds and restore wholeness.","The Wounded Healer"],["hedonist","Hedonist","love","Pleasure-Seeking, Indulgent, Sensual — To maximize enjoyment and avoid discomfort.","The Addict"],["hero","Hero","blade","Courageous, Competent, Self-Sacrificing — To prove worth through courageous action.","The Bully"],["hermit","Hermit","wild","Withdrawn, Reflective, Solitary — To seek truth through inner contemplation.","The Recluse"],["hunter","Hunter","wild","Focused, Relentless, Strategic — To pursue and capture a target.","The Predator"],["idealist","Idealist","spirit","Visionary, Hopeful, Principled — To live according to higher values and ideals.","The Naive Dreamer"],["innocent","Innocent","hearth","Trusting, Optimistic, Pure — To find safety, happiness, and goodness.","The Denying Innocent"],["investigator","Investigator","veil","Analytical, Detached, Curious — To understand how things truly work.","The Isolated Observer"],["inventor","Inventor","craft","Innovative, Experimental, Resourceful — To create novel solutions.","The Mad Tinkerer"],["arbiter","Arbiter","crown","Discerning, Authoritative, Objective — To evaluate truth and enforce standards.","The Condemner"],["jester","Jester","trick","Playful, Irreverent, Entertaining — To bring joy and expose hypocrisy.","The Irresponsible Hedonist"],["journeyman","Journeyman","voyage","Reliable, Experienced, Practical — To master a craft through steady work.","The Stagnant Laborer"],["judge-executioner","Judge-Executioner","shadow","Severe, Moralistic, Unyielding — To punish wrongdoing decisively.","The Fanatic"],
["regent","Regent","crown","Holds the throne warm for one who is absent or unborn; rules as if watched.","The Placeholder who will not step down."],
["lawgiver","Lawgiver","crown","Writes the code all swear by; justice as architecture, not vengeance.","The Letter that strangles the spirit it was built to guard."],
["peacemaker","Peacemaker","crown","Ends wars by seating enemies at one table; peace as crafted object.","The Appeaser who feeds the wolf to keep the flock quiet."],
["steward","Steward","crown","Keeps the house, the books, the keys; power exercised as duty.","The Jailer of plenty who starves the house to prove it safe."],
["heir","Heir","crown","Born to inherit; learns the weight before the crown.","The Spare who spends a lifetime waiting to matter."],
["empress","Empress","crown","Sovereign abundance; the realm as extended body, ruled by presence.","The Devouring throne that mistakes obedience for love."],
["senator","Senator","crown","Speaks for the many in the hall of the few; patience as weapon.","The Filibuster of conscience who talks until the truth leaves."],
["magistrate","Magistrate","crown","Weighs each case on its own scales; small justice, daily.","The Petty gavel that loves the sentence more than the truth."],
["chancellor","Chancellor","crown","Runs the machinery of state while crowns take the light.","The Power behind the curtain that forgets it serves."],
["herald-crown","Herald","crown","Carries the sovereign's word unbent; truth between thrones.","The Mouthpiece who polishes lies until they shine."],
["oathkeeper","Oathkeeper","crown","Bound by sworn word; breaks before bending.","The Vow that outlives its meaning and still demands blood."],
["tribute","Tribute","crown","Pays the price of peace in gold and pride; survival as strategy.","The Bought peace that costs everything worth keeping."],
["founder","Founder","crown","Lays the first stone and the founding myth in one motion.","The Myth that eats its children to stay spotless."],
["exile-king","Exiled King","crown","Rules a kingdom carried in memory; dignity without land.","The Ghost crowned in yesterday who taxes the living."],
["councillor","Councillor","crown","Whispers counsel the ruler can hear; advice as art.","The Flatterer who tells the throne what it dreams."],
["pretender","Pretender","crown","Claims the seat by blood or by nerve; legitimacy as performance.","The Usurper whose claim is only appetite in ermine."],
["duelist","Duelist","blade","Settles honour face to face; courage with rules.","The Provocateur who needs insult the way lungs need air."],
["vanguard","Vanguard","blade","First through the breach; leads by bleeding earliest.","The Martyr complex that spends lives to prove devotion."],
["sentinel","Sentinel","blade","Watches the gate that never sleeps; vigilance as devotion.","The Paranoiac who sees invasion in every shadow."],
["blademaster","Blademaster","blade","The weapon as extension of will; decades distilled into one cut.","The Perfect stroke that has forgotten what it defends."],
["squire","Squire","blade","Learns war by carrying it for another; loyalty in training.","The Lackey who mistakes service for selfhood."],
["warlord","Warlord","blade","Commands by charisma and terror; victory as legitimacy.","The Butcher who keeps wars alive to stay employed."],
["shieldbearer","Shieldbearer","blade","Stands between harm and the helpless; defence as identity.","The Wall that lets nothing in, not even gratitude."],
["scout-blade","Scout","blade","Runs ahead of the army, reads ground like script.","The Deserter who keeps running past the mission."],
["besieger","Besieger","blade","Starves stone walls with patience; siege as slow argument.","The Strangler who calls patience what is cruelty with time."],
["partisan","Partisan","blade","Fights for home soil with farm tools and fury.","The Vendetta that outlives the occupation."],
["mercenary","Mercenary","blade","Sells the sword to the highest cause; professionalism without flag.","The Coin that kills for whoever jingles."],
["gladiator","Gladiator","blade","Performs combat for the crowd; death as theatre.","The Crowd-pleaser who bleeds for applause."],
["executioner-role","Headsman","blade","Carries out the sentence others pronounce; duty without verdict.","The Axe that enjoys the arithmetic of necks."],
["bodyguard","Bodyguard","blade","One life traded for another's; protection as vow.","The Human shield that resents the life it guards."],
["veteran","Veteran","blade","Carries every campaign in the body; survival as testimony.","The Relic who recruits the young into old wars."],
["standard","Standard-Bearer","blade","Carries the colours so all know where to stand.","The Flag that matters more than the soldiers under it."],
["smith","Smith","craft","Shapes hot matter into lasting form; patience at the anvil.","The Hammer that sees every problem as something to beat."],
["mason","Mason","craft","Builds stone by stone what outlives the builder.","The Waller who seals the living inside the perfect."],
["weaver-craft","Weaver","craft","Threads separate strands into one cloth; pattern as meaning.","The Tangler who knots every thread to stay needed."],
["potter","Potter","craft","Centres clay and coaxes vessels; emptiness given use.","The Moulder who reshapes people like lumps of clay."],
["carpenter","Carpenter","craft","Joins wood true and square; shelter from skill.","The Coffin-maker who measures everyone for a box."],
["goldsmith","Goldsmith","craft","Works precious metal with infinite care; value refined.","The Gilder who plates rot and calls it treasure."],
["scribe-craft","Scribe","craft","Sets words down faithful; memory made durable.","The Copyist who preserves the lie as carefully as truth."],
["cartographer","Cartographer","craft","Draws the world so others may travel; knowledge as map.","The Border-drawer who carves fences into living land."],
["brewer","Brewer","craft","Ferments time into drink; celebration distilled.","The Drowner who pickles every sorrow instead of facing it."],
["baker","Baker","craft","Feeds the street from one oven; warmth as trade.","The Crumb-counter who feeds bodies and starves souls."],
["tailor","Tailor","craft","Cuts cloth to the body's truth; identity fitted.","The Disguiser who sews masks that never come off."],
["perfumer","Perfumer","craft","Bottles memory and desire; scent as signature.","The Mask of sweetness sprayed over decay."],
["clockmaker","Clockmaker","craft","Gears time into order; precision as devotion.","The Ticker who schedules the life out of living."],
["shipwright","Shipwright","craft","Builds vessels that carry souls across water.","The Ark-hoarder with room for everything but people."],
["dyer","Dyer","craft","Dips plain cloth into colour; transformation in vats.","The Stainer whose colours run and ruin the rest."],
["glassblower","Glassblower","craft","Breath given fragile permanent form; beauty that breaks.","The Bubble-maker of pretty nothings that shatter."],
["midwife","Midwife","hearth","Stands at the threshold of first breath; arrival midwifed.","The Gatekeeper of birth who owns every entrance."],
["grandmother","Grandmother","hearth","Memory of the family made flesh; stories as inheritance.","The Guilt that seasons every meal with obligation."],
["host","Host","hearth","Opens the door and the table; strangers made guests.","The Creditor whose hospitality sends a bill."],
["hearthkeeper","Hearthkeeper","hearth","Tends the fire all gather round; warmth maintained.","The Smotherer who banks the fire until all choke."],
["nurse","Nurse","hearth","Watches through fever nights; care as competence.","The Martyr of the ward who needs the sick to stay sick."],
["teacher-hearth","Teacher","hearth","Shapes the young mind daily; futures compounded.","The Moulder of minds that must never outgrow her."],
["neighbour","Neighbour","hearth","Borrows sugar, lends ladders; community in small change.","The Curtain-twitcher trading gossip for company."],
["gardener-hearth","Gardener","hearth","Tends growth season by season; patience that blooms.","The Pruner who cuts everything to one shape."],
["cook","Cook","hearth","Feeds love through the mouth; the pot never empty.","The Force-feeder whose love must all be swallowed."],
["foster","Foster Parent","hearth","Takes in the abandoned; love without bloodline.","The Collector of strays kept wounded to stay needed."],
["widow","Widow","hearth","Carries on after loss; grief converted to grit.","The Monument to sorrow that forbids joy at the table."],
["orphan-hearth","Orphan","hearth","Grows up unheld; self-raised and watchful.","The Abandoned who trusts nothing and tests everyone."],
["sibling","Sibling","hearth","Shares blood, bunk and history; rivalry and refuge.","The Rival who keeps score of every slice of childhood."],
["godparent","Godparent","hearth","Chosen kin; promises made over the font.","The Absentee saint invoked but never present."],
["storyteller-hearth","Storyteller","hearth","Keeps the family myth alive at bedtime.","The Myth-monger who edits the past to rule the present."],
["homecomer","Homecomer","hearth","Returns after long absence; forgiveness sought.","The Prodigal who spends forgiveness like coin."],
["tracker","Tracker","wild","Reads broken twigs and bent grass; the land confesses to her.","The Bloodhound who cannot stop hunting people."],
["ranger","Ranger","wild","Patrols the borderlands; law where there is none.","The Feral badge who answers to nothing."],
["druid","Druid","wild","Speaks for root and river; old religion in a new mouth.","The Superstition that sacrifices reason to the grove."],
["beastfriend","Beastfriend","wild","Kin to fang and feather; trust earned on four legs.","The Muzzle that prefers animals because people answer back."],
["forager","Forager","wild","Finds food where others see weeds; hunger as teacher.","The Scavenger who strips the land bare."],
["mountaineer","Mountaineer","wild","Climbs because the peak is there; altitude as honesty.","The Summit that leaves bodies as milestones."],
["sailor-wild","Sailor","wild","Reads wind and water; home is a moving deck.","The Drifter who outruns every harbour of commitment."],
["nomad","Nomad","wild","Carries home on the back; arrival as lifestyle.","The Vagrant who mistakes motion for freedom."],
["hermit-wild","Wild Hermit","wild","Lives beyond the last fence; solitude as sacrament.","The Recluse whose purity curdles into contempt."],
["firetender","Firetender","wild","Keeps the camp flame through the night watch.","The Arsonist of attention who must always be the spark."],
["shapeshifter","Shapeshifter","wild","Wears other skins convincingly; identity as weather.","The Mimic with no face underneath."],
["stormcaller-wild","Stormcaller","wild","Reads weather in the bones; tempest respected, never tamed.","The Tempest who summons chaos to feel powerful."],
["wilderness-guide","Bush Pilot","wild","Flies or walks others through country that forgives nothing.","The Strander who proves worth by risking yours."],
["poacher","Poacher","wild","Takes from the lord's forest; hunger over law.","The Stripper who takes the last breeding pair."],
["castaway","Castaway","wild","Survives the wreck and the island; resource as religion.","The Crusoe who colonises every relationship."],
["monk","Monk","spirit","Prays the hours; discipline as doorway to the boundless.","The Flagellant who polishes suffering into pride."],
["mystic","Mystic","spirit","Touches the absolute directly; maps drawn from the far shore.","The Guru-trap: enlightenment franchised for followers."],
["pilgrim-spirit","Pilgrim","spirit","Walks toward the holy; the road is the rite.","The Wanderer who arrives nowhere because arriving ends the story."],
["prophet","Prophet","spirit","Hears the voice others miss; warning as burden.","The Doom-crier who loves the disaster he predicts."],
["oracle-spirit","Oracle","spirit","Speaks what the god dictates; ambiguity as accuracy.","The Riddle-monger who never risks being wrong."],
["shaman","Shaman","spirit","Travels between worlds for the tribe's sake.","The Possessed who cannot come back from the trip."],
["anchorite","Anchorite","spirit","Walled into a cell for God; the world renounced room by room.","The Entombed whose holiness is fear with incense."],
["confessor","Confessor","spirit","Hears the worst and absolves; secrecy as sacrament.","The Blackmailer of souls who banks every sin."],
["martyr-spirit","Martyr","spirit","Dies for the cause and converts by dying.","The Suicide of conviction that drafts others to die."],
["ascetic","Ascetic","spirit","Owns nothing, wants less; lightness as doctrine.","The Starver who weaponises needlessness into judgment."],
["chanter","Chanter","spirit","Sings the office; praise as daily bread.","The Drone whose devotion drowns all dissent."],
["visionary","Visionary","spirit","Sees what is coming and says so plainly.","The Hallucinator canonised before verification."],
["penitent","Penitent","spirit","Carries remorse as practice; guilt worked like a field.","The Self-punisher harvesting pity from pain."],
["guru","Guru","spirit","Guides seekers up the mountain she climbed.","The Cultivator of dependence disguised as teaching."],
["exorcist","Exorcist","spirit","Casts out what possesses; confrontation with the dark.","The Witchfinder who finds demons wherever power waits."],
["saint","Saint","spirit","Lives so brightly others navigate by her.","The Icon that flattens a person into a window."],
["tempter","Tempter","shadow","Offers exactly what is wanted at exactly the wrong price.","The Fine print that owns everything after."],
["parasite","Parasite","shadow","Lives in the host's warmth; need as strategy.","The Leech that drains the hand that feeds."],
["sadist","Sadist","shadow","Enjoys the wince; pain as pastime.","The Tormentor who calls cruelty honesty."],
["traitor","Traitor","shadow","Sells the secret, the gate, the friend; betrayal as currency.","The Judas whose kiss is still warm on every cheek."],
["usurper","Usurper","shadow","Takes the seat by knife or lie; ambition unmasked.","The Pretence of reform draped over appetite."],
["hoarder","Hoarder","shadow","Keeps everything against the famine that never comes.","The Miser buried alive in plenty."],
["stalker","Stalker","shadow","Watches the beloved from the dark; obsession as devotion.","The Watcher who loves the watched into fear."],
["blackmailer","Blackmailer","shadow","Banks secrets and spends them slowly.","The Ledger of shame that never balances."],
["arsonist","Arsonist","shadow","Sets fires to watch the world glow.","The Ash-maker who must burn to feel real."],
["poisoner","Poisoner","shadow","Kills quietly in cups and confidences.","The Sweet cup poured with a steady smiling hand."],
["fanatic","Fanatic","shadow","Believes so hard the belief believes him.","The Bonfire that burns heretics to stay warm."],
["nihilist","Nihilist","shadow","Knows nothing matters and proves it repeatedly.","The Void that recruits."],
["tyrant-shadow","Petty Tyrant","shadow","Rules the small pond with absolute malice.","The Frog-king croaking orders at the ocean."],
["snitch","Snitch","shadow","Trades others' secrets for safety.","The Ear that hears everything and belongs nowhere."],
["saboteur","Saboteur","shadow","Breaks the machine from inside; wreckage as message.","The Wrench that calls destruction critique."],
["ghoul","Ghoul","shadow","Feeds on the dead and the grieving.","The Vulture in mourning clothes."],
["prankster","Prankster","trick","Trips the pompous; laughter as correction.","The Pest who mistakes cruelty for comedy."],
["impostor","Impostor","trick","Wears another's name well; forgery as art.","The Hollow name with nobody home."],
["huckster","Huckster","trick","Sells wonders from the back of a wagon.","The Snake-oil saint of every desperate town."],
["cardsharp","Cardsharp","trick","Deals from the bottom with a smile; chance rigged.","The Cold deck that never lets anyone win."],
["pickpocket","Pickpocket","trick","Lifts purses with dancers' fingers.","The Light fingers in everyone's dark."],
["forger","Forger","trick","Copies seals and signatures flawlessly.","The False paper that hangs the innocent."],
["spy-trick","Spy","trick","Wears loyalty like a coat, reversible.","The Double face that forgets which side is skin."],
["rumour","Rumourmonger","trick","Plants stories that grow wild overnight.","The Weed-sower of reputations."],
["escape-artist","Escape Artist","trick","Slips every knot, lock and promise.","The Houdini of commitment who vanishes at vows."],
["disguiser","Disguiser","trick","Becomes anyone convincingly; faces as wardrobe.","The Mask with nothing it will show unpainted."],
["riddler","Riddler","trick","Speaks in knots; the clever must untie.","The Sphinx who eats whoever answers slowly."],
["contrarian","Contrarian","trick","Opposes whatever stands; reflex as identity.","The No that starves every yes."],
["satirist","Satirist","trick","Flays the powerful with laughter.","The Sneer that punches down and calls it wit."],
["luckster","Luckster","trick","Surfs chaos and calls it skill.","The Gambler's charm that spends others' luck."],
["mimic-trick","Mimic","trick","Echoes others perfectly; reflection as talent.","The Parrot with no song of its own."],
["firebrand","Firebrand","trick","Lights crowds with words; agitation as gift.","The Torch that burns the hall to warm the speech."],
["sweetheart","Sweetheart","love","Loves openly and entirely; affection without arithmetic.","The Clinger whose love is a leash of flowers."],
["seducer","Seducer","love","Wins hearts as sport and art; charm as native tongue.","The Collector who shelves hearts like trophies."],
["devotee","Devotee","love","Loves one soul with religious focus; fidelity as worship.","The Idolater who worships a person into a prison."],
["matchmaker","Matchmaker","love","Sees the spark between others; unions arranged.","The Meddler wedding strangers to her own design."],
["courtesan","Courtesan","love","Trades in cultivated desire; intimacy as profession.","The Transaction that forgets tenderness has no price."],
["muse-love","Muse","love","Inspires great work by being beheld; presence as fuel.","The Object who must never age, change or speak."],
["romantic","Romantic","love","Believes love conquers; gestures grand, heart grander.","The Grand gesture hiding an empty calendar."],
["jealous-lover","Jealous Lover","love","Guards the beloved fiercely; passion as perimeter.","The Jailer of affection who interrogates tenderness."],
["widower-love","Widower","love","Loves on after death; loyalty beyond the grave.","The Shrine that forbids the living to compete."],
["secret-lover","Secret Lover","love","Loves in hiding; stolen hours, coded letters.","The Affair that corrodes everything it touches."],
["unrequited","Unrequited","love","Loves without return; devotion as private weather.","The Martyr of maybe who feeds on crumbs."],
["sensualist","Sensualist","love","Worships through the senses; pleasure as prayer.","The Glutton for whom no feast ever suffices."],
["companion-love","Companion","love","Walks beside through decades; love as steady fire.","The Furniture of marriage, present and unpolished."],
["first-love","First Love","love","The one that taught the heart its shape; memory gilded.","The Ghost of sixteen haunting every later kiss."],
["forbidden","Forbidden Love","love","Burns brightest where barred; obstacles as accelerant.","The Taboo that mistakes danger for depth."],
["librarian","Librarian","lore","Guards the stacks; every question has a shelf.","The Dragon of the stacks hissing at borrowers."],
["chronicler","Chronicler","lore","Writes down what happened before it unhappens.","The Revisionist filing truth under convenience."],
["genealogist","Genealogist","lore","Traces bloodlines through centuries; roots as proof.","The Pedigree snob grafting glory onto rot."],
["translator","Translator","lore","Carries meaning across tongues; bridges built of nuance.","The Traitor of every text, faithful to none."],
["philosopher","Philosopher","lore","Asks why until the floor gives way; questions as home.","The Abstraction that never touches ground."],
["astronomer","Astronomer","lore","Reads fate in starlight; the sky as manuscript.","The Distant gaze that misses the neighbour."],
["naturalist","Naturalist","lore","Catalogues beetle and blossom; attention as devotion.","The Pin that kills the butterfly to keep it."],
["antiquarian","Antiquarian","lore","Loves what is old because it lasted.","The Dust that prefers the dead to the living."],
["cryptographer","Cryptographer","lore","Breaks codes; secrets surrender to patience.","The Opener of letters addressed to others."],
["lexicographer","Lexicographer","lore","Defines every word; meaning pinned like moths.","The Dictionary that forbids new words."],
["ethnographer","Ethnographer","lore","Lives among strangers to learn them; notes as respect.","The Observer who treats people as specimens."],
["archivist-lore","Archivist","lore","Keeps every record; forgets nothing, forgives on paper.","The Hoarder of paper who buries the living file."],
["mythkeeper","Mythkeeper","lore","Holds the tribe's stories; the past kept singable.","The Censor of memory deciding what never happened."],
["rune-reader","Rune Reader","lore","Casts lots and reads signs; chance interpreted.","The Superstition shuffling bones for answers."],
["professor","Professor","lore","Teaches what is known and probes the edge.","The Lecturer who stopped learning at tenure."],
["student-lore","Eternal Student","lore","Enrols forever; learning as postponement of life.","The Professional beginner afraid to graduate."],
["captain","Captain","voyage","Commands the vessel; all souls in one hand.","The Ahab whose course is obsession."],
["navigator","Navigator","voyage","Finds the way by stars and reckoning.","The Chart that sails past every human harbour."],
["castaway-voyage","Castaway","voyage","Survives the wreck; salvage as sacrament.","The Wrecker who profits from others' storms."],
["explorer","Explorer","voyage","Goes where maps go blank; curiosity as compass.","The Flag-planter claiming what was never lost."],
["pilgrim-voyage","Pilgrim","voyage","Travels toward the holy; arrival as transformation.","The Tourist of transcendence collecting shrines."],
["refugee","Refugee","voyage","Flees with nothing; survival as epic.","The Wound that never unpacks."],
["stowaway","Stowaway","voyage","Rides unseen toward elsewhere; invisibility as ticket.","The Rat in the hold gnawing every rope."],
["ferryman","Ferryman","voyage","Carries souls across; the crossing is the calling.","The Charon who charges extra for the return."],
["harbourmaster","Harbourmaster","voyage","Rules the port; every arrival logged.","The Barnacle of bureaucracy fouling every hull."],
["shipwreck-survivor","Wreck Survivor","voyage","Lived when the sea said no; salt in the story.","The Jonah convinced the storm follows."],
["caravan-leader","Caravan Leader","voyage","Leads the column across the waste; water known.","The Mirage-merchant selling the oasis."],
["exile-voyage","Exile","voyage","Sent away; carries home as ache.","The Bitter parcel blaming the road."],
["returner","Returner","voyage","Comes back changed; home must be re-learned.","The Stranger demanding the old chair fit."],
["drifter-voyage","Drifter","voyage","Moves with work and weather; roots refused.","The Tumbleweed that never waters anything."],
["smuggler","Smuggler","voyage","Runs forbidden cargo past closed gates.","The Mule whose profit funds the blockade."],
["lighthouse","Lighthouse Keeper","voyage","Tends the light that saves strangers.","The Lonely beam warning all away, including love."],
["spymaster","Spymaster","veil","Runs the web of watchers; everyone reports, none know all.","The Spider feeding the web its own flies."],
["informant","Informant","veil","Sells what was whispered; secrets as stock.","The Mouth that cannot stay shut for love or money — only money."],
["assassin-veil","Assassin","veil","Kills discreetly for cause or coin; silence as signature.","The Quiet knife that has forgotten the reason."],
["courier-veil","Courier","veil","Carries sealed things through danger; the message above the life.","The Envelope that reads what it carries."],
["lookout","Lookout","veil","Watches and warns; eyes as early alarm.","The Alarmer who cries wolf for company."],
["codebreaker","Codebreaker","veil","Unweaves ciphers; patience against secrecy.","The Eavesdropper who collects lives like intercepts."],
["handler","Handler","veil","Runs assets with care and lies; loyalty managed.","The Puppeteer mourning the puppets he cuts."],
["sleeper","Sleeper Agent","veil","Lives a borrowed life for years; ordinariness as cover.","The Nobody left when the cover becomes the person."],
["forger-veil","Forger","veil","Mints papers and pasts; identity manufactured.","The Eraser of real histories."],
["interrogator","Interrogator","veil","Extracts truth with questions or worse.","The Chair that enjoys the confession more than the crime."],
["defector","Defector","veil","Crosses to the other side; betrayal or awakening.","The Turncoat whose compass spins for sale."],
["watcher-veil","Watcher","veil","Observes without touching; reports without judgment.","The Peeping certainty that sees all, understands none."],
["cipher-veil","Cipher","veil","Knows nothing, carries everything; ignorance as security.","The Mule loaded with other people's doom."],
["ghost-veil","Ghost","veil","Officially does not exist; deniability as armour.","The Unperson erased even from mourning."],
["mole","Mole","veil","Burrows deep for years; patience as treason.","The Root-rot that topples the tree it fed on."],
["banker","Banker","coin","Moves money like weather; trust monetised.","The Vault that lends umbrellas only in sunshine."],
["merchant","Merchant","coin","Buys low, sells high, sails between; appetite as engine.","The Scale that weighs everything but honour."],
["moneylender","Moneylender","coin","Lends to the desperate at desperate rates.","The Interest compounding on misery."],
["auditor-coin","Auditor","coin","Counts what others claim; discrepancies hunted.","The Red pen that bleeds companies to prove zeal."],
["speculator","Speculator","coin","Bets on futures; risk as religion.","The Bubble blowing fortunes from air."],
["pawnbroker","Pawnbroker","coin","Holds treasure against hard times; sorrow collateralised.","The Ticket stub for lives never redeemed."],
["tax-collector","Tax Collector","coin","Takes the sovereign's share; unpopular arithmetic.","The Leech with a ledger and a seal."],
["beggar-coin","Beggar","coin","Lives on given coins; humility as trade.","The Professional wound displayed for alms."],
["prodigal-coin","Prodigal","coin","Spends inheritance like weather; wealth as confetti.","The Empty pockets blaming the wind."],
["miser","Miser","coin","Keeps gold and loses life; saving as burial.","The Dragon sleeping on hunger."],
["philanthropist","Philanthropist","coin","Gives fortunes away; generosity as monument.","The Plaque that buys absolution wholesale."],
["treasurer","Treasurer","coin","Guards the common purse; every penny watched.","The Clamp that strangles the cause it funds."],
["counterfeiter","Counterfeiter","coin","Prints value from nothing; trust forged.","The Press flooding the realm with lies."],
["bookie","Bookie","coin","Takes bets on others' fate; odds as oracle.","The Ledger that always collects."],
["auctioneer","Auctioneer","coin","Sells to the highest hunger; the gavel decides worth.","The Hammer selling heirlooms to strangers."],
["benefactor","Benefactor","coin","Funds others' dreams; patronage as legacy.","The String-attached gift that owns the dream."],
["actor-stage","Actor","stage","Becomes others nightly; applause as air.","The Mask with no face for mornings."],
["director","Director","stage","Shapes all performances into one vision.","The Tyrant of the boards directing lives offstage."],
["playwright","Playwright","stage","Writes lives others will live; dialogue as destiny.","The God of paper people, cruel to his cast."],
["diva","Diva","stage","Commands the stage and the room; presence as weather.","The Tantrum that holds the show hostage."],
["understudy","Understudy","stage","Learns every part, plays none; readiness as life.","The Resentment waiting in the wings for injury."],
["clown-stage","Clown","stage","Falls so others laugh; sorrow painted smiling.","The Painted grin that cannot stop performing grief."],
["acrobat","Acrobat","stage","Defies gravity nightly; risk as routine.","The Fall rehearsed until it happens."],
["storyteller-stage","Storyteller","stage","Holds crowds with tale alone; voice as theatre.","The Exaggerator for whom truth is a dull draft."],
["bard","Bard","stage","Sings news and legend; memory with strings.","The Flatterer tuning songs to purses."],
["puppeteer","Puppeteer","stage","Moves wooden souls; control made charming.","The Strings that prefer the wooden to the living."],
["mime","Mime","stage","Speaks without words; silence performed.","The Trapped box of her own making."],
["critic-stage","Critic","stage","Judges the performed; taste as gavel.","The Tomatoes thrown from safety."],
["producer","Producer","stage","Funds the show; money as muse.","The Purse that rewrites the third act."],
["costumer","Costumer","stage","Dresses the transformation; cloth as character.","The Wardrobe that mistakes dress for soul."],
["stagehand","Stagehand","stage","Moves the world between scenes; unseen labour.","The Ghost of the wings, essential and unthanked."],
["ingenue","Ingenue","stage","Plays innocence; youth as role.","The Typecast trapped in eternal sixteen."],
["self-jung","Self","psyche","The whole aimed at: centred, unified, becoming.","The Inflated ego mistaking itself for the whole."],
["shadow-jung","Shadow","psyche","The disowned dark carried within; denied, not absent.","The Projected monster hunted in others."],
["persona-jung","Persona","psyche","The face worn for the world; adaptation as craft.","The False self believed by its wearer."],
["inner-child","Inner Child","psyche","The young one still living inside; wonder and wound.","The Tantrum steering the adult's hands."],
["inner-critic","Inner Critic","psyche","The voice that corrects; standards enforced.","The Executioner of every tender attempt."],
["trickster-psyche","Trickster","psyche","The breaker of patterns; chaos that teaches.","The Saboteur who burns the school to skip class."],
["wise-old","Wise Old One","psyche","The elder within; counsel earned by surviving.","The Dogma that mistakes age for truth."],
["great-mother-psyche","Great Mother","psyche","The nourishing and devouring deep feminine.","The Devourer who loves by swallowing."],
["hero-psyche","Hero Psyche","psyche","The dragon-fighter within; courage toward the dark.","The Glory-hound collecting dragons' heads."],
["maiden-psyche","Maiden","psyche","The fresh beginning; possibility untested.","The Naif exploited for her shine."],
["mother-psyche","Mother","psyche","The bearer and keeper; life given and shaped.","The Smotherer loving at strangling range."],
["crone","Crone","psyche","The elder who knows endings; wisdom without illusion.","The Hag whose bitterness poisons the well."],
["puer","Puer","psyche","The eternal youth; possibility that refuses to land.","The Peter who never grows up or pays rent."],
["senex","Senex","psyche","The elder order; law, limit and tradition.","The Fossil strangling the young with custom."],
["shapeshifter-psyche","Shapeshifter Psyche","psyche","The fluid one; form as choice, not fate.","The Faithless turning coats as weather turns."],
["ally-psyche","Ally","psyche","The helping force; aid without invoice.","The Rescuer who needs victims to feel strong."],
["threshold-guardian","Threshold Guardian","psyche","The tester at the gate; worth proved by trial.","The Bully gatekeeping growth forever."],
["mentor-psyche","Mentor","psyche","The guide who has walked it; maps from scars.","The Groomer of disciples kept dependent."],
["orphan-psyche","Orphan Psyche","psyche","The abandoned one; self-reliance learned too young.","The Victim for whom rescue never arrives."],
["seeker-psyche","Seeker","psyche","The searcher; the quest is the home.","The Avoider questing anywhere but inward."],
["beloved","Beloved","love","The one all devotion points at; loved into legend.","The Idol that must never be human."],
["cutout","Cutout","veil","The deniable intermediary; messages pass through clean hands.","The Fall guy kept for the dropping."],
["freediver","Free Diver","wild","Descends on one breath; depth visited, not lived in.","The Plunger who mistakes depth for dwelling."],
["spoiler","Spoiler","shadow","Ruins the game for others; envy as spectatorship.","The Heckler of others' joy."],
["cameo","Cameo","stage","Appears briefly and steals the scene; small part, large shadow.","The Scene-stealer who cannot share the stage."],
["tipster","Tipster","coin","Sells certainty about uncertain things; tips as trade.","The Tout whose sure things sink."],
["obituarist","Obituarist","lore","Writes the final summaries; lives compressed to paragraphs.","The Last word that buries grudges with praise."],
["empty-nester","Empty Nester","hearth","The house gone quiet; purpose renegotiated.","The Clinger redecorating the child's room as a shrine."]];
  function str(s) { return String(s == null ? "" : s); }
  function norm(s) { return str(s).toLowerCase().trim().replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]+/g, ""); }
  function rec(r) { return { id: r[0], name: r[1], domain: r[2], essence: r[3], shadow: r[4] }; }
  function client(rawOpts) {
    var opts = rawOpts || {};
    var extra = Array.isArray(opts.archetypes) ? opts.archetypes : [];
    function say(t) { if (typeof opts.say === "function") { try { opts.say(t); } catch (e) {} } }
    function all() {
      var out = A.map(rec);
      for (var i = 0; i < extra.length; i++) {
        var e = extra[i];
        if (e && e.id && e.name) out.push({ id: norm(e.id), name: str(e.name), domain: str(e.domain || "wild"), essence: str(e.essence || e.description || ""), shadow: str(e.shadow || "") });
      }
      return out;
    }
    function find(id) {
      var k = norm(id);
      var list = all();
      for (var i = 0; i < list.length; i++) if (list[i].id === k) return list[i];
      return null;
    }
    function get(id) {
      var r = find(id);
      if (!r) return { ok: false, error: "NO SUCH FACE - " + str(id == null ? "" : id).toUpperCase() + " IS NOT IN THE PACK. TRY search() OR domains()." };
      return { ok: true, id: r.id, name: r.name, domain: r.domain, essence: r.essence, shadow: r.shadow };
    }
    function domains() {
      var counts = {}, list = all(), i;
      for (i = 0; i < list.length; i++) counts[list[i].domain] = (counts[list[i].domain] || 0) + 1;
      return Object.keys(counts).sort().map(function (d) { return { domain: d, count: counts[d] }; });
    }
    function byDomain(d) {
      var k = norm(d);
      var hit = all().filter(function (r) { return r.domain === k; });
      if (!hit.length) return { ok: false, error: "NO SUCH DOMAIN - " + str(d == null ? "" : d).toUpperCase() + " HOLDS NOTHING. TRY domains()." };
      return { ok: true, domain: k, count: hit.length, faces: hit.map(function (r) { return { id: r.id, name: r.name }; }) };
    }
    function search(q) {
      var k = str(q).toLowerCase().trim();
      if (k.length < 2) return { ok: false, error: "TOO SHORT - GIVE AT LEAST TWO LETTERS TO SEARCH BY." };
      var hit = all().filter(function (r) {
        return r.name.toLowerCase().indexOf(k) > -1 || r.essence.toLowerCase().indexOf(k) > -1 || r.shadow.toLowerCase().indexOf(k) > -1 || r.domain.indexOf(k) > -1;
      }).slice(0, 50);
      return { ok: true, query: k, count: hit.length, faces: hit.map(function (r) { return { id: r.id, name: r.name, domain: r.domain }; }) };
    }
    function pick(o) {
      var q = o || {};
      var pool = all();
      if (q.domain) {
        var k = norm(q.domain);
        pool = pool.filter(function (r) { return r.domain === k; });
        if (!pool.length) return { ok: false, error: "NO SUCH DOMAIN - " + str(q.domain).toUpperCase() + " HOLDS NOTHING." };
      }
      var ex = {};
      (Array.isArray(q.exclude) ? q.exclude : [q.exclude]).forEach(function (e) { if (e) ex[norm(e)] = 1; });
      pool = pool.filter(function (r) { return !ex[r.id]; });
      if (!pool.length) return { ok: false, error: "NOTHING LEFT TO DRAW - EVERY FACE IS EXCLUDED." };
      var r = pool[Math.floor(Math.random() * pool.length)];
      return { ok: true, id: r.id, name: r.name, domain: r.domain, essence: r.essence, shadow: r.shadow };
    }
    function roleDef(r, tag) {
      return {
        id: "arch-" + r.id,
        title: r.name,
        subtitle: "ARCHETYPE · " + r.domain.toUpperCase() + (tag ? " · " + tag : ""),
        description: r.essence + (r.shadow ? " Shadow: " + r.shadow : "")
      };
    }
    function persona(id) {
      var r = find(id);
      if (!r) return { ok: false, error: "NO SUCH FACE - " + str(id == null ? "" : id).toUpperCase() + " IS NOT IN THE PACK." };
      return { ok: true, def: roleDef(r, null) };
    }
    function blend(a, b) {
      var r1 = find(a), r2 = find(b);
      if (!r1 || !r2) return { ok: false, error: "BLEND NEEDS TWO FACES THAT EXIST - " + (!r1 ? str(a == null ? "" : a).toUpperCase() : str(b == null ? "" : b).toUpperCase()) + " IS NOT IN THE PACK." };
      var r = { id: r1.id + "-x-" + r2.id, name: r1.name + " / " + r2.name, domain: r1.domain + "+" + r2.domain, essence: r1.essence + " Fused with " + r2.essence, shadow: r1.shadow + " " + r2.shadow };
      return { ok: true, def: roleDef(r, "BLEND") };
    }
    return {
      list: function () { return all().map(function (r) { return { id: r.id, name: r.name, domain: r.domain }; }); },
      get: get, domains: domains, byDomain: byDomain, search: search, pick: pick,
      persona: persona, blend: blend,
      count: function () { return { archetypes: all().length, domains: domains().length }; },
      voice: function (s) { say(str(s)); return { ok: true }; }
    };
  }
  return { client: client };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.MythosArchetypes;
