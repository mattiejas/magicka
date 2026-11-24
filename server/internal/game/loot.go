package game

import (
	"math"

	"driftwake/content"
	"driftwake/server/internal/pb"
)

type rolled struct {
	item   string
	qty    int
	unique bool
}

// rollLoot gives everything guaranteed, one common entry, and each rare and unique entry by its own chance.
func rollLoot(rnd func() float64, t *content.Loot) (out []rolled) {
	quantity := func(r content.Range) int { return r.Min + randomInt(rnd, r.Max-r.Min+1) }
	for _, r := range t.Always {
		out = append(out, rolled{r.Item, quantity(r), false})
	}
	if len(t.Common) > 0 {
		r := t.Common[randomInt(rnd, len(t.Common))]
		out = append(out, rolled{r.Item, quantity(r), false})
	}
	for _, r := range t.Rare {
		if rnd() < r.Chance {
			out = append(out, rolled{r.Item, r.Qty, false})
		}
	}
	for _, u := range t.Unique {
		if rnd() < u.Chance {
			out = append(out, rolled{u.Item, 1, true})
		}
	}
	return
}

// randomInt is at least 0 and below n.
func randomInt(rnd func() float64, n int) int { return int(math.Floor(rnd() * float64(n))) }

// drop puts items on the ground, private to owner at first. Items that do not stack lie separately.
func (w *World) drop(m *content.Map, at Point, item string, qty int, owner uint32, times lootTimes) {
	count, each := qty, 1
	if content.Items[item].Stack {
		count, each = 1, qty
	}
	for range count {
		w.dropSeq++
		w.drops = append(w.drops, &Drop{
			ID:       entityID(kindDrop, w.dropSeq),
			Map:      m,
			X:        at.X,
			Y:        at.Y,
			Item:     item,
			Qty:      each,
			Owner:    owner,
			publicAt: w.Tick + Ticks(times.private),
			expires:  w.Tick + Ticks(times.private+times.public),
		})
	}
}

// dropLoot rolls a dead monster's loot for one winner.
func (w *World) dropLoot(m *Monster, winner uint32) {
	name, times := "An adventurer", monsterLoot
	if p := w.players[winner]; p != nil {
		name = p.Name
	}
	if m.Def.Boss != nil {
		times = bossLoot
	}
	for i, loot := range rollLoot(w.rnd, &m.Def.Loot) {
		at := Point{X: m.X, Y: m.Y}
		if spread := at.X + i%m.Def.Size; m.Map.Walkable(spread, at.Y) {
			at.X = spread
		}
		w.drop(m.Map, at, loot.item, loot.qty, winner, times)
		if loot.unique {
			text := name + " received " + content.Items[loot.item].Name + " from " + m.Def.Name + "."
			w.broadcast(infoMsg(text, pb.InfoKind_INFO_KIND_UNIQUE))
		}
	}
}

func (w *World) pickup(p *Player, d *Drop) {
	w.stop(p)
	if p.give(d.Item, d.Qty) < d.Qty {
		w.tell(p, "Your inventory is full.")
		return
	}
	for i, o := range w.drops {
		if o == d {
			w.drops = append(w.drops[:i:i], w.drops[i+1:]...)
			break
		}
	}
	w.save(p)
}

func (w *World) removeExpiredDrops() {
	keep := w.drops[:0]
	for _, d := range w.drops {
		if d.expires > w.Tick {
			keep = append(keep, d)
		}
	}
	clear(w.drops[len(keep):])
	w.drops = keep
}
