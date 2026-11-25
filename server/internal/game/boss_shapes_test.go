package game

import (
	"slices"
	"sort"
	"testing"

	"driftwake/content"
)

// groundBosses lists every boss in the content with the attacks that mark ground.
func groundBosses() (ids []string) {
	for id, def := range content.Monsters {
		if def.Boss != nil {
			ids = append(ids, id)
		}
	}
	sort.Strings(ids)
	return
}

// arenaTiles are the tiles a player can stand on in a boss's arena.
func arenaTiles(m *Monster) (out []Point) {
	arena := m.Def.Boss.Arena
	for y := m.Y - arena; y < m.Y+m.Def.Size+arena; y++ {
		for x := m.X - arena; x < m.X+m.Def.Size+arena; x++ {
			if m.Map.Walkable(x, y) && RectDist(x, y, m.rect()) <= arena && RectDist(x, y, m.rect()) > 0 {
				out = append(out, Point{X: x, Y: y})
			}
		}
	}
	return
}

// strikesFor asks a shape for its strikes against a lone player at a tile. Random draws below one half and
// above it are the two ways in which quakes are marked.
func (e *env) strikesFor(m *Monster, a *content.Attack, at Point, draw float64) []strike {
	p := e.player(1)
	e.at(p, at.X, at.Y, m.Map.ID)
	e.w.rnd = func() float64 { return draw }
	return shapes[a.Shape].mark(e.w, m, a, []*Player{p})
}

func TestEveryShapeIsKnown(t *testing.T) {
	var known []string
	for name := range shapes {
		known = append(known, name)
	}
	sort.Strings(known)
	want := slices.Clone(content.Shapes)
	sort.Strings(want)
	eq(t, known, want)
}

func TestAnUnknownShapeIsRefused(t *testing.T) {
	boss := func(a content.Attack) []*content.Monster {
		return []*content.Monster{{ID: "b", Boss: &content.Boss{Attacks: []content.Attack{a}}}}
	}
	check(t, content.CheckAttacks(boss(content.Attack{ID: "boulder", Shape: "square"})) == nil, "known shape")
	check(t, content.CheckAttacks(boss(content.Attack{ID: "melee"})) == nil, "melee without a shape")
	check(t, content.CheckAttacks(boss(content.Attack{ID: "boulder", Shape: "blob"})) != nil, "unknown shape")
	check(t, content.CheckAttacks(boss(content.Attack{ID: "quake"})) != nil, "missing shape")
	check(t, content.CheckAttacks(boss(content.Attack{ID: "melee", Shape: "square"})) != nil, "melee with a shape")
	var all []*content.Monster
	for _, m := range content.Monsters {
		all = append(all, m)
	}
	eq(t, content.CheckAttacks(all), nil)
}

func TestEveryAttackThatMarksGroundMarksSomeTiles(t *testing.T) {
	for _, id := range groundBosses() {
		e := setup(t)
		m := e.monster(id)
		starts := arenaTiles(m)
		for i := range m.Def.Boss.Attacks {
			a := &m.Def.Boss.Attacks[i]
			if a.ID == attackMelee {
				continue
			}
			for _, draw := range []float64{0.25, 0.75} {
				for _, at := range []Point{starts[0], starts[len(starts)/2], starts[len(starts)-1]} {
					strikes := e.strikesFor(m, a, at, draw)
					check(t, len(strikes) > 0, id, a.ID, "no strikes")
					for _, s := range strikes {
						check(t, len(s.tiles) > 0, id, a.ID, "marks nothing")
						check(t, s.at >= 0 && s.at < a.Execute, id, a.ID, "strikes outside execute", s.at)
					}
				}
			}
		}
	}
}

func TestAPlayerWhoDiedEarlierInTheTickIsNotHit(t *testing.T) {
	e := setup(t)
	m, p := e.monster("gnashclaw"), e.player(1)
	spawn := m.Map.Spawn
	e.at(p, m.X-3, m.Y, m.Map.ID)
	e.provoke(p, m)
	p.C.HP = 1
	attack := &content.Attack{ID: "boulder", Execute: 1, Damage: [2]int{5, 5}}
	// The first strike kills the player. The second marks the spawn point, where they wake up.
	m.boss = &bossState{st: execute, atk: attack, start: e.w.Tick, end: e.w.Tick + 1, strikes: []strike{
		{at: e.w.Tick + 1, tiles: []Point{p.at()}},
		{at: e.w.Tick + 1, tiles: []Point{spawn}},
	}}
	e.w.Tick++
	e.w.bossStrikes(m)
	eq(t, p.at(), spawn, "died, and woke in town")
	eq(t, p.C.HP, MaxHP(p.level("vitality")), "not hit again after dying")
}

// --- fairness

// walkers are the tiles where a player could be after each tick of running away: up to walkSpeed steps that canStep
// allows, and not through the boss. Only tiles that are new since the last round need to be walked on from.
type walkers struct {
	m        *Monster
	tiles    map[Point]bool
	frontier []Point
}

func newWalkers(m *Monster, start Point) *walkers {
	return &walkers{m, map[Point]bool{start: true}, []Point{start}}
}

func (w *walkers) tick() {
	for range walkSpeed {
		var added []Point
		for _, p := range w.frontier {
			for _, d := range dirs {
				to := Point{X: p.X + d.X, Y: p.Y + d.Y}
				if !w.tiles[to] && RectDist(to.X, to.Y, w.m.rect()) > 0 && canStep(w.m.Map, p.X, p.Y, d.X, d.Y) {
					w.tiles[to] = true
					added = append(added, to)
				}
			}
		}
		w.frontier = added
	}
}

// hit removes whoever stands on the strike. What is left must walk on from everywhere.
func (w *walkers) hit(s strike) {
	for _, t := range s.tiles {
		delete(w.tiles, t)
	}
	w.frontier = w.frontier[:0]
	for p := range w.tiles {
		w.frontier = append(w.frontier, p)
	}
}

// dodge plays an attack against a player who stands at a tile when it is chosen. Players move before bosses, so one tick
// of moves comes before each tick of the attack, from the first tick of the wind-up to the last strike. It returns
// how many ticks of moving it took to be outside the first strike, or -1 if some way not to be hit at all is missing.
func dodge(m *Monster, a *content.Attack, start Point, strikes []strike) int {
	w := newWalkers(m, start)
	last := 0
	for _, s := range strikes {
		last = max(last, a.Windup+s.at)
	}
	escape := -1
	for tick := 1; tick <= last; tick++ {
		w.tick()
		if escape < 0 {
			for p := range w.tiles {
				if !slices.Contains(strikes[0].tiles, p) {
					escape = tick
					break
				}
			}
		}
		for _, s := range strikes {
			if a.Windup+s.at == tick {
				w.hit(s)
			}
		}
		if len(w.tiles) == 0 {
			return -1
		}
	}
	return escape
}

// escapeTicks is, for each boss, the most ticks of moving that any of its attacks asks of a player, who is always
// able to dodge. The fairness test fills it.
func escapeTicks(t *testing.T) map[string]int {
	out := map[string]int{}
	for _, id := range groundBosses() {
		e := setup(t)
		m := e.monster(id)
		starts := arenaTiles(m)
		check(t, len(starts) > 50, id, len(starts))
		for i := range m.Def.Boss.Attacks {
			a := &m.Def.Boss.Attacks[i]
			if a.ID == attackMelee {
				continue
			}
			for _, draw := range []float64{0.25, 0.75} {
				for _, at := range starts {
					escape := dodge(m, a, at, e.strikesFor(m, a, at, draw))
					check(t, escape > 0, id, a.ID, "cannot be dodged from", at, "with draw", draw)
					out[id] = max(out[id], escape)
				}
			}
		}
	}
	return out
}

func TestEveryAttackThatMarksGroundCanBeDodgedFromEveryTile(t *testing.T) {
	escapeTicks(t)
}

// --- roots

// rootMargin plays a boss against one player who never moves, and finds the fewest ticks in which a rooted player could
// move before the next boulder or quake lands, counting the tick of the landing: players move before bosses.
func rootMargin(t *testing.T, id string) int {
	e := setup(t)
	m, p := e.monster(id), e.player(1)
	if m.Dead {
		e.w.enter(m)
	}
	e.at(p, m.X-3, m.Y, m.Map.ID)
	margin, freeAt := 1<<30, 0
	for range 4000 {
		e.provoke(p, m)
		e.run(1)
		b := m.boss
		if b.st != execute || b.start != e.w.Tick {
			continue
		}
		switch {
		case b.atk.Root > 0 && p.rooted > e.w.Tick:
			freeAt = p.rooted
		case freeAt > 0 && (b.atk.ID == "boulder" || b.atk.ID == "quake"):
			margin, freeAt = min(margin, e.w.Tick-freeAt+1), 0
		}
		e.at(p, m.X-3, m.Y, m.Map.ID)
	}
	check(t, margin < 1<<30, id, "never rooted before a boulder or quake")
	return margin
}

func TestARootEndsWellBeforeTheNextBoulderOrQuake(t *testing.T) {
	escape := escapeTicks(t)
	measured := map[string]int{}
	for _, id := range groundBosses() {
		if !slices.ContainsFunc(content.Monsters[id].Boss.Attacks, func(a content.Attack) bool { return a.Root > 0 }) {
			continue
		}
		measured[id] = rootMargin(t, id)
		t.Log(id, "margin", measured[id], "escape", escape[id])
		check(t, measured[id] > escape[id], id, "margin", measured[id], "escape", escape[id])
	}
	eq(t, measured, map[string]int{"colossus": 3})
}
