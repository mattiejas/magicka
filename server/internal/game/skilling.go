package game

import (
	"fmt"

	"driftwake/content"
	"driftwake/server/internal/pb"
)

func (w *World) gather(p *Player, n *Node) {
	d := n.Def
	lv := 1
	if d.Skill != "" {
		lv = p.level(d.Skill)
	}
	if n.depletedUntil > w.Tick {
		w.stop(p)
		return
	}
	if lv < d.Level {
		w.info(p, fmt.Sprintf("You need %s level %d for that.", d.Skill, d.Level), 0)
		w.stop(p)
		return
	}
	tier := 0
	if d.Tool != "" {
		tier = p.bestTool(d.Tool)
		if tier < 0 {
			a := "a "
			if d.Tool == "axe" {
				a = "an "
			}
			w.info(p, "You are not carrying "+a+d.Tool+" you can use.", 0)
			w.stop(p)
			return
		}
		if tier < d.Tier-1 {
			w.info(p, "You need a better "+d.Tool+" for that.", 0)
			w.stop(p)
			return
		}
	}
	if p.emptySlot() < 0 && !(content.Items[d.Item].Stack && p.count(d.Item) > 0) {
		w.info(p, "Your inventory is full.", 0)
		w.stop(p)
		return
	}
	if d.Tool != "" {
		p.tool = "worn_" + d.Tool
		if tier > 0 {
			p.tool = content.Metals[tier] + "_" + d.Tool
		}
	}
	p.doing = map[string]string{"rock": "mine", "tree": "chop", "plant": "pick"}[d.Kind]
	if !w.workReady(p) || w.rnd() > GatherChance(lv, d.Level, tier) {
		return
	}
	p.give(d.Item, 1)
	if d.Skill != "" {
		w.addXP(p, d.Skill, d.XP)
	}
	if d.Kind == "rock" && d.ID != "essence_rock" && w.rnd() < 0.04 {
		p.give(fmt.Sprintf("gem_%d", d.Tier), 1)
	}
	if w.rnd() < d.Deplete {
		n.depletedUntil = w.Tick + Ticks(d.Respawn)
		w.stop(p)
	}
}

// workReady paces work at one attempt every three ticks; the first attempt waits too.
func (w *World) workReady(p *Player) bool {
	if p.nextAct > w.Tick {
		return false
	}
	started := p.nextAct >= w.Tick-1
	p.nextAct = w.Tick + 3
	return started
}

func (w *World) craft(p *Player) {
	r := p.act.recipe
	if !w.nearStation(p, r.Station) {
		w.stop(p)
		return
	}
	if p.level(r.Skill) < r.Level {
		w.info(p, fmt.Sprintf("You need %s level %d.", r.Skill, r.Level), 0)
		w.stop(p)
		return
	}
	for _, in := range r.In {
		if p.count(in.Item) < in.Qty {
			w.info(p, "You are out of materials.", 0)
			w.stop(p)
			return
		}
	}
	p.doing = "craft"
	if !w.workReady(p) {
		return
	}
	before := make([]*Stack, len(p.C.Inv))
	for i, s := range p.C.Inv {
		if s != nil {
			c := *s
			before[i] = &c
		}
	}
	for _, in := range r.In {
		p.take(in.Item, in.Qty)
	}
	if p.give(r.Out, r.Qty) < r.Qty {
		p.C.Inv = before
		w.info(p, "Your inventory is full.", 0)
		w.stop(p)
		return
	}
	w.addXP(p, r.Skill, r.XP)
	if p.act.left--; p.act.left <= 0 {
		w.stop(p)
	}
}

func (w *World) buildBoat(p *Player) {
	added, done := false, true
	for _, b := range content.BoatParts {
		if n := min(b.Qty-p.C.Boat[b.ID], p.count(b.Item)); n > 0 && p.take(b.Item, n) {
			p.C.Boat[b.ID] += n
			added = true
		}
		done = done && p.C.Boat[b.ID] >= b.Qty
	}
	if !added {
		w.info(p, "You have nothing the boat needs.", 0)
		return
	}
	p.dirty = true
	if done {
		p.C.BoatDone = true
		w.info(p, "Your boat is finished. You can sail to the mainland.", pb.InfoKind_INFO_KIND_LEVEL)
	}
	w.save(p)
}
