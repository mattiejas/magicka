package game

import (
	"driftwake/content"
	"driftwake/server/internal/pb"
)

// Entity ids carry their kind in the low bits. client/src/net/wire.ts decodes them.
const (
	kindBits = 3
	kindMask = 1<<kindBits - 1
)

const (
	kindPlayer uint32 = iota + 1
	kindMonster
	kindNode
	kindDrop
	kindGrave
	kindStation
	kindNPC
)

func entityID(kind uint32, n int) uint32 { return uint32(n)<<kindBits | kind }

func accountOf(player uint32) int64 { return int64(player >> kindBits) }

func PlayerID(account int64) uint32 { return entityID(kindPlayer, int(account)) }

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
	Curve    int               `json:"xpCurve"` // the experience table XP was earned with
	Inv      []*Stack          `json:"inv"`
	Equip    map[string]*Stack `json:"equip"`
	Bank     []*Stack          `json:"bank"`
	Boat     map[string]int    `json:"boat"`
	BoatDone bool              `json:"boatDone"`
	Grave    *Grave            `json:"grave"`
	Kept     []*Stack          `json:"kept,omitempty"` // uniques nobody picked up, waiting with the reaper
	Look     *Look             `json:"look"`
	Quests   map[string]int    `json:"quests"`          // steps done
	Found    map[string]int    `json:"found,omitempty"` // the collection log: how often, by logKey
	Kills    map[string]int    `json:"kills,omitempty"` // loot-earning kills, by boss id
	// Ticks of really playing, and how many there were when a genie last came.
	PlayTicks int      `json:"playTicks"`
	GenieAt   int      `json:"genieAt"`
	Blocked   []string `json:"blocked,omitempty"` // names of players not to hear from
	Deaths    int      `json:"deaths,omitempty"`  // counted since November 2026, for seeing where new players stop
	// The fight back setting is off. Stored the other way round, so that every character starts with it on.
	NoFightBack bool `json:"noFightBack,omitempty"`
}

type actionType int

const (
	actNone actionType = iota
	actMove
	actGather
	actStation
	actAttack
	actPickup
	actPickupAll
	actGrave
	actCraft
	actTrade
	actNPC
)

// action is what a player is doing over several ticks.
type action struct {
	typ    actionType
	id     uint32          // target of gather, station, attack, pickup and trade
	at     Point           // tile of pickup all
	recipe *content.Recipe // of craft
	left   int             // items still to craft
	// Cooking one item at a time, and the tick at which the item on the fire is done. Zero means none is on.
	intense   bool
	fireReady int
}

// Conn is a player's connection. Both calls must not block.
type Conn interface {
	Send(m *pb.ServerMessage)
	SendRaw(b []byte)
}

// connected is the value of leftAt while a player has a connection.
const connected = -1

type Player struct {
	ID      uint32
	Account int64
	Name    string
	C       *Char

	act        action
	path       []Point
	via        []Point // tiles walked this tick
	nextAct    int     // tick of the next attempt at work
	lastInput  int     // tick of the last message
	trade      *trade  // open with someone
	asked      request // to trade
	lastGlow   glow    // the last one that gave its bonus
	nextAttack int
	rooted     int    // tick until which the player cannot walk
	lastCombat int    // tick of the last blow given or taken
	doing      string // what others see
	tool       string // item id of the tool in hand

	conn     Conn
	leftAt   int            // tick of disconnecting
	told     *pb.Self       // the last one this connection was sent
	known    map[uint32]int // entities the client knows, and the tick it last heard of them
	knownMap string
	graveAt  Point // where the client thinks the grave is
}

func (p *Player) at() Point { return Point{X: p.C.X, Y: p.C.Y} }

// bossState is the attack a boss is choosing, winding up or executing.
type bossState struct {
	st         pb.BossState
	atk        *content.Attack
	tiles      []Point // marked ground, all strikes together
	centres    []Point // where the attack is aimed
	strikes    []strike
	start, end int    // ticks
	tgt        uint32 // of melee
}

// tally is a small map that remembers insertion order.
type tally[V any] struct {
	ids []uint32
	m   map[uint32]V
}

func (t *tally[V]) has(id uint32) bool {
	_, ok := t.m[id]
	return ok
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

func (t *tally[V]) clear() { t.ids, t.m = nil, nil }

type Monster struct {
	ID         uint32
	Def        *content.Monster
	Map        *content.Map
	X, Y       int
	home       Point
	start      Point // where it first stood
	HP, MaxHP  float64
	Dead       bool
	respawnAt  int
	target     uint32
	nextAttack int
	via        []Point
	damage     tally[float64] // by player: hit points, or for bosses a share of their health
	active     tally[int]     // boss fighters, and the tick of their last blow
	boss       *bossState
}

func (m *Monster) rect() Rect { return Rect{m.X, m.Y, m.Def.Size, m.Def.Size} }

type Node struct {
	ID            uint32
	Def           *content.Node
	Map           *content.Map
	X, Y          int
	depletedUntil int
	glowingUntil  int
	richUntil     int
	places        []*Node // of a spot that moves: the nodes of its group, itself among them
}

func (n *Node) rect() Rect { return Rect{n.X, n.Y, n.Def.Size, n.Def.Size} }

func (n *Node) isRich(tick int) bool { return n.richUntil > tick }

func (n *Node) isGlowing(tick int) bool { return n.glowingUntil > tick }

type Drop struct {
	ID                uint32
	Map               *content.Map
	X, Y              int
	Item              string
	Qty               int
	Owner             uint32
	kept              bool // goes to the reaper instead of becoming public
	personal          bool // never becomes public
	publicAt, expires int
}

type event struct {
	mp   *content.Map
	x, y int
	ev   *pb.Event
}
