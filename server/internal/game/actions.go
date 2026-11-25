package game

// goal is where an action takes place, and how close the player has to come.
type goal struct {
	at    Rect
	reach int
	// outside keeps the player from acting while standing inside the target.
	outside bool
}

// goal of the player's action. ok is false when its target is gone.
func (w *World) goal(p *Player) (g goal, ok bool) {
	a, m := p.act, w.mapOf(p)
	switch a.typ {
	case actGather:
		if n := lookup(w.nodes, kindNode, a.id); n != nil && n.Map == m {
			return goal{n.rect(), 1, false}, true
		}
	case actStation:
		if s := w.station(a.id); s != nil && s.m == m {
			return goal{tile(s.s.X, s.s.Y), 1, false}, true
		}
	case actAttack:
		if o := lookup(w.monsters, kindMonster, a.id); o != nil && !o.Dead && o.Map == m {
			return goal{o.rect(), p.stats().reach, true}, true
		}
	case actPickup:
		if d := w.findDrop(a.id); d != nil && d.Map == m && d.visibleTo(p.ID, w.Tick) {
			return goal{tile(d.X, d.Y), 0, false}, true
		}
	case actNPC:
		if n := w.npcByID(a.id); n != nil && n.Map == m && (n.owner == 0 || n.owner == p.ID) {
			return goal{tile(n.X, n.Y), 1, false}, true
		}
	case actTrade:
		if o := w.players[a.id]; o != nil && o != p && o.C.Map == p.C.Map {
			return goal{tile(o.C.X, o.C.Y), tradeReach, false}, true
		}
	case actGrave:
		if g := p.C.Grave; g != nil && g.Map == p.C.Map {
			return goal{tile(g.X, g.Y), 1, false}, true
		}
	}
	return
}

// actPlayer continues a player's action for one tick.
func (w *World) actPlayer(p *Player) {
	p.via, p.tool = nil, ""
	if !p.isEating(w.Tick) {
		p.doing = ""
	}
	switch p.act.typ {
	case actNone:
	case actCraft:
		if p.act.recipe.Station == "fire" {
			w.cook(p)
		} else {
			w.craft(p)
		}
	case actMove:
		if !p.isRooted(w.Tick) {
			w.walk(p)
			if len(p.path) == 0 {
				w.stop(p)
			}
		}
	default:
		if w.reachGoal(p) {
			w.performAction(p)
		}
	}
}

func (p *Player) isRooted(tick int) bool { return p.rooted > tick }

// reachGoal brings a player to their goal and reports whether they are there.
func (w *World) reachGoal(p *Player) bool {
	g, ok := w.goal(p)
	if !ok {
		w.stop(p)
		return false
	}
	there := func() bool {
		if g.outside {
			return inReachOutside(p.C.X, p.C.Y, g.at, g.reach)
		}
		return inReach(p.C.X, p.C.Y, g.at, g.reach)
	}
	if !there() {
		if p.isRooted(w.Tick) {
			return false
		}
		// Monsters and players move, so the way to one is found anew every tick.
		if len(p.path) == 0 || p.act.typ == actAttack || p.act.typ == actTrade {
			find := w.finder.find
			if g.outside {
				find = w.finder.findOutside
			}
			p.path = find(w.mapOf(p), p.C.X, p.C.Y, g.at, g.reach)
		}
		if len(p.path) == 0 {
			w.refuse(p, "You cannot reach that.")
			return false
		}
		w.walk(p)
		if !there() {
			return false
		}
	}
	p.path = nil
	return true
}

func (w *World) performAction(p *Player) {
	id := p.act.id
	switch p.act.typ {
	case actGather:
		w.gather(p, lookup(w.nodes, kindNode, id))
	case actAttack:
		w.playerAttack(p, lookup(w.monsters, kindMonster, id))
	case actStation:
		w.stop(p)
		if s := w.station(id).s; s.Type == "mine" {
			w.takePassage(p)
		} else {
			w.open(p, s.Type)
		}
	case actGrave:
		w.stop(p)
		w.open(p, "grave")
	case actNPC:
		w.speakTo(p, w.npcByID(id))
	case actTrade:
		w.askToTrade(p, w.players[id])
	case actPickup:
		w.pickup(p, w.findDrop(id))
	}
}

func (w *World) walk(p *Player) {
	n := min(walkSpeed, len(p.path))
	for _, step := range p.path[:n] {
		p.C.X, p.C.Y = step.X, step.Y
		p.via = append(p.via, step)
	}
	p.path = p.path[n:]
}
