package game

import (
	"encoding/json"
	"testing"
)

func TestEveryStyleKillsAndLoots(t *testing.T) {
	kits := map[string][2]string{
		melee:  {"iron_sword", ""},
		ranged: {"pine_bow", "iron_arrow"},
		magic:  {"pine_staff", "essence"},
	}
	for style, kit := range kits {
		e := setup(t)
		p := e.player(1)
		setLevel(p, 15)
		p.C.Equip["weapon"] = &Stack{kit[0], 1}
		if kit[1] != "" {
			p.C.Equip["ammo"] = &Stack{kit[1], 500}
		}
		m := e.monster("boar")
		e.at(p, m.X+1, m.Y, "island")
		xp := p.C.XP[style]
		for i := 0; i < 200 && !m.Dead; i++ {
			if p.act.typ == actNone {
				e.do(p, attackMsg(m.ID), 0)
			}
			e.run(1)
		}
		check(t, m.Dead && p.C.XP[style] > xp, style)
		if kit[1] != "" {
			check(t, p.C.Equip["ammo"].Qty < 500)
		}
		for _, d := range e.w.drops {
			if d.Item == "hide_1" {
				e.do(p, pickupMsg(d.ID), 15)
				break
			}
		}
		eq(t, p.count("hide_1"), 1, style)
	}
}

func TestBowNeedsArrowsNoBetterThanItself(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	setLevel(p, 50)
	p.C.Equip["weapon"] = &Stack{"ash_bow", 1}
	p.give("iron_arrow", 5)
	m := e.monster("boar")
	e.at(p, m.X+1, m.Y, "island")
	e.do(p, attackMsg(m.ID), 6)
	eq(t, p.count("iron_arrow"), 5)
}

func TestDeathKeepsGearAndStoresItemsForever(t *testing.T) {
	e := setup(t)
	p, q := e.player(1), e.player(2)
	p.C.Equip["weapon"] = &Stack{"copper_sword", 1}
	p.give("copper_ore", 3)
	e.at(p, 20, 44, "island")
	e.w.hurt(p, 0, 999, melee)
	eq(t, p.C.Equip["weapon"].ID, "copper_sword")
	eq(t, p.emptySlot(), 0)
	eq(t, Point{X: p.C.Grave.X, Y: p.C.Grave.Y}, Point{X: 20, Y: 44})
	p.give("ash_log", 1)
	e.at(p, 22, 44, "island")
	e.w.hurt(p, 0, 999, melee)
	eq(t, p.C.Grave.X, 22)
	e.at(q, 22, 44, "island")
	e.do(q, graveMsg, 3)
	check(t, p.C.Grave != nil)
	e.run(3000)
	eq(t, len(p.C.Grave.Items), 5)
	// Reload into a new world and claim from the reaper.
	var c Char
	check(t, json.Unmarshal(e.saved.chars[1], &c) == nil)
	e2 := setup(t)
	id, _ := e2.w.Join(1, "P1", func() (*Char, error) { return &c, nil }, &client{})
	p2 := e2.w.players[id]
	eq(t, p2.C.Grave, p.C.Grave)
	p2.C.Bank = []*Stack{{coin, 1000}}
	e2.atStation(p2, "reaper", "island")
	e2.do(p2, claimMsg, 1)
	check(t, p2.C.Grave == nil)
	eq(t, p2.count("copper_ore"), 3)
	eq(t, p2.count("worn_axe"), 1)
}

func TestClaimTakesOnlyWhatFits(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	clear(p.C.Inv)
	p.give("ash_log", 24)
	e.w.hurt(p, 0, 999, melee)
	p.give("berries", 20)
	p.C.Bank = []*Stack{{coin, 1000}}
	e.atStation(p, "reaper", "island")
	e.do(p, claimMsg, 1)
	eq(t, p.count("ash_log"), 4)
	eq(t, p.C.Grave.Items, []*Stack{{"ash_log", 20}})
}

func TestDisconnectingInCombatLingers(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	e.at(p, 20, 44, "island")
	e.w.hurt(p, 0, 1, melee)
	e.w.Leave(p.ID, e.c[1])
	e.run(10)
	check(t, e.w.players[p.ID] != nil)
	e.run(60)
	check(t, e.w.players[p.ID] == nil && e.saved.chars[1] != nil)
}

func TestSecondLoginTakesOver(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	old := e.c[1]
	check(t, e.player(1) == p)
	last := old.msgs[len(old.msgs)-1]
	check(t, last.GetKicked() != "")
	e.w.Leave(p.ID, old)
	e.run(60)
	check(t, e.w.players[p.ID] != nil && len(e.w.order) == 1)
	check(t, !e.w.Owns(p.ID, old))
}
