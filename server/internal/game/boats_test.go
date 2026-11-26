package game

import (
	"math"
	"testing"

	"driftwake/content"
	"driftwake/server/internal/pb"
)

func setSailMsg(setting uint32) *pb.ClientMessage {
	return &pb.ClientMessage{Msg: &pb.ClientMessage_SetSail{SetSail: setting}}
}

func steerMsg(x, y uint32) *pb.ClientMessage {
	return &pb.ClientMessage{Msg: &pb.ClientMessage_Steer{Steer: &pb.Tile{X: x, Y: y}}}
}

var (
	ashoreMsg = &pb.ClientMessage{Msg: &pb.ClientMessage_GoAshore{GoAshore: &pb.Empty{}}}
	boardMsg  = &pb.ClientMessage{Msg: &pb.ClientMessage_Board{Board: &pb.Empty{}}}
)

// sailor is a player whose boat is finished, aboard and stopped at a point of the sea.
func (e *env) sailor(n int64, at Vec) *Player {
	p := e.player(n)
	p.C.BoatDone = true
	p.boat = &Boat{At: at, Sail: sailStopped}
	e.w.keepAboard(p)
	return p
}

// offShore is a point on the water just off a piece of land, found by going from inside it one way until the sea.
func offShore(t *testing.T, from Point, dx int) Vec {
	for x := from.X; x >= 0 && x < sea().Size; x += dx {
		if sea().IsWater(x, from.Y) {
			return Vec{float64(x) + 0.5, float64(from.Y) + 0.5}
		}
	}
	t.Fatal("no shore from", from)
	return Vec{}
}

func lastVoyage(c *client) *pb.Voyage {
	for i := len(c.msgs) - 1; i >= 0; i-- {
		if v := c.msgs[i].GetVoyage(); v != nil {
			return v
		}
	}
	return nil
}

func TestBoatBuildsInStagesAndSails(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	e.atStation(p, "dock", "island")
	e.do(p, boatMsg(true), 1)
	eq(t, p.C.Map, "island")
	for _, b := range content.BoatParts {
		clear(p.C.Inv)
		p.give(b.Item, b.Qty)
		e.do(p, boatMsg(false), 1)
		eq(t, p.count(b.Item), 0)
	}
	check(t, p.C.BoatDone)
	e.do(p, boatMsg(true), 1)
	eq(t, p.C.Map, seaMap)
	check(t, p.aboard() && p.C.Afloat.Aboard, "aboard")
	moor, off := content.MapByID["island"].Mooring, Vec{float64(coastOf("island").X), float64(coastOf("island").Y)}
	eq(t, p.boat.At, Vec{moor.X + off.X, moor.Y + off.Y}, "at the island's mooring")
	check(t, e.c[1].msgs[len(e.c[1].msgs)-1].GetSnapshot().GetReset_() || e.c[1].ents != nil)
}

// coastOf is the place of a map in the sea, where its corner lies.
func coastOf(id string) *content.Place { return sea().PlaceByID(id) }

func TestSailingMovesThePlayerWithTheBoat(t *testing.T) {
	e := setup(t)
	p := e.sailor(1, Vec{120.5, 130.5}) // open water between the island and the mainland
	e.do(p, setSailMsg(sailFull), 0)
	e.do(p, steerMsg(60, 130), 10)
	check(t, p.boat.At.X < 110, "sailed west", p.boat.At)
	at := p.boat.At.tile()
	eq(t, Point{X: p.C.X, Y: p.C.Y}, at, "the player is where the boat is")
	v := lastVoyage(e.c[1])
	check(t, v.GetAboard() && v.GetSpeed() > 2 && v.GetHasCourse() && len(v.GetAhead()) == 2*aheadTicks*subSteps, v)
	g := e.c[1].ents[p.ID].GetBoat()
	check(t, g.GetAboard() && len(g.GetTrail()) == 2*(subSteps+1), "others see the boat sail", g)
}

func TestNothingElseCanBeDoneAboard(t *testing.T) {
	e := setup(t)
	p := e.sailor(1, Vec{120.5, 130.5})
	e.do(p, move(120, 140), 2)
	e.do(p, gatherMsg(e.w.nodes[0].ID), 2)
	eq(t, p.act.typ, actNone)
	eq(t, p.boat.At, Vec{120.5, 130.5})
	e.do(p, chatMsg("ahoy"), 1)
}

func TestGoingAshoreRefusesOpenWater(t *testing.T) {
	e := setup(t)
	p := e.sailor(1, Vec{120.5, 130.5})
	e.do(p, ashoreMsg, 1)
	check(t, p.aboard(), "went ashore on open water")
}

func TestGoingAshoreRefusesAFastBoat(t *testing.T) {
	e := setup(t)
	p := e.sailor(1, offShore(t, Point{X: 42, Y: 176}, -1))
	p.boat.Sail, p.boat.Speed, p.boat.Heading = sailHalf, 1.6, 180 // along the shore
	e.do(p, ashoreMsg, 1)
	check(t, p.aboard(), "went ashore at speed")
}

func TestGoingAshoreOnASmallIslandLeavesTheBoatMoored(t *testing.T) {
	e := setup(t)
	at := offShore(t, Point{X: 42, Y: 176}, -1) // the west shore of Pine Holm
	p := e.sailor(1, at)
	e.do(p, ashoreMsg, 1)
	check(t, !p.aboard(), "still aboard")
	eq(t, p.C.Map, seaMap)
	check(t, sea().CanStandOn(p.C.X, p.C.Y) && sea().PlaceAt(p.C.X, p.C.Y).ID == "pine_holm", "stands on Pine Holm", p.C.X, p.C.Y)
	eq(t, *p.C.Afloat, Afloat{Map: seaMap, X: at.X, Y: at.Y})
	other := e.player(2)
	e.at(other, p.C.X, p.C.Y, seaMap)
	e.run(1)
	g := e.c[2].ents[p.ID].GetBoat()
	check(t, g != nil && !g.Away && !g.Aboard && g.X == float32(at.X), "others see the moored boat", g)
	check(t, !lastVoyage(e.c[1]).GetAboard(), "told it left the boat")
}

func TestGoingAshoreOnTheMainlandLeadsOntoIt(t *testing.T) {
	e := setup(t)
	land, moor := content.MapByID["mainland"], content.MapByID["mainland"].Mooring
	off := coastOf("mainland")
	p := e.sailor(1, Vec{moor.X + float64(off.X), moor.Y + float64(off.Y)})
	e.do(p, ashoreMsg, 1)
	eq(t, p.C.Map, "mainland")
	check(t, land.CanStandOn(p.C.X, p.C.Y), "stands on the mainland")
	eq(t, *p.C.Afloat, Afloat{Map: "mainland", X: moor.X, Y: moor.Y})
	check(t, math.Hypot(float64(p.C.X)-moor.X, float64(p.C.Y)-moor.Y) <= stepAshore, "beside the boat")
}

func TestAMooredBoatIsBoardedWhereItLies(t *testing.T) {
	e := setup(t)
	at := offShore(t, Point{X: 42, Y: 176}, -1)
	p := e.sailor(1, at)
	e.do(p, ashoreMsg, 1)
	e.do(p, move(42, 176), 6) // inland
	e.do(p, boardMsg, 8)
	check(t, p.aboard(), "boarded")
	eq(t, p.boat.At, at)
	eq(t, p.boat.Speed, 0.0)
}

func TestTheDockBringsTheBoatRound(t *testing.T) {
	e := setup(t)
	p := e.sailor(1, Vec{120.5, 130.5})
	p.C.Afloat.Aboard, p.boat = false, nil // moored out at sea
	e.atStation(p, "dock", "mainland")
	e.do(p, boatMsg(true), 1)
	check(t, p.aboard(), "boarded")
	moor, off := content.MapByID["mainland"].Mooring, coastOf("mainland")
	eq(t, p.boat.At, Vec{moor.X + float64(off.X), moor.Y + float64(off.Y)})
}

// Characters from before sailing have no boat afloat: theirs lies at the dock of whichever map they are on.
func TestABoatThatNeverLeftLiesAtTheDock(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	p.C.BoatDone = true
	e.atStation(p, "dock", "mainland")
	check(t, p.C.Afloat == nil)
	e.do(p, boatMsg(true), 1)
	check(t, p.aboard() && p.C.Map == seaMap, "set sail from the mainland")
}

func TestASailorLogsBackInAboardAndStopped(t *testing.T) {
	e := setup(t)
	p := e.sailor(1, Vec{120.5, 130.5})
	e.do(p, setSailMsg(sailFull), 4)
	at, heading := p.boat.At, p.boat.Heading
	e.w.save(p)
	c := e.savedChar(1)
	c.fill()
	b := c.boatAboard()
	check(t, b != nil, "not aboard after loading")
	eq(t, b.At, at)
	eq(t, b.Heading, heading)
	eq(t, b.Speed, 0.0)
	eq(t, Point{X: c.X, Y: c.Y}, at.tile(), "moved off the water")
}

func TestTheShipsHandsTellWhereTheBoatRanAground(t *testing.T) {
	e := setup(t)
	p := e.sailor(1, offShore(t, Point{X: 42, Y: 176}, -1))
	p.boat.Heading, p.boat.Speed, p.boat.Sail = 90, sailSpeed[sailFull], sailFull // straight at Pine Holm
	e.run(1)
	found := false
	for _, m := range e.c[1].msgs {
		found = found || m.GetInfo().GetText() == "Crunch! You run hard aground on Pine Holm. Back the sail to get free."
	}
	check(t, found, "no word of running aground")
}
