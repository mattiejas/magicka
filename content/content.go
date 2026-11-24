// Package content loads the game data that the browser also uses.
// The JSON is generated from content/src by `npm run content`.
package content

import (
	"embed"
	"encoding/json"
	"fmt"
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
	Req                               map[string]int
}

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
	XP, Respawn, Deplete              float64
}

// HasGems reports whether gathering sometimes turns up a gem.
func (n *Node) HasGems() bool { return n.Kind == "rock" && n.ID != "essence_rock" }

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
	Blocked                 []bool `json:"-"`
}

func (m *Map) Walkable(x, y int) bool {
	return x >= 0 && y >= 0 && x < m.Size && y < m.Size && !m.Blocked[y*m.Size+x]
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
	BoatParts, Metals, Haircuts, HairColors = d.BoatParts, d.Metals, len(d.Haircuts), len(d.HairColors)
	must(json.Unmarshal(Raw("maps.json"), &Maps))
	for _, m := range Maps {
		MapByID[m.ID] = m
		m.Blocked = make([]bool, m.Size*m.Size)
		for y, row := range m.Rows {
			for x := range row {
				m.Blocked[y*m.Size+x] = row[x] == '0'
			}
		}
		for _, l := range [][]Placed{m.Nodes, m.Stations} {
			for _, o := range l {
				m.Blocked[o.Y*m.Size+o.X] = true
			}
		}
	}
}

func must(err error) {
	if err != nil {
		panic(err)
	}
}
