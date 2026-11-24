package game

import (
	"driftwake/content"
	"driftwake/server/internal/pb"
)

// grantCapes gives a cape for every skill a player has mastered. Trophies cannot be lost, so one of each is enough.
func (w *World) grantCapes(p *Player) {
	for _, skill := range content.Skills {
		cape := "cape_" + skill
		if p.level(skill) < MaxLevel || p.C.owns(cape) {
			continue
		}
		text := "You received the " + content.Items[cape].Name + "."
		if p.give(cape, 1) == 0 {
			p.C.Kept = addTo(p.C.Kept, cape, 1)
			text = "The reaper is keeping your " + content.Items[cape].Name + "."
		}
		p.C.logFind(skillSource, cape)
		p.dirty = true
		w.info(p, text, pb.InfoKind_INFO_KIND_UNIQUE)
		w.save(p)
	}
}

// owns looks everywhere a character can have an item.
func (c *Char) owns(id string) bool {
	for _, list := range c.everywhere() {
		for _, s := range list {
			if s != nil && s.ID == id {
				return true
			}
		}
	}
	return false
}

// everywhere lists all the places a character can have items.
func (c *Char) everywhere() [][]*Stack {
	lists := [][]*Stack{c.Inv, c.Bank, c.Kept}
	for _, s := range c.Equip {
		lists = append(lists, []*Stack{s})
	}
	if c.Grave != nil {
		lists = append(lists, c.Grave.Items)
	}
	return lists
}
