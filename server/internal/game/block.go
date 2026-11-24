package game

import (
	"slices"
	"strings"

	"driftwake/server/internal/pb"
)

// Blocked names are kept in lower case, since names are unique whatever their case.
func (c *Char) hasBlocked(name string) bool { return slices.Contains(c.Blocked, strings.ToLower(name)) }

func (w *World) block(p *Player, m *pb.Block) {
	name := strings.ToLower(m.Name)
	p.C.Blocked = slices.DeleteFunc(p.C.Blocked, func(b string) bool { return b == name })
	if m.On && name != strings.ToLower(p.Name) {
		if len(p.C.Blocked) >= maxBlocked {
			w.tell(p, "You cannot block any more players.")
			return
		}
		p.C.Blocked = append(p.C.Blocked, name)
		w.tell(p, "You will not hear from "+m.Name+" any more. Settings lists everyone you have blocked.")
	}
	p.dirty = true
	w.save(p)
}
