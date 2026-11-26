package game

import (
	"driftwake/server/internal/pb"
)

// die moves what a player carries to their grave, and the player to town. Worn gear stays on.
func (w *World) die(p *Player) {
	c := p.C
	c.Deaths++
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
	c.Map = w.mapOf(p).Town
	spawn := w.mapOf(p).Spawn
	c.X, c.Y, c.HP = spawn.X, spawn.Y, MaxHP(p.level("vitality"))
	w.stop(p)
	p.via, p.rooted, p.lastCombat = nil, 0, longAgo
	w.forget(p)
	w.halveContributions(p)
	w.info(p, text, pb.InfoKind_INFO_KIND_BAD)
	w.save(p)
}

// halveContributions costs a player who died part of their contribution to every boss.
func (w *World) halveContributions(p *Player) {
	for _, m := range w.monsters {
		if m.Def.Boss != nil && m.damage.has(p.ID) {
			m.damage.set(p.ID, m.damage.get(p.ID)*deathKeeps)
		}
	}
}
