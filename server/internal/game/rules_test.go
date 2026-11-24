package game

import (
	"encoding/json"
	"math"
	"testing"

	"driftwake/content"
	"driftwake/server/internal/pb"

	"google.golang.org/protobuf/proto"
)

func TestSharedVectors(t *testing.T) {
	var v map[string][]json.RawMessage
	if err := json.Unmarshal(content.Raw("vectors.json"), &v); err != nil {
		t.Fatal(err)
	}
	nums := func(r json.RawMessage) (out []float64) {
		if err := json.Unmarshal(r, &out); err != nil {
			t.Fatal(err)
		}
		return
	}
	each := func(name string, f func(a []float64) float64) {
		check(t, len(v[name]) > 0, name)
		for _, r := range v[name] {
			a := nums(r)
			if got, want := f(a), a[len(a)-1]; math.Abs(got-want) > 1e-12 {
				t.Errorf("%s%v = %v", name, a, got)
			}
		}
	}
	each("xpForLevel", func(a []float64) float64 { return float64(XPForLevel(int(a[0]))) })
	each("levelForXp", func(a []float64) float64 { return float64(LevelForXP(int(a[0]))) })
	each("maxHp", func(a []float64) float64 { return float64(MaxHP(int(a[0]))) })
	each("ticks", func(a []float64) float64 { return float64(Ticks(a[0])) })
	each("hitChance", func(a []float64) float64 { return HitChance(int(a[0]), a[1], a[2], a[3], a[4]) })
	each("maxHit", func(a []float64) float64 { return float64(MaxHit(int(a[0]), a[1])) })
	each("bossMaxHp", func(a []float64) float64 { return BossMaxHP(a[0], int(a[1])) })
	each("gatherChance", func(a []float64) float64 { return GatherChance(int(a[0]), int(a[1]), int(a[2])) })
	each("sellPrice", func(a []float64) float64 { return float64(SellPrice(int(a[0]), int(a[1]), int(a[2]))) })
	each("deathFee", func(a []float64) float64 { return float64(DeathFee(int(a[0]), int(a[1]), int(a[2]))) })
	for _, r := range v["styleModifier"] {
		var a, d *string
		var m float64
		raw := []any{&a, &d, &m}
		check(t, json.Unmarshal(r, &raw) == nil)
		def := ""
		if d != nil {
			def = *d
		}
		eq(t, StyleModifier(*a, def), m)
	}
	rnd := Mulberry(5)
	for _, r := range v["mulberry"] {
		var want float64
		json.Unmarshal(r, &want)
		eq(t, rnd(), want, "mulberry")
	}
	for _, r := range v["defaultLook"] {
		var name string
		var l Look
		raw := []any{&name, &l.Cut, &l.Color}
		check(t, json.Unmarshal(r, &raw) == nil)
		eq(t, (&Player{Name: name, C: &Char{}}).look(), l, name)
	}
}

func TestLevelsRoundTrip(t *testing.T) {
	for n := 1; n <= MaxLevel; n++ {
		eq(t, LevelForXP(XPForLevel(n)), n)
		if n > 1 {
			eq(t, LevelForXP(XPForLevel(n)-1), n-1)
		}
	}
}

func TestEverythingIsReachable(t *testing.T) {
	var f pathfinder
	for _, m := range content.Maps {
		check(t, m.Walkable(m.Spawn.X, m.Spawn.Y) && m.Walkable(m.Landing.X, m.Landing.Y), m.ID)
		for _, l := range [][]content.Placed{m.Nodes, m.Stations, m.Spawns} {
			for _, o := range l {
				p := f.find(m, m.Spawn.X, m.Spawn.Y, tile(o.X, o.Y), 1)
				e := Point{X: m.Spawn.X, Y: m.Spawn.Y}
				if len(p) > 0 {
					e = p[len(p)-1]
				}
				check(t, inReach(e.X, e.Y, tile(o.X, o.Y), 1), m.ID, o)
			}
		}
	}
}

func TestPathDoesNotCutCorners(t *testing.T) {
	m := &content.Map{Size: 3, Blocked: []bool{false, true, false, false, false, false, false, false, false}}
	var f pathfinder
	eq(t, f.find(m, 0, 0, tile(2, 0), 0), []Point{{X: 0, Y: 1}, {X: 1, Y: 1}, {X: 2, Y: 1}, {X: 2, Y: 0}})
}

func TestDecodeRefusesMalformed(t *testing.T) {
	bad := []*pb.ClientMessage{
		{}, move(256, 0), craftMsg("x", 0), craftMsg("x", 1000), equipMsg(24),
		bankMsg(false, "a", 0), bankMsg(true, "a", 1_000_001), chatMsg("   "),
		{Msg: &pb.ClientMessage_Unequip{Unequip: 0}},
		{Msg: &pb.ClientMessage_Unequip{Unequip: 8}},
		{Msg: &pb.ClientMessage_ResumeToken{ResumeToken: "x"}},
		{Msg: &pb.ClientMessage_Swap{Swap: &pb.Swap{A: 0, B: 24}}},
		{Msg: &pb.ClientMessage_EatSlot{EatSlot: 99}},
		{Msg: &pb.ClientMessage_DropSlot{DropSlot: 24}},
		{Msg: &pb.ClientMessage_Look{Look: &pb.Look{Cut: 4}}},
		{Msg: &pb.ClientMessage_Look{Look: &pb.Look{Color: 8}}},
		{Msg: &pb.ClientMessage_Register{Register: &pb.Credentials{Name: "a b", Password: "long enough"}}},
		{Msg: &pb.ClientMessage_Login{Login: &pb.Credentials{Name: "abc", Password: "short"}}}}
	for _, m := range bad {
		b, _ := proto.Marshal(m)
		_, ok := Decode(b)
		check(t, !ok, m)
	}
	for _, b := range [][]byte{{0xff}, {0x0a, 0x7f}, []byte("{}"), {0x2a, 0xff, 0xff}} {
		_, ok := Decode(b)
		check(t, !ok, b)
	}
	// A nested message that is present but empty must not crash the world.
	e := setup(t)
	p := e.player(1)
	for _, b := range [][]byte{{0x2a, 0}, {0x62, 0}, {0x8a, 1, 0}, {0x92, 1, 0}, {0xa2, 1, 0}, {0xaa, 1, 0}, {0x0a, 0}} {
		if m, ok := Decode(b); ok {
			e.w.Enqueue(p.ID, m)
		}
	}
	e.run(2)
}
