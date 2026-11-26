package game

import (
	"slices"

	"driftwake/server/internal/pb"
)

const lookout = 10 // tiles a player sees on the sea, from the boat or on foot

// Chart is what a character has seen of the sea.
type Chart struct {
	Seen   []byte   `json:"seen"`             // a bit for each tile of the sea, row by row
	Found  []string `json:"found,omitempty"`  // places sighted, whose whole outline is known
	Landed []string `json:"landed,omitempty"` // places gone ashore on, which are seen whole
}

func (c *Char) chart() *Chart {
	size := sea().Size
	if c.Chart == nil || len(c.Chart.Seen) != (size*size+7)/8 {
		c.Chart = &Chart{Seen: make([]byte, (size*size+7)/8)}
	}
	return c.Chart
}

func (c *Chart) has(i int) bool { return c.Seen[i/8]&(1<<(i%8)) != 0 }

// look marks what can be seen from a tile, and gives the tiles newly seen, in order.
func (c *Chart) look(from Point) (seen []int, found bool) {
	m := sea()
	for dy := -lookout; dy <= lookout; dy++ {
		for dx := -lookout; dx <= lookout; dx++ {
			x, y := from.X+dx, from.Y+dy
			if x < 0 || y < 0 || x >= m.Size || y >= m.Size || dx*dx+dy*dy > lookout*lookout {
				continue
			}
			i := y*m.Size + x
			if c.has(i) {
				continue
			}
			c.Seen[i/8] |= 1 << (i % 8)
			seen = append(seen, i)
			if place := m.PlaceAt(x, y); place != nil && !slices.Contains(c.Found, place.ID) {
				c.Found, found = append(c.Found, place.ID), true
			}
		}
	}
	return
}

// land marks a place as gone ashore on, and so sighted.
func (c *Chart) land(id string) {
	if !slices.Contains(c.Found, id) {
		c.Found = append(c.Found, id)
	}
	if !slices.Contains(c.Landed, id) {
		c.Landed = append(c.Landed, id)
	}
}

// lookOut charts what a player on the sea sees from where they went this tick.
func (w *World) lookOut(p *Player) {
	if p.C.Map != seaMap {
		return
	}
	from := []Point{p.at()}
	if p.trail != nil {
		from = from[:0]
		for _, v := range p.trail {
			if t := v.tile(); len(from) == 0 || from[len(from)-1] != t {
				from = append(from, t)
			}
		}
	}
	c := p.C.chart()
	for _, at := range from {
		if at == p.lookedFrom { // nothing new can be seen
			continue
		}
		seen, found := c.look(at)
		p.newlySeen = append(p.newlySeen, seen...)
		p.placesChanged = p.placesChanged || found
		p.lookedFrom = at
	}
}

// sendChart tells a player on the sea what they have seen: all of it the first time, and then what is new.
func (w *World) sendChart(p *Player) {
	if p.C.Map != seaMap {
		return
	}
	c := p.C.chart()
	msg := &pb.Chart{Found: slices.Clone(c.Found), Landed: slices.Clone(c.Landed)}
	switch {
	case !p.chartTold:
		msg.Full, msg.Seen = true, slices.Clone(c.Seen)
	case len(p.newlySeen) > 0 || p.placesChanged:
		msg.Runs = runsOf(p.newlySeen)
	default:
		return
	}
	p.chartTold, p.newlySeen, p.placesChanged = true, nil, false
	w.send(p, &pb.ServerMessage{Msg: &pb.ServerMessage_Chart{Chart: msg}})
}

// runsOf writes tile indices as pairs of a first index and how many follow it.
func runsOf(tiles []int) (runs []uint32) {
	slices.Sort(tiles)
	for i := 0; i < len(tiles); {
		j := i + 1
		for j < len(tiles) && tiles[j] == tiles[j-1]+1 {
			j++
		}
		runs = append(runs, uint32(tiles[i]), uint32(j-i))
		i = j
	}
	return
}
