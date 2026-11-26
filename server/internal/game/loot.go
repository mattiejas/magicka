package game

import (
	"cmp"
	"math"
	"slices"

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
		d := &Drop{
			ID:       entityID(kindDrop, w.dropSeq),
			Map:      m,
			X:        at.X,
			Y:        at.Y,
			Item:     item,
			Qty:      each,
			Owner:    owner,
			kept:     content.Items[item].Unique,
			personal: content.Items[item].Unique || times.public == 0,
			publicAt: w.Tick + Ticks(times.private),
			expires:  w.Tick + Ticks(times.private+times.public),
		}
		if d.personal { // its time is up when the private time is
			d.expires = d.publicAt
		}
		w.drops = append(w.drops, d)
	}
}

func (d *Drop) visibleTo(player uint32, tick int) bool {
	return d.Owner == player || (!d.personal && d.publicAt <= tick)
}

// keepForOwner hands an unclaimed unique to the reaper, whether or not its owner is here.
func (w *World) keepForOwner(d *Drop) {
	keep := func(c *Char) { c.Kept = addTo(c.Kept, d.Item, d.Qty) }
	if p := w.change(d.Owner, "keeping "+d.Item, keep); p != nil {
		w.info(p, "The reaper is keeping your "+content.Items[d.Item].Name+".", pb.InfoKind_INFO_KIND_UNIQUE)
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
	rolls := rollLoot(w.rnd, &m.Def.Loot)
	w.logLoot(m.Def, winner, rolls)
	for i, loot := range rolls {
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

// pickupAll takes everything on a tile the player may take, as much as fits, and says once if something is left.
func (w *World) pickupAll(p *Player, at Point) {
	w.stop(p)
	lying, taken := w.dropsFor(p, at), map[*Drop]bool{}
	for _, d := range lying {
		if p.give(d.Item, d.Qty) == d.Qty {
			taken[d] = true
		}
	}
	if len(taken) < len(lying) {
		w.tell(p, "Your inventory is full.")
	}
	if len(taken) == 0 {
		return
	}
	w.drops = slices.DeleteFunc(w.drops, func(d *Drop) bool { return taken[d] })
	w.save(p)
}

// dropsFor are the drops on a tile of the player's map that they may take, in the order taking all takes them:
// uniques, then by shop value, then the oldest.
func (w *World) dropsFor(p *Player, at Point) []*Drop {
	m := w.mapOf(p)
	var out []*Drop
	for _, d := range w.drops {
		if d.Map == m && d.X == at.X && d.Y == at.Y && d.visibleTo(p.ID, w.Tick) {
			out = append(out, d)
		}
	}
	slices.SortStableFunc(out, func(a, b *Drop) int { return cmp.Compare(dropWorth(b), dropWorth(a)) })
	return out
}

// uniqueWorth puts uniques before anything else, as the labels on the ground do.
const uniqueWorth = 1e9

func dropWorth(d *Drop) int {
	if content.Items[d.Item].Unique {
		return uniqueWorth
	}
	return content.Items[d.Item].Value * d.Qty
}

func (w *World) removeExpiredDrops() {
	keep := w.drops[:0]
	for _, d := range w.drops {
		switch {
		case d.expires > w.Tick:
			keep = append(keep, d)
		case d.kept:
			w.keepForOwner(d)
		}
	}
	clear(w.drops[len(keep):])
	w.drops = keep
}
