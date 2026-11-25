package game

import (
	"maps"
	"reflect"
	"slices"
	"testing"

	"driftwake/content"
	"driftwake/server/internal/pb"

	"google.golang.org/protobuf/proto"
)

// selvesSent counts the Selfs sent to a client and returns the last.
func (c *client) selvesSent() (n int, last *pb.Self) {
	for _, m := range c.msgs {
		if s := m.GetSelf(); s != nil {
			n, last = n+1, s
		}
	}
	return
}

func (e *env) selfIsCurrent(p *Player, what ...any) {
	e.t.Helper()
	_, last := p.conn.(*client).selvesSent()
	if want := e.w.self(p); !proto.Equal(last, want) {
		e.t.Fatalf("%v: last Self %v, character %v", what, last, want)
	}
}

func TestQuestsAdvanceOnXPFromAMonstersBlow(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	e.run(1)
	p.C.Quests["stranded"] = 0
	m := e.monster("boar")
	e.at(p, m.X, m.Y+1, m.Map.ID)
	content.Quests[0].Steps[0].Need.XP = "defence"
	t.Cleanup(func() { content.Quests[0].Steps[0].Need.XP = "mining" })
	p.C.HP, m.target, m.nextAttack = 1e6, p.ID, 0
	e.run(1)
	check(t, p.C.XP["defence"] > 0, "was attacked")
	eq(t, p.C.Quests["stranded"], 1)
	e.selfIsCurrent(p)
}

func TestQuestsAdvanceWhileWalking(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	e.run(1)
	p.C.Quests["stranded"] = 0
	p.C.XP["mining"] = 25
	e.do(p, move(uint32(p.C.X+1), uint32(p.C.Y)), 1)
	eq(t, p.C.Quests["stranded"], 1)
	e.selfIsCurrent(p)
}

func TestQuestProgressIsSavedAtOnce(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	p.C.Quests["stranded"] = 0
	p.C.XP["mining"] = 25
	e.run(1)
	eq(t, e.savedChar(1).Quests["stranded"], 1)
}

func TestQuestProgressOfSomeoneLeavingIsSaved(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	p.C.Quests["stranded"] = 0
	p.C.XP["mining"] = 25
	e.w.Leave(p.ID, e.c[1])
	e.run(1)
	check(t, e.w.players[p.ID] == nil)
	eq(t, e.savedChar(1).Quests["stranded"], 1)
}

func TestRegenerationSendsNoSelf(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	p.C.HP = 1
	e.run(1)
	before, _ := e.c[1].selvesSent()
	e.run(2 * regenInterval)
	check(t, p.C.HP > 1, "regenerated")
	after, _ := e.c[1].selvesSent()
	eq(t, after, before)
}

// Whatever Self holds must be compared, and what it does not hold must not cause one.
func TestSelfIsCurrentWhateverChanges(t *testing.T) {
	for _, field := range reflect.VisibleFields(reflect.TypeFor[Char]()) {
		e := setup(t)
		p := e.player(1)
		p.C.Equip["weapon"] = &Stack{"copper_sword", 1}
		p.C.Bank = []*Stack{{"ash_log", 1}}
		p.C.Kept = []*Stack{{"rootcleaver", 1}}
		p.C.Boat["sail"] = 1
		p.C.Found = map[string]int{"a/b": 1}
		p.C.Kills = map[string]int{"gnashclaw": 1}
		p.C.Blocked = []string{"someone"}
		p.C.Quests["stranded"] = 0
		p.C.Look = &Look{}
		p.C.Grave = &Grave{Map: "island", Items: []*Stack{{coin, 1}}}
		// Changes are made in place, as rules make them.
		for i, change := range changesOf(reflect.ValueOf(p.C).Elem().FieldByIndex(field.Index)) {
			e.w.sendSelf(p)
			before, old := e.c[1].selvesSent()
			change()
			e.w.sendSelf(p)
			after, _ := e.c[1].selvesSent()
			e.selfIsCurrent(p, field.Name, i)
			eq(t, after > before, !proto.Equal(old, e.w.self(p)), field.Name, i)
		}
	}
}

// changesOf lists ways to change a value and everything within it.
func changesOf(v reflect.Value) (out []func()) {
	switch v.Kind() {
	case reflect.Int:
		out = append(out, func() { v.SetInt(v.Int() + 1) })
	case reflect.Bool:
		out = append(out, func() { v.SetBool(!v.Bool()) })
	case reflect.String: // ids of maps are the only ones Self does not copy as they are
		out = append(out, func() { v.SetString(map[string]string{"island": "mine"}[v.String()]) })
	case reflect.Pointer:
		if !v.IsNil() {
			out = append(changesOf(v.Elem()), func() { v.SetZero() })
		}
	case reflect.Struct:
		for i := range v.NumField() {
			out = append(out, changesOf(v.Field(i))...)
		}
	case reflect.Slice:
		for i := range v.Len() {
			if elem := reflect.Indirect(v.Index(i)); elem.IsValid() {
				out = append(out, changesOf(elem)...)
			}
		}
		out = append(out, func() { v.SetLen(v.Len() - 1) })
	case reflect.Map:
		key := v.MapKeys()[0]
		if elem := v.MapIndex(key); elem.Kind() == reflect.Pointer {
			out = changesOf(elem.Elem())
		} else {
			out = append(out, func() { v.SetMapIndex(key, reflect.ValueOf(int(elem.Int())+1)) })
		}
		out = append(out, func() { v.SetMapIndex(key, reflect.Value{}) })
	}
	return
}

// batchStore also remembers what was saved at once.
type batchStore struct {
	memStore
	batches [][]int64
}

func (s *batchStore) Save(batch map[int64][]byte) {
	s.batches = append(s.batches, slices.Sorted(maps.Keys(batch)))
	s.memStore.Save(batch)
}

func TestTradersAreSavedInOneBatch(t *testing.T) {
	e, a, b := trading(t)
	a.give(coin, 10)
	e.do(a, offerMsg(coin, 10), 1)
	s := &batchStore{memStore: e.saved}
	e.w.store = s
	e.bothAccept(a, b)
	check(t, slices.ContainsFunc(s.batches, func(ids []int64) bool { return slices.Equal(ids, []int64{1, 2}) }))
	eq(t, e.savedChar(2).Inv[slotOf(b, coin)], &Stack{coin, 10})
}

func TestTheReaperKeepsWhatDoesNotFit(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	p.give("ash_log", p.room("ash_log", 99)-2)
	eq(t, p.giveOrKeep("ration", 5), 3)
	eq(t, p.count("ration"), 2)
	eq(t, p.C.Kept, []*Stack{{"ration", 3}})
	eq(t, p.giveOrKeep("ration", 1), 1)
	eq(t, p.C.Kept, []*Stack{{"ration", 4}})
}

func TestChangesAreSavedWhetherOrNotAPlayerIsHere(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	keep := func(c *Char) { c.Kept = addTo(c.Kept, "ration", 1) }
	check(t, e.w.change(p.ID, "keeping", keep) == p)
	eq(t, e.savedChar(1).Kept, []*Stack{{"ration", 1}})
	e.w.Leave(p.ID, e.c[1])
	e.run(1)
	check(t, e.w.change(p.ID, "keeping", keep) == nil)
	eq(t, e.savedChar(1).Kept, []*Stack{{"ration", 2}})
}

// BenchmarkSelfUnchanged is what every player costs on every tick, with a full bank.
func BenchmarkSelfUnchanged(b *testing.B) {
	w := NewWorld(newStore(), Mulberry(5), false, 1000)
	p := &Player{C: NewChar()}
	for id := range content.Items {
		p.C.Bank = addTo(p.C.Bank, id, 5)
	}
	p.C.Found = map[string]int{}
	for id := range content.Items {
		p.C.Found[id] = 1
	}
	s := w.self(p)
	b.ReportAllocs()
	for b.Loop() {
		p.isCurrent(s)
	}
}

func TestJoiningAgainSendsSelf(t *testing.T) {
	e := setup(t)
	e.player(1)
	e.run(1)
	p := e.player(1)
	e.selfIsCurrent(p)
	e.run(2)
	n, _ := e.c[1].selvesSent()
	eq(t, n, 1)
}

func TestSelfIsCurrentAfterEveryIntent(t *testing.T) {
	e := setup(t)
	e.w.dev = true
	p, o := e.player(1), e.player(2)
	p.C.BoatDone = true
	// Each runs on its own, at the station it needs.
	intents := map[string][]*pb.ClientMessage{
		"": {
			move(20, 44), gatherMsg(e.node("rock_1", "island").ID), attackMsg(e.monster("boar").ID), equipMsg(0),
			{Msg: &pb.ClientMessage_Unequip{Unequip: pb.Slot_SLOT_WEAPON}},
			{Msg: &pb.ClientMessage_Swap{Swap: &pb.Swap{A: 1, B: 9}}},
			{Msg: &pb.ClientMessage_EatSlot{EatSlot: 2}},
			{Msg: &pb.ClientMessage_Station{Station: entityID(kindStation, 0)}},
			{Msg: &pb.ClientMessage_Look{Look: &pb.Look{Cut: 1, Color: 2}}},
			{Msg: &pb.ClientMessage_Block{Block: &pb.Block{Name: "Someone", On: true}}},
			{Msg: &pb.ClientMessage_Block{Block: &pb.Block{Name: "Someone"}}},
			{Msg: &pb.ClientMessage_UseLamp{UseLamp: "mining"}},
			{Msg: &pb.ClientMessage_Trade{Trade: o.ID}},
			{Msg: &pb.ClientMessage_DropSlot{DropSlot: 1}},
			chatMsg("/level mining 99"), chatMsg("/give coin 500"), chatMsg("/die"), graveMsg,
		},
		"bank":   {bankMsg(false, "ash_log", 2), bankMsg(true, "ash_log", 1), depositAll},
		"shop":   {shopMsg(true, "worn_axe", 1), shopMsg(false, "worn_axe", 1)},
		"dock":   {boatMsg(false), questMsg("stranded"), boatMsg(true)},
		"reaper": {claimMsg, claimOne(coin)},
	}
	for station, messages := range intents {
		for _, m := range messages {
			if station == "" {
				e.at(p, 20, 44, "island")
			} else {
				where := "mainland"
				if content.MapByID[where].Station(station) == nil {
					where = "island"
				}
				e.atStation(p, station, where)
			}
			p.give(lamp, 1)
			p.give("ash_log", 5)
			p.give(coin, 50)
			p.C.Inv[0], p.C.Inv[2] = &Stack{"copper_sword", 1}, &Stack{"ration", 1}
			e.do(p, m, 1) // which checks p's Self
			e.selfIsCurrent(o, m)
			e.run(3)
			e.selfIsCurrent(p, m)
		}
	}
}
