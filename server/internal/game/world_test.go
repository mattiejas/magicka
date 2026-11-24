package game

import (
	"encoding/json"
	"testing"

	"driftwake/content"
	"driftwake/server/internal/pb"
)

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
	eq(t, p.C.Map, "mainland")
	check(t, e.c[1].msgs[len(e.c[1].msgs)-1].GetSnapshot().GetReset_() || e.c[1].ents != nil)
	e.atStation(p, "dock", "mainland")
	e.do(p, boatMsg(true), 1)
	eq(t, p.C.Map, "island")
}

func TestAbuseIsIgnored(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	p.C.Bank = []*Stack{{"essence", 9}}
	e.at(p, 20, 44, "island")
	e.do(p, bankMsg(true, "essence", 9), 1)
	eq(t, p.count("essence"), 0)
	e.do(p, claimMsg, 1)
	x := p.C.X
	for range 10 {
		e.do(p, move(40, 44), 0)
	}
	e.run(1)
	check(t, p.C.X-x <= 2, "too fast")
	p.give("iron_sword", 1)
	e.do(p, equipMsg(uint32(slotOf(p, "iron_sword"))), 1)
	check(t, p.C.Equip["weapon"] == nil)
	e.do(p, chatMsg("/give gem_5 5"), 1)
	eq(t, p.count("gem_5"), 0)
	strange := []uint32{
		0, 1, 2, 0xffffffff, p.ID,
		entityID(kindNode, 99999), entityID(kindMonster, 99999), entityID(kindStation, 99999),
	}
	for _, id := range strange {
		e.do(p, attackMsg(id), 1)
		e.do(p, gatherMsg(id), 1)
		e.do(p, pickupMsg(id), 1)
		e.do(p, &pb.ClientMessage{Msg: &pb.ClientMessage_Station{Station: id}}, 1)
	}
	e.do(p, bankMsg(true, "__proto__", 1), 1)
}

func TestLookIsSavedAndShown(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	e.player(2)
	e.run(1)
	e.do(p, &pb.ClientMessage{Msg: &pb.ClientMessage_Look{Look: &pb.Look{Cut: 2, Color: 7}}}, 1)
	var c Char
	json.Unmarshal(e.saved.chars[1], &c)
	eq(t, *c.Look, Look{2, 7})
	l := e.c[2].ents[p.ID].Look
	check(t, l.Cut == 2 && l.Color == 7)
}

func TestOldSavesStillLoad(t *testing.T) {
	e := setup(t)
	old := `{"map":"island","x":32,"y":35,"hp":23,"xp":{"mining":50},"inv":[{"id":"worn_axe","qty":1}],
		"equip":{},"bank":[],"boat":{},"boatDone":false,"grave":null}`
	var c Char
	check(t, json.Unmarshal([]byte(old), &c) == nil)
	id, err := e.w.Join(9, "Old", func() (*Char, error) { return &c, nil }, &client{})
	check(t, err == nil)
	e.run(2)
	p := e.w.players[id]
	eq(t, len(p.C.Inv), content.InvSize)
	eq(t, p.level("mining"), 2)
	check(t, p.C.Look == nil)
}

func TestRenamedItemsInOldSaves(t *testing.T) {
	e := setup(t)
	old := `{"map":"island","x":32,"y":35,"hp":23,"xp":{},"inv":[{"id":"rudder","qty":1}],"equip":{},
		"bank":[{"id":"rudder","qty":2}],"boat":{"hull":20,"rudder":1},"boatDone":false,
		"grave":{"map":"island","x":1,"y":1,"items":[{"id":"rudder","qty":1}]}}`
	var c Char
	check(t, json.Unmarshal([]byte(old), &c) == nil)
	id, _ := e.w.Join(9, "Old", func() (*Char, error) { return &c, nil }, &client{})
	e.run(2)
	p := e.w.players[id]
	eq(t, p.count("ships_wheel"), 1)
	eq(t, p.C.Bank, []*Stack{{"ships_wheel", 2}})
	eq(t, p.C.Grave.Items, []*Stack{{"ships_wheel", 1}})
	eq(t, p.C.Boat, map[string]int{"hull": 20, "wheel": 1})
}
