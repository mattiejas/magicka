package game

import "driftwake/content"

// sideOf is the direction from a boss to a tile beside it: straight for a tile along a side, diagonal for a corner.
func (m *Monster) sideOf(p Point) Point {
	from := func(v, start int) int {
		switch {
		case v < start:
			return -1
		case v >= start+m.Def.Size:
			return 1
		}
		return 0
	}
	return Point{X: from(p.X, m.X), Y: from(p.Y, m.Y)}
}

// snapTiles are the ground that a claw snaps at: the three tiles along a side, or a corner and the
// tile on each side of it. It is for bosses of 3 by 3.
// The middle one, where the claw is aimed, comes first.
func (m *Monster) snapTiles(side Point) (out []Point) {
	edge := func(direction, start int) int { // of the ring of tiles beside the boss
		switch direction {
		case -1:
			return start - 1
		case 1:
			return start + m.Def.Size
		}
		return start + m.Def.Size/2
	}
	middle := Point{X: edge(side.X, m.X), Y: edge(side.Y, m.Y)}
	out = append(out, middle)
	for _, step := range dirs {
		to := Point{X: middle.X + step.X, Y: middle.Y + step.Y}
		if step.X*step.Y == 0 && RectDist(to.X, to.Y, m.rect()) == 1 {
			out = append(out, to)
		}
	}
	return
}

// snaps marks the side of a player beside the boss, and for a second claw also a side at a right angle to it.
func snaps(claws int) shapeFunc {
	return func(w *World, m *Monster, _ *content.Attack, players []*Player) []strike {
		side := m.sideOf(players[randomInt(w.rnd, len(players))].at())
		sides := []Point{side}
		if claws == 2 {
			turn := 1
			if w.rnd() < 0.5 {
				turn = -1
			}
			sides = append(sides, Point{X: -turn * side.Y, Y: turn * side.X})
		}
		tiles := &tileSet{m: m.Map, seen: map[Point]bool{}}
		var centres []Point
		for _, side := range sides {
			ground := m.snapTiles(side)
			centres = append(centres, ground[0])
			for _, t := range ground {
				tiles.add(t.X, t.Y)
			}
		}
		return []strike{{tiles: tiles.list, centres: centres}}
	}
}

// jet marks a line from the middle of the boss to a player, who gets out of the way with one step sideways.
func jet(w *World, m *Monster, _ *content.Attack, players []*Player) []strike {
	target := players[randomInt(w.rnd, len(players))].at()
	tiles := &tileSet{m: m.Map, seen: map[Point]bool{}}
	x, y := m.X+m.Def.Size/2, m.Y+m.Def.Size/2
	dx, dy := target.X-x, target.Y-y
	steps := max(abs(dx), abs(dy))
	for i := 1; i < steps; i++ {
		at := Point{X: x + roundDiv(i*dx, steps), Y: y + roundDiv(i*dy, steps)}
		if RectDist(at.X, at.Y, m.rect()) > 0 {
			tiles.add(at.X, at.Y)
		}
	}
	tiles.add(target.X, target.Y)
	return []strike{{tiles: tiles.list, centres: []Point{target}}}
}

// roundDiv divides and rounds half away from zero.
func roundDiv(a, b int) int {
	if a < 0 {
		return -roundDiv(-a, b)
	}
	return (2*a + b) / (2 * b)
}
