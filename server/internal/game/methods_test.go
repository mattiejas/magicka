package game

import (
	"strings"
	"testing"

	"driftwake/content"
)

// glowing waits until a node of a kind glows on the mainland.
func (e *env) glowing(kind string) *Node {
	for range 100 {
		e.run(1)
		for _, n := range e.w.nodes {
			if n.Def.ID == kind && n.isGlowing(e.w.Tick) {
				return n
			}
		}
	}
	e.t.Fatal("nothing glows")
	return nil
}

func (e *env) beside(p *Player, n *Node) {
	for _, d := range dirs {
		if x, y := n.X+d.X, n.Y+d.Y; n.Map.Walkable(x, y) {
			e.at(p, x, y, n.Map.ID)
			return
		}
	}
	e.t.Fatal("no room beside the node")
}

func TestOnlyMainlandGroupsGlow(t *testing.T) {
	e := setup(t)
	kinds := map[string]bool{}
	for range 200 {
		e.run(1)
		seen := map[string]bool{}
		for _, n := range e.w.nodes {
			if !n.isGlowing(e.w.Tick) {
				continue
			}
			eq(t, n.Map.ID, "mainland")
			check(t, !seen[n.Def.ID], "one of a group at a time", n.Def.ID)
			seen[n.Def.ID], kinds[n.Def.ID] = true, true
		}
	}
	for tier := '1'; tier <= '5'; tier++ {
		check(t, kinds["rock_"+string(tier)] && kinds["tree_"+string(tier)], string(tier))
	}
	eq(t, len(kinds), 10)
}

func TestGlowGivesOneBonusToEveryone(t *testing.T) {
	e := setup(t)
	a, b := e.player(1), e.player(2)
	n := e.glowing("rock_1")
	bonus := round(n.Def.XP * content.Methods.GlowBonus)
	for _, p := range []*Player{a, b} {
		setLevel(p, 20)
		e.beside(p, n)
	}
	before := a.C.XP["mining"]
	e.do(a, gatherMsg(n.ID), 0)
	e.do(b, gatherMsg(n.ID), glowInterval+1)
	eq(t, a.C.XP["mining"]-before, bonus)
	eq(t, b.C.XP["mining"]-before, bonus)
	for a.C.XP["mining"]-before == bonus && n.isGlowing(e.w.Tick) {
		e.run(1)
	}
	if n.isGlowing(e.w.Tick) {
		eq(t, a.C.XP["mining"]-before, bonus+int(n.Def.XP), "the second strike is an ordinary one")
	}
	check(t, n.depletedUntil == 0, "it does not run out while it glows")
}

func TestGlowNeedsLevelFifteen(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	setLevel(p, content.Methods.Level-1)
	n := e.glowing("rock_1")
	e.beside(p, n)
	before := p.C.XP["mining"]
	e.do(p, gatherMsg(n.ID), content.Methods.GlowTicks)
	check(t, (p.C.XP["mining"]-before)%int(n.Def.XP) == 0)
}

func TestBigRocksNeverRunOutAndAreSlow(t *testing.T) {
	count := func(kind string) int {
		e := setup(t)
		p := e.player(1)
		setLevel(p, 20)
		n := e.node(kind, "mainland")
		e.beside(p, n)
		total := 0
		for range 3000 {
			n.Def = content.Nodes[kind]
			n.depletedUntil = 0
			if p.act.typ != actGather {
				e.do(p, gatherMsg(n.ID), 0)
			}
			e.run(1)
			if have := p.count("copper_ore"); have > 0 {
				total += have
				p.take("copper_ore", have)
			}
			clear(p.C.Inv[3:])
		}
		return total
	}
	big, usual := count("big_rock_1"), count("rock_1")
	ratio := float64(big) / float64(usual)
	check(t, ratio > 0.25 && ratio < 0.45, big, usual)
}

func TestBigRocksNeedLevelFifteen(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	setLevel(p, 14)
	n := e.node("big_rock_1", "mainland")
	e.beside(p, n)
	e.do(p, gatherMsg(n.ID), 60)
	eq(t, p.count("copper_ore"), 0)
}

func TestHigherTreesGiveMoreLogs(t *testing.T) {
	last := 0.0
	for _, kind := range []string{"tree_1", "tree_2", "tree_3", "tree_4", "tree_5"} {
		logs := 1 / content.Nodes[kind].Deplete
		check(t, logs > last, kind)
		last = logs
	}
	eq(t, round(last), 15)
}

func TestRelaxedSpotsAreOutOfReach(t *testing.T) {
	e := setup(t)
	quiet := map[string]int{}
	for _, n := range e.w.nodes {
		if n.Map.ID != "mainland" {
			continue
		}
		safe := true
		for _, m := range e.w.monsters {
			reach := wanderRange + m.Def.Aggro
			if m.Map == n.Map && m.Def.Aggro > 0 && RectDist(m.home.X, m.home.Y, n.rect()) < reach {
				safe = false
			}
		}
		if safe {
			quiet[n.Def.ID]++
		}
		check(t, safe || !strings.HasPrefix(n.Def.ID, "big_"), n.Def.ID)
	}
	for _, kind := range []string{"tree_1", "tree_2", "tree_3", "tree_4", "tree_5"} {
		check(t, quiet[kind] >= 3, kind, quiet[kind])
	}
}

func TestEveryNodeCanBeReached(t *testing.T) {
	e := setup(t)
	for _, n := range e.w.nodes {
		s := n.Map.Spawn
		path := e.w.finder.find(n.Map, s.X, s.Y, n.rect(), 1)
		check(t, len(path) > 0, n.Def.ID, n.Map.ID, n.X, n.Y)
	}
}

func TestOldExperienceKeepsItsLevel(t *testing.T) {
	for n := 1; n <= MaxLevel; n++ {
		c := NewChar()
		c.Curve = 0
		c.XP["mining"] = firstCurve(n)
		c.fill()
		eq(t, c.XP["mining"], XPForLevel(n))
		c.fill()
		eq(t, c.XP["mining"], XPForLevel(n), "only once")
	}
	c := NewChar()
	c.Curve = 0
	c.XP["mining"] = (firstCurve(20) + firstCurve(21)) / 2
	c.fill()
	eq(t, LevelForXP(c.XP["mining"]), 20)
}

func TestIdlePlayersAreLoggedOut(t *testing.T) {
	e := setup(t)
	p, q := e.player(1), e.player(2)
	e.run(idleLimit - 10)
	e.do(q, chatMsg("still here"), 1)
	check(t, e.w.players[p.ID] != nil)
	e.run(20)
	check(t, e.w.players[p.ID] == nil, "the idle one")
	check(t, e.w.players[q.ID] != nil, "the one who spoke")
	kicked := ""
	for _, m := range e.c[1].msgs {
		kicked += m.GetKicked()
	}
	check(t, kicked != "")
}
