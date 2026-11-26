package game

import (
	"maps"
	"slices"

	"driftwake/content"
	"driftwake/server/internal/pb"
)

func pbMap(id string) pb.MapId {
	switch id {
	case "mainland":
		return pb.MapId_MAP_ID_MAINLAND
	case "mine":
		return pb.MapId_MAP_ID_MINE
	case "sea":
		return pb.MapId_MAP_ID_SEA
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
		Id:        p.ID,
		Name:      p.Name,
		Map:       pbMap(c.Map),
		Xp:        map[string]uint32{},
		Boat:      map[string]uint32{},
		BoatDone:  c.BoatDone,
		Bank:      pbStacks(c.Bank),
		Blocked:   slices.Clone(c.Blocked), // which is changed in place
		Quests:    map[string]uint32{},
		Found:     map[string]uint32{},
		Kills:     map[string]uint32{},
		Look:      &pb.Look{Cut: uint32(l.Cut), Color: uint32(l.Color)},
		FightBack: !c.NoFightBack,
		BoatAway:  c.Afloat != nil,
	}
	ready, burns := p.onFire()
	s.FireReady, s.FireBurns = uint32(ready), uint32(burns)
	for id, done := range c.Quests {
		s.Quests[id] = uint32(done)
	}
	for key, n := range c.Found {
		s.Found[key] = uint32(n)
	}
	for boss, n := range c.Kills {
		s.Kills[boss] = uint32(n)
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
	for slot := pb.Slot_SLOT_WEAPON; slot <= pb.Slot_SLOT_CAPE; slot++ {
		if e := c.Equip[slotName(slot)]; e != nil {
			s.Equipment = append(s.Equipment, &pb.EquipSlot{Slot: slot, Stack: pbStack(e)})
		}
	}
	s.Kept = pbStacks(c.Kept)
	if c.Grave != nil {
		s.Reaper = pbStacks(c.Grave.Items)
	}
	return s
}

// isCurrent reports whether s is what self would make: whatever self holds is compared here.
// It allocates nothing, since it runs for every player and tick.
func (p *Player) isCurrent(s *pb.Self) bool {
	c, l := p.C, p.look()
	var reaper []*Stack
	if c.Grave != nil {
		reaper = c.Grave.Items
	}
	ready, burns := p.onFire()
	return s.Map == pbMap(c.Map) && s.BoatDone == c.BoatDone && s.FightBack == !c.NoFightBack &&
		s.BoatAway == (c.Afloat != nil) &&
		int(s.FireReady) == ready && int(s.FireBurns) == burns &&
		int(s.Look.Cut) == l.Cut && int(s.Look.Color) == l.Color &&
		sameCounts(s.Xp, c.XP) && sameCounts(s.Boat, c.Boat) && sameCounts(s.Quests, c.Quests) &&
		sameCounts(s.Found, c.Found) && sameCounts(s.Kills, c.Kills) && slices.Equal(s.Blocked, c.Blocked) &&
		sameInventory(s.Inventory, c.Inv) && sameEquipment(s.Equipment, c.Equip) &&
		sameStacks(s.Bank, c.Bank) && sameStacks(s.Kept, c.Kept) && sameStacks(s.Reaper, reaper)
}

func sameCounts(told map[string]uint32, now map[string]int) bool {
	return maps.EqualFunc(told, now, func(a uint32, b int) bool { return a == uint32(b) })
}

func sameStack(told *pb.Stack, now *Stack) bool {
	return told.Item == now.ID && told.Qty == uint32(now.Qty)
}

func sameStacks(told []*pb.Stack, now []*Stack) bool { return slices.EqualFunc(told, now, sameStack) }

func sameInventory(told []*pb.InvSlot, now []*Stack) bool {
	for i, s := range now {
		if s == nil {
			continue
		}
		if len(told) == 0 || int(told[0].Index) != i || !sameStack(told[0].Stack, s) {
			return false
		}
		told = told[1:]
	}
	return len(told) == 0
}

func sameEquipment(told []*pb.EquipSlot, now map[string]*Stack) bool {
	worn := 0
	for _, s := range now {
		if s != nil {
			worn++
		}
	}
	for _, slot := range told {
		if s := now[slotName(slot.Slot)]; s == nil || !sameStack(slot.Stack, s) {
			return false
		}
	}
	return worn == len(told)
}

// look is what the player chose, or a default that depends on their name.
func (p *Player) look() Look {
	if p.C.Look != nil {
		return *p.C.Look
	}
	h := nameHash(p.Name)
	return Look{Cut: h >> 5 % content.Haircuts, Color: h >> 2 % 5}
}
