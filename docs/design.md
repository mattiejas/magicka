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
- One shop per town. Sells worn pickaxe, axe and sword at 10 coins; buys everything else at half shop value.
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
- More methods open from level 15, through skill level, exploring the mainland and quests. Quests can also unlock areas. The island keeps the basic methods.
- Idle logout after 30 minutes without input.

## Adventure

- Quest **Stranded**: optional, guides the player through every boat part and ends with the boat. Gnashclaw's part is a ship's wheel.
- Encounters on the mainland, one every 5 to 8 minutes: rich vein, stranded trader, stampede.
- Genie: visits one active player, at most once per 3 hours of their play, must be clicked within a minute. Gives an untradable lamp worth about 10 minutes of relaxed XP in a chosen skill.
- First dungeon: an old mine under the mithril shelf with mithril, cobalt and a golem boss. Dungeons are shared.
- After 50: more bosses and dungeons, the economy, and a collection log. The cap stays at 50.

## Safety before going public

- Block and report players; mute, kick and ban with a log of moderator actions; offensive names refused.

## Build order

Each step ends playable, tested and committed.

1. Bosses, drop rates, ship's wheel, rename to Driftwake
2. Coins, shops, worn tools, chickens, death fees, reaper total
3. Skilling pace and methods, idle logout
4. Trading, trophies, safety tools
5. Stranded, encounters and genie, mine dungeon
6. Collection log, then the market board

Existing characters are kept until one restart at the public launch.

## Assumed, not asked

- Claiming an uncollected unique from the reaper is free, since it was never lost by dying. It waits forever.
- Mini bosses regenerate at the same rate as world bosses, and their scaling follows the same rule. Their unique stays at 1 in 12 until trading arrives.
- The death fee counts shop value at the time of collecting, rounded up, at least 1 coin per stack. Coins themselves count at face value.
- The big rock also exists for essence; there is no relaxed or intense variant of smithing and crafting yet.
