// Package game is the authoritative simulation. It knows nothing about sockets or databases.
package game

import (
	"encoding/json"
	"math"
	"strconv"
	"strings"
	"sync"

	"driftwake/content"
	"driftwake/server/internal/pb"
)

const (
	GameName = "Magicka" // keep in step with GAME_NAME in shared/src/content.ts
	viewDist = 24
)

var linger = Ticks(30)

// Store keeps characters. Save must not block for long.
type Store interface {
	Save(account int64, data []byte)
}
type occKey struct {
	m    *content.Map
	x, y int
}
type intent struct {
	id uint32
	m  *pb.ClientMessage
}

type World struct {
	mu         sync.Mutex
	Tick       int
	players    map[uint32]*Player
	order      []*Player
	monsters   []*Monster
	nodes      []*Node
	drops      []*Drop
	queue      []intent
	events     []event
	seq        int
	occ        map[occKey]*Monster
	stations   []station
	finder     pathfinder
	nextBoss   int
	bossPeriod int
	store      Store
	rnd        func() float64
	dev        bool
	prev       map[uint32]fields
}
type station struct {
	m *content.Map
	s *content.Placed
}

func NewWorld(store Store, rnd func() float64, dev bool, bossPeriod int) *World {
	w := &World{players: map[uint32]*Player{}, occ: map[occKey]*Monster{}, store: store, rnd: rnd, dev: dev, bossPeriod: bossPeriod, nextBoss: bossPeriod, prev: map[uint32]fields{}}
	for _, m := range content.Maps {
		for _, n := range m.Nodes {
			w.nodes = append(w.nodes, &Node{ID: entityID(kindNode, len(w.nodes)), Def: content.Nodes[n.Type], Map: m, X: n.X, Y: n.Y})
		}
		for i := range m.Stations {
			w.stations = append(w.stations, station{m, &m.Stations[i]})
		}
		for _, s := range m.Spawns {
			d := content.Monsters[s.Type]
			mo := &Monster{ID: entityID(kindMonster, len(w.monsters)), Def: d, Map: m, X: s.X, Y: s.Y, sx: s.X, sy: s.Y, HP: d.HP, MaxHP: d.HP, Dead: d.Boss != nil && d.Boss.World, respawnAt: math.MaxInt}
			if d.Boss != nil {
				resetBoss(mo)
			}
			w.monsters = append(w.monsters, mo)
			if !mo.Dead {
				w.occ[occKey{m, s.X, s.Y}] = mo
			}
		}
	}
	return w
}

func lookup[T any](list []*T, kind, id uint32) *T {
	if id&7 != kind || int(id>>3) >= len(list) {
		return nil
	}
	return list[id>>3]
}
func (w *World) worldBoss() *Monster {
	for _, m := range w.monsters {
		if m.Def.Boss != nil && m.Def.Boss.World {
			return m
		}
	}
	return nil
}

// --- connections

// Join puts a character in the world, or hands over one that is still there. load runs only when needed, under the world's lock.
func (w *World) Join(account int64, name string, load func() (*Char, error), conn Conn) (uint32, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	id := PlayerID(account)
	p := w.players[id]
	fresh := false
	if p != nil {
		if p.conn != nil {
			p.conn.Send(&pb.ServerMessage{Msg: &pb.ServerMessage_Kicked{Kicked: "You logged in somewhere else."}})
		}
	} else {
		c, err := load()
		if err != nil {
			return 0, err
		}
		if fresh = c == nil; fresh {
			c = NewChar()
		}
		c.fill()
		p = &Player{ID: id, Account: account, Name: name, C: c, lastCombat: -999}
		w.players[id] = p
		w.order = append(w.order, p)
	}
	p.conn, p.leftAt, p.known, p.knownMap, p.dirty = conn, -1, map[uint32]int{}, "", true
	conn.Send(&pb.ServerMessage{Msg: &pb.ServerMessage_Self{Self: w.self(p)}})
	if fresh {
		w.info(p, "Welcome to "+GameName+". Click a copper rock or an ash tree to begin.", 0)
	}
	w.bossInfo(p)
	return id, nil
}

// Leave detaches a connection, if it still owns the player.
func (w *World) Leave(id uint32, conn Conn) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if p := w.players[id]; p != nil && p.conn == conn {
		p.conn, p.leftAt = nil, w.Tick
	}
}

// Owns reports whether conn is the player's current connection.
func (w *World) Owns(id uint32, conn Conn) bool {
	w.mu.Lock()
	defer w.mu.Unlock()
	p := w.players[id]
	return p != nil && p.conn == conn
}
func (w *World) Enqueue(id uint32, m *pb.ClientMessage) {
	w.mu.Lock()
	w.queue = append(w.queue, intent{id, m})
	w.mu.Unlock()
}
func (w *World) SaveAll() {
	w.mu.Lock()
	defer w.mu.Unlock()
	for _, p := range w.order {
		w.save(p)
	}
}
func (w *World) Online() int {
	w.mu.Lock()
	defer w.mu.Unlock()
	return len(w.order)
}

func (w *World) save(p *Player) {
	if b, err := json.Marshal(p.C); err == nil {
		w.store.Save(p.Account, b)
	}
}

// --- helpers
func infoMsg(text string, kind pb.InfoKind) *pb.ServerMessage {
	return &pb.ServerMessage{Msg: &pb.ServerMessage_Info{Info: &pb.Info{Text: text, Kind: kind}}}
}
func (w *World) send(p *Player, m *pb.ServerMessage) {
	if p.conn != nil {
		p.conn.Send(m)
	}
}
func (w *World) info(p *Player, text string, kind pb.InfoKind) { w.send(p, infoMsg(text, kind)) }
func (w *World) broadcast(m *pb.ServerMessage) {
	for _, p := range w.order {
		w.send(p, m)
	}
}
func (w *World) emit(m *content.Map, x, y int, ev *pb.Event) {
	w.events = append(w.events, event{m, x, y, ev})
}
func (w *World) hit(m *content.Map, x, y int, from, to uint32, dmg int, style string) {
	w.emit(m, x, y, &pb.Event{Event: &pb.Event_Hit{Hit: &pb.Hit{From: from, To: to, Damage: uint32(dmg), Style: style}}})
}
func (w *World) stop(p *Player)               { p.act, p.path = action{}, nil }
func (w *World) mapOf(p *Player) *content.Map { return content.MapByID[p.C.Map] }
func (w *World) vacate(m *Monster)            { delete(w.occ, occKey{m.Map, m.X, m.Y}) }
func (w *World) safe(p *Player) bool {
	s := w.mapOf(p).Safe
	return math.Hypot(float64(p.C.X-s.X), float64(p.C.Y-s.Y)) <= float64(s.R)
}
func (w *World) addXP(p *Player, skill string, amount float64) {
	before, n := p.level(skill), round(amount)
	p.C.XP[skill] = min(xpTable[MaxLevel], p.C.XP[skill]+n)
	p.dirty = true
	w.send(p, &pb.ServerMessage{Msg: &pb.ServerMessage_Xp{Xp: &pb.Xp{Skill: skill, Amount: uint32(n)}}})
	if now := p.level(skill); now > before {
		w.info(p, strings.ToUpper(skill[:1])+skill[1:]+" is now level "+strconv.Itoa(now)+".", pb.InfoKind_INFO_KIND_LEVEL)
		if skill == "vitality" {
			p.C.HP += 3 * (now - before)
		}
	}
}
func (w *World) drop(m *content.Map, x, y int, item string, qty int, owner uint32, publicAt, expires int) {
	n, each := qty, 1
	if content.Items[item].Stack {
		n, each = 1, qty
	}
	for range n {
		w.seq++
		w.drops = append(w.drops, &Drop{entityID(kindDrop, w.seq), m, x, y, item, each, owner, publicAt, expires})
	}
}
func (w *World) nearStation(p *Player, kind string) bool {
	s := w.mapOf(p).Station(kind)
	return s != nil && inReach(p.C.X, p.C.Y, tile(s.X, s.Y), 2)
}
func (w *World) worldBossDied(m *Monster) {
	w.nextBoss = max(w.nextBoss, w.Tick+1)
	m.respawnAt = math.MaxInt
	w.broadcast(infoMsg(m.Def.Name+" has fallen.", pb.InfoKind_INFO_KIND_BOSS))
}
func (w *World) spawnWorldBoss() {
	m := w.worldBoss()
	if !m.Dead {
		return
	}
	resetBoss(m)
	m.Dead = false
	w.occ[occKey{m.Map, m.X, m.Y}] = m
	w.broadcast(infoMsg(m.Def.Name+" rises in the Rooted arena on the mainland.", pb.InfoKind_INFO_KIND_BOSS))
}
func (w *World) bossInfo(p *Player) {
	m := w.worldBoss()
	w.send(p, &pb.ServerMessage{Msg: &pb.ServerMessage_Boss{Boss: &pb.BossStatus{Alive: !m.Dead, NextTicks: uint32(max(0, w.nextBoss-w.Tick)), Contribution: float32(m.dmg.get(p.ID)), Online: uint32(len(w.order))}}})
}

// --- intents
func (w *World) setAction(p *Player, a action) { p.act, p.path = a, nil }

func slotName(s pb.Slot) string {
	return [...]string{"", "weapon", "head", "body", "legs", "neck", "ammo"}[s]
}

func (w *World) handle(p *Player, msg *pb.ClientMessage) {
	c := p.C
	say := func(s string) {
		if s != "" {
			w.info(p, s, 0)
		}
	}
	switch m := msg.Msg.(type) {
	case *pb.ClientMessage_Move:
		mp, x, y := w.mapOf(p), int(m.Move.X), int(m.Move.Y)
		if x < mp.Size && y < mp.Size {
			w.setAction(p, action{typ: actMove, x: x, y: y})
			p.path = w.finder.find(mp, c.X, c.Y, tile(x, y), 0)
		}
	case *pb.ClientMessage_Gather:
		w.setAction(p, action{typ: actGather, id: m.Gather})
	case *pb.ClientMessage_Station:
		w.setAction(p, action{typ: actStation, id: m.Station})
	case *pb.ClientMessage_Attack:
		w.setAction(p, action{typ: actAttack, id: m.Attack})
	case *pb.ClientMessage_Pickup:
		w.setAction(p, action{typ: actPickup, id: m.Pickup})
	case *pb.ClientMessage_Grave:
		w.setAction(p, action{typ: actGrave})
	case *pb.ClientMessage_Claim:
		if w.nearStation(p, "reaper") {
			w.claimGrave(p)
		}
	case *pb.ClientMessage_Craft:
		if r := content.RecipeByID[m.Craft.Recipe]; r != nil && w.nearStation(p, r.Station) {
			p.nextAct = w.Tick - 2
			w.setAction(p, action{typ: actCraft, recipe: r, left: int(m.Craft.Qty)})
		}
	case *pb.ClientMessage_EquipSlot:
		say(p.equip(int(m.EquipSlot)))
	case *pb.ClientMessage_Unequip:
		say(p.unequip(slotName(m.Unequip)))
	case *pb.ClientMessage_Swap:
		c.Inv[m.Swap.A], c.Inv[m.Swap.B] = c.Inv[m.Swap.B], c.Inv[m.Swap.A]
		p.dirty = true
	case *pb.ClientMessage_EatSlot:
		s := c.Inv[m.EatSlot]
		if s == nil || content.Items[s.ID].Heal == 0 || (p.nextAct > w.Tick && p.doing == "eat") {
			break
		}
		c.Inv[m.EatSlot] = nil
		c.HP = min(MaxHP(p.level("vitality")), c.HP+content.Items[s.ID].Heal)
		p.nextAttack = max(p.nextAttack, w.Tick) + 2
		p.doing, p.nextAct, p.dirty = "eat", w.Tick+2, true
	case *pb.ClientMessage_DropSlot:
		if s := c.Inv[m.DropSlot]; s != nil {
			c.Inv[m.DropSlot] = nil
			p.dirty = true
			w.drop(w.mapOf(p), c.X, c.Y, s.ID, s.Qty, p.ID, w.Tick+Ticks(60), w.Tick+Ticks(180))
		}
	case *pb.ClientMessage_Bank:
		if content.Items[m.Bank.Item] != nil && w.nearStation(p, "bank") {
			if m.Bank.Withdraw {
				p.withdraw(m.Bank.Item, int(m.Bank.Qty))
			} else {
				p.deposit(m.Bank.Item, int(m.Bank.Qty))
			}
			w.save(p)
		}
	case *pb.ClientMessage_DepositAll:
		if w.nearStation(p, "bank") {
			for i := range c.Inv {
				if s := c.Inv[i]; s != nil {
					p.deposit(s.ID, s.Qty)
				}
			}
			w.save(p)
		}
	case *pb.ClientMessage_Boat:
		if !w.nearStation(p, "dock") {
			break
		}
		switch {
		case !m.Boat.Sail:
			if !c.BoatDone {
				w.buildBoat(p)
			}
		case !c.BoatDone:
			w.info(p, "Your boat is not finished.", 0)
		default:
			to := "island"
			if c.Map == "island" {
				to = "mainland"
			}
			w.travel(p, to)
			w.save(p)
		}
	case *pb.ClientMessage_Look:
		c.Look = &Look{int(m.Look.Cut), int(m.Look.Color)}
		p.dirty = true
		w.save(p)
	case *pb.ClientMessage_Chat:
		if w.dev && strings.HasPrefix(m.Chat, "/") {
			w.devCommand(p, strings.Fields(m.Chat[1:]))
		} else {
			w.broadcast(&pb.ServerMessage{Msg: &pb.ServerMessage_Chat{Chat: &pb.Chat{From: p.Name, Text: m.Chat}}})
		}
	}
}

func (w *World) travel(p *Player, to string) {
	l := content.MapByID[to].Landing
	p.C.Map, p.C.X, p.C.Y = to, l.X, l.Y
	w.stop(p)
	p.via, p.dirty = nil, true
}

func (w *World) devCommand(p *Player, args []string) {
	args = append(args, "", "", "")
	a, b := args[1], args[2]
	n, err := strconv.Atoi(b)
	if err != nil || n == 0 {
		n = 1
	}
	n = max(0, min(100000, n))
	switch args[0] {
	case "give":
		if it := content.Items[a]; it != nil {
			p.give(a, n)
		}
	case "level":
		for _, s := range content.Skills {
			if s == a || a == "all" {
				p.C.XP[s] = xpTable[max(1, min(MaxLevel, n))]
			}
		}
	case "tp":
		x, e1 := strconv.Atoi(a)
		y, e2 := strconv.Atoi(b)
		if e1 == nil && e2 == nil && w.mapOf(p).Walkable(x, y) {
			p.C.X, p.C.Y = x, y
			w.stop(p)
		}
	case "map":
		if content.MapByID[a] != nil {
			w.travel(p, a)
		}
	case "boss":
		w.spawnWorldBoss()
	case "heal":
		p.C.HP = MaxHP(p.level("vitality"))
	case "die":
		p.C.HP = 1
	}
	p.dirty = true
}

// --- tick
func (w *World) target(p *Player) (r Rect, reach int, ok bool) {
	a, m := p.act, w.mapOf(p)
	switch a.typ {
	case actGather:
		if n := lookup(w.nodes, kindNode, a.id); n != nil && n.Map == m {
			return tile(n.X, n.Y), 1, true
		}
	case actStation:
		if s := w.station(a.id); s != nil && s.m == m {
			return tile(s.s.X, s.s.Y), 1, true
		}
	case actAttack:
		if o := lookup(w.monsters, kindMonster, a.id); o != nil && !o.Dead && o.Map == m {
			return o.rect(), p.stats().reach, true
		}
	case actPickup:
		if d := w.findDrop(a.id); d != nil && d.Map == m && (d.Owner == p.ID || d.publicAt <= w.Tick) {
			return tile(d.X, d.Y), 0, true
		}
	case actGrave:
		if g := p.C.Grave; g != nil && g.Map == p.C.Map {
			return tile(g.X, g.Y), 1, true
		}
	}
	return
}
func (w *World) station(id uint32) *station {
	if id&7 != kindStation || int(id>>3) >= len(w.stations) {
		return nil
	}
	return &w.stations[id>>3]
}
func (w *World) findDrop(id uint32) *Drop {
	for _, d := range w.drops {
		if d.ID == id {
			return d
		}
	}
	return nil
}

func (w *World) actPlayer(p *Player) {
	p.via, p.tool = nil, ""
	if p.doing != "eat" || p.nextAct <= w.Tick {
		p.doing = ""
	}
	c, rooted := p.C, p.rooted > w.Tick
	switch p.act.typ {
	case actNone:
		return
	case actCraft:
		w.craft(p)
		return
	case actMove:
	default:
		r, reach, ok := w.target(p)
		if !ok {
			w.stop(p)
			return
		}
		if !inReach(c.X, c.Y, r, reach) {
			if rooted {
				return
			}
			if len(p.path) == 0 || p.act.typ == actAttack {
				p.path = w.finder.find(w.mapOf(p), c.X, c.Y, r, reach)
			}
			if len(p.path) == 0 {
				w.info(p, "You cannot reach that.", 0)
				w.stop(p)
				return
			}
			w.walk(p)
			if !inReach(c.X, c.Y, r, reach) {
				return
			}
		}
		p.path = nil
		switch p.act.typ {
		case actGather:
			w.gather(p, lookup(w.nodes, kindNode, p.act.id))
		case actAttack:
			w.playerAttack(p, lookup(w.monsters, kindMonster, p.act.id))
		case actStation:
			kind := w.station(p.act.id).s.Type
			w.stop(p)
			w.send(p, &pb.ServerMessage{Msg: &pb.ServerMessage_OpenStation{OpenStation: kind}})
		case actGrave:
			w.stop(p)
			w.claimGrave(p)
		case actPickup:
			w.pickup(p, p.act.id)
		}
		return
	}
	if rooted {
		return
	}
	w.walk(p)
	if len(p.path) == 0 {
		p.act = action{}
	}
}

// walk moves up to two tiles.
func (w *World) walk(p *Player) {
	n := min(2, len(p.path))
	for _, s := range p.path[:n] {
		p.C.X, p.C.Y = s.X, s.Y
		p.via = append(p.via, s)
	}
	p.path = p.path[n:]
}
func (w *World) pickup(p *Player, id uint32) {
	d := w.findDrop(id)
	w.stop(p)
	if p.give(d.Item, d.Qty) < d.Qty {
		w.info(p, "Your inventory is full.", 0)
		return
	}
	for i, o := range w.drops {
		if o == d {
			w.drops = append(w.drops[:i:i], w.drops[i+1:]...)
			break
		}
	}
	w.save(p)
}

// Step advances the world by one tick and sends every player what changed.
func (w *World) Step() {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.Tick++
	q := w.queue
	w.queue = nil
	for _, i := range q {
		if p := w.players[i.id]; p != nil {
			w.handle(p, i.m)
		}
	}
	for _, p := range w.order {
		w.actPlayer(p)
	}
	for _, m := range w.monsters {
		if m.Dead {
			if w.Tick >= m.respawnAt {
				m.Dead, m.X, m.Y, m.HP, m.target, m.via = false, m.sx, m.sy, m.MaxHP, 0, nil
				if m.Def.Boss != nil {
					resetBoss(m)
				}
				w.occ[occKey{m.Map, m.X, m.Y}] = m
			}
			continue
		}
		if m.Def.Boss != nil {
			w.bossAI(m)
		} else {
			w.monsterAI(m)
		}
	}
	if w.Tick >= w.nextBoss {
		w.nextBoss = w.Tick + w.bossPeriod
		w.spawnWorldBoss()
	}
	keep := w.drops[:0]
	for _, d := range w.drops {
		if d.expires > w.Tick {
			keep = append(keep, d)
		}
	}
	clear(w.drops[len(keep):])
	w.drops = keep
	if w.Tick%10 == 0 {
		for _, p := range w.order {
			if mx := MaxHP(p.level("vitality")); p.C.HP < mx {
				p.C.HP = min(mx, p.C.HP+1+mx/60)
				p.dirty = true
			}
		}
	}
	stay := w.order[:0]
	for _, p := range w.order {
		if p.leftAt >= 0 && (w.Tick-p.lastCombat > Ticks(10) || w.Tick-p.leftAt >= linger) {
			w.save(p)
			delete(w.players, p.ID)
			continue
		}
		stay = append(stay, p)
	}
	clear(w.order[len(stay):])
	w.order = stay
	if w.Tick%Ticks(30) == 0 {
		for _, p := range w.order {
			w.save(p)
		}
	}
	w.snapshot()
}
