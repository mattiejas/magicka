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
	tool := g.nodes[0].Def.Tool
	tier := 0
	for i := 1; i <= 5; i++ {
		if level >= content.Items[content.Metals[i]+"_"+tool].Req[g.skill()] && level > 2 {
			tier = i
		}
	}
	clear(g.p.C.Inv)
	g.p.give(toolID(tool, tier), 1)
	e.at(g.p, g.nodes[0].X, g.nodes[0].Y-1, m)
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
	for _, kind := range []string{"rock", "tree"} {
		if h := hours(t, 1, 10, basicMethod(t, kind)); h > 0.5 {
			t.Errorf("%s: level 10 takes %.2f hours", kind, h)
		}
	}
}

func TestPaceOfIntenseMethods(t *testing.T) {
	for _, kind := range []string{"rock", "tree"} {
		h := hours(t, 1, MaxLevel, func(level int) *gatherer {
			return newGatherer(t, fmt.Sprintf("%s_%d", kind, tierAt(level)), homeOf(level), level, level >= content.Methods.Level)
		})
		if h < 12 || h > 18 {
			t.Errorf("%s: level 50 takes %.1f hours, not about 15", kind, h)
		}
	}
}

func TestPaceOfRelaxedMethods(t *testing.T) {
	for _, kind := range []string{"rock", "tree"} {
		h := hours(t, 1, MaxLevel, func(level int) *gatherer {
			if kind == "rock" && level >= content.Methods.Level {
				return newGatherer(t, fmt.Sprintf("big_rock_%d", tierAt(level)), "mainland", level, false)
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
