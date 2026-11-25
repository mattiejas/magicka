package game

import "math"

// away is the depletedUntil of a place that does not hold its spot now.
const away = math.MaxInt

// spreadSpots joins fishing spots that lie close together into groups, and leaves only some places of each
// holding a spot.
func (w *World) spreadSpots() {
	for _, group := range joinNear(w.nodes, func(n *Node) bool { return n.Def.Moves }) {
		held := int(math.Ceil(float64(len(group)) * spotShare))
		for i, n := range shuffled(group, w.rnd) {
			n.places = group
			if i >= held {
				n.depletedUntil = away
			}
		}
	}
}

// moveSpot takes a spot away from its place to one of its group that holds none.
func (w *World) moveSpot(n *Node) {
	var free []*Node
	for _, o := range n.places {
		if o.depletedUntil == away {
			free = append(free, o)
		}
	}
	if len(free) == 0 {
		return
	}
	free[randomInt(w.rnd, len(free))].depletedUntil = 0
	n.depletedUntil = away
}

func shuffled(nodes []*Node, rnd func() float64) []*Node {
	out := append([]*Node(nil), nodes...)
	for i := len(out) - 1; i > 0; i-- {
		j := randomInt(rnd, i+1)
		out[i], out[j] = out[j], out[i]
	}
	return out
}
