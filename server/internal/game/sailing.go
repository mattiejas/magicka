package game

import "math"

// Sail settings, from going astern to full sail.
const (
	sailBacking = iota
	sailStopped
	sailHalf
	sailFull
)

// sailSpeed is the speed each sail setting brings the boat to in the end, in tiles a tick. Walking is 2.
var sailSpeed = [...]float64{-0.8, 0, 1.6, 3}

// How a boat handles. Speeds are in tiles a tick, angles in degrees.
const (
	speedUp       = 0.35 // gained each tick at most: the boat gathers way slowly
	slowDown      = 0.45 // lost each tick at most: the boat carries way and does not stop dead
	stoppedBelow  = 0.05 // a boat this slow with nothing to drive it stops
	turnRadius    = 3.0  // tiles; the arc is the same at every speed
	maxTurn       = 40.0 // a tick
	markReached   = 1.5  // tiles from its course at which the helm lets go and holds straight on
	shoreReach    = 1.6  // tiles from land at which one can go ashore
	ashoreSpeed   = 0.6  // and no faster
	hardGrounding = 1.8  // hitting land faster than this runs the boat hard aground
	subSteps      = 6    // a tick's move is made in parts, so the boat cannot skip over a thin spit of land
	pushOff       = 30.0 // degrees a tick a boat against land under sail turns, pushing off the shore
)

// Vec is a point between tiles: tile x, y covers x to x+1.
type Vec struct{ X, Y float64 }

func (v Vec) tile() Point { return Point{X: int(math.Floor(v.X)), Y: int(math.Floor(v.Y))} }

func (v Vec) dist(o Vec) float64 { return math.Hypot(o.X-v.X, o.Y-v.Y) }

// Boat is a boat on the water.
type Boat struct {
	At       Vec
	Heading  float64 // degrees clockwise from north, -180 to 180
	Speed    float64 // below zero when going astern
	Sail     int
	Course   *Vec // what the helm steers for; nil holds straight on
	Touching bool // against land since it last moved
}

// sailed is what happened to a boat in one tick.
type sailed struct {
	trail   []Vec // where it was at the start and after each part of its move
	reached bool  // came to its course
	hit     bool  // came up against land
	nudged  bool  // and was not against it before
	hard    bool  // ran hard aground
	land    Point // the land it hit
}

// waterAt tells whether a boat can be on a tile.
type waterAt func(x, y int) bool

// setSail changes the sail setting, within the settings there are.
func (b *Boat) setSail(setting int) { b.Sail = max(sailBacking, min(sailFull, setting)) }

// steerFor sets a course, which the helm steers for until the boat reaches it.
func (b *Boat) steerFor(to Vec) { b.Course = &to }

// step sails a boat for one tick. turn is -1 or 1 while the player steers by hand, which lets go of the course.
func (b *Boat) step(turn int, water waterAt) sailed {
	out := sailed{trail: []Vec{b.At}}
	if turn != 0 {
		b.Course = nil
	}
	want := sailSpeed[b.Sail]
	b.Speed += max(-slowDown, min(speedUp, want-b.Speed))
	if math.Abs(b.Speed) < stoppedBelow && want == 0 {
		b.Speed = 0
	}
	rudder, wasTouching := b.turn(turn), b.Touching
	if wasTouching {
		// Against land the boat has no way to turn by, so it turns where it lies before it moves on.
		b.Heading, rudder = normalAngle(b.Heading+b.pushOffShore(turn)), 0
	}
	for i := 0; i < subSteps && b.Speed != 0; i++ {
		b.Heading = normalAngle(b.Heading + rudder/subSteps)
		next := b.At.ahead(b.Heading, b.Speed/subSteps)
		if land := next.tile(); !water(land.X, land.Y) {
			out.hit, out.land, out.hard, out.nudged = true, land, math.Abs(b.Speed) > hardGrounding, !wasTouching
			b.Speed, b.Touching = 0, true
			if b.Course != nil && !water(b.Course.tile().X, b.Course.tile().Y) {
				b.Course = nil // steered for land: the shore is as near as the boat comes
			}
			break
		}
		b.At, b.Touching = next, false
		out.trail = append(out.trail, b.At)
	}
	if b.Course != nil && b.At.dist(*b.Course) < markReached {
		b.Course, out.reached = nil, true
	}
	return out
}

// turn is how far the boat turns this tick. The rudder only bites while the boat moves, so a slow boat turns
// slowly, along an arc of the same size.
func (b *Boat) turn(hand int) float64 {
	rate := min(maxTurn, math.Abs(b.Speed)/turnRadius*180/math.Pi)
	if hand != 0 {
		return float64(hand) * rate
	}
	if b.Course == nil {
		return 0
	}
	off := normalAngle(bearing(b.At, *b.Course) - b.Heading)
	return max(-rate, min(rate, off))
}

// pushOffShore is how far a boat against land turns this tick: towards its course, or as the player steers by
// hand, while it is under sail.
func (b *Boat) pushOffShore(hand int) float64 {
	switch {
	case b.Sail <= sailStopped:
		return 0
	case hand != 0:
		return float64(hand) * pushOff
	case b.Course == nil:
		return 0
	}
	off := normalAngle(bearing(b.At, *b.Course) - b.Heading)
	return max(-pushOff, min(pushOff, off))
}

// ahead is where a boat would be over the next ticks if nothing changed, for drawing its arc.
func (b Boat) ahead(ticks, turn int, water waterAt) (out []Vec) {
	if b.Course != nil {
		course := *b.Course
		b.Course = &course // the copy must not move the real boat's course
	}
	for range ticks {
		s := b.step(turn, water)
		out = append(out, s.trail[1:]...)
		if b.Speed == 0 {
			break
		}
	}
	return
}

// shore is the nearest land within reach of going ashore, measured to the tile's nearest edge.
func (b *Boat) shore(water waterAt) (Point, bool) {
	best, found := Point{}, false
	nearest := shoreReach
	x0, y0 := int(math.Floor(b.At.X-shoreReach)), int(math.Floor(b.At.Y-shoreReach))
	for y := y0; y <= int(b.At.Y+shoreReach); y++ {
		for x := x0; x <= int(b.At.X+shoreReach); x++ {
			if water(x, y) {
				continue
			}
			dx := max(float64(x)-b.At.X, 0, b.At.X-float64(x)-1)
			dy := max(float64(y)-b.At.Y, 0, b.At.Y-float64(y)-1)
			if d := math.Hypot(dx, dy); d <= nearest {
				nearest, best, found = d, Point{X: x, Y: y}, true
			}
		}
	}
	return best, found
}

// slowEnoughForShore tells whether the boat is slow enough to step off.
func (b *Boat) slowEnoughForShore() bool { return math.Abs(b.Speed) <= ashoreSpeed }

func (v Vec) ahead(heading, distance float64) Vec {
	r := heading * math.Pi / 180
	return Vec{v.X + math.Sin(r)*distance, v.Y - math.Cos(r)*distance}
}

// bearing is the heading from one point to another.
func bearing(from, to Vec) float64 { return math.Atan2(to.X-from.X, -(to.Y-from.Y)) * 180 / math.Pi }

// normalAngle brings an angle to -180 to 180.
func normalAngle(d float64) float64 { return math.Mod(math.Mod(d, 360)+540, 360) - 180 }
