# Driftwake: agreed design

Terms are defined in [GLOSSARY.md](../GLOSSARY.md). Numbers are starting points to tune. "Driftwake" is a working name whose availability has not been checked.

## Direction

- For a public community of roughly 50 to 200 online. Success: strangers come back in their second week.
- An adventure sandbox. Players decide where to go; skilling and bossing feed each other.
- One character can master every skill and all three combat styles.

## Bosses

- Health: base + 50% of base for each further player. Only players above 2% contribution count.
- Regenerates 0.2% of maximum health per second, in a fight and when left alone. Set per boss. No time limit.
- Healing shrinks everyone's contribution in proportion. Leaving does not forfeit what remains.
- Death halves contribution. Above 2% still earns a personal loot roll.
- Common and rare loot becomes public after 3 minutes. An unclaimed unique goes to the reaper for its owner.
- World boss uniques: 1 in 400 each. World boss trophy: 1 in 1,000, cosmetic.
- Bosses drop materials that suit them (a tree gives wood, a golem gives ore), scaled to the boss's tier. An addition to skilling, not a replacement; level requirements still apply.

## Money and death

- Every item has a shop value. Coins come from monsters, bosses and selling.
- One shop per town. Sells worn pickaxe, axe, fishing rod and sword at 10 coins; buys everything else at half shop value.
- Chickens near camp can be killed bare-handed and drop 1 to 4 coins.
- Equipped gear is kept on death. Carried items, coins included, go to the grave and never expire.
- Reclaiming costs 5% of an item's shop value at the grave, 10% at the reaper. Paid per item from carried, banked or grave coins. What a player cannot afford waits forever.
- Fees leave the game. The reaper has a dialogue option showing the all-time total taken from all players.

## Trading

- Face to face, both players confirming. A market board later, once enough people play.
- Everything trades except trophies and worn tools. See [decision 0001](adr/0001-uniques-trade-trophies-do-not.md).
- Trophies: a cosmetic per world boss, and a cape for reaching 50 in a skill.
- Dropped items never become public.

## Skilling

- To level 50: about 15 hours intense, about 35 relaxed. First ten levels under 30 minutes.
- Intense: one rock in a group glows for a few seconds and gives bonus XP. Higher tiers add danger.
- Relaxed: a big rock that never depletes, at about a third of normal speed. Trees fall at random after about 4 (ash), 6, 8, 11 and 15 (ebony) logs; higher tiers chop slower.
- Fishing catches one raw fish per tier at fishing spots on the water beside the shore, with a fishing rod. Raw fish heals nothing until it is cooked. The island has tiers 1 and 2, the mainland the rest. Intense: a spot moves along the shore after a few catches, and one of a group glows. Relaxed: a shoal that never moves.
- More methods open from level 15, through skill level, exploring the mainland and quests. Quests can also unlock areas. The island keeps the basic methods.
- Cooking turns raw meat and the fish of fishing into food at a cooking fire in camp and in town. Trail rations and hearty feasts are cooked, no longer crafted. Relaxed: the fire cooks a whole stack by itself, slowly, and food burns by chance. Intense: one at a time, taken off the fire when it is done, for more experience.
- Idle logout after 30 minutes without input.

## Adventure

- Quest **Stranded**: optional, guides the player through every boat part and ends with the boat. Gnashclaw's part is a ship's wheel.
- Encounters on the mainland, one every 5 to 8 minutes: rich vein, stranded trader, stampede.
- Genie: visits one active player, at most once per 3 hours of their play, must be clicked within a minute. Gives an untradable lamp worth about 10 minutes of relaxed XP in a chosen skill.
- First dungeon: an old mine under the mithril shelf with mithril, cobalt and a golem boss. Dungeons are shared.
- After 50: more bosses and dungeons, the economy, and a collection log. The cap stays at 50.

## Sea

- The finished boat sails on a sea map that holds the island and the mainland as they are, and small islands to find. Prototyped in #109.
- Handling: sail settings backing, stopped, half and full sail aim at -0.8, 0, 1.6 and 3 tiles a tick, eased at +0.35 and -0.45 a tick; a turning radius of 3 tiles, at most 40° a tick. Click sets a course the helm steers for, with no pathfinding; A and D steer by hand. Land stops the boat; above 1.8 tiles a tick it is a hard grounding.
- Going ashore anywhere, at no more than 0.6 tiles a tick and within 1.6 tiles of land. The boat stays moored where it was left; the dock brings it round.
- A lookout sees 10 tiles. Each player's chart remembers what they saw; sighting a place puts its outline on it.
- No wind, currents or crew for now.

## Safety before going public

- Block and report players; mute, kick and ban with a log of moderator actions; offensive names refused.

## Build order

Each step ends playable, tested and committed.

1. ~~Bosses, drop rates, ship's wheel, rename to Driftwake~~ done
2. ~~Coins, shops, worn tools, chickens, death fees, reaper total~~ done
3. ~~Skilling pace and methods, idle logout~~ done
4. ~~Trading, trophies, safety tools~~ done
5. ~~Stranded, encounters and genie, mine dungeon~~ done
6. ~~Collection log~~ done, then the market board

Existing characters are kept until one restart at the public launch.

## Assumed, not asked

- Claiming an uncollected unique from the reaper is free, since it was never lost by dying. It waits forever.
- Mini bosses regenerate at the same rate as world bosses, and their scaling follows the same rule. Gnashclaw's unique is 1 in 50 since trading arrived.
- Gnashclaw's double snap does 12 to 16 damage and his water jet 9 to 14, measured in `gnashclaw_test.go`. A snap at someone on a corner beside him marks that corner and the tile on each side of it. Snaps are for whoever is beside him, the jet for everyone else.
- The death fee counts shop value at the time of collecting, rounded up, at least 1 coin per stack. Coins themselves count at face value.
- Trees glow like rocks do, so that woodcutting has an intense method too. A glowing node gives everyone one sure strike at 1.5 times the XP, lasts about seven seconds, and needs a group of at least four.
- Danger at higher tiers means aggressive monsters beside the mithril, cobalt and adamantite rocks. Big rocks, and a few trees of every tier, stand out of their reach.
- Combat skills follow the same XP table, at about 14 hours to level 50 with a sword. Characters from before keep their levels.
- The pace is measured with bots that bank what they gather (`pace_test.go`): 13 to 17 hours intense, 34 to 37 relaxed. Fishing: 14.3 intense, 36.6 relaxed, level 10 in about 20 minutes.
- Fish are perch, trout, pike, salmon and sturgeon, as `raw_<fish>`. Only a worn rod exists; until rods come by tier it catches every fish, and each spot is as easy as with a tool of its tier. Fishing spots move among eight or fewer places of a group, half of which hold a spot at a time, about every five catches. The mainland has spots of tiers 2 to 5 and a shoal of every tier, away from what attacks. New characters carry a worn rod like their other worn tools.
- Trophies cannot be dropped or sold either, so they cannot be lost. A cape for level 50 is given at once, or kept by the reaper when there is no room. Orrumax's trophy is the Rooted mantle.
- Dropped items stay visible to their owner for three minutes and are then gone.
- Any change to an offer takes back both acceptances, and offers can only be accepted two seconds after a change.
- Blocking hides a player's chat and trade requests. Reports keep the last things the reported player said. Moderators are named in the server's settings and type `/mod` in chat.
- Stranded pays 300 coins and 5 trail rations, and is offered until the boat is finished. Steps may be done in any order, but are ticked off in order.
- A rich vein never runs out for three minutes and gives two ore per strike. A stranded trader stays four minutes and buys up to 50 of one material from each player at double its value. A stampede crosses the main road within two minutes. Encounters only start while someone is on the mainland.
- Only time with input in the last five minutes counts as play for the genie.
- The old mine's boss is Deepstone, which drops mithril, cobalt and, 1 in 100, the Stoneheart. Whoever dies in the mine wakes up in the mainland town; their grave stays in the mine.
- The big rock also exists for essence; there is no relaxed or intense variant of smithing and crafting yet.
- Cooking's two methods work from level 1, since a fire needs no exploring. Food burns 40% of the time at its recipe's level, falling evenly to never at 20 levels above it, or at level 50 for dishes above 30. Burnt food gives no experience and is worth nothing. With the intense method, food is done after 2.4 seconds, a little longer for dishes of higher levels, and burns 2.4 seconds after that; taken off in time it never burns and gives 1.5 times the experience. The relaxed method cooks one item every 6.6 seconds. Measured at the fire with materials from the bank, cooking whatever gives the most experience per second (`pace_test.go`): 15 hours intense, 35 relaxed. Gathering the meat is not counted.
- Recipes, with the level they need and what they heal: cooked meat (1, 8), trail ration (1, 12), hearty feast (25, 26), and each fish at the level it is caught: perch (1, 6), trout (10, 10), pike (20, 15), salmon (30, 20), sturgeon (40, 25). A fish takes one slot where a feast takes four, so fish need fewer walks to the bank: intense, trout and pike are a little quicker than rations from 10 to 25, and sturgeon a little quicker than feasts from 40. Feasts stay the quickest from 25 to 40, and with the relaxed method throughout, because they burn less. Catching the fish is not counted.
- Experience earned making rations and feasts before cooking stays crafting experience. Crafting is still trained from level 1 with shafts and arrows.
- The collection log holds every boss's rare drops, uniques and trophies, per boss, and the capes. What a boss always or commonly drops, and encounters, do not count. A find counts when the boss drops it for a player, whether or not they are there or pick it up, so trading cannot fill the log. From before the log only trophies are known, since anything else could have been traded for. Each boss also shows how many kills earned loot, and the chance of each missing drop. Only the owner can see their log.
