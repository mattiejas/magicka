package game

import (
	"fmt"
	"strconv"
	"testing"

	"driftwake/content"
)

// heightAt is the height of a tile in the map's units, which only the browser draws.
func heightAt(m *content.Map, x, y int) int {
	if m.Heights == nil {
		return 0
	}
	h, _ := strconv.ParseInt(string(m.Heights[y][x]), 36, 32)
	return int(h)
}

const (
	maxStep         = 3 // the steepest step between two tiles side by side that can be walked
	maxDiagonalStep = 4
	levelSpread     = 1 // the most heights around a thing may differ
)

func isWater(m *content.Map, x, y int) bool { return m.Rows[y][x] == '0' }

func TestSteepGroundIsBlocked(t *testing.T) {
	for _, m := range content.Maps {
		for y := range m.Size {
			for x := range m.Size {
				for _, d := range dirs {
					nx, ny := x+d.X, y+d.Y
					if m.Walls == nil || nx < 0 || ny < 0 || nx >= m.Size || ny >= m.Size || isWater(m, x, y) || isWater(m, nx, ny) {
						continue
					}
					limit := maxStep
					if d.X != 0 && d.Y != 0 {
						limit = maxDiagonalStep
					}
					if abs(heightAt(m, x, y)-heightAt(m, nx, ny)) > limit {
						check(t, !m.Walkable(x, y), m.ID, "steep tile can be walked on", x, y)
					}
				}
			}
		}
	}
}

func TestNothingStandsOnASlope(t *testing.T) {
	for _, m := range content.Maps {
		things := map[string]struct{ x, y, size int }{}
		for _, n := range m.Nodes {
			if content.Nodes[n.Type].Kind == "spot" {
				continue // on the water
			}
			things[n.ID] = struct{ x, y, size int }{n.X, n.Y, content.Nodes[n.Type].Size}
		}
		for _, s := range m.Stations {
			things[s.ID] = struct{ x, y, size int }{s.X, s.Y, 1}
		}
		for i, s := range m.Spawns {
			things[fmt.Sprint(s.Type, i)] = struct{ x, y, size int }{s.X, s.Y, content.Monsters[s.Type].Size}
		}
		for id, o := range things {
			low, high := 1<<30, 0
			for y := o.y - 1; y <= o.y+o.size; y++ {
				for x := o.x - 1; x <= o.x+o.size; x++ {
					if x >= 0 && y >= 0 && x < m.Size && y < m.Size && !isWater(m, x, y) {
						low, high = min(low, heightAt(m, x, y)), max(high, heightAt(m, x, y))
					}
				}
			}
			check(t, high-low <= levelSpread, m.ID, id, "stands on a slope")
		}
	}
}

func TestEveryTileOfAThingCanBeReachedOnFoot(t *testing.T) {
	for _, m := range content.Maps {
		check(t, m.CanStandOn(m.Spawn.X, m.Spawn.Y), m.ID, "spawn")
		check(t, m.CanStandOn(m.Landing.X, m.Landing.Y), m.ID, "landing")
		touching := func(x, y, size int) bool {
			for j := y - 1; j <= y+size; j++ {
				for i := x - 1; i <= x+size; i++ {
					if m.CanStandOn(i, j) {
						return true
					}
				}
			}
			return false
		}
		for _, n := range m.Nodes {
			check(t, touching(n.X, n.Y, content.Nodes[n.Type].Size), m.ID, n, "cannot be reached")
		}
		for _, s := range m.Stations {
			check(t, touching(s.X, s.Y, 1), m.ID, s, "cannot be reached")
		}
		for _, s := range m.Spawns {
			check(t, touching(s.X, s.Y, content.Monsters[s.Type].Size), m.ID, s, "cannot be reached")
		}
	}
}

// Telegraphs are drawn flat, so the arena of a boss has to be.
func TestBossArenasAreFlatAndOpen(t *testing.T) {
	for _, m := range content.Maps {
		for _, s := range m.Spawns {
			boss := content.Monsters[s.Type].Boss
			if boss == nil {
				continue
			}
			size := content.Monsters[s.Type].Size
			for y := s.Y - boss.Arena; y < s.Y+size+boss.Arena; y++ {
				for x := s.X - boss.Arena; x < s.X+size+boss.Arena; x++ {
					if x >= 0 && y >= 0 && x < m.Size && y < m.Size && !isWater(m, x, y) {
						eq(t, heightAt(m, x, y), 0, m.ID, s.Type, "arena is not flat at", x, y)
					}
				}
			}
			check(t, m.CanStandOn(s.X, s.Y), m.ID, s.Type, "arena cannot be reached")
		}
	}
}

// The island has a crater, a hill and cliffs, so walls have to be there.
func TestTheIslandHasHeightAndWalls(t *testing.T) {
	m := content.MapByID["island"]
	steepest, tallest, walled := 0, 0, 0
	for y := range m.Size {
		for x := range m.Size {
			tallest = max(tallest, heightAt(m, x, y))
			steepest = max(steepest, abs(heightAt(m, x, y)-heightAt(m, max(0, x-1), y)))
			if m.Walls[y][x] == '1' {
				walled++
			}
		}
	}
	check(t, tallest >= 10 && steepest > maxStep && walled > 100, tallest, steepest, walled)
}

// The rim of the crater cannot be crossed, but the crater can be entered and left by two ways.
func TestTheCraterHasTwoWaysIn(t *testing.T) {
	m := content.MapByID["island"]
	var rise content.Label
	for _, l := range m.Labels {
		if l.Name == "Copper crater" {
			rise = l
		}
	}
	centre := Point{X: rise.X, Y: rise.Y}
	check(t, m.CanStandOn(centre.X, centre.Y), "the middle of Copper crater")
	var f pathfinder
	first := f.find(m, m.Spawn.X, m.Spawn.Y, tile(centre.X, centre.Y), 0)
	check(t, len(first) > 0 && first[len(first)-1] == centre, "no way in")
	rim := func(p Point) bool {
		d := (p.X-centre.X)*(p.X-centre.X) + (p.Y-centre.Y)*(p.Y-centre.Y)
		return d > 8*8 && d < 12*12
	}
	// Close the first way where it crosses the rim, and a second one has to be left.
	closed := *m
	closed.Blocked = append([]bool(nil), m.Blocked...)
	for _, on := range first {
		if !rim(on) {
			continue
		}
		for j := -2; j <= 2; j++ {
			for i := -2; i <= 2; i++ {
				closed.Blocked[(on.Y+j)*m.Size+on.X+i] = true
			}
		}
	}
	second := f.find(&closed, m.Spawn.X, m.Spawn.Y, tile(centre.X, centre.Y), 0)
	check(t, len(second) > 0 && second[len(second)-1] == centre, "only one way in")
	// and the rim itself holds: nothing on the way is a shortcut across it
	crossings := 0
	for _, on := range second {
		if rim(on) {
			crossings++
		}
	}
	check(t, crossings > 0, "the second way does not cross the rim")
}

func TestSomeoneSavedInsideACliffIsMovedToWalkableGround(t *testing.T) {
	m := content.MapByID["island"]
	wall := Point{}
	for y := range m.Size {
		for x := range m.Size {
			if wall == (Point{}) && !isWater(m, x, y) && !m.CanReach(x, y, stationReach) {
				wall = Point{X: x, Y: y}
			}
		}
	}
	check(t, wall != Point{}, "no wall found")
	e := setup(t)
	saved := NewChar()
	saved.Map, saved.X, saved.Y = "island", wall.X, wall.Y
	saved.Grave = &Grave{"island", wall.X, wall.Y, []*Stack{{ID: coin, Qty: 5}}}
	c := &client{}
	id, err := e.w.Join(7, "P7", func() (*Char, error) { return saved, nil }, c)
	check(t, err == nil, err)
	p := e.w.players[id]
	check(t, m.CanStandOn(p.C.X, p.C.Y), "player is still on blocked ground", p.C.X, p.C.Y)
	check(t, m.CanReach(p.C.Grave.X, p.C.Grave.Y, stationReach), "grave is still out of reach")
	check(t, max(abs(p.C.X-wall.X), abs(p.C.Y-wall.Y)) < 12, "moved far away")
	check(t, e.w.nearGrave(p), "the grave cannot be used from where the player was put")
}

func TestSomeoneOnGoodGroundStaysWhereTheyAre(t *testing.T) {
	e := setup(t)
	saved := NewChar()
	saved.Map, saved.X, saved.Y = "island", 20, 40
	_, err := e.w.Join(8, "P8", func() (*Char, error) { return saved, nil }, &client{})
	check(t, err == nil, err)
	eq(t, Point{X: saved.X, Y: saved.Y}, Point{X: 20, Y: 40})
}
