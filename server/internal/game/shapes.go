package game

import "driftwake/content"

// strike is ground that is hit on one tick.
type strike struct {
	at      int // tick
	tiles   []Point
	centres []Point // where it is aimed, for the browser to show
}

// A shape is a way to mark ground.
type shape struct {
	mark shapeFunc
	// reaches tells whether it can be aimed at a player at a distance from the boss.
	reaches func(distance int) bool
}

func anywhere(int) bool        { return true }
func beside(distance int) bool { return distance == 1 }

// notBeside holds for who stands inside the boss too, where no claw reaches.
func notBeside(distance int) bool { return distance != 1 }

// A shapeFunc chooses an attack's strikes when it is chosen. Strikes are at ticks counted from the start of execute.
// It gets the players that the shape can be aimed at, of whom there is at least one.
type shapeFunc func(w *World, m *Monster, a *content.Attack, players []*Player) []strike

// shapes is every shape content can name. TestEveryShapeIsKnown keeps it equal to content.Shapes.
var shapes = map[string]shape{
	"square": {aimed(markSquare), anywhere},
	"cross":  {aimed(markCross), anywhere},
	"rings":  {rings, anywhere},
	"side":   {snaps(1), beside},
	"sides":  {snaps(2), beside},
	"line":   {jet, notBeside},
}

// plan fixes the strikes to the ticks of the attack, given the tick at which execute begins.
func (b *bossState) plan(strikes []strike, executeAt int) {
	seen, seenCentre := map[Point]bool{}, map[Point]bool{}
	for _, s := range strikes {
		s.at += executeAt
		b.strikes = append(b.strikes, s)
		for _, t := range s.tiles {
			if !seen[t] {
				seen[t] = true
				b.tiles = append(b.tiles, t)
			}
		}
		for _, c := range s.centres {
			if !seenCentre[c] {
				seenCentre[c] = true
				b.centres = append(b.centres, c)
			}
		}
	}
}

// tileSet collects walkable tiles once each, in order.
type tileSet struct {
	m    *content.Map
	seen map[Point]bool
	list []Point
}

func (s *tileSet) add(x, y int) {
	if p := (Point{X: x, Y: y}); s.m.Walkable(x, y) && !s.seen[p] {
		s.seen[p] = true
		s.list = append(s.list, p)
	}
}

// aimed marks ground around some of the players, as many as the attack counts, chosen at random.
func aimed(mark func(*tileSet, Point)) shapeFunc {
	return func(w *World, m *Monster, a *content.Attack, players []*Player) []strike {
		tiles := &tileSet{m: m.Map, seen: map[Point]bool{}}
		var centres []Point
		targets := w.shuffled(players)
		for _, p := range targets[:min(len(targets), max(1, a.Count))] {
			mark(tiles, p.at())
			centres = append(centres, p.at())
		}
		return []strike{{tiles: tiles.list, centres: centres}}
	}
}

// rings marks every other pair of rings around a boss.
func rings(w *World, m *Monster, _ *content.Attack, _ []*Player) []strike {
	tiles := &tileSet{m: m.Map, seen: map[Point]bool{}}
	arena, parity := m.Def.Boss.Arena, 1
	if w.rnd() < 0.5 {
		parity = 0
	}
	for y := m.Y - arena; y < m.Y+m.Def.Size+arena; y++ {
		for x := m.X - arena; x < m.X+m.Def.Size+arena; x++ {
			distance := RectDist(x, y, m.rect())
			if distance > 0 && distance <= arena && (distance-1)/2%2 == parity {
				tiles.add(x, y)
			}
		}
	}
	return []strike{{tiles: tiles.list}}
}

func markSquare(tiles *tileSet, centre Point) {
	for dy := -1; dy <= 1; dy++ {
		for dx := -1; dx <= 1; dx++ {
			tiles.add(centre.X+dx, centre.Y+dy)
		}
	}
}

func markCross(tiles *tileSet, centre Point) {
	for _, d := range [...]Point{{}, {X: 1}, {X: -1}, {Y: 1}, {Y: -1}} {
		tiles.add(centre.X+d.X, centre.Y+d.Y)
	}
}

func (w *World) shuffled(players []*Player) []*Player {
	out := append([]*Player(nil), players...)
	for i := len(out) - 1; i > 0; i-- {
		j := randomInt(w.rnd, i+1)
		out[i], out[j] = out[j], out[i]
	}
	return out
}
