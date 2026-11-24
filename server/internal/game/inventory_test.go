package game

import (
	"testing"

	"driftwake/server/internal/pb"
)

func TestItemsAreNeverCreatedOrLost(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	r := Mulberry(9)
	setLevel(p, 50)
	e.atStation(p, "bank", "island")
	ids := []string{"copper_arrow", "iron_arrow", "copper_sword", "ash_bow", "essence", "copper_helm", "berries"}
	for _, i := range ids {
		p.give(i, 2)
	}
	total := func() map[string]int {
		n := map[string]int{}
		add := func(s *Stack) {
			if s != nil {
				n[s.ID] += s.Qty
			}
		}
		for _, l := range [][]*Stack{p.C.Inv, p.C.Bank} {
			for _, s := range l {
				add(s)
			}
		}
		for _, s := range p.C.Equip {
			add(s)
		}
		for _, d := range e.w.drops {
			n[d.Item] += d.Qty
		}
		return n
	}
	pick := func(n int) int { return int(r() * float64(n)) }
	start := total()
	for range 3000 {
		slot, id := uint32(pick(24)), ids[pick(len(ids))]
		var m *pb.ClientMessage
		switch pick(6) {
		case 0:
			m = equipMsg(slot)
		case 1:
			slots := []pb.Slot{pb.Slot_SLOT_WEAPON, pb.Slot_SLOT_AMMO, pb.Slot_SLOT_HEAD}
			m = &pb.ClientMessage{Msg: &pb.ClientMessage_Unequip{Unequip: slots[pick(3)]}}
		case 2:
			m = bankMsg(false, id, uint32(1+pick(3)))
		case 3:
			m = bankMsg(true, id, uint32(1+pick(3)))
		case 4:
			m = &pb.ClientMessage{Msg: &pb.ClientMessage_Swap{Swap: &pb.Swap{A: slot, B: uint32(pick(24))}}}
		default:
			m = depositAll
		}
		e.do(p, m, 1)
		eq(t, total(), start)
	}
}
