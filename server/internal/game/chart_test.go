package game

import (
	"slices"
	"testing"

	"driftwake/server/internal/pb"
)

func seenAt(c *Chart, x, y int) bool { return c.has(y*sea().Size + x) }

func lastChart(c *client) *pb.Chart {
	for i := len(c.msgs) - 1; i >= 0; i-- {
		if m := c.msgs[i].GetChart(); m != nil {
			return m
		}
	}
	return nil
}

func TestTheLookoutSeesTenTiles(t *testing.T) {
	e := setup(t)
	p := e.sailor(1, Vec{120.5, 130.5})
	e.run(1)
	c := p.C.Chart
	check(t, seenAt(c, 120, 130) && seenAt(c, 130, 130) && seenAt(c, 120, 120), "within ten tiles")
	check(t, !seenAt(c, 131, 130) && !seenAt(c, 128, 138), "beyond ten tiles")
}

func TestTheLookoutSeesFromWhereverTheBoatWent(t *testing.T) {
	e := setup(t)
	p := e.sailor(1, Vec{120.5, 130.5})
	p.boat.Heading, p.boat.Speed, p.boat.Sail = 90, sailSpeed[sailFull], sailFull
	e.run(10)
	check(t, seenAt(p.C.Chart, 125, 121), "passed by")
	check(t, seenAt(p.C.Chart, p.C.X+lookout, p.C.Y), "ahead")
}

func TestSightingAPlacePutsItsOutlineOnTheChart(t *testing.T) {
	e := setup(t)
	p := e.sailor(1, offShore(t, Point{X: 42, Y: 176}, -1))
	e.run(1)
	check(t, slices.Contains(p.C.Chart.Found, "pine_holm"), "Pine Holm not sighted", p.C.Chart.Found)
	check(t, !slices.Contains(p.C.Chart.Landed, "pine_holm"), "landed without going ashore")
}

func TestGoingAshoreSeesThePlaceWhole(t *testing.T) {
	e := setup(t)
	p := e.sailor(1, offShore(t, Point{X: 42, Y: 176}, -1))
	e.do(p, ashoreMsg, 1)
	check(t, slices.Contains(p.C.Chart.Landed, "pine_holm"), "not landed", p.C.Chart.Landed)
	eq(t, lastChart(e.c[1]).GetLanded(), []string{"pine_holm"})
}

func TestTheChartIsSentWholeThenAsWhatIsNew(t *testing.T) {
	e := setup(t)
	p := e.sailor(1, Vec{120.5, 130.5})
	e.run(1)
	first := lastChart(e.c[1])
	check(t, first.GetFull() && len(first.GetSeen()) == len(p.C.Chart.Seen), "the first chart is whole")
	p.boat.Heading, p.boat.Speed, p.boat.Sail = 90, sailSpeed[sailFull], sailFull
	e.run(1)
	next := lastChart(e.c[1])
	check(t, !next.GetFull() && len(next.GetRuns()) > 0, "then runs", next)
	runs := next.GetRuns()
	for i := 0; i < len(runs); i += 2 {
		for j := range runs[i+1] {
			check(t, p.C.Chart.has(int(runs[i]+j)), "told of a tile not seen")
		}
	}
	n := len(e.c[1].msgs)
	p.boat.Sail, p.boat.Speed = sailStopped, 0
	e.run(2)
	for _, m := range e.c[1].msgs[n+1:] {
		check(t, m.GetChart() == nil, "a chart with nothing new")
	}
}

func TestTheChartIsSavedWithTheCharacter(t *testing.T) {
	e := setup(t)
	p := e.sailor(1, offShore(t, Point{X: 42, Y: 176}, -1))
	e.run(1)
	e.w.save(p)
	c := e.savedChar(1)
	eq(t, c.Chart.Seen, p.C.Chart.Seen)
	eq(t, c.Chart.Found, p.C.Chart.Found)
}

func TestOnlyTheSeaIsCharted(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	e.run(3)
	check(t, p.C.Chart == nil && lastChart(e.c[1]) == nil, "charted the island on foot")
}

func TestRunsOfTiles(t *testing.T) {
	eq(t, runsOf([]int{7, 3, 4, 5, 9, 10}), []uint32{3, 3, 7, 1, 9, 2})
	eq(t, runsOf(nil), []uint32(nil))
}
