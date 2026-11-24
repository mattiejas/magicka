package game

import (
	"driftwake/content"
	"driftwake/server/internal/pb"
)

func (w *World) useShop(p *Player, m *pb.Shop) {
	item := content.Items[m.Item]
	if item == nil || !w.nearStation(p, "shop") {
		return
	}
	if m.Buy {
		w.buy(p, item, int(m.Qty))
	} else {
		w.sell(p, item, int(m.Qty))
	}
}

// buy gets as many as are asked for, fit, and can be paid with carried coins.
func (w *World) buy(p *Player, item *content.Item, qty int) {
	if !content.Prices.Sells(item.ID) {
		return
	}
	affordable := p.count(coin) / item.Value
	if affordable == 0 {
		w.tell(p, "You do not have enough coins with you.")
		return
	}
	n := p.room(item.ID, min(qty, affordable))
	if n == 0 {
		w.tell(p, "Your inventory is full.")
		return
	}
	p.take(coin, n*item.Value)
	p.give(item.ID, n)
	w.save(p)
}

// sell takes as many as are asked for and carried.
func (w *World) sell(p *Player, item *content.Item, qty int) {
	n := min(qty, p.count(item.ID))
	if n == 0 {
		return
	}
	if item.Basic || item.ID == coin {
		w.tell(p, "The shop does not buy that.")
		return
	}
	price := SellPrice(item.Value, n, content.Prices.SellPercent)
	if price == 0 {
		w.tell(p, "That is not worth a coin. Try selling more at once.")
		return
	}
	before := copyStacks(p.C.Inv)
	p.take(item.ID, n)
	if p.give(coin, price) < price {
		p.C.Inv = before
		w.tell(p, "You have no room for the coins.")
		return
	}
	w.tell(p, "Sold for "+coinsText(price)+".")
	w.save(p)
}
