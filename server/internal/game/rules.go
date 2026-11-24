package game

// Numbers that shape play. Durations are in ticks unless they say otherwise.
const (
	viewDistance  = 24 // tiles a player is told about
	walkSpeed     = 2  // tiles per tick
	workInterval  = 3  // between attempts at gathering or crafting
	stationReach  = 2  // tiles from a station at which it can be used
	eatDelay      = 2  // before acting or attacking again
	regenInterval = 10

	defaultAttackSpeed = 4
	defaultAttackReach = 1
	xpPerDamage        = 4.0
	vitalityPerDamage  = 1.5
	gemChance          = 0.04
	wanderChance       = 0.08
	wanderRange        = 4  // tiles from home at which a monster turns back
	leashRange         = 10 // tiles from home at which a monster gives up

	lootShare       = 0.02 // contribution above which a player earns loot and makes a boss tougher
	deathKeeps      = 0.5  // share of contribution left after dying
	approachRange   = 4    // tiles at which an idle boss notices someone
	bossBarInterval = 5
)

var (
	lingerTime   = Ticks(30) // a disconnected player stays at most this long
	combatTime   = Ticks(10) // since the last blow, to count as in combat
	fightMemory  = Ticks(20) // a fighter stays active this long without a blow
	saveInterval = Ticks(30)
)

// longAgo is a tick before any fight.
const longAgo = -999

// lootTimes says how long loot is private, and how long it then lies around for everyone.
type lootTimes struct{ private, public float64 } // seconds

var (
	monsterLoot = lootTimes{60, 120}
	bossLoot    = lootTimes{180, 300}
	playerDrop  = lootTimes{60, 120}
)

// Styles and work, as clients know them.
const (
	melee  = "melee"
	ranged = "ranged"
	magic  = "magic"

	working = "craft"
	eating  = "eat"
)

// gatherAction is what a player is seen doing at each kind of node.
var gatherAction = map[string]string{"rock": "mine", "tree": "chop", "plant": "pick"}
