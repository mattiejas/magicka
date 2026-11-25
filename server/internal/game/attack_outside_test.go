package game

import (
	"testing"

	"driftwake/content"
)

// kits are a weapon and ammunition for each style, with reaches of 1, 6 and 7.
var kits = []struct {
	name, weapon, ammo string
	reach              int
}{
	{"melee", "iron_sword", "", 1},
	{"bow", "pine_bow", "iron_arrow", 6},
	{"staff", "pine_staff", "essence", 6},
}

func equipKit(p *Player, weapon, ammo string) {
	p.C.Equip["weapon"] = &Stack{weapon, 1}
	if ammo != "" {
		p.C.Equip["ammo"] = &Stack{ammo, 500}
	}
}

func insideOf(p *Player, m *Monster) bool { return RectDist(p.C.X, p.C.Y, m.rect()) == 0 }

func TestAttackingFromInsideAMonsterStepsOutFirst(t *testing.T) {
	for _, k := range kits {
		for _, id := range []string{"boar", "gnashclaw"} {
			e := setup(t)
			p, m := e.player(1), e.monster(id)
			setLevel(p, 30)
			equipKit(p, k.weapon, k.ammo)
			check(t, p.stats().reach == k.reach, k.name, "reach")
			e.at(p, m.X+m.Def.Size/2, m.Y+m.Def.Size/2, "island")
			check(t, insideOf(p, m), k.name, id, "starts inside")
			e.provoke(p, m)
			e.do(p, attackMsg(m.ID), 0)
			for i := range 30 {
				e.run(1)
				d := RectDist(p.C.X, p.C.Y, m.rect())
				check(t, d >= 1 || m.Dead, k.name, id, "tick", i, "attacked from inside")
				if m.damage.get(p.ID) > 0 {
					break
				}
			}
			check(t, m.damage.get(p.ID) > 0, k.name, id, "never hit")
		}
	}
}

func TestAttackingFromInsideStepsToTheNearestTileBeside(t *testing.T) {
	e := setup(t)
	p, m := e.player(1), e.monster("gnashclaw")
	setLevel(p, 30)
	e.provoke(p, m)
	e.at(p, m.X, m.Y+1, "island") // the middle of the west side
	e.do(p, attackMsg(m.ID), 1)
	eq(t, Point{X: p.C.X, Y: p.C.Y}, Point{X: m.X - 1, Y: m.Y + 1})
}

func TestRootedPlayerInsideCannotAttackUntilFreed(t *testing.T) {
	for _, k := range kits {
		e := setup(t)
		p, m := e.player(1), e.monster("gnashclaw")
		setLevel(p, 30)
		equipKit(p, k.weapon, k.ammo)
		e.provoke(p, m)
		e.at(p, m.X+1, m.Y+1, "island")
		p.rooted = e.w.Tick + 6
		e.do(p, attackMsg(m.ID), 5)
		check(t, insideOf(p, m), k.name, "moved while rooted")
		eq(t, m.damage.get(p.ID), 0.0, k.name, "attacked while rooted")
		eq(t, p.nextAttack, 0, k.name, "swung while rooted")
		for range 30 {
			e.run(1)
			check(t, !insideOf(p, m), k.name, "still inside after the root ended")
			if m.damage.get(p.ID) > 0 {
				break
			}
		}
		check(t, m.damage.get(p.ID) > 0, k.name, "never hit after the root ended")
	}
}

func TestMonsterThatWalkedOntoAPlayerLetsThemStepOutToFightBack(t *testing.T) {
	e := setup(t)
	p, m := e.player(1), e.monster("boar")
	setLevel(p, 30)
	e.at(p, m.X, m.Y, "island")
	m.target = p.ID
	p.C.HP = 1e6
	for range 20 {
		e.run(1)
		if m.damage.get(p.ID) > 0 {
			break
		}
	}
	check(t, m.damage.get(p.ID) > 0, "a player who fights back must hit")
	check(t, !insideOf(p, m), "fought back from inside")
}

func TestMeleeEndsOnATileBesideEveryApproach(t *testing.T) {
	e := setup(t)
	p, m := e.player(1), e.monster("gnashclaw")
	setLevel(p, 30)
	mp := content.MapByID["island"]
	for _, from := range [][2]int{{-8, 1}, {10, 1}, {1, -8}, {1, 10}, {-6, -6}, {8, -6}, {-6, 8}, {8, 8}, {-3, 4}, {5, -2}} {
		x, y := m.X+from[0], m.Y+from[1]
		if !mp.Walkable(x, y) {
			continue
		}
		e.at(p, x, y, "island")
		p.nextAttack, p.rooted = 0, 0
		e.provoke(p, m)
		e.do(p, attackMsg(m.ID), 0)
		for i := 0; i < 20 && m.damage.get(p.ID) == 0; i++ {
			e.run(1)
		}
		check(t, m.damage.get(p.ID) > 0, from, "never attacked")
		eq(t, RectDist(p.C.X, p.C.Y, m.rect()), 1, from)
		m.damage.set(p.ID, 0)
	}
}

func TestWalkingThroughAMonsterStillWorks(t *testing.T) {
	e := setup(t)
	p, m := e.player(1), e.monster("gnashclaw")
	e.at(p, m.X-2, m.Y+1, "island")
	crossed := false
	e.do(p, move(uint32(m.X+4), uint32(m.Y+1)), 0)
	for range 8 {
		e.run(1)
		crossed = crossed || insideOf(p, m)
	}
	check(t, crossed, "never walked through")
	eq(t, Point{X: p.C.X, Y: p.C.Y}, Point{X: m.X + 4, Y: m.Y + 1})
	// And a move that ends inside stays inside.
	e.do(p, move(uint32(m.X+1), uint32(m.Y+1)), 4)
	check(t, insideOf(p, m), "move to the middle")
}

func TestOutsideSearchFindsAFreeTileBesideWhenSomeAreBlocked(t *testing.T) {
	const size = 9
	open := func() *content.Map { return &content.Map{Size: size, Blocked: make([]bool, size*size)} }
	target := Rect{3, 3, 3, 3}
	var f pathfinder
	ring := func(m *content.Map, keep ...Point) {
		for y := 2; y <= 6; y++ {
			for x := 2; x <= 6; x++ {
				if RectDist(x, y, target) == 1 {
					m.Blocked[y*size+x] = true
				}
			}
		}
		for _, k := range keep {
			m.Blocked[k.Y*size+k.X] = false
		}
	}
	end := func(m *content.Map, sx, sy, reach int) Point {
		p := f.findOutside(m, sx, sy, target, reach)
		check(t, len(p) > 0, "no way out")
		return p[len(p)-1]
	}
	m := open()
	eq(t, len(f.findOutside(m, 4, 4, target, 1)), 2, "from the middle, two steps cross the 3 by 3 to the ring")
	// Only one free tile beside, on the far side.
	ring(m, Point{X: 6, Y: 4})
	eq(t, end(m, 4, 4, 1), Point{X: 6, Y: 4})
	eq(t, end(m, 3, 3, 1), Point{X: 6, Y: 4})
	// Reach 6 from inside likewise ends beside, not in the target.
	m = open()
	ring(m, Point{X: 2, Y: 4})
	eq(t, end(m, 5, 5, 6), Point{X: 2, Y: 4})
	// Nothing beside is free: no path, and so no attack.
	m = open()
	ring(m)
	eq(t, len(f.findOutside(m, 4, 4, target, 1)), 0)
}

func TestPlayerAttackingFromInsideDoesNotOscillate(t *testing.T) {
	e := setup(t)
	p, m := e.player(1), e.monster("gnashclaw")
	setLevel(p, 30)
	e.provoke(p, m)
	e.at(p, m.X+1, m.Y+1, "island")
	e.do(p, attackMsg(m.ID), 1)
	at := Point{X: p.C.X, Y: p.C.Y}
	for range 10 {
		e.provoke(p, m)
		e.run(1)
		eq(t, Point{X: p.C.X, Y: p.C.Y}, at)
	}
}
