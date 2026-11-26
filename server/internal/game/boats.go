package game

import (
	"math"

	"driftwake/content"
	"driftwake/server/internal/pb"
)

const seaMap = "sea"

// Afloat is where a character's boat is once it has left the dock, on a map's own tiles, and whether its owner is
// aboard. Without it, the boat lies at the dock of whichever map its owner is on.
type Afloat struct {
	Map     string  `json:"map"`
	X       float64 `json:"x"`
	Y       float64 `json:"y"`
	Heading float64 `json:"heading"`
	Aboard  bool    `json:"aboard,omitempty"`
}

const (
	aheadTicks = 4 // of the boat's arc that the player is shown
	// Tiles from the boat at which there must be ground to stand on, to go ashore. Further than the reach of going
	// ashore, since a shore of sand can lie before the first tile that can be walked to.
	stepAshore = 4
	boardReach = 2 // tiles from a moored boat at which it can be boarded
)

func sea() *content.Map { return content.MapByID[seaMap] }

func (p *Player) aboard() bool { return p.boat != nil }

// seaOffset is where a map's corner lies in the sea. ok is false for a map that is not on it.
func seaOffset(mapID string) (off Vec, ok bool) {
	if mapID == seaMap {
		return Vec{}, true
	}
	if place := sea().PlaceByID(mapID); place != nil && place.Map == mapID {
		return Vec{float64(place.X), float64(place.Y)}, true
	}
	return Vec{}, false
}

// boatAboard is the boat of a character saved while sailing, which comes back stopped.
func (c *Char) boatAboard() *Boat {
	if a := c.Afloat; a != nil && a.Aboard && a.Map == seaMap {
		return &Boat{At: Vec{a.X, a.Y}, Heading: a.Heading, Sail: sailStopped}
	}
	return nil
}

// allowedAboard is what a player can do while sailing. Everything else waits until they are ashore.
func allowedAboard(msg *pb.ClientMessage) bool {
	switch msg.Msg.(type) {
	case *pb.ClientMessage_SetSail, *pb.ClientMessage_Steer, *pb.ClientMessage_Helm, *pb.ClientMessage_GoAshore,
		*pb.ClientMessage_Chat, *pb.ClientMessage_Look, *pb.ClientMessage_Block, *pb.ClientMessage_FightBack,
		*pb.ClientMessage_Swap, *pb.ClientMessage_EquipSlot, *pb.ClientMessage_Unequip, *pb.ClientMessage_EatSlot:
		return true
	}
	return false
}

// handleHelm carries out what a player aboard asked of their boat.
func (w *World) handleHelm(p *Player, msg *pb.ClientMessage) {
	switch m := msg.Msg.(type) {
	case *pb.ClientMessage_SetSail:
		p.boat.setSail(int(m.SetSail))
	case *pb.ClientMessage_Steer:
		p.boat.steerFor(Vec{float64(m.Steer.GetX()) + 0.5, float64(m.Steer.GetY()) + 0.5})
		p.helm = 0
	case *pb.ClientMessage_Helm:
		p.helm = int(m.Helm)
	case *pb.ClientMessage_GoAshore:
		w.goAshore(p)
	}
}

// sail moves a player's boat for one tick.
func (w *World) sail(p *Player) {
	s := p.boat.step(p.helm, sea().IsWater)
	p.trail = s.trail
	w.keepAboard(p)
	switch {
	case s.hard:
		w.info(p, "Crunch! You run hard aground on "+w.landName(s.land)+". Steer for open water, or back the sail, to get free.", pb.InfoKind_INFO_KIND_BAD)
	case s.nudged:
		w.tell(p, "You nudge the shore of "+w.landName(s.land)+".")
	case s.reached:
		w.tell(p, "You reach your mark. The helm holds straight on.")
	}
}

// keepAboard puts the character where their boat is.
func (w *World) keepAboard(p *Player) {
	b := p.boat
	at := b.At.tile()
	p.C.Map, p.C.X, p.C.Y = seaMap, at.X, at.Y
	p.C.Afloat = &Afloat{Map: seaMap, X: b.At.X, Y: b.At.Y, Heading: b.Heading, Aboard: true}
}

func (w *World) landName(at Point) string {
	if place := sea().PlaceAt(at.X, at.Y); place != nil {
		return place.Name
	}
	return "the edge of the world"
}

// goAshore steps off a slow boat onto the land beside it. The boat stays moored where it is.
func (w *World) goAshore(p *Player) {
	b := p.boat
	land, near := b.shore(sea().IsWater)
	place := sea().PlaceAt(land.X, land.Y)
	switch {
	case !near || place == nil:
		w.tell(p, "There is no shore close enough.")
		return
	case !b.slowEnoughForShore():
		w.tell(p, "You are going too fast to step ashore. Stop first.")
		return
	}
	mapID := seaMap
	if place.Map != "" {
		mapID = place.Map
	}
	off, _ := seaOffset(mapID)
	moored := Vec{b.At.X - off.X, b.At.Y - off.Y}
	m := content.MapByID[mapID]
	at, ok := standingNear(m, moored)
	if !ok {
		w.tell(p, "The shore is too steep to climb here.")
		return
	}
	p.C.Afloat = &Afloat{Map: mapID, X: moored.X, Y: moored.Y, Heading: b.Heading}
	p.C.chart().land(place.ID)
	p.placesChanged = true
	w.arrive(p, mapID, at.X, at.Y)
	w.tell(p, "You go ashore on "+place.Name+".")
	w.save(p)
}

// standingNear is the tile nearest a point on which someone can stand, within a few tiles.
func standingNear(m *content.Map, at Vec) (Point, bool) {
	best, nearest := Point{}, math.Inf(1)
	from := at.tile()
	for y := from.Y - stepAshore; y <= from.Y+stepAshore; y++ {
		for x := from.X - stepAshore; x <= from.X+stepAshore; x++ {
			d := at.dist(Vec{float64(x) + 0.5, float64(y) + 0.5})
			if d < nearest && d <= stepAshore && m.CanStandOn(x, y) {
				best, nearest = Point{X: x, Y: y}, d
			}
		}
	}
	return best, !math.IsInf(nearest, 1)
}

// mooredHere is where a player's boat lies on the map they are on, if it does.
func (w *World) mooredHere(p *Player) (Vec, bool) {
	if a := p.C.Afloat; a != nil && !a.Aboard && a.Map == p.C.Map {
		return Vec{a.X, a.Y}, true
	}
	return Vec{}, false
}

// board puts a player aboard their boat where it is moored, on the sea.
func (w *World) board(p *Player) {
	a := p.C.Afloat
	off, ok := seaOffset(a.Map)
	if !ok {
		return
	}
	p.boat, p.helm = &Boat{At: Vec{a.X + off.X, a.Y + off.Y}, Heading: a.Heading, Sail: sailStopped}, 0
	w.keepAboard(p)
	w.stop(p)
	p.via = nil
	w.tell(p, "You board your boat. Set a sail, then click where to steer.")
	w.save(p)
}

// boardAtDock brings the boat to the dock's mooring and boards it.
func (w *World) boardAtDock(p *Player) {
	m := w.mapOf(p)
	if m.Mooring == nil {
		return
	}
	if _, here := w.mooredHere(p); p.C.Afloat != nil && !here {
		w.tell(p, "The dock hands bring your boat round.")
	}
	p.C.Afloat = &Afloat{Map: m.ID, X: m.Mooring.X, Y: m.Mooring.Y, Heading: m.Mooring.Heading}
	w.board(p)
}

// leaveBoat takes a player out of their boat without going ashore, as when they are moved to another map.
func (p *Player) leaveBoat() {
	if p.boat != nil && p.C.Afloat != nil {
		p.C.Afloat.Aboard = false
	}
	p.boat, p.helm, p.trail = nil, 0, nil
}

// boatFields is a player's boat as others see it: on the player's map, or not shown.
type boatFields struct {
	shown         bool
	x, y, heading float32
	sail          int
	aboard        bool
}

func (w *World) boatOf(p *Player) boatFields {
	if b := p.boat; b != nil {
		return boatFields{true, float32(b.At.X), float32(b.At.Y), float32(b.Heading), b.Sail, true}
	}
	if at, ok := w.mooredHere(p); ok {
		return boatFields{true, float32(at.X), float32(at.Y), float32(p.C.Afloat.Heading), sailStopped, false}
	}
	return boatFields{}
}

func (b boatFields) pb() *pb.BoatView {
	if !b.shown {
		return &pb.BoatView{Away: true}
	}
	return &pb.BoatView{X: b.x, Y: b.y, Heading: b.heading, Sail: uint32(b.sail), Aboard: b.aboard}
}

func flatVecs(points []Vec) []float32 {
	out := make([]float32, 0, 2*len(points))
	for _, v := range points {
		out = append(out, float32(v.X), float32(v.Y))
	}
	return out
}

// sendVoyage tells a player aboard about their boat, and once more when they leave it.
func (w *World) sendVoyage(p *Player) {
	b := p.boat
	if b == nil {
		if p.toldAboard {
			p.toldAboard = false
			w.send(p, &pb.ServerMessage{Msg: &pb.ServerMessage_Voyage{Voyage: &pb.Voyage{}}})
		}
		return
	}
	p.toldAboard = true
	_, near := b.shore(sea().IsWater)
	v := &pb.Voyage{
		Aboard:     true,
		Speed:      float32(b.Speed),
		Ahead:      flatVecs(b.ahead(aheadTicks, p.helm, sea().IsWater)),
		ShoreNear:  near,
		SlowEnough: b.slowEnoughForShore(),
	}
	if c := b.Course; c != nil {
		v.HasCourse, v.CourseX, v.CourseY = true, float32(c.X), float32(c.Y)
	}
	w.send(p, &pb.ServerMessage{Msg: &pb.ServerMessage_Voyage{Voyage: v}})
}
