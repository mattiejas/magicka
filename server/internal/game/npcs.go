package game

import (
	"driftwake/content"
	"driftwake/server/internal/pb"
)

const (
	npcTrader = "trader"
	npcGenie  = "genie"
	lamp      = "genie_lamp"
)

// NPC is someone who visits for a while.
type NPC struct {
	ID    uint32
	Kind  string
	Map   *content.Map
	X, Y  int
	until int            // tick of leaving
	owner uint32         // the only player who sees them, or 0
	wants string         // what a trader buys
	sold  map[uint32]int // how much each player sold a trader
}

func (w *World) addNPC(n *NPC) {
	w.npcSeq++
	n.ID = entityID(kindNPC, w.npcSeq)
	w.npcs = append(w.npcs, n)
}

func (w *World) npcByID(id uint32) *NPC {
	for _, n := range w.npcs {
		if n.ID == id {
			return n
		}
	}
	return nil
}

func (w *World) removeNPC(gone *NPC) {
	keep := w.npcs[:0]
	for _, n := range w.npcs {
		if n != gone {
			keep = append(keep, n)
		}
	}
	w.npcs = keep
}

func (w *World) removeLeavingNPCs() {
	for i := len(w.npcs) - 1; i >= 0; i-- {
		if w.npcs[i].until <= w.Tick {
			w.removeNPC(w.npcs[i])
		}
	}
}

func (w *World) speakTo(p *Player, n *NPC) {
	w.stop(p)
	if n.Kind == npcGenie {
		w.takeLamp(p, n)
		return
	}
	w.open(p, n.Kind)
}

// sellToTrader sells what a trader in reach wants, for more than any shop pays.
func (w *World) sellToTrader(p *Player, qty int) {
	for _, n := range w.npcs {
		if n.Kind != npcTrader || n.Map.ID != p.C.Map || !inReach(p.C.X, p.C.Y, tile(n.X, n.Y), stationReach) {
			continue
		}
		count := min(qty, p.count(n.wants), traderLimit-n.sold[p.ID])
		if count <= 0 {
			w.tell(p, "The trader has no more to buy from you.")
			return
		}
		if w.sellFor(p, content.Items[n.wants], count, traderPercent) {
			n.sold[p.ID] += count
		}
		return
	}
}

// --- genie

// countPlay adds to the time players have really been playing.
func (w *World) countPlay() {
	for _, p := range w.order {
		if p.conn != nil && w.Tick-p.lastInput < activeTime {
			p.C.PlayTicks++
		}
	}
}

// visitSomeone sends a genie to one active player who has not seen one for a long time.
func (w *World) visitSomeone() {
	var ready []*Player
	for _, p := range w.order {
		busy := p.conn == nil || p.trade != nil || w.Tick-p.lastCombat < fightMemory || w.Tick-p.lastInput > geniePatience
		if !busy && p.C.PlayTicks-p.C.GenieAt >= genieInterval {
			ready = append(ready, p)
		}
	}
	if len(ready) == 0 {
		return
	}
	for _, n := range w.npcs {
		if n.Kind == npcGenie {
			return
		}
	}
	w.sendGenie(ready[randomInt(w.rnd, len(ready))])
}

func (w *World) sendGenie(p *Player) {
	m := w.mapOf(p)
	for i := range dirs {
		d := dirs[(i+1)%len(dirs)] // to the side, where the player does not stand in front of it
		x, y := p.C.X+d.X, p.C.Y+d.Y
		if !m.Walkable(x, y) {
			continue
		}
		p.C.GenieAt = p.C.PlayTicks
		w.addNPC(&NPC{Kind: npcGenie, Map: m, X: x, Y: y, owner: p.ID, until: w.Tick + genieStay})
		w.info(p, "A genie has appeared beside you. It will not wait long.", pb.InfoKind_INFO_KIND_UNIQUE)
		return
	}
}

func (w *World) takeLamp(p *Player, n *NPC) {
	if p.give(lamp, 1) == 0 {
		w.tell(p, "The genie offers you a lamp, but your inventory is full.")
		return
	}
	w.tell(p, "The genie gives you a lamp, and is gone.")
	w.removeNPC(n)
	w.save(p)
}

// useLamp trains a skill as much as ten minutes of a relaxed method would.
func (w *World) useLamp(p *Player, skill string) {
	if _, ok := p.C.XP[skill]; !ok || !p.take(lamp, 1) {
		return
	}
	w.addXP(p, skill, LampXP(p.level(skill)))
	w.save(p)
}
