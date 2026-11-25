package game

import "math"

const (
	TickMS   = 600
	MaxLevel = 50
)

func Ticks(seconds float64) int { return int(math.Ceil(seconds * 1000 / TickMS)) }

// XPForLevel is paced by TestPace: about 15 hours to level 50 with intense methods.
func XPForLevel(n int) int {
	steps := float64(n - 1)
	return int(math.Floor(60*steps + 1.4*math.Pow(steps, 3.6)))
}

func MaxHP(vitality int) int { return 20 + 3*vitality }

func round(v float64) int { return int(math.Floor(v + 0.5)) }

func clamp(v, lo, hi float64) float64 { return math.Max(lo, math.Min(hi, v)) }

var xpTable = func() (t [MaxLevel + 1]int) {
	for n := 1; n <= MaxLevel; n++ {
		t[n] = XPForLevel(n)
	}
	return
}()

func LevelForXP(xp int) int {
	n := 1
	for n < MaxLevel && xp >= xpTable[n+1] {
		n++
	}
	return n
}

var beats = map[string]string{"melee": "ranged", "ranged": "magic", "magic": "melee"}

// StyleModifier takes an empty defender style for "neutral".
func StyleModifier(attacker, defender string) float64 {
	if defender == "" || attacker == defender {
		return 1
	}
	if beats[attacker] == defender {
		return 1.2
	}
	return 0.8
}

func HitChance(level int, accuracy, defence, armour, mod float64) float64 {
	a, d := 10+float64(level)*1.5+accuracy, 6+defence+armour
	return clamp(a/(a+d)*1.25*mod, 0.1, 0.95)
}

func MaxHit(level int, power float64) int {
	return int(math.Floor(2 + float64(level)*0.22 + power*0.35))
}

func BossMaxHP(base float64, players int) float64 {
	return float64(round(base * (1 + 0.5*float64(max(1, players)-1))))
}

func GatherChance(level, req, toolTier int) float64 {
	return math.Min(0.95, 0.3+float64(level-req)*0.015+float64(toolTier)*0.08)
}

// burnAtFirst is the chance to burn food at the level a recipe needs.
const burnAtFirst = 0.4

// BurnChance falls as the level rises, to nothing at the recipe's safe level.
func BurnChance(level, req, safe int) float64 {
	if level >= safe {
		return 0
	}
	return burnAtFirst * float64(safe-level) / float64(safe-req)
}

// LampXP is about ten minutes of a relaxed method at a level.
func LampXP(level int) float64 { return 600 * (3 + 0.009*float64(level*level)) }

// Mulberry is a small seeded generator, identical to the browser's.
func Mulberry(seed uint32) func() float64 {
	return func() float64 {
		seed += 0x6d2b79f5
		t := (seed ^ seed>>15) * (1 | seed)
		t = (t + (t^t>>7)*(61|t)) ^ t
		return float64(t^t>>14) / 4294967296
	}
}

func nameHash(s string) int {
	h := 0
	for _, c := range s {
		h = (h*31 + int(c)) % 9973
	}
	return h
}

// SellPrice is what a shop pays for some items, rounded down.
func SellPrice(value, qty, percent int) int { return value * qty * percent / 100 }

// DeathFee is what reclaiming some items costs after dying: rounded up, and at least one coin.
func DeathFee(value, qty, percent int) int { return max(1, (value*qty*percent+99)/100) }
