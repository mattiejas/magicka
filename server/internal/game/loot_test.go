package game

import (
	"testing"

	"driftwake/server/internal/pb"
)

func TestDropsSayWhenTheyDisappear(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	lying := func() (n int) {
		for id, ent := range e.c[1].ents {
			if id&kindMask == kindDrop {
				check(t, ent.Until != nil)
				n = int(*ent.Until)
			}
		}
		return
	}
	e.w.drop(e.w.mapOf(p), p.at(), "copper_ore", 1, p.ID, monsterLoot)
	e.run(1)
	until := lying()
	eq(t, until, e.w.Tick-1+Ticks(180))
	e.run(until - e.w.Tick - 1)
	eq(t, lying(), until)
	e.run(1)
	eq(t, lying(), 0)
}

func TestLootTellsItsOwnerWhenItBecomesPublic(t *testing.T) {
	e := setup(t)
	owner, other := e.player(1), e.player(2)
	e.at(owner, 20, 40, "island")
	e.at(other, 20, 40, "island")

	e.w.drop(e.w.mapOf(owner), owner.at(), "copper_ore", 1, owner.ID, monsterLoot)
	e.w.drop(e.w.mapOf(owner), owner.at(), "rootcleaver", 1, owner.ID, bossLoot)
	e.w.drop(e.w.mapOf(owner), owner.at(), "ash_log", 1, owner.ID, playerDrop)
	e.run(1)

	var ore, unique, dropped *Drop
	for _, d := range e.w.drops {
		switch d.Item {
		case "copper_ore":
			ore = d
		case "rootcleaver":
			unique = d
		case "ash_log":
			dropped = d
		}
	}
	check(t, ore != nil && unique != nil && dropped != nil)

	seen := func(n int64, id uint32) *pb.Entity { return e.c[n].ents[id] }
	eq(t, int(seen(1, ore.ID).GetPublicAt()), ore.publicAt)
	eq(t, int(seen(1, unique.ID).GetPublicAt()), 0)
	eq(t, int(seen(1, dropped.ID).GetPublicAt()), 0)
	check(t, seen(2, ore.ID) == nil && seen(2, unique.ID) == nil && seen(2, dropped.ID) == nil)

	until := int(seen(1, ore.ID).GetUntil())
	e.run(ore.publicAt - e.w.Tick)
	check(t, seen(2, ore.ID) != nil, "public on that tick")
	eq(t, int(seen(1, ore.ID).GetUntil()), until, "disappearance stays put")
	eq(t, int(seen(2, ore.ID).GetUntil()), until)
	check(t, seen(2, unique.ID) == nil && seen(2, dropped.ID) == nil)
}

func TestPickingUpFromADistanceWalksThere(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	e.at(p, 20, 40, "island")
	e.w.drop(e.w.mapOf(p), Point{X: 24, Y: 40}, "copper_ore", 1, p.ID, monsterLoot)
	d := e.w.drops[0]
	e.do(p, pickupMsg(d.ID), 20)
	eq(t, p.count("copper_ore"), 1)
	eq(t, len(e.w.drops), 0)
}

func TestFullInventoryLeavesTheDrop(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	e.at(p, 20, 40, "island")
	clear(p.C.Inv)
	p.give("ash_log", 24)
	e.w.drop(e.w.mapOf(p), p.at(), "copper_ore", 1, p.ID, monsterLoot)
	d := e.w.drops[0]
	e.do(p, pickupMsg(d.ID), 2)
	eq(t, p.count("copper_ore"), 0)
	eq(t, len(e.w.drops), 1)
	eq(t, e.w.drops[0], d)
}
