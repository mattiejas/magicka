package game

import (
	"encoding/json"
	"fmt"
	"math"
	"reflect"
	"slices"
	"testing"

	"driftwake/content"
	"driftwake/server/internal/pb"

	"google.golang.org/protobuf/proto"
)

type memStore map[int64][]byte

func (m memStore) Save(a int64, b []byte) { m[a] = b }

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
		o.Via, o.Gear, o.Look, o.Boss = nil, orGear(e.Gear, o.Gear), orLook(e.Look, o.Look), orBoss(e.Boss, o.Boss)
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
	s := memStore{}
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

var (
	claimMsg   = &pb.ClientMessage{Msg: &pb.ClientMessage_Claim{Claim: &pb.Empty{}}}
	graveMsg   = &pb.ClientMessage{Msg: &pb.ClientMessage_Grave{Grave: &pb.Empty{}}}
	depositAll = &pb.ClientMessage{Msg: &pb.ClientMessage_DepositAll{DepositAll: &pb.Empty{}}}
)

// --- shared rules
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
	bad := []*pb.ClientMessage{{}, move(256, 0), craftMsg("x", 0), craftMsg("x", 1000), equipMsg(24), bankMsg(false, "a", 0), bankMsg(true, "a", 1_000_001), chatMsg("   "),
		{Msg: &pb.ClientMessage_Unequip{Unequip: 0}}, {Msg: &pb.ClientMessage_Unequip{Unequip: 7}}, {Msg: &pb.ClientMessage_ResumeToken{ResumeToken: "x"}},
		{Msg: &pb.ClientMessage_Swap{Swap: &pb.Swap{A: 0, B: 24}}}, {Msg: &pb.ClientMessage_EatSlot{EatSlot: 99}}, {Msg: &pb.ClientMessage_DropSlot{DropSlot: 24}},
		{Msg: &pb.ClientMessage_Look{Look: &pb.Look{Cut: 4}}}, {Msg: &pb.ClientMessage_Look{Look: &pb.Look{Color: 8}}},
		{Msg: &pb.ClientMessage_Register{Register: &pb.Credentials{Name: "a b", Password: "long enough"}}}, {Msg: &pb.ClientMessage_Login{Login: &pb.Credentials{Name: "abc", Password: "short"}}}}
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

// --- skilling
func TestMineSmeltSmith(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	n := e.node("rock_1", "island")
	for i := 0; i < 400 && p.count("copper_ore") < 4; i++ {
		if p.act.typ == actNone {
			e.do(p, gatherMsg(n.ID), 0)
		}
		e.run(1)
	}
	check(t, p.count("copper_ore") >= 4 && p.C.XP["mining"] > 0)
	p.give("ash_log", 1)
	e.atStation(p, "furnace", "island")
	e.do(p, craftMsg("copper_bar", 2), 12)
	eq(t, p.count("copper_bar"), 2)
	e.atStation(p, "anvil", "island")
	e.do(p, craftMsg("copper_pickaxe", 1), 8)
	eq(t, p.count("copper_pickaxe"), 1)
	eq(t, p.count("copper_bar"), 0)
}
func TestNoTierCanBeSkipped(t *testing.T) {
	for kind, tools := range map[string][]string{"rock": {"worn_pickaxe", "copper_pickaxe", "iron_pickaxe", "mithril_pickaxe", "cobalt_pickaxe"}, "tree": {"worn_axe", "copper_axe", "iron_axe", "mithril_axe", "cobalt_axe"}} {
		for tier := 2; tier <= 5; tier++ {
			e := setup(t)
			p := e.player(1)
			setLevel(p, 50)
			n := e.node(fmt.Sprintf("%s_%d", kind, tier), "mainland")
			attempt := func(tool string) bool {
				clear(p.C.Inv)
				p.give(tool, 1)
				n.depletedUntil = 0
				e.at(p, n.X, n.Y-1, "mainland")
				p.C.HP, p.C.Grave = 1e6, nil
				e.do(p, gatherMsg(n.ID), 60)
				return p.C.Inv[1] != nil
			}
			check(t, !attempt(tools[tier-2]), kind, tier, "with too low a tool")
			check(t, attempt(tools[tier-1]), kind, tier)
		}
	}
}
func TestLevelAndToolAreRequired(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	p.give("copper_pickaxe", 1)
	n := e.node("rock_2", "island")
	e.at(p, n.X, n.Y-1, "island")
	e.do(p, gatherMsg(n.ID), 30)
	eq(t, p.count("iron_ore"), 0)
	clear(p.C.Inv)
	n = e.node("rock_1", "island")
	e.at(p, n.X, n.Y-1, "island")
	e.do(p, gatherMsg(n.ID), 30)
	eq(t, p.count("copper_ore"), 0)
}
func TestRecipesConserveMaterialsAndRange(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	for _, r := range content.Recipes {
		setLevel(p, 50)
		clear(p.C.Inv)
		for _, i := range r.In {
			p.give(i.Item, i.Qty)
		}
		e.at(p, 10, 30, "island")
		e.do(p, craftMsg(r.ID, 1), 5)
		eq(t, p.count(r.Out), 0, r.ID)
		e.atStation(p, r.Station, "island")
		e.do(p, craftMsg(r.ID, 5), 8)
		eq(t, p.count(r.Out), r.Qty, r.ID)
		for _, i := range r.In {
			eq(t, p.count(i.Item), 0, r.ID)
		}
	}
}

// --- inventory
func TestItemsAreNeverCreatedOrLost(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	r := Mulberry(9)
	setLevel(p, 50)
	e.atStation(p, "bank", "island")
	ids := []string{"copper_arrow", "iron_arrow", "copper_sword", "ash_bow", "essence", "copper_helm", "berries"}
	for _, i := range ids {
		p.give(i, 2)
	}
	total := func() map[string]int {
		n := map[string]int{}
		add := func(s *Stack) {
			if s != nil {
				n[s.ID] += s.Qty
			}
		}
		for _, l := range [][]*Stack{p.C.Inv, p.C.Bank} {
			for _, s := range l {
				add(s)
			}
		}
		for _, s := range p.C.Equip {
			add(s)
		}
		for _, d := range e.w.drops {
			n[d.Item] += d.Qty
		}
		return n
	}
	pick := func(n int) int { return int(r() * float64(n)) }
	start := total()
	for range 3000 {
		slot, id := uint32(pick(24)), ids[pick(len(ids))]
		var m *pb.ClientMessage
		switch pick(6) {
		case 0:
			m = equipMsg(slot)
		case 1:
			m = &pb.ClientMessage{Msg: &pb.ClientMessage_Unequip{Unequip: []pb.Slot{pb.Slot_SLOT_WEAPON, pb.Slot_SLOT_AMMO, pb.Slot_SLOT_HEAD}[pick(3)]}}
		case 2:
			m = bankMsg(false, id, uint32(1+pick(3)))
		case 3:
			m = bankMsg(true, id, uint32(1+pick(3)))
		case 4:
			m = &pb.ClientMessage{Msg: &pb.ClientMessage_Swap{Swap: &pb.Swap{A: slot, B: uint32(pick(24))}}}
		default:
			m = depositAll
		}
		e.do(p, m, 1)
		eq(t, total(), start)
	}
}

// --- combat and death
func TestEveryStyleKillsAndLoots(t *testing.T) {
	for style, kit := range map[string][2]string{"melee": {"iron_sword", ""}, "ranged": {"pine_bow", "iron_arrow"}, "magic": {"pine_staff", "essence"}} {
		e := setup(t)
		p := e.player(1)
		setLevel(p, 15)
		p.C.Equip["weapon"] = &Stack{kit[0], 1}
		if kit[1] != "" {
			p.C.Equip["ammo"] = &Stack{kit[1], 500}
		}
		m := e.monster("boar")
		e.at(p, m.X+1, m.Y, "island")
		xp := p.C.XP[style]
		for i := 0; i < 200 && !m.Dead; i++ {
			if p.act.typ == actNone {
				e.do(p, attackMsg(m.ID), 0)
			}
			e.run(1)
		}
		check(t, m.Dead && p.C.XP[style] > xp, style)
		if kit[1] != "" {
			check(t, p.C.Equip["ammo"].Qty < 500)
		}
		for _, d := range e.w.drops {
			if d.Item == "hide_1" {
				e.do(p, pickupMsg(d.ID), 15)
				break
			}
		}
		eq(t, p.count("hide_1"), 1, style)
	}
}
func TestBowNeedsArrowsNoBetterThanItself(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	setLevel(p, 50)
	p.C.Equip["weapon"] = &Stack{"ash_bow", 1}
	p.give("iron_arrow", 5)
	m := e.monster("boar")
	e.at(p, m.X+1, m.Y, "island")
	e.do(p, attackMsg(m.ID), 6)
	eq(t, p.count("iron_arrow"), 5)
}
func TestDeathKeepsGearAndStoresItemsForever(t *testing.T) {
	e := setup(t)
	p, q := e.player(1), e.player(2)
	p.C.Equip["weapon"] = &Stack{"copper_sword", 1}
	p.give("copper_ore", 3)
	e.at(p, 20, 44, "island")
	e.w.hurt(p, 0, 999, "melee")
	eq(t, p.C.Equip["weapon"].ID, "copper_sword")
	eq(t, p.emptySlot(), 0)
	eq(t, Point{X: p.C.Grave.X, Y: p.C.Grave.Y}, Point{X: 20, Y: 44})
	p.give("ash_log", 1)
	e.at(p, 22, 44, "island")
	e.w.hurt(p, 0, 999, "melee")
	eq(t, p.C.Grave.X, 22)
	e.at(q, 22, 44, "island")
	e.do(q, graveMsg, 3)
	check(t, p.C.Grave != nil)
	e.run(3000)
	eq(t, len(p.C.Grave.Items), 5)
	// Reload into a new world and claim from the reaper.
	var c Char
	check(t, json.Unmarshal(e.saved[1], &c) == nil)
	e2 := setup(t)
	id, _ := e2.w.Join(1, "P1", func() (*Char, error) { return &c, nil }, &client{})
	p2 := e2.w.players[id]
	eq(t, p2.C.Grave, p.C.Grave)
	e2.atStation(p2, "reaper", "island")
	e2.do(p2, claimMsg, 1)
	check(t, p2.C.Grave == nil)
	eq(t, p2.count("copper_ore"), 3)
	eq(t, p2.count("worn_axe"), 1)
}
func TestClaimTakesOnlyWhatFits(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	clear(p.C.Inv)
	p.give("ash_log", 24)
	e.w.hurt(p, 0, 999, "melee")
	p.give("berries", 20)
	e.atStation(p, "reaper", "island")
	e.do(p, claimMsg, 1)
	eq(t, p.count("ash_log"), 4)
	eq(t, p.C.Grave.Items, []*Stack{{"ash_log", 20}})
}
func TestDisconnectingInCombatLingers(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	e.at(p, 20, 44, "island")
	e.w.hurt(p, 0, 1, "melee")
	e.w.Leave(p.ID, e.c[1])
	e.run(10)
	check(t, e.w.players[p.ID] != nil)
	e.run(60)
	check(t, e.w.players[p.ID] == nil && e.saved[1] != nil)
}
func TestSecondLoginTakesOver(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	old := e.c[1]
	check(t, e.player(1) == p)
	last := old.msgs[len(old.msgs)-1]
	check(t, last.GetKicked() != "")
	e.w.Leave(p.ID, old)
	e.run(60)
	check(t, e.w.players[p.ID] != nil && len(e.w.order) == 1)
	check(t, !e.w.Owns(p.ID, old))
}

// --- bosses
func (e *env) provoke(p *Player, m *Monster) { p.C.HP = 1e6; m.active.set(p.ID, e.w.Tick) }
func TestBossOnlyCyclesThreeStates(t *testing.T) {
	e := setup(t)
	p, m := e.player(1), e.monster("gnashclaw")
	b := m.boss
	var prev bossState
	started := false
	chosen := map[string]bool{}
	next := map[pb.BossState]pb.BossState{choose: windup, windup: execute, execute: choose}
	for i := range 1500 {
		near := i/150%2 == 0
		x := m.X - 6
		if near {
			x = m.X - 1
		}
		e.at(p, x, m.Y, "island")
		e.provoke(p, m)
		e.run(1)
		if started {
			if prev.st == windup && b.st == windup {
				check(t, b.atk == prev.atk && slices.Equal(b.tiles, prev.tiles), "attack changed")
			}
			if prev.st != b.st {
				eq(t, b.st, next[prev.st])
			}
			if prev.st == choose && b.st == windup {
				chosen[b.atk.ID] = true
				check(t, near || b.atk.ID != "melee", "melee out of reach")
			}
		}
		prev, started = *b, true
	}
	eq(t, chosen, map[string]bool{"melee": true, "boulder": true, "vines": true})
}
func TestTelegraphsCanBeDodgedAndRoot(t *testing.T) {
	e := setup(t)
	p, m := e.player(1), e.monster("gnashclaw")
	b := m.boss
	dodged, hit, rooted := 0, 0, 0
	for i := range 800 {
		dodge := i < 400
		e.at(p, m.X-6, m.Y, "island")
		if b.st == windup && b.end == e.w.Tick+1 && dodge && b.atk.ID != "melee" {
			e.at(p, m.X-8, m.Y+3, "island")
		}
		e.provoke(p, m)
		e.run(1)
		if b.st == execute && b.start == e.w.Tick {
			if p.C.HP < 1e6 {
				check(t, !dodge, "dodged attack hit")
				hit++
			} else {
				dodged++
			}
			if p.rooted > e.w.Tick {
				rooted++
			}
		}
	}
	check(t, dodged > 10 && hit > 10 && rooted > 0, dodged, hit, rooted)
}
func TestBossHealthScalesBothWays(t *testing.T) {
	e := setup(t)
	e.w.spawnWorldBoss()
	m := e.w.worldBoss()
	var ps []*Player
	for i := int64(1); i <= 4; i++ {
		p := e.player(i)
		ps = append(ps, p)
		e.at(p, m.X-1, m.Y, "mainland")
		e.provoke(p, m)
	}
	e.run(1)
	eq(t, m.MaxHP, BossMaxHP(900, 4))
	m.HP = m.MaxHP * 0.4
	for _, p := range ps[2:] {
		e.at(p, 48, 77, "mainland")
		m.active.del(p.ID)
	}
	for _, p := range ps[:2] {
		e.at(p, m.X-1, m.Y, "mainland")
		e.provoke(p, m)
	}
	e.run(1)
	eq(t, m.MaxHP, BossMaxHP(900, 2))
	check(t, math.Abs(m.HP/m.MaxHP-0.4) < 1e-9)
}
func TestInactiveFightersDropOff(t *testing.T) {
	e := setup(t)
	e.w.spawnWorldBoss()
	m := e.w.worldBoss()
	a, b := e.player(1), e.player(2)
	for _, p := range []*Player{a, b} {
		e.at(p, 48, 77, "mainland")
		m.active.set(p.ID, e.w.Tick)
	}
	e.run(1)
	eq(t, m.MaxHP, BossMaxHP(900, 2))
	for range 40 {
		m.active.set(a.ID, e.w.Tick)
		e.run(1)
	}
	eq(t, m.MaxHP, 900)
}
func TestBossLootGoesToContributorsThenEveryone(t *testing.T) {
	e := setup(t)
	p, q, m := e.player(1), e.player(2), e.monster("gnashclaw")
	setLevel(p, 50)
	p.C.Equip["weapon"] = &Stack{"rootcleaver", 1}
	m.dmg.set(q.ID, 0.01)
	m.dmg.set(p.ID, 0.5)
	eq(t, m.share(), []uint32{p.ID})
	for i := 0; i < 200 && !m.Dead; i++ {
		e.at(p, m.X-1, m.Y, "island")
		p.act = action{typ: actAttack, id: m.ID}
		p.C.HP = 1e6
		e.run(1)
	}
	check(t, m.Dead)
	var d *Drop
	for _, o := range e.w.drops {
		eq(t, o.Owner, p.ID)
		if o.Item == "rudder" {
			d = o
		}
	}
	e.at(q, d.X, d.Y, "island")
	e.do(q, pickupMsg(d.ID), 2)
	eq(t, q.count("rudder"), 0)
	check(t, e.c[1].ents[d.ID] != nil && e.c[2].ents[d.ID] == nil, "private loot visibility")
	e.run(301)
	e.at(q, d.X, d.Y, "island")
	q.C.HP = 1e6
	e.run(1)
	check(t, e.c[2].ents[d.ID] != nil, "public loot visibility")
	e.do(q, pickupMsg(d.ID), 2)
	eq(t, q.count("rudder"), 1)
}
func TestUniquesDropNearStatedRate(t *testing.T) {
	r, n := Mulberry(3), 0
	for range 40000 {
		for _, l := range rollLoot(r, &content.Monsters["colossus"].Loot) {
			if l.unique {
				n++
			}
		}
	}
	check(t, n > 2600 && n < 3400, n)
}
func TestWorldBossScheduleAndAbandonment(t *testing.T) {
	e := setup(t)
	e.run(1000)
	m := e.w.worldBoss()
	check(t, !m.Dead)
	m.dmg.set(99, 0.5)
	m.HP = 10
	e.run(2)
	eq(t, m.HP, 900)
}

// A level 8 player in copper with six rations.
func solo(t *testing.T, seed int64, dodge bool) bool {
	e := setup(t)
	e.w.rnd = Mulberry(uint32(seed))
	p, m := e.player(50+seed), e.monster("gnashclaw")
	setLevel(p, 8)
	for slot, id := range map[string]string{"weapon": "copper_sword", "body": "copper_plate", "legs": "copper_greaves", "head": "copper_helm"} {
		p.C.Equip[slot] = &Stack{id, 1}
	}
	p.give("ration", 6)
	e.at(p, m.X-1, m.Y, "island")
	for range 900 {
		b, hot := m.boss, false
		for _, q := range b.tiles {
			hot = hot || b.st == windup && q == Point{X: p.C.X, Y: p.C.Y}
		}
		if food := slices.IndexFunc(p.C.Inv, func(s *Stack) bool { return s != nil && s.ID == "ration" }); p.C.HP < 20 && food >= 0 {
			e.do(p, &pb.ClientMessage{Msg: &pb.ClientMessage_EatSlot{EatSlot: uint32(food)}}, 0)
		}
		if dodge && hot {
			e.do(p, move(uint32(p.C.X-3), uint32(p.C.Y)), 0)
		} else if p.act.typ != actAttack && !(dodge && b.st == windup && b.atk.ID != "melee") {
			e.do(p, attackMsg(m.ID), 0)
		}
		e.run(1)
		if m.Dead {
			return true
		}
		if p.C.Grave != nil {
			return false
		}
	}
	return false
}
func TestMiniBossRewardsDodging(t *testing.T) {
	a, b := 0, 0
	for s := int64(1); s <= 30; s++ {
		if solo(t, s, true) {
			a++
		}
		if solo(t, s, false) {
			b++
		}
	}
	t.Logf("mini boss solo wins of 30: dodging %d, standing still %d", a, b)
	check(t, a >= 24 && a > b+10, a, b)
}

// --- boat, abuse, appearance
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
	e.do(p, equipMsg(uint32(slices.IndexFunc(p.C.Inv, func(s *Stack) bool { return s != nil && s.ID == "iron_sword" }))), 1)
	check(t, p.C.Equip["weapon"] == nil)
	e.do(p, chatMsg("/give gem_5 5"), 1)
	eq(t, p.count("gem_5"), 0)
	for _, id := range []uint32{0, 1, 2, 0xffffffff, entityID(kindNode, 99999), entityID(kindMonster, 99999), entityID(kindStation, 99999), p.ID} {
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
	json.Unmarshal(e.saved[1], &c)
	eq(t, *c.Look, Look{2, 7})
	l := e.c[2].ents[p.ID].Look
	check(t, l.Cut == 2 && l.Color == 7)
}
func TestOldSavesStillLoad(t *testing.T) {
	e := setup(t)
	old := `{"map":"island","x":32,"y":35,"hp":23,"xp":{"mining":50},"inv":[{"id":"worn_axe","qty":1}],"equip":{},"bank":[],"boat":{},"boatDone":false,"grave":null}`
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
				if v.m != e.w.mapOf(p) || abs(v.f.x-p.C.X) > viewDist || abs(v.f.y-p.C.Y) > viewDist || (v.owner != 0 && v.owner != p.ID) {
					continue
				}
				n++
				g := c.ents[v.id]
				check(t, g != nil, "missing", v.id)
				if int(g.GetX()) != v.f.x || int(g.GetY()) != v.f.y || int(g.GetHp()) != v.f.hp || g.GetAct() != v.f.act || g.GetTarget() != v.f.target || g.GetTool() != v.f.tool || g.GetType() != v.f.typ || g.GetRooted() != v.f.rooted {
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
