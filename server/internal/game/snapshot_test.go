package game

import (
	"fmt"
	"math"
	"reflect"
	"slices"
	"testing"

	"driftwake/server/internal/pb"

	"google.golang.org/protobuf/encoding/protowire"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
)

// shown is an entity as a client pieced it together.
func shown(g *pb.Entity) fields {
	gear, look, boss := g.GetGear(), g.GetLook(), g.GetBoss()
	return fields{
		x:         int(g.GetX()),
		y:         int(g.GetY()),
		hp:        int(g.GetHp()),
		maxHP:     int(g.GetMaxHp()),
		level:     int(g.GetLevel()),
		qty:       int(g.GetQty()),
		name:      g.GetName(),
		typ:       g.GetType(),
		act:       g.GetAct(),
		tool:      g.GetTool(),
		target:    g.GetTarget(),
		gear:      [5]string{gear.GetWeapon(), gear.GetHead(), gear.GetBody(), gear.GetLegs(), gear.GetCape()},
		look:      Look{Cut: int(look.GetCut()), Color: int(look.GetColor())},
		rooted:    g.GetRooted(),
		boss:      boss != nil,
		glowing:   g.GetGlowing(),
		rich:      g.GetRich(),
		wants:     g.GetWants(),
		bossSt:    boss.GetState(),
		bossStart: int(boss.GetStart()),
		until:     int(g.GetUntil()),
	}
}

// differing names the fields that are not the same in a and b.
func differing(a, b fields) (names []string) {
	x, y := reflect.ValueOf(a), reflect.ValueOf(b)
	for i := range x.NumField() {
		if !x.Field(i).Equal(y.Field(i)) {
			names = append(names, x.Type().Field(i).Name)
		}
	}
	return
}

// Fields an entity keeps for as long as it exists. All others can change while a client watches.
var constantFields = []string{"name", "typ", "qty", "wants", "boss"}

// disturb changes something about a player or near them that ordinary play rarely changes.
func (e *env) disturb(p *Player, r func() float64) {
	tick := e.w.Tick
	switch int(r() * 80) {
	case 0:
		setLevel(p, 10+int(r()*10))
	case 1:
		p.C.Equip["cape"] = &Stack{ID: "cape_magic", Qty: 1}
	case 2:
		delete(p.C.Equip, "cape")
	case 3:
		p.C.Look = &Look{Cut: int(r() * 3), Color: int(r() * 5)}
	case 4:
		p.rooted = tick + 3
	case 5, 6: // the node stays in sight, because it is depleted, before and after it glows or is rich
		n := e.w.nodes[int(r()*40)]
		n.depletedUntil, n.glowingUntil, n.richUntil = tick+30, tick+5+int(r()*10), tick+5+int(r()*10)
	case 7:
		for _, d := range e.w.drops {
			if d.Owner == p.ID {
				d.expires += 5
			}
		}
	case 8:
		e.fight(p, e.monster("gnashclaw"), 0.2)
	case 9:
		e.w.addNPC(&NPC{Kind: npcTrader, Map: e.w.mapOf(p), X: p.C.X, Y: p.C.Y, until: tick + 20, wants: "copper_ore"})
	case 10:
		e.w.addNPC(&NPC{Kind: npcGenie, Map: e.w.mapOf(p), X: p.C.X, Y: p.C.Y, until: tick + 20, owner: p.ID})
	}
}

// What a client pieces together from deltas must equal the world, through a busy scene in which every field plays
// a part. A field that nothing here changes fails the test too.
func TestDeltasRebuildTheWorld(t *testing.T) {
	e := setup(t)
	r := Mulberry(11)
	for i := int64(1); i <= 12; i++ {
		setLevel(e.player(i), 10)
	}
	exercised := map[string]bool{}
	walked := false
	before := map[*client]map[uint32]fields{}
	for tick := range 600 {
		for _, p := range e.w.order {
			switch int(r() * 30) {
			case 0:
				e.do(p, move(uint32(10+r()*44), uint32(10+r()*44)), 0)
			case 1:
				e.do(p, gatherMsg(e.w.nodes[int(r()*40)].ID), 0)
			case 2:
				e.do(p, attackMsg(e.w.monsters[int(r()*15)].ID), 0)
			case 3:
				e.do(p, &pb.ClientMessage{Msg: &pb.ClientMessage_DropSlot{DropSlot: uint32(r() * 24)}}, 0)
			}
			e.disturb(p, r)
		}
		e.run(1)
		if tick == 300 { // reconnect mid-way
			e.player(3)
			e.run(1)
		}
		for _, p := range e.w.order {
			c := e.c[p.Account]
			now := map[uint32]fields{}
			for _, v := range e.w.views() {
				if v.m != e.w.mapOf(p) || !v.visibleTo(p) {
					continue
				}
				g := c.ents[v.id]
				check(t, g != nil, "missing", v.id)
				if wrong := differing(shown(g), v.f); len(wrong) > 0 {
					t.Fatalf("tick %d entity %d: %v differ: client %v, world %+v", tick, v.id, wrong, g, v.f)
				}
				if v.boss != nil {
					check(t, proto.Equal(g.Boss, v.bossView()), "boss view")
				}
				if !g.Full { // the way an entity came to be where a client first sees it is not told
					check(t, slices.Equal(g.Via, flat(v.via)), "via", v.id, g.Via, v.via)
					walked = walked || len(v.via) > 0
				}
				now[v.id] = v.f
				for _, name := range differing(v.f, fields{}) {
					if slices.Contains(constantFields, name) {
						exercised[name] = true
					}
				}
				if old, ok := before[c][v.id]; ok && !g.Full {
					for _, name := range differing(v.f, old) {
						exercised[name] = true
					}
				}
			}
			n := len(now)
			if p.C.Grave != nil && p.C.Grave.Map == p.C.Map {
				n++
				g := c.ents[graveID]
				check(t, g != nil, "missing grave")
				eq(t, shown(g), fields{x: p.C.Grave.X, y: p.C.Grave.Y}, "grave")
			}
			eq(t, len(c.ents), n, "extra entities")
			before[c] = now
		}
	}
	check(t, walked, "nobody was seen walking")
	for _, f := range reflect.VisibleFields(reflect.TypeFor[fields]()) {
		check(t, exercised[f.Name], "the scene does not exercise", f.Name)
	}
}

// snapshotFor writes these field numbers by hand.
func TestSnapshotFieldNumbers(t *testing.T) {
	snapshot := (&pb.Snapshot{}).ProtoReflect().Descriptor().Fields()
	for name, number := range map[string]protowire.Number{
		"tick": fieldTick, "map": fieldMap, "reset": fieldReset,
		"entities": fieldEntities, "gone": fieldGone, "events": fieldEvents,
	} {
		eq(t, snapshot.ByName(protoreflect.Name(name)).Number(), number, name)
	}
	message := (&pb.ServerMessage{}).ProtoReflect().Descriptor().Fields()
	eq(t, message.ByName("snapshot").Number(), fieldSnapshot)
}

// deaf ignores what a player is sent.
type deaf struct{}

func (deaf) Send(*pb.ServerMessage) {}

func (deaf) SendRaw([]byte) {}

// One tick's snapshots, for many players who all move and fight, and come across each other all the time.
func BenchmarkSnapshots(b *testing.B) {
	w := NewWorld(newStore(), Mulberry(5), false, math.MaxInt)
	for i := range int64(200) {
		if _, err := w.Join(i+1, fmt.Sprintf("P%d", i), func() (*Char, error) { return nil, nil }, deaf{}); err != nil {
			b.Fatal(err)
		}
	}
	b.ReportAllocs()
	for b.Loop() {
		w.Tick++
		for i, p := range w.order {
			p.C.X, p.C.Y = 10+(w.Tick+i*7)%50, 10+(i*3)%50
			p.C.HP = 5 + (w.Tick+i)%5
			p.via = []Point{p.at()}
			p.act = action{typ: actAttack, id: w.monsters[(w.Tick+i)%len(w.monsters)].ID}
		}
		w.sendSnapshots()
	}
}
