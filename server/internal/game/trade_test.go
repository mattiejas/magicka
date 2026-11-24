package game

import (
	"testing"

	"driftwake/content"
	"driftwake/server/internal/pb"
)

func tradeMsg(with *Player) *pb.ClientMessage {
	return &pb.ClientMessage{Msg: &pb.ClientMessage_Trade{Trade: with.ID}}
}

func tradeStep(a pb.TradeAction, item string, qty uint32) *pb.ClientMessage {
	step := &pb.TradeStep{Action: a, Item: item, Qty: qty}
	return &pb.ClientMessage{Msg: &pb.ClientMessage_TradeStep{TradeStep: step}}
}

func offerMsg(item string, qty uint32) *pb.ClientMessage {
	return tradeStep(pb.TradeAction_TRADE_ACTION_OFFER, item, qty)
}

var (
	acceptMsg  = tradeStep(pb.TradeAction_TRADE_ACTION_ACCEPT, "", 0)
	declineMsg = tradeStep(pb.TradeAction_TRADE_ACTION_DECLINE, "", 0)
)

func blockMsg(name string, on bool) *pb.ClientMessage {
	return &pb.ClientMessage{Msg: &pb.ClientMessage_Block{Block: &pb.Block{Name: name, On: on}}}
}

// trading is two players with a trade open between them.
func trading(t *testing.T) (e *env, a, b *Player) {
	e = setup(t)
	a, b = e.player(1), e.player(2)
	for _, p := range []*Player{a, b} {
		clear(p.C.Inv)
	}
	e.at(a, 31, 36, "island")
	e.at(b, 32, 36, "island")
	e.do(a, tradeMsg(b), 1)
	check(t, a.trade == nil, "asking is not enough")
	e.do(b, tradeMsg(a), 1)
	check(t, a.trade != nil && a.trade == b.trade)
	return
}

func (e *env) bothAccept(a, b *Player) {
	e.run(tradePause)
	e.do(a, acceptMsg, 1)
	e.do(b, acceptMsg, 1)
}

func TestTradeSwapsBothOffers(t *testing.T) {
	e, a, b := trading(t)
	a.give("iron_sword", 2)
	a.give(coin, 100)
	b.give("rootcleaver", 1)
	e.do(a, offerMsg("iron_sword", 1), 1)
	e.do(a, offerMsg(coin, 60), 1)
	e.do(b, offerMsg("rootcleaver", 1), 1)
	e.bothAccept(a, b)
	check(t, a.trade == nil && b.trade == nil)
	eq(t, []int{a.count("iron_sword"), a.count(coin), a.count("rootcleaver")}, []int{1, 40, 1})
	eq(t, []int{b.count("iron_sword"), b.count(coin), b.count("rootcleaver")}, []int{1, 60, 0})
}

func TestOneAcceptanceIsNotEnough(t *testing.T) {
	e, a, b := trading(t)
	a.give("iron_sword", 1)
	e.do(a, offerMsg("iron_sword", 1), tradePause)
	e.do(b, acceptMsg, 20)
	eq(t, b.count("iron_sword"), 0)
	check(t, a.trade != nil)
}

func TestChangingAnOfferTakesBackAcceptance(t *testing.T) {
	e, a, b := trading(t)
	a.give("iron_sword", 1)
	b.give(coin, 50)
	e.do(b, offerMsg(coin, 50), 1)
	e.do(a, offerMsg("iron_sword", 1), tradePause)
	e.do(b, acceptMsg, 1)
	e.do(a, tradeStep(pb.TradeAction_TRADE_ACTION_TAKE_BACK, "iron_sword", 1), 0)
	e.do(a, acceptMsg, 1)
	e.do(b, acceptMsg, 1)
	check(t, a.trade != nil, "too soon after the change to accept")
	eq(t, b.count(coin), 50)
	check(t, !a.trade.sides[0].accepted && !a.trade.sides[1].accepted)
}

func TestTrophiesAndWornToolsAreNotTraded(t *testing.T) {
	e, a, b := trading(t)
	for _, id := range []string{"cape_mining", "rooted_mantle", "worn_axe"} {
		a.give(id, 1)
		e.do(a, offerMsg(id, 1), 1)
	}
	mine, _ := a.trade.side(a)
	eq(t, len(mine.offer), 0)
	e.bothAccept(a, b)
	eq(t, b.count("worn_axe"), 0)
}

func TestNothingIsOfferedTwice(t *testing.T) {
	e, a, b := trading(t)
	a.give("iron_sword", 1)
	e.do(a, offerMsg("iron_sword", 1), 1)
	e.do(a, offerMsg("iron_sword", 5), 1)
	e.do(a, offerMsg("copper_sword", 5), 1)
	e.bothAccept(a, b)
	eq(t, b.count("iron_sword"), 1)
	eq(t, a.count("iron_sword")+b.count("copper_sword"), 0)
}

func TestTradeNeedsRoom(t *testing.T) {
	e, a, b := trading(t)
	a.give("iron_sword", 2)
	b.give("berries", 23)
	e.do(a, offerMsg("iron_sword", 2), 1)
	e.bothAccept(a, b)
	eq(t, a.count("iron_sword"), 2)
	eq(t, b.count("iron_sword"), 0)
	check(t, a.trade != nil, "they can still change their offers")
	e.do(b, offerMsg("berries", 1), 1)
	e.bothAccept(a, b)
	eq(t, b.count("iron_sword"), 2)
	eq(t, a.count("berries"), 1)
}

func TestTradeEndsByAnythingElse(t *testing.T) {
	for what, happen := range map[string]func(e *env, a, b *Player){
		"decline": func(e *env, a, _ *Player) { e.do(a, declineMsg, 1) },
		"walk":    func(e *env, a, _ *Player) { e.do(a, move(30, 36), 1) },
		"drop":    func(e *env, a, _ *Player) { e.do(a, &pb.ClientMessage{Msg: &pb.ClientMessage_DropSlot{}}, 1) },
		"leave":   func(e *env, a, _ *Player) { e.w.Leave(a.ID, e.c[1]); e.run(1) },
		"die":     func(e *env, a, _ *Player) { e.w.hurt(a, 0, 999, melee); e.run(1) },
		"part":    func(e *env, _, b *Player) { e.at(b, 40, 36, "island"); e.run(1) },
		"rejoin":  func(e *env, _, _ *Player) { e.player(1) },
	} {
		e, a, b := trading(t)
		a.give("iron_sword", 1)
		e.do(a, offerMsg("iron_sword", 1), 1)
		happen(e, a, b)
		check(t, a.trade == nil && b.trade == nil, what)
		e.do(b, acceptMsg, 2)
		eq(t, b.count("iron_sword"), 0, what)
		view := e.c[2].lastTrade()
		check(t, view != nil && !view.Open, what)
	}
}

func (c *client) lastTrade() (view *pb.TradeView) {
	for _, m := range c.msgs {
		if v := m.GetTrade(); v != nil {
			view = v
		}
	}
	return
}

func TestBothSidesAreSavedTogether(t *testing.T) {
	e, a, b := trading(t)
	a.give(coin, 10)
	e.do(a, offerMsg(coin, 10), 1)
	e.bothAccept(a, b)
	check(t, e.saved.chars[1] != nil && e.saved.chars[2] != nil)
}

func TestItemsAreKeptWhateverTradersDo(t *testing.T) {
	e := setup(t)
	players := []*Player{e.player(1), e.player(2), e.player(3)}
	ids := []string{"iron_sword", coin, "berries", "rootcleaver", "worn_axe"}
	for i, p := range players {
		clear(p.C.Inv)
		for _, id := range ids {
			p.give(id, 3+i)
		}
		e.at(p, 31+i%2, 36+i/2, "island")
	}
	total := func() map[string]int {
		n := map[string]int{}
		for _, p := range players {
			for _, s := range p.C.Inv {
				if s != nil {
					n[s.ID] += s.Qty
				}
			}
		}
		return n
	}
	r := Mulberry(4)
	pick := func(n int) int { return int(r() * float64(n)) }
	start, done := total(), 0
	for range 6000 {
		p, o := players[pick(3)], players[pick(3)]
		id, n := ids[pick(len(ids))], uint32(1+pick(6))
		was := p.trade
		switch pick(8) {
		case 0, 1:
			if p.trade == nil {
				e.do(p, tradeMsg(o), 1)
			}
		case 2, 3:
			e.do(p, offerMsg(id, n), 1)
		case 4:
			e.do(p, tradeStep(pb.TradeAction_TRADE_ACTION_TAKE_BACK, id, n), 1)
		case 5, 6:
			e.do(p, acceptMsg, 1+pick(3))
		default:
			if pick(6) == 0 {
				e.do(p, declineMsg, 1)
			}
		}
		if was != nil && p.trade == nil {
			done++
		}
		eq(t, total(), start)
	}
	check(t, done > 20, done)
}

func TestBlockingHidesChatAndTradeRequests(t *testing.T) {
	e := setup(t)
	a, b := e.player(1), e.player(2)
	a.Name = "Loud_one"
	e.at(a, 31, 36, "island")
	e.at(b, 32, 36, "island")
	heard := func() (n int) {
		for _, m := range e.c[2].msgs {
			if m.GetChat() != nil || m.GetTradeRequest() != nil {
				n++
			}
		}
		return
	}
	e.do(b, blockMsg("loud_one", true), 1)
	e.do(a, chatMsg("hello"), 1)
	e.do(a, tradeMsg(b), 2)
	eq(t, heard(), 0)
	e.do(b, blockMsg("LOUD_ONE", false), 1)
	e.do(a, chatMsg("hello"), 1)
	e.do(a, tradeMsg(b), 2)
	eq(t, heard(), 2)
}

func TestDroppedItemsStayPrivate(t *testing.T) {
	e := setup(t)
	a, b := e.player(1), e.player(2)
	e.at(a, 20, 40, "island")
	slot := uint32(slotOf(a, "worn_axe"))
	e.do(a, &pb.ClientMessage{Msg: &pb.ClientMessage_DropSlot{DropSlot: slot}}, 1)
	d := e.w.drops[0]
	for len(e.w.drops) > 0 {
		e.at(b, 20, 40, "island")
		e.do(b, pickupMsg(d.ID), 1)
		a.C.HP, b.C.HP = 1e6, 1e6
		check(t, e.c[2].ents[d.ID] == nil)
	}
	eq(t, b.count("worn_axe"), 1) // their own
}

func TestTrophiesAreNeitherDroppedNorSold(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	clear(p.C.Inv)
	p.give("cape_mining", 1)
	e.atStation(p, "shop", "island")
	e.do(p, &pb.ClientMessage{Msg: &pb.ClientMessage_DropSlot{DropSlot: 0}}, 1)
	e.do(p, shopMsg(false, "cape_mining", 1), 1)
	eq(t, p.count("cape_mining"), 1)
}

func TestMasteringASkillGivesOneCape(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	p.C.XP["mining"] = xpTable[MaxLevel] - 1
	e.w.addXP(p, "mining", 10)
	eq(t, p.count("cape_mining"), 1)
	e.do(p, equipMsg(uint32(slotOf(p, "cape_mining"))), 1)
	eq(t, p.C.Equip["cape"].ID, "cape_mining")
	e.w.addXP(p, "mining", 10)
	e.player(1) // coming back
	eq(t, p.count("cape_mining"), 0)
	eq(t, len(p.C.Kept), 0)
	// Without room, the reaper keeps it.
	p.give("berries", 24)
	p.C.XP["magic"] = xpTable[MaxLevel]
	e.w.grantCapes(p)
	eq(t, p.C.Kept, []*Stack{{"cape_magic", 1}})
	for _, skill := range content.Skills {
		check(t, content.Items["cape_"+skill].Trophy, skill)
	}
}
