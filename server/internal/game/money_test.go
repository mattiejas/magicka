package game

import (
	"testing"

	"driftwake/content"
	"driftwake/server/internal/pb"
)

// lose makes a player die on the island with exactly these items, and empties their bank.
func (e *env) lose(p *Player, items ...Stack) {
	clear(p.C.Inv)
	for _, s := range items {
		p.give(s.ID, s.Qty)
	}
	e.at(p, 20, 44, "island")
	e.w.hurt(p, 0, 999, melee)
	p.C.Bank = nil
}

func TestReclaimingIsCheaperAtTheGrave(t *testing.T) {
	for _, c := range []struct {
		where   string
		percent int
	}{{"grave", content.Prices.GraveFeePercent}, {"reaper", content.Prices.ReaperFeePercent}} {
		e := setup(t)
		p := e.player(1)
		e.lose(p, Stack{"adamantite_sword", 1})
		p.give(coin, 1000)
		if c.where == "grave" {
			e.at(p, 20, 44, "island")
		} else {
			e.atStation(p, "reaper", "island")
		}
		e.do(p, claimMsg, 1)
		fee := DeathFee(content.Items["adamantite_sword"].Value, 1, c.percent)
		check(t, p.C.Grave == nil)
		eq(t, p.count("adamantite_sword"), 1)
		eq(t, p.count(coin), 1000-fee, c.where)
	}
}

func TestGraveIsOutOfReachFromAfar(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	e.lose(p, Stack{"copper_ore", 1})
	p.give(coin, 100)
	e.at(p, 26, 44, "island")
	e.do(p, claimMsg, 1)
	check(t, p.C.Grave != nil)
	eq(t, p.count(coin), 100)
}

func TestEachKindIsPaidForSeparately(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	e.lose(p, Stack{"adamantite_sword", 1}, Stack{"copper_ore", 3})
	p.give(coin, 2)
	e.at(p, 20, 44, "island")
	e.do(p, claimOne("copper_ore"), 1)
	eq(t, p.count("copper_ore"), 3)
	check(t, p.count(coin) < 2)
	e.do(p, claimMsg, 1)
	eq(t, p.C.Grave.Items, []*Stack{{"adamantite_sword", 1}})
	e.run(3000)
	eq(t, p.C.Grave.Items, []*Stack{{"adamantite_sword", 1}})
}

func TestOnlyWhatCanBeAffordedIsReclaimed(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	e.lose(p, Stack{"copper_sword", 4})
	fee := DeathFee(content.Items["copper_sword"].Value, 2, content.Prices.GraveFeePercent)
	p.give(coin, fee)
	e.at(p, 20, 44, "island")
	e.do(p, claimMsg, 1)
	eq(t, p.count("copper_sword"), 2)
	eq(t, p.count(coin), 0)
	eq(t, p.C.Grave.Items, []*Stack{{"copper_sword", 2}})
}

func TestCarriedCoinsPayBeforeBankedOnes(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	e.lose(p, Stack{"adamantite_sword", 1})
	p.give(coin, 10)
	p.C.Bank = []*Stack{{"essence", 5}, {coin, 1000}}
	fee := DeathFee(content.Items["adamantite_sword"].Value, 1, content.Prices.GraveFeePercent)
	e.at(p, 20, 44, "island")
	e.do(p, claimMsg, 1)
	eq(t, p.count(coin), 0)
	eq(t, p.C.Bank, []*Stack{{"essence", 5}, {coin, 1010 - fee}})
}

func TestLostCoinsPayForTheRest(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	e.lose(p, Stack{"adamantite_sword", 1}, Stack{coin, 1000})
	e.at(p, 20, 44, "island")
	e.do(p, claimOne("adamantite_sword"), 1)
	fee := DeathFee(content.Items["adamantite_sword"].Value, 1, content.Prices.GraveFeePercent)
	eq(t, p.count("adamantite_sword"), 1)
	eq(t, p.C.Grave.Items, []*Stack{{coin, 1000 - fee}})
	e.do(p, claimMsg, 1)
	eq(t, p.count(coin), 1000-fee-DeathFee(1, 1000-fee, content.Prices.GraveFeePercent))
	check(t, p.C.Grave == nil)
}

func TestKeptUniquesAreFreeAndOnlyAtTheReaper(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	e.lose(p, Stack{"copper_ore", 1})
	p.C.Kept = []*Stack{{"rootcleaver", 1}}
	e.at(p, 20, 44, "island")
	e.do(p, claimMsg, 1)
	eq(t, p.count("rootcleaver"), 0)
	e.atStation(p, "reaper", "island")
	e.do(p, claimOne("rootcleaver"), 1)
	eq(t, p.count("rootcleaver"), 1)
	eq(t, e.w.feesTaken, 0)
}

func TestFeesLeaveTheGameAndAreCounted(t *testing.T) {
	e := setup(t)
	total := 0
	for n := int64(1); n <= 2; n++ {
		p := e.player(n)
		e.lose(p, Stack{"iron_sword", 1})
		p.give(coin, 500)
		e.atStation(p, "reaper", "island")
		e.do(p, claimMsg, 1)
		total += 500 - p.count(coin)
	}
	check(t, total > 0)
	ask := &pb.ClientMessage{Msg: &pb.ClientMessage_AskFees{AskFees: &pb.Empty{}}}
	e.do(e.player(1), ask, 1)
	var told uint64
	for _, m := range e.c[1].msgs {
		told = max(told, m.GetFeesTaken())
	}
	eq(t, told, uint64(total))
	eq(t, e.saved.Total(feesTotal), int64(total))
}

func TestTheGraveOpensAWindow(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	e.lose(p, Stack{"copper_ore", 1})
	e.at(p, 22, 44, "island")
	e.do(p, graveMsg, 4)
	opened := ""
	for _, m := range e.c[1].msgs {
		if o := m.GetOpenStation(); o != "" {
			opened = o
		}
	}
	eq(t, opened, "grave")
	check(t, p.C.Grave != nil, "nothing is paid by looking")
}

func TestShopSellsWornTools(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	clear(p.C.Inv)
	p.give(coin, 25)
	e.atStation(p, "shop", "island")
	e.do(p, shopMsg(true, "worn_pickaxe", 5), 1)
	eq(t, p.count("worn_pickaxe"), 2)
	eq(t, p.count(coin), 5)
	e.do(p, shopMsg(true, "copper_sword", 1), 1)
	e.do(p, shopMsg(true, "worn_axe", 1), 1)
	eq(t, p.count("copper_sword")+p.count("worn_axe"), 0)
}

func TestShopBuysAtHalfValueButNeverWornTools(t *testing.T) {
	for _, m := range []string{"island", "mainland"} {
		e := setup(t)
		p := e.player(1)
		clear(p.C.Inv)
		p.give("iron_sword", 2)
		p.give("worn_sword", 1)
		e.atStation(p, "shop", m)
		e.do(p, shopMsg(false, "iron_sword", 9), 1)
		eq(t, p.count("iron_sword"), 0)
		eq(t, p.count(coin), content.Items["iron_sword"].Value)
		before := p.count(coin)
		e.do(p, shopMsg(false, "worn_sword", 1), 1)
		e.do(p, shopMsg(false, coin, 1), 1)
		eq(t, p.count("worn_sword"), 1)
		eq(t, p.count(coin), before)
	}
}

func TestShopRefusesFromAfarAndWhenFull(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	clear(p.C.Inv)
	p.give(coin, 100)
	e.at(p, 20, 44, "island")
	e.do(p, shopMsg(true, "worn_axe", 1), 1)
	eq(t, p.count("worn_axe"), 0)
	e.atStation(p, "shop", "island")
	p.give("berries", 23)
	e.do(p, shopMsg(true, "worn_axe", 1), 1)
	eq(t, p.count(coin), 100)
	clear(p.C.Inv)
	p.give("essence", 100)
	p.give("berries", 23)
	e.do(p, shopMsg(false, "essence", 50), 1)
	eq(t, p.count("essence"), 100)
	eq(t, p.count(coin), 0)
}

// Selling for more than something costs to make from shop goods would print coins.
func TestShopGoodsCannotBeSoldForProfit(t *testing.T) {
	for _, id := range content.Prices.ShopStock {
		check(t, content.Items[id].Basic, id)
	}
	for id, item := range content.Items {
		check(t, item.Value >= 1, id)
	}
}

func TestChickensCanBeKilledBareHandedForCoins(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	clear(p.C.Inv)
	clear(p.C.Equip)
	m := e.monster("chicken")
	e.at(p, m.X-1, m.Y, "island")
	p.C.HP = MaxHP(p.level("vitality"))
	e.do(p, attackMsg(m.ID), 1)
	for range 200 {
		if m.HP <= 0 {
			break
		}
		e.run(1)
	}
	check(t, m.HP <= 0)
	e.run(2)
	found := 0
	for _, d := range e.w.drops {
		if d.Item == coin {
			found += d.Qty
		}
	}
	check(t, found >= 1 && found <= 4, found)
}
