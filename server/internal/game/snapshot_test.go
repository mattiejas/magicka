package game

import (
	"slices"
	"testing"

	"driftwake/server/internal/pb"

	"google.golang.org/protobuf/encoding/protowire"
	"google.golang.org/protobuf/reflect/protoreflect"
)

// What a client pieces together from deltas must equal the world, through a busy scene.
func TestDeltasRebuildTheWorld(t *testing.T) {
	e := setup(t)
	r := Mulberry(11)
	for i := int64(1); i <= 12; i++ {
		setLevel(e.player(i), 10)
	}
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
		}
		e.run(1)
		if tick == 300 { // reconnect mid-way
			e.player(3)
			e.run(1)
		}
		for _, p := range e.w.order {
			c := e.c[p.Account]
			n := 0
			for _, v := range e.w.views() {
				if v.m != e.w.mapOf(p) || !v.visibleTo(p) {
					continue
				}
				n++
				g := c.ents[v.id]
				check(t, g != nil, "missing", v.id)
				same := int(g.GetX()) == v.f.x && int(g.GetY()) == v.f.y && int(g.GetHp()) == v.f.hp &&
					g.GetAct() == v.f.act && g.GetTarget() == v.f.target && g.GetTool() == v.f.tool &&
					g.GetType() == v.f.typ && g.GetRooted() == v.f.rooted
				if !same {
					t.Fatalf("tick %d entity %d: client %v, world %+v", tick, v.id, g, v.f)
				}
				if v.boss != nil {
					check(t, g.Boss.State == v.boss.st && slices.Equal(g.Boss.Tiles, flat(v.boss.tiles)), "boss view")
				}
			}
			if p.C.Grave != nil && p.C.Grave.Map == p.C.Map {
				n++
			}
			eq(t, len(c.ents), n, "extra entities")
		}
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
