package game

import (
	"fmt"
	"slices"
	"testing"

	"driftwake/content"
)

func (m *Monster) attack(t *testing.T, id string) *content.Attack {
	for i := range m.Def.Boss.Attacks {
		if a := &m.Def.Boss.Attacks[i]; a.ID == id {
			return a
		}
	}
	t.Fatal("no attack", id)
	return nil
}

// begin makes a boss start an attack against some players, as bossChoose does.
func (e *env) begin(m *Monster, id string, players ...*Player) *bossState {
	a := m.attack(e.t, id)
	b := &bossState{st: windup, atk: a, start: e.w.Tick, end: e.w.Tick + a.Windup}
	b.plan(shapes[a.Shape].mark(e.w, m, a, players), b.end)
	m.boss = b
	return b
}

func besideTiles(m *Monster) (out []Point) {
	for _, p := range arenaTiles(m) {
		if RectDist(p.X, p.Y, m.rect()) == 1 {
			out = append(out, p)
		}
	}
	return
}

func TestASnapMarksThreeTilesOnThePlayersSide(t *testing.T) {
	e := setup(t)
	p, m := e.player(1), e.monster("gnashclaw")
	tiles := besideTiles(m)
	eq(t, len(tiles), 16, "all around him is walkable")
	for _, at := range tiles {
		e.at(p, at.X, at.Y, m.Map.ID)
		b := e.begin(m, "snap", p)
		eq(t, len(b.tiles), 3, at)
		check(t, slices.Contains(b.tiles, at), at, "is not marked", b.tiles)
		eq(t, b.centres, b.tiles[:1], at)
		for _, marked := range b.tiles {
			eq(t, RectDist(marked.X, marked.Y, m.rect()), 1, at, marked, "one tile back must be safe")
		}
	}
	side := func(x, y int) []Point {
		e.at(p, x, y, m.Map.ID)
		tiles := slices.Clone(e.begin(m, "snap", p).tiles)
		slices.SortFunc(tiles, func(a, b Point) int { return (a.Y-b.Y)*100 + a.X - b.X })
		return tiles
	}
	x, y := m.X, m.Y
	eq(t, side(x+2, y-1), []Point{{X: x, Y: y - 1}, {X: x + 1, Y: y - 1}, {X: x + 2, Y: y - 1}}, "north")
	eq(t, side(x-1, y), []Point{{X: x - 1, Y: y}, {X: x - 1, Y: y + 1}, {X: x - 1, Y: y + 2}}, "west")
	eq(t, side(x+3, y+3), []Point{{X: x + 3, Y: y + 2}, {X: x + 2, Y: y + 3}, {X: x + 3, Y: y + 3}}, "corner")
}

func TestADoubleSnapMarksTwoSides(t *testing.T) {
	e := setup(t)
	p, m := e.player(1), e.monster("gnashclaw")
	for _, at := range besideTiles(m) {
		for _, draw := range []float64{0.25, 0.75} {
			e.at(p, at.X, at.Y, m.Map.ID)
			e.w.rnd = func() float64 { return draw }
			b := e.begin(m, "double_snap", p)
			check(t, slices.Contains(b.tiles, at), at, "is not marked")
			eq(t, len(b.tiles), 6, at)
			eq(t, len(b.centres), 2, at)
			a, c := m.sideOf(b.centres[0]), m.sideOf(b.centres[1])
			eq(t, a.X*c.X+a.Y*c.Y, 0, at, "the sides are at a right angle")
			for _, marked := range b.tiles {
				eq(t, RectDist(marked.X, marked.Y, m.rect()), 1, at, marked)
			}
		}
	}
	single, double := m.attack(t, "snap"), m.attack(t, "double_snap")
	check(t, double.Windup > single.Windup && double.Weight < single.Weight, "longer and rarer")
}

func TestASnapIsAvoidedOneTileAwayUntilTheLastTickAndHitsWhoStays(t *testing.T) {
	for _, id := range []string{"snap", "double_snap"} {
		for _, at := range besideTiles(setup(t).monster("gnashclaw")) {
			for _, dodges := range []bool{true, false} {
				e := setup(t)
				p, m := e.player(1), e.monster("gnashclaw")
				setLevel(p, 50)
				e.at(p, at.X, at.Y, m.Map.ID)
				m.active.set(p.ID, e.w.Tick)
				b := e.begin(m, id, p)
				full := p.C.HP
				e.run(b.end - e.w.Tick - 1)
				eq(t, p.C.HP, full, id, at, "hit before the snap")
				if dodges { // one tile back, asked for after the last tick before the snap
					back := m.sideOf(at)
					e.do(p, move(uint32(at.X+back.X), uint32(at.Y+back.Y)), 0)
				}
				e.run(1)
				eq(t, b.st, execute, id, at)
				eq(t, p.C.HP < full, !dodges, id, at, "hit, dodging", dodges)
			}
		}
	}
}

func TestWhoDodgedASnapDoesNotWalkBackIntoTheMark(t *testing.T) {
	e := setup(t)
	p, m := e.player(1), e.monster("gnashclaw")
	setLevel(p, 30)
	e.at(p, m.X-1, m.Y+1, "island")
	m.active.set(p.ID, e.w.Tick)
	e.do(p, attackMsg(m.ID), 1) // fighting him, so that there is something to go back to
	b := e.begin(m, "snap", p)
	e.do(p, move(uint32(m.X-2), uint32(m.Y+1)), 1)
	full, done := p.C.HP, b.end+b.atk.Execute
	for e.w.Tick < done {
		eq(t, p.at(), Point{X: m.X - 2, Y: m.Y + 1})
		e.run(1)
	}
	eq(t, p.C.HP, full)
}

func TestOnceChosenASnapDoesNotTurnToSomeoneElse(t *testing.T) {
	e := setup(t)
	p, q, m := e.player(1), e.player(2), e.monster("gnashclaw")
	setLevel(p, 50)
	setLevel(q, 50)
	e.at(p, m.X-1, m.Y+1, "island")
	e.at(q, m.X-6, m.Y+1, "island")
	m.active.set(p.ID, e.w.Tick)
	b := e.begin(m, "snap", p)
	tiles, centres := slices.Clone(b.tiles), slices.Clone(b.centres)
	e.run(1)
	e.at(p, m.X-2, m.Y+1, "island")
	e.at(q, m.X+3, m.Y+1, "island")
	full, lands := q.C.HP, b.end
	for e.w.Tick < lands {
		e.run(1)
		eq(t, b.tiles, tiles)
		eq(t, b.centres, centres)
		eq(t, m.boss, b)
	}
	eq(t, q.C.HP, full, "hit on the other side")
	eq(t, p.C.HP, full, "hit one tile back")
}

func TestSnapsAreForWhoIsBesideHimAndTheJetForEveryoneElse(t *testing.T) {
	e := setup(t)
	p, q, m := e.player(1), e.player(2), e.monster("gnashclaw")
	players := []*Player{p, q}
	for _, c := range []struct {
		distance    int // of the second player, west of him
		snaps, jets bool
	}{{1, true, false}, {2, false, true}, {9, false, true}, {-1, false, true}} {
		e.at(q, m.X-c.distance, m.Y+1, "island")
		has := func(id string) bool { return slices.Contains(targetsOf(m, m.attack(t, id), players), q) }
		eq(t, has("snap"), c.snaps, c)
		eq(t, has("double_snap"), c.snaps, c)
		eq(t, has("jet"), c.jets, c)
	}
}

func TestTheJetMarksALineToOnePlayerWhoCanStepAside(t *testing.T) {
	e := setup(t)
	p, m := e.player(1), e.monster("gnashclaw")
	for _, at := range arenaTiles(m) {
		e.at(p, at.X, at.Y, m.Map.ID)
		b := e.begin(m, "jet", p)
		eq(t, b.centres, []Point{at})
		eq(t, b.tiles[len(b.tiles)-1], at, "the player's tile ends the line")
		check(t, len(b.tiles) <= RectDist(at.X, at.Y, m.rect()), fmt.Sprint(at, b.tiles, "is wider than a tile"))
	}
	e.at(p, m.X-4, m.Y+1, "island")
	want := []Point{{X: m.X - 1, Y: m.Y + 1}, {X: m.X - 2, Y: m.Y + 1}, {X: m.X - 3, Y: m.Y + 1}, {X: m.X - 4, Y: m.Y + 1}}
	eq(t, e.begin(m, "jet", p).tiles, want)
	e.at(p, m.X+1, m.Y+1, "island")
	eq(t, e.begin(m, "jet", p).tiles, []Point{p.at()}, "who stands in his middle is marked alone")
}
