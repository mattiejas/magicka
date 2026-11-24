package game

import (
	"math"
	"sort"

	"driftwake/content"
	"driftwake/server/internal/pb"
)

type stats struct {
	style              string
	acc, power, armour float64
	speed, reach, tier int
}

var slotOrder = []string{"weapon", "head", "body", "legs", "neck"}

func (p *Player) stats() stats {
	s := stats{style: "melee", speed: 4, reach: 1}
	if wp := p.C.Equip["weapon"]; wp != nil {
		i := content.Items[wp.ID]
		s.style, s.speed, s.reach, s.tier = i.Style, i.Speed, i.Range, i.Tier
	}
	for _, slot := range slotOrder {
		if e := p.C.Equip[slot]; e != nil {
			i := content.Items[e.ID]
			s.acc += i.Acc
			s.power += i.Power
			s.armour += i.Armour
		}
	}
	return s
}

// useAmmo spends equipped ammunition first, then the best carried. ok is false when there is none.
func (p *Player) useAmmo(kind string, maxTier int) (power float64, ok bool) {
	if e := p.C.Equip["ammo"]; e != nil {
		if i := content.Items[e.ID]; i.Ammo == kind && i.Tier <= maxTier {
			if e.Qty--; e.Qty <= 0 {
				delete(p.C.Equip, "ammo")
			}
			p.dirty = true
			return i.Power, true
		}
	}
	var best *content.Item
	for _, s := range p.C.Inv {
		if s == nil {
			continue
		}
		if i := content.Items[s.ID]; i.Ammo == kind && i.Tier <= maxTier && (best == nil || i.Tier > best.Tier) {
			best = i
		}
	}
	if best == nil {
		return 0, false
	}
	p.take(best.ID, 1)
	return best.Power, true
}

func (w *World) playerAttack(p *Player, m *Monster) {
	s := p.stats()
	p.doing = s.style
	if p.nextAttack > w.Tick {
		return
	}
	bonus := 0.0
	if s.style != "melee" {
		kind, none := "arrow", "You have no arrows for this bow."
		if s.style == "magic" {
			kind, none = "essence", "You have no essence."
		}
		b, ok := p.useAmmo(kind, max(1, s.tier))
		if !ok {
			w.info(p, none, 0)
			w.stop(p)
			return
		}
		bonus = b
	}
	p.nextAttack, p.lastCombat = w.Tick+s.speed, w.Tick
	lv, d := p.level(s.style), m.Def
	against := d.Style
	if d.Boss != nil && d.Boss.World {
		against = ""
	}
	dmg := 0
	if w.rnd() < HitChance(lv, s.acc, float64(d.Level), d.Armour, StyleModifier(s.style, against)) {
		dmg = min(int(math.Ceil(m.HP)), 1+int(math.Floor(w.rnd()*float64(MaxHit(lv, s.power+bonus)))))
	}
	w.hit(m.Map, m.X, m.Y, p.ID, m.ID, dmg, s.style)
	if m.target == 0 && d.Boss == nil {
		m.target = p.ID
	}
	if d.Boss != nil {
		m.active.set(p.ID, w.Tick)
	}
	if dmg == 0 {
		return
	}
	if d.Boss != nil {
		// A fraction of total health at the moment of the hit, so scaling cannot distort it.
		m.dmg.set(p.ID, m.dmg.get(p.ID)+float64(dmg)/m.MaxHP)
	} else {
		m.dmg.set(p.ID, m.dmg.get(p.ID)+float64(dmg))
	}
	m.HP -= float64(dmg)
	w.addXP(p, s.style, float64(dmg)*4)
	w.addXP(p, "vitality", float64(dmg)*1.5)
	if m.HP <= 0.001 {
		w.kill(m)
	}
}

type rolled struct {
	item   string
	qty    int
	unique bool
}

func rollLoot(rnd func() float64, t *content.Loot) (out []rolled) {
	n := func(a, b int) int { return a + int(math.Floor(rnd()*float64(b-a+1))) }
	for _, r := range t.Always {
		out = append(out, rolled{r.Item, n(r.Min, r.Max), false})
	}
	if len(t.Common) > 0 {
		r := t.Common[int(math.Floor(rnd()*float64(len(t.Common))))]
		out = append(out, rolled{r.Item, n(r.Min, r.Max), false})
	}
	for _, r := range t.Rare {
		if rnd() < r.Chance {
			out = append(out, rolled{r.Item, r.Qty, false})
		}
	}
	for _, u := range t.Unique {
		if rnd() < u.Chance {
			out = append(out, rolled{u.Item, 1, true})
		}
	}
	return
}

func (w *World) kill(m *Monster) {
	m.Dead, m.HP, m.target, m.respawnAt = true, 0, 0, w.Tick+Ticks(m.Def.Respawn)
	w.emit(m.Map, m.X, m.Y, &pb.Event{Event: &pb.Event_Death{Death: m.ID}})
	w.vacate(m)
	boss := m.Def.Boss
	var winners []uint32
	private, tail := 60.0, 120.0
	if boss != nil {
		if boss.World {
			w.worldBossDied(m)
		}
		winners, private, tail = m.share(), 180, 300
	} else {
		winners = append(winners, m.dmg.ids...)
		sort.SliceStable(winners, func(a, b int) bool { return m.dmg.get(winners[a]) > m.dmg.get(winners[b]) })
		if len(winners) > 1 {
			winners = winners[:1]
		}
	}
	for _, id := range winners {
		name := "An adventurer"
		if p := w.players[id]; p != nil {
			name = p.Name
		}
		for k, r := range rollLoot(w.rnd, &m.Def.Loot) {
			x, y := m.X, m.Y
			if m.Def.Size > 1 {
				x += k % m.Def.Size
			}
			if !m.Map.Walkable(x, y) {
				x = m.X
			}
			w.drop(m.Map, x, y, r.item, r.qty, id, w.Tick+Ticks(private), w.Tick+Ticks(private+tail))
			if r.unique {
				w.broadcast(infoMsg(name+" received "+content.Items[r.item].Name+" from "+m.Def.Name+".", pb.InfoKind_INFO_KIND_UNIQUE))
			}
		}
	}
	m.dmg.clear()
	m.active.clear()
}

func (w *World) hurt(p *Player, from uint32, dmg int, style string) {
	dmg = min(dmg, p.C.HP)
	p.C.HP -= dmg
	p.lastCombat = w.Tick
	w.hit(w.mapOf(p), p.C.X, p.C.Y, from, p.ID, dmg, style)
	if p.C.HP <= 0 {
		w.die(p)
	} else {
		p.dirty = true
	}
}

func (w *World) die(p *Player) {
	c := p.C
	var items []*Stack
	if c.Grave != nil {
		items = c.Grave.Items
	}
	for i, s := range c.Inv {
		if s != nil {
			items = addTo(items, s.ID, s.Qty)
			c.Inv[i] = nil
		}
	}
	if len(items) > 0 {
		c.Grave = &Grave{c.Map, c.X, c.Y, items}
	}
	w.emit(w.mapOf(p), c.X, c.Y, &pb.Event{Event: &pb.Event_Death{Death: p.ID}})
	m := w.mapOf(p)
	c.X, c.Y, c.HP = m.Spawn.X, m.Spawn.Y, MaxHP(p.level("vitality"))
	w.stop(p)
	p.via, p.rooted, p.lastCombat, p.dirty = nil, 0, -999, true
	for _, o := range w.monsters {
		if o.target == p.ID {
			o.target = 0
		}
		o.active.del(p.ID)
	}
	text := "You died."
	if len(items) > 0 {
		text = "You died. Your carried items are safe at your grave or with the reaper."
	}
	w.info(p, text, pb.InfoKind_INFO_KIND_BAD)
	w.save(p)
}

func (w *World) claimGrave(p *Player) {
	g := p.C.Grave
	if g == nil {
		w.info(p, "The reaper holds nothing of yours.", 0)
		return
	}
	var left []*Stack
	for _, s := range g.Items {
		if content.Items[s.ID].Stack || p.emptySlot() >= 0 {
			s.Qty -= p.give(s.ID, s.Qty)
		}
		if s.Qty > 0 {
			left = append(left, s)
		}
	}
	if g.Items = left; len(left) == 0 {
		p.C.Grave = nil
	} else {
		w.info(p, "Your inventory is full. The rest is kept for you.", 0)
	}
	p.dirty = true
	w.save(p)
}

func (w *World) monsterAI(m *Monster) {
	m.via = nil
	d := m.Def
	t := w.players[m.target]
	home := max(abs(m.X-m.sx), abs(m.Y-m.sy))
	if t != nil && (t.C.Map != m.Map.ID || home > 10 || w.safe(t)) {
		t, m.target, m.HP = nil, 0, m.MaxHP
		m.dmg.clear()
	}
	if t == nil && d.Aggro > 0 && home <= 4 {
		for _, p := range w.order {
			if p.C.Map == m.Map.ID && !w.safe(p) && RectDist(p.C.X, p.C.Y, m.rect()) <= d.Aggro {
				t, m.target = p, p.ID
				break
			}
		}
	}
	if t == nil {
		if home > 4 {
			w.monsterStep(m, m.sx, m.sy)
		} else if w.rnd() < 0.08 {
			x := m.X + int(math.Floor(w.rnd()*3)) - 1
			w.monsterStep(m, x, m.Y+int(math.Floor(w.rnd()*3))-1)
		}
		return
	}
	if !inReach(t.C.X, t.C.Y, m.rect(), d.Range) {
		w.monsterStep(m, t.C.X, t.C.Y)
		return
	}
	if m.nextAttack > w.Tick {
		return
	}
	m.nextAttack = w.Tick + d.Speed
	s := t.stats()
	hit := w.rnd() < HitChance(d.Level, d.Acc, float64(t.level("defence")), s.armour, StyleModifier(d.Style, s.style))
	w.addXP(t, "defence", 3+float64(d.Level)*0.8)
	// An attacked idle player fights back.
	if t.act.typ == actNone && t.nextAct < w.Tick {
		t.act = action{typ: actAttack, id: m.ID}
	}
	dmg := 0
	if hit {
		dmg = 1 + int(math.Floor(w.rnd()*float64(MaxHit(d.Level, d.Power))))
	}
	w.hurt(t, m.ID, dmg, d.Style)
}

func sign(v int) int {
	if v < 0 {
		return -1
	}
	return min(v, 1)
}
func abs(v int) int { return max(v, -v) }

func (w *World) monsterStep(m *Monster, tx, ty int) {
	dx, dy := sign(tx-m.X), sign(ty-m.Y)
	for _, d := range [3]Point{{X: dx, Y: dy}, {X: dx}, {Y: dy}} {
		if d.X == 0 && d.Y == 0 {
			continue
		}
		x, y := m.X+d.X, m.Y+d.Y
		if !canStep(m.Map, m.X, m.Y, d.X, d.Y) || w.occ[occKey{m.Map, x, y}] != nil {
			continue
		}
		w.vacate(m)
		m.X, m.Y = x, y
		m.via = []Point{{X: x, Y: y}}
		w.occ[occKey{m.Map, x, y}] = m
		return
	}
}
