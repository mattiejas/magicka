package game

import "driftwake/content"

type Point = content.Point
type Rect struct{ X, Y, W, H int }

func tile(x, y int) Rect { return Rect{x, y, 1, 1} }
func RectDist(x, y int, r Rect) int {
	return max(r.X-x, 0, x-(r.X+r.W-1), r.Y-y, y-(r.Y+r.H-1))
}
func inReach(x, y int, r Rect, reach int) bool { return RectDist(x, y, r) <= reach }

var dirs = [8]Point{{X: 0, Y: -1}, {X: 1, Y: 0}, {X: 0, Y: 1}, {X: -1, Y: 0}, {X: 1, Y: -1}, {X: 1, Y: 1}, {X: -1, Y: 1}, {X: -1, Y: -1}}

// canStep refuses diagonal moves that would cut a corner.
func canStep(m *content.Map, x, y, dx, dy int) bool {
	if !m.Walkable(x+dx, y+dy) {
		return false
	}
	return dx == 0 || dy == 0 || (m.Walkable(x+dx, y) && m.Walkable(x, y+dy))
}

type heapItem struct {
	f float64
	c int
}

// pathfinder reuses its buffers between searches.
type pathfinder struct {
	g      []float32
	from   []int
	state  []uint32 // search number in which g is valid
	closed []uint32
	n      uint32
	heap   []heapItem
}

func (p *pathfinder) push(f float64, c int) {
	h := append(p.heap, heapItem{f, c})
	for i := len(h) - 1; i > 0; {
		q := (i - 1) / 2
		if h[q].f <= h[i].f {
			break
		}
		h[q], h[i] = h[i], h[q]
		i = q
	}
	p.heap = h
}
func (p *pathfinder) pop() int {
	h := p.heap
	top, last := h[0], h[len(h)-1]
	h = h[:len(h)-1]
	if len(h) > 0 {
		h[0] = last
		for i := 0; ; {
			s, l, r := i, 2*i+1, 2*i+2
			if l < len(h) && h[l].f < h[s].f {
				s = l
			}
			if r < len(h) && h[r].f < h[s].f {
				s = r
			}
			if s == i {
				break
			}
			h[s], h[i] = h[i], h[s]
			i = s
		}
	}
	p.heap = h
	return top.c
}

// find runs A* to any tile within reach of the target, or to the reachable tile closest to it.
func (p *pathfinder) find(m *content.Map, sx, sy int, target Rect, reach int) []Point {
	N := m.Size
	if len(p.g) < N*N {
		p.g, p.from, p.state, p.closed, p.n = make([]float32, N*N), make([]int, N*N), make([]uint32, N*N), make([]uint32, N*N), 0
	}
	p.n++
	p.heap = p.heap[:0]
	start := sy*N + sx
	h := func(x, y int) int { return max(0, RectDist(x, y, target)-reach) }
	p.g[start], p.state[start], p.from[start] = 0, p.n, -1
	p.push(float64(h(sx, sy)), start)
	best, bestH := start, h(sx, sy)
	for len(p.heap) > 0 {
		c := p.pop()
		if p.closed[c] == p.n {
			continue
		}
		p.closed[c] = p.n
		x, y := c%N, c/N
		hh := h(x, y)
		if hh < bestH {
			best, bestH = c, hh
		}
		if hh == 0 {
			best = c
			break
		}
		for _, d := range dirs {
			if !canStep(m, x, y, d.X, d.Y) {
				continue
			}
			n, cost := (y+d.Y)*N+x+d.X, 1.0
			if d.X != 0 && d.Y != 0 {
				cost = 1.001
			}
			ng := float64(p.g[c]) + cost
			if p.state[n] != p.n || ng < float64(p.g[n]) {
				p.g[n], p.state[n], p.from[n] = float32(ng), p.n, c
				p.push(ng+float64(h(x+d.X, y+d.Y)), n)
			}
		}
	}
	var out []Point
	for c := best; c != start; c = p.from[c] {
		out = append(out, Point{X: c % N, Y: c / N})
	}
	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}
	return out
}
