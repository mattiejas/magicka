package game

import (
	"math"
	"slices"

	"driftwake/content"
)

// Encounters happen on one map, unannounced, for whoever is near.
const encounterMap = "mainland"

// dirt is how roads are written in a map's rows.
const dirt = '3'

// A stampede runs along the road between these columns.
const (
	stampedeFrom, stampedeTo, stampedeRow = 16, 66, 60
	stampedeBoars                         = 6
)

func (w *World) startEncounter() {
	w.nextEncounter = w.Tick + Ticks(encounterMin+w.rnd()*(encounterMax-encounterMin))
	someone := false
	for _, p := range w.order {
		someone = someone || p.C.Map == encounterMap
	}
	if !someone {
		return
	}
	kinds := []func(){w.startVein, w.startTrader, w.startStampede}
	kinds[randomInt(w.rnd, len(kinds))]()
}

// startVein makes a rock rich for a while: it never runs out and gives twice as much.
func (w *World) startVein() {
	var rocks []*Node
	for _, n := range w.nodes {
		if n.Map.ID == encounterMap && n.Def.Kind == "rock" && n.Def.Glows {
			rocks = append(rocks, n)
		}
	}
	n := rocks[randomInt(w.rnd, len(rocks))]
	n.richUntil, n.depletedUntil = w.Tick+veinTime, 0
}

// startTrader puts a trader beside one of the roads, who wants a material anyone can gather.
func (w *World) startTrader() {
	m := content.MapByID[encounterMap]
	var wanted []string
	for _, n := range content.Nodes {
		if n.Skill != "" && n.Item != "essence" && n.Size == 1 {
			wanted = append(wanted, n.Item)
		}
	}
	slices.Sort(wanted) // maps have no order
	var spots []Point
	for y, row := range m.Rows {
		for x := range row {
			if row[x] == dirt && m.Walkable(x, y) && m.Walkable(x+1, y) && !w.inTown(m, x, y) {
				spots = append(spots, Point{X: x, Y: y})
			}
		}
	}
	at := spots[randomInt(w.rnd, len(spots))]
	w.addNPC(&NPC{
		Kind:  npcTrader,
		Map:   m,
		X:     at.X,
		Y:     at.Y,
		until: w.Tick + traderTime,
		wants: wanted[randomInt(w.rnd, len(wanted))],
		sold:  map[uint32]int{},
	})
}

// addHerd prepares the animals of stampedes, which wait out of sight.
func (w *World) addHerd() {
	m := content.MapByID[encounterMap]
	for i := range stampedeBoars + 1 {
		kind := "stampede_boar"
		if i == 0 {
			kind = "stampede_leader"
		}
		at := content.Placed{Type: kind, X: stampedeFrom + 6 - i, Y: stampedeRow + i%2}
		w.addMonster(m, at)
		w.hide(w.monsters[len(w.monsters)-1])
	}
}

// hide takes a monster out of the world until something brings it back.
func (w *World) hide(m *Monster) {
	m.Dead, m.target, m.respawnAt = true, 0, math.MaxInt
	w.vacate(m)
}

func (w *World) startStampede() {
	w.stampedeEnds = w.Tick + stampedeTime
	for _, m := range w.monsters {
		if m.Def.Herd && m.Dead {
			m.home = m.start
			m.damage.clear()
			w.respawn(m)
		}
	}
}

// herdOn moves a stampeding animal along. It is gone when it arrives, or has taken too long.
func (w *World) herdOn(m *Monster) {
	if m.X >= stampedeTo || w.Tick >= w.stampedeEnds {
		w.hide(m)
		return
	}
	w.stepTowards(m, Point{X: stampedeTo, Y: m.Y})
	m.home = Point{X: m.X, Y: m.Y}
}
