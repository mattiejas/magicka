package game

import "testing"

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
