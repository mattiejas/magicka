package game

import (
	"fmt"

	"driftwake/content"
)

// NewChar is a character as it starts out.
func NewChar() *Char {
	c := &Char{
		Map:    "island",
		Curve:  currentCurve,
		HP:     MaxHP(1),
		XP:     map[string]int{},
		Inv:    make([]*Stack, content.InvSize),
		Equip:  map[string]*Stack{},
		Bank:   []*Stack{},
		Boat:   map[string]int{},
		Quests: map[string]int{},
	}
	spawn := content.MapByID[c.Map].Spawn
	c.X, c.Y = spawn.X, spawn.Y
	for _, s := range content.Skills {
		c.XP[s] = 0
	}
	for i, id := range []string{"worn_pickaxe", "worn_axe", "worn_sword"} {
		c.Inv[i] = &Stack{id, 1}
	}
	return c
}

// fill completes a character saved by an older version.
func (c *Char) fill() {
	n := NewChar()
	if c.XP == nil {
		c.XP = n.XP
	}
	for len(c.Inv) < content.InvSize {
		c.Inv = append(c.Inv, nil)
	}
	if c.Equip == nil {
		c.Equip = n.Equip
	}
	if c.Bank == nil {
		c.Bank = n.Bank
	}
	if c.Boat == nil {
		c.Boat = n.Boat
	}
	if c.Quests == nil {
		c.Quests = n.Quests
	}
	c.renameItems()
	c.updateXP()
	c.logOwnedTrophies()
	if content.MapByID[c.Map] == nil {
		c.Map, c.X, c.Y = n.Map, n.X, n.Y
	}
}

// Items and boat parts that were renamed, for characters saved before.
var (
	renamedItems = map[string]string{"rudder": "ships_wheel"}
	renamedParts = map[string]string{"rudder": "wheel"}
)

func (c *Char) renameItems() {
	for _, list := range c.everywhere() {
		for _, s := range list {
			if s != nil && renamedItems[s.ID] != "" {
				s.ID = renamedItems[s.ID]
			}
		}
	}
	for old, now := range renamedParts {
		if n, ok := c.Boat[old]; ok {
			c.Boat[now] += n
			delete(c.Boat, old)
		}
	}
}

func (p *Player) level(skill string) int { return LevelForXP(p.C.XP[skill]) }

func (p *Player) count(id string) int {
	n := 0
	for _, s := range p.C.Inv {
		if s != nil && s.ID == id {
			n += s.Qty
		}
	}
	return n
}

// emptySlot is -1 when the inventory is full.
func (p *Player) emptySlot() int {
	for i, s := range p.C.Inv {
		if s == nil {
			return i
		}
	}
	return -1
}

func (p *Player) find(id string) *Stack {
	for _, s := range p.C.Inv {
		if s != nil && s.ID == id {
			return s
		}
	}
	return nil
}

// addTo merges items into a list of stacks, whatever their kind.
func addTo(list []*Stack, id string, qty int) []*Stack {
	for _, s := range list {
		if s.ID == id {
			s.Qty += qty
			return list
		}
	}
	return append(list, &Stack{id, qty})
}

// give adds as many as fit and returns how many were added.
func (p *Player) give(id string, qty int) int {
	if content.Items[id].Stack {
		if s := p.find(id); s != nil {
			s.Qty += qty
		} else if i := p.emptySlot(); i >= 0 {
			p.C.Inv[i] = &Stack{id, qty}
		} else {
			return 0
		}
		return qty
	}
	n := 0
	for i := range p.C.Inv {
		if n == qty {
			break
		}
		if p.C.Inv[i] == nil {
			p.C.Inv[i] = &Stack{id, 1}
			n++
		}
	}
	return n
}

// take is all or nothing.
func (p *Player) take(id string, qty int) bool {
	if p.count(id) < qty {
		return false
	}
	for i, s := range p.C.Inv {
		if qty == 0 {
			break
		}
		if s == nil || s.ID != id {
			continue
		}
		n := min(qty, s.Qty)
		s.Qty -= n
		qty -= n
		if s.Qty == 0 {
			p.C.Inv[i] = nil
		}
	}
	return true
}

// unmet says which level an item still requires, if any.
func (p *Player) unmet(id string) string {
	for _, s := range content.Skills {
		if l := content.Items[id].Req[s]; p.level(s) < l {
			return fmt.Sprintf("You need %s level %d to use that.", s, l)
		}
	}
	return ""
}

// equip wears what is in an inventory slot. It returns why not, if it cannot.
func (p *Player) equip(i int) string {
	s := p.C.Inv[i]
	if s == nil {
		return ""
	}
	item := content.Items[s.ID]
	if item.Slot == "" {
		return "You cannot equip that."
	}
	if why := p.unmet(s.ID); why != "" {
		return why
	}
	p.C.Inv[i] = nil
	old := p.C.Equip[item.Slot]
	if old != nil && old.ID == s.ID && item.Stack {
		old.Qty += s.Qty
		return ""
	}
	p.C.Equip[item.Slot] = s
	if old == nil {
		return ""
	}
	// What comes off joins a stack of its kind, or takes the freed slot.
	if same := p.find(old.ID); same != nil && content.Items[old.ID].Stack {
		same.Qty += old.Qty
	} else {
		p.C.Inv[i] = old
	}
	return ""
}

// unequip returns why not, if it cannot.
func (p *Player) unequip(slot string) string {
	s := p.C.Equip[slot]
	if s == nil {
		return ""
	}
	if p.give(s.ID, s.Qty) < s.Qty {
		return "Your inventory is full."
	}
	delete(p.C.Equip, slot)
	return ""
}

func (p *Player) deposit(id string, qty int) {
	if n := min(qty, p.count(id)); n > 0 && p.take(id, n) {
		p.C.Bank = addTo(p.C.Bank, id, n)
	}
}

func (p *Player) withdraw(id string, qty int) {
	for i, s := range p.C.Bank {
		if s.ID != id {
			continue
		}
		s.Qty -= p.give(id, min(qty, s.Qty))
		if s.Qty == 0 {
			p.C.Bank = append(p.C.Bank[:i:i], p.C.Bank[i+1:]...)
		}
		return
	}
}

// bestTool is the highest tier of usable tool carried, or -1.
func (p *Player) bestTool(kind string) int {
	best := -1
	for _, s := range p.C.Inv {
		if s != nil && content.Items[s.ID].Tool == kind && p.unmet(s.ID) == "" {
			best = max(best, content.Items[s.ID].Tier)
		}
	}
	return best
}
