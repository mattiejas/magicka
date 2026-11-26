package game

import (
	"fmt"

	"driftwake/content"
	"driftwake/server/internal/pb"
)

func (w *World) gather(p *Player, n *Node) {
	d := n.Def
	if n.depletedUntil > w.Tick {
		w.stop(p)
		return
	}
	if why := p.cannotGather(d); why != "" {
		w.refuse(p, why)
		return
	}
	tier := 0
	if d.Tool != "" {
		tier = p.bestTool(d.Tool)
		p.tool = toolID(d.Tool, tier)
	}
	p.doing = gatherAction[d.Kind]
	xp := d.XP
	if w.offersGlow(p, n) {
		if !w.strikeGlow(p, n) {
			return
		}
		xp *= content.Methods.GlowBonus
	} else if !w.workReady(p, d.Interval) || w.rnd() > GatherChance(p.gatherLevel(d), d.Difficulty, tier) {
		return
	}
	p.give(d.Item, yieldOf(n, w.Tick))
	if d.Skill != "" {
		w.addXP(p, d.Skill, xp)
	}
	if d.HasGems() && w.rnd() < gemChance {
		p.give(fmt.Sprintf("gem_%d", d.Tier), 1)
	}
	if !n.isGlowing(w.Tick) && !n.isRich(w.Tick) && w.rnd() < d.Deplete {
		w.runOut(n)
		w.stop(p)
	}
}

// runOut ends a node for a while, or moves a fishing spot along the shore.
func (w *World) runOut(n *Node) {
	if n.Def.Moves {
		w.moveSpot(n)
		return
	}
	n.depletedUntil = w.Tick + Ticks(n.Def.Respawn)
}

func yieldOf(n *Node, tick int) int {
	if n.isRich(tick) {
		return veinYield
	}
	return 1
}

// gatherLevel is 1 for nodes that need no skill.
func (p *Player) gatherLevel(d *content.Node) int {
	if d.Skill == "" {
		return 1
	}
	return p.level(d.Skill)
}

// cannotGather says what a player is missing, if anything. Each tier needs a tool of at least the tier before,
// where tools of that tier are made.
func (p *Player) cannotGather(d *content.Node) string {
	if p.gatherLevel(d) < d.Level {
		return fmt.Sprintf("You need %s level %d for that.", d.Skill, d.Level)
	}
	if d.Tool != "" {
		switch tier := p.bestTool(d.Tool); {
		case tier < 0:
			return "You are not carrying " + withArticle(d.Tool) + " you can use."
		case tier < d.Tier-1 && content.Items[toolID(d.Tool, d.Tier-1)] != nil:
			return "You need a better " + d.Tool + " for that."
		}
	}
	joinsStack := content.Items[d.Item].Stack && p.count(d.Item) > 0
	if p.emptySlot() < 0 && !joinsStack {
		return "Your inventory is full."
	}
	return ""
}

func withArticle(tool string) string {
	switch tool {
	case "axe":
		return "an axe"
	case "rod":
		return "a fishing rod"
	}
	return "a " + tool
}

func toolID(tool string, tier int) string {
	if tier == 0 {
		return "worn_" + tool
	}
	return content.Metals[tier] + "_" + tool
}

// workReady paces work at one attempt per interval; the first attempt waits too.
func (w *World) workReady(p *Player, interval int) bool {
	if p.nextAct > w.Tick {
		return false
	}
	started := p.nextAct >= w.Tick-1
	p.nextAct = w.Tick + interval
	return started
}

// craft makes one item of the player's recipe at a time.
func (w *World) craft(p *Player) {
	r := p.act.recipe
	if !w.canMake(p, r) {
		return
	}
	p.doing = working
	if w.workReady(p, craftInterval) {
		w.make(p, r.Out, r.XP)
	}
}

// canMake checks the player can go on with a recipe, and stops them if not.
func (w *World) canMake(p *Player, r *content.Recipe) bool {
	if !w.nearStation(p, r.Station) {
		w.stop(p)
		return false
	}
	if p.level(r.Skill) < r.Level {
		w.refuse(p, fmt.Sprintf("You need %s level %d.", r.Skill, r.Level))
		return false
	}
	for _, in := range r.In {
		if p.count(in.Item) < in.Qty {
			w.refuse(p, "You are out of materials.")
			return false
		}
	}
	return true
}

// make turns the materials of the player's recipe into out, which is usually what the recipe makes.
func (w *World) make(p *Player, out string, xp float64) {
	r := p.act.recipe
	before := copyStacks(p.C.Inv)
	for _, in := range r.In {
		p.take(in.Item, in.Qty)
	}
	if p.give(out, r.Qty) < r.Qty {
		p.C.Inv = before
		w.refuse(p, "Your inventory is full.")
		return
	}
	if xp > 0 {
		w.addXP(p, r.Skill, xp)
	}
	if p.act.left--; p.act.left <= 0 {
		w.stop(p)
	}
}

func copyStacks(list []*Stack) []*Stack {
	out := make([]*Stack, len(list))
	for i, s := range list {
		if s != nil {
			c := *s
			out[i] = &c
		}
	}
	return out
}

// buildBoat adds every part the player carries.
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
		w.tell(p, "You have nothing the boat needs.")
		return
	}
	if done {
		p.C.BoatDone = true
		w.info(p, "Your boat is finished. You can sail to the mainland.", pb.InfoKind_INFO_KIND_LEVEL)
	}
	w.save(p)
}
