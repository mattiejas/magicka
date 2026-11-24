package game

import (
	"math"

	"driftwake/content"
	"driftwake/server/internal/pb"

	"google.golang.org/protobuf/encoding/protowire"
	"google.golang.org/protobuf/proto"
)

// fields is everything about an entity that can change, in a comparable form.
type fields struct {
	x, y, hp, maxHP, level, qty int
	name, typ, act, tool        string
	target                      uint32
	gear                        [4]string
	look                        Look
	rooted                      bool
	boss                        bool
	bossSt                      pb.BossState
	bossStart                   int
}
type view struct {
	id    uint32
	m     *content.Map
	owner uint32 // 0 when everyone may see it
	f     fields
	via   []Point
	boss  *bossState
	delta []byte
	full  []byte
}

func u32(v int) *uint32 { n := uint32(max(0, v)); return &n }

func (v *view) bossView() *pb.BossView {
	b := &pb.BossView{State: v.boss.st, Tiles: flat(v.boss.tiles), Start: uint32(v.boss.start), End: uint32(v.boss.end), Target: v.boss.tgt}
	if v.boss.atk != nil {
		b.Attack = v.boss.atk.ID
	}
	return b
}
func (f *fields) pbGear() *pb.Gear {
	return &pb.Gear{Weapon: f.gear[0], Head: f.gear[1], Body: f.gear[2], Legs: f.gear[3]}
}
func (f *fields) pbLook() *pb.Look {
	return &pb.Look{Cut: uint32(f.look.Cut), Color: uint32(f.look.Color)}
}

func (v *view) fullBytes() []byte {
	if v.full == nil {
		f := &v.f
		e := &pb.Entity{Id: v.id, Full: true, X: u32(f.x), Y: u32(f.y)}
		switch v.id & 7 {
		case kindPlayer:
			e.Name, e.Gear, e.Look, e.Level = &f.name, f.pbGear(), f.pbLook(), u32(f.level)
			e.Hp, e.MaxHp = u32(f.hp), u32(f.maxHP)
			if f.act != "" {
				e.Act = &f.act
			}
			if f.tool != "" {
				e.Tool = &f.tool
			}
			if f.rooted {
				e.Rooted = &f.rooted
			}
		case kindMonster:
			e.Type, e.Hp, e.MaxHp = &f.typ, u32(f.hp), u32(f.maxHP)
			if v.boss != nil {
				e.Boss = v.bossView()
			}
		case kindDrop:
			e.Type, e.Qty = &f.typ, u32(f.qty)
		}
		if f.target != 0 {
			e.Target = &f.target
		}
		v.full, _ = proto.Marshal(e)
	}
	return v.full
}

// diff encodes what changed since the previous tick, or nothing.
func (v *view) diff(o *fields) {
	f := &v.f
	if *f == *o && v.via == nil {
		return
	}
	e := &pb.Entity{Id: v.id, Via: flat(v.via)}
	if f.x != o.x {
		e.X = u32(f.x)
	}
	if f.y != o.y {
		e.Y = u32(f.y)
	}
	if f.hp != o.hp {
		e.Hp = u32(f.hp)
	}
	if f.maxHP != o.maxHP {
		e.MaxHp = u32(f.maxHP)
	}
	if f.level != o.level {
		e.Level = u32(f.level)
	}
	if f.act != o.act {
		e.Act = &f.act
	}
	if f.tool != o.tool {
		e.Tool = &f.tool
	}
	if f.target != o.target {
		e.Target = &f.target
	}
	if f.gear != o.gear {
		e.Gear = f.pbGear()
	}
	if f.look != o.look {
		e.Look = f.pbLook()
	}
	if f.rooted != o.rooted {
		e.Rooted = &f.rooted
	}
	if v.boss != nil && (f.bossSt != o.bossSt || f.bossStart != o.bossStart) {
		e.Boss = v.bossView()
	}
	v.delta, _ = proto.Marshal(e)
}

func (p *Player) look() Look {
	if p.C.Look != nil {
		return *p.C.Look
	}
	h := nameHash(p.Name)
	return Look{Cut: h >> 5 % content.Haircuts, Color: h >> 2 % 5}
}

func (w *World) views() []*view {
	var out []*view
	add := func(v *view) { out = append(out, v) }
	for _, p := range w.order {
		v := &view{id: p.ID, m: w.mapOf(p), via: p.via, f: fields{x: p.C.X, y: p.C.Y, name: p.Name, hp: p.C.HP, maxHP: MaxHP(p.level("vitality")), act: p.doing, tool: p.tool, rooted: p.rooted > w.Tick, look: p.look(), level: max(p.level("melee"), p.level("ranged"), p.level("magic"))}}
		if p.act.typ >= actGather && p.act.typ <= actPickup {
			v.f.target = p.act.id
		}
		for i, s := range slotOrder[:4] {
			if e := p.C.Equip[s]; e != nil {
				v.f.gear[i] = e.ID
			}
		}
		add(v)
	}
	for _, m := range w.monsters {
		if m.Dead {
			continue
		}
		v := &view{id: m.ID, m: m.Map, via: m.via, boss: m.boss, f: fields{x: m.X, y: m.Y, typ: m.Def.ID, hp: int(math.Ceil(m.HP)), maxHP: int(m.MaxHP), target: m.target}}
		if m.boss != nil {
			v.f.boss, v.f.bossSt, v.f.bossStart = true, m.boss.st, m.boss.start
		}
		add(v)
	}
	for _, n := range w.nodes {
		if n.depletedUntil > w.Tick {
			add(&view{id: n.ID, m: n.Map, f: fields{x: n.X, y: n.Y}})
		}
	}
	for _, d := range w.drops {
		v := &view{id: d.ID, m: d.Map, f: fields{x: d.X, y: d.Y, typ: d.Item, qty: d.Qty}}
		if d.publicAt > w.Tick {
			v.owner = d.Owner
		}
		add(v)
	}
	return out
}

func pbMap(id string) pb.MapId {
	if id == "mainland" {
		return pb.MapId_MAP_ID_MAINLAND
	}
	return pb.MapId_MAP_ID_ISLAND
}
func pbStacks(list []*Stack) (out []*pb.Stack) {
	for _, s := range list {
		out = append(out, &pb.Stack{Item: s.ID, Qty: uint32(s.Qty)})
	}
	return
}
func (w *World) self(p *Player) *pb.Self {
	c, l := p.C, p.look()
	s := &pb.Self{Id: p.ID, Name: p.Name, Map: pbMap(c.Map), Xp: map[string]uint32{}, Boat: map[string]uint32{}, BoatDone: c.BoatDone, Bank: pbStacks(c.Bank), Look: &pb.Look{Cut: uint32(l.Cut), Color: uint32(l.Color)}}
	for k, v := range c.XP {
		s.Xp[k] = uint32(v)
	}
	for k, v := range c.Boat {
		s.Boat[k] = uint32(v)
	}
	for i, v := range c.Inv {
		if v != nil {
			s.Inventory = append(s.Inventory, &pb.InvSlot{Index: uint32(i), Stack: &pb.Stack{Item: v.ID, Qty: uint32(v.Qty)}})
		}
	}
	for i := pb.Slot_SLOT_WEAPON; i <= pb.Slot_SLOT_AMMO; i++ {
		if e := c.Equip[slotName(i)]; e != nil {
			s.Equipment = append(s.Equipment, &pb.EquipSlot{Slot: i, Stack: &pb.Stack{Item: e.ID, Qty: uint32(e.Qty)}})
		}
	}
	if c.Grave != nil {
		s.Reaper = pbStacks(c.Grave.Items)
	}
	return s
}

func (w *World) snapshot() {
	views := w.views()
	now := make(map[uint32]fields, len(views))
	byMap := map[*content.Map][]*view{}
	for _, v := range views {
		if o, ok := w.prev[v.id]; ok {
			v.diff(&o)
		}
		now[v.id] = v.f
		byMap[v.m] = append(byMap[v.m], v)
	}
	w.prev = now
	events := make([][]byte, len(w.events))
	for i, e := range w.events {
		events[i], _ = proto.Marshal(e.ev)
	}
	for _, p := range w.order {
		if p.conn == nil {
			continue
		}
		if p.dirty {
			p.dirty = false
			w.send(p, &pb.ServerMessage{Msg: &pb.ServerMessage_Self{Self: w.self(p)}})
		}
		m := w.mapOf(p)
		b := make([]byte, 0, 1024)
		b = protowire.AppendVarint(protowire.AppendTag(b, 1, protowire.VarintType), uint64(w.Tick))
		b = protowire.AppendVarint(protowire.AppendTag(b, 2, protowire.VarintType), uint64(pbMap(p.C.Map)))
		if p.knownMap != p.C.Map {
			clear(p.known)
			p.knownMap = p.C.Map
			b = protowire.AppendVarint(protowire.AppendTag(b, 3, protowire.VarintType), 1)
		}
		ent := func(e []byte) { b = protowire.AppendBytes(protowire.AppendTag(b, 4, protowire.BytesType), e) }
		for _, v := range byMap[m] {
			if abs(v.f.x-p.C.X) > viewDist || abs(v.f.y-p.C.Y) > viewDist || (v.owner != 0 && v.owner != p.ID) {
				continue
			}
			// Someone seen on the previous tick only needs what changed since then.
			if at, ok := p.known[v.id]; !ok || at != w.Tick-1 {
				ent(v.fullBytes())
			} else if v.delta != nil {
				ent(v.delta)
			}
			p.known[v.id] = w.Tick
		}
		if g := p.C.Grave; g != nil && g.Map == p.C.Map {
			at := Point{X: g.X, Y: g.Y}
			if _, ok := p.known[graveID]; !ok || p.graveAt != at {
				e, _ := proto.Marshal(&pb.Entity{Id: graveID, Full: true, X: u32(g.X), Y: u32(g.Y)})
				ent(e)
				p.graveAt = at
			}
			p.known[graveID] = w.Tick
		}
		for id, at := range p.known {
			if at != w.Tick {
				b = protowire.AppendVarint(protowire.AppendTag(b, 5, protowire.VarintType), uint64(id))
				delete(p.known, id)
			}
		}
		for i, e := range w.events {
			if e.mp == m && RectDist(e.x, e.y, tile(p.C.X, p.C.Y)) <= viewDist {
				b = protowire.AppendBytes(protowire.AppendTag(b, 6, protowire.BytesType), events[i])
			}
		}
		p.conn.SendRaw(protowire.AppendBytes(protowire.AppendTag(nil, 5, protowire.BytesType), b))
		if w.Tick%5 == 0 {
			w.bossInfo(p)
		}
	}
	w.events = nil
}
