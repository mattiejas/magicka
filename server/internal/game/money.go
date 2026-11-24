package game

import (
	"fmt"
	"slices"

	"driftwake/content"
)

const coin = "coin"

// coinsText is an amount as players read it.
func coinsText(amount int) string {
	if amount == 1 {
		return "1 coin"
	}
	return fmt.Sprintf("%d coins", amount)
}

// funds are the stacks of coins a player can pay fees with, in the order they are used.
func (p *Player) funds() []*Stack {
	lists := [][]*Stack{p.C.Inv, p.C.Bank}
	if p.C.Grave != nil {
		lists = append(lists, p.C.Grave.Items)
	}
	var out []*Stack
	for _, list := range lists {
		for _, s := range list {
			if s != nil && s.ID == coin {
				out = append(out, s)
			}
		}
	}
	return out
}

func (p *Player) canSpend() int {
	total := 0
	for _, s := range p.funds() {
		total += s.Qty
	}
	return total
}

// spend takes coins a player is known to have.
func (p *Player) spend(amount int) {
	for _, s := range p.funds() {
		n := min(amount, s.Qty)
		s.Qty -= n
		amount -= n
	}
	p.C.Bank = withoutEmpty(p.C.Bank)
	for i, s := range p.C.Inv {
		if s != nil && s.Qty == 0 {
			p.C.Inv[i] = nil
		}
	}
}

func withoutEmpty(list []*Stack) []*Stack {
	return slices.DeleteFunc(list, func(s *Stack) bool { return s.Qty == 0 })
}

// room is how many of an item still fit in the inventory, up to limit.
func (p *Player) room(id string, limit int) int {
	if content.Items[id].Stack {
		if p.find(id) != nil || p.emptySlot() >= 0 {
			return limit
		}
		return 0
	}
	free := 0
	for _, s := range p.C.Inv {
		if s == nil {
			free++
		}
	}
	return min(free, limit)
}
