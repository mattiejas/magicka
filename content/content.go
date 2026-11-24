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
	Basic                             bool // sold in every shop, and never bought back
	Value                             int  // in coins
	Req                               map[string]int
}

// Tradable items can change hands between players.
func (i *Item) Tradable() bool { return !i.Basic && !i.Trophy }

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

type Attack struct {
	ID, Name                     string
	Weight                       float64
	Windup, Execute, Root, Count int
	Damage                       [2]int
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

type Map struct {
	ID, Name                string
	Size                    int
	Rows                    []string
	Nodes, Stations, Spawns []Placed
	Spawn, Landing          Point
	Safe                    struct{ X, Y, R int }
	Methods                 bool   // whether methods beyond the basic one are found here
	Blocked                 []bool `json:"-"`
}

func (m *Map) Walkable(x, y int) bool {
	return x >= 0 && y >= 0 && x < m.Size && y < m.Size && !m.Blocked[y*m.Size+x]
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
	for _, m := range d.Monsters {
		Monsters[m.ID] = m
	}
	BoatParts, Metals, Prices, Methods = d.BoatParts, d.Metals, d.Economy, d.Methods
	Haircuts, HairColors = len(d.Haircuts), len(d.HairColors)
	must(json.Unmarshal(Raw("maps.json"), &Maps))
	for _, m := range Maps {
		MapByID[m.ID] = m
		m.Blocked = make([]bool, m.Size*m.Size)
		for y, row := range m.Rows {
			for x := range row {
				m.Blocked[y*m.Size+x] = row[x] == '0'
			}
		}
		for _, n := range m.Nodes {
			m.block(n.X, n.Y, Nodes[n.Type].Size)
		}
		for _, s := range m.Stations {
			m.block(s.X, s.Y, 1)
		}
	}
}

func must(err error) {
	if err != nil {
		panic(err)
	}
}
