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
	gear                        [5]string
	look                        Look
	rooted                      bool
	boss, glowing, rich         bool
	wants                       string
	bossSt                      pb.BossState
	bossStart                   int
}

// view is an entity as clients see it on this tick.
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

func u32(v int) *uint32 {
	n := uint32(max(0, v))
	return &n
}

func (v *view) bossView() *pb.BossView {
	b := &pb.BossView{
		State:  v.boss.st,
		Tiles:  flat(v.boss.tiles),
		Start:  uint32(v.boss.start),
		End:    uint32(v.boss.end),
		Target: v.boss.tgt,
	}
	if v.boss.atk != nil {
		b.Attack = v.boss.atk.ID
	}
	return b
}

func (f *fields) pbGear() *pb.Gear {
	return &pb.Gear{Weapon: f.gear[0], Head: f.gear[1], Body: f.gear[2], Legs: f.gear[3], Cape: f.gear[4]}
}

func (f *fields) pbLook() *pb.Look {
	return &pb.Look{Cut: uint32(f.look.Cut), Color: uint32(f.look.Color)}
}

// fullBytes encodes everything about an entity, for clients that do not know it.
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
		case kindNode:
			if f.glowing {
				e.Glowing = &f.glowing
			}
			if f.rich {
				e.Rich = &f.rich
			}
		case kindNPC:
			e.Type, e.Wants = &f.typ, &f.wants
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
	if f.rich != o.rich {
		e.Rich = &f.rich
	}
	if f.glowing != o.glowing {
		e.Glowing = &f.glowing
	}
	if v.boss != nil && (f.bossSt != o.bossSt || f.bossStart != o.bossStart) {
		e.Boss = v.bossView()
	}
	v.delta, _ = proto.Marshal(e)
}

// views describes everything clients can see.
func (w *World) views() (out []*view) {
	for _, p := range w.order {
		out = append(out, w.playerView(p))
	}
	for _, m := range w.monsters {
		if !m.Dead {
			out = append(out, monsterView(m))
		}
	}
	for _, n := range w.nodes {
		glowing, rich := n.isGlowing(w.Tick), n.isRich(w.Tick)
		if glowing || rich || n.depletedUntil > w.Tick {
			out = append(out, &view{id: n.ID, m: n.Map, f: fields{x: n.X, y: n.Y, glowing: glowing, rich: rich}})
		}
	}
	for _, n := range w.npcs {
		f := fields{x: n.X, y: n.Y, typ: n.Kind, wants: n.wants}
		out = append(out, &view{id: n.ID, m: n.Map, owner: n.owner, f: f})
	}
	for _, d := range w.drops {
		v := &view{id: d.ID, m: d.Map, f: fields{x: d.X, y: d.Y, typ: d.Item, qty: d.Qty}}
		if !d.visibleTo(0, w.Tick) {
			v.owner = d.Owner
		}
		out = append(out, v)
	}
	return
}

func (w *World) playerView(p *Player) *view {
	f := fields{
		x:      p.C.X,
		y:      p.C.Y,
		name:   p.Name,
		hp:     p.C.HP,
		maxHP:  MaxHP(p.level("vitality")),
		act:    p.doing,
		tool:   p.tool,
		rooted: p.isRooted(w.Tick),
		look:   p.look(),
		level:  max(p.level(melee), p.level(ranged), p.level(magic)),
	}
	if p.act.hasTarget() {
		f.target = p.act.id
	}
	for i, slot := range shownSlots {
		if e := p.C.Equip[slot]; e != nil {
			f.gear[i] = e.ID
		}
	}
	return &view{id: p.ID, m: w.mapOf(p), via: p.via, f: f}
}

func (a action) hasTarget() bool {
	switch a.typ {
	case actGather, actStation, actAttack, actPickup, actTrade, actNPC:
		return true
	}
	return false
}

func monsterView(m *Monster) *view {
	f := fields{
		x:      m.X,
		y:      m.Y,
		typ:    m.Def.ID,
		hp:     int(math.Ceil(m.HP)),
		maxHP:  int(m.MaxHP),
		target: m.target,
	}
	if m.boss != nil {
		f.boss, f.bossSt, f.bossStart = true, m.boss.st, m.boss.start
	}
	return &view{id: m.ID, m: m.Map, via: m.via, boss: m.boss, f: f}
}

// sendSnapshots tells every client what changed around its player.
func (w *World) sendSnapshots() {
	visible := w.changedViews()
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
		p.conn.SendRaw(w.snapshotFor(p, visible[w.mapOf(p)], events))
		if w.Tick%bossBarInterval == 0 {
			w.sendBossStatus(p)
		}
	}
	w.events = nil
}

// changedViews encodes what changed since the last tick, once for all clients, and groups it by map.
func (w *World) changedViews() map[*content.Map][]*view {
	views := w.views()
	now := make(map[uint32]fields, len(views))
	byMap := map[*content.Map][]*view{}
	for _, v := range views {
		if before, ok := w.before[v.id]; ok {
			v.diff(&before)
		}
		now[v.id] = v.f
		byMap[v.m] = append(byMap[v.m], v)
	}
	w.before = now
	return byMap
}

// snapshotFor builds a ServerMessage by hand, so that entities encoded once can be shared between clients.
func (w *World) snapshotFor(p *Player, views []*view, events [][]byte) []byte {
	var s snapshotWriter
	s.number(fieldTick, uint64(w.Tick))
	s.number(fieldMap, uint64(pbMap(p.C.Map)))
	if p.knownMap != p.C.Map {
		clear(p.known)
		p.knownMap = p.C.Map
		s.number(fieldReset, 1)
	}
	for _, v := range views {
		if v.visibleTo(p) {
			w.writeView(&s, p, v)
		}
	}
	w.writeGrave(&s, p)
	for id, heard := range p.known {
		if heard != w.Tick {
			s.number(fieldGone, uint64(id))
			delete(p.known, id)
		}
	}
	for i, e := range w.events {
		if e.mp == w.mapOf(p) && RectDist(e.x, e.y, tile(p.C.X, p.C.Y)) <= viewDistance {
			s.message(fieldEvents, events[i])
		}
	}
	return protowire.AppendBytes(protowire.AppendTag(nil, fieldSnapshot, protowire.BytesType), s.b)
}

func (v *view) visibleTo(p *Player) bool {
	near := abs(v.f.x-p.C.X) <= viewDistance && abs(v.f.y-p.C.Y) <= viewDistance
	return near && (v.owner == 0 || v.owner == p.ID)
}

// writeView sends what changed about an entity the client saw on the last tick, or everything about a new one.
func (w *World) writeView(s *snapshotWriter, p *Player, v *view) {
	if heard, ok := p.known[v.id]; !ok || heard != w.Tick-1 {
		s.message(fieldEntities, v.fullBytes())
	} else if v.delta != nil {
		s.message(fieldEntities, v.delta)
	}
	p.known[v.id] = w.Tick
}

// writeGrave shows a player their own grave, wherever it is on the map.
func (w *World) writeGrave(s *snapshotWriter, p *Player) {
	g := p.C.Grave
	if g == nil || g.Map != p.C.Map {
		return
	}
	at := Point{X: g.X, Y: g.Y}
	if _, ok := p.known[graveID]; !ok || p.graveAt != at {
		grave, _ := proto.Marshal(&pb.Entity{Id: graveID, Full: true, X: u32(g.X), Y: u32(g.Y)})
		s.message(fieldEntities, grave)
		p.graveAt = at
	}
	p.known[graveID] = w.Tick
}

// Field numbers of Snapshot, and of the snapshot in ServerMessage. A test keeps them in step with game.proto.
const (
	fieldTick     protowire.Number = 1
	fieldMap      protowire.Number = 2
	fieldReset    protowire.Number = 3
	fieldEntities protowire.Number = 4
	fieldGone     protowire.Number = 5
	fieldEvents   protowire.Number = 6
	fieldSnapshot protowire.Number = 5
)

type snapshotWriter struct{ b []byte }

func (s *snapshotWriter) number(field protowire.Number, v uint64) {
	s.b = protowire.AppendVarint(protowire.AppendTag(s.b, field, protowire.VarintType), v)
}

func (s *snapshotWriter) message(field protowire.Number, encoded []byte) {
	s.b = protowire.AppendBytes(protowire.AppendTag(s.b, field, protowire.BytesType), encoded)
}
