// Package game is the authoritative simulation. It knows nothing about sockets or databases.
package game

import (
	"math"
	"sync"

	"driftwake/content"
	"driftwake/server/internal/pb"
)

// GameName is the working title. Keep it in step with GAME_NAME in shared/src/content.ts.
const GameName = "Driftwake"

// Store keeps characters. Saving must not block for long.
type Store interface {
	// Save keeps characters by account, all of them or none.
	Save(batch map[int64][]byte)
	// Update changes a saved character that is not in the world.
	Update(account int64, change func(*Char)) error
	// Totals are counts kept for the whole world.
	Total(name string) int64
	AddTotal(name string, n int64)
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
	glows    []*glowGroup
	drops    []*Drop
	dropSeq  int
	occupied map[spot]*Monster
	finder   pathfinder

	queue  []intent          // what players asked for since the last tick
	events []event           // what happened during this tick
	before map[uint32]fields // what every entity looked like on the last tick

	nextBoss                    int
	scheduledBoss               *Monster // the world boss that is up, or that rises next
	npcs                        []*NPC
	npcSeq                      int
	nextEncounter, stampedeEnds int
	feesTaken                   int64 // by graves and the reaper, from everyone, ever
	bossPeriod                  int
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
		feesTaken:  store.Total(feesTotal),

		nextEncounter: Ticks(encounterMin),
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
	w.addHerd()
	w.glows = findGlowGroups(w.nodes)
	w.spreadSpots()
	w.scheduleNextWorldBoss(nil)
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
		start:     Point{X: at.X, Y: at.Y},
		home:      Point{X: at.X, Y: at.Y},
		Dead:      true,
		respawnAt: math.MaxInt,
	}
	monster.restore()
	w.monsters = append(w.monsters, monster)
	if !comesWhenCalled(monster) {
		w.enter(monster)
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

func (w *World) worldBosses() (out []*Monster) {
	for _, m := range w.monsters {
		if monsterIsWorldBoss(m.Def) {
			out = append(out, m)
		}
	}
	return
}

// worldBoss is the world boss that is up, or that rises next.
func (w *World) worldBoss() *Monster { return w.scheduledBoss }

// scheduleNextWorldBoss picks who rises next. With more than one, it never repeats except.
func (w *World) scheduleNextWorldBoss(except *Monster) {
	bosses := w.worldBosses()
	if len(bosses) == 0 {
		w.scheduledBoss = nil
		return
	}
	if except == nil || len(bosses) == 1 {
		w.scheduledBoss = bosses[0]
		return
	}
	var choices []*Monster
	for _, m := range bosses {
		if m != except {
			choices = append(choices, m)
		}
	}
	w.scheduledBoss = choices[int(w.rnd()*float64(len(choices)))]
}

func (w *World) occupy(m *Monster)            { w.occupied[spot{m.Map, m.X, m.Y}] = m }
func (w *World) vacate(m *Monster)            { delete(w.occupied, spot{m.Map, m.X, m.Y}) }
func (w *World) mapOf(p *Player) *content.Map { return content.MapByID[p.C.Map] }

// safe reports whether a player is in town, where nothing attacks.
func (w *World) safe(p *Player) bool { return w.inTown(w.mapOf(p), p.C.X, p.C.Y) }

func (w *World) inTown(m *content.Map, x, y int) bool {
	return m.Safe.R > 0 && math.Hypot(float64(x-m.Safe.X), float64(y-m.Safe.Y)) <= float64(m.Safe.R)
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
