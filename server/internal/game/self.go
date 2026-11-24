package game

import (
	"driftwake/content"
	"driftwake/server/internal/pb"
)

func pbMap(id string) pb.MapId {
	if id == "mainland" {
		return pb.MapId_MAP_ID_MAINLAND
	}
	return pb.MapId_MAP_ID_ISLAND
}

func pbStack(s *Stack) *pb.Stack { return &pb.Stack{Item: s.ID, Qty: uint32(s.Qty)} }

func pbStacks(list []*Stack) (out []*pb.Stack) {
	for _, s := range list {
		out = append(out, pbStack(s))
	}
	return
}

// self is everything only the player themselves is told.
func (w *World) self(p *Player) *pb.Self {
	c, l := p.C, p.look()
	s := &pb.Self{
		Id:       p.ID,
		Name:     p.Name,
		Map:      pbMap(c.Map),
		Xp:       map[string]uint32{},
		Boat:     map[string]uint32{},
		BoatDone: c.BoatDone,
		Bank:     pbStacks(c.Bank),
		Look:     &pb.Look{Cut: uint32(l.Cut), Color: uint32(l.Color)},
	}
	for skill, xp := range c.XP {
		s.Xp[skill] = uint32(xp)
	}
	for part, n := range c.Boat {
		s.Boat[part] = uint32(n)
	}
	for i, stack := range c.Inv {
		if stack != nil {
			s.Inventory = append(s.Inventory, &pb.InvSlot{Index: uint32(i), Stack: pbStack(stack)})
		}
	}
	for slot := pb.Slot_SLOT_WEAPON; slot <= pb.Slot_SLOT_AMMO; slot++ {
		if e := c.Equip[slotName(slot)]; e != nil {
			s.Equipment = append(s.Equipment, &pb.EquipSlot{Slot: slot, Stack: pbStack(e)})
		}
	}
	if c.Grave != nil {
		s.Reaper = pbStacks(c.Grave.Items)
	}
	return s
}

// look is what the player chose, or a default that depends on their name.
func (p *Player) look() Look {
	if p.C.Look != nil {
		return *p.C.Look
	}
	h := nameHash(p.Name)
	return Look{Cut: h >> 5 % content.Haircuts, Color: h >> 2 % 5}
}
