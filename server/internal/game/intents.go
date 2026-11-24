package game

import (
	"driftwake/content"
	"driftwake/server/internal/pb"
)

// handle carries out what a player asked for. Anything that takes time becomes the player's action.
func (w *World) handle(p *Player, msg *pb.ClientMessage) {
	switch m := msg.Msg.(type) {
	case *pb.ClientMessage_Move:
		w.startWalk(p, int(m.Move.X), int(m.Move.Y))
	case *pb.ClientMessage_Gather:
		p.begin(action{typ: actGather, id: m.Gather})
	case *pb.ClientMessage_Station:
		p.begin(action{typ: actStation, id: m.Station})
	case *pb.ClientMessage_Attack:
		p.begin(action{typ: actAttack, id: m.Attack})
	case *pb.ClientMessage_Pickup:
		p.begin(action{typ: actPickup, id: m.Pickup})
	case *pb.ClientMessage_Grave:
		p.begin(action{typ: actGrave})
	case *pb.ClientMessage_Claim:
		if w.nearStation(p, "reaper") {
			w.claimGrave(p)
		}
	case *pb.ClientMessage_Craft:
		w.startCraft(p, m.Craft)
	case *pb.ClientMessage_EquipSlot:
		w.tellIf(p, p.equip(int(m.EquipSlot)))
	case *pb.ClientMessage_Unequip:
		w.tellIf(p, p.unequip(slotName(m.Unequip)))
	case *pb.ClientMessage_Swap:
		inv := p.C.Inv
		inv[m.Swap.A], inv[m.Swap.B] = inv[m.Swap.B], inv[m.Swap.A]
		p.dirty = true
	case *pb.ClientMessage_EatSlot:
		w.eat(p, int(m.EatSlot))
	case *pb.ClientMessage_DropSlot:
		w.dropSlot(p, int(m.DropSlot))
	case *pb.ClientMessage_Bank:
		w.useBank(p, m.Bank)
	case *pb.ClientMessage_DepositAll:
		w.depositAll(p)
	case *pb.ClientMessage_Boat:
		w.useDock(p, m.Boat.Sail)
	case *pb.ClientMessage_Look:
		p.C.Look = &Look{Cut: int(m.Look.Cut), Color: int(m.Look.Color)}
		p.dirty = true
		w.save(p)
	case *pb.ClientMessage_Chat:
		w.chat(p, m.Chat)
	}
}

// begin replaces what the player was doing.
func (p *Player) begin(a action) { p.act, p.path = a, nil }

func (w *World) stop(p *Player) { p.begin(action{}) }

// tellIf passes on a reason for refusing, if there is one.
func (w *World) tellIf(p *Player, why string) {
	if why != "" {
		w.tell(p, why)
	}
}

func slotName(s pb.Slot) string {
	return [...]string{"", "weapon", "head", "body", "legs", "neck", "ammo"}[s]
}

func (w *World) startWalk(p *Player, x, y int) {
	m := w.mapOf(p)
	if x >= m.Size || y >= m.Size {
		return
	}
	p.begin(action{typ: actMove})
	p.path = w.finder.find(m, p.C.X, p.C.Y, tile(x, y), 0)
}

func (w *World) startCraft(p *Player, m *pb.Craft) {
	r := content.RecipeByID[m.Recipe]
	if r == nil || !w.nearStation(p, r.Station) {
		return
	}
	p.nextAct = w.Tick - 2 // the first item takes as long as the others
	p.begin(action{typ: actCraft, recipe: r, left: int(m.Qty)})
}

func (w *World) eat(p *Player, slot int) {
	s := p.C.Inv[slot]
	if s == nil || content.Items[s.ID].Heal == 0 || p.isEating(w.Tick) {
		return
	}
	p.C.Inv[slot] = nil
	p.C.HP = min(MaxHP(p.level("vitality")), p.C.HP+content.Items[s.ID].Heal)
	p.nextAttack = max(p.nextAttack, w.Tick) + eatDelay
	p.doing, p.nextAct, p.dirty = eating, w.Tick+eatDelay, true
}

func (p *Player) isEating(tick int) bool { return p.doing == eating && p.nextAct > tick }

func (w *World) dropSlot(p *Player, slot int) {
	s := p.C.Inv[slot]
	if s == nil {
		return
	}
	p.C.Inv[slot] = nil
	p.dirty = true
	w.drop(w.mapOf(p), p.at(), s.ID, s.Qty, p.ID, playerDrop)
}

func (w *World) useBank(p *Player, m *pb.Bank) {
	if content.Items[m.Item] == nil || !w.nearStation(p, "bank") {
		return
	}
	if m.Withdraw {
		p.withdraw(m.Item, int(m.Qty))
	} else {
		p.deposit(m.Item, int(m.Qty))
	}
	w.save(p)
}

func (w *World) depositAll(p *Player) {
	if !w.nearStation(p, "bank") {
		return
	}
	for i := range p.C.Inv { // depositing empties other slots of the same item too
		if s := p.C.Inv[i]; s != nil {
			p.deposit(s.ID, s.Qty)
		}
	}
	w.save(p)
}

func (w *World) useDock(p *Player, sail bool) {
	switch {
	case !w.nearStation(p, "dock"):
	case !sail:
		if !p.C.BoatDone {
			w.buildBoat(p)
		}
	case !p.C.BoatDone:
		w.tell(p, "Your boat is not finished.")
	default:
		destination := "island"
		if p.C.Map == "island" {
			destination = "mainland"
		}
		w.travel(p, destination)
		w.save(p)
	}
}

func (w *World) travel(p *Player, mapID string) {
	l := content.MapByID[mapID].Landing
	p.C.Map, p.C.X, p.C.Y = mapID, l.X, l.Y
	w.stop(p)
	p.via, p.dirty = nil, true
}

func (w *World) chat(p *Player, text string) {
	if w.dev && text[0] == '/' {
		w.devCommand(p, text[1:])
		return
	}
	w.broadcast(&pb.ServerMessage{Msg: &pb.ServerMessage_Chat{Chat: &pb.Chat{From: p.Name, Text: text}}})
}
