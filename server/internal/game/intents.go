package game

import (
	"driftwake/content"
	"driftwake/server/internal/pb"
)

// handle carries out what a player asked for. Anything that takes time becomes the player's action.
func (w *World) handle(p *Player, msg *pb.ClientMessage) {
	if p.trade != nil && interruptsTrade(msg) {
		w.endTrade(p.trade, "The trade was declined.")
	}
	if p.aboard() {
		if allowedAboard(msg) {
			w.handleHelm(p, msg)
		} else {
			return
		}
	}
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
	case *pb.ClientMessage_PickupAll:
		if d := w.findDrop(m.PickupAll); d != nil {
			p.begin(action{typ: actPickupAll, at: Point{X: d.X, Y: d.Y}})
		}
	case *pb.ClientMessage_Grave:
		p.begin(action{typ: actGrave})
	case *pb.ClientMessage_Claim:
		w.claim(p, m.Claim.GetItem())
	case *pb.ClientMessage_Craft:
		w.startCraft(p, m.Craft)
	case *pb.ClientMessage_TakeOff:
		w.takeOff(p)
	case *pb.ClientMessage_EquipSlot:
		w.tellIf(p, p.equip(int(m.EquipSlot)))
	case *pb.ClientMessage_Unequip:
		w.tellIf(p, p.unequip(slotName(m.Unequip)))
	case *pb.ClientMessage_Swap:
		inv := p.C.Inv
		inv[m.Swap.A], inv[m.Swap.B] = inv[m.Swap.B], inv[m.Swap.A]
	case *pb.ClientMessage_EatSlot:
		w.eat(p, int(m.EatSlot))
	case *pb.ClientMessage_DropSlot:
		w.dropSlot(p, int(m.DropSlot))
	case *pb.ClientMessage_Bank:
		w.useBank(p, m.Bank)
	case *pb.ClientMessage_Shop:
		w.useShop(p, m.Shop)
	case *pb.ClientMessage_AskFees:
		w.tellFees(p)
	case *pb.ClientMessage_DepositAll:
		w.depositAll(p)
	case *pb.ClientMessage_Boat:
		w.useDock(p, m.Boat.Sail)
	case *pb.ClientMessage_Board:
		if _, ok := w.mooredHere(p); ok {
			p.begin(action{typ: actBoard})
		}
	case *pb.ClientMessage_Look:
		p.C.Look = &Look{Cut: int(m.Look.Cut), Color: int(m.Look.Color)}
		w.save(p)
	case *pb.ClientMessage_Trade:
		p.begin(action{typ: actTrade, id: m.Trade})
	case *pb.ClientMessage_TradeStep:
		w.stepTrade(p, m.TradeStep)
	case *pb.ClientMessage_Block:
		w.block(p, m.Block)
	case *pb.ClientMessage_FightBack:
		p.C.NoFightBack = !m.FightBack
		w.save(p)
	case *pb.ClientMessage_StartQuest:
		w.startQuest(p, m.StartQuest)
	case *pb.ClientMessage_Npc:
		p.begin(action{typ: actNPC, id: m.Npc})
	case *pb.ClientMessage_SellToTrader:
		w.sellToTrader(p, int(m.SellToTrader))
	case *pb.ClientMessage_UseLamp:
		w.useLamp(p, m.UseLamp)
	case *pb.ClientMessage_Chat:
		w.chat(p, m.Chat)
	}
}

// interruptsTrade is false for what a trading player can do without ending the trade.
func interruptsTrade(msg *pb.ClientMessage) bool {
	switch msg.Msg.(type) {
	case *pb.ClientMessage_TradeStep, *pb.ClientMessage_Chat, *pb.ClientMessage_Block, *pb.ClientMessage_Look,
		*pb.ClientMessage_Swap, *pb.ClientMessage_FightBack:
		return false
	}
	return true
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
	return [...]string{"", "weapon", "head", "body", "legs", "neck", "ammo", "cape"}[s]
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
	p.begin(action{typ: actCraft, recipe: r, left: int(m.Qty), intense: m.Intense && r.Station == "fire"})
}

func (w *World) eat(p *Player, slot int) {
	s := p.C.Inv[slot]
	if s == nil || content.Items[s.ID].Heal == 0 || p.isEating(w.Tick) {
		return
	}
	p.C.Inv[slot] = nil
	p.C.HP = min(MaxHP(p.level("vitality")), p.C.HP+content.Items[s.ID].Heal)
	p.nextAttack = max(p.nextAttack, w.Tick) + eatDelay
	p.doing, p.nextAct = eating, w.Tick+eatDelay
}

func (p *Player) isEating(tick int) bool { return p.doing == eating && p.nextAct > tick }

func (w *World) dropSlot(p *Player, slot int) {
	s := p.C.Inv[slot]
	if s == nil {
		return
	}
	if content.Items[s.ID].Trophy {
		w.tell(p, "You cannot drop a trophy.")
		return
	}
	p.C.Inv[slot] = nil
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
		w.boardAtDock(p)
	}
}

func (w *World) travel(p *Player, mapID string) {
	l := content.MapByID[mapID].Landing
	w.arrive(p, mapID, l.X, l.Y)
}

// takePassage goes into the mine, or out of it.
func (w *World) takePassage(p *Player) {
	if to := w.mapOf(p).Passage; to != nil {
		w.arrive(p, to.To, to.X, to.Y)
		w.save(p)
	}
}

func (w *World) arrive(p *Player, mapID string, x, y int) {
	p.leaveBoat()
	p.C.Map, p.C.X, p.C.Y = mapID, x, y
	w.stop(p)
	p.via = nil
}

func (w *World) chat(p *Player, text string) {
	if w.dev && text[0] == '/' {
		w.devCommand(p, text[1:])
		return
	}
	line := &pb.ServerMessage{Msg: &pb.ServerMessage_Chat{Chat: &pb.Chat{From: p.Name, Text: text, Player: p.ID}}}
	for _, o := range w.order {
		if !o.C.hasBlocked(p.Name) {
			w.send(o, line)
		}
	}
}
