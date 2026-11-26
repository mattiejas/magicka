package game

import (
	"math"
	"testing"
)

// openSea is water everywhere.
func openSea(x, y int) bool { return true }

// landFrom is water up to a row of land at y, and below it.
func landFrom(row int) waterAt { return func(x, y int) bool { return y > row } }

// sailFor sails a boat for some ticks and gives the distance it went.
func sailFor(b *Boat, ticks, turn int, water waterAt) (went float64) {
	for range ticks {
		s := b.step(turn, water)
		for i := 1; i < len(s.trail); i++ {
			went += s.trail[i-1].dist(s.trail[i])
		}
	}
	return
}

func within(a, b, by float64) bool { return math.Abs(a-b) <= by }

func TestSpeedEasesTowardsTheSailSetting(t *testing.T) {
	b := &Boat{Sail: sailFull}
	b.step(0, openSea)
	if !within(b.Speed, speedUp, 1e-9) {
		t.Fatalf("speed after one tick of full sail = %v, want %v", b.Speed, speedUp)
	}
	sailFor(b, 20, 0, openSea)
	if b.Speed != sailSpeed[sailFull] {
		t.Fatalf("speed at full sail = %v, want %v", b.Speed, sailSpeed[sailFull])
	}
	b.setSail(sailHalf)
	b.step(0, openSea)
	if !within(b.Speed, sailSpeed[sailFull]-slowDown, 1e-9) {
		t.Fatalf("speed a tick after taking in sail = %v, want %v", b.Speed, sailSpeed[sailFull]-slowDown)
	}
}

func TestSailSettingsReachTheirSpeeds(t *testing.T) {
	for setting, want := range sailSpeed {
		b := &Boat{}
		b.setSail(setting)
		sailFor(b, 30, 0, openSea)
		if !within(b.Speed, want, 1e-9) {
			t.Errorf("setting %d: speed %v, want %v", setting, b.Speed, want)
		}
	}
}

func TestSailSettingStaysWithinTheSettings(t *testing.T) {
	b := &Boat{}
	b.setSail(9)
	if b.Sail != sailFull {
		t.Errorf("sail = %d, want full", b.Sail)
	}
	b.setSail(-3)
	if b.Sail != sailBacking {
		t.Errorf("sail = %d, want backing", b.Sail)
	}
}

func TestBoatCarriesWayAfterStopping(t *testing.T) {
	b := &Boat{Sail: sailFull, Speed: sailSpeed[sailFull]}
	b.setSail(sailStopped)
	went := sailFor(b, 30, 0, openSea)
	if b.Speed != 0 {
		t.Fatalf("still moving at %v", b.Speed)
	}
	if went < 8 || went > 10 {
		t.Errorf("carried %.1f tiles from full sail, want about 9", went)
	}
}

func TestBackingGoesAstern(t *testing.T) {
	b := &Boat{At: Vec{10, 10}, Sail: sailBacking}
	sailFor(b, 10, 0, openSea)
	if b.Speed >= 0 || b.At.Y <= 10 {
		t.Errorf("heading north and backing, the boat is at %v going %v; want it to go south", b.At, b.Speed)
	}
}

func TestNoTurningWhenStopped(t *testing.T) {
	b := &Boat{At: Vec{10, 10}, Heading: 30, Sail: sailStopped}
	b.step(1, openSea)
	b.steerFor(Vec{0, 10})
	b.step(0, openSea)
	if b.Heading != 30 {
		t.Errorf("a stopped boat turned to %v", b.Heading)
	}
}

func TestTurningFollowsAnArcOfTheTurningRadius(t *testing.T) {
	b := &Boat{At: Vec{50, 50}, Sail: sailHalf, Speed: sailSpeed[sailHalf]}
	start := b.Heading
	b.step(1, openSea)
	rate := sailSpeed[sailHalf] / turnRadius * 180 / math.Pi
	if !within(b.Heading-start, rate, 1e-6) {
		t.Fatalf("turned %v° in a tick at half sail, want %v°", b.Heading-start, rate)
	}
	// A whole circle: every point of it is the turning radius from the middle.
	var points []Vec
	for range 12 {
		points = append(points, b.step(1, openSea).trail[1:]...)
	}
	var mid Vec
	for _, p := range points {
		mid.X += p.X / float64(len(points))
		mid.Y += p.Y / float64(len(points))
	}
	for _, p := range points {
		if r := p.dist(mid); !within(r, turnRadius, 0.25) {
			t.Fatalf("a point of the circle is %.2f tiles from its middle, want %v", r, turnRadius)
		}
	}
}

func TestTurningIsAtMostFortyDegreesATick(t *testing.T) {
	b := &Boat{At: Vec{50, 50}, Sail: sailFull, Speed: sailSpeed[sailFull]}
	b.step(1, openSea)
	if !within(b.Heading, maxTurn, 1e-6) {
		t.Errorf("turned %v° at full sail, want at most %v°", b.Heading, maxTurn)
	}
}

func TestHelmSteersForTheCourse(t *testing.T) {
	b := &Boat{At: Vec{20, 20}, Sail: sailHalf}
	b.steerFor(Vec{40, 20})
	reached := false
	for range 30 {
		if b.step(0, openSea).reached {
			reached = true
			break
		}
	}
	if !reached || b.Course != nil {
		t.Fatalf("did not reach the course: at %v", b.At)
	}
	if b.At.dist(Vec{40, 20}) >= markReached {
		t.Errorf("let go of the course %.1f tiles from it", b.At.dist(Vec{40, 20}))
	}
	if !within(b.Heading, 90, 15) {
		t.Errorf("heading %v at the mark, want about east", b.Heading)
	}
}

func TestSteeringByHandLetsGoOfTheCourse(t *testing.T) {
	b := &Boat{At: Vec{20, 20}, Sail: sailHalf, Speed: 1}
	b.steerFor(Vec{40, 20})
	b.step(-1, openSea)
	if b.Course != nil {
		t.Error("the course is kept while steering by hand")
	}
	if b.Heading >= 0 {
		t.Errorf("steering to port turned the boat to %v", b.Heading)
	}
}

func TestLandStopsTheBoat(t *testing.T) {
	b := &Boat{At: Vec{5.5, 20}, Sail: sailHalf, Speed: 1.2}
	b.steerFor(Vec{5.5, 0})
	var hit sailed
	for range 20 {
		if s := b.step(0, landFrom(10)); s.hit {
			hit = s
			break
		}
	}
	if !hit.nudged || hit.hard {
		t.Fatalf("slowly into land: nudged %v, hard %v", hit.nudged, hit.hard)
	}
	if b.Speed != 0 || b.Course != nil || !b.Touching {
		t.Errorf("after hitting land: speed %v, course %v, touching %v", b.Speed, b.Course, b.Touching)
	}
	if b.At.Y <= 11 {
		t.Errorf("the boat is on land at %v", b.At)
	}
	if hit.land.Y != 10 {
		t.Errorf("hit land at %v, want row 10", hit.land)
	}
	if s := b.step(0, landFrom(10)); !s.hit || s.nudged {
		t.Error("pressing on against the shore: want it to hit, without a new nudge")
	}
}

func TestFastIntoLandIsAHardGrounding(t *testing.T) {
	b := &Boat{At: Vec{5.5, 30}, Sail: sailFull, Speed: sailSpeed[sailFull]}
	for range 20 {
		if s := b.step(0, landFrom(10)); s.hit {
			if !s.hard {
				t.Error("full sail into land is not a hard grounding")
			}
			return
		}
	}
	t.Fatal("never hit land")
}

func TestBackingGetsOffLand(t *testing.T) {
	b := &Boat{At: Vec{5.5, 11.2}, Touching: true, Sail: sailStopped}
	b.setSail(sailBacking)
	sailFor(b, 5, 0, landFrom(10))
	if b.Touching || b.At.Y <= 11.2 {
		t.Errorf("backing did not get off: at %v, touching %v", b.At, b.Touching)
	}
}

func TestBoatCannotSkipOverAThinSpit(t *testing.T) {
	spit := func(x, y int) bool { return y != 10 }
	b := &Boat{At: Vec{5.5, 20}, Sail: sailFull, Speed: sailSpeed[sailFull]}
	sailFor(b, 20, 0, spit)
	if b.At.Y < 10 {
		t.Errorf("sailed across a spit one tile wide, to %v", b.At)
	}
}

func TestTrailHoldsEachPartOfTheMove(t *testing.T) {
	b := &Boat{At: Vec{10, 10}, Sail: sailFull, Speed: sailSpeed[sailFull]}
	s := b.step(0, openSea)
	if len(s.trail) != subSteps+1 || s.trail[0] != (Vec{10, 10}) || s.trail[subSteps] != b.At {
		t.Errorf("trail %v", s.trail)
	}
}

func TestGoingAshoreNeedsLandWithinReach(t *testing.T) {
	water := landFrom(10)
	b := &Boat{At: Vec{5.5, 12.5}}
	if at, ok := b.shore(water); !ok || at.Y != 10 {
		t.Errorf("1.5 tiles from land: shore %v %v", at, ok)
	}
	b.At.Y = 13
	if _, ok := b.shore(water); ok {
		t.Error("2 tiles from land is within reach of going ashore")
	}
}

func TestGoingAshoreNeedsTheBoatSlow(t *testing.T) {
	b := &Boat{Speed: ashoreSpeed}
	if !b.slowEnoughForShore() {
		t.Error("too fast at the limit")
	}
	b.Speed = -ashoreSpeed - 0.1
	if b.slowEnoughForShore() {
		t.Error("slow enough while backing fast")
	}
}

func TestAheadDoesNotMoveTheBoat(t *testing.T) {
	b := &Boat{At: Vec{10, 10}, Sail: sailFull, Speed: 2}
	b.steerFor(Vec{30, 10})
	before, course := *b, *b.Course
	arc := b.ahead(4, 0, openSea)
	if len(arc) != 4*subSteps || b.At != before.At || b.Speed != before.Speed || *b.Course != course {
		t.Errorf("ahead moved the boat or gave %d points", len(arc))
	}
}

func TestABoatAgainstLandTurnsOffItForItsCourse(t *testing.T) {
	b := &Boat{At: Vec{5.5, 20}, Sail: sailFull, Speed: sailSpeed[sailFull]}
	b.steerFor(Vec{5.5, 0}) // on land: the boat runs into the shore and stops there
	sailFor(b, 10, 0, landFrom(10))
	if !b.Touching || b.Course != nil {
		t.Fatalf("steered for land: touching %v, course %v", b.Touching, b.Course)
	}
	b.steerFor(Vec{5.5, 30})
	sailFor(b, 15, 0, landFrom(10))
	if b.Touching || b.At.Y < 15 {
		t.Errorf("did not turn off the shore for open water: at %v, heading %v", b.At, b.Heading)
	}
}

func TestACourseOnTheWaterOutlastsHittingLand(t *testing.T) {
	b := &Boat{At: Vec{5.5, 20}, Sail: sailHalf, Speed: 1.2}
	b.steerFor(Vec{20, 5}) // across the water, beyond land that lies in the way
	water := func(x, y int) bool { return y > 10 || x > 15 }
	for range 20 {
		if b.step(0, water).hit {
			break
		}
	}
	if b.Course == nil {
		t.Error("hitting land let go of a course on the water")
	}
}

func TestAStoppedBoatAgainstLandDoesNotTurn(t *testing.T) {
	b := &Boat{At: Vec{5.5, 11.2}, Touching: true, Sail: sailStopped}
	b.steerFor(Vec{5.5, 30})
	b.step(0, landFrom(10))
	if b.Heading != 0 {
		t.Errorf("turned without sail to %v", b.Heading)
	}
}
