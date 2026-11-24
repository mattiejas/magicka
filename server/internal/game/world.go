// Package game is the authoritative simulation. It knows nothing about sockets or databases.
package game

import (
	"math"
	"sync"

	"driftwake/content"
	"driftwake/server/internal/pb"
)

// GameName is the working title. Keep it in step with GAME_NAME in shared/src/content.ts.
const GameName = "Magicka"

// Store keeps characters. Save must not block for long.
type Store interface {
	Save(account int64, data []byte)
}

// spot is a tile of a map.
type spot struct {
	m    *content.Map
	x, y int
}

// intent is a player's message, waiting for the next tick.
type intent struct {
	id uint32
	m  *pb.ClientMessage
}

// World holds everything in play. Exported methods lock it; everything else expects the lock to be held.
type World struct {
	mu    sync.Mutex
	Tick  int
	store Store
	rnd   func() float64
	dev   bool // allows chat commands that change the game

	players  map[uint32]*Player
	order    []*Player // the same players, in the order they joined
	monsters []*Monster
	nodes    []*Node
	stations []station
	drops    []*Drop
	dropSeq  int
	occupied map[spot]*Monster
	finder   pathfinder

	queue  []intent          // what players asked for since the last tick
	events []event           // what happened during this tick
	before map[uint32]fields // what every entity looked like on the last tick

	nextBoss   int
	bossPeriod int
}
type station struct {
	m *content.Map
	s *content.Placed
}

// NewWorld builds the world from the content. A world boss rises every bossPeriod ticks.
func NewWorld(store Store, rnd func() float64, dev bool, bossPeriod int) *World {
	w := &World{
		store:      store,
		rnd:        rnd,
		dev:        dev,
		players:    map[uint32]*Player{},
		occupied:   map[spot]*Monster{},
		before:     map[uint32]fields{},
		nextBoss:   bossPeriod,
		bossPeriod: bossPeriod,
	}
	for _, m := range content.Maps {
		for _, n := range m.Nodes {
			id := entityID(kindNode, len(w.nodes))
			w.nodes = append(w.nodes, &Node{ID: id, Def: content.Nodes[n.Type], Map: m, X: n.X, Y: n.Y})
		}
		for i := range m.Stations {
			w.stations = append(w.stations, station{m, &m.Stations[i]})
		}
		for _, s := range m.Spawns {
			w.addMonster(m, s)
		}
	}
	return w
}

func (w *World) addMonster(m *content.Map, at content.Placed) {
	def := content.Monsters[at.Type]
	monster := &Monster{
		ID:        entityID(kindMonster, len(w.monsters)),
		Def:       def,
		Map:       m,
		X:         at.X,
		Y:         at.Y,
		home:      Point{X: at.X, Y: at.Y},
		HP:        def.HP,
		MaxHP:     def.HP,
		Dead:      monsterIsWorldBoss(def), // world bosses rise on a schedule
		respawnAt: math.MaxInt,
	}
	if def.Boss != nil {
		resetBoss(monster)
	}
	w.monsters = append(w.monsters, monster)
	if !monster.Dead {
		w.occupy(monster)
	}
}

func monsterIsWorldBoss(def *content.Monster) bool { return def.Boss != nil && def.Boss.World }

// lookup finds something by entity id in a list indexed by it. Ids of another kind give nil.
func lookup[T any](list []*T, kind, id uint32) *T {
	if id&kindMask != kind || int(id>>kindBits) >= len(list) {
		return nil
	}
	return list[id>>kindBits]
}

func (w *World) worldBoss() *Monster {
	for _, m := range w.monsters {
		if monsterIsWorldBoss(m.Def) {
			return m
		}
	}
	return nil
}

func (w *World) occupy(m *Monster)            { w.occupied[spot{m.Map, m.X, m.Y}] = m }
func (w *World) vacate(m *Monster)            { delete(w.occupied, spot{m.Map, m.X, m.Y}) }
func (w *World) mapOf(p *Player) *content.Map { return content.MapByID[p.C.Map] }

// safe reports whether a player is in town, where nothing attacks.
func (w *World) safe(p *Player) bool {
	s := w.mapOf(p).Safe
	return math.Hypot(float64(p.C.X-s.X), float64(p.C.Y-s.Y)) <= float64(s.R)
}

func (w *World) nearStation(p *Player, kind string) bool {
	s := w.mapOf(p).Station(kind)
	return s != nil && inReach(p.C.X, p.C.Y, tile(s.X, s.Y), stationReach)
}

func (w *World) station(id uint32) *station {
	if id&kindMask != kindStation || int(id>>kindBits) >= len(w.stations) {
		return nil
	}
	return &w.stations[id>>kindBits]
}

func (w *World) findDrop(id uint32) *Drop {
	for _, d := range w.drops {
		if d.ID == id {
			return d
		}
	}
	return nil
}
