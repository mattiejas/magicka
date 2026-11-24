package game

import (
	"driftwake/content"
	"driftwake/server/internal/pb"
)

// Entity ids carry their kind in the low three bits.
const (
	kindPlayer uint32 = iota + 1
	kindMonster
	kindNode
	kindDrop
	kindGrave
	kindStation
)

func entityID(kind uint32, n int) uint32 { return uint32(n)<<3 | kind }
func PlayerID(account int64) uint32      { return entityID(kindPlayer, int(account)) }

const graveID = kindGrave

type Stack struct {
	ID  string `json:"id"`
	Qty int    `json:"qty"`
}
type Grave struct {
	Map   string   `json:"map"`
	X     int      `json:"x"`
	Y     int      `json:"y"`
	Items []*Stack `json:"items"`
}
type Look struct {
	Cut   int `json:"cut"`
	Color int `json:"color"`
}

// Char is everything saved about a character.
type Char struct {
	Map      string            `json:"map"`
	X        int               `json:"x"`
	Y        int               `json:"y"`
	HP       int               `json:"hp"`
	XP       map[string]int    `json:"xp"`
	Inv      []*Stack          `json:"inv"`
	Equip    map[string]*Stack `json:"equip"`
	Bank     []*Stack          `json:"bank"`
	Boat     map[string]int    `json:"boat"`
	BoatDone bool              `json:"boatDone"`
	Grave    *Grave            `json:"grave"`
	Look     *Look             `json:"look"`
}

type actionType int

const (
	actNone actionType = iota
	actMove
	actGather
	actStation
	actAttack
	actPickup
	actGrave
	actCraft
)

type action struct {
	typ    actionType
	id     uint32 // gather, station, attack, pickup
	x, y   int    // move
	recipe *content.Recipe
	left   int
}

// Conn is a player's connection. Both calls must not block.
type Conn interface {
	Send(m *pb.ServerMessage)
	SendRaw(b []byte)
}

type Player struct {
	ID         uint32
	Account    int64
	Name       string
	C          *Char
	act        action
	path       []Point
	via        []Point
	nextAct    int
	nextAttack int
	rooted     int
	lastCombat int
	dirty      bool
	conn       Conn
	leftAt     int // tick of disconnecting, or -1
	known      map[uint32]int
	knownMap   string
	graveAt    Point
	doing      string
	tool       string
}

type bossState struct {
	st         pb.BossState
	atk        *content.Attack
	tiles      []Point
	start, end int
	tgt        uint32
}

// tally is a small map that remembers insertion order.
type tally[V any] struct {
	ids []uint32
	m   map[uint32]V
}

func (t *tally[V]) get(id uint32) V { return t.m[id] }
func (t *tally[V]) set(id uint32, v V) {
	if t.m == nil {
		t.m = map[uint32]V{}
	}
	if _, ok := t.m[id]; !ok {
		t.ids = append(t.ids, id)
	}
	t.m[id] = v
}
func (t *tally[V]) del(id uint32) {
	if _, ok := t.m[id]; !ok {
		return
	}
	delete(t.m, id)
	for i, v := range t.ids {
		if v == id {
			t.ids = append(t.ids[:i:i], t.ids[i+1:]...)
			break
		}
	}
}
func (t *tally[V]) len() int { return len(t.ids) }
func (t *tally[V]) clear()   { t.ids, t.m = nil, nil }

type Monster struct {
	ID         uint32
	Def        *content.Monster
	Map        *content.Map
	X, Y       int
	sx, sy     int
	HP, MaxHP  float64
	Dead       bool
	respawnAt  int
	target     uint32
	nextAttack int
	via        []Point
	dmg        tally[float64]
	active     tally[int]
	boss       *bossState
}

func (m *Monster) rect() Rect { return Rect{m.X, m.Y, m.Def.Size, m.Def.Size} }

type Node struct {
	ID            uint32
	Def           *content.Node
	Map           *content.Map
	X, Y          int
	depletedUntil int
}
type Drop struct {
	ID                uint32
	Map               *content.Map
	X, Y              int
	Item              string
	Qty               int
	Owner             uint32
	publicAt, expires int
}
type event struct {
	mp   *content.Map
	x, y int
	ev   *pb.Event
}
