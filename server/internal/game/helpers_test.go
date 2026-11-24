package game

import (
	"encoding/json"
	"fmt"
	"maps"
	"reflect"
	"slices"
	"testing"

	"driftwake/content"
	"driftwake/server/internal/pb"

	"google.golang.org/protobuf/proto"
)

type memStore struct {
	chars  map[int64][]byte
	totals map[string]int64
}

func newStore() memStore { return memStore{map[int64][]byte{}, map[string]int64{}} }

func (m memStore) Save(batch map[int64][]byte) { maps.Copy(m.chars, batch) }

func (m memStore) Total(name string) int64 { return m.totals[name] }

func (m memStore) AddTotal(name string, n int64) { m.totals[name] += n }

func (m memStore) Update(a int64, change func(*Char)) error {
	var c Char
	if err := json.Unmarshal(m.chars[a], &c); err != nil {
		return err
	}
	change(&c)
	b, err := json.Marshal(&c)
	m.chars[a] = b
	return err
}

// client decodes what a player is sent, keeping entities the way the browser does.
type client struct {
	msgs []*pb.ServerMessage
	ents map[uint32]*pb.Entity
}

func (c *client) Send(m *pb.ServerMessage) { b, _ := proto.Marshal(m); c.SendRaw(b) }

func (c *client) SendRaw(b []byte) {
	m := &pb.ServerMessage{}
	if err := proto.Unmarshal(b, m); err != nil {
		panic(err)
	}
	c.msgs = append(c.msgs, m)
	s := m.GetSnapshot()
	if s == nil {
		return
	}
	if s.Reset_ || c.ents == nil {
		c.ents = map[uint32]*pb.Entity{}
	}
	for _, o := range c.ents { // Full marks entities that are new this tick, and steps never carry over
		o.Full, o.Via = false, nil
	}
	for _, id := range s.Gone {
		if c.ents[id] == nil {
			panic(fmt.Sprintf("gone without being known: %d", id))
		}
		delete(c.ents, id)
	}
	for _, e := range s.Entities {
		o := c.ents[e.Id]
		if e.Full {
			c.ents[e.Id] = e
			continue
		}
		if o == nil {
			panic(fmt.Sprintf("delta for unknown entity %d", e.Id))
		}
		o.Gear, o.Look, o.Boss = orGear(e.Gear, o.Gear), orLook(e.Look, o.Look), orBoss(e.Boss, o.Boss)
		e.Gear, e.Look, e.Boss = nil, nil, nil
		proto.Merge(o, e)
	}
}

func orGear(a, b *pb.Gear) *pb.Gear {
	if a != nil {
		return a
	}
	return b
}

func orLook(a, b *pb.Look) *pb.Look {
	if a != nil {
		return a
	}
	return b
}

func orBoss(a, b *pb.BossView) *pb.BossView {
	if a != nil {
		return a
	}
	return b
}

type env struct {
	t     *testing.T
	w     *World
	saved memStore
	c     map[int64]*client
}

func setup(t *testing.T) *env {
	s := newStore()
	return &env{t, NewWorld(s, Mulberry(5), false, 1000), s, map[int64]*client{}}
}

func (e *env) player(n int64) *Player {
	c := &client{}
	e.c[n] = c
	id, err := e.w.Join(n, fmt.Sprintf("P%d", n), func() (*Char, error) { return nil, nil }, c)
	if err != nil {
		e.t.Fatal(err)
	}
	return e.w.players[id]
}

func (e *env) run(n int) {
	for range n {
		e.w.Step()
	}
}

// do sends a message through the wire format, then runs ticks.
func (e *env) do(p *Player, m *pb.ClientMessage, ticks int) {
	e.t.Helper()
	b, _ := proto.Marshal(m)
	d, ok := Decode(b)
	if !ok {
		e.t.Fatalf("refused: %v", m)
	}
	e.w.Enqueue(p.ID, d)
	e.run(ticks)
}

func (e *env) at(p *Player, x, y int, m string) {
	p.C.Map, p.C.X, p.C.Y = m, x, y
	e.w.stop(p)
}

func setLevel(p *Player, n int) {
	for _, s := range content.Skills {
		p.C.XP[s] = XPForLevel(n)
	}
	p.C.HP = MaxHP(n)
}

func (e *env) node(typ, m string) *Node {
	for _, n := range e.w.nodes {
		if n.Def.ID == typ && n.Map.ID == m {
			return n
		}
	}
	e.t.Fatal("no node", typ)
	return nil
}

func (e *env) atStation(p *Player, kind, m string) {
	s := content.MapByID[m].Station(kind)
	e.at(p, s.X, s.Y+1, m)
}

func (e *env) monster(id string) *Monster {
	for _, m := range e.w.monsters {
		if m.Def.ID == id {
			return m
		}
	}
	e.t.Fatal("no monster", id)
	return nil
}

func eq[T any](t *testing.T, got, want T, what ...any) {
	t.Helper()
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("%v: got %v, want %v", what, got, want)
	}
}

func check(t *testing.T, ok bool, what ...any) {
	t.Helper()
	if !ok {
		t.Fatal(what...)
	}
}

// --- messages
func move(x, y uint32) *pb.ClientMessage {
	return &pb.ClientMessage{Msg: &pb.ClientMessage_Move{Move: &pb.Tile{X: x, Y: y}}}
}

func gatherMsg(id uint32) *pb.ClientMessage {
	return &pb.ClientMessage{Msg: &pb.ClientMessage_Gather{Gather: id}}
}

func attackMsg(id uint32) *pb.ClientMessage {
	return &pb.ClientMessage{Msg: &pb.ClientMessage_Attack{Attack: id}}
}

func pickupMsg(id uint32) *pb.ClientMessage {
	return &pb.ClientMessage{Msg: &pb.ClientMessage_Pickup{Pickup: id}}
}

func craftMsg(id string, n uint32) *pb.ClientMessage {
	return &pb.ClientMessage{Msg: &pb.ClientMessage_Craft{Craft: &pb.Craft{Recipe: id, Qty: n}}}
}

func equipMsg(i uint32) *pb.ClientMessage {
	return &pb.ClientMessage{Msg: &pb.ClientMessage_EquipSlot{EquipSlot: i}}
}

func bankMsg(out bool, id string, n uint32) *pb.ClientMessage {
	return &pb.ClientMessage{Msg: &pb.ClientMessage_Bank{Bank: &pb.Bank{Withdraw: out, Item: id, Qty: n}}}
}

func boatMsg(sail bool) *pb.ClientMessage {
	return &pb.ClientMessage{Msg: &pb.ClientMessage_Boat{Boat: &pb.Boat{Sail: sail}}}
}

func chatMsg(s string) *pb.ClientMessage {
	return &pb.ClientMessage{Msg: &pb.ClientMessage_Chat{Chat: s}}
}

func claimOne(item string) *pb.ClientMessage {
	return &pb.ClientMessage{Msg: &pb.ClientMessage_Claim{Claim: &pb.Claim{Item: item}}}
}

func shopMsg(buy bool, item string, n uint32) *pb.ClientMessage {
	return &pb.ClientMessage{Msg: &pb.ClientMessage_Shop{Shop: &pb.Shop{Buy: buy, Item: item, Qty: n}}}
}

var (
	claimMsg   = &pb.ClientMessage{Msg: &pb.ClientMessage_Claim{Claim: &pb.Claim{}}}
	graveMsg   = &pb.ClientMessage{Msg: &pb.ClientMessage_Grave{Grave: &pb.Empty{}}}
	depositAll = &pb.ClientMessage{Msg: &pb.ClientMessage_DepositAll{DepositAll: &pb.Empty{}}}
)

func (e *env) provoke(p *Player, m *Monster) { p.C.HP = 1e6; m.active.set(p.ID, e.w.Tick) }

// slotOf is the inventory slot of an item, or -1.
func slotOf(p *Player, item string) int {
	return slices.IndexFunc(p.C.Inv, func(s *Stack) bool { return s != nil && s.ID == item })
}
