package game

import "driftwake/content"

// glow is one node's time of glowing. Everyone may strike it once for a bonus.
type glow struct {
	node  uint32
	until int
}

// glowGroup is a number of like nodes close together, one of which glows at any time.
type glowGroup struct {
	nodes []*Node
	last  *Node
	until int
}

// glowSpacing is how far apart two nodes of a group may be, in tiles.
const glowSpacing = 8

// findGlowGroups joins nodes of a kind that lie close to each other.
func findGlowGroups(nodes []*Node) (groups []*glowGroup) {
	taken := map[*Node]bool{}
	for _, first := range nodes {
		if taken[first] || !first.Def.Glows || !first.Map.Methods {
			continue
		}
		taken[first] = true
		group := []*Node{first}
		for i := 0; i < len(group); i++ { // grows while it is walked through
			for _, n := range nodes {
				if !taken[n] && n.Def == first.Def && n.Map == first.Map && n.near(group[i]) {
					taken[n] = true
					group = append(group, n)
				}
			}
		}
		if len(group) >= content.Methods.GlowGroup {
			groups = append(groups, &glowGroup{nodes: group})
		}
	}
	return
}

func (n *Node) near(o *Node) bool { return max(abs(n.X-o.X), abs(n.Y-o.Y)) <= glowSpacing }

// moveGlow lets another node of a group glow when the last one is done.
func (w *World) moveGlow(g *glowGroup) {
	if w.Tick < g.until {
		return
	}
	var ready []*Node
	for _, n := range g.nodes {
		if n != g.last && n.depletedUntil <= w.Tick && !n.isRich(w.Tick) {
			ready = append(ready, n)
		}
	}
	if len(ready) == 0 {
		return
	}
	g.last, g.until = ready[randomInt(w.rnd, len(ready))], w.Tick+content.Methods.GlowTicks
	g.last.glowingUntil = g.until
}

// offersGlow reports whether a node has a bonus left for a player.
func (w *World) offersGlow(p *Player, n *Node) bool {
	this := glow{n.ID, n.glowingUntil}
	return n.isGlowing(w.Tick) && p.lastGlow != this && p.gatherLevel(n.Def) >= content.Methods.Level
}

// strikeGlow takes the bonus once a player has worked for it, which takes the same time on any node.
func (w *World) strikeGlow(p *Player, n *Node) bool {
	p.nextAct = min(p.nextAct, w.Tick+glowInterval)
	if !w.workReady(p, glowInterval) {
		return false
	}
	p.lastGlow = glow{n.ID, n.glowingUntil}
	return true
}
