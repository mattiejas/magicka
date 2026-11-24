package game

import (
	"driftwake/content"
	"driftwake/server/internal/pb"
)

// die moves what a player carries to their grave, and the player to town. Worn gear stays on.
func (w *World) die(p *Player) {
	c := p.C
	var items []*Stack
	if c.Grave != nil { // an earlier grave moves along
		items = c.Grave.Items
	}
	for i, s := range c.Inv {
		if s != nil {
			items = addTo(items, s.ID, s.Qty)
			c.Inv[i] = nil
		}
	}
	text := "You died."
	if len(items) > 0 {
		c.Grave = &Grave{c.Map, c.X, c.Y, items}
		text = "You died. Your carried items are safe at your grave or with the reaper."
	}
	w.emitDeath(w.mapOf(p), c.X, c.Y, p.ID)
	spawn := w.mapOf(p).Spawn
	c.X, c.Y, c.HP = spawn.X, spawn.Y, MaxHP(p.level("vitality"))
	w.stop(p)
	p.via, p.rooted, p.lastCombat, p.dirty = nil, 0, longAgo, true
	for _, m := range w.monsters {
		m.forget(p)
	}
	w.info(p, text, pb.InfoKind_INFO_KIND_BAD)
	w.save(p)
}

// forget stops fighting a player who died. It costs them part of their contribution to a boss.
func (m *Monster) forget(p *Player) {
	if m.target == p.ID {
		m.target = 0
	}
	m.active.del(p.ID)
	if m.Def.Boss != nil && m.damage.has(p.ID) {
		m.damage.set(p.ID, m.damage.get(p.ID)*deathKeeps)
	}
}

// claimGrave gives back as much as fits of what the player lost by dying.
func (w *World) claimGrave(p *Player) {
	g := p.C.Grave
	if g == nil {
		w.tell(p, "The reaper holds nothing of yours.")
		return
	}
	if g.Items = p.giveAll(g.Items); len(g.Items) == 0 {
		p.C.Grave = nil
	} else {
		w.tell(p, "Your inventory is full. The rest is kept for you.")
	}
	p.dirty = true
	w.save(p)
}

// claimKept gives back as much as fits of the uniques the reaper is keeping.
func (w *World) claimKept(p *Player) {
	if p.C.Kept = p.giveAll(p.C.Kept); len(p.C.Kept) > 0 {
		w.tell(p, "Your inventory is full. The rest is kept for you.")
	}
	p.dirty = true
	w.save(p)
}

// giveAll returns what did not fit.
func (p *Player) giveAll(items []*Stack) (left []*Stack) {
	for _, s := range items {
		if content.Items[s.ID].Stack || p.emptySlot() >= 0 {
			s.Qty -= p.give(s.ID, s.Qty)
		}
		if s.Qty > 0 {
			left = append(left, s)
		}
	}
	return
}
