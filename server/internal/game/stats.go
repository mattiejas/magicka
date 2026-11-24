package game

import (
	"driftwake/content"
)

// stats are a player's combat numbers with everything they wear.
type stats struct {
	style              string
	acc, power, armour float64
	speed, reach, tier int
}

// armourSlots are the slots whose numbers count. Ammunition counts when it is used.
var armourSlots = []string{"weapon", "head", "body", "legs", "neck"}

// shownSlots are what others see a player wear.
var shownSlots = []string{"weapon", "head", "body", "legs", "cape"}

func (p *Player) stats() stats {
	s := stats{style: melee, speed: defaultAttackSpeed, reach: defaultAttackReach}
	if wp := p.C.Equip["weapon"]; wp != nil {
		i := content.Items[wp.ID]
		s.style, s.speed, s.reach, s.tier = i.Style, i.Speed, i.Range, i.Tier
	}
	for _, slot := range armourSlots {
		if e := p.C.Equip[slot]; e != nil {
			i := content.Items[e.ID]
			s.acc += i.Acc
			s.power += i.Power
			s.armour += i.Armour
		}
	}
	return s
}

// useAmmo spends equipped ammunition first, then the best carried. ok is false when there is none.
func (p *Player) useAmmo(kind string, maxTier int) (power float64, ok bool) {
	if e := p.C.Equip["ammo"]; e != nil {
		if i := content.Items[e.ID]; i.Ammo == kind && i.Tier <= maxTier {
			if e.Qty--; e.Qty <= 0 {
				delete(p.C.Equip, "ammo")
			}
			p.dirty = true
			return i.Power, true
		}
	}
	var best *content.Item
	for _, s := range p.C.Inv {
		if s == nil {
			continue
		}
		if i := content.Items[s.ID]; i.Ammo == kind && i.Tier <= maxTier && (best == nil || i.Tier > best.Tier) {
			best = i
		}
	}
	if best == nil {
		return 0, false
	}
	p.take(best.ID, 1)
	return best.Power, true
}
