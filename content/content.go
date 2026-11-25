// Package content loads the game data that the browser also uses.
// The JSON is generated from content/src by `npm run content`.
package content

import (
	"embed"
	"encoding/json"
	"fmt"
	"slices"
)

//go:embed data/*.json
var files embed.FS

// Raw returns a data file, for tests.
func Raw(name string) []byte {
	b, err := files.ReadFile("data/" + name)
	if err != nil {
		panic(err)
	}
	return b
}

type Item struct {
	ID, Name, Slot, Style, Tool, Ammo string
	Tier, Speed, Range, Heal          int
	Acc, Power, Armour                float64
	Stack, Unique                     bool
	Trophy                            bool // can never be traded, sold or dropped
	Bound                             bool // can never be traded or sold
	Basic                             bool // sold in every shop, and never bought back
	Value                             int  // in coins
	Req                               map[string]int
}

// Tradable items can change hands between players.
func (i *Item) Tradable() bool { return !i.Basic && !i.Trophy && !i.Bound }

// Amount is a quantity of one item, written as ["id", n] in the data.
type Amount struct {
	Item string
	Qty  int
}

func (a *Amount) UnmarshalJSON(b []byte) error { return tuple(b, &a.Item, &a.Qty) }

type Recipe struct {
	ID, Out, Station, Skill string
	Qty, Level              int
	XP                      float64
	In                      []Amount
}

// Node is a kind of resource.
type Node struct {
	ID, Name, Kind, Skill, Item, Tool string
	Tier, Level                       int
	Difficulty                        int // skill level that counts as a beginner's
	Interval                          int // ticks between attempts
	Size                              int // width in tiles
	XP, Respawn, Deplete              float64
	Glows                             bool
}

// HasGems reports whether gathering sometimes turns up a gem.
func (n *Node) HasGems() bool { return n.Kind == "rock" && n.Item != "essence" }

// Range is an item with a random quantity.
type Range struct {
	Item     string
	Min, Max int
}

func (r *Range) UnmarshalJSON(b []byte) error { return tuple(b, &r.Item, &r.Min, &r.Max) }

// Rare is an item with a chance to drop.
type Rare struct {
	Item   string
	Qty    int
	Chance float64
}

func (r *Rare) UnmarshalJSON(b []byte) error { return tuple(b, &r.Item, &r.Qty, &r.Chance) }

// Unique is a named item with a chance to drop.
type Unique struct {
	Item   string
	Chance float64
}

func (u *Unique) UnmarshalJSON(b []byte) error { return tuple(b, &u.Item, &u.Chance) }

type Loot struct {
	Always, Common []Range
	Rare           []Rare
	Unique         []Unique
}

// Shapes are the ways in which an attack can mark ground. Melee has none: it has a target.
var Shapes = []string{"square", "cross", "rings"}

type Attack struct {
	ID, Name, Shape              string
	Weight                       float64
	Windup, Execute, Root, Count int
	Damage                       [2]int
}

// CheckAttacks refuses an attack whose shape is missing or unknown, so that none silently hits nobody.
func CheckAttacks(monsters []*Monster) error {
	for _, m := range monsters {
		if m.Boss == nil {
			continue
		}
		for _, a := range m.Boss.Attacks {
			switch {
			case a.ID == "melee" && a.Shape != "":
				return fmt.Errorf("%s: melee %q has no ground to mark, so no shape", m.ID, a.Name)
			case a.ID != "melee" && !slices.Contains(Shapes, a.Shape):
				return fmt.Errorf("%s: attack %q has unknown shape %q", m.ID, a.Name, a.Shape)
			}
		}
	}
	return nil
}

type Boss struct {
	BaseHP  float64
	Regen   float64 // share of full health healed per second
	Arena   int
	World   bool
	Attacks []Attack
}

type Monster struct {
	ID, Name, Style                  string
	Level, Speed, Range, Aggro, Size int
	HP, Acc, Power, Armour, Respawn  float64
	Herd                             bool // only comes with a stampede
	Loot                             Loot
	Boss                             *Boss
}

// Economy sets prices. Percentages are of an item's shop value.
type Economy struct {
	ShopStock                                      []string
	SellPercent, GraveFeePercent, ReaperFeePercent int
}

// Sells reports whether shops have an item in stock.
func (e *Economy) Sells(item string) bool { return slices.Contains(e.ShopStock, item) }

// MethodRules are about ways to train beyond the basic one. They work from a skill level.
type MethodRules struct {
	Level     int
	GlowTicks int     // how long one node of a group glows
	GlowBonus float64 // experience of the first strike on a glowing node, as a multiple of the usual
	GlowGroup int     // fewer nodes than this together do not glow
}

// Need is what a step of a quest asks for. Everything given has to be true.
type Need struct {
	XP   string   // any experience in this skill
	Own  []string // one of these
	Boat string   // this part of the boat, complete
}

type Quest struct {
	ID, Name, Thanks string
	Steps            []struct{ Need Need }
	Reward           []Amount
}

type Part struct {
	ID, Name, Item string
	Qty            int
}

type named struct{ ID, Name string }

// Placed is something at a fixed tile.
type Placed struct {
	ID, Type string
	X, Y     int
}

type Point struct{ X, Y int }

// Passage is where a map's mine entrance leads.
type Passage struct {
	To   string
	X, Y int
}

// Label is a place name drawn on the map.
type Label struct {
	Name string
	X, Y int
}

type Map struct {
	ID, Name string
	Size     int
	Rows     []string
	// Heights is the ground height of each tile, one base 36 digit each. Only the browser draws it.
	Heights []string
	// Walls marks the tiles that are too steep to walk on, one digit each.
	Walls                   []string
	Nodes, Stations, Spawns []Placed
	Spawn, Landing          Point
	Safe                    struct{ X, Y, R int }
	Cave                    bool
	Town                    string // where players wake up after dying here
	Passage                 *Passage
	Methods                 bool // whether methods beyond the basic one are found here
	Labels                  []Label
	Blocked                 []bool `json:"-"`
	Reach                   []bool `json:"-"` // tiles that can be walked to from the spawn
}

func (m *Map) Walkable(x, y int) bool {
	return x >= 0 && y >= 0 && x < m.Size && y < m.Size && !m.Blocked[y*m.Size+x]
}

// CanStep reports whether one step can be taken. A diagonal step may not cut a corner.
func (m *Map) CanStep(x, y, dx, dy int) bool {
	if !m.Walkable(x+dx, y+dy) {
		return false
	}
	return dx == 0 || dy == 0 || (m.Walkable(x+dx, y) && m.Walkable(x, y+dy))
}

// steps are the directions of a step, straight ones first.
var steps = [...]Point{{0, -1}, {1, 0}, {0, 1}, {-1, 0}, {1, -1}, {1, 1}, {-1, 1}, {-1, -1}}

// markReach finds the tiles that can be walked to from the spawn.
func (m *Map) markReach() {
	m.Reach = make([]bool, m.Size*m.Size)
	if !m.Walkable(m.Spawn.X, m.Spawn.Y) {
		return
	}
	m.Reach[m.Spawn.Y*m.Size+m.Spawn.X] = true
	queue := []Point{m.Spawn}
	for len(queue) > 0 {
		at := queue[0]
		queue = queue[1:]
		for _, d := range steps {
			x, y := at.X+d.X, at.Y+d.Y
			if m.CanStep(at.X, at.Y, d.X, d.Y) && !m.Reach[y*m.Size+x] {
				m.Reach[y*m.Size+x] = true
				queue = append(queue, Point{x, y})
			}
		}
	}
}

// CanStandOn reports whether someone can be at a tile and walk to the rest of the map.
func (m *Map) CanStandOn(x, y int) bool { return m.Walkable(x, y) && m.Reach[y*m.Size+x] }

// CanReach reports whether someone can stand within reach of a tile, however many tiles that is.
func (m *Map) CanReach(x, y, reach int) bool {
	for j := y - reach; j <= y+reach; j++ {
		for i := x - reach; i <= x+reach; i++ {
			if m.CanStandOn(i, j) {
				return true
			}
		}
	}
	return false
}

// Nearest is the tile closest to a point on which someone can stand, or the spawn if there is none.
func (m *Map) Nearest(x, y int) Point {
	best, bestDistance := m.Spawn, -1
	for r := 0; r < m.Size && bestDistance < 0; r++ {
		for j := y - r; j <= y+r; j++ {
			for i := x - r; i <= x+r; i++ {
				if max(abs(i-x), abs(j-y)) != r || !m.CanStandOn(i, j) {
					continue
				}
				if d := (i-x)*(i-x) + (j-y)*(j-y); bestDistance < 0 || d < bestDistance {
					best, bestDistance = Point{i, j}, d
				}
			}
		}
	}
	return best
}

func abs(n int) int {
	if n < 0 {
		return -n
	}
	return n
}

func (m *Map) block(x, y, size int) {
	for j := range size {
		for i := range size {
			m.Blocked[(y+j)*m.Size+x+i] = true
		}
	}
}

// Station returns the map's station of a type, or nil.
func (m *Map) Station(kind string) *Placed {
	for i := range m.Stations {
		if m.Stations[i].Type == kind {
			return &m.Stations[i]
		}
	}
	return nil
}

var (
	Items      = map[string]*Item{}
	ItemIDs    []string
	Recipes    []*Recipe
	RecipeByID = map[string]*Recipe{}
	Nodes      = map[string]*Node{}
	Monsters   = map[string]*Monster{}
	BoatParts  []Part
	Prices     Economy
	Methods    MethodRules
	Quests     []*Quest
	Metals     []string
	Haircuts   int
	HairColors int
	Maps       []*Map
	MapByID    = map[string]*Map{}
)

const InvSize = 24

var Skills = []string{
	"mining", "smithing", "woodcutting", "crafting", "melee", "ranged", "magic", "defence", "vitality",
}

func tuple(b []byte, dst ...any) error {
	var raw []json.RawMessage
	if err := json.Unmarshal(b, &raw); err != nil {
		return err
	}
	if len(raw) != len(dst) {
		return fmt.Errorf("want %d values, got %s", len(dst), b)
	}
	for i, d := range dst {
		if err := json.Unmarshal(raw[i], d); err != nil {
			return err
		}
	}
	return nil
}

func init() {
	var d struct {
		Items      []*Item
		Recipes    []*Recipe
		Nodes      []*Node
		Monsters   []*Monster
		BoatParts  []Part
		Metals     []string
		Haircuts   []named
		HairColors []struct{ Name string }
		Economy    Economy
		Methods    MethodRules
		Quests     []*Quest
	}
	must(json.Unmarshal(Raw("content.json"), &d))
	for _, i := range d.Items {
		Items[i.ID] = i
		ItemIDs = append(ItemIDs, i.ID)
	}
	Recipes = d.Recipes
	for _, r := range d.Recipes {
		RecipeByID[r.ID] = r
	}
	for _, n := range d.Nodes {
		Nodes[n.ID] = n
	}
	must(CheckAttacks(d.Monsters))
	for _, m := range d.Monsters {
		Monsters[m.ID] = m
	}
	BoatParts, Metals, Prices, Methods = d.BoatParts, d.Metals, d.Economy, d.Methods
	Quests = d.Quests
	Haircuts, HairColors = len(d.Haircuts), len(d.HairColors)
	must(json.Unmarshal(Raw("maps.json"), &Maps))
	for _, m := range Maps {
		MapByID[m.ID] = m
		m.Blocked = make([]bool, m.Size*m.Size)
		for y, row := range m.Rows {
			for x := range row {
				m.Blocked[y*m.Size+x] = row[x] == '0' || (y < len(m.Walls) && m.Walls[y][x] == '1')
			}
		}
		for _, n := range m.Nodes {
			m.block(n.X, n.Y, Nodes[n.Type].Size)
		}
		for _, s := range m.Stations {
			m.block(s.X, s.Y, 1)
		}
		m.markReach()
	}
}

func must(err error) {
	if err != nil {
		panic(err)
	}
}
