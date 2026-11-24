package game

import (
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
	if p.trade != nil {
		w.endTrade(p.trade, p.Name+" died.")
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
