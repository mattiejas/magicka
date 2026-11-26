package game

import (
	"fmt"
	"testing"

	"driftwake/content"
)

func TestMineSmeltSmith(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	n := e.node("rock_1", "island")
	for i := 0; i < 400 && p.count("copper_ore") < 4; i++ {
		if p.act.typ == actNone {
			e.do(p, gatherMsg(n.ID), 0)
		}
		e.run(1)
	}
	check(t, p.count("copper_ore") >= 4 && p.C.XP["mining"] > 0)
	p.give("ash_log", 1)
	e.atStation(p, "furnace", "island")
	e.do(p, craftMsg("copper_bar", 2), 12)
	eq(t, p.count("copper_bar"), 2)
	e.atStation(p, "anvil", "island")
	e.do(p, craftMsg("copper_pickaxe", 1), 8)
	eq(t, p.count("copper_pickaxe"), 1)
	eq(t, p.count("copper_bar"), 0)
}

var toolsByNode = map[string][]string{
	"rock": {"worn_pickaxe", "copper_pickaxe", "iron_pickaxe", "mithril_pickaxe", "cobalt_pickaxe"},
	"tree": {"worn_axe", "copper_axe", "iron_axe", "mithril_axe", "cobalt_axe"},
}

func TestNoTierCanBeSkipped(t *testing.T) {
	for kind, tools := range toolsByNode {
		for tier := 2; tier <= 5; tier++ {
			e := setup(t)
			p := e.player(1)
			setLevel(p, 50)
			p.C.NoFightBack = true // some rocks have monsters beside them
			n := e.node(fmt.Sprintf("%s_%d", kind, tier), "mainland")
			attempt := func(tool string) bool {
				clear(p.C.Inv)
				p.give(tool, 1)
				n.depletedUntil = 0
				e.at(p, n.X, n.Y-1, "mainland")
				p.C.HP, p.C.Grave = 1e6, nil
				e.do(p, gatherMsg(n.ID), 60)
				return p.C.Inv[1] != nil
			}
			check(t, !attempt(tools[tier-2]), kind, tier, "with too low a tool")
			check(t, attempt(tools[tier-1]), kind, tier)
		}
	}
}

func TestLevelAndToolAreRequired(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	p.give("copper_pickaxe", 1)
	n := e.node("rock_2", "island")
	e.at(p, n.X, n.Y-1, "island")
	e.do(p, gatherMsg(n.ID), 30)
	eq(t, p.count("iron_ore"), 0)
	clear(p.C.Inv)
	n = e.node("rock_1", "island")
	e.at(p, n.X, n.Y-1, "island")
	e.do(p, gatherMsg(n.ID), 30)
	eq(t, p.count("copper_ore"), 0)
}

func TestRecipesConserveMaterialsAndRange(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	for _, r := range content.Recipes {
		setLevel(p, 50)
		clear(p.C.Inv)
		for _, i := range r.In {
			p.give(i.Item, i.Qty)
		}
		e.at(p, 10, 30, "island")
		e.do(p, craftMsg(r.ID, 1), 5)
		eq(t, p.count(r.Out), 0, r.ID)
		e.atStation(p, r.Station, "island")
		wait := 8
		if r.Station == "fire" {
			wait = relaxedCookInterval + 5
		}
		e.do(p, craftMsg(r.ID, 5), wait)
		eq(t, p.count(r.Out), r.Qty, r.ID)
		for _, i := range r.In {
			eq(t, p.count(i.Item), 0, r.ID)
		}
	}
}
