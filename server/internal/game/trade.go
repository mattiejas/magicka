package game

import (
	"driftwake/content"
	"driftwake/server/internal/pb"
)

// trade is two players offering each other items. Nothing leaves an inventory until both have accepted.
type trade struct {
	sides     [2]*trader
	changedAt int // tick of the last change to an offer
}

type trader struct {
	p        *Player
	offer    []*Stack
	accepted bool
}

// request is a wish to trade with someone, until they answer.
type request struct {
	with  uint32
	until int
}

func (t *trade) side(p *Player) (mine, theirs *trader) {
	if t.sides[0].p == p {
		return t.sides[0], t.sides[1]
	}
	return t.sides[1], t.sides[0]
}

// askToTrade opens a trade when the other player has asked too, and asks them otherwise.
func (w *World) askToTrade(p, other *Player) {
	w.stop(p)
	switch {
	case other.conn == nil || other.C.hasBlocked(p.Name):
		w.tell(p, other.Name+" does not answer.")
	case p.C.hasBlocked(other.Name):
		w.tell(p, "You have blocked "+other.Name+".")
	case other.trade != nil:
		w.tell(p, other.Name+" is trading with someone else.")
	case other.asked.with == p.ID && other.asked.until > w.Tick:
		w.openTrade(other, p)
	case p.asked.with == other.ID && p.asked.until > w.Tick:
		w.tell(p, "You have already asked "+other.Name+" to trade.")
	default:
		p.asked = request{other.ID, w.Tick + tradeRequestTime}
		w.tell(p, "You ask "+other.Name+" to trade.")
		ask := &pb.TradeRequest{Player: p.ID, Name: p.Name}
		w.send(other, &pb.ServerMessage{Msg: &pb.ServerMessage_TradeRequest{TradeRequest: ask}})
	}
}

func (w *World) openTrade(a, b *Player) {
	t := &trade{sides: [2]*trader{{p: a}, {p: b}}, changedAt: w.Tick}
	for _, p := range []*Player{a, b} {
		w.stop(p)
		p.trade, p.asked = t, request{}
	}
	w.sendTrade(t)
}

// endTrade closes a trade for both, with nothing exchanged by it.
func (w *World) endTrade(t *trade, why string) {
	for _, s := range t.sides {
		s.p.trade = nil
		w.send(s.p, &pb.ServerMessage{Msg: &pb.ServerMessage_Trade{Trade: &pb.TradeView{}}})
		w.tell(s.p, why)
	}
}

func (w *World) sendTrade(t *trade) {
	for _, s := range t.sides {
		mine, theirs := t.side(s.p)
		w.send(s.p, &pb.ServerMessage{Msg: &pb.ServerMessage_Trade{Trade: &pb.TradeView{
			Open:         true,
			Partner:      theirs.p.Name,
			Mine:         pbStacks(mine.offer),
			Theirs:       pbStacks(theirs.offer),
			IAccepted:    mine.accepted,
			TheyAccepted: theirs.accepted,
			ReadyAt:      uint32(t.changedAt + tradePause),
		}}})
	}
}

func (w *World) stepTrade(p *Player, m *pb.TradeStep) {
	t := p.trade
	if t == nil {
		return
	}
	mine, theirs := t.side(p)
	switch m.Action {
	case pb.TradeAction_TRADE_ACTION_OFFER:
		w.offer(t, mine, m.Item, int(m.Qty))
	case pb.TradeAction_TRADE_ACTION_TAKE_BACK:
		w.takeBack(t, mine, m.Item, int(m.Qty))
	case pb.TradeAction_TRADE_ACTION_DECLINE:
		w.endTrade(t, "The trade was declined.")
		return
	case pb.TradeAction_TRADE_ACTION_ACCEPT:
		if w.Tick < t.changedAt+tradePause {
			return
		}
		mine.accepted = true
		if theirs.accepted {
			w.completeTrade(t)
			return
		}
	}
	w.sendTrade(t)
}

func (w *World) offer(t *trade, mine *trader, id string, qty int) {
	item := content.Items[id]
	if item == nil {
		return
	}
	if !item.Tradable() {
		w.tell(mine.p, item.Name+" cannot be traded.")
		return
	}
	qty = min(qty, mine.p.count(id)-amountOf(mine.offer, id))
	if qty <= 0 {
		return
	}
	mine.offer = addTo(mine.offer, id, qty)
	w.offerChanged(t)
}

func (w *World) takeBack(t *trade, mine *trader, id string, qty int) {
	for _, s := range mine.offer {
		if s.ID == id {
			s.Qty -= min(qty, s.Qty)
			mine.offer = withoutEmpty(mine.offer)
			w.offerChanged(t)
			return
		}
	}
}

// offerChanged takes back both acceptances, so nobody accepts something they have not seen.
func (w *World) offerChanged(t *trade) {
	t.changedAt = w.Tick
	for _, s := range t.sides {
		s.accepted = false
	}
}

func amountOf(list []*Stack, id string) int {
	for _, s := range list {
		if s.ID == id {
			return s.Qty
		}
	}
	return 0
}

// completeTrade swaps the offers, or changes nothing when one side has no room.
func (w *World) completeTrade(t *trade) {
	a, b := t.sides[0], t.sides[1]
	before := [2][]*Stack{copyStacks(a.p.C.Inv), copyStacks(b.p.C.Inv)}
	why := ""
	if !a.p.takeAll(a.offer) || !b.p.takeAll(b.offer) {
		why = "Something that was offered is gone."
	} else if !a.p.giveAll(b.offer) {
		why = a.p.Name + " has no room for that."
	} else if !b.p.giveAll(a.offer) {
		why = b.p.Name + " has no room for that."
	}
	if why != "" {
		a.p.C.Inv, b.p.C.Inv = before[0], before[1]
		w.offerChanged(t)
		for _, s := range t.sides {
			w.tell(s.p, why)
		}
		w.sendTrade(t)
		return
	}
	w.endTrade(t, "The trade is done.")
	w.saveTogether(a.p, b.p)
}

func (p *Player) takeAll(items []*Stack) bool {
	for _, s := range items {
		if !p.take(s.ID, s.Qty) {
			return false
		}
	}
	return true
}

func (p *Player) giveAll(items []*Stack) bool {
	for _, s := range items {
		if p.give(s.ID, s.Qty) < s.Qty {
			return false
		}
	}
	return true
}

// endBrokenTrades ends trades whose players have moved apart or left.
func (w *World) endBrokenTrades() {
	for _, p := range w.order {
		if p.trade == nil {
			continue
		}
		_, other := p.trade.side(p)
		o := other.p
		switch {
		case p.conn == nil || o.conn == nil:
			w.endTrade(p.trade, "The other player left.")
		case p.C.Map != o.C.Map || !inReach(p.C.X, p.C.Y, tile(o.C.X, o.C.Y), tradeReach):
			w.endTrade(p.trade, "You are too far apart to trade.")
		}
	}
}
