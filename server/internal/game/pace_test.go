package game

import (
	"fmt"
	"testing"

	"driftwake/content"
)

// These tests let a bot train, to hold the experience table to the pace in docs/design.md.

const (
	reaction   = 2 // ticks a player takes to notice and click
	bankVisit  = 5 // ticks spent at the bank
	sampleTime = 2400
)

// gatherer is a bot that trains one skill with one kind of node.
type gatherer struct {
	*env
	p         *Player
	nodes     []*Node
	chaseGlow bool
	wait      int
	earned    int
	ticks     int
}

func newGatherer(t *testing.T, kind, m string, level int, chaseGlow bool) *gatherer {
	e := setup(t)
	g := &gatherer{env: e, p: e.player(1), chaseGlow: chaseGlow}
	for _, n := range e.w.nodes {
		if n.Def.ID == kind && n.Map.ID == m {
			g.nodes = append(g.nodes, n)
		}
	}
	setLevel(g.p, level)
	g.p.C.NoFightBack = true // this measures skilling, beside monsters that may attack
	tool := g.nodes[0].Def.Tool
	tier := 0
	for i := 1; i <= 5; i++ {
		if item := content.Items[toolID(tool, i)]; item != nil && level >= item.Req[g.skill()] && level > 2 {
			tier = i
		}
	}
	clear(g.p.C.Inv)
	g.p.give(toolID(tool, tier), 1)
	e.beside(g.p, g.nodes[0])
	return g
}

func (g *gatherer) skill() string { return g.nodes[0].Def.Skill }

// rate is experience per second.
func (g *gatherer) rate() float64 {
	level := g.p.C.XP[g.skill()]
	for g.ticks < sampleTime {
		g.step()
		g.earned += g.p.C.XP[g.skill()] - level
		g.p.C.XP[g.skill()] = level
	}
	return float64(g.earned) / (float64(g.ticks) * TickMS / 1000)
}

func (g *gatherer) step() {
	g.p.C.HP = 1e6
	if g.p.emptySlot() < 0 {
		g.bank()
	}
	if target := g.choose(); target != nil && (g.p.act.typ != actGather || g.p.act.id != target.ID) {
		if g.wait++; g.wait > reaction {
			g.wait = 0
			g.do(g.p, gatherMsg(target.ID), 0)
		}
	}
	g.run(1)
	g.ticks++
}

// gatherKinds are the nodes of each gathering skill, as in rock_1.
var gatherKinds = []string{"rock", "tree", "spot"}

// relaxedKinds are the nodes that never run out, by the nodes of the intense method.
var relaxedKinds = map[string]string{"rock": "big_rock", "spot": "shoal"}

// choose is the glowing node, or the nearest one that is not depleted. Nil keeps going.
func (g *gatherer) choose() *Node {
	if g.chaseGlow {
		for _, n := range g.nodes {
			if n.isGlowing(g.w.Tick) {
				return n
			}
		}
	}
	if g.p.act.typ == actGather {
		return nil
	}
	var best *Node
	for _, n := range g.nodes {
		if n.depletedUntil <= g.w.Tick && (best == nil || g.distance(n) < g.distance(best)) {
			best = n
		}
	}
	return best
}

func (g *gatherer) distance(n *Node) int { return max(abs(n.X-g.p.C.X), abs(n.Y-g.p.C.Y)) }

// bank counts the time of a walk to the bank and back without taking it.
func (g *gatherer) bank() {
	bank := g.w.mapOf(g.p).Station("bank")
	away := max(abs(bank.X-g.p.C.X), abs(bank.Y-g.p.C.Y))
	g.ticks += 2*away/walkSpeed + bankVisit
	clear(g.p.C.Inv[1:])
}

// hours it takes from one level to another, with a method per level.
func hours(t *testing.T, from, to int, method func(level int) *gatherer) float64 {
	seconds := 0.0
	for level := from; level < to; level += 5 {
		rate := method(level).rate()
		next := min(level+5, to)
		seconds += float64(XPForLevel(next)-XPForLevel(level)) / rate
		t.Logf("level %d: %.1f xp/s, %.1f h", level, rate, seconds/3600)
	}
	return seconds / 3600
}

func tierAt(level int) int { return max(1, min(5, level/10+1)) }

func basicMethod(t *testing.T, kind string) func(int) *gatherer {
	return func(level int) *gatherer {
		return newGatherer(t, fmt.Sprintf("%s_%d", kind, tierAt(level)), homeOf(level), level, false)
	}
}

func homeOf(level int) string {
	if level < 10 {
		return "island"
	}
	return "mainland"
}

func TestPaceOfTheFirstLevels(t *testing.T) {
	for _, kind := range gatherKinds {
		if h := hours(t, 1, 10, basicMethod(t, kind)); h > 0.5 {
			t.Errorf("%s: level 10 takes %.2f hours", kind, h)
		}
	}
}

func TestPaceOfIntenseMethods(t *testing.T) {
	for _, kind := range gatherKinds {
		h := hours(t, 1, MaxLevel, func(level int) *gatherer {
			return newGatherer(t, fmt.Sprintf("%s_%d", kind, tierAt(level)), homeOf(level), level, level >= content.Methods.Level)
		})
		if h < 12 || h > 18 {
			t.Errorf("%s: level 50 takes %.1f hours, not about 15", kind, h)
		}
	}
}

func TestPaceOfRelaxedMethods(t *testing.T) {
	for _, kind := range gatherKinds {
		h := hours(t, 1, MaxLevel, func(level int) *gatherer {
			if relaxed := relaxedKinds[kind]; relaxed != "" && level >= content.Methods.Level {
				return newGatherer(t, fmt.Sprintf("%s_%d", relaxed, tierAt(level)), "mainland", level, false)
			}
			return basicMethod(t, kind)(level)
		})
		if h < 29 || h > 41 {
			t.Errorf("%s: level 50 takes %.1f hours, not about 35", kind, h)
		}
	}
}

// fightRate is the experience per second of a bot with the best sword it can hold.
func fightRate(t *testing.T, level int, skill string) float64 {
	e := setup(t)
	p := e.player(1)
	setLevel(p, level)
	clear(p.C.Inv)
	sword := "worn_sword"
	if level > 2 {
		sword = content.Metals[tierAt(level)] + "_sword"
	}
	p.C.Equip["weapon"] = &Stack{sword, 1}
	var prey []*Monster
	for _, m := range e.w.monsters {
		if m.Def.ID == preyAt(level) {
			prey = append(prey, m)
		}
	}
	e.at(p, prey[0].X, prey[0].Y, prey[0].Map.ID)
	before, earned, wait := p.C.XP[skill], 0, 0
	for range sampleTime {
		p.C.HP = 1e6
		if target := nearestAlive(p, prey); p.act.typ == actNone && target != nil {
			if wait++; wait > reaction {
				wait = 0
				e.do(p, attackMsg(target.ID), 0)
			}
		}
		e.run(1)
		earned += p.C.XP[skill] - before
		p.C.XP[skill] = before
	}
	return float64(earned) / (sampleTime * TickMS / 1000)
}

func preyAt(level int) string {
	best := ""
	for _, id := range []string{"boar", "wolf", "golem", "drake", "stag"} {
		if best == "" || content.Monsters[id].Level <= level+4 {
			best = id
		}
	}
	return best
}

func nearestAlive(p *Player, prey []*Monster) (best *Monster) {
	away := func(m *Monster) int { return RectDist(p.C.X, p.C.Y, m.rect()) }
	for _, m := range prey {
		if !m.Dead && (best == nil || away(m) < away(best)) {
			best = m
		}
	}
	return
}

func TestPaceOfCombat(t *testing.T) {
	for _, skill := range []string{melee, "defence"} {
		seconds := 0.0
		for level := 1; level < MaxLevel; level += 3 {
			next := min(level+3, MaxLevel)
			rate := fightRate(t, level, skill)
			seconds += float64(XPForLevel(next)-XPForLevel(level)) / rate
			t.Logf("%s level %d: %.1f xp/s, %.1f h", skill, level, rate, seconds/3600)
			if next == 10 && seconds > 1800 {
				t.Errorf("%s: level 10 takes %.2f hours", skill, seconds/3600)
			}
		}
		if h := seconds / 3600; h < 12 || h > 41 {
			t.Errorf("%s: level 50 takes %.1f hours", skill, h)
		}
	}
}

// maker is a bot that makes the recipe of a skill with the most experience it can, with materials from the bank.
type maker struct {
	*env
	p       *Player
	recipe  *content.Recipe
	intense bool
	wait    int
	ticks   int
}

func newMaker(t *testing.T, recipe *content.Recipe, level int, intense bool) *maker {
	e := setup(t)
	k := &maker{env: e, p: e.player(1), recipe: recipe, intense: intense}
	setLevel(k.p, level)
	e.atStation(k.p, k.recipe.Station, homeOf(level))
	return k
}

// bestRecipe gives the most experience per item; of two alike, the one that needs fewer materials.
func bestRecipe(skill string, level int) (best *content.Recipe) {
	for _, r := range content.Recipes {
		if r.Skill != skill || r.Level > level {
			continue
		}
		if best == nil || r.XP > best.XP || r.XP == best.XP && slotsPerItem(r) < slotsPerItem(best) {
			best = r
		}
	}
	return
}

// slotsPerItem is the room in the inventory that the materials of one item take.
func slotsPerItem(r *content.Recipe) int {
	n := 0
	for _, in := range r.In {
		if !content.Items[in.Item].Stack {
			n += in.Qty
		}
	}
	return n
}

// rate is experience per second.
func (k *maker) rate() float64 {
	skill := k.recipe.Skill
	level, earned := k.p.C.XP[skill], 0
	for k.ticks < sampleTime {
		k.step()
		earned += k.p.C.XP[skill] - level
		k.p.C.XP[skill] = level
	}
	return float64(earned) / (float64(k.ticks) * TickMS / 1000)
}

func (k *maker) step() {
	if k.p.act.typ != actCraft {
		if k.wait++; k.wait > reaction {
			k.wait = 0
			k.bank()
			k.do(k.p, cookMsg(k.recipe.ID, 999, k.intense), 0)
		}
	} else if ready, _ := k.p.onFire(); ready > 0 && k.w.Tick >= ready+reaction {
		k.do(k.p, takeOffMsg, 0)
	}
	k.run(1)
	k.ticks++
}

// bank counts the time of a walk to the bank and back, and fills the inventory with materials.
func (k *maker) bank() {
	bank := k.w.mapOf(k.p).Station("bank")
	away := max(abs(bank.X-k.p.C.X), abs(bank.Y-k.p.C.Y))
	k.ticks += 2*away/walkSpeed + bankVisit
	clear(k.p.C.Inv)
	items := 50
	if slots := slotsPerItem(k.recipe); slots > 0 {
		items = (content.InvSize - (len(k.recipe.In) - 1)) / slots
	}
	for _, in := range k.recipe.In {
		k.p.give(in.Item, in.Qty*items)
	}
}

// fastestRecipe is the recipe of a skill that gives the most experience per second at a level, with its rate. Most
// experience per item is not enough: a recipe of fewer materials needs fewer walks to the bank.
func fastestRecipe(t *testing.T, skill string, level int, intense bool) (best *content.Recipe, rate float64) {
	for _, r := range content.Recipes {
		if r.Skill != skill || r.Level > level {
			continue
		}
		if got := newMaker(t, r, level, intense).rate(); got > rate {
			best, rate = r, got
		}
	}
	return
}

// mostPerItem makes bestRecipe, which is quicker to find than fastestRecipe where a skill has many recipes.
func mostPerItem(t *testing.T, skill string, level int, intense bool) (*content.Recipe, float64) {
	r := bestRecipe(skill, level)
	return r, newMaker(t, r, level, intense).rate()
}

// makingHours it takes from one level to another, making the recipe that choose picks at each level.
func makingHours(
	t *testing.T,
	choose func(*testing.T, string, int, bool) (*content.Recipe, float64),
	skill string,
	from, to int,
	intense bool,
) float64 {
	seconds := 0.0
	for level := from; level < to; level += 5 {
		recipe, rate := choose(t, skill, level, intense)
		next := min(level+5, to)
		seconds += float64(XPForLevel(next)-XPForLevel(level)) / rate
		t.Logf("level %d: %s, %.1f xp/s, %.1f h", level, recipe.ID, rate, seconds/3600)
	}
	return seconds / 3600
}

func TestPaceOfCooking(t *testing.T) {
	if h := makingHours(t, fastestRecipe, "cooking", 1, 10, false); h > 0.5 {
		t.Errorf("level 10 takes %.2f hours", h)
	}
	if h := makingHours(t, fastestRecipe, "cooking", 1, MaxLevel, true); h < 12 || h > 18 {
		t.Errorf("intense: level 50 takes %.1f hours, not about 15", h)
	}
	if h := makingHours(t, fastestRecipe, "cooking", 1, MaxLevel, false); h < 29 || h > 41 {
		t.Errorf("relaxed: level 50 takes %.1f hours, not about 35", h)
	}
}

// Crafting lost its food to cooking. It must still be trained from level 1, and quickly at first. Its whole pace
// is set by gathering the materials, which the bot does not do, so it is only logged.
func TestPaceOfCrafting(t *testing.T) {
	for level := 1; level < MaxLevel; level++ {
		check(t, bestRecipe("crafting", level) != nil, level)
	}
	if h := makingHours(t, mostPerItem, "crafting", 1, 10, false); h > 0.5 {
		t.Errorf("level 10 takes %.2f hours", h)
	}
	t.Logf("level 50 takes %.1f hours at the workbench", makingHours(t, mostPerItem, "crafting", 1, MaxLevel, false))
}
