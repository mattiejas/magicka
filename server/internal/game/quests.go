package game

import (
	"driftwake/content"
	"driftwake/server/internal/pb"
)

func questByID(id string) *content.Quest {
	for _, q := range content.Quests {
		if q.ID == id {
			return q
		}
	}
	return nil
}

func (w *World) startQuest(p *Player, id string) {
	q := questByID(id)
	if q == nil || p.C.BoatDone || !w.nearStation(p, "dock") {
		return
	}
	if _, begun := p.C.Quests[id]; begun {
		return
	}
	p.C.Quests[id] = 0
	w.save(p)
}

// advanceQuests moves on from steps that are done. A step stays done, whatever happens afterwards.
func (w *World) advanceQuests(p *Player) {
	for id, done := range p.C.Quests {
		q := questByID(id)
		if q == nil || done >= len(q.Steps) {
			continue
		}
		before := done
		for done < len(q.Steps) && p.C.meets(q.Steps[done].Need) {
			done++
		}
		if done == before {
			continue
		}
		p.C.Quests[id] = done
		if done == len(q.Steps) {
			w.finishQuest(p, q)
		}
		w.save(p)
	}
}

// finishQuest pays the reward. What does not fit waits with the reaper.
func (w *World) finishQuest(p *Player, q *content.Quest) {
	w.info(p, q.Thanks+" You completed "+q.Name+".", pb.InfoKind_INFO_KIND_LEVEL)
	for _, r := range q.Reward {
		if p.giveOrKeep(r.Item, r.Qty) > 0 {
			w.tell(p, "The reaper is keeping the rest of your reward.")
		}
	}
}

func (c *Char) meets(n content.Need) bool {
	if n.XP != "" && c.XP[n.XP] == 0 {
		return false
	}
	if n.Boat != "" && !c.placed(func(b content.Part) bool { return b.ID == n.Boat }) {
		return false
	}
	if len(n.Own) == 0 {
		return true
	}
	for _, id := range n.Own {
		if c.owns(id) || c.placed(func(b content.Part) bool { return b.Item == id }) {
			return true
		}
	}
	return false
}

// placed reports whether a matching part of the boat is complete.
func (c *Char) placed(match func(content.Part) bool) bool {
	for _, b := range content.BoatParts {
		if match(b) && c.Boat[b.ID] >= b.Qty {
			return true
		}
	}
	return false
}
