package game

import (
	"slices"

	"driftwake/content"
	"driftwake/server/internal/pb"
)

// feesTotal names the saved count of everything graves and the reaper have taken.
const feesTotal = "death_fees"

// claim takes back what a player lost by dying: one kind of item, or with none named, everything affordable.
// It costs less at the grave than at the reaper, who also keeps uniques, for free.
func (w *World) claim(p *Player, item string) {
	atReaper := w.nearStation(p, "reaper")
	percent := content.Prices.GraveFeePercent
	if !w.nearGrave(p) {
		if !atReaper {
			return
		}
		percent = content.Prices.ReaperFeePercent
	}
	full := atReaper && p.claimKept(item)
	if p.C.Grave != nil {
		full = w.reclaim(p, item, percent) || full
	}
	if full {
		w.tell(p, "Your inventory is full. The rest is kept for you.")
	}
	p.dirty = true
	w.save(p)
}

func (w *World) nearGrave(p *Player) bool {
	g := p.C.Grave
	return g != nil && g.Map == p.C.Map && inReach(p.C.X, p.C.Y, tile(g.X, g.Y), stationReach)
}

// claimKept gives back as much as fits of the uniques the reaper is keeping.
func (p *Player) claimKept(item string) (full bool) {
	for _, s := range p.C.Kept {
		if item == "" || s.ID == item {
			s.Qty -= p.give(s.ID, p.room(s.ID, s.Qty))
			full = full || s.Qty > 0
		}
	}
	p.C.Kept = withoutEmpty(p.C.Kept)
	return full
}

// reclaim pays for and returns items one kind at a time. What cannot be afforded or carried waits.
func (w *World) reclaim(p *Player, item string, percent int) (full bool) {
	g := p.C.Grave
	paid, poor := 0, false
	// Coins come first, so they can pay for the rest.
	if i := slices.IndexFunc(g.Items, func(s *Stack) bool { return s.ID == coin }); i > 0 {
		g.Items[0], g.Items[i] = g.Items[i], g.Items[0]
	}
	for _, s := range g.Items {
		if item != "" && s.ID != item {
			continue
		}
		n := p.room(s.ID, s.Qty)
		full = full || n < s.Qty
		if s.ID == coin {
			paid += p.reclaimCoins(s, n, percent)
			continue
		}
		affordable := min(n, p.canSpend()*100/(content.Items[s.ID].Value*percent))
		poor = poor || affordable < n
		paid += p.reclaimItems(s, affordable, percent)
	}
	if g.Items = withoutEmpty(g.Items); len(g.Items) == 0 {
		p.C.Grave = nil
	}
	if poor {
		w.tell(p, "You cannot afford the rest. It is kept for you.")
	}
	w.takeFee(p, paid)
	return full
}

// reclaimCoins takes the fee out of the coins themselves.
func (p *Player) reclaimCoins(s *Stack, n, percent int) (fee int) {
	if n == 0 {
		return 0
	}
	fee = DeathFee(1, n, percent)
	s.Qty -= n
	if n > fee {
		p.give(coin, n-fee)
	}
	return fee
}

func (p *Player) reclaimItems(s *Stack, n, percent int) (fee int) {
	if n == 0 {
		return 0
	}
	fee = DeathFee(content.Items[s.ID].Value, n, percent)
	p.spend(fee)
	s.Qty -= n
	p.give(s.ID, n)
	return fee
}

// takeFee counts coins that leave the game. The reaper's answer stays current for whoever just paid.
func (w *World) takeFee(p *Player, paid int) {
	if paid == 0 {
		return
	}
	w.feesTaken += int64(paid)
	w.store.AddTotal(feesTotal, int64(paid))
	w.tell(p, "You paid "+coinsText(paid)+".")
	w.tellFees(p)
}

// tellFees answers how much has been taken from everyone, ever.
func (w *World) tellFees(p *Player) {
	if w.nearStation(p, "reaper") {
		w.send(p, &pb.ServerMessage{Msg: &pb.ServerMessage_FeesTaken{FeesTaken: uint64(w.feesTaken)}})
	}
}
