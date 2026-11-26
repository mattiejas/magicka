package game

import (
	"math"
	"testing"

	"driftwake/content"
)

func TestTheSeaHoldsTheIslandAndTheMainlandAsTheyAre(t *testing.T) {
	s := sea()
	for _, id := range []string{"island", "mainland"} {
		place, land := s.PlaceByID(id), content.MapByID[id]
		if place == nil || place.Map != id {
			t.Fatalf("no place on the sea leads to %s", id)
		}
		for y := range land.Size {
			for x := range land.Size {
				sx, sy := x+place.X, y+place.Y
				if land.IsWater(x, y) {
					continue
				}
				if s.Rows[sy][sx] != land.Rows[y][x] || heightAt(s, sx, sy) != heightAt(land, x, y) {
					t.Fatalf("%s %d,%d is not the same at sea", id, x, y)
				}
				if s.PlaceAt(sx, sy) != place || s.Walkable(sx, sy) {
					t.Fatalf("%s %d,%d at sea: place %v, walkable %v", id, x, y, s.PlaceAt(sx, sy), s.Walkable(sx, sy))
				}
			}
		}
	}
}

func TestEveryLandTileOfTheSeaBelongsToAPlace(t *testing.T) {
	s := sea()
	for y := range s.Size {
		for x := range s.Size {
			if !s.IsWater(x, y) && s.PlaceAt(x, y) == nil {
				t.Fatalf("land at %d,%d belongs to no place", x, y)
			}
		}
	}
}

// A small island is no use unless one can step ashore on it from the water.
func TestEverySmallIslandCanBeWalkedOnFromItsShore(t *testing.T) {
	s := sea()
	for i := range s.Places {
		place := &s.Places[i]
		if place.Map != "" {
			continue
		}
		shore := 0
		for y := range s.Size {
			for x := range s.Size {
				if s.PlaceAt(x, y) == place && s.CanStandOn(x, y) && besideWater(s, x, y) {
					shore++
				}
			}
		}
		if shore == 0 {
			t.Errorf("%s has no shore that can be stood on", place.Name)
		}
	}
}

func besideWater(m *content.Map, x, y int) bool {
	for _, d := range dirs {
		if m.IsWater(x+d.X, y+d.Y) {
			return true
		}
	}
	return false
}

func TestMooringsAreOnOpenWaterAtSea(t *testing.T) {
	s := sea()
	for _, id := range []string{"island", "mainland"} {
		m, place := content.MapByID[id], s.PlaceByID(id)
		moor := m.Mooring
		if moor == nil || m.Station("dock") == nil {
			t.Fatalf("%s has no dock and mooring", id)
		}
		x, y := int(math.Floor(moor.X)), int(math.Floor(moor.Y))
		if !m.IsWater(x, y) || !s.IsWater(x+place.X, y+place.Y) {
			t.Errorf("the mooring of %s is not on water", id)
		}
	}
}
